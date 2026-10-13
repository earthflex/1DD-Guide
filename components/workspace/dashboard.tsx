"use client";

import { ArrowRight, BookOpen, Copy, Download, FileText, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmDialog } from "@/components/confirm";
import { GuideImage } from "@/components/guide-image";
import { PublishBadge } from "@/components/project/publish-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineInput } from "@/components/inline-input";
import { Input } from "@/components/ui/input";
import { coverOf, type Project } from "@/lib/guide-core";
import { deleteProject, duplicateProject, renameProject, setProjectWebsite } from "@/lib/projects";
import { useWorkspace } from "@/lib/store";
import { openDialog } from "@/lib/ui";

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

export function Dashboard() {
  const projects = useWorkspace((s) => s.projects);
  const wid = useWorkspace((s) => s.wid)!;
  const [query, setQuery] = useState("");
  const q = query.toLowerCase();
  const filtered = projects.filter((p) => (p.name + " " + p.website + " " + p.description).toLowerCase().includes(q));

  return (
    <div className="grid gap-6 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">คู่มือของคุณ</h1>
          <p className="text-sm text-muted-foreground">{projects.length} โปรเจกต์</p>
        </div>
        <Button onClick={() => openDialog({ kind: "create-project" })} className="bg-brand text-brand-foreground hover:bg-brand/90">
          <Plus />สร้างโปรเจกต์
        </Button>
      </div>
      <label className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาโปรเจกต์…"
          aria-label="ค้นหาโปรเจกต์"
          className="h-10 pl-9"
        />
      </label>
      {!projects.length ? (
        <p className="py-16 text-center text-sm text-muted-foreground">เริ่มคู่มือลูกค้าด้วยโปรเจกต์แรกของคุณ</p>
      ) : !filtered.length ? (
        <div className="py-16 text-center">
          <h3 className="font-medium">ไม่พบโปรเจกต์</h3>
          <p className="text-sm text-muted-foreground">ลองค้นหาด้วยชื่อหรือเว็บไซต์อื่น</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => <ProjectCard key={p.id} project={p} wid={wid} />)}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project: p, wid }: { project: Project; wid: string }) {
  const router = useRouter();
  const href = `/w/${wid}/p/${p.id}/${p.pages[0]?.id ?? "new"}`;
  const cover = coverOf(p);
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="relative">
        <Link href={href} aria-label={`เปิดโปรเจกต์ ${p.name}`} className="block aspect-[16/10] overflow-hidden border-b bg-muted">
          {cover ? (
            <GuideImage frame={cover} alt={`ตัวอย่างคู่มือ ${p.name}`} className="size-full object-cover object-top transition-transform duration-300 hover:scale-[1.02]" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground"><BookOpen className="size-8" /></div>
          )}
        </Link>
        <PublishBadge project={p} className="absolute top-2 right-2" />
      </div>
      <div className="grid gap-0.5 px-4 pt-3 pb-2">
        <div className="flex items-center gap-1">
          <InlineInput value={p.name} maxLength={120} aria-label={`ชื่อโปรเจกต์ ${p.name}`} title="พิมพ์เพื่อแก้ชื่อโปรเจกต์"
            onCommit={(v) => renameProject(p.id, v)} className="font-medium" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`ตัวเลือก ${p.name}`}><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => openDialog({ kind: "project-settings", pid: p.id })}><Pencil />ตั้งค่าโปรเจกต์</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { const c = duplicateProject(p.id); if (c) router.push(`/w/${wid}/p/${c.id}/${c.pages[0]?.id ?? "new"}`); }}><Copy />ทำสำเนาโปรเจกต์</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openDialog({ kind: "export", pid: p.id })}><Download />ส่งออกคู่มือ</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={async () => {
                if (await confirmDialog("ลบโปรเจกต์", `ลบ ${p.name} และทุกเนื้อหา รวมถึงลิงก์ที่เผยแพร่ไว้? แนะนำให้สำรอง JSON ก่อนลบ`, "ลบโปรเจกต์", true)) deleteProject(p.id);
              }}><Trash2 />ลบโปรเจกต์</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <InlineInput value={p.website} maxLength={2000} inputMode="url" autoComplete="url" spellCheck={false} placeholder="เพิ่ม URL เว็บไซต์"
          aria-label={`URL เว็บไซต์ ${p.name}`} title="พิมพ์เพื่อแก้ URL เว็บไซต์"
          onCommit={(v) => setProjectWebsite(p.id, v)} className="text-sm text-muted-foreground" />
        <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
          <FileText className="size-3.5" />{p.pages.length} เนื้อหา
        </p>
      </div>
      <footer className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
        <span>แก้ไข {formatDate(p.updatedAt)}</span>
        <Button asChild variant="ghost" size="sm"><Link href={href}>เปิดคู่มือ<ArrowRight /></Link></Button>
      </footer>
    </Card>
  );
}
