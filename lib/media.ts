"use client";

/**
 * Media library: every file in `guide-images/<wid>/` with where it is used in the workspace document.
 * A file no project points to is "unused" and safe to delete; the save-time prune does the same
 * automatically after 10 minutes, this lets the team see and clean up by hand.
 */
import { forgetUploaded } from "@/lib/cloud";
import { frames, type Project } from "@/lib/guide-core";
import { createClient } from "@/lib/supabase/client";
import { deleteUnusedMedia } from "@/lib/workspace-actions";

const BUCKET = "guide-images";
/** Same grace period as the automatic prune: a teammate may be about to save a fresh upload. */
export const FRESH_MS = 600000;

export type MediaFile = {
  path: string;
  name: string;
  size: number;
  type: "png" | "jpg" | "webp" | "other";
  createdAt: string;
};

export type MediaUse = {
  pid: string;
  projectName: string;
  pageId: string;
  pageTitle: string;
  /** Image label for frames, "โลโก้" for project logos. */
  label: string;
  kind: "image" | "logo";
};

const typeOf = (name: string): MediaFile["type"] => {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "png" || ext === "jpg" || ext === "webp" ? ext : "other";
};

export async function listMedia(wid: string): Promise<MediaFile[]> {
  const storage = createClient().storage.from(BUCKET);
  const out: MediaFile[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.list(wid, { limit: 1000, offset, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw new Error(error.message);
    for (const o of data ?? []) {
      if (!o.id) continue; // folders
      out.push({
        path: `${wid}/${o.name}`,
        name: o.name,
        size: Number(o.metadata?.size ?? 0),
        type: typeOf(o.name),
        createdAt: o.created_at,
      });
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Storage path → every place in the document that shows it. */
export function mediaUsage(projects: Project[]) {
  const map = new Map<string, MediaUse[]>();
  const add = (path: string | undefined, use: MediaUse) => {
    if (!path) return;
    const list = map.get(path);
    if (list) list.push(use); else map.set(path, [use]);
  };
  for (const p of projects) {
    add(p._logoPath, { pid: p.id, projectName: p.name, pageId: p.pages[0]?.id ?? "new", pageTitle: "", label: "โลโก้", kind: "logo" });
    for (const q of p.pages) {
      frames(q).forEach((f, n) => {
        const label = f.imageLabel || "ภาพ " + (n + 1);
        add(f._imagePath, { pid: p.id, projectName: p.name, pageId: q.id, pageTitle: q.title, label: f._imagePath2 ? label + " (ซ้าย)" : label, kind: "image" });
        add(f._imagePath2, { pid: p.id, projectName: p.name, pageId: q.id, pageTitle: q.title, label: label + " (ขวา)", kind: "image" });
      });
    }
  }
  return map;
}

/** Delete unused files through the server, which re-checks usage against the saved document. */
export async function deleteMedia(wid: string, paths: string[]) {
  if (!paths.length) return { deleted: 0, skipped: 0 };
  const result = await deleteUnusedMedia(wid, paths);
  if (!result.ok) throw new Error(result.error);
  forgetUploaded(paths);
  return result;
}

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
