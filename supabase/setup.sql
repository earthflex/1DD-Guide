-- 1DD Guide v2 — run once in Supabase SQL Editor as project administrator.
-- Idempotent: re-running does not delete existing workspaces or publications.
begin;

create table if not exists public.guide_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  document jsonb not null default '{"projects":[]}'::jsonb,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.guide_members (
  workspace_id uuid not null references public.guide_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','editor')),
  primary key(workspace_id,user_id)
);
create table if not exists public.guide_invites (
  workspace_id uuid not null references public.guide_workspaces(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key(workspace_id,email)
);
create table if not exists public.guide_publications (
  workspace_id uuid not null references public.guide_workspaces(id) on delete cascade,
  project_id text not null,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text,'-',''),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key(workspace_id,project_id)
);

alter table public.guide_workspaces enable row level security;
alter table public.guide_members enable row level security;
alter table public.guide_invites enable row level security;
alter table public.guide_publications enable row level security;

-- SECURITY DEFINER avoids recursive membership policies. No client may write roles.
create or replace function public.guide_is_member(wid uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.guide_members where workspace_id=wid and user_id=(select auth.uid()));
$$;
create or replace function public.guide_is_owner(wid uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.guide_members where workspace_id=wid and user_id=(select auth.uid()) and role='owner');
$$;

drop policy if exists guide_workspace_read on public.guide_workspaces;
create policy guide_workspace_read on public.guide_workspaces for select to authenticated using(public.guide_is_member(id));
drop policy if exists guide_members_read on public.guide_members;
create policy guide_members_read on public.guide_members for select to authenticated using(public.guide_is_member(workspace_id));
drop policy if exists guide_invites_read on public.guide_invites;
create policy guide_invites_read on public.guide_invites for select to authenticated using(public.guide_is_owner(workspace_id));
drop policy if exists guide_publications_read on public.guide_publications;
create policy guide_publications_read on public.guide_publications for select to authenticated using(public.guide_is_member(workspace_id));

create or replace function public.guide_create_workspace(workspace_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare wid uuid; user_email text;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  select email into user_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if user_email is null then raise exception 'Verify your email before creating a workspace'; end if;
  insert into public.guide_workspaces(name) values(trim(workspace_name)) returning id into wid;
  insert into public.guide_members(workspace_id,user_id,email,role) values(wid,auth.uid(),lower(user_email),'owner');
  return wid;
end;
$$;

-- Every save is atomic. Concurrent editors get a conflict, never a silent overwrite.
create or replace function public.guide_save_workspace(wid uuid, expected_revision bigint, doc jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare next_revision bigint;
begin
  if not public.guide_is_member(wid) then raise exception 'Permission denied'; end if;
  if doc is null or jsonb_typeof(doc->'projects') is distinct from 'array' then raise exception 'Invalid document'; end if;
  if jsonb_array_length(doc->'projects')>100 or octet_length(doc::text)>6000000 then raise exception 'Workspace metadata is too large'; end if;
  update public.guide_workspaces set document=doc,revision=revision+1,updated_at=now()
    where id=wid and revision=expected_revision returning revision into next_revision;
  if next_revision is null then raise sqlstate 'PT409' using message='Workspace changed. Reload before saving.'; end if;
  delete from public.guide_publications pub where pub.workspace_id=wid
    and not exists(select 1 from jsonb_array_elements(doc->'projects') p where p->>'id'=pub.project_id);
  return next_revision;
end;
$$;

create or replace function public.guide_invite_member(wid uuid, member_email text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.guide_is_owner(wid) then raise exception 'Only the workspace owner can invite members'; end if;
  if length(member_email)>254 or position('@' in member_email)<2 then raise exception 'Invalid email'; end if;
  insert into public.guide_invites(workspace_id,email) values(wid,lower(trim(member_email))) on conflict do nothing;
end;
$$;
create or replace function public.guide_accept_invites()
returns void language plpgsql security definer set search_path='' as $$
declare user_email text;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  select lower(email) into user_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if user_email is null then return; end if;
  insert into public.guide_members(workspace_id,user_id,email,role)
    select workspace_id,auth.uid(),user_email,'editor' from public.guide_invites where email=user_email
    on conflict(workspace_id,user_id) do nothing;
  delete from public.guide_invites where email=user_email;
end;
$$;
create or replace function public.guide_remove_member(wid uuid, member_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.guide_is_owner(wid) then raise exception 'Only the owner can remove members'; end if;
  if member_id=auth.uid() then raise exception 'The owner cannot remove their own membership'; end if;
  delete from public.guide_members where workspace_id=wid and user_id=member_id and role<>'owner';
end;
$$;
create or replace function public.guide_cancel_invite(wid uuid, member_email text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.guide_is_owner(wid) then raise exception 'Only the owner can cancel invitations'; end if;
  delete from public.guide_invites where workspace_id=wid and email=lower(trim(member_email));
end;
$$;

-- Published snapshots contain only one project and its embedded images.
-- Private drafts and Storage remain authenticated. Possession of the random token
-- grants read access to a publication; this is a share link, not customer login.
create or replace function public.guide_publish(wid uuid, pid text, guide jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare share_token text;
begin
  if not public.guide_is_member(wid) then raise exception 'Permission denied'; end if;
  if not exists(select 1 from public.guide_workspaces w, jsonb_array_elements(w.document->'projects') p where w.id=wid and p->>'id'=pid) then raise exception 'Save the project before publishing'; end if;
  if guide is null or guide->>'format' is distinct from '1dd-guide' or coalesce(guide->>'version','') not in ('1','2') or jsonb_typeof(guide->'projects') is distinct from 'array' then raise exception 'Invalid guide'; end if;
  if jsonb_array_length(guide->'projects')<>1 or guide->'projects'->0->>'id' is distinct from pid or octet_length(guide::text)>28000000 then raise exception 'Invalid guide or publication exceeds 28 MB'; end if;
  insert into public.guide_publications(workspace_id,project_id,payload) values(wid,pid,guide)
    on conflict(workspace_id,project_id) do update set payload=excluded.payload,updated_at=now()
    returning token into share_token;
  return share_token;
end;
$$;
create or replace function public.guide_revoke(wid uuid,pid text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.guide_is_member(wid) then raise exception 'Permission denied'; end if;
  delete from public.guide_publications where workspace_id=wid and project_id=pid;
end;
$$;
create or replace function public.guide_read_publication(share_token text)
returns jsonb language sql stable security definer set search_path='' as $$
  select payload from public.guide_publications where token=share_token and length(share_token)=64;
$$;

-- Private screenshot bucket. Paths start with the workspace UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('guide-images','guide-images',false,12000000,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=12000000,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists guide_image_read on storage.objects;
create policy guide_image_read on storage.objects for select to authenticated using(
  bucket_id='guide-images' and exists(select 1 from public.guide_members m where m.workspace_id::text=(storage.foldername(name))[1] and m.user_id=(select auth.uid()))
);
drop policy if exists guide_image_insert on storage.objects;
create policy guide_image_insert on storage.objects for insert to authenticated with check(
  bucket_id='guide-images' and exists(select 1 from public.guide_members m where m.workspace_id::text=(storage.foldername(name))[1] and m.user_id=(select auth.uid()))
);
drop policy if exists guide_image_update on storage.objects;
create policy guide_image_update on storage.objects for update to authenticated using(
  bucket_id='guide-images' and exists(select 1 from public.guide_members m where m.workspace_id::text=(storage.foldername(name))[1] and m.user_id=(select auth.uid()))
) with check(
  bucket_id='guide-images' and exists(select 1 from public.guide_members m where m.workspace_id::text=(storage.foldername(name))[1] and m.user_id=(select auth.uid()))
);
drop policy if exists guide_image_delete on storage.objects;
create policy guide_image_delete on storage.objects for delete to authenticated using(
  bucket_id='guide-images' and exists(select 1 from public.guide_members m where m.workspace_id::text=(storage.foldername(name))[1] and m.user_id=(select auth.uid()))
);

-- Deny direct mutations: membership checks and revision checks cannot be bypassed.
revoke all on public.guide_workspaces,public.guide_members,public.guide_invites,public.guide_publications from anon,authenticated;
grant select on public.guide_workspaces,public.guide_members,public.guide_invites,public.guide_publications to authenticated;
revoke all on function public.guide_is_member(uuid),public.guide_is_owner(uuid),public.guide_create_workspace(text),public.guide_save_workspace(uuid,bigint,jsonb),public.guide_invite_member(uuid,text),public.guide_accept_invites(),public.guide_remove_member(uuid,uuid),public.guide_cancel_invite(uuid,text),public.guide_publish(uuid,text,jsonb),public.guide_revoke(uuid,text),public.guide_read_publication(text) from public,anon,authenticated;
grant execute on function public.guide_is_member(uuid),public.guide_is_owner(uuid),public.guide_create_workspace(text),public.guide_save_workspace(uuid,bigint,jsonb),public.guide_invite_member(uuid,text),public.guide_accept_invites(),public.guide_remove_member(uuid,uuid),public.guide_cancel_invite(uuid,text),public.guide_publish(uuid,text,jsonb),public.guide_revoke(uuid,text) to authenticated;
grant execute on function public.guide_read_publication(text) to anon,authenticated;
commit;
