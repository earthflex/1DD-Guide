"use client";

/**
 * Activity log ("who did what"). Rows are written by the guide_log() SQL function, which takes the
 * actor from the session. Logging never blocks or breaks the action that triggered it.
 */
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/store";

export type ActivityAction =
  | "create_project" | "import_project" | "duplicate_project" | "delete_project" | "update_project" | "rename_project"
  | "add_page" | "duplicate_page" | "delete_page" | "edit_page"
  | "publish" | "revoke"
  | "add_member" | "remove_member" | "cancel_invite" | "reset_password"
  | "delete_media" | "rename_workspace" | "join_workspace" | "save";

type Target = { pid?: string; projectName?: string; pageId?: string; pageTitle?: string; detail?: string };

/** Thai labels for the activity page. */
export const ACTION_LABEL: Record<ActivityAction, string> = {
  create_project: "สร้างโปรเจกต์",
  import_project: "นำเข้าโปรเจกต์",
  duplicate_project: "ทำสำเนาโปรเจกต์",
  delete_project: "ลบโปรเจกต์",
  update_project: "แก้ตั้งค่าโปรเจกต์",
  rename_project: "เปลี่ยนชื่อโปรเจกต์",
  add_page: "เพิ่มเนื้อหา",
  duplicate_page: "ทำสำเนาเนื้อหา",
  delete_page: "ลบเนื้อหา",
  edit_page: "แก้ไขเนื้อหา",
  publish: "เผยแพร่ลิงก์",
  revoke: "เพิกถอนลิงก์",
  add_member: "เพิ่มสมาชิก",
  remove_member: "นำสมาชิกออก",
  cancel_invite: "ยกเลิกคำเชิญ",
  reset_password: "ตั้งรหัสผ่านใหม่ให้สมาชิก",
  delete_media: "ลบไฟล์",
  rename_workspace: "เปลี่ยนชื่อ Workspace",
  join_workspace: "เข้าร่วม Workspace",
  save: "บันทึกการแก้ไข",
};

export const ACTION_GROUPS: { label: string; actions: ActivityAction[] }[] = [
  { label: "โปรเจกต์", actions: ["create_project", "import_project", "duplicate_project", "delete_project", "update_project", "rename_project"] },
  { label: "เนื้อหา", actions: ["add_page", "duplicate_page", "delete_page", "edit_page", "save"] },
  { label: "เผยแพร่", actions: ["publish", "revoke"] },
  { label: "สมาชิก", actions: ["add_member", "remove_member", "cancel_invite", "reset_password", "join_workspace"] },
  { label: "ไฟล์และ Workspace", actions: ["delete_media", "rename_workspace"] },
];

export function logActivity(action: ActivityAction, t: Target = {}, wid = useWorkspace.getState().wid) {
  if (!wid) return;
  void createClient().rpc("guide_log", {
    wid, act: action, pid: t.pid ?? null, pname: t.projectName ?? null,
    pgid: t.pageId ?? null, pgtitle: t.pageTitle ?? null, info: t.detail ?? null,
  }).then(() => {}, () => {});
}

/** Typing saves every 250 ms; the server merges edits per 30 minutes, and this skips the round-trips. */
const lastEdit = new Map<string, number>();
export function logPageEdit(pid: string, pageId: string) {
  const key = `${pid}/${pageId}`, now = Date.now();
  if (now - (lastEdit.get(key) ?? 0) < 5 * 60_000) return;
  lastEdit.set(key, now);
  const p = useWorkspace.getState().projects.find((x) => x.id === pid);
  const q = p?.pages.find((x) => x.id === pageId);
  logActivity("edit_page", { pid, projectName: p?.name, pageId, pageTitle: q?.title });
}

export type ActivityRow = {
  id: number;
  email: string;
  action: ActivityAction;
  project_id: string | null;
  project_name: string | null;
  page_id: string | null;
  page_title: string | null;
  detail: string | null;
  created_at: string;
};
