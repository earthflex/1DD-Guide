-- 1DD Guide v2 — run in Supabase SQL Editor as project administrator.
-- Includes the activity log and viewing passwords for published links (Next.js app).
-- Idempotent: re-running does not delete existing workspaces or publications.
begin;

create extension if not exists pgcrypto with schema extensions;

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

-- Viewing password of a published link (bcrypt); null means anyone with the link can read it.
alter table public.guide_publications add column if not exists password_hash text;
-- Optional readable link name, e.g. /g/chula-guide. Unique across all workspaces.
alter table public.guide_publications add column if not exists slug text;
alter table public.guide_publications drop constraint if exists guide_publications_slug_format;
alter table public.guide_publications add constraint guide_publications_slug_format
  check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$');
create unique index if not exists guide_publications_slug on public.guide_publications(slug) where slug is not null;

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

-- Links open by the random 64-character token or by the optional slug.
-- Public read without a password: protected links return nothing here.
create or replace function public.guide_read_publication(share_token text)
returns jsonb language sql stable security definer set search_path='' as $$
  select payload from public.guide_publications
  where ((token=share_token and length(share_token)=64) or (slug is not null and slug=share_token)) and password_hash is null;
$$;

-- Lets the viewer page know it should ask for a password (reveals nothing else).
create or replace function public.guide_publication_protected(share_token text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.guide_publications
    where ((token=share_token and length(share_token)=64) or (slug is not null and slug=share_token)) and password_hash is not null);
$$;

-- Read a protected link. A wrong password waits a moment to slow down guessing.
create or replace function public.guide_read_publication_with_password(share_token text, pass text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare result jsonb;
begin
  if share_token is null or length(share_token)>64 or pass is null or length(pass)>200 then return null; end if;
  select payload into result from public.guide_publications
    where ((token=share_token and length(share_token)=64) or (slug is not null and slug=share_token)) and password_hash is not null and password_hash=extensions.crypt(pass,password_hash);
  if result is null then perform pg_sleep(0.5); end if;
  return result;
end;
$$;

-- Set or clear (null/empty) the viewing password of a published project. Any workspace member.
create or replace function public.guide_set_publication_password(wid uuid, pid text, pass text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.guide_is_member(wid) then raise exception 'Permission denied'; end if;
  if pass is not null and pass<>'' and (length(pass)<4 or length(pass)>72) then raise exception 'Password must be 4-72 characters'; end if;
  update public.guide_publications
    set password_hash=case when pass is null or pass='' then null else extensions.crypt(pass,extensions.gen_salt('bf',10)) end
    where workspace_id=wid and project_id=pid;
  if not found then raise exception 'Publish the project before setting a password'; end if;
end;
$$;

-- Set or clear (null/empty) the readable link name. Any workspace member.
create or replace function public.guide_set_publication_slug(wid uuid, pid text, new_slug text)
returns void language plpgsql security definer set search_path='' as $$
declare clean text := nullif(lower(trim(new_slug)),'');
begin
  if not public.guide_is_member(wid) then raise exception 'Permission denied'; end if;
  if clean is not null and clean !~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$' then
    raise exception 'Use 3-60 letters a-z, digits or hyphens';
  end if;
  update public.guide_publications set slug=clean where workspace_id=wid and project_id=pid;
  if not found then raise exception 'Publish the project before naming its link'; end if;
exception when unique_violation then
  raise exception 'This link name is already used by another guide';
end;
$$;

-- Publish status for the dashboard, without downloading the (large) payloads or exposing hashes.
drop function if exists public.guide_publication_status(uuid);
create or replace function public.guide_publication_status(wid uuid)
returns table(project_id text, token text, slug text, updated_at timestamptz, has_password boolean)
language sql stable security definer set search_path='' as $$
  select p.project_id, p.token, p.slug, p.updated_at, p.password_hash is not null
  from public.guide_publications p where p.workspace_id=wid and public.guide_is_member(wid);
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

-- Activity log: who did what. Written only through guide_log(); members can read their workspace.
create table if not exists public.guide_activity (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.guide_workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null default '',
  action text not null check (action ~ '^[a-z_]{1,40}$'),
  project_id text,
  project_name text,
  page_id text,
  page_title text,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists guide_activity_workspace_time on public.guide_activity(workspace_id, created_at desc);
alter table public.guide_activity enable row level security;

drop policy if exists guide_activity_read on public.guide_activity;
create policy guide_activity_read on public.guide_activity for select to authenticated using(public.guide_is_member(workspace_id));

-- Writes go only through guide_log(): the actor is always auth.uid(), so nobody can log as someone else.
-- "edit_page" and "save" rows from the same person are merged within 30 minutes to keep the table small.
create or replace function public.guide_log(wid uuid, act text, pid text default null, pname text default null,
  pgid text default null, pgtitle text default null, info text default null)
returns void language plpgsql security definer set search_path='' as $$
declare actor_email text; merged bigint;
begin
  if auth.uid() is null or not public.guide_is_member(wid) then return; end if;
  if act !~ '^[a-z_]{1,40}$' then raise exception 'Invalid action'; end if;
  if act in ('edit_page','save') then
    update public.guide_activity set created_at=now(), page_title=coalesce(left(pgtitle,160),page_title), project_name=coalesce(left(pname,120),project_name)
      where id=(select id from public.guide_activity where workspace_id=wid and user_id=auth.uid() and action=act
        and page_id is not distinct from left(pgid,100) and created_at>now()-interval '30 minutes'
        order by created_at desc limit 1)
      returning id into merged;
    if merged is not null then return; end if;
  end if;
  select lower(email) into actor_email from auth.users where id=auth.uid();
  insert into public.guide_activity(workspace_id,user_id,email,action,project_id,project_name,page_id,page_title,detail)
    values(wid,auth.uid(),coalesce(actor_email,''),act,left(pid,100),left(pname,120),left(pgid,100),left(pgtitle,160),left(info,300));
  -- Keep six months per workspace; the index makes this cheap.
  delete from public.guide_activity where workspace_id=wid and created_at<now()-interval '180 days';
end;
$$;

-- Every successful save (legacy or new app) leaves a "save" row, merged per person per 30 minutes,
-- unless the new app already logged what happened (an edit_page in 30 minutes, or anything in 2).
create or replace function public.guide_activity_on_save()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or new.revision=old.revision then return new; end if;
  if exists(select 1 from public.guide_activity where workspace_id=new.id and user_id=auth.uid()
    and ((action='edit_page' and created_at>now()-interval '30 minutes') or created_at>now()-interval '2 minutes')) then return new; end if;
  perform public.guide_log(new.id,'save');
  return new;
end;
$$;
drop trigger if exists guide_activity_save on public.guide_workspaces;
create trigger guide_activity_save after update of revision on public.guide_workspaces
  for each row execute function public.guide_activity_on_save();

-- "Team account" = a member of at least one workspace. A stranger who somehow got an account
-- (e.g. sign-ups re-enabled by mistake) belongs to none, so the overview and self-join stay closed to them.
create or replace function public.guide_is_team()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.guide_members where user_id=(select auth.uid()));
$$;

-- Team-wide overview: every team account sees every workspace and how much space it uses,
-- so the team can watch the free-tier limits (500 MB database, 1 GB storage). Sizes only, no content.
create or replace function public.guide_system_overview()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'database_bytes', pg_database_size(current_database()),
    'storage_bytes', (select coalesce(sum((o.metadata->>'size')::bigint),0) from storage.objects o where o.bucket_id='guide-images'),
    'workspaces', coalesce((select jsonb_agg(w order by w->>'name') from (
      select jsonb_build_object(
        'id', ws.id, 'name', ws.name, 'updated_at', ws.updated_at,
        'document_bytes', octet_length(ws.document::text),
        'projects', coalesce(jsonb_array_length(ws.document->'projects'),0),
        'members', (select count(*) from public.guide_members m where m.workspace_id=ws.id),
        'owners', (select coalesce(jsonb_agg(m.email),'[]'::jsonb) from public.guide_members m where m.workspace_id=ws.id and m.role='owner'),
        'my_role', (select m.role from public.guide_members m where m.workspace_id=ws.id and m.user_id=auth.uid()),
        'publications', (select count(*) from public.guide_publications p where p.workspace_id=ws.id),
        'publication_bytes', (select coalesce(sum(octet_length(p.payload::text)),0) from public.guide_publications p where p.workspace_id=ws.id),
        'files', (select count(*) from storage.objects o where o.bucket_id='guide-images' and (storage.foldername(o.name))[1]=ws.id::text),
        'file_bytes', (select coalesce(sum((o.metadata->>'size')::bigint),0) from storage.objects o where o.bucket_id='guide-images' and (storage.foldername(o.name))[1]=ws.id::text)
      ) as w from public.guide_workspaces ws) t), '[]'::jsonb)
  ) where public.guide_is_team();
$$;

-- Any team account may join any workspace as editor (team-only system; customers have no accounts).
-- New accounts become team members when an owner adds them to a workspace.
create or replace function public.guide_join_workspace(wid uuid)
returns void language plpgsql security definer set search_path='' as $$
declare user_email text;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  select lower(email) into user_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if user_email is null then raise exception 'Verify your email first'; end if;
  if not public.guide_is_team() then raise exception 'Only team members can join workspaces'; end if;
  if not exists(select 1 from public.guide_workspaces where id=wid) then raise exception 'Workspace not found'; end if;
  insert into public.guide_members(workspace_id,user_id,email,role) values(wid,auth.uid(),user_email,'editor')
    on conflict(workspace_id,user_id) do nothing;
  perform public.guide_log(wid,'join_workspace');
end;
$$;

-- Deny direct mutations: membership checks and revision checks cannot be bypassed.
revoke all on public.guide_workspaces,public.guide_members,public.guide_invites,public.guide_publications from anon,authenticated;
grant select on public.guide_workspaces,public.guide_members,public.guide_invites to authenticated;
-- Members may read publications, but not the password hash.
grant select (workspace_id,project_id,token,slug,payload,updated_at) on public.guide_publications to authenticated;
revoke all on public.guide_activity from anon,authenticated;
grant select on public.guide_activity to authenticated;
revoke all on function public.guide_is_member(uuid),public.guide_is_owner(uuid),public.guide_create_workspace(text),public.guide_save_workspace(uuid,bigint,jsonb),public.guide_invite_member(uuid,text),public.guide_accept_invites(),public.guide_remove_member(uuid,uuid),public.guide_cancel_invite(uuid,text),public.guide_publish(uuid,text,jsonb),public.guide_revoke(uuid,text),public.guide_read_publication(text) from public,anon,authenticated;
grant execute on function public.guide_is_member(uuid),public.guide_is_owner(uuid),public.guide_create_workspace(text),public.guide_save_workspace(uuid,bigint,jsonb),public.guide_invite_member(uuid,text),public.guide_accept_invites(),public.guide_remove_member(uuid,uuid),public.guide_cancel_invite(uuid,text),public.guide_publish(uuid,text,jsonb),public.guide_revoke(uuid,text) to authenticated;
grant execute on function public.guide_read_publication(text) to anon,authenticated;
revoke all on function public.guide_publication_protected(text),public.guide_read_publication_with_password(text,text),
  public.guide_set_publication_password(uuid,text,text),public.guide_publication_status(uuid),
  public.guide_log(uuid,text,text,text,text,text,text),public.guide_activity_on_save(),
  public.guide_set_publication_slug(uuid,text,text),public.guide_system_overview(),public.guide_join_workspace(uuid),public.guide_is_team() from public,anon,authenticated;
grant execute on function public.guide_publication_protected(text),public.guide_read_publication_with_password(text,text) to anon,authenticated;
grant execute on function public.guide_set_publication_password(uuid,text,text),public.guide_publication_status(uuid),
  public.guide_log(uuid,text,text,text,text,text,text),public.guide_set_publication_slug(uuid,text,text),
  public.guide_system_overview(),public.guide_join_workspace(uuid) to authenticated;
commit;
