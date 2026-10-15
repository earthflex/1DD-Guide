"use client";

import { ArrowLeft, BookOpen, CalendarClock, Copy, Download, ExternalLink, FileText, Globe, Link2, Loader2, Lock, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/auth/auth-card";
import { NewPasswordField } from "@/components/auth/new-password-field";
import { confirmDialog } from "@/components/confirm";
import { ChangePasswordForm } from "@/components/members/change-password-form";
import { ProjectForm } from "@/components/project/project-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { filename } from "@/lib/guide-core";
import { exportJSON, publishProject, revokeProject } from "@/lib/projects";
import { pairingToken } from "@/lib/editor";
import { isExpired, setPublicationExpiry, setPublicationPassword, setPublicationSlug, shareURL, SLUG_RE, suggestSlug, usePublication, usePublications, type Publication } from "@/lib/publications";
import { useWorkspace } from "@/lib/store";
import { closeDialog, closePreview, openDialog, openPreview, useDialog } from "@/lib/ui";
import { download, GUIDE_SANDBOX, makeHTML, resolveImages } from "@/lib/viewer";

/** Host for every app-level dialog plus the full-screen customer preview. */
export function AppDialogs() {
  const dialog = useDialog((s) => s.dialog);
  const project = useWorkspace((s) => (dialog && "pid" in dialog ? s.projects.find((p) => p.id === dialog.pid) : undefined));
  const wide = dialog?.kind === "create-project" || dialog?.kind === "project-settings";
  return (
    <>
      <Dialog open={!!dialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className={wide ? "sm:max-w-2xl" : "sm:max-w-lg"}>
          {dialog?.kind === "create-project" && <ProjectForm onDone={closeDialog} />}
          {dialog?.kind === "project-settings" && project && <ProjectForm key={project.id} project={project} onDone={closeDialog} />}
          {dialog?.kind === "export" && project && <ExportChoices pid={project.id} />}
          {dialog?.kind === "publish" && project && <PublishPanel pid={project.id} />}
          {dialog?.kind === "password" && <PasswordPanel />}
          {dialog?.kind === "help" && <HelpPanel />}
          {dialog?.kind === "extension" && <ExtensionPanel />}
        </DialogContent>
      </Dialog>
      <Preview />
    </>
  );
}

/** Download the self-contained HTML of one project (images embedded). */
export async function downloadHTML(pid: string) {
  const p = useWorkspace.getState().projects.find((x) => x.id === pid);
  if (!p) return;
  const id = toast.loading("กำลังเตรียมไฟล์ HTML…");
  try {
    const [full] = await resolveImages([p]);
    download(filename(p.name) + "-guide.html", await makeHTML(full), "text/html;charset=utf-8");
    toast.success("ดาวน์โหลด HTML พร้อมภาพแล้ว", { id });
  } catch (e) {
    toast.error((e as Error).message, { id });
  }
}

function Choice({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      <span className="mt-0.5 text-brand [&_svg]:size-5">{icon}</span>
      <span className="grid gap-0.5">
        <strong className="text-sm font-medium">{title}</strong>
        <small className="text-xs text-muted-foreground">{text}</small>
      </span>
    </button>
  );
}

function ExportChoices({ pid }: { pid: string }) {
  const p = useWorkspace((s) => s.projects.find((x) => x.id === pid))!;
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>ส่งออกคู่มือ</DialogTitle>
        <DialogDescription>ส่งออกเฉพาะโปรเจกต์ <strong>{p.name}</strong> รวม {p.pages.length} เนื้อหา</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Choice icon={<BookOpen />} title="HTML สำหรับลูกค้า" text="ไฟล์เดียว รวมภาพและคำอธิบาย เปิดอ่านได้ทันที หรือนำไปวางบนโฮสต์เพื่อส่งเป็นลิงก์" onClick={() => { closeDialog(); void downloadHTML(pid); }} />
        <Choice icon={<FileText />} title="พิมพ์ / บันทึกเป็น PDF" text="A4 แนวนอน พร้อมหน้าปกและโลโก้ลูกค้า · เลือก “ดาวน์โหลด PDF” แล้วเลือก Save as PDF" onClick={() => openPreview(pid)} />
        <Choice icon={<Download />} title="ไฟล์สำรองสำหรับแก้ไขต่อ (.json)" text="เก็บภาพ ข้อความ และตำแหน่งหมายเลข นำเข้าใหม่ได้โดยไม่ทับโปรเจกต์เดิม" onClick={() => { closeDialog(); void exportJSON([p]); }} />
        <Choice icon={<Globe />} title="เผยแพร่ลิงก์คู่มือบนคลาวด์" text="สร้างลิงก์อ่านอย่างเดียว สำหรับผู้ที่ได้รับลิงก์" onClick={() => openDialog({ kind: "publish", pid })} />
      </div>
    </div>
  );
}

function PublishPanel({ pid }: { pid: string }) {
  const p = useWorkspace((s) => s.projects.find((x) => x.id === pid))!;
  const pub = usePublication(pid);
  const unavailable = usePublications((s) => s.status === "unavailable");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const url = pub ? shareURL(pub) : fresh;
  const stale = pub && Date.parse(p.updatedAt) > Date.parse(pub.updatedAt) + 5000;

  async function publish() {
    setBusy(true);
    setError("");
    try { setFresh(await publishProject(pid)); toast.success(pub ? "อัปเดตลิงก์แล้ว ลูกค้าเห็นฉบับล่าสุด" : "เผยแพร่แล้ว"); }
    catch (e) { setError((e as Error).message); }
    setBusy(false);
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(url!); toast.success("คัดลอกลิงก์แล้ว"); }
    catch { (document.getElementById("share-link") as HTMLInputElement)?.select(); toast.info("เลือกลิงก์แล้ว กด Ctrl / Cmd + C เพื่อคัดลอก"); }
  }
  async function revoke() {
    if (!(await confirmDialog("เพิกถอนลิงก์คู่มือ", "ลิงก์เดิมจะเปิดอ่านไม่ได้อีก แต่ไฟล์ที่ดาวน์โหลดไปแล้วจะยังคงอยู่", "เพิกถอนลิงก์", true))) return;
    try { await revokeProject(pid); setFresh(null); closeDialog(); } catch (e) { toast.error((e as Error).message); }
  }

  if (!url) {
    return (
      <div className="grid gap-4">
        <DialogHeader>
          <DialogTitle>เผยแพร่คู่มือให้ลูกค้า</DialogTitle>
          <DialogDescription>
            เผยแพร่เฉพาะ {p.name} เป็นฉบับอ่านอย่างเดียว ผู้ที่มีลิงก์เปิดอ่านและดาวน์โหลดได้ ตั้งรหัสผ่านเข้าชมได้หลังเผยแพร่ การแก้ไขภายหลังต้องกดอัปเดตลิงก์
          </DialogDescription>
        </DialogHeader>
        <FormError message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>ยกเลิก</Button>
          <Button onClick={publish} disabled={busy}>{busy && <Loader2 className="animate-spin" />}<Globe />เผยแพร่</Button>
        </DialogFooter>
      </div>
    );
  }
  return (
    <div className="grid gap-5">
      <DialogHeader>
        <DialogTitle>ลิงก์คู่มือ · {p.name}</DialogTitle>
        <DialogDescription>
          {pub ? `เผยแพร่ล่าสุด ${dateTime(pub.updatedAt)} · ${pub.views ? `ลูกค้าเปิดดู ${pub.views.toLocaleString("th-TH")} ครั้ง ล่าสุด ${dateTime(pub.lastViewedAt!)}` : "ลูกค้ายังไม่เคยเปิด"}` : "เผยแพร่แล้ว"}
        </DialogDescription>
      </DialogHeader>
      {stale && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <span className="flex-1">มีการแก้ไขหลังเผยแพร่ ลูกค้ายังเห็นฉบับเดิม</span>
          <Button size="sm" onClick={publish} disabled={busy}>{busy && <Loader2 className="animate-spin" />}อัปเดตลิงก์</Button>
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="share-link">ลิงก์สำหรับลูกค้า</Label>
        <div className="flex gap-2">
          <Input id="share-link" readOnly value={url} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
          <Button onClick={copyLink}><Copy />คัดลอก</Button>
          <Button asChild variant="outline" size="icon" aria-label="เปิดคู่มือ"><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink /></a></Button>
        </div>
      </div>
      {pub && !unavailable && <LinkSlug pid={pid} slug={pub.slug} hasPassword={pub.hasPassword} suggestion={suggestSlug(p.name, p.website)} />}
      <LinkPassword pid={pid} url={url} hasPassword={!!pub?.hasPassword} unavailable={unavailable} />
      {pub && !unavailable && <LinkExpiry pid={pid} pub={pub} />}
      <FormError message={error} />
      <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
        <Button variant="destructive" onClick={revoke}><Trash2 />เพิกถอนลิงก์</Button>
        {!stale && <Button variant="outline" onClick={publish} disabled={busy}>{busy && <Loader2 className="animate-spin" />}อัปเดตลิงก์อีกครั้ง</Button>}
      </div>
    </div>
  );
}

const dateTime = (s: string) => new Date(s).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** When the link stops opening for customers. The link closes at the end of the chosen day (local time). */
function LinkExpiry({ pid, pub }: { pid: string; pub: Publication }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Read once per open panel: date maths stays out of render.
  const [now] = useState(Date.now);
  const expired = isExpired(pub, now);
  const inDays = (n: number) => day(new Date(now + n * 86400000));
  const tomorrow = inDays(1);

  async function save(date: string | null) {
    setBusy(true);
    setError("");
    try {
      await setPublicationExpiry(pid, date ? new Date(`${date}T23:59:59`).toISOString() : null);
      setEditing(false);
      toast.success(date ? "ตั้งวันหมดอายุลิงก์แล้ว" : "ยกเลิกวันหมดอายุแล้ว ลิงก์เปิดได้ตลอด");
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  const until = pub.expiresAt && new Date(pub.expiresAt).toLocaleDateString("th-TH", { dateStyle: "medium" });
  return (
    <section className="grid gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarClock className={expired ? "size-4 text-destructive" : "size-4 text-muted-foreground"} />
        <span className={expired ? "flex-1 text-sm font-medium text-destructive" : "flex-1 text-sm font-medium"}>
          {expired ? `ลิงก์หมดอายุแล้ว (${until}) ลูกค้าเปิดไม่ได้` : until ? `เปิดได้ถึง ${until}` : "ลิงก์ไม่มีวันหมดอายุ"}
        </span>
        {!editing && <Button size="sm" variant={expired ? "default" : "outline"} onClick={() => { setValue(pub.expiresAt && !expired ? day(new Date(pub.expiresAt)) : inDays(30)); setEditing(true); }}>
          {expired ? "ต่ออายุ" : until ? "เปลี่ยนวัน" : "ตั้งวันหมดอายุ"}
        </Button>}
        {!editing && until && <Button size="sm" variant="ghost" disabled={busy} onClick={() => save(null)}>ไม่หมดอายุ</Button>}
      </div>
      {editing && (
        <form onSubmit={(e) => { e.preventDefault(); void save(value); }} className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={value} min={tomorrow} required onChange={(e) => setValue(e.target.value)} aria-label="วันหมดอายุ" className="w-auto" autoFocus />
            {[7, 30, 90].map((n) => (
              <Button key={n} type="button" size="sm" variant="ghost" onClick={() => setValue(inDays(n))}>{n} วัน</Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">ลิงก์จะปิดเมื่อสิ้นวันที่เลือก ต่ออายุหรือยกเลิกได้ภายหลัง</p>
          <FormError message={error} />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !value}>{busy && <Loader2 className="animate-spin" />}บันทึกวันหมดอายุ</Button>
            <Button type="button" variant="ghost" onClick={() => { setEditing(false); setError(""); }}>ยกเลิก</Button>
          </div>
        </form>
      )}
      {!editing && error && <FormError message={error} />}
    </section>
  );
}

/** Readable link name (/g/<slug>). The random-token link keeps working alongside it. */
function LinkSlug({ pid, slug, hasPassword, suggestion }: { pid: string; slug: string | null; hasPassword: boolean; suggestion: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(slug ?? suggestion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const clean = value.trim().toLowerCase();
  const valid = SLUG_RE.test(clean);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return setError("ใช้ a-z, 0-9 และ - ได้ 3–60 ตัวอักษร ห้ามขึ้นต้นหรือลงท้ายด้วย -");
    setBusy(true);
    setError("");
    try { await setPublicationSlug(pid, clean); setEditing(false); toast.success("ตั้งชื่อลิงก์แล้ว"); }
    catch (e) { setError((e as Error).message); }
    setBusy(false);
  }
  async function clear() {
    if (!(await confirmDialog("ยกเลิกชื่อลิงก์", `ลิงก์ /g/${slug} จะเปิดไม่ได้อีก ลิงก์แบบสุ่มยังใช้ได้ตามเดิม`, "ยกเลิกชื่อลิงก์", true))) return;
    try { await setPublicationSlug(pid, null); toast.success("ยกเลิกชื่อลิงก์แล้ว"); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <section className="grid gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link2 className="size-4 text-muted-foreground" />
        <span className="flex-1 text-sm font-medium">{slug ? <>ชื่อลิงก์: <code className="font-mono">/g/{slug}</code></> : "ชื่อลิงก์ (ภาษาอังกฤษ)"}</span>
        {!editing && <Button size="sm" variant={slug ? "outline" : "default"} onClick={() => { setValue(slug ?? suggestion); setEditing(true); }}>{slug ? "แก้ชื่อลิงก์" : "ตั้งชื่อลิงก์"}</Button>}
        {!editing && slug && <Button size="sm" variant="ghost" onClick={clear}>ยกเลิก</Button>}
      </div>
      {editing && (
        <form onSubmit={save} className="grid gap-2">
          <div className="flex items-center rounded-lg border focus-within:ring-3 focus-within:ring-ring/50">
            <span className="shrink-0 pl-3 font-mono text-xs text-muted-foreground">{typeof location === "undefined" ? "" : location.host}/g/</span>
            <input value={value} onChange={(e) => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} maxLength={60} autoFocus
              aria-label="ชื่อลิงก์" placeholder="my-guide" spellCheck={false} autoCapitalize="none"
              className="h-9 min-w-0 flex-1 bg-transparent px-1 font-mono text-sm outline-none" />
          </div>
          <p className="text-xs text-muted-foreground">a-z, 0-9 และ - · 3–60 ตัวอักษร · ต้องไม่ซ้ำกับคู่มืออื่น</p>
          {!hasPassword && <p className="text-xs text-amber-700">ชื่อลิงก์เดาได้ง่ายกว่าลิงก์แบบสุ่ม ถ้าคู่มือมีข้อมูลที่ไม่ควรเปิดเผย แนะนำให้ตั้งรหัสผ่านด้วย</p>}
          <FormError message={error} />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !valid}>{busy && <Loader2 className="animate-spin" />}บันทึกชื่อลิงก์</Button>
            <Button type="button" variant="ghost" onClick={() => { setEditing(false); setError(""); }}>ยกเลิก</Button>
          </div>
        </form>
      )}
    </section>
  );
}

/** Viewing password of a public link. Only the hash is stored, so the password is shown once, right after setting it. */
function LinkPassword({ pid, url, hasPassword, unavailable }: { pid: string; url: string; hasPassword: boolean; unavailable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justSet, setJustSet] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pass = String(new FormData(event.currentTarget).get("link-password"));
    setBusy(true);
    setError("");
    try {
      await setPublicationPassword(pid, pass);
      setJustSet(pass);
      setEditing(false);
      toast.success("ตั้งรหัสผ่านลิงก์แล้ว");
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }
  async function clear() {
    if (!(await confirmDialog("ยกเลิกรหัสผ่าน", "ใครมีลิงก์ก็จะเปิดอ่านคู่มือได้ทันทีโดยไม่ต้องใส่รหัส", "ยกเลิกรหัสผ่าน", true))) return;
    try { await setPublicationPassword(pid, null); setJustSet(null); toast.success("ยกเลิกรหัสผ่านลิงก์แล้ว"); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function copyBoth() {
    const text = `ลิงก์คู่มือ: ${url}\nรหัสผ่าน: ${justSet}`;
    try { await navigator.clipboard.writeText(text); toast.success("คัดลอกลิงก์และรหัสผ่านแล้ว"); }
    catch { toast.info("คัดลอกไม่ได้ กรุณาคัดลอกเอง"); }
  }

  if (unavailable) {
    return <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">ตั้งรหัสผ่านเข้าชมได้หลังผู้ดูแลรันไฟล์ supabase/publication-password.sql ใน Supabase</p>;
  }
  return (
    <section className="grid gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        {hasPassword ? <Lock className="size-4 text-emerald-700" /> : <Globe className="size-4 text-muted-foreground" />}
        <span className="flex-1 text-sm font-medium">{hasPassword ? "ต้องใส่รหัสผ่านก่อนเปิดดู" : "ใครมีลิงก์ก็เปิดอ่านได้"}</span>
        {hasPassword && !editing && <>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>เปลี่ยนรหัสผ่าน</Button>
          <Button size="sm" variant="ghost" onClick={clear}>ยกเลิกรหัสผ่าน</Button>
        </>}
        {!hasPassword && !editing && <Button size="sm" onClick={() => setEditing(true)}><Lock />ตั้งรหัสผ่าน</Button>}
      </div>
      {justSet && hasPassword && !editing && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          <span className="flex-1">รหัสผ่าน: <code className="font-mono font-medium">{justSet}</code> · ระบบเก็บแบบเข้ารหัส จะไม่แสดงอีกหลังปิดหน้าต่างนี้</span>
          <Button size="sm" variant="outline" onClick={copyBoth}><Copy />คัดลอกลิงก์ + รหัส</Button>
        </div>
      )}
      {editing && (
        <form onSubmit={save} className="grid gap-3">
          <NewPasswordField id="link-password" name="link-password" label={hasPassword ? "รหัสผ่านใหม่สำหรับลูกค้า" : "รหัสผ่านสำหรับลูกค้า"} minLength={4} length={10} autoFocus />
          <FormError message={error} />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}บันทึกรหัสผ่าน</Button>
            <Button type="button" variant="ghost" onClick={() => { setEditing(false); setError(""); }}>ยกเลิก</Button>
          </div>
        </form>
      )}
    </section>
  );
}

function PasswordPanel() {
  return (
    <div className="grid gap-4">
      <DialogHeader><DialogTitle>เปลี่ยนรหัสผ่าน</DialogTitle></DialogHeader>
      <ChangePasswordForm onDone={closeDialog} />
    </div>
  );
}

function HelpPanel() {
  return (
    <div className="grid gap-4">
      <DialogHeader><DialogTitle>เริ่มต้นกับ 1DD Guide</DialogTitle></DialogHeader>
      <ol className="grid list-decimal gap-2 pl-5 text-sm">
        <li>สร้างโปรเจกต์ แล้วเพิ่มเนื้อหาพร้อม URL หลังบ้าน</li>
        <li>เปิดเว็บไซต์และล็อกอินด้วยตัวเอง จากนั้นจับภาพแท็บ อัปโหลด หรือวางภาพจากคลิปบอร์ด</li>
        <li>เลือก “ปักหมายเลข” แล้วคลิกบนภาพ ลากเพื่อย้าย หรือใช้ปุ่มลูกศรบนคีย์บอร์ด</li>
        <li>เขียนคำอธิบายด้านขวา และเรียงลำดับด้วย ↑ ↓</li>
        <li>ดูแบบลูกค้า แล้วส่งออก HTML, PDF หรือเผยแพร่ลิงก์ผ่านคลาวด์</li>
      </ol>
      <div className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
        งานจะบันทึกลง Workspace ของทีมอัตโนมัติ ตรวจสถานะมุมขวาบนก่อนปิดหน้า<br />
        ไฟล์ HTML ที่ส่งออกไม่มีหน้าจอแก้ไขหรือข้อมูลโปรเจกต์อื่น
      </div>
      <p className="text-xs text-muted-foreground">ปุ่มลัด: N ปักหมายเลข · A ลูกศร · V เลือก · Esc ยกเลิกเครื่องมือ · Ctrl / Cmd + Z ย้อนกลับ · Ctrl / Cmd + V วางภาพ</p>
    </div>
  );
}

function ExtensionPanel() {
  const [token] = useState(pairingToken);
  return (
    <div className="grid gap-4">
      <DialogHeader><DialogTitle>จับภาพด้วยส่วนขยาย Chrome</DialogTitle></DialogHeader>
      <div><Button asChild><a href="/1dd-capture-extension.zip" download><Download />ดาวน์โหลดส่วนขยาย (.zip)</a></Button></div>
      <p className="text-sm">แตกไฟล์ zip แล้วติดตั้งโฟลเดอร์ <strong>1dd-capture-extension</strong> ผ่าน <code className="rounded bg-muted px-1">chrome://extensions</code> เปิด Developer mode แล้วกด Load unpacked</p>
      <ol className="grid list-decimal gap-1 pl-5 text-sm">
        <li>ใส่ URL และรหัสเชื่อมต่อด้านล่างในส่วนขยาย</li>
        <li>เปิดเนื้อหาปลายทางไว้ใน Guide</li>
        <li>เปิดหลังบ้านลูกค้าที่ล็อกอินแล้ว แล้วกด “จับภาพส่งเข้า 1DD”</li>
        <li>กลับมาดูตัวอย่างภาพและยืนยันเพิ่มในเนื้อหา</li>
      </ol>
      <div className="grid gap-2">
        <Label htmlFor="ext-url">URL ของ Guide</Label>
        <Input id="ext-url" readOnly value={typeof location === "undefined" ? "" : location.origin + "/"} onFocus={(e) => e.target.select()} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ext-token">รหัสเชื่อมต่อของเบราว์เซอร์นี้</Label>
        <Input id="ext-token" readOnly value={token} onFocus={(e) => e.target.select()} />
        <p className="text-xs text-muted-foreground">ใช้เฉพาะในส่วนขยายบนเครื่องนี้ ไม่ต้องส่งให้ลูกค้า</p>
      </div>
      <p className="text-xs text-muted-foreground">ส่วนขยายจับส่วนที่มองเห็นในแท็บ ไม่อ่านหรือส่งรหัสผ่านและคุกกี้</p>
    </div>
  );
}

/** Full-screen customer preview in an iframe, like legacy preview(). Printing happens inside the guide. */
function Preview() {
  const pid = useDialog((s) => s.preview);
  const project = useWorkspace((s) => s.projects.find((p) => p.id === pid));
  const [html, setHtml] = useState<{ pid: string; html: string } | null>(null);

  useEffect(() => {
    if (!project) return;
    let live = true;
    resolveImages([project]).then(([full]) => makeHTML(full)).then(
      (h) => live && setHtml({ pid: project.id, html: h }),
      (e: Error) => { toast.error(e.message); closePreview(); },
    );
    return () => { live = false; };
  }, [project]);

  useEffect(() => {
    if (!pid) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePreview(); };
    document.body.style.overflow = "hidden";
    addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; removeEventListener("keydown", onKey); };
  }, [pid]);

  if (!pid || !project) return null;
  return (
    <section aria-label="ตัวอย่างคู่มือสำหรับลูกค้า" className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <span className="truncate text-sm text-muted-foreground">ตัวอย่างคู่มือ · {project.name}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={closePreview}><ArrowLeft />กลับไปแก้ไข</Button>
          <Button size="sm" onClick={() => downloadHTML(project.id)}><Download />ดาวน์โหลด HTML</Button>
        </div>
      </div>
      {html?.pid === project.id
        ? <iframe sandbox={GUIDE_SANDBOX} title={`ตัวอย่างคู่มือ ${project.name}`} srcDoc={html.html} className="w-full flex-1 border-0" />
        : <div className="grid flex-1 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>}
    </section>
  );
}
