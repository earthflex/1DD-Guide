"use client";

import { confirmDialog } from "@/components/confirm";
import { frames, validateImport, type Project } from "@/lib/guide-core";
import { decodeImage } from "@/lib/images";
import { logActivity } from "@/lib/activity";
import { useWorkspace } from "@/lib/store";

/** Import a JSON backup as new copies, ported from legacy importFile(). Returns the first imported project. */
export async function importGuideFile(file: File): Promise<Project | null> {
  if (file.size > 85000000) throw new Error("ไฟล์มีขนาดเกิน 85 MB");
  let raw: unknown;
  try { raw = JSON.parse(await file.text()); } catch { throw new Error("อ่าน JSON ไม่ได้ กรุณาเลือกไฟล์สำรองจาก 1DD Guide"); }
  const imported = validateImport(raw);
  for (const p of imported) if (p.logo) await decodeImage(p.logo);
  for (const p of imported) for (const q of p.pages) for (const f of frames(q)) if (f.image) await decodeImage(f.image);
  if (!(await confirmDialog("นำเข้าคู่มือ", `พบ ${imported.length} โปรเจกต์ ระบบจะเพิ่มเป็นสำเนาใหม่ โดยไม่ทับงานเดิม`, "นำเข้า"))) return null;
  useWorkspace.getState().update((projects) => { projects.unshift(...imported); });
  for (const p of imported) logActivity("import_project", { pid: p.id, projectName: p.name, detail: file.name });
  return imported[0];
}
