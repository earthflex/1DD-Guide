"use client";

import { ArrowRight, BookOpen, FileText, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GuideImage } from "@/components/guide-image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { coverOf, type Project } from "@/lib/guide-core";
import { useWorkspace } from "@/lib/store";

const host = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "ยังไม่ได้ระบุเว็บไซต์"; }
};
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
      <div>
        <h1 className="text-2xl font-medium tracking-tight">คู่มือของคุณ</h1>
        <p className="text-sm text-muted-foreground">{projects.length} โปรเจกต์</p>
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
  const href = `/w/${wid}/p/${p.id}/${p.pages[0]?.id ?? ""}`;
  const cover = coverOf(p);
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <Link href={href} aria-label={`เปิดโปรเจกต์ ${p.name}`} className="block aspect-[16/10] overflow-hidden border-b bg-muted">
        {cover ? (
          <GuideImage frame={cover} alt={`ตัวอย่างคู่มือ ${p.name}`} className="size-full object-cover object-top transition-transform duration-300 hover:scale-[1.02]" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground"><BookOpen className="size-8" /></div>
        )}
      </Link>
      <div className="grid gap-1 px-4 pt-3 pb-2">
        <h2 className="truncate font-medium">{p.name}</h2>
        <p className="truncate text-sm text-muted-foreground">{host(p.website)}</p>
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
