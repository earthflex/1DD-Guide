"use server";

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Fail = { ok: false; error: string };

/** Activity row as the signed-in user (guide_log takes the actor from the session). Never fails the action. */
async function log(supabase: Awaited<ReturnType<typeof createClient>>, wid: string, act: string, info?: string) {
  await supabase.rpc("guide_log", { wid, act, info: info ?? null }).then(() => {}, () => {});
}


const validWid = (wid: string) => /^[0-9a-f-]{36}$/.test(wid);
const validPassword = (p: unknown): p is string => typeof p === "string" && p.length >= 8 && p.length <= 72;

/** The signed-in user, and whether they own `wid`. Every action checks this on the server. */
async function caller(wid: string) {
  if (!validWid(wid)) return { error: "Workspace ไม่ถูกต้อง" } as const;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return { error: "กรุณาเข้าสู่ระบบใหม่" } as const;
  const { data: isOwner, error } = await supabase.rpc("guide_is_owner", { wid });
  if (error || !isOwner) return { error: "เฉพาะเจ้าของ Workspace เท่านั้นที่ทำรายการนี้ได้" } as const;
  return { id, supabase } as const;
}

function admin() {
  try { return { client: createAdminClient() } as const; } catch (e) { return { error: (e as Error).message } as const; }
}

/**
 * Add a team member by email + password. A new email gets a confirmed account (tagged with who
 * created it) and joins as editor right away. An existing account keeps its password and is invited
 * instead, so an owner can never take over someone else's account.
 */
export async function addMemberWithPassword(wid: string, rawEmail: string, password: string): Promise<{ ok: true; created: boolean } | Fail> {
  const email = String(rawEmail).trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "อีเมลไม่ถูกต้อง" };
  if (!validPassword(password)) return { ok: false, error: "รหัสผ่านต้องยาว 8–72 ตัวอักษร" };
  const me = await caller(wid);
  if ("error" in me) return { ok: false, error: me.error! };
  const a = admin();
  if ("error" in a) return { ok: false, error: a.error! };

  const { data, error } = await a.client.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { created_by: me.id } });
  if (error) {
    if (error.code !== "email_exists" && error.status !== 422) return { ok: false, error: error.message };
    const { error: inviteError } = await me.supabase.rpc("guide_invite_member", { wid, member_email: email });
    if (inviteError) return { ok: false, error: inviteError.message };
    await log(me.supabase, wid, "add_member", `${email} (บัญชีเดิม)`);
    return { ok: true, created: false };
  }
  const { error: memberError } = await a.client
    .from("guide_members")
    .insert({ workspace_id: wid, user_id: data.user.id, email, role: "editor" });
  if (memberError) return { ok: false, error: memberError.message };
  await log(me.supabase, wid, "add_member", `${email} (สร้างบัญชีใหม่)`);
  return { ok: true, created: true };
}

export type TeamUser = {
  id: string;
  email: string;
  createdAt: string;
  lastSignIn: string | null;
  /** Role in the current workspace, or null if not a member. */
  role: "owner" | "editor" | null;
  workspaces: number;
  /** Created by the caller and not yet claimed, so the caller may reset its password. */
  managed: boolean;
};

/** Accounts with their role in `wid`: every account for owners, only this workspace's members for editors. */
export async function listTeamUsers(wid: string): Promise<{ ok: true; users: TeamUser[]; me: string; isOwner: boolean } | Fail> {
  if (!validWid(wid)) return { ok: false, error: "Workspace ไม่ถูกต้อง" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub;
  if (!me) return { ok: false, error: "กรุณาเข้าสู่ระบบใหม่" };
  const { data: isMember } = await supabase.rpc("guide_is_member", { wid });
  if (!isMember) return { ok: false, error: "คุณไม่ได้เป็นสมาชิกของ Workspace นี้" };
  const { data: isOwner } = await supabase.rpc("guide_is_owner", { wid });
  const a = admin();
  if ("error" in a) return { ok: false, error: a.error! };

  const users: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await a.client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return { ok: false, error: error.message };
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  const { data: memberships, error } = await a.client.from("guide_members").select("workspace_id,user_id,role");
  if (error) return { ok: false, error: error.message };
  const count = new Map<string, number>(), role = new Map<string, "owner" | "editor">();
  for (const m of memberships ?? []) {
    count.set(m.user_id, (count.get(m.user_id) ?? 0) + 1);
    if (m.workspace_id === wid) role.set(m.user_id, m.role);
  }
  return {
    ok: true,
    me,
    isOwner: !!isOwner,
    // The system-wide directory is for owners, who manage accounts; editors only see their own workspace.
    users: users.filter((u) => isOwner || role.has(u.id)).map((u) => ({
      id: u.id,
      email: u.email ?? "",
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at ?? null,
      role: role.get(u.id) ?? null,
      workspaces: count.get(u.id) ?? 0,
      managed: !!isOwner && u.id !== me && u.app_metadata?.created_by === me,
    })),
  };
}

/** Owner adds an existing account to `wid` as editor right away (no invite round-trip). */
export async function addExistingMember(wid: string, userId: string): Promise<{ ok: true } | Fail> {
  const me = await caller(wid);
  if ("error" in me) return { ok: false, error: me.error! };
  const a = admin();
  if ("error" in a) return { ok: false, error: a.error! };
  const { data } = await a.client.auth.admin.getUserById(userId);
  if (!data.user?.email) return { ok: false, error: "ไม่พบบัญชีนี้" };
  const { error } = await a.client.from("guide_members")
    .upsert({ workspace_id: wid, user_id: userId, email: data.user.email.toLowerCase(), role: "editor" }, { onConflict: "workspace_id,user_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };
  await log(me.supabase, wid, "add_member", data.user.email.toLowerCase());
  return { ok: true };
}

/**
 * Owner sets a new password for a member. Allowed only for accounts the owner created in this app,
 * so owning a workspace never grants control over an account someone else set up.
 */
export async function resetMemberPassword(wid: string, memberId: string, password: string): Promise<{ ok: true } | Fail> {
  if (!validPassword(password)) return { ok: false, error: "รหัสผ่านต้องยาว 8–72 ตัวอักษร" };
  const me = await caller(wid);
  if ("error" in me) return { ok: false, error: me.error! };
  const a = admin();
  if ("error" in a) return { ok: false, error: a.error! };
  const { data: member } = await a.client.from("guide_members").select("user_id").eq("workspace_id", wid).eq("user_id", memberId).maybeSingle();
  if (!member) return { ok: false, error: "ไม่พบสมาชิกนี้ใน Workspace" };
  const { data } = await a.client.auth.admin.getUserById(memberId);
  if (data.user?.app_metadata?.created_by !== me.id)
    return { ok: false, error: "ตั้งรหัสผ่านใหม่ได้เฉพาะบัญชีที่คุณสร้าง ให้สมาชิกเปลี่ยนเองที่หน้าสมาชิก" };
  const { error } = await a.client.auth.admin.updateUserById(memberId, { password });
  if (error) return { ok: false, error: error.message };
  await log(me.supabase, wid, "reset_password", data.user?.email ?? "");
  return { ok: true };
}

/**
 * After a member sets their own password, the account is theirs: drop `created_by` so the owner who
 * created it can no longer reset its password.
 */
export async function releaseAccount(): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return;
  const a = admin();
  if ("error" in a) return;
  const { data: user } = await a.client.auth.admin.getUserById(id);
  if (user.user?.app_metadata?.created_by) await a.client.auth.admin.updateUserById(id, { app_metadata: { created_by: null } });
}
