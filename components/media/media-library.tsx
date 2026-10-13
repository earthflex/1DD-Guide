"use client";

import { Check, CircleAlert, Download, ExternalLink, ImageOff, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirm";
import { GuideImage } from "@/components/guide-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { signedUrl } from "@/lib/cloud";
import { deleteMedia, formatBytes, FRESH_MS, listMedia, mediaUsage, type MediaFile, type MediaUse } from "@/lib/media";
import { saveStateOf, useWorkspace } from "@/lib/store";
import { cn } from "@/lib/utils";

type Status = "all" | "used" | "unused";
type Sort = "new" | "old" | "large";

const formatDate = (s: string) =>
  new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const isFresh = (f: MediaFile) => Date.now() - Date.parse(f.createdAt) < FRESH_MS;

export function MediaLibrary() {
  const wid = useWorkspace((s) => s.wid)!;
  const projects = useWorkspace((s) => s.projects);
  const saveState = useWorkspace(saveStateOf);
  const usage = useMemo(() => mediaUsage(projects), [projects]);

  const [files, setFiles] = useState<MediaFile[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [project, setProject] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState<Sort>("new");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<MediaFile | null>(null);

  const refresh = () => listMedia(wid).then((list) => { setFiles(list); setError(""); }, (e: Error) => setError(e.message));
  useEffect(() => {
    listMedia(wid).then(setFiles, (e: Error) => setError(e.message));
  }, [wid]);

  const usesOf = (f: MediaFile) => usage.get(f.path) ?? [];
  const visible = useMemo(() => {
    if (!files) return [];
    const q = query.trim().toLowerCase();
    return files
      .filter((f) => {
        const uses = usage.get(f.path) ?? [];
        if (status === "used" && !uses.length) return false;
        if (status === "unused" && uses.length) return false;
        if (project !== "all" && !uses.some((u) => u.pid === project)) return false;
        if (type !== "all" && f.type !== type) return false;
        if (q && ![f.name, ...uses.flatMap((u) => [u.projectName, u.pageTitle, u.label])].some((t) => t.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => sort === "large" ? b.size - a.size : (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * (sort === "old" ? 1 : -1));
  }, [files, usage, query, status, project, type, sort]);

  const unused = (files ?? []).filter((f) => !usage.has(f.path));
  const totalSize = (files ?? []).reduce((n, f) => n + f.size, 0);
  const unusedSize = unused.reduce((n, f) => n + f.size, 0);
  const pendingSave = saveState !== "saved";

  function toggle(path: string, on: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(path); else next.delete(path);
      return next;
    });
  }

  async function remove(paths: string[]) {
    const targets = (files ?? []).filter((f) => paths.includes(f.path) && !usage.has(f.path));
    if (!targets.length) return;
    const fresh = targets.filter(isFresh).length;
    const ok = await confirmDialog(
      `ลบ ${targets.length} ไฟล์`,
      `ไฟล์ที่ไม่ได้ใช้ในโปรเจกต์ใด ขนาดรวม ${formatBytes(targets.reduce((n, f) => n + f.size, 0))} จะถูกลบถาวร` +
        (fresh ? ` · ${fresh} ไฟล์เพิ่งอัปโหลดไม่ถึง 10 นาที อาจเป็นภาพที่เพื่อนร่วมทีมกำลังบันทึก` : ""),
      "ลบไฟล์", true,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await useWorkspace.getState().flush();
      // Re-check against the just-saved document so nothing in use is ever deleted.
      const now = mediaUsage(useWorkspace.getState().projects);
      const safe = targets.filter((f) => !now.has(f.path)).map((f) => f.path);
      const { deleted, skipped } = await deleteMedia(wid, safe);
      toast.success(`ลบ ${deleted} ไฟล์แล้ว`);
      if (skipped) toast.info(`ข้าม ${skipped} ไฟล์ที่ยังมีโปรเจกต์ใช้อยู่`);
      setSelected(new Set());
      setOpen(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
    await refresh();
    setBusy(false);
  }

  const selectable = visible.filter((f) => !usage.has(f.path));
  const allSelected = selectable.length > 0 && selectable.every((f) => selected.has(f.path));

  return (
    <div className="grid gap-6 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">คลังไฟล์</h1>
          <p className="text-sm text-muted-foreground">
            {files ? <>{files.length} ไฟล์ · {formatBytes(totalSize)} · <span className={cn(unused.length && "text-amber-700")}>ไม่ได้ใช้ {unused.length} ไฟล์ ({formatBytes(unusedSize)})</span></> : "กำลังโหลด…"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setStatus("unused"); setSelected(new Set(unused.map((f) => f.path))); }} disabled={!unused.length || pendingSave}>
            เลือกไฟล์ที่ไม่ได้ใช้ทั้งหมด
          </Button>
          <Button variant="ghost" size="icon" aria-label="รีเฟรช" onClick={refresh}><RefreshCw /></Button>
        </div>
      </div>

      {pendingSave && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <CircleAlert className="size-4" />มีการแก้ไขที่ยังไม่ได้บันทึก รอให้บันทึกเสร็จก่อนลบไฟล์ สถานะการใช้งานจะได้ถูกต้อง
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อไฟล์ โปรเจกต์ หรือเนื้อหา…" aria-label="ค้นหาไฟล์" className="h-9 pl-9" />
        </label>
        <ToggleGroup type="single" variant="outline" size="sm" value={status} onValueChange={(v) => v && setStatus(v as Status)} aria-label="สถานะการใช้งาน">
          <ToggleGroupItem value="all">ทั้งหมด</ToggleGroupItem>
          <ToggleGroupItem value="used">ใช้อยู่</ToggleGroupItem>
          <ToggleGroupItem value="unused">ไม่ได้ใช้</ToggleGroupItem>
        </ToggleGroup>
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger size="sm" className="w-48" aria-label="กรองตามโปรเจกต์"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกโปรเจกต์</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger size="sm" className="w-32" aria-label="กรองตามชนิดไฟล์"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกชนิด</SelectItem>
            <SelectItem value="webp">WebP</SelectItem>
            <SelectItem value="png">PNG</SelectItem>
            <SelectItem value="jpg">JPG</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger size="sm" className="w-36" aria-label="เรียงลำดับ"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="new">ใหม่สุดก่อน</SelectItem>
            <SelectItem value="old">เก่าสุดก่อน</SelectItem>
            <SelectItem value="large">ขนาดใหญ่สุด</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-lg border bg-background/95 px-4 py-2 shadow-sm backdrop-blur">
          <span className="text-sm">เลือก {selected.size} ไฟล์</span>
          <Button size="sm" variant="destructive" disabled={busy || pendingSave} onClick={() => remove([...selected])}>
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}ลบที่เลือก
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>ยกเลิกการเลือก</Button>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {!files ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="aspect-[4/3]" />)}
        </div>
      ) : !visible.length ? (
        <div className="grid place-items-center gap-2 py-16 text-center text-muted-foreground">
          <ImageOff className="size-8" />
          <p className="text-sm">{files.length ? "ไม่พบไฟล์ตามตัวกรองนี้" : "ยังไม่มีไฟล์ใน Workspace นี้"}</p>
        </div>
      ) : (
        <>
          {selectable.length > 0 && (
            <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={allSelected} disabled={pendingSave}
                onCheckedChange={(v) => setSelected((s) => {
                  const next = new Set(s);
                  for (const f of selectable) if (v) next.add(f.path); else next.delete(f.path);
                  return next;
                })} />
              เลือกไฟล์ที่ไม่ได้ใช้ในหน้านี้ ({selectable.length})
            </label>
          )}
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {visible.map((f) => (
              <MediaCard key={f.path} file={f} uses={usesOf(f)} selected={selected.has(f.path)} canSelect={!pendingSave}
                onSelect={(on) => toggle(f.path, on)} onOpen={() => setOpen(f)} />
            ))}
          </ul>
        </>
      )}

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {open && <MediaDetail file={open} uses={usesOf(open)} wid={wid} busy={busy || pendingSave} onDelete={() => remove([open.path])} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function UsageBadge({ file, uses }: { file: MediaFile; uses: MediaUse[] }) {
  if (uses.length) return <Badge className="bg-emerald-600 text-white"><Check />ใช้อยู่ {uses.length}</Badge>;
  if (isFresh(file)) return <Badge variant="secondary">เพิ่งอัปโหลด</Badge>;
  return <Badge className="bg-amber-500 text-white">ไม่ได้ใช้</Badge>;
}

function MediaCard({ file: f, uses, selected, canSelect, onSelect, onOpen }: {
  file: MediaFile; uses: MediaUse[]; selected: boolean; canSelect: boolean; onSelect: (on: boolean) => void; onOpen: () => void;
}) {
  const used = uses.length > 0;
  return (
    <li className={cn("group relative overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md", selected && "ring-2 ring-destructive")}>
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`ดูรายละเอียด ${f.name}`}>
        <div className="aspect-[4/3] overflow-hidden bg-muted">
          <GuideImage frame={{ image: "", _imagePath: f.path }} alt="" className="size-full object-cover object-top" />
        </div>
        <div className="grid gap-1 p-2.5">
          <div className="flex items-center justify-between gap-1">
            <UsageBadge file={f} uses={uses} />
            <span className="text-xs text-muted-foreground uppercase">{f.type} · {formatBytes(f.size)}</span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {used ? `${uses[0].projectName}${uses[0].pageTitle ? " / " + uses[0].pageTitle : " / " + uses[0].label}` : formatDate(f.createdAt)}
          </p>
        </div>
      </button>
      {!used && (
        <Checkbox
          checked={selected}
          disabled={!canSelect}
          onCheckedChange={(v) => onSelect(!!v)}
          aria-label={`เลือก ${f.name}`}
          className={cn("absolute top-2 left-2 size-5 bg-background shadow", !selected && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100")}
        />
      )}
    </li>
  );
}

function MediaDetail({ file: f, uses, wid, busy, onDelete }: {
  file: MediaFile; uses: MediaUse[]; wid: string; busy: boolean; onDelete: () => void;
}) {
  async function downloadFile() {
    try {
      const url = await signedUrl(f.path);
      const a = Object.assign(document.createElement("a"), { href: url + "&download=" + encodeURIComponent(f.name), rel: "noopener" });
      a.click();
    } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <>
      <SheetHeader>
        <SheetTitle>รายละเอียดไฟล์</SheetTitle>
        <SheetDescription className="break-all">{f.name}</SheetDescription>
      </SheetHeader>
      <div className="grid gap-5 px-4 pb-6">
        <div className="overflow-hidden rounded-lg border bg-muted">
          <GuideImage frame={{ image: "", _imagePath: f.path }} alt={f.name} className="w-full" />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">สถานะ</dt><dd><UsageBadge file={f} uses={uses} /></dd>
          <dt className="text-muted-foreground">ชนิด</dt><dd className="uppercase">{f.type}</dd>
          <dt className="text-muted-foreground">ขนาด</dt><dd>{formatBytes(f.size)}</dd>
          <dt className="text-muted-foreground">อัปโหลด</dt><dd>{formatDate(f.createdAt)}</dd>
        </dl>
        <div className="grid gap-2">
          <h3 className="text-sm font-medium">ใช้อยู่ใน</h3>
          {uses.length ? (
            <ul className="grid divide-y rounded-lg border">
              {uses.map((u, i) => (
                <li key={i}>
                  <Link href={`/w/${wid}/p/${u.pid}/${u.pageId}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/60">
                    <span className="grid min-w-0">
                      <strong className="truncate font-medium">{u.projectName}</strong>
                      <small className="truncate text-xs text-muted-foreground">{u.kind === "logo" ? "โลโก้โปรเจกต์" : `${u.pageTitle} · ${u.label}`}</small>
                    </span>
                    <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">ไม่มีโปรเจกต์ใดใช้ไฟล์นี้ ลบได้อย่างปลอดภัย{isFresh(f) && " (แต่เพิ่งอัปโหลด อาจมีคนกำลังบันทึกอยู่)"}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadFile}><Download />ดาวน์โหลด</Button>
          {!uses.length && <Button variant="destructive" disabled={busy} onClick={onDelete}><Trash2 />ลบไฟล์</Button>}
        </div>
        {uses.length > 0 && <p className="text-xs text-muted-foreground">ไฟล์ที่ใช้อยู่ลบจากที่นี่ไม่ได้ ให้ลบหรือเปลี่ยนภาพในหน้าแก้ไขก่อน แล้วไฟล์จะกลายเป็น “ไม่ได้ใช้”</p>}
      </div>
    </>
  );
}
