"use client";

import {
  ArrowDown, ArrowUp, Camera, ChevronDown, Columns2, Image as ImageIcon, MapPin, MousePointer2, MoveUpRight, Plus, Square,
  SquareDashed, Trash2, Undo2, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm";
import { AnnotationCanvas } from "@/components/editor/annotation-canvas";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  activateFrame, addPin, applyUndo, deleteArrow, deleteHighlight, removeSecondImage, moveStep, removeImage, stepField, useEditor, type Tool,
} from "@/lib/editor";
import { isPair, placed, type Frame } from "@/lib/guide-core";
import { cn } from "@/lib/utils";
import { visible } from "@/lib/dom";

const toolHint = (f: Frame, mode: Tool) =>
  mode === "pin"
    ? f.steps.some((s) => !placed(s)) ? "คลิกบนภาพเพื่อวาง Point ที่เลือก · ข้อความเดิมจะยังอยู่" : "คลิกบนภาพเพื่อเพิ่มหมายเลข · ลากจุดเพื่อย้าย"
    : mode === "highlight" ? "ลากบนภาพเพื่อสร้างกรอบไฮไลท์สีส้ม"
    : mode === "arrow" ? "ลากจากจุดเริ่มไปยังจุดที่ต้องการชี้ หัวลูกศรอยู่ปลายทาง"
    : mode === "redact" ? "ลากกรอบบนภาพเพื่อปิดทับข้อมูลถาวร"
    : "เลือกหมายเลข กรอบ หรือลูกศรเพื่อแก้ไข · ลากเพื่อย้าย · ลากปลายลูกศรเพื่อยืด หด หรือหมุน";

/** Where new images come from. Slot 2 is the right-hand image of a two-column pair. */
export type ImageSource = { upload: (frameId: string, slot?: 1 | 2) => void; capture: (frameId: string, slot?: 1 | 2) => void };

/** One image of a page: toolbar, annotation canvas and its Point list. Ported from editorFrame(). */
export function FrameSection({ frame: f, label, n, total, pageTitle, source }: {
  frame: Frame; label: string; n: number; total: number; pageTitle: string; source: ImageSource;
}) {
  const active = useEditor((s) => s.activeFrame);
  const isActive = active ? active === f.id : n === 0;
  const tool = useEditor((s) => s.tool);
  const selectedBox = useEditor((s) => s.selectedBox);
  const canUndo = useEditor((s) => s.undo.some((u) => u.id === f.id));
  const mode: Tool = isActive ? tool : "select";
  const hasImage = !!(f.image || f._imagePath);
  const pair = isPair(f);

  async function removeRight() {
    if (!(await confirmDialog("ลบภาพขวา", "Point ไฮไลท์ และลูกศรที่อยู่บนภาพขวาจะถูกนำออก ส่วนของภาพซ้ายยังอยู่ที่เดิม", "ลบภาพขวา", true))) return;
    removeSecondImage(f.id).catch((e: Error) => toast.error(e.message));
  }

  const setTool = (t: string) => {
    if (!t) return;
    activateFrame(f.id);
    useEditor.setState({ tool: t as Tool });
  };

  async function remove() {
    if (await confirmDialog("ลบภาพ", "ลบภาพที่เลือกและหมายเลขของภาพนี้?", "ลบภาพ", true)) removeImage(f.id);
  }

  return (
    <section
      id={`editor-image-${f.id}`}
      data-frame={f.id}
      tabIndex={-1}
      aria-label={label}
      onFocusCapture={() => activateFrame(f.id)}
      className="scroll-mt-20 outline-none"
    >
      {total > 1 && (
        <h2 className="mb-3 text-sm"><b className="font-medium">{label}</b> <span className="text-muted-foreground">· {n + 1} / {total}</span></h2>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label={`แก้ไขภาพ ${n + 1}`} className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={setTool} aria-label="เครื่องมือบนภาพ">
                <ToggleGroupItem value="select" aria-label="เลือก"><MousePointer2 />เลือก</ToggleGroupItem>
                <ToggleGroupItem value="pin" disabled={!hasImage} aria-label="ปักหมายเลข"><MapPin />ปักหมายเลข</ToggleGroupItem>
                <ToggleGroupItem value="highlight" disabled={!hasImage} aria-label="กรอบไฮไลท์"><Square />ไฮไลท์</ToggleGroupItem>
                <ToggleGroupItem value="arrow" disabled={!hasImage} aria-label="ลูกศร"><MoveUpRight />ลูกศร</ToggleGroupItem>
                <ToggleGroupItem value="redact" disabled={!hasImage} aria-label="ปิดทับ"><SquareDashed />ปิดทับ</ToggleGroupItem>
              </ToggleGroup>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" disabled={!canUndo} aria-label="ย้อนการจัดจุด"
                    onClick={() => { activateFrame(f.id); applyUndo(); }}>
                    <Undo2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>ย้อนการจัดจุด (Ctrl / ⌘ + Z)</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm"><ImageIcon />{hasImage ? "เปลี่ยนภาพ" : "เพิ่มภาพ"}<ChevronDown /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {pair && <DropdownMenuLabel className="text-xs text-muted-foreground">ภาพซ้าย</DropdownMenuLabel>}
                  <DropdownMenuItem onSelect={() => source.upload(f.id)}><Upload />อัปโหลดภาพ</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => source.capture(f.id)}><Camera />จับภาพแท็บ / หน้าต่าง</DropdownMenuItem>
                  {hasImage && <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">{pair ? "ภาพขวา" : "วางภาพที่ 2 คู่กัน (2 คอลัมน์)"}</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => source.upload(f.id, 2)}><Upload />{pair ? "เปลี่ยนภาพขวา (อัปโหลด)" : "อัปโหลดภาพที่ 2"}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => source.capture(f.id, 2)}><Camera />{pair ? "เปลี่ยนภาพขวา (จับภาพ)" : "จับภาพที่ 2"}</DropdownMenuItem>
                    {pair && <DropdownMenuItem variant="destructive" onSelect={removeRight}><Trash2 />ลบภาพขวา</DropdownMenuItem>}
                  </>}
                </DropdownMenuContent>
              </DropdownMenu>
              {hasImage && !pair && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => source.upload(f.id, 2)}><Columns2 />เพิ่มภาพคู่</Button>
                  </TooltipTrigger>
                  <TooltipContent>วางภาพที่ 2 ไว้ด้านขวา ใช้ Point ชุดเดียวกัน</TooltipContent>
                </Tooltip>
              )}
              {hasImage && (
                <Button variant="outline" size="sm" onClick={remove} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 />ลบภาพ
                </Button>
              )}
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border bg-muted/40">
            {hasImage ? (
              <AnnotationCanvas frame={f} mode={mode} alt={`ภาพประกอบ ${pageTitle}`} />
            ) : (
              <div className="grid place-items-center gap-3 px-6 py-16 text-center">
                <ImageIcon className="size-8 text-muted-foreground" />
                <h3 className="font-medium">เริ่มต้นด้วยภาพหน้าจอ</h3>
                <p className="text-sm text-muted-foreground">เปิดหลังบ้านที่ล็อกอินไว้ แล้วจับภาพแท็บนั้น<br />หรือวางภาพด้วย Ctrl / ⌘ + V</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => source.upload(f.id)}><Upload />อัปโหลดภาพ</Button>
                  <Button onClick={() => source.capture(f.id)}><Camera />จับภาพหน้าจอ</Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex min-h-8 items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{toolHint(f, mode)}</span>
            {isActive && selectedBox && f.highlights.some((h) => h.id === selectedBox) && (
              <Button variant="ghost" size="sm" onClick={() => deleteHighlight(f.id, selectedBox)}><Trash2 />ลบกรอบที่เลือก</Button>
            )}
            {isActive && selectedBox && f.arrows?.some((a) => a.id === selectedBox) && (
              <Button variant="ghost" size="sm" onClick={() => deleteArrow(f.id, selectedBox)}><Trash2 />ลบลูกศรที่เลือก</Button>
            )}
          </div>
        </section>
        <Inspector frame={f} n={n} hasImage={hasImage} />
      </div>
    </section>
  );
}

function Inspector({ frame: f, n, hasImage }: { frame: Frame; n: number; hasImage: boolean }) {
  const selected = useEditor((s) => s.selected);
  return (
    <aside aria-label={`คำอธิบายภาพ ${n + 1}`} className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-medium">Point / คำอธิบาย</h2>
        <span className="text-xs text-muted-foreground">{f.steps.length}</span>
      </div>
      <div id={`step-list-${f.id}`} className="grid">
        {f.steps.length ? f.steps.map((s, i) => (
          <section
            key={s.id}
            data-step-card={s.id}
            className={cn("grid gap-2 border-b px-4 py-3 last:border-b-0", s.id === selected && "bg-brand/5")}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`เลือกจุด ${i + 1}`}
                onClick={() => {
                  activateFrame(f.id);
                  useEditor.setState({ selected: s.id, ...(hasImage && !placed(s) ? { tool: "pin" as Tool } : {}) });
                }}
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                  placed(s) ? "bg-brand text-white" : "border border-dashed border-brand text-brand",
                )}
              >
                {i + 1}
              </button>
              <Input
                data-step={s.id}
                data-step-field="title"
                maxLength={200}
                value={s.title}
                onChange={(e) => stepField(f.id, s.id, "title", e.target.value)}
                aria-label={`หัวข้อขั้นตอน ${i + 1}`}
                placeholder={`หัวข้อขั้นตอน ${i + 1}`}
                className="h-8 border-transparent px-1.5 font-medium shadow-none hover:border-input focus-visible:border-ring"
              />
            </div>
            <Textarea
              data-step={s.id}
              data-step-field="text"
              maxLength={10000}
              value={s.text}
              onChange={(e) => stepField(f.id, s.id, "text", e.target.value)}
              aria-label={`คำอธิบายขั้นตอน ${i + 1}`}
              placeholder="อธิบายสิ่งที่ลูกค้าต้องทำ…"
              className="min-h-16 text-sm"
            />
            <div className="flex items-center justify-between gap-2">
              {!placed(s) ? (
                <Button variant="ghost" size="sm" disabled={!hasImage}
                  onClick={() => {
                    activateFrame(f.id);
                    useEditor.setState({ selected: s.id, tool: "pin" });
                    visible(`#canvas-${f.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                  }}>
                  <MapPin />{hasImage ? "วางจุดบนภาพ" : "รอเพิ่มภาพ"}
                </Button>
              ) : <span />}
              <div className="flex gap-0.5">
                <Button variant="ghost" size="icon-xs" disabled={i === 0} aria-label={`เลื่อนขั้นตอน ${i + 1} ขึ้น`} onClick={() => moveStep(f.id, s.id, "up")}><ArrowUp /></Button>
                <Button variant="ghost" size="icon-xs" disabled={i === f.steps.length - 1} aria-label={`เลื่อนขั้นตอน ${i + 1} ลง`} onClick={() => moveStep(f.id, s.id, "down")}><ArrowDown /></Button>
                <Button variant="ghost" size="icon-xs" aria-label={`ลบขั้นตอน ${i + 1}`} className="text-destructive hover:text-destructive" onClick={() => moveStep(f.id, s.id, "delete")}><Trash2 /></Button>
              </div>
            </div>
          </section>
        )) : (
          <div className="grid place-items-center gap-2 px-6 py-10 text-center text-xs text-muted-foreground">
            <MapPin className="size-6" />
            <p>ปักหมายเลขบนภาพ<br />แล้วเขียนคำอธิบายได้เลย</p>
          </div>
        )}
      </div>
      <div className="border-t px-3 py-2">
        <Button variant="ghost" size="sm" disabled={!hasImage} onClick={() => {
          activateFrame(f.id);
          addPin(f.id, 0.5, 0.5);
        }}>
          <Plus />เพิ่มจุดที่กลางภาพ
        </Button>
      </div>
    </aside>
  );
}
