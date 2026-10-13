"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm";
import { GuideImage } from "@/components/guide-image";
import {
  activateFrame, addHighlight, addPin, deleteHighlight, moveBox, movePin, redactArea, useEditor, type Tool,
} from "@/lib/editor";
import { placed, type Frame } from "@/lib/guide-core";
import { cn } from "@/lib/utils";

type Point = { x: number; y: number };
type Drag =
  | { kind: "pin" | "box"; id: string; start: Point; original: Point; moved: boolean }
  | { kind: "highlight" | "redact"; start: Point };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Screenshot with pins and highlight boxes; ported from bindCanvas() in legacy/app.js. */
export function AnnotationCanvas({ frame, mode, alt }: { frame: Frame; mode: Tool; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const selected = useEditor((s) => s.selected);
  const selectedBox = useEditor((s) => s.selectedBox);
  // Live position while dragging; committed to the document on pointerup.
  const [moving, setMoving] = useState<{ id: string; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

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
    if (pin) {
      const s = frame.steps.find((s) => s.id === pin.dataset.pin)!;
      useEditor.setState({ selected: s.id });
      drag.current = { kind: "pin", id: s.id, start: pos, original: { x: s.x!, y: s.y! }, moved: false };
    } else if (mode === "select" && box) {
      const h = frame.highlights.find((h) => h.id === box.dataset.highlight)!;
      useEditor.setState({ selectedBox: h.id, selected: "" });
      drag.current = { kind: "box", id: h.id, start: pos, original: { x: h.x, y: h.y }, moved: false };
    } else if (mode === "redact" || mode === "highlight") {
      drag.current = { kind: mode, start: pos };
    } else return;
    ref.current!.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  }

  function onPointerMove(ev: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const pos = coords(ev);
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
      if (mode === "pin" && !(ev.target as HTMLElement).closest("[data-pin]")) {
        const pos = coords(ev);
        addPin(frame.id, pos.x, pos.y);
      }
      return;
    }
    drag.current = null;
    if (ref.current?.hasPointerCapture(ev.pointerId)) ref.current.releasePointerCapture(ev.pointerId);
    const live = moving;
    setMoving(null);
    setDraft(null);
    if (d.kind === "pin") {
      if (d.moved && live) movePin(frame.id, d.id, live);
      else document.querySelector(`[data-step-card="${d.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else if (d.kind === "box") {
      if (d.moved && live) moveBox(frame.id, d.id, live);
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-highlight="${d.id}"]`)?.focus({ preventScroll: true }));
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
  }

  function onKeyDown(ev: React.KeyboardEvent) {
    activateFrame(frame.id);
    const target = ev.target as HTMLElement;
    const arrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(ev.key);
    const step = ev.shiftKey ? 0.02 : 0.005;
    const dx = ({ ArrowLeft: -step, ArrowRight: step } as Record<string, number>)[ev.key] ?? 0;
    const dy = ({ ArrowUp: -step, ArrowDown: step } as Record<string, number>)[ev.key] ?? 0;
    const boxEl = target.closest<HTMLElement>("[data-highlight]");
    if (boxEl) {
      const h = frame.highlights.find((h) => h.id === boxEl.dataset.highlight);
      if (!h) return;
      if (ev.key === "Delete" || ev.key === "Backspace") {
        ev.preventDefault();
        deleteHighlight(frame.id, h.id);
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
      document.querySelector<HTMLElement>(`[data-step="${s.id}"][data-step-field="title"]`)?.focus();
    }
  }

  return (
    <div
      ref={ref}
      id={`canvas-${frame.id}`}
      data-tool={mode}
      className={cn(
        "relative w-full touch-pan-y bg-white leading-none shadow-sm select-none",
        (mode === "pin" || mode === "redact" || mode === "highlight") && "cursor-crosshair touch-none",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
    >
      <GuideImage frame={frame} alt={alt} className="pointer-events-none block h-auto w-full" />
      {frame.highlights.map((h, n) => {
        const pos = moving?.id === h.id ? moving : h;
        return (
          <button
            key={h.id}
            type="button"
            data-highlight={h.id}
            aria-label={`กรอบไฮไลท์ ${n + 1}`}
            title="ลากเพื่อย้าย · Delete เพื่อลบ"
            className={cn(
              "absolute z-[1] cursor-move touch-none rounded-[2px] border-2 border-brand bg-transparent p-0 outline-none",
              mode !== "select" && "pointer-events-none",
              h.id === selectedBox && "ring-2 ring-brand/30 ring-offset-1",
            )}
            style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, width: `${h.width * 100}%`, height: `${h.height * 100}%` }}
          />
        );
      })}
      {frame.steps.map((s, n) => {
        if (!placed(s)) return null;
        const pos = moving?.id === s.id ? moving : (s as { x: number; y: number });
        return (
          <button
            key={s.id}
            type="button"
            data-pin={s.id}
            aria-label={`หมายเลข ${n + 1}: ${s.title}`}
            className={cn(
              "absolute z-[2] grid size-[27px] -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none place-items-center rounded-full border-2 border-white bg-brand p-0 text-[11px] font-bold text-white shadow-md active:cursor-grabbing",
              s.id === selected && "outline-3 outline-offset-2 outline-brand/35",
            )}
            style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
          >
            {n + 1}
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
