/**
 * Self-contained customer guide HTML, ported from legacy/viewer.js makeHTML().
 * Exported files need no server or CDN: font, logo and images are embedded.
 * Font and logo are loaded lazily so the editor bundle stays small.
 */
import { imageData } from "@/lib/cloud";
import { copy, esc, frames, imageURL, logoURL, type Project } from "@/lib/guide-core";
import { VIEWER_CSS, VIEWER_RUNTIME } from "@/lib/viewer/source";

/**
 * Sandbox for showing a guide inside the app: an opaque origin, so guide content can never reach the
 * app's session. Scripts run the viewer; modals allow print; popups open backend links.
 */
export const GUIDE_SANDBOX = "allow-scripts allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads";

/** Build the HTML. Every image in `project` must already be a data URL (see resolveImages). */
export async function makeHTML(project: Project) {
  const [{ GUIDE_FONT_CSS }, { GUIDE_LOGO }] = await Promise.all([import("@/lib/viewer/font"), import("@/lib/viewer/brand")]);
  const p = copy(project);
  if (!logoURL(p.logo)) p.logo = "";
  // The runtime puts image sources into HTML unescaped, so only strict base64 data URLs may pass.
  for (const q of p.pages) for (const f of frames(q)) {
    if (!imageURL(f.image)) f.image = "";
    if (f.image2 !== undefined && !imageURL(f.image2)) delete f.image2;
  }
  p.logoText = typeof p.logoText === "string" ? p.logoText.slice(0, 120) : "";
  // Escape '<' as well as Unicode line separators to prevent closing script tags.
  const data = JSON.stringify(p).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const css = VIEWER_CSS.replace("/*FONT*/", GUIDE_FONT_CSS);
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="robots" content="noindex,nofollow"><title>${esc(p.name)} — 1DD Guide</title><style>${css}</style></head><body><header class="header"><div class="brand-group"><img id="brand-logo" class="brand-logo" src="${GUIDE_LOGO}" alt="1DD"><span class="brand-label">Guide</span></div><div class="actions"><button class="btn" data-action="cover">ดูหน้าปก PDF</button><label class="sr-only" for="print-scope">ขอบเขต PDF</label><select class="btn" id="print-scope"><option value="all">ทั้งโปรเจกต์</option><option value="current">เนื้อหานี้</option></select><button class="btn primary" id="print">ดาวน์โหลด PDF</button></div></header><div class="mobile-nav"><label class="sr-only" for="mobile-select">เลือกเนื้อหา</label><select id="mobile-select"></select></div><div class="layout"><aside class="sidebar"><div class="eyebrow">Client handbook</div><h2 id="project-name" class="project-title"></h2><p id="project-description" class="project-description"></p><nav id="chapters" class="nav" aria-label="สารบัญเนื้อหา"></nav><p class="sidebar-footer" id="updated"></p><p class="print-error" id="print-error" role="alert"></p></aside><main id="main" class="main"></main></div><div class="print-only" id="print-content"></div><dialog id="zoom" aria-label="ขยายภาพประกอบ"></dialog><script type="application/json" id="guide-data">${data}</script><script>(${VIEWER_RUNTIME})();</script></body></html>`;
}

/** Copy of the projects with every Storage image downloaded and embedded as base64 (export, publish, backup). */
export async function resolveImages(projects: Project[]): Promise<Project[]> {
  const out = copy(projects);
  const cache = new Map<string, Promise<string>>();
  const get = (path: string) => {
    if (!cache.has(path)) cache.set(path, imageData(path));
    return cache.get(path)!;
  };
  const jobs: Promise<void>[] = [];
  for (const p of out) {
    if (p._logoPath && !p.logo) jobs.push(get(p._logoPath).then((d) => { p.logo = d; }));
    delete p._logoPath;
    for (const q of p.pages) for (const f of frames(q)) {
      if (f._imagePath && !f.image) jobs.push(get(f._imagePath).then((d) => { f.image = d; }));
      if (f._imagePath2 && !f.image2) jobs.push(get(f._imagePath2).then((d) => { f.image2 = d; }));
      delete f._imagePath;
      delete f._imagePath2;
    }
  }
  await Promise.all(jobs);
  return out;
}

export function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
