"use client";

/** Project-level actions from legacy act(): rename, website, settings, duplicate, delete, backup, publish. */
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { copy, filename, frames, pack, uid, websiteURL, type Project } from "@/lib/guide-core";
import { logActivity } from "@/lib/activity";
import { loadPublications } from "@/lib/publications";
import { useWorkspace } from "@/lib/store";
import { download, resolveImages } from "@/lib/viewer";

const update = (pid: string, change: (p: Project) => void) =>
  useWorkspace.getState().update((projects) => {
    const p = projects.find((x) => x.id === pid);
    if (p) change(p);
  }, pid);

export function renameProject(pid: string, name: string) {
  name = name.trim();
  const p = useWorkspace.getState().projects.find((x) => x.id === pid);
  if (!p) return false;
  if (!name) { toast.error("ชื่อโปรเจกต์ต้องไม่ว่าง"); return false; }
  if (name === p.name) return true;
  update(pid, (x) => { x.name = name.slice(0, 120); });
  logActivity("rename_project", { pid, projectName: name, detail: `จาก “${p.name}”` });
  toast.success("บันทึกชื่อโปรเจกต์แล้ว");
  return true;
}

export function setProjectWebsite(pid: string, raw: string) {
  const p = useWorkspace.getState().projects.find((x) => x.id === pid);
  if (!p) return false;
  const url = websiteURL(raw.trim());
  if (raw.trim() && !url) { toast.error("URL ไม่ถูกต้อง กรุณาใช้เว็บไซต์แบบ https:// หรือ http://"); return false; }
  if (url === p.website) return true;
  update(pid, (x) => { x.website = url; });
  logActivity("update_project", { pid, projectName: p.name, detail: url ? `เว็บไซต์ ${url}` : "ลบเว็บไซต์" });
  toast.success("บันทึก URL เว็บไซต์แล้ว");
  return true;
}

/** Logo edit from the project dialog: `logo` data URL for a new upload, `keepPath` to keep the stored one. */
export type Branding = { logo: string; keepPath: boolean; logoText: string };

export function applyBranding(p: Project, b: Branding) {
  if (b.logo) { p.logo = b.logo; delete p._logoPath; }
  else if (!b.keepPath) { p.logo = ""; delete p._logoPath; }
  p.logoText = b.logoText.trim().slice(0, 120);
}

export function saveProjectSettings(pid: string, values: { name: string; website: string; description: string } & Branding) {
  update(pid, (p) => {
    p.name = values.name;
    p.website = values.website;
    p.description = values.description;
    applyBranding(p, values);
  });
  logActivity("update_project", { pid, projectName: values.name });
  toast.success("บันทึกโปรเจกต์แล้ว");
}

export function addProject(p: Project) {
  useWorkspace.getState().update((projects) => { projects.unshift(p); }, p.id);
}

/** Duplicate with fresh IDs. Stored images keep their paths, so nothing is re-uploaded. */
export function duplicateProject(pid: string) {
  const src = useWorkspace.getState().projects.find((x) => x.id === pid);
  if (!src) return null;
  const clone = copy(src);
  clone.id = uid();
  clone.name = (src.name + " (สำเนา)").slice(0, 120);
  clone.createdAt = clone.updatedAt = new Date().toISOString();
  for (const q of clone.pages) {
    q.id = uid();
    for (const f of frames(q)) {
      if (f !== q) f.id = uid();
      f.steps.forEach((s) => (s.id = uid()));
      (f.highlights || []).forEach((h) => (h.id = uid()));
    }
  }
  addProject(clone);
  logActivity("duplicate_project", { pid: clone.id, projectName: clone.name, detail: `จาก “${src.name}”` });
  toast.success("สร้างสำเนาโปรเจกต์แล้ว");
  return clone;
}

export function deleteProject(pid: string) {
  const name = useWorkspace.getState().projects.find((x) => x.id === pid)?.name;
  useWorkspace.getState().update((projects) => {
    const i = projects.findIndex((x) => x.id === pid);
    if (i >= 0) projects.splice(i, 1);
  });
  logActivity("delete_project", { pid, projectName: name });
  toast.success("ลบโปรเจกต์แล้ว");
}

/** Download a JSON backup with images embedded, readable by both apps. */
export async function exportJSON(items: Project[]) {
  const id = toast.loading("กำลังเตรียมไฟล์สำรอง…");
  try {
    const full = await resolveImages(items);
    download((items.length === 1 ? filename(items[0].name) : "1dd-guide-backup") + ".json", JSON.stringify(pack(full), null, 2));
    toast.success("ดาวน์โหลดไฟล์สำรองแล้ว", { id });
  } catch (e) {
    toast.error((e as Error).message, { id });
  }
}

/** Publish one project as a read-only snapshot (same payload format as the legacy app). Returns the share URL. */
export async function publishProject(pid: string) {
  const ws = useWorkspace.getState();
  await ws.flush();
  if (useWorkspace.getState().saveError) throw new Error("กรุณาแก้ปัญหาการบันทึกก่อนเผยแพร่");
  const p = useWorkspace.getState().projects.find((x) => x.id === pid);
  if (!p || !ws.wid) throw new Error("ไม่พบโปรเจกต์");
  const [full] = await resolveImages([p]);
  const { data, error } = await createClient().rpc("guide_publish", { wid: ws.wid, pid, guide: pack([full]) });
  if (error) throw new Error(error.message);
  logActivity("publish", { pid, projectName: p.name });
  void loadPublications(ws.wid);
  return `${location.origin}/g/${data as string}`;
}

export async function revokeProject(pid: string) {
  const wid = useWorkspace.getState().wid;
  const { error } = await createClient().rpc("guide_revoke", { wid, pid });
  if (error) throw new Error(error.message);
  if (wid) void loadPublications(wid);
  logActivity("revoke", { pid, projectName: useWorkspace.getState().projects.find((x) => x.id === pid)?.name });
  toast.success("เพิกถอนลิงก์แล้ว");
}
