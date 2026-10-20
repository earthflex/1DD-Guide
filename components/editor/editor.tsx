"use client";

import {
  ArrowDown, ArrowUp, Camera, Copy, Download, ExternalLink, Eye, Image as ImageIcon, Link2, MoreHorizontal, Pencil, Plus, Trash2, Upload,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useEffect, useRef } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm";
import { FrameSection, type ImageSource } from "@/components/editor/frame-section";
import { openPageDialog } from "@/components/editor/page-dialog";
import { GuideImage } from "@/components/guide-image";
import { PublishBadge } from "@/components/project/publish-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  appendImages, applyUndo, current, deletePage, duplicatePage, editPage, imageLabel, jumpToFrame, movePage,
  openPage, pairingToken, replaceImage, setImageLabel, setSecondImage, useEditor,
} from "@/lib/editor";
import { frames, imageURL, safeURL, stepBase, type Page } from "@/lib/guide-core";
import { CaptureCancelled, captureScreen, decodeImage, imageFromFile } from "@/lib/images";
import { useWorkspace } from "@/lib/store";
import { openDialog, openPreview } from "@/lib/ui";
import { cn } from "@/lib/utils";

const confirmReplace = () =>
  confirmDialog("แทนที่ภาพเดิม", "ข้อความ Point จะยังอยู่ โดยต้องวางจุดบนภาพใหม่อีกครั้ง และกรอบไฮไลท์เดิมจะถูกล้าง", "เปลี่ยนภาพ");

export function Editor() {
  const { wid, pid, pageId } = useParams<{ wid: string; pid: string; pageId: string }>();
  const router = useRouter();
  const project = useWorkspace((s) => s.projects.find((p) => p.id === pid));
  const page = project?.pages.find((q) => q.id === pageId) ?? project?.pages[0];
  const loadId = useWorkspace((s) => s.loadId);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<{ frameId: string | null; slot?: 1 | 2 }>({ frameId: null });

  useEffect(() => { openPage(pid, pageId); }, [pid, pageId]);

  // Keyboard shortcuts, paste and extension captures (legacy document listeners).
  useEffect(() => {
    // Only dialogs that are open now: closed Radix dialogs (and hidden routes kept by Next.js) stay in the DOM.
    const busy = () => !!document.querySelector('[role=dialog][data-state=open],[role=alertdialog][data-state=open]');
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") useEditor.setState({ tool: "select", selectedBox: "" });
      const t = ev.target as HTMLElement;
      if (t.closest("input,textarea,select,[contenteditable]") || busy() || !current().page) return;
      // By key position (ev.code), so the shortcuts also work with the Thai keyboard layout.
      const mod = ev.ctrlKey || ev.metaKey;
      const tool = ({ KeyN: "pin", KeyD: "dot", KeyV: "select", KeyH: "highlight", KeyA: "arrow", KeyR: "redact" } as const)[ev.code as "KeyN"];
      if (tool && !mod && !ev.altKey && !ev.shiftKey) useEditor.setState({ tool });
      if (ev.code === "KeyZ" && mod) { ev.preventDefault(); applyUndo(); }
    }
    async function onPaste(ev: ClipboardEvent) {
      const { frame } = current();
      if (busy() || !frame) return;
      const item = Array.from(ev.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (!item) return;
      ev.preventDefault();
      try { await replaceImage(frame.id, await imageFromFile(item.getAsFile()!), confirmReplace); }
      catch (e) { toast.error((e as Error).message); }
    }
    const token = pairingToken();
    async function onMessage(ev: MessageEvent) {
      if (ev.source !== window || ev.origin !== location.origin || ev.data?.type !== "1DD_CAPTURE" || ev.data.token !== token) return;
      const data = ev.data as { image: string; url: string };
      if (!imageURL(data.image) || !safeURL(data.url)) return;
      const { project, page, frame } = current();
      if (!page || !frame) return void toast.error("รับภาพแล้วไม่ได้: กรุณาเปิดเนื้อหาใน Guide แล้วจับภาพอีกครั้ง");
      if (busy()) return void toast.error("กรุณาปิดหน้าต่างใน Guide แล้วจับภาพอีกครั้ง");
      try {
        await decodeImage(data.image);
        const ok = await confirmDialog("เพิ่มภาพจากส่วนขยาย", `เพิ่มภาพใน ${project!.name} / ${page.title} — ${data.url}`, "ใช้ภาพนี้", false, data.image);
        if (ok) await replaceImage(frame.id, data.image, confirmReplace, data.url);
      } catch (e) { toast.error((e as Error).message); }
    }
    const flush = () => { if (document.visibilityState === "hidden") void useWorkspace.getState().flush(); };
    addEventListener("keydown", onKey);
    addEventListener("paste", onPaste);
    addEventListener("message", onMessage);
    document.addEventListener("visibilitychange", flush);
    return () => {
      removeEventListener("keydown", onKey);
      removeEventListener("paste", onPaste);
      removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", flush);
    };
  }, []);

  if (!project) {
    return (
      <div className="m-auto grid max-w-md gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">ไม่พบโปรเจกต์นี้ อาจถูกลบไปแล้ว</p>
        <Button asChild variant="outline"><Link href={`/w/${wid}`}>กลับไปหน้ารวมโปรเจกต์</Link></Button>
      </div>
    );
  }
  if (!page) {
    return (
      <div className="grid gap-4 p-6 md:p-8">
        <h1 className="text-2xl font-medium">{project.name}</h1>
        <p className="text-sm text-muted-foreground">เริ่มต้นด้วยเนื้อหาแรกของโปรเจกต์นี้</p>
        <div><Button onClick={() => openPageDialog(pid)}><Plus />เพิ่มเนื้อหาแรก</Button></div>
      </div>
    );
  }

  const source: ImageSource = {
    upload(frameId, slot = 1) {
      uploadTarget.current = { frameId, slot };
      fileInput.current!.multiple = false;
      fileInput.current!.click();
    },
    async capture(frameId, slot = 1) {
      try {
        const data = await captureScreen();
        if (slot === 2) await setSecondImage(frameId, data);
        else await replaceImage(frameId, data, confirmReplace);
      } catch (e) { if (e instanceof CaptureCancelled) toast.info(e.message); else toast.error((e as Error).message); }
    },
  };
  const addImages = {
    upload() {
      uploadTarget.current = { frameId: null };
      fileInput.current!.multiple = true;
      fileInput.current!.click();
    },
    async capture() {
      try { await appendImages([await captureScreen()]); }
      catch (e) { if (e instanceof CaptureCancelled) toast.info(e.message); else toast.error((e as Error).message); }
    },
  };

  async function onFiles(ev: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(ev.target.files ?? []);
    const { frameId, slot } = uploadTarget.current;
    try {
      if (!files.length) return;
      if (frameId && slot === 2) return void await setSecondImage(frameId, await imageFromFile(files[0]));
      if (frameId) return void await replaceImage(frameId, await imageFromFile(files[0]), confirmReplace);
      const data: string[] = [];
      for (const file of files) data.push(await imageFromFile(file));
      await appendImages(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      ev.target.value = "";
    }
  }

  const index = project.pages.indexOf(page);
  const images = frames(page);
  const go = (id: string) => router.push(`/w/${wid}/p/${pid}/${id}`);

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 p-6 md:p-8">
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFiles} />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">เนื้อหา {String(index + 1).padStart(2, "0")}</span>
          <PublishBadge project={project} />
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => openPreview(pid)}><Eye />ดูแบบลูกค้า</Button>
          <Button size="sm" onClick={() => openDialog({ kind: "export", pid })} className="bg-brand text-brand-foreground hover:bg-brand/90"><Download />ส่งออกคู่มือ</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="ตัวเลือกเนื้อหา"><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => openPageDialog(pid, page.id)}><Pencil />ชื่อและลิงก์เนื้อหา</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => go(duplicatePage(pid, page.id))}><Copy />ทำสำเนาเนื้อหา</DropdownMenuItem>
              <DropdownMenuItem disabled={index === 0} onSelect={() => movePage(pid, page.id, -1)}><ArrowUp />เลื่อนเนื้อหาขึ้น</DropdownMenuItem>
              <DropdownMenuItem disabled={index === project.pages.length - 1} onSelect={() => movePage(pid, page.id, 1)}><ArrowDown />เลื่อนเนื้อหาลง</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={async () => {
                if (!(await confirmDialog("ลบเนื้อหา", `ลบเนื้อหา “${page.title}” พร้อมภาพและคำอธิบาย?`, "ลบเนื้อหา", true))) return;
                const next = deletePage(pid, page.id);
                if (next) go(next);
                else router.push(`/w/${wid}/p/${pid}/new`);
              }}><Trash2 />ลบเนื้อหานี้</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <PageIntro key={`${page.id}:${loadId}`} page={page} />

      <ImageStrip page={page} onUpload={addImages.upload} onCapture={addImages.capture} />

      <div className="grid gap-12">
        {images.map((f, n) => (
          <FrameSection key={f.id} frame={f} n={n} total={images.length} base={stepBase(page, n)} label={imageLabel(f, n)} pageTitle={page.title} source={source} />
        ))}
      </div>

      <details className="group rounded-lg border bg-card" open={!!page.note || undefined}>
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium select-none">หมายเหตุ</summary>
        <div className="px-4 pb-4">
          <Textarea
            id="note"
            data-field="note"
            maxLength={10000}
            value={page.note}
            onChange={(e) => editPage((q) => { q.note = e.target.value; })}
            aria-label="หมายเหตุ"
            placeholder="เพิ่มข้อแนะนำที่ช่วยให้ลูกค้าทำตามได้ถูกต้อง…"
            className="min-h-24"
          />
        </div>
      </details>
    </div>
  );
}

/** Title, description and backend URL. Keyed by page so the URL draft resets per page. */
function PageIntro({ page }: { page: Page }) {
  const link = safeURL(page.url);
  return (
    <section aria-label="รายละเอียดเนื้อหา" className="grid gap-3">
      <input
        data-field="title"
        value={page.title}
        maxLength={160}
        placeholder="ชื่อเนื้อหา"
        aria-label="ชื่อเนื้อหา"
        onChange={(e) => editPage((q) => { q.title = e.target.value; })}
        onBlur={(e) => { if (!e.target.value.trim()) editPage((q) => { q.title = "เนื้อหาใหม่"; }); }}
        className="w-full bg-transparent text-3xl font-medium tracking-tight outline-none placeholder:text-muted-foreground"
      />
      <Textarea
        data-field="description"
        value={page.description}
        maxLength={10000}
        rows={Math.max(2, Math.min(12, page.description.split("\n").length))}
        placeholder="อธิบายว่าลูกค้าจะเรียนรู้อะไรจากหน้านี้…"
        aria-label="คำเกริ่นเนื้อหา"
        onChange={(e) => editPage((q) => { q.description = e.target.value; })}
        className="resize-none border-transparent px-0 text-base text-muted-foreground shadow-none hover:border-input focus-visible:border-ring focus-visible:px-3 md:text-base"
      />
      <div className="flex max-w-2xl items-center gap-2 rounded-lg border px-3">
        <Link2 className="size-4 shrink-0 text-muted-foreground" />
        <Input
          data-field="url"
          type="url"
          defaultValue={page.url}
          maxLength={2000}
          placeholder="https://เว็บไซต์ลูกค้า/wp-admin/…"
          aria-label="URL หน้าหลังบ้าน"
          onChange={(e) => {
            const v = e.target.value;
            e.target.setCustomValidity(v && !safeURL(v) ? "กรุณาใช้ URL แบบ https:// หรือ http://" : "");
            if (!v || safeURL(v)) editPage((q) => { q.url = v; });
          }}
          className="h-10 border-0 px-0 shadow-none focus-visible:ring-0"
        />
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" aria-label="เปิดหน้าหลังบ้าน" className="text-muted-foreground hover:text-foreground">
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>
    </section>
  );
}

function ImageStrip({ page, onUpload, onCapture }: { page: Page; onUpload: () => void; onCapture: () => void }) {
  const active = useEditor((s) => s.activeFrame);
  const images = frames(page);
  const full = images.length >= 20 && !!(page.image || page._imagePath);
  return (
    <div aria-label="ภาพในเนื้อหานี้" className="sticky top-14 z-[5] -mx-2 flex items-center gap-2 overflow-x-auto bg-background/90 px-2 py-2 backdrop-blur">
      <div className="flex gap-2">
        {images.map((f, n) => {
          const isActive = active ? active === f.id : n === 0;
          const label = imageLabel(f, n);
          return (
            <Fragment key={f.id}>
            {/* Sub-heading sections start here: a divider, like the one readers see. */}
            {n > 0 && f.section !== undefined && <span aria-hidden title={f.section || "หัวข้อย่อย"} className="mx-1 h-9 w-0.5 shrink-0 rounded-full bg-brand/40" />}
            <div className={cn("flex items-center gap-1.5 rounded-lg border p-1 pr-2", isActive && "border-brand bg-brand/5")}>
              <button
                type="button"
                onClick={() => jumpToFrame(f.id)}
                aria-label={`ไปยัง ${label}`}
                aria-controls={`editor-image-${f.id}`}
                aria-pressed={isActive}
                className="grid h-9 w-14 place-items-center overflow-hidden rounded-md bg-muted"
              >
                <GuideImage frame={f} alt="" className="size-full object-cover object-top" fallback={<ImageIcon className="size-4 text-muted-foreground" />} />
              </button>
              <label className="group/label flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted focus-within:bg-muted focus-within:ring-2 focus-within:ring-ring/50">
                <input
                  key={label}
                  defaultValue={label}
                  size={Math.max(5, Math.min(18, label.length))}
                  maxLength={80}
                  aria-label={`ชื่อภาพ ${n + 1}`}
                  title="คลิกเพื่อเปลี่ยนชื่อภาพ"
                  onFocus={(e) => { e.currentTarget.select(); jumpToFrame(f.id, { keepFocus: true }); }}
                  onBlur={(e) => { if (e.target.value.trim() !== label) setImageLabel(f.id, e.target.value); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                    if (e.key === "Escape") { e.currentTarget.value = label; e.currentTarget.blur(); }
                  }}
                  className="bg-transparent text-xs outline-none"
                />
                <Pencil aria-hidden className="size-3 text-muted-foreground opacity-50 group-hover/label:opacity-100 group-focus-within/label:opacity-100" />
              </label>
            </div>
            </Fragment>
          );
        })}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="เพิ่มภาพ"><Plus />เพิ่มภาพ</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled={full} onSelect={onUpload}><Upload />อัปโหลดภาพ</DropdownMenuItem>
          <DropdownMenuItem disabled={full} onSelect={onCapture}><Camera />จับภาพหน้าจอ / หน้าต่าง</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
