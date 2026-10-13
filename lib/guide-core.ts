/**
 * Portable data model, ported from legacy/core.js. The document format and the
 * validation rules must stay identical so both apps can share one database and
 * backup files move between them.
 */

export const VERSION = 2;

export type Step = { id: string; x: number | null; y: number | null; title: string; text: string };
export type Highlight = { id: string; x: number; y: number; width: number; height: number };
export type Frame = {
  id: string;
  /** Base64 data URL for an image that is not uploaded yet; "" once it lives in Storage. */
  image: string;
  /** Storage path `wid/<sha256>.<ext>` of an uploaded image (cloud format). */
  _imagePath?: string;
  imageLabel?: string;
  steps: Step[];
  highlights: Highlight[];
};
export type Page = Frame & {
  title: string;
  description: string;
  url: string;
  note: string;
  extraImages: Frame[];
};
export type Project = {
  id: string;
  name: string;
  website: string;
  description: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  logo?: string;
  _logoPath?: string;
  logoText?: string;
  pages: Page[];
};
export type GuideFile = { format: "1dd-guide"; version: number; exportedAt: string; projects: Project[] };

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
export const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function safeURL(value: unknown) {
  if (!value || typeof value !== "string") return "";
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password ? u.href : "";
  } catch {
    return "";
  }
}
export const placed = (s: Pick<Step, "x" | "y"> | undefined) => Number.isFinite(s?.x) && Number.isFinite(s?.y);
export const websiteURL = (value: unknown) => {
  const v = String(value || "").trim();
  return v ? safeURL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : "https://" + v) : "";
};
export const imageURL = (s: unknown): s is string =>
  typeof s === "string" && s.length <= 18000000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s);
export const logoURL = (s: unknown): s is string =>
  typeof s === "string" && s.length <= 2000000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s);
const str = (v: unknown, n = 10000) => (typeof v === "string" ? v.slice(0, n) : "");

export const colors = ["#ff6600", "#404040", "#e65c35", "#336c61", "#4668ad", "#9064ae", "#b57b2a"];

export const page = (title = "เนื้อหาใหม่"): Page => ({
  id: uid(), title, description: "", url: "", image: "", steps: [], highlights: [], extraImages: [], note: "",
});
export const project = (name: string, website = "", description = ""): Project => ({
  id: uid(), name, website, description, color: colors[0],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), pages: [page()],
});
export const frames = (q: Page): Frame[] => [q, ...(q.extraImages || [])];
export const frame = (): Frame => ({ id: uid(), image: "", steps: [], highlights: [] });

/** Storage-path checks used when reading the cloud document. */
export const cloudImagePath = (wid: string) => new RegExp("^" + wid + "/[a-f0-9]{64}\\.(png|jpg|webp)$");
export const cloudLogoPath = (wid: string) => new RegExp("^" + wid + "/[a-f0-9]{64}\\.png$");
const validID = (id: unknown) => typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id);

type CleanOptions = {
  /** Cloud reads: keep IDs and timestamps, and accept `_imagePath`/`_logoPath` inside this workspace. */
  cloud?: { wid: string };
};

/* eslint-disable @typescript-eslint/no-explicit-any -- validating untrusted JSON */
function clean(raw: any, { cloud }: CleanOptions = {}): Project[] {
  if (!raw || raw.format !== "1dd-guide" || ![1, VERSION].includes(raw.version) || !Array.isArray(raw.projects) || raw.projects.length < 1 || raw.projects.length > 100)
    throw new Error("ไฟล์นี้ไม่ใช่ข้อมูลสำรอง 1DD Guide รุ่นที่รองรับ");
  const imgPath = cloud && cloudImagePath(cloud.wid);
  const logoPath = cloud && cloudLogoPath(cloud.wid);
  const keepId = (v: any) => {
    if (!cloud) return uid();
    if (!validID(v)) throw new Error("Page ID ไม่ถูกต้อง");
    return v as string;
  };
  let totalPages = 0, totalImages = 0;
  return raw.projects.map((p: any) => {
    if (!p || !str(p.name, 120).trim() || !Array.isArray(p.pages) || p.pages.length > 200) throw new Error("ข้อมูลโปรเจกต์ไม่ครบ หรือมีเนื้อหามากเกินไป");
    const out = project(str(p.name, 120).trim(), safeURL(p.website), str(p.description, 2000));
    if (cloud) {
      if (!validID(p.id)) throw new Error("Project ID ไม่ถูกต้อง");
      out.id = p.id;
      out.createdAt = p.createdAt;
      out.updatedAt = p.updatedAt;
    }
    if (p.logo && !logoURL(p.logo)) throw new Error("โลโก้ในไฟล์ไม่ถูกต้อง");
    if (p.logo !== undefined) out.logo = p.logo || "";
    if (cloud && p._logoPath) {
      if (!logoPath!.test(p._logoPath)) throw new Error("ตำแหน่งโลโก้ไม่ถูกต้อง");
      out._logoPath = p._logoPath;
    }
    if (p.logoText !== undefined) out.logoText = str(p.logoText, 120).trim();
    totalImages += (out.logo || "").length;
    if (totalImages > 80000000) throw new Error("ข้อมูลภาพรวมเกิน 80 MB กรุณาแยกสำรองเป็นรายโปรเจกต์");
    out.color = colors.includes(p.color) ? p.color : colors[0];
    out.pages = p.pages.map((q: any) => {
      if (!q || !str(q.title, 160).trim() || !Array.isArray(q.steps) || q.steps.length > 100 || ++totalPages > 500) throw new Error("ข้อมูลเนื้อหาไม่ถูกต้อง");
      const np: Page = { ...page(str(q.title, 160).trim()), description: str(q.description), url: safeURL(q.url), note: str(q.note) };
      if (q.extraImages !== undefined && !Array.isArray(q.extraImages)) throw new Error("ข้อมูลภาพเพิ่มเติมไม่ถูกต้อง");
      if ((q.extraImages || []).length > 19) throw new Error("หนึ่งเนื้อหารองรับสูงสุด 20 ภาพ");
      const cleanFrame = (f: any): Frame => {
        if (!f || !Array.isArray(f.steps) || f.steps.length > 100) throw new Error("ข้อมูลคำอธิบายภาพไม่ถูกต้อง");
        if (f.image && !imageURL(f.image)) throw new Error("รองรับภาพ PNG, JPEG และ WebP ที่ฝังอยู่ในไฟล์เท่านั้น");
        totalImages += (f.image || "").length;
        if (totalImages > 80000000) throw new Error("ข้อมูลภาพรวมเกิน 80 MB กรุณาแยกสำรองเป็นรายโปรเจกต์");
        const out: Frame = { ...frame(), id: keepId(f.id), image: f.image || "" };
        if (cloud && f._imagePath) {
          if (!imgPath!.test(f._imagePath)) throw new Error("ตำแหน่งภาพไม่ถูกต้อง");
          out._imagePath = f._imagePath;
        }
        if (typeof f.imageLabel === "string") out.imageLabel = str(f.imageLabel, 80).trim();
        out.steps = f.steps.map((s: any) => {
          if (s && s.x === null && s.y === null) return { id: keepId(s.id), x: null, y: null, title: str(s.title, 200), text: str(s.text) };
          if (!s || typeof s.x !== "number" || typeof s.y !== "number" || !Number.isFinite(s.x) || !Number.isFinite(s.y) || s.x < 0 || s.x > 1 || s.y < 0 || s.y > 1)
            throw new Error("ตำแหน่งหมายเลขในไฟล์ไม่ถูกต้อง");
          return { id: keepId(s.id), x: s.x, y: s.y, title: str(s.title, 200), text: str(s.text) };
        });
        if (f.highlights !== undefined && (!Array.isArray(f.highlights) || f.highlights.length > 100)) throw new Error("ข้อมูลกรอบไฮไลท์ไม่ถูกต้อง");
        out.highlights = (f.highlights || []).map((h: any) => {
          if (!h || !["x", "y", "width", "height"].every((k) => typeof h[k] === "number" && Number.isFinite(h[k])) || h.x < 0 || h.y < 0 || h.width <= 0 || h.height <= 0 || h.x + h.width > 1.000001 || h.y + h.height > 1.000001)
            throw new Error("ตำแหน่งกรอบไฮไลท์ไม่ถูกต้อง");
          return { id: keepId(h.id), x: h.x, y: h.y, width: h.width, height: h.height };
        });
        if (!out.image && !out._imagePath && (out.steps.some(placed) || out.highlights.length)) throw new Error("เนื้อหามีหมายเลขแต่ไม่มีภาพ");
        return out;
      };
      const first = cleanFrame(q);
      np.id = first.id;
      np.image = first.image;
      if (first._imagePath) np._imagePath = first._imagePath;
      np.steps = first.steps;
      np.highlights = first.highlights;
      if (first.imageLabel !== undefined) np.imageLabel = first.imageLabel;
      np.extraImages = (q.extraImages || []).map(cleanFrame);
      return np;
    });
    return out;
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Validate a JSON backup. Gives every item a fresh ID, like the legacy app. */
export const validateImport = (raw: unknown) => clean(raw);

/** Validate the cloud document of workspace `wid`, keeping IDs and Storage paths. */
export const validateCloud = (projects: unknown[], wid: string) =>
  projects.length ? clean({ format: "1dd-guide", version: VERSION, projects }, { cloud: { wid } }) : [];

export const pack = (projects: Project[]): GuideFile => ({
  format: "1dd-guide", version: VERSION, exportedAt: new Date().toISOString(), projects: copy(projects),
});
export const filename = (s: string) =>
  String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").trim().slice(0, 90) || "1dd-guide";

/** First image of a project, used as the card cover. */
export const coverOf = (p: Project) => p.pages.flatMap(frames).find((f) => f.image || f._imagePath);
