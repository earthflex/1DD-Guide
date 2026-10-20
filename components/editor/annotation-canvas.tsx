"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm";
import { GuideImage } from "@/components/guide-image";
import {
  activateFrame, addArrow, addHighlight, addPin, deleteArrow, deleteHighlight, moveBox, movePin, redactArea, resizeBox, setArrow, useEditor,
  type ArrowPos, type Tool,
} from "@/lib/editor";
import { isPair, placed, stepNumbers, type Arrow, type Frame, type Highlight } from "@/lib/guide-core";
import { richPlain } from "@/lib/rich-text";
import { cn } from "@/lib/utils";
import { visible } from "@/lib/dom";

type Point = { x: number; y: number };
type Rect = Omit<Highlight, "id">;
/** Resize handles of a selected highlight: corners and edge midpoints, named by compass direction. */
type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
const HANDLES: { part: Handle; x: number; y: number; cursor: string }[] = [
  { part: "nw", x: 0, y: 0, cursor: "cursor-nwse-resize" }, { part: "n", x: 0.5, y: 0, cursor: "cursor-ns-resize" },
  { part: "ne", x: 1, y: 0, cursor: "cursor-nesw-resize" }, { part: "e", x: 1, y: 0.5, cursor: "cursor-ew-resize" },
  { part: "se", x: 1, y: 1, cursor: "cursor-nwse-resize" }, { part: "s", x: 0.5, y: 1, cursor: "cursor-ns-resize" },
  { part: "sw", x: 0, y: 1, cursor: "cursor-nesw-resize" }, { part: "w", x: 0, y: 0.5, cursor: "cursor-ew-resize" },
];
const MIN_BOX = 0.01;

/** The box after dragging `part` to `pos`: only the dragged edges move, and never past the opposite edge. */
function resized(o: Rect, part: Handle, pos: Point): Rect {
  let left = o.x, top = o.y, right = o.x + o.width, bottom = o.y + o.height;
  if (part.includes("w")) left = Math.min(pos.x, right - MIN_BOX);
  if (part.includes("e")) right = Math.max(pos.x, left + MIN_BOX);
  if (part.includes("n")) top = Math.min(pos.y, bottom - MIN_BOX);
  if (part.includes("s")) bottom = Math.max(pos.y, top + MIN_BOX);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
type Drag =
  | { kind: "pin" | "box"; id: string; start: Point; original: Point; moved: boolean }
  | { kind: "boxResize"; id: string; part: Handle; original: Rect }
  | { kind: "highlight" | "redact" | "arrow"; start: Point }
  /** Move a whole arrow ("both") or drag one end to stretch, shrink or turn it. */
  | { kind: "arrowEdit"; id: string; part: "both" | "head" | "tail"; start: Point; original: ArrowPos; moved: boolean };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Screenshot with pins and highlight boxes; ported from bindCanvas() in legacy/app.js. */
export function AnnotationCanvas({ frame, mode, base = 0, alt }: { frame: Frame; mode: Tool; base?: number; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const selected = useEditor((s) => s.selected);
  const selectedBox = useEditor((s) => s.selectedBox);
  // Live position while dragging; committed to the document on pointerup.
  const [moving, setMoving] = useState<{ id: string; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [sizing, setSizing] = useState<{ id: string; rect: Rect } | null>(null);
  const [arrowLive, setArrowLive] = useState<{ id: string; pos: ArrowPos } | null>(null);
  const arrows = frame.arrows ?? [];
  const numbers = stepNumbers(frame.steps, base);

  const coords = (ev: React.PointerEvent): Point => {
    const r = ref.current!.getBoundingClientRect();
    return { x: clamp01((ev.clientX - r.left) / r.width), y: clamp01((ev.clientY - r.top) / r.height) };
  };

  function onPointerDown(ev: React.PointerEvent) {
    if (ev.button !== 0) return;
    activateFrame(frame.id);
    const pos = coords(ev), target = ev.target as HTMLElement;
    const pin = target.closest<HTMLElement>("[data-pin]");
    const box = target.closest<HTMLElement>("[data-highlight]");
    const handle = target.closest<Element>("[data-arrow-handle]");
    const arrowEl = target.closest<Element>("[data-arrow]");
    const boxHandle = target.closest<HTMLElement>("[data-box-handle]");
    if (boxHandle) {
      const h = frame.highlights.find((h) => h.id === boxHandle.dataset.boxId)!;
      drag.current = { kind: "boxResize", id: h.id, part: boxHandle.dataset.boxHandle as Handle, original: { x: h.x, y: h.y, width: h.width, height: h.height } };
    } else if (handle || (mode === "select" && arrowEl)) {
      const id = (handle ?? arrowEl)!.getAttribute(handle ? "data-arrow-id" : "data-arrow")!;
      const a = arrows.find((a) => a.id === id)!;
      useEditor.setState({ selectedBox: id, selected: "" });
      const part = (handle?.getAttribute("data-arrow-handle") ?? "both") as "both" | "head" | "tail";
      drag.current = { kind: "arrowEdit", id, part, start: pos, original: { x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2 }, moved: false };
    } else if (pin) {
      const s = frame.steps.find((s) => s.id === pin.dataset.pin)!;
      useEditor.setState({ selected: s.id });
      drag.current = { kind: "pin", id: s.id, start: pos, original: { x: s.x!, y: s.y! }, moved: false };
    } else if (mode === "select" && box) {
      const h = frame.highlights.find((h) => h.id === box.dataset.highlight)!;
      useEditor.setState({ selectedBox: h.id, selected: "" });
      drag.current = { kind: "box", id: h.id, start: pos, original: { x: h.x, y: h.y }, moved: false };
    } else if (mode === "redact" || mode === "highlight" || mode === "arrow") {
      drag.current = { kind: mode, start: pos };
    } else return;
    ref.current!.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  }

  function onPointerMove(ev: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const pos = coords(ev);
    if (d.kind === "boxResize") {
      setSizing({ id: d.id, rect: resized(d.original, d.part, pos) });
      return;
    }
    if (d.kind === "arrowEdit") {
      if (Math.abs(pos.x - d.start.x) + Math.abs(pos.y - d.start.y) > 0.004) d.moved = true;
      if (!d.moved) return;
      const o = d.original;
      if (d.part === "head") setArrowLive({ id: d.id, pos: { ...o, x2: pos.x, y2: pos.y } });
      else if (d.part === "tail") setArrowLive({ id: d.id, pos: { ...o, x1: pos.x, y1: pos.y } });
      else {
        // Keep the whole arrow inside the image while moving it.
        const dx = Math.max(-Math.min(o.x1, o.x2), Math.min(1 - Math.max(o.x1, o.x2), pos.x - d.start.x));
        const dy = Math.max(-Math.min(o.y1, o.y2), Math.min(1 - Math.max(o.y1, o.y2), pos.y - d.start.y));
        setArrowLive({ id: d.id, pos: { x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy } });
      }
      return;
    }
    if (d.kind === "arrow") {
      setArrowLive({ id: "", pos: { x1: d.start.x, y1: d.start.y, x2: pos.x, y2: pos.y } });
      return;
    }
    if (d.kind === "pin" || d.kind === "box") {
      if (Math.abs(pos.x - d.start.x) + Math.abs(pos.y - d.start.y) > 0.004) d.moved = true;
      if (!d.moved) return;
      let x = d.original.x + pos.x - d.start.x, y = d.original.y + pos.y - d.start.y;
      if (d.kind === "pin") { x = Math.min(0.985, Math.max(0.015, x)); y = Math.min(0.985, Math.max(0.015, y)); }
      else {
        const h = frame.highlights.find((h) => h.id === d.id)!;
        x = Math.max(0, Math.min(1 - h.width, x)); y = Math.max(0, Math.min(1 - h.height, y));
      }
      setMoving({ id: d.id, x, y });
    } else {
      setDraft({ x: Math.min(pos.x, d.start.x), y: Math.min(pos.y, d.start.y), width: Math.abs(pos.x - d.start.x), height: Math.abs(pos.y - d.start.y) });
    }
  }

  async function onPointerUp(ev: React.PointerEvent) {
    const d = drag.current;
    if (!d) {
      if ((mode === "pin" || mode === "dot") && !(ev.target as HTMLElement).closest("[data-pin]")) {
        const pos = coords(ev);
        addPin(frame.id, pos.x, pos.y, mode === "dot");
      }
      return;
    }
    drag.current = null;
    if (ref.current?.hasPointerCapture(ev.pointerId)) ref.current.releasePointerCapture(ev.pointerId);
    const live = moving, liveArrow = arrowLive, liveSize = sizing;
    setMoving(null);
    setDraft(null);
    setArrowLive(null);
    setSizing(null);
    if (d.kind === "boxResize") {
      if (liveSize) resizeBox(frame.id, d.id, liveSize.rect);
      requestAnimationFrame(() => visible(`[data-highlight="${d.id}"]`)?.focus({ preventScroll: true }));
      return;
    }
    if (d.kind === "arrowEdit") {
      if (d.moved && liveArrow) {
        const p = liveArrow.pos;
        if (Math.hypot(p.x2 - p.x1, p.y2 - p.y1) < 0.02) toast.info("ลูกศรสั้นเกินไป ลากให้ยาวขึ้นอีกนิด");
        else setArrow(frame.id, d.id, p);
      }
      return;
    }
    if (d.kind === "arrow") {
      const end = coords(ev);
      if (Math.hypot(end.x - d.start.x, end.y - d.start.y) < 0.02) return;
      return addArrow(frame.id, { x1: d.start.x, y1: d.start.y, x2: end.x, y2: end.y });
    }
    if (d.kind === "pin") {
      if (d.moved && live) movePin(frame.id, d.id, live);
      else visible(`[data-step-card="${d.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else if (d.kind === "box") {
      if (d.moved && live) moveBox(frame.id, d.id, live);
      requestAnimationFrame(() => visible(`[data-highlight="${d.id}"]`)?.focus({ preventScroll: true }));
    } else {
      const end = coords(ev);
      if (Math.abs(end.x - d.start.x) < 0.005 || Math.abs(end.y - d.start.y) < 0.005) return;
      const box = { x: Math.min(end.x, d.start.x), y: Math.min(end.y, d.start.y), width: Math.abs(end.x - d.start.x), height: Math.abs(end.y - d.start.y) };
      if (d.kind === "highlight") return addHighlight(frame.id, box);
      const ok = await confirmDialog("ปิดทับข้อมูลในภาพ", "พื้นที่นี้จะถูกระบายทึบลงในภาพ และย้อนคืนในแอปไม่ได้ ไฟล์ภาพต้นฉบับที่คุณอัปโหลดยังคงอยู่ที่เดิม", "ปิดทับข้อมูล", true);
      if (ok) redactArea(frame.id, box).catch((e: Error) => toast.error(e.message));
    }
  }

  function onPointerCancel() {
    drag.current = null;
    setMoving(null);
    setDraft(null);
    setSizing(null);
  }

  function onKeyDown(ev: React.KeyboardEvent) {
    activateFrame(frame.id);
    const target = ev.target as HTMLElement;
    const arrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(ev.key);
    const step = ev.shiftKey ? 0.02 : 0.005;
    const dx = ({ ArrowLeft: -step, ArrowRight: step } as Record<string, number>)[ev.key] ?? 0;
    const dy = ({ ArrowUp: -step, ArrowDown: step } as Record<string, number>)[ev.key] ?? 0;
    const arrowEl = target.closest<Element>("[data-arrow]");
    if (arrowEl) {
      const a = arrows.find((a) => a.id === arrowEl.getAttribute("data-arrow"));
      if (!a) return;
      if (ev.key === "Delete" || ev.key === "Backspace") {
        ev.preventDefault();
        deleteArrow(frame.id, a.id);
      } else if (arrow) {
        ev.preventDefault();
        setArrow(frame.id, a.id, { x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy });
      }
      return;
    }
    const boxEl = target.closest<HTMLElement>("[data-highlight]");
    if (boxEl) {
      const h = frame.highlights.find((h) => h.id === boxEl.dataset.highlight);
      if (!h) return;
      if (ev.key === "Delete" || ev.key === "Backspace") {
        ev.preventDefault();
        deleteHighlight(frame.id, h.id);
      } else if (arrow && ev.altKey) {
        // Alt + arrows resize from the bottom-right corner.
        ev.preventDefault();
        resizeBox(frame.id, h.id, { x: h.x, y: h.y, width: h.width + dx, height: h.height + dy });
      } else if (arrow) {
        ev.preventDefault();
        moveBox(frame.id, h.id, { x: h.x + dx, y: h.y + dy });
      }
      return;
    }
    const pinEl = target.closest<HTMLElement>("[data-pin]");
    if (!pinEl) return;
    const s = frame.steps.find((s) => s.id === pinEl.dataset.pin);
    if (!s || !placed(s)) return;
    if (arrow) {
      ev.preventDefault();
      movePin(frame.id, s.id, { x: s.x! + dx, y: s.y! + dy });
    }
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      useEditor.setState({ selected: s.id });
      visible(`[data-step="${s.id}"][data-step-field="text"]`)?.focus();
    }
  }

  return (
    <div
      ref={ref}
      id={`canvas-${frame.id}`}
      data-tool={mode}
      className={cn(
        "relative w-full touch-pan-y bg-white leading-none shadow-sm select-none",
        (mode === "pin" || mode === "dot" || mode === "redact" || mode === "highlight" || mode === "arrow") && "cursor-crosshair touch-none",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
    >
      {isPair(frame) ? (
        // Same geometry as pairLayout(): two equal columns, 2% gap, top-aligned.
        <div className="pointer-events-none grid grid-cols-2 items-start gap-x-[2%]">
          <GuideImage frame={frame} alt={`${alt} (ซ้าย)`} className="block h-auto w-full" />
          <GuideImage frame={{ image: frame.image2 ?? "", _imagePath: frame._imagePath2 }} alt={`${alt} (ขวา)`} className="block h-auto w-full" />
        </div>
      ) : (
        <GuideImage frame={frame} alt={alt} className="pointer-events-none block h-auto w-full" />
      )}
      {frame.highlights.map((h, n) => {
        const rect = sizing?.id === h.id ? sizing.rect : { ...h, ...(moving?.id === h.id ? moving : {}) };
        const handles = mode === "select" && h.id === selectedBox && !(moving?.id === h.id);
        return (
          <div key={h.id} className="contents">
          <button
            type="button"
            data-highlight={h.id}
            aria-label={`กรอบไฮไลท์ ${n + 1}`}
            title="ลากเพื่อย้าย · ลากจุดที่ขอบเพื่อปรับขนาด · Alt + ลูกศรเพื่อปรับขนาด · Delete เพื่อลบ"
            className={cn(
              "absolute z-[1] cursor-move touch-none rounded-[2px] border-2 border-brand bg-transparent p-0 outline-none",
              mode !== "select" && "pointer-events-none",
              h.id === selectedBox && "ring-2 ring-brand/30 ring-offset-1",
            )}
            style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` }}
          />
          {handles && HANDLES.map(({ part, x, y, cursor }) => (
            <span
              key={part}
              data-box-handle={part}
              data-box-id={h.id}
              aria-hidden
              className={cn("absolute z-[3] size-2.5 -translate-x-1/2 -translate-y-1/2 touch-none rounded-[2px] border-2 border-brand bg-white shadow", cursor)}
              style={{ left: `${(rect.x + rect.width * x) * 100}%`, top: `${(rect.y + rect.height * y) * 100}%` }}
            />
          ))}
          </div>
        );
      })}
      <ArrowLayer frameId={frame.id} arrows={arrows} live={arrowLive} mode={mode} selectedId={selectedBox} />
      {frame.steps.map((s, n) => {
        if (!placed(s)) return null;
        const pos = moving?.id === s.id ? moving : (s as { x: number; y: number });
        const num = numbers[n];
        return (
          <button
            key={s.id}
            type="button"
            data-pin={s.id}
            aria-label={`${num === null ? "จุด" : `หมายเลข ${num}`}: ${s.title || richPlain(s.text).split("\n")[0].slice(0, 80)}`}
            className={cn(
              "absolute z-[2] grid -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none place-items-center rounded-full border-2 border-white bg-brand p-0 text-[11px] font-bold text-white shadow-md active:cursor-grabbing",
              num === null ? "size-4" : "size-[27px]",
              s.id === selected && "outline-3 outline-offset-2 outline-brand/35",
            )}
            style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
          >
            {num}
          </button>
        );
      })}
      {draft && (
        <div
          className={cn("pointer-events-none absolute z-[4]", mode === "highlight" ? "border-2 border-brand" : "bg-neutral-900/90")}
          style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.width * 100}%`, height: `${draft.height * 100}%` }}
        />
      )}
    </div>
  );
}

/**
 * Arrows as SVG over the screenshot. Coordinates are percentages, so arrows follow the image size.
 * In select mode the (invisible, wide) hit line moves an arrow; the end handles stretch or turn it.
 */
function ArrowLayer({ frameId, arrows, live, mode, selectedId }: {
  frameId: string; arrows: Arrow[]; live: { id: string; pos: ArrowPos } | null; mode: Tool; selectedId: string;
}) {
  const marker = `arrowhead-${frameId}`;
  const shown: Arrow[] = arrows.map((a) => (live && live.id === a.id ? { ...a, ...live.pos } : a));
  if (live && !live.id) shown.push({ id: "draft", ...live.pos });
  if (!shown.length) return null;
  const pct = (v: number) => `${v * 100}%`;
  const selected = shown.find((a) => a.id === selectedId && a.id !== "draft");
  return (
    <>
      <svg className="pointer-events-none absolute inset-0 z-[1] size-full overflow-visible" aria-hidden="false">
        <defs>
          <marker id={marker} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="var(--brand)" />
          </marker>
        </defs>
        {shown.map((a, n) => (
          <g key={a.id}>
            <line x1={pct(a.x1)} y1={pct(a.y1)} x2={pct(a.x2)} y2={pct(a.y2)} stroke="var(--brand)" strokeWidth={4}
              strokeLinecap="round" markerEnd={`url(#${marker})`} opacity={a.id === "draft" ? 0.7 : 1} />
            {a.id !== "draft" && (
              <line
                data-arrow={a.id}
                tabIndex={mode === "select" ? 0 : -1}
                role="button"
                aria-label={`ลูกศร ${n + 1}`}
                x1={pct(a.x1)} y1={pct(a.y1)} x2={pct(a.x2)} y2={pct(a.y2)}
                stroke="transparent" strokeWidth={16} strokeLinecap="round"
                className={cn("outline-none", mode === "select" ? "pointer-events-auto cursor-move" : "pointer-events-none")}
              >
                <title>ลากเพื่อย้าย · ลากปลายเพื่อยืดหรือหมุน · Delete เพื่อลบ</title>
              </line>
            )}
            {a.id === selected?.id && (
              <line x1={pct(a.x1)} y1={pct(a.y1)} x2={pct(a.x2)} y2={pct(a.y2)} stroke="var(--brand)" strokeOpacity={0.25}
                strokeWidth={12} strokeLinecap="round" />
            )}
          </g>
        ))}
      </svg>
      {selected && (["tail", "head"] as const).map((part) => (
        <button
          key={part}
          type="button"
          data-arrow-handle={part}
          data-arrow-id={selected.id}
          aria-label={part === "head" ? "ลากหัวลูกศร" : "ลากท้ายลูกศร"}
          className="absolute z-[3] size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-brand bg-white p-0 shadow active:cursor-grabbing"
          style={{ left: pct(part === "head" ? selected.x2 : selected.x1), top: pct(part === "head" ? selected.y2 : selected.y1) }}
        />
      ))}
    </>
  );
}
