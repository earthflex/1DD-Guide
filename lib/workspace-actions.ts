"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/** Owner check on the server, with the caller's own session (RLS + SECURITY DEFINER helper). */
async function ownerOnly(wid: string) {
  if (!/^[0-9a-f-]{36}$/.test(wid)) return "Workspace ไม่ถูกต้อง";
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return "กรุณาเข้าสู่ระบบใหม่";
  const { data: isOwner, error } = await supabase.rpc("guide_is_owner", { wid });
  if (error || !isOwner) return "เฉพาะเจ้าของ Workspace เท่านั้นที่ทำรายการนี้ได้";
  return null;
}

export async function renameWorkspace(wid: string, rawName: string): Promise<Result> {
  const name = String(rawName).trim();
  if (name.length < 1 || name.length > 120) return { ok: false, error: "ชื่อ Workspace ต้องยาว 1–120 ตัวอักษร" };
  const denied = await ownerOnly(wid);
  if (denied) return { ok: false, error: denied };
  let admin;
  try { admin = createAdminClient(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  // Name only: never touches document/revision, so concurrent saves are unaffected.
  const { error } = await admin.from("guide_workspaces").update({ name }).eq("id", wid);
  if (error) return { ok: false, error: error.message };
  await (await createClient()).rpc("guide_log", { wid, act: "rename_workspace", info: name }).then(() => {}, () => {});
  return { ok: true };
}

/**
 * Delete an empty workspace for good: leftover images in Storage, then the row. Members, invites
 * and published links go with it through ON DELETE CASCADE. It must have no projects, and
 * `confirmName` must match exactly.
 */
export async function deleteWorkspace(wid: string, confirmName: string): Promise<Result> {
  const denied = await ownerOnly(wid);
  if (denied) return { ok: false, error: denied };
  let admin;
  try { admin = createAdminClient(); } catch (e) { return { ok: false, error: (e as Error).message }; }

  const { data: row } = await admin.from("guide_workspaces").select("name,document").eq("id", wid).maybeSingle();
  if (!row) return { ok: false, error: "ไม่พบ Workspace นี้" };
  if (String(confirmName).trim() !== row.name) return { ok: false, error: "ชื่อที่พิมพ์ไม่ตรงกับชื่อ Workspace" };
  // Checked against the saved document, so a teammate's project added in another tab also blocks it.
  const count = Array.isArray(row.document?.projects) ? row.document.projects.length : 0;
  if (count > 0) return { ok: false, error: `ยังมี ${count} โปรเจกต์ใน Workspace นี้ ลบหรือย้ายโปรเจกต์ออกให้หมดก่อน` };

  const storage = admin.storage.from("guide-images");
  for (;;) {
    const { data: list, error } = await storage.list(wid, { limit: 1000 });
    if (error) return { ok: false, error: error.message };
    const paths = (list ?? []).filter((o) => o.id).map((o) => `${wid}/${o.name}`);
    if (!paths.length) break;
    const { error: removeError } = await storage.remove(paths);
    if (removeError) return { ok: false, error: removeError.message };
  }
  const { error } = await admin.from("guide_workspaces").delete().eq("id", wid);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Delete media files no project uses. Any member may clean up, but the usage check runs here against
 * the saved document, so a file still shown in a guide can never be removed, whatever the client sends.
 */
export async function deleteUnusedMedia(wid: string, paths: string[]): Promise<{ ok: true; deleted: number; skipped: number } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/.test(wid)) return { ok: false, error: "Workspace ไม่ถูกต้อง" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "กรุณาเข้าสู่ระบบใหม่" };
  const { data: isMember } = await supabase.rpc("guide_is_member", { wid });
  if (!isMember) return { ok: false, error: "คุณไม่ได้เป็นสมาชิกของ Workspace นี้" };
  let admin;
  try { admin = createAdminClient(); } catch (e) { return { ok: false, error: (e as Error).message }; }

  const { data: row, error } = await admin.from("guide_workspaces").select("document").eq("id", wid).maybeSingle();
  if (error || !row) return { ok: false, error: error?.message ?? "ไม่พบ Workspace นี้" };
  const used = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
      if ((k === "_imagePath" || k === "_logoPath") && typeof x === "string") used.add(x);
      else walk(x);
    }
  };
  walk(row.document);
  const own = new RegExp("^" + wid + "/[a-f0-9]{64}\\.(png|jpg|webp)$");
  const targets = [...new Set(paths)].filter((p) => own.test(p) && !used.has(p));
  if (targets.length) {
    const { error: removeError } = await admin.storage.from("guide-images").remove(targets);
    if (removeError) return { ok: false, error: removeError.message };
    await supabase.rpc("guide_log", { wid, act: "delete_media", info: `${targets.length} ไฟล์` }).then(() => {}, () => {});
  }
  return { ok: true, deleted: targets.length, skipped: paths.length - targets.length };
}
