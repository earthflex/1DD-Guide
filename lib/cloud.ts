/**
 * Workspace load/save against Supabase, ported from legacy/cloud.js.
 * Images stay in Storage: the store keeps `_imagePath` and the UI shows them
 * through signed URLs. Only new images (base64 `image`) get uploaded on save.
 */
import { copy, frames, imageURL, logoURL, validateCloud, type Project } from "@/lib/guide-core";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "guide-images";

export type Workspace = { id: string; name: string; revision: number; projects: Project[] };

export class ConflictError extends Error {
  constructor() {
    super("มีคนแก้ไข Workspace นี้แล้ว กรุณาสำรองงานของคุณ และโหลดข้อมูลล่าสุดก่อนแก้ต่อ");
  }
}

const networkMessage = (message: string) =>
  /failed to fetch|fetch failed|network/i.test(message) ? "ติดต่อคลาวด์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่" : message;

export async function loadWorkspace(wid: string): Promise<Workspace> {
  const { data, error } = await createClient()
    .from("guide_workspaces")
    .select("id,name,document,revision")
    .eq("id", wid)
    .maybeSingle();
  if (error) throw new Error(networkMessage(error.message));
  if (!data) throw new Error("ไม่พบ Workspace หรือคุณไม่มีสิทธิ์เข้าถึง");
  // Sanitize text/URLs/paths on the read boundary, keeping internal IDs.
  const projects = validateCloud(data.document?.projects ?? [], wid);
  return { id: data.id, name: data.name, revision: data.revision, projects };
}

/** Uploaded data URL → Storage path, so unchanged images are never hashed or uploaded twice. */
const uploaded = new Map<string, string>();

async function imagePath(data: string, wid: string) {
  const known = uploaded.get(data);
  if (known?.startsWith(wid + "/")) return known;
  const [head, base64] = data.split(",");
  const mime = head.slice(5).split(";")[0];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hash = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
  const ext = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as Record<string, string>)[mime];
  const path = `${wid}/${hash}.${ext}`;
  const { error } = await createClient().storage.from(BUCKET)
    .upload(path, new Blob([bytes], { type: mime }), { upsert: true, contentType: mime, cacheControl: "3600" });
  if (error) throw new Error(networkMessage(error.message));
  uploaded.set(data, path);
  return path;
}

/** Save the whole workspace. Returns the new revision; throws ConflictError if someone saved first. */
export async function saveWorkspace(wid: string, revision: number, projects: Project[]): Promise<number> {
  const doc = copy(projects);
  for (const p of doc) {
    if (p.logo) {
      if (!logoURL(p.logo)) throw new Error("โลโก้ไม่ถูกต้อง");
      p._logoPath = await imagePath(p.logo, wid);
      p.logo = "";
    }
    for (const page of p.pages) for (const f of frames(page)) {
      if (f.image) {
        if (!imageURL(f.image)) throw new Error("รูปไม่ถูกต้อง");
        f._imagePath = await imagePath(f.image, wid);
        f.image = "";
      }
    }
  }
  const { data, error } = await createClient()
    .rpc("guide_save_workspace", { wid, expected_revision: revision, doc: { projects: doc } });
  if (error) {
    if (error.code === "PT409") throw new ConflictError();
    throw new Error(networkMessage(error.message));
  }
  const used = new Set<string>();
  for (const p of doc) {
    if (p._logoPath) used.add(p._logoPath);
    for (const page of p.pages) for (const f of frames(page)) if (f._imagePath) used.add(f._imagePath);
  }
  pruneImages(wid, used).catch(() => {});
  return data as number;
}

// Delete bucket files no project in the saved workspace points to. Shared hashed paths make per-image
// deletes unsafe, so compare against the whole saved document; skip fresh files a teammate may be saving.
const PRUNE_EVERY = 120000, PRUNE_GRACE = 600000;
const lastPrune = new Map<string, number>();

async function pruneImages(wid: string, used: Set<string>) {
  if (Date.now() - (lastPrune.get(wid) ?? 0) < PRUNE_EVERY) return;
  lastPrune.set(wid, Date.now());
  const storage = createClient().storage.from(BUCKET);
  const stale: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data: list, error } = await storage.list(wid, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) return;
    for (const o of list ?? []) {
      const path = `${wid}/${o.name}`;
      if (o.id && !used.has(path) && Date.now() - Date.parse(o.created_at) > PRUNE_GRACE) stale.push(path);
    }
    if (!list || list.length < 1000) break;
  }
  if (!stale.length) return;
  await storage.remove(stale);
  const gone = new Set(stale);
  for (const [data, path] of uploaded) if (gone.has(path)) uploaded.delete(data);
}

/** Forget deleted files so a later save uploads them again if the same image comes back. */
export function forgetUploaded(paths: string[]) {
  const gone = new Set(paths);
  for (const [data, path] of uploaded) if (gone.has(path)) uploaded.delete(data);
}

/* ---------- Signed URLs: batched, cached, refreshed before they expire ---------- */

const SIGN_TTL = 3600, SIGN_MARGIN = 300_000;
const signed = new Map<string, { url: string; expires: number }>();
let queue: { path: string; resolve: (url: string) => void; reject: (e: Error) => void }[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;

/** Signed URL for a Storage path. Requests made in the same tick share one API call. */
export function signedUrl(path: string): Promise<string> {
  const hit = signed.get(path);
  if (hit && hit.expires - SIGN_MARGIN > Date.now()) return Promise.resolve(hit.url);
  return new Promise((resolve, reject) => {
    queue.push({ path, resolve, reject });
    flushTimer ??= setTimeout(flushSignQueue, 0);
  });
}

async function flushSignQueue() {
  const batch = queue;
  queue = [];
  flushTimer = undefined;
  const paths = [...new Set(batch.map((b) => b.path))];
  const { data, error } = await createClient().storage.from(BUCKET).createSignedUrls(paths, SIGN_TTL);
  const expires = Date.now() + SIGN_TTL * 1000;
  for (const row of data ?? []) if (row.path && row.signedUrl) signed.set(row.path, { url: row.signedUrl, expires });
  for (const b of batch) {
    const hit = signed.get(b.path);
    if (hit) b.resolve(hit.url);
    else b.reject(new Error(error?.message ?? "โหลดรูปจากคลาวด์ไม่ได้"));
  }
}

const downloaded = new Map<string, Promise<string>>();

/** Download a Storage image as a data URL (export, publish, backup, pixel editing). Paths are content hashes, so cache them. */
export function imageData(path: string): Promise<string> {
  let hit = downloaded.get(path);
  if (!hit) {
    hit = fetchImageData(path);
    hit.catch(() => downloaded.delete(path));
    downloaded.set(path, hit);
  }
  return hit;
}

async function fetchImageData(path: string): Promise<string> {
  const { data, error } = await createClient().storage.from(BUCKET).download(path);
  if (error || !data) throw new Error("อ่านรูปจากคลาวด์ไม่ได้");
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("อ่านรูปจากคลาวด์ไม่ได้"));
    r.readAsDataURL(data);
  });
}
