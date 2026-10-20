"use client";

import {
  ArrowDown, ArrowUp, Camera, ChevronDown, Circle, Columns2, Hash, Heading, Image as ImageIcon, MapPin, MousePointer2, MoveUpRight, Plus, Square,
  SquareDashed, StickyNote, Trash2, Undo2, Upload, X,
} from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm";
import { AnnotationCanvas } from "@/components/editor/annotation-canvas";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormatButtons, RichTextField } from "@/components/editor/rich-text-field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  activateFrame, addPin, applyUndo, deleteArrow, deleteHighlight, addNote, removeSecondImage, moveStep, removeImage, setSection, setStepKind, setStepText, useEditor, type Tool,
} from "@/lib/editor";
import { isNote, isPair, placed, stepNumbers, type Frame } from "@/lib/guide-core";
import { mergeTitle } from "@/lib/rich-text";

/** Image tools with their single-key shortcuts (handled in editor.tsx). */
const TOOLS = [
  { value: "select", label: "เลือก", name: "เลือกและย้าย", key: "V", Icon: MousePointer2 },
  { value: "pin", label: "ปักหมายเลข", name: "ปักหมายเลข", key: "N", Icon: MapPin },
  { value: "dot", label: "จุด", name: "จุดไม่มีหมายเลข", key: "D", Icon: Circle },
  { value: "highlight", label: "ไฮไลท์", name: "กรอบไฮไลท์", key: "H", Icon: Square },
  { value: "arrow", label: "ลูกศร", name: "ลูกศร", key: "A", Icon: MoveUpRight },
  { value: "redact", label: "ปิดทับ", name: "ปิดทับข้อมูล", key: "R", Icon: SquareDashed },
] as const;
import { cn } from "@/lib/utils";
import { visible } from "@/lib/dom";

const toolHint = (f: Frame, mode: Tool) =>
  mode === "pin"
    ? f.steps.some((s) => !placed(s) && !s.kind) ? "คลิกบนภาพเพื่อวาง Point ที่เลือก · ข้อความเดิมจะยังอยู่" : "คลิกบนภาพเพื่อเพิ่มหมายเลข · ลากจุดเพื่อย้าย"
    : mode === "dot" ? "คลิกบนภาพเพื่อวางจุดที่ไม่มีหมายเลข · ไม่นับในลำดับหมายเลข"
    : mode === "highlight" ? "ลากบนภาพเพื่อสร้างกรอบไฮไลท์สีส้ม"
    : mode === "arrow" ? "ลากจากจุดเริ่มไปยังจุดที่ต้องการชี้ หัวลูกศรอยู่ปลายทาง"
    : mode === "redact" ? "ลากกรอบบนภาพเพื่อปิดทับข้อมูลถาวร"
    : "เลือกหมายเลข กรอบ หรือลูกศรเพื่อแก้ไข · ลากเพื่อย้าย · ลากปลายลูกศรเพื่อยืด หด หรือหมุน";

/** Where new images come from. Slot 2 is the right-hand image of a two-column pair. */
export type ImageSource = { upload: (frameId: string, slot?: 1 | 2) => void; capture: (frameId: string, slot?: 1 | 2) => void };

/** One image of a page: toolbar, annotation canvas and its Point list. Ported from editorFrame(). */
export function FrameSection({ frame: f, label, n, total, base, pageTitle, source }: {
  /** `base`: Points before this image in its section, so numbers run on across a section's images. */
  frame: Frame; label: string; n: number; total: number; base: number; pageTitle: string; source: ImageSource;
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
      {f.section !== undefined && <SectionHeading frame={f} first={n === 0} />}
      <div className="mb-3 flex min-h-8 items-center gap-2">
        {total > 1 && (
          <h2 className="text-sm"><b className="font-medium">{label}</b> <span className="text-muted-foreground">· {n + 1} / {total}</span></h2>
        )}
        {f.section === undefined && (
          <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={() => {
            setSection(f.id, "");
            requestAnimationFrame(() => visible(`[data-section-input="${f.id}"]`)?.focus());
          }}>
            <Heading />เริ่มหัวข้อย่อยที่ภาพนี้
          </Button>
        )}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label={`แก้ไขภาพ ${n + 1}`} className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={setTool} aria-label="เครื่องมือบนภาพ">
                {TOOLS.map(({ value, label, name, key, Icon }) => (
                  <Tooltip key={value}>
                    {/* A wrapper as trigger: the tooltip's own data-state would hide the item's on/off state. */}
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <ToggleGroupItem value={value} disabled={value !== "select" && !hasImage} aria-label={name} aria-keyshortcuts={key}>
                          <Icon />{label}
                        </ToggleGroupItem>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{name} (กด {key})</TooltipContent>
                  </Tooltip>
                ))}
              </ToggleGroup>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" disabled={!canUndo} aria-label="ย้อนการจัดจุด"
                    onClick={() => { activateFrame(f.id); applyUndo(); }}>
                    <Undo2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>ย้อนการจัดจุด (Ctrl / Cmd + Z)</TooltipContent>
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
              <AnnotationCanvas frame={f} mode={mode} base={base} alt={`ภาพประกอบ ${pageTitle}`} />
            ) : (
              <div className="grid place-items-center gap-3 px-6 py-16 text-center">
                <ImageIcon className="size-8 text-muted-foreground" />
                <h3 className="font-medium">เริ่มต้นด้วยภาพหน้าจอ</h3>
                <p className="text-sm text-muted-foreground">เปิดหลังบ้านที่ล็อกอินไว้ แล้วจับภาพแท็บนั้น<br />หรือวางภาพด้วย Ctrl / Cmd + V</p>
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
        <Inspector frame={f} n={n} base={base} hasImage={hasImage} />
      </div>
    </section>
  );
}

/** Sub-heading that opens a section at this image. Readers see it as a heading with a divider above. */
function SectionHeading({ frame: f, first }: { frame: Frame; first: boolean }) {
  return (
    <div className={cn("mb-4 flex items-center gap-2", !first && "border-t pt-8")}>
      <Input
        data-section-input={f.id}
        value={f.section ?? ""}
        maxLength={120}
        onChange={(e) => setSection(f.id, e.target.value)}
        aria-label="ชื่อหัวข้อย่อย"
        placeholder="ชื่อหัวข้อย่อย เช่น การแก้ไขแบนเนอร์"
        className="h-11 border-transparent px-2 text-xl font-medium shadow-none hover:border-input focus-visible:border-ring md:text-xl"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="ยกเลิกหัวข้อย่อย" onClick={() => setSection(f.id, null)}><X /></Button>
        </TooltipTrigger>
        <TooltipContent>ยกเลิกหัวข้อย่อย ภาพนี้จะรวมกับหัวข้อก่อนหน้า</TooltipContent>
      </Tooltip>
    </div>
  );
}

function Inspector({ frame: f, n, base, hasImage }: { frame: Frame; n: number; base: number; hasImage: boolean }) {
  const selected = useEditor((s) => s.selected);
  const numbers = stepNumbers(f.steps, base);
  const label = (i: number) => isNote(f.steps[i]) ? "(หมายเหตุ)" : numbers[i] === null ? "(จุดไม่มีหมายเลข)" : String(numbers[i]);
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
            className={cn("grid gap-2 border-b px-4 py-3 last:border-b-0", isNote(s) && "bg-muted/40", s.id === selected && "bg-brand/5")}
          >
            <div className="flex items-start gap-2">
              {isNote(s) ? (
                <span aria-hidden title="หมายเหตุ ไม่มีจุดบนภาพ" className="mt-1.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <StickyNote className="size-3.5" />
                </span>
              ) : (
              <button
                type="button"
                aria-label={numbers[i] === null ? "เลือกจุดไม่มีหมายเลข" : `เลือกจุด ${numbers[i]}`}
                onClick={() => {
                  activateFrame(f.id);
                  useEditor.setState({ selected: s.id, ...(hasImage && !placed(s) ? { tool: (numbers[i] === null ? "dot" : "pin") as Tool } : {}) });
                }}
                className={cn(
                  "mt-1.5 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                  placed(s) ? "bg-brand text-white" : "border border-dashed border-brand text-brand",
                )}
              >
                {numbers[i] ?? <span aria-hidden className="size-2 rounded-full bg-current" />}
              </button>
              )}
              <RichTextField
                data-step={s.id}
                data-step-field="text"
                value={mergeTitle(s.title, s.text)}
                onChange={(text) => setStepText(f.id, s.id, text)}
                label={`คำอธิบายขั้นตอน ${label(i)}`}
                placeholder={isNote(s) ? "หมายเหตุเพิ่มเติม (ไม่มีจุดบนภาพ)…" : "อธิบายสิ่งที่ลูกค้าต้องทำ…"}
                className="flex-1 self-start"
              />
            </div>
            <div className="flex items-center justify-between gap-2 pl-8">
              <div className="flex min-w-0 flex-1 items-center gap-1">
              <FormatButtons target={() => visible<HTMLElement>(`[data-step="${s.id}"][data-step-field="text"]`)} />
              {!placed(s) && !isNote(s) && (
                <Button variant="ghost" size="sm" disabled={!hasImage}
                  onClick={() => {
                    activateFrame(f.id);
                    useEditor.setState({ selected: s.id, tool: numbers[i] === null ? "dot" : "pin" });
                    visible(`#canvas-${f.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                  }}>
                  <MapPin />{hasImage ? "วางจุดบนภาพ" : "รอเพิ่มภาพ"}
                </Button>
              )}
              </div>
              <div className="flex gap-0.5">
                {!isNote(s) && <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" aria-label={numbers[i] === null ? "เปลี่ยนเป็นหมายเลข" : "เปลี่ยนเป็นจุดไม่มีหมายเลข"}
                      onClick={() => setStepKind(f.id, s.id, numbers[i] !== null)}>
                      {numbers[i] === null ? <Hash /> : <Circle />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{numbers[i] === null ? "เปลี่ยนเป็นหมายเลข" : "เปลี่ยนเป็นจุดไม่มีหมายเลข"}</TooltipContent>
                </Tooltip>}
                <Button variant="ghost" size="icon-xs" disabled={i === 0} aria-label={`เลื่อนขั้นตอน ${label(i)} ขึ้น`} onClick={() => moveStep(f.id, s.id, "up")}><ArrowUp /></Button>
                <Button variant="ghost" size="icon-xs" disabled={i === f.steps.length - 1} aria-label={`เลื่อนขั้นตอน ${label(i)} ลง`} onClick={() => moveStep(f.id, s.id, "down")}><ArrowDown /></Button>
                <Button variant="ghost" size="icon-xs" aria-label={`ลบขั้นตอน ${label(i)}`} className="text-destructive hover:text-destructive" onClick={() => moveStep(f.id, s.id, "delete")}><Trash2 /></Button>
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
      <div className="flex flex-wrap gap-1 border-t px-3 py-2">
        <Button variant="ghost" size="sm" disabled={!hasImage} onClick={() => {
          activateFrame(f.id);
          addPin(f.id, 0.5, 0.5);
        }}>
          <Plus />เพิ่มจุดที่กลางภาพ
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { activateFrame(f.id); addNote(f.id); }}>
          <StickyNote />เพิ่มหมายเหตุ
        </Button>
      </div>
    </aside>
  );
}
