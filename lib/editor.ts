"use client";

/**
 * Editor actions, ported from act()/addPin()/replaceImage() in legacy/app.js.
 * UI state (tool, selection, undo) lives here; document changes go through the workspace store.
 */
import { toast } from "sonner";
import { create } from "zustand";
import { copy, frame as newFrame, frames, imageURL, page as newPage, placed, safeURL, uid, type Frame, type Highlight, type Page, type Project, type Step } from "@/lib/guide-core";
import { frameData, optimizeImage, redact } from "@/lib/images";
import { logActivity, logPageEdit } from "@/lib/activity";
import { useWorkspace } from "@/lib/store";

/** Pairing token shared with the capture extension through localStorage (same key as the legacy app). */
export function pairingToken() {
  let token = localStorage.getItem("1dd-capture-token");
  if (!token) {
    token = uid() + uid();
    localStorage.setItem("1dd-capture-token", token);
  }
  return token;
}

export type Tool = "select" | "pin" | "highlight" | "redact";
type Snapshot = Pick<Frame, "image" | "_imagePath" | "steps" | "highlights">;

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
    value: copy({ image: f.image, _imagePath: f._imagePath, steps: f.steps, highlights: f.highlights || [] }),
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
    f.steps = value.steps;
    f.highlights = value.highlights;
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
  else requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-step="${id}"][data-step-field="title"]`)?.focus({ preventScroll: true }));
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
    const section = document.getElementById("editor-image-" + id);
    section?.focus({ preventScroll: true });
    section?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  });
}

/** Replace a frame's image. Steps keep their text but must be placed again; highlights are cleared. */
export async function replaceImage(frameId: string, data: string, confirmReplace: () => Promise<boolean>, source = "") {
  if (!imageURL(data)) throw new Error("ข้อมูลภาพไม่ถูกต้อง");
  const { page } = current();
  const f = page && findFrame(page, frameId);
  if (!f) throw new Error("กรุณาเลือกเนื้อหาก่อนเพิ่มภาพ");
  data = await optimizeImage(data);
  if (hasImage(f) && (f.steps.length || (f.highlights || []).length) && !(await confirmReplace())) return;
  editFrame(frameId, (fr, pg) => {
    fr.image = data;
    delete fr._imagePath;
    fr.steps.forEach((s) => { s.x = null; s.y = null; });
    fr.highlights = [];
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
      q.steps = next?.steps || [];
      q.highlights = next?.highlights || [];
      q.imageLabel = next?.imageLabel || "";
    } else q.extraImages = q.extraImages.filter((f) => f.id !== frameId);
  });
  useEditor.setState({ undo: [], activeFrame: "", selected: "" });
}

export async function redactArea(frameId: string, box: Omit<Highlight, "id">) {
  const { page } = current();
  const f = page && findFrame(page, frameId);
  if (!f) return;
  const image = await redact(await frameData(f), box);
  editFrame(frameId, (fr) => { fr.image = image; delete fr._imagePath; });
  forget(frameId);
  toast.success("ปิดทับข้อมูลลงในภาพแล้ว");
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
    const renew = (f: Frame) => { f.steps.forEach((s: Step) => (s.id = uid())); (f.highlights || []).forEach((h) => (h.id = uid())); };
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
