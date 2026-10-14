"use client";

/**
 * Editor actions, ported from act()/addPin()/replaceImage() in legacy/app.js.
 * UI state (tool, selection, undo) lives here; document changes go through the workspace store.
 */
import { toast } from "sonner";
import { create } from "zustand";
import { copy, frame as newFrame, frames, imageURL, isPair, page as newPage, pairLayout, placed, safeURL, uid, type Arrow, type Frame, type Highlight, type Page, type Project, type Step } from "@/lib/guide-core";
import { imageRatio, optimizeImage, redact, slotData } from "@/lib/images";
import { logActivity, logPageEdit } from "@/lib/activity";
import { useWorkspace } from "@/lib/store";
import { visible } from "@/lib/dom";

/** Pairing token shared with the capture extension through localStorage (same key as the legacy app). */
export function pairingToken() {
  let token = localStorage.getItem("1dd-capture-token");
  if (!token) {
    token = uid() + uid();
    localStorage.setItem("1dd-capture-token", token);
  }
  return token;
}

export type Tool = "select" | "pin" | "highlight" | "arrow" | "redact";
type Snapshot = Pick<Frame, "image" | "_imagePath" | "image2" | "_imagePath2" | "steps" | "highlights" | "arrows">;

type EditorState = {
  pid: string;
  pageId: string;
  activeFrame: string;
  tool: Tool;
  selected: string;
  selectedBox: string;
  undo: { id: string; value: Snapshot }[];
};

export const useEditor = create<EditorState>()(() => ({
  pid: "", pageId: "", activeFrame: "", tool: "select", selected: "", selectedBox: "", undo: [],
}));

/** Reset per-page UI state when the open page changes, like the legacy hashchange handler. */
export function openPage(pid: string, pageId: string) {
  const s = useEditor.getState();
  if (s.pid === pid && s.pageId === pageId) return;
  useEditor.setState({ pid, pageId, activeFrame: "", tool: "select", selected: "", selectedBox: "" });
}

export function activateFrame(id: string) {
  const s = useEditor.getState();
  if (s.activeFrame === id) return;
  useEditor.setState({ activeFrame: id, selected: "", selectedBox: "", tool: "select" });
}

/* ---------- lookups ---------- */

export const findPage = (projects: Project[], pid: string, pageId: string) => {
  const project = projects.find((p) => p.id === pid);
  const page = project?.pages.find((q) => q.id === pageId) ?? project?.pages[0];
  return { project, page };
};
const findFrame = (page: Page, id: string) => frames(page).find((f) => f.id === id);

/** Current project/page/frame in the editor (frame falls back to the page's first image). */
export function current() {
  const { pid, pageId, activeFrame } = useEditor.getState();
  const { project, page } = findPage(useWorkspace.getState().projects, pid, pageId);
  const frame = page ? findFrame(page, activeFrame) ?? page : undefined;
  return { project, page, frame };
}

/** Change the open page (draft) in the workspace store and schedule a save. */
export function editPage(change: (page: Page, project: Project) => void) {
  const { pid, pageId } = useEditor.getState();
  let edited = "";
  useWorkspace.getState().update((projects) => {
    const { project, page } = findPage(projects, pid, pageId);
    if (project && page) { change(page, project); edited = page.id; }
  }, pid);
  if (edited) logPageEdit(pid, edited);
}
function editFrame(frameId: string, change: (f: Frame, page: Page) => void) {
  editPage((page) => {
    const f = findFrame(page, frameId);
    if (f) change(f, page);
  });
}

/* ---------- undo ---------- */

function remember(f: Frame) {
  const undo = [...useEditor.getState().undo, {
    id: f.id,
    value: copy({ image: f.image, _imagePath: f._imagePath, image2: f.image2, _imagePath2: f._imagePath2, steps: f.steps, highlights: f.highlights || [], arrows: f.arrows }),
  }];
  useEditor.setState({ undo: undo.slice(-12) });
}
const forget = (id: string) => useEditor.setState((s) => ({ undo: s.undo.filter((u) => u.id !== id) }));

export function applyUndo() {
  const { frame } = current();
  const undo = useEditor.getState().undo;
  const idx = undo.findLastIndex((u) => u.id === frame?.id);
  if (!frame || idx < 0) return;
  const { value } = undo[idx];
  useEditor.setState({ undo: undo.filter((_, i) => i !== idx), selected: "" });
  editFrame(frame.id, (f) => {
    f.image = value.image;
    if (value._imagePath) f._imagePath = value._imagePath; else delete f._imagePath;
    if (value.image2) f.image2 = value.image2; else delete f.image2;
    if (value._imagePath2) f._imagePath2 = value._imagePath2; else delete f._imagePath2;
    f.steps = value.steps;
    f.highlights = value.highlights;
    if (value.arrows) f.arrows = value.arrows; else delete f.arrows;
  });
  toast.info("ย้อนการจัดจุดแล้ว");
}

/* ---------- pins, steps, highlights ---------- */

const clampPin = (v: number) => Math.min(0.985, Math.max(0.015, v));
const hasImage = (f?: Pick<Frame, "image" | "_imagePath">) => !!(f?.image || f?._imagePath);

/** Place the selected/next unplaced step, or add a new one. Returns the step id. */
export function addPin(frameId: string, x: number, y: number) {
  const { page } = current();
  const f = page && findFrame(page, frameId);
  if (!f || !hasImage(f)) return;
  const { selected } = useEditor.getState();
  const pending = f.steps.find((s) => s.id === selected && !placed(s)) || f.steps.find((s) => !placed(s));
  if (!pending && f.steps.length >= 100) return void toast.error("หนึ่งภาพรองรับได้สูงสุด 100 จุด");
  remember(f);
  const id = pending?.id ?? uid();
  editFrame(frameId, (fr) => {
    const step = fr.steps.find((s) => s.id === id);
    if (step) { step.x = clampPin(x); step.y = clampPin(y); }
    else fr.steps.push({ id, x: clampPin(x), y: clampPin(y), title: "", text: "" });
  });
  useEditor.setState({ selected: id });
  if (pending) toast.success(`วาง Point ${f.steps.indexOf(pending) + 1} แล้ว`);
  else requestAnimationFrame(() => visible(`[data-step="${id}"][data-step-field="title"]`)?.focus({ preventScroll: true }));
  return id;
}

export function movePin(frameId: string, stepId: string, to: { x: number; y: number }) {
  const { page } = current();
  const f = page && findFrame(page, frameId);
  if (!f) return;
  remember(f);
  editFrame(frameId, (fr) => {
    const s = fr.steps.find((s) => s.id === stepId);
    if (s) { s.x = clampPin(to.x); s.y = clampPin(to.y); }
  });
}

export function moveBox(frameId: string, boxId: string, to: { x: number; y: number }) {
  const { page } = current();
  const f = page && findFrame(page, frameId);
  if (!f) return;
  remember(f);
  editFrame(frameId, (fr) => {
    const h = fr.highlights.find((h) => h.id === boxId);
    if (h) { h.x = Math.max(0, Math.min(1 - h.width, to.x)); h.y = Math.max(0, Math.min(1 - h.height, to.y)); }
  });
}

export function addHighlight(frameId: string, box: Omit<Highlight, "id">) {
  const { page } = current();
  const f = page && findFrame(page, frameId);
  if (!f) return;
  if ((f.highlights || []).length >= 100) return void toast.error("หนึ่งภาพรองรับได้สูงสุด 100 กรอบ");
  remember(f);
  const id = uid();
  editFrame(frameId, (fr) => { (fr.highlights ||= []).push({ id, ...box }); });
  useEditor.setState({ selectedBox: id, tool: "select" });
}

export function deleteHighlight(frameId: string, boxId: string) {
  const { page } = current();
  const f = page && findFrame(page, frameId);
  if (!f) return;
  remember(f);
  editFrame(frameId, (fr) => { fr.highlights = (fr.highlights || []).filter((h) => h.id !== boxId); });
  useEditor.setState({ selectedBox: "" });
}

export function stepField(frameId: string, stepId: string, field: "title" | "text", value: string) {
  editFrame(frameId, (f) => {
    const s = f.steps.find((s) => s.id === stepId);
    if (s) s[field] = value;
  });
}

export function moveStep(frameId: string, stepId: string, action: "up" | "down" | "delete") {
  const { page } = current();
  const f = page && findFrame(page, frameId);
  const i = f?.steps.findIndex((s) => s.id === stepId) ?? -1;
  if (!f || i < 0) return;
  remember(f);
  editFrame(frameId, (fr) => {
    if (action === "delete") fr.steps.splice(i, 1);
    else {
      const j = i + (action === "up" ? -1 : 1);
      if (j >= 0 && j < fr.steps.length) [fr.steps[i], fr.steps[j]] = [fr.steps[j], fr.steps[i]];
    }
  });
  if (action === "delete") useEditor.setState({ selected: "" });
}

/* ---------- images ---------- */

export const imageLabel = (f: Frame, n: number) => f.imageLabel || "ภาพ " + (n + 1);

export function setImageLabel(frameId: string, value: string) {
  editFrame(frameId, (f) => { f.imageLabel = value.trim().slice(0, 80); });
}

export function jumpToFrame(id: string) {
  activateFrame(id);
  requestAnimationFrame(() => {
    const section = visible(`#editor-image-${id}`);
    section?.focus({ preventScroll: true });
    section?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  });
}

/* ---------- arrows ---------- */

export type ArrowPos = Omit<Arrow, "id">;

export function addArrow(frameId: string, pos: ArrowPos) {
  const { page } = current();
  const f = page && findFrame(page, frameId);
  if (!f) return;
  if ((f.arrows || []).length >= 100) return void toast.error("หนึ่งภาพรองรับได้สูงสุด 100 ลูกศร");
  remember(f);
  const id = uid();
  editFrame(frameId, (fr) => { (fr.arrows ||= []).push({ id, ...pos }); });
  useEditor.setState({ selectedBox: id, selected: "", tool: "select" });
}

/** Move or reshape an arrow; every coordinate is clamped to the image. */
export function setArrow(frameId: string, arrowId: string, pos: ArrowPos) {
  const { page } = current();
  const f = page && findFrame(page, frameId);
  if (!f) return;
  remember(f);
  const c = (v: number) => Math.max(0, Math.min(1, v));
  editFrame(frameId, (fr) => {
    const a = fr.arrows?.find((a) => a.id === arrowId);
    if (a) Object.assign(a, { x1: c(pos.x1), y1: c(pos.y1), x2: c(pos.x2), y2: c(pos.y2) });
  });
}

export function deleteArrow(frameId: string, arrowId: string) {
  const { page } = current();
  const f = page && findFrame(page, frameId);
  if (!f) return;
  remember(f);
  editFrame(frameId, (fr) => {
    fr.arrows = (fr.arrows || []).filter((a) => a.id !== arrowId);
    if (!fr.arrows.length) delete fr.arrows;
  });
  useEditor.setState({ selectedBox: "" });
}

/** Replace a frame's image. Steps keep their text but must be placed again; highlights are cleared. */
export async function replaceImage(frameId: string, data: string, confirmReplace: () => Promise<boolean>, source = "") {
  if (!imageURL(data)) throw new Error("ข้อมูลภาพไม่ถูกต้อง");
  const { page } = current();
  const f = page && findFrame(page, frameId);
  if (!f) throw new Error("กรุณาเลือกเนื้อหาก่อนเพิ่มภาพ");
  data = await optimizeImage(data);
  if (hasImage(f) && (f.steps.length || (f.highlights || []).length || f.arrows?.length) && !(await confirmReplace())) return;
  editFrame(frameId, (fr, pg) => {
    fr.image = data;
    delete fr._imagePath;
    fr.steps.forEach((s) => { s.x = null; s.y = null; });
    fr.highlights = [];
    delete fr.arrows;
    if (source) pg.url = safeURL(source);
  });
  forget(frameId);
  useEditor.setState({ activeFrame: frameId, selected: "", selectedBox: "", tool: "pin" });
  jumpToFrame(frameId);
  useEditor.setState({ tool: "pin" });
  toast.success("เพิ่มภาพแล้ว คลิกบนภาพเพื่อปักหมายเลข");
}

/** Add images to the open page: the first fills an empty page image, the rest become extra frames. */
export async function appendImages(data: string[]) {
  const { page } = current();
  if (!page) return;
  const available = 20 - frames(page).length + (hasImage(page) ? 0 : 1);
  if (data.length > available) throw new Error("หนึ่งเนื้อหารองรับสูงสุด 20 ภาพ");
  for (const image of data) if (!imageURL(image)) throw new Error("ข้อมูลภาพไม่ถูกต้อง");
  data = await Promise.all(data.map(optimizeImage));
  let last = "";
  const fresh = data.map((image) => ({ ...newFrame(), image }));
  editPage((pg) => {
    pg.extraImages ||= [];
    for (const f of fresh) {
      if (!hasImage(pg)) { pg.image = f.image; pg.highlights = []; last = pg.id; }
      else { pg.extraImages.push(f); last = f.id; }
    }
  });
  useEditor.setState({ activeFrame: last, selected: "", tool: "pin" });
  jumpToFrame(last);
  useEditor.setState({ tool: "pin" });
  toast.success(`เพิ่ม ${data.length} ภาพแล้ว`);
}

export function removeImage(frameId: string) {
  editPage((q) => {
    if (frameId === q.id) {
      const next = (q.extraImages || []).shift();
      q.image = next?.image || "";
      if (next?._imagePath) q._imagePath = next._imagePath; else delete q._imagePath;
      if (next?.image2) q.image2 = next.image2; else delete q.image2;
      if (next?._imagePath2) q._imagePath2 = next._imagePath2; else delete q._imagePath2;
      q.steps = next?.steps || [];
      q.highlights = next?.highlights || [];
      if (next?.arrows) q.arrows = next.arrows; else delete q.arrows;
      q.imageLabel = next?.imageLabel || "";
    } else q.extraImages = q.extraImages.filter((f) => f.id !== frameId);
  });
  useEditor.setState({ undo: [], activeFrame: "", selected: "" });
}

/** Paint a solid box into the image pixels. On a pair, each image gets the part of the box over it. */
export async function redactArea(frameId: string, box: Omit<Highlight, "id">) {
  const { page } = current();
  const f = page && findFrame(page, frameId);
  if (!f) return;
  if (!isPair(f)) {
    const image = await redact(await slotData(f, 1), box);
    editFrame(frameId, (fr) => { fr.image = image; delete fr._imagePath; });
  } else {
    const { boxes } = pairLayout(await imageRatio(f.image, f._imagePath), await imageRatio(f.image2, f._imagePath2));
    const out: { slot: 1 | 2; image: string }[] = [];
    for (const [i, b] of boxes.entries()) {
      const x0 = Math.max(box.x, b.x), y0 = Math.max(box.y, b.y);
      const x1 = Math.min(box.x + box.width, b.x + b.w), y1 = Math.min(box.y + box.height, b.y + b.h);
      if (x1 <= x0 || y1 <= y0) continue;
      const slot = (i + 1) as 1 | 2;
      out.push({ slot, image: await redact(await slotData(f, slot), { x: (x0 - b.x) / b.w, y: (y0 - b.y) / b.h, width: (x1 - x0) / b.w, height: (y1 - y0) / b.h }) });
    }
    if (!out.length) return void toast.info("กรอบที่ลากไม่ได้อยู่บนภาพ");
    editFrame(frameId, (fr) => {
      for (const o of out) {
        if (o.slot === 1) { fr.image = o.image; delete fr._imagePath; }
        else { fr.image2 = o.image; delete fr._imagePath2; }
      }
    });
  }
  forget(frameId);
  toast.success("ปิดทับข้อมูลลงในภาพแล้ว");
}

/* ---------- second image (two columns) ---------- */

type Point = { x: number; y: number };

/** Move every annotation through `map`; pins that fall outside are unplaced, boxes and arrows dropped. */
function remap(f: Frame, map: (p: Point) => Point | null) {
  for (const s of f.steps) {
    if (!placed(s)) continue;
    const p = map({ x: s.x!, y: s.y! });
    if (p) { s.x = Math.min(0.985, Math.max(0.015, p.x)); s.y = Math.min(0.985, Math.max(0.015, p.y)); }
    else { s.x = null; s.y = null; }
  }
  f.highlights = (f.highlights || []).flatMap((h) => {
    const a = map({ x: h.x, y: h.y }), b = map({ x: h.x + h.width, y: h.y + h.height });
    return a && b ? [{ ...h, x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y }] : [];
  });
  if (f.arrows) {
    f.arrows = f.arrows.flatMap((ar) => {
      const a = map({ x: ar.x1, y: ar.y1 }), b = map({ x: ar.x2, y: ar.y2 });
      return a && b ? [{ ...ar, x1: a.x, y1: a.y, x2: b.x, y2: b.y }] : [];
    });
    if (!f.arrows.length) delete f.arrows;
  }
}

/** Frame coordinates of a single image → the left column of a pair. */
const intoLeft = (r1: number, r2: number) => {
  const { boxes: [left] } = pairLayout(r1, r2);
  return (p: Point) => ({ x: left.x + p.x * left.w, y: left.y + p.y * left.h });
};
/** Pair coordinates → single image; only what sits over the left image survives. */
const outOfLeft = (r1: number, r2: number) => {
  const { boxes: [left] } = pairLayout(r1, r2);
  return (p: Point) => {
    const x = (p.x - left.x) / left.w, y = (p.y - left.y) / left.h;
    return x >= -0.001 && x <= 1.001 && y >= -0.001 && y <= 1.001 ? { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) } : null;
  };
};

/** Put a second image next to the frame's image (or replace it). Annotations on the left image stay in place. */
export async function setSecondImage(frameId: string, data: string) {
  if (!imageURL(data)) throw new Error("ข้อมูลภาพไม่ถูกต้อง");
  const { page } = current();
  const f = page && findFrame(page, frameId);
  if (!f || !hasImage(f)) throw new Error("เพิ่มภาพแรกก่อน แล้วจึงเพิ่มภาพที่ 2");
  data = await optimizeImage(data);
  const r1 = await imageRatio(f.image, f._imagePath), r2 = await imageRatio(data);
  const oldR2 = isPair(f) ? await imageRatio(f.image2, f._imagePath2) : null;
  remember(f);
  editFrame(frameId, (fr) => {
    if (oldR2 !== null) remap(fr, outOfLeft(r1, oldR2));
    remap(fr, intoLeft(r1, r2));
    fr.image2 = data;
    delete fr._imagePath2;
  });
  toast.success(oldR2 === null ? "วางภาพที่ 2 ไว้ด้านขวาแล้ว" : "เปลี่ยนภาพด้านขวาแล้ว");
}

/** Back to a single image. Annotations over the left image stay; the right image's are removed. */
export async function removeSecondImage(frameId: string) {
  const { page } = current();
  const f = page && findFrame(page, frameId);
  if (!f || !isPair(f)) return;
  const map = outOfLeft(await imageRatio(f.image, f._imagePath), await imageRatio(f.image2, f._imagePath2));
  remember(f);
  editFrame(frameId, (fr) => {
    remap(fr, map);
    delete fr.image2;
    delete fr._imagePath2;
  });
  toast.success("ลบภาพด้านขวาแล้ว");
}

/* ---------- pages ---------- */

export function savePage(pid: string, pageId: string | null, values: { title: string; url: string; description: string }) {
  const id = pageId ?? uid();
  useWorkspace.getState().update((projects) => {
    const project = projects.find((p) => p.id === pid);
    if (!project) return;
    let target = project.pages.find((q) => q.id === pageId);
    if (!target) { target = { ...newPage(), id }; project.pages.push(target); }
    target.title = values.title.trim();
    target.url = safeURL(values.url.trim());
    target.description = values.description;
  }, pid);
  const projectName = useWorkspace.getState().projects.find((p) => p.id === pid)?.name;
  if (pageId) logPageEdit(pid, id);
  else logActivity("add_page", { pid, projectName, pageId: id, pageTitle: values.title.trim() });
  return id;
}

export function duplicatePage(pid: string, pageId: string) {
  const id = uid();
  useWorkspace.getState().update((projects) => {
    const p = projects.find((p) => p.id === pid);
    const i = p?.pages.findIndex((q) => q.id === pageId) ?? -1;
    if (!p || i < 0) return;
    const clone = copy(p.pages[i]);
    clone.id = id;
    clone.title += " (สำเนา)";
    const renew = (f: Frame) => { f.steps.forEach((s: Step) => (s.id = uid())); (f.highlights || []).forEach((h) => (h.id = uid())); (f.arrows || []).forEach((a) => (a.id = uid())); };
    renew(clone);
    (clone.extraImages || []).forEach((f) => { f.id = uid(); renew(f); });
    p.pages.splice(i + 1, 0, clone);
  }, pid);
  const p = useWorkspace.getState().projects.find((x) => x.id === pid);
  logActivity("duplicate_page", { pid, projectName: p?.name, pageId: id, pageTitle: p?.pages.find((q) => q.id === id)?.title });
  return id;
}

export function movePage(pid: string, pageId: string, dir: -1 | 1) {
  useWorkspace.getState().update((projects) => {
    const p = projects.find((p) => p.id === pid);
    const i = p?.pages.findIndex((q) => q.id === pageId) ?? -1;
    const j = i + dir;
    if (p && i >= 0 && j >= 0 && j < p.pages.length) [p.pages[i], p.pages[j]] = [p.pages[j], p.pages[i]];
  }, pid);
}

/** Delete a page; returns the page to open next. */
export function deletePage(pid: string, pageId: string) {
  let next = "";
  const before = useWorkspace.getState().projects.find((x) => x.id === pid);
  const title = before?.pages.find((q) => q.id === pageId)?.title;
  useWorkspace.getState().update((projects) => {
    const p = projects.find((p) => p.id === pid);
    if (!p) return;
    p.pages = p.pages.filter((q) => q.id !== pageId);
    next = p.pages[0]?.id ?? "";
  }, pid);
  logActivity("delete_page", { pid, projectName: before?.name, pageId, pageTitle: title });
  return next;
}
