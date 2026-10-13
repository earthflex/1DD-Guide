"use client";

import { FileText, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/auth/auth-card";
import { GuideImage } from "@/components/guide-image";
import { Button } from "@/components/ui/button";
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { websiteURL, type Project } from "@/lib/guide-core";
import { logoFromFile } from "@/lib/images";
import { addProject, applyBranding, saveProjectSettings, type Branding } from "@/lib/projects";
import { logActivity } from "@/lib/activity";
import { useWorkspace } from "@/lib/store";
import { createFromTemplate, templates } from "@/lib/templates";
import { cn } from "@/lib/utils";

/** Create project (template picker) or edit settings, ported from createProjectDialog()/projectDialog(). */
export function ProjectForm({ project, onDone }: { project?: Project; onDone: () => void }) {
  const router = useRouter();
  const wid = useWorkspace((s) => s.wid);
  const [template, setTemplate] = useState("new");
  const [name, setName] = useState(project?.name ?? "");
  const [branding, setBranding] = useState<Branding>({ logo: project?.logo ?? "", keepPath: !!project?._logoPath, logoText: project?.logoText ?? "" });
  const [error, setError] = useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const trimmed = name.trim(), rawWebsite = String(form.get("website")).trim(), website = websiteURL(rawWebsite);
    if (!trimmed) return setError("กรุณาใส่ชื่อโปรเจกต์");
    if (rawWebsite && !website) return setError("กรุณาระบุเว็บไซต์ เช่น example.com หรือเว้นว่างไว้");
    if (project) {
      saveProjectSettings(project.id, { name: trimmed, website, description: String(form.get("description")), ...branding });
      onDone();
      router.push(`/w/${wid}/p/${project.id}/${project.pages[0]?.id ?? "new"}`);
      return;
    }
    const p = createFromTemplate(template, trimmed, website);
    applyBranding(p, branding);
    addProject(p);
    logActivity("create_project", { pid: p.id, projectName: p.name, detail: template === "new" ? undefined : `เทมเพลต ${templates.find((t) => t.id === template)?.name}` });
    onDone();
    toast.success(p.pages.length ? `สร้างโปรเจกต์พร้อม ${p.pages.length} เนื้อหาแล้ว` : "สร้างโปรเจกต์ว่างแล้ว");
    router.push(`/w/${wid}/p/${p.id}/${p.pages[0]?.id ?? "new"}`);
  }

  const chosen = templates.find((t) => t.id === template)!;

  return (
    <form onSubmit={onSubmit} className="grid max-h-[80svh] gap-5 overflow-y-auto pr-1">
      <DialogHeader><DialogTitle>{project ? "ตั้งค่าโปรเจกต์" : "สร้างโปรเจกต์"}</DialogTitle></DialogHeader>

      {!project && (
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-medium">เลือกเทมเพลต</legend>
          <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
            {templates.map((t) => (
              <label key={t.id} className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/60 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                template === t.id && "border-brand bg-brand/5",
              )}>
                <input type="radio" name="template" value={t.id} checked={template === t.id} onChange={() => setTemplate(t.id)} className="sr-only" aria-label={t.name} />
                {t.id === "new" ? <Plus className="mt-0.5 size-4 text-brand" /> : <FileText className="mt-0.5 size-4 text-brand" />}
                <span className="grid">
                  <strong className="text-sm font-medium">{t.name}</strong>
                  <small className="text-xs text-muted-foreground">{t.platform}{t.pages.length ? ` · ${t.pages.length} เนื้อหา` : ""}</small>
                </span>
              </label>
            ))}
          </div>
          <div aria-live="polite" className="rounded-lg bg-muted/50 p-3 text-sm">
            {chosen.pages.length ? (
              <>
                <p><strong className="font-medium">{chosen.pages.length} เนื้อหาเริ่มต้น</strong> <span className="text-muted-foreground">มี Point พร้อมคำแนะนำให้แก้ไขต่อได้</span></p>
                <ol className="mt-2 list-decimal pl-5 text-muted-foreground">{chosen.pages.map((q) => <li key={q.title}>{q.title}</li>)}</ol>
                <p className="mt-2 text-xs text-muted-foreground">
                  {chosen.id === "shopify" ? "ลิงก์เริ่มต้นเปิด Shopify admin — เลือกร้านแล้ววาง URL ของแต่ละหน้าภายหลัง" : "ลิงก์หลังบ้านอ้างอิงจากเว็บไซต์ที่กรอก — ปรับให้ตรงกับธีมหรือปลั๊กอินได้"}
                </p>
              </>
            ) : (
              <><strong className="font-medium">เริ่มต้นโปรเจกต์ว่าง</strong><p className="text-muted-foreground">เพิ่มเนื้อหา รูปภาพ และคำอธิบายด้วยตัวเอง</p></>
            )}
          </div>
        </fieldset>
      )}

      <div className="grid gap-2">
        <Label htmlFor="project-name">ชื่อลูกค้า / โปรเจกต์</Label>
        <Input id="project-name" name="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อลูกค้าหรือชื่อโปรเจกต์" autoFocus />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="project-website">เว็บไซต์ลูกค้า (ไม่บังคับ)</Label>
        <Input id="project-website" name="website" defaultValue={project?.website ?? ""} inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} maxLength={2000} placeholder="เช่น example.com" />
        <p className="text-xs text-muted-foreground">เว้นว่างได้ หรือกรอกโดเมนโดยไม่ต้องใส่ https://</p>
      </div>

      <LogoFields branding={branding} onChange={setBranding} name={name} logoPath={project?._logoPath} />

      {project && (
        <div className="grid gap-2">
          <Label htmlFor="project-description">คำอธิบายโปรเจกต์</Label>
          <Textarea id="project-description" name="description" maxLength={2000} defaultValue={project.description} placeholder="คู่มือนี้จัดทำขึ้นสำหรับใคร…" />
        </div>
      )}

      <FormError message={error} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>ยกเลิก</Button>
        <Button type="submit">{project ? "บันทึกการเปลี่ยนแปลง" : "สร้างโปรเจกต์"}</Button>
      </DialogFooter>
    </form>
  );
}

function LogoFields({ branding, onChange, name, logoPath }: {
  branding: Branding; onChange: (b: Branding) => void; name: string; logoPath?: string;
}) {
  const [error, setError] = useState("");
  const [inputKey, setInputKey] = useState(0);
  const hasLogo = !!branding.logo || (branding.keepPath && !!logoPath);

  async function onFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    setError("");
    if (!file) return;
    try { onChange({ ...branding, logo: await logoFromFile(file) }); }
    catch (e) { setError((e as Error).message); setInputKey((k) => k + 1); }
  }

  return (
    <fieldset className="grid gap-3 rounded-lg border p-4">
      <legend className="px-1 text-sm font-medium">โลโก้ลูกค้าบนหน้าปก PDF</legend>
      <div className="flex flex-wrap items-start gap-4">
        <div aria-label="ตัวอย่างโลโก้ลูกค้า" className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-md border bg-white p-2 text-center text-xs font-medium">
          {branding.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL preview
            <img src={branding.logo} alt="โลโก้ลูกค้า" className="max-h-full max-w-full object-contain" />
          ) : branding.keepPath && logoPath ? (
            <GuideImage frame={{ image: "", _imagePath: logoPath }} alt="โลโก้ลูกค้า" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="line-clamp-4">{branding.logoText.trim() || name.trim() || "ชื่อของลูกค้า"}</span>
          )}
        </div>
        <div className="grid min-w-0 flex-1 gap-2">
          <Label htmlFor="logo-file">อัปโหลดโลโก้ (ไม่บังคับ)</Label>
          <Input key={inputKey} id="logo-file" type="file" accept=".svg,.png,image/svg+xml,image/png" onChange={onFile} className="h-auto py-1.5" />
          <p className="text-xs text-muted-foreground">SVG หรือ PNG ไม่เกิน 5 MB · วางในพื้นที่ 100 × 100 px บนหน้าปก</p>
          {hasLogo && (
            <div>
              <Button type="button" variant="ghost" size="sm" onClick={() => { onChange({ ...branding, logo: "", keepPath: false }); setInputKey((k) => k + 1); setError(""); }}>
                นำโลโก้ออก
              </Button>
            </div>
          )}
          <FormError message={error} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="logo-text">ข้อความแทนโลโก้</Label>
        <Input id="logo-text" maxLength={120} value={branding.logoText} onChange={(e) => onChange({ ...branding, logoText: e.target.value })} placeholder="ชื่อที่จะแสดงบนหน้าปก" />
        <p className="text-xs text-muted-foreground">ใช้เมื่อไม่มีรูปโลโก้ หากเว้นว่างจะใช้ชื่อโปรเจกต์</p>
      </div>
    </fieldset>
  );
}
