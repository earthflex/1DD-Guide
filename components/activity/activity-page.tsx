"use client";

import { History, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ACTION_GROUPS, ACTION_LABEL, type ActivityAction, type ActivityRow } from "@/lib/activity";
import { useWorkspace } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const PAGE = 50;
type Range = "1" | "7" | "30" | "all";
type Filters = { person: string; kind: string; project: string; range: Range };

const tone: Partial<Record<ActivityAction, string>> = {
  delete_project: "text-destructive", delete_page: "text-destructive", delete_media: "text-destructive",
  remove_member: "text-destructive", revoke: "text-destructive",
  publish: "text-emerald-700", create_project: "text-emerald-700", add_member: "text-emerald-700", add_page: "text-emerald-700",
};

const dayLabel = (iso: string) => {
  const d = new Date(iso), today = new Date();
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days === 0) return "วันนี้";
  if (days === 1) return "เมื่อวาน";
  return d.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};
const time = (iso: string) => new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

async function fetchActivity(wid: string, f: Filters, before?: string) {
  let q = createClient()
    .from("guide_activity")
    .select("id,email,action,project_id,project_name,page_id,page_title,detail,created_at")
    .eq("workspace_id", wid)
    .order("created_at", { ascending: false })
    .limit(PAGE);
  if (before) q = q.lt("created_at", before);
  if (f.person !== "all") q = q.eq("email", f.person);
  if (f.project !== "all") q = q.eq("project_id", f.project);
  if (f.kind !== "all") q = q.in("action", ACTION_GROUPS.find((g) => g.label === f.kind)?.actions ?? []);
  if (f.range !== "all") q = q.gte("created_at", new Date(Date.now() - Number(f.range) * 86400000).toISOString());
  const { data, error } = await q;
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || /guide_activity/.test(error.message))
      throw new Error("ยังไม่ได้เปิดใช้บันทึกกิจกรรม ผู้ดูแลต้องรันไฟล์ supabase/activity.sql ใน Supabase SQL Editor ก่อน");
    throw new Error(error.message);
  }
  return data as ActivityRow[];
}

export function ActivityPage() {
  const wid = useWorkspace((s) => s.wid)!;
  const projects = useWorkspace((s) => s.projects);
  const [filters, setFilters] = useState<Filters>({ person: "all", kind: "all", project: "all", range: "30" });
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [people, setPeople] = useState<string[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apply = useCallback((list: ActivityRow[], append: boolean) => {
    setRows((old) => (append && old ? [...old, ...list] : list));
    setMore(list.length === PAGE);
    setPeople((old) => [...new Set([...old, ...list.map((r) => r.email).filter(Boolean)])].sort());
    setError("");
  }, []);

  useEffect(() => {
    let live = true;
    fetchActivity(wid, filters).then((list) => live && apply(list, false), (e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [wid, filters, apply]);

  async function load(append: boolean) {
    setLoading(true);
    try { apply(await fetchActivity(wid, filters, append ? rows?.at(-1)?.created_at : undefined), append); }
    catch (e) { setError((e as Error).message); }
    setLoading(false);
  }

  const set = (k: keyof Filters) => (v: string) => { setRows(null); setFilters((f) => ({ ...f, [k]: v })); };
  const live = new Map(projects.map((p) => [p.id, p]));

  const groups: { day: string; items: ActivityRow[] }[] = [];
  for (const r of rows ?? []) {
    const day = dayLabel(r.created_at);
    if (groups.at(-1)?.day === day) groups.at(-1)!.items.push(r);
    else groups.push({ day, items: [r] });
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">กิจกรรม</h1>
          <p className="text-sm text-muted-foreground">ใครทำอะไรใน Workspace นี้ · เก็บย้อนหลัง 6 เดือน · การพิมพ์แก้ไขรวมเป็นรายการเดียวทุก 30 นาที</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="รีเฟรช" onClick={() => load(false)}><RefreshCw /></Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filters.range} onValueChange={set("range")}>
          <SelectTrigger size="sm" className="w-36" aria-label="ช่วงเวลา"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">24 ชั่วโมง</SelectItem>
            <SelectItem value="7">7 วัน</SelectItem>
            <SelectItem value="30">30 วัน</SelectItem>
            <SelectItem value="all">ทั้งหมด</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.person} onValueChange={set("person")}>
          <SelectTrigger size="sm" className="w-56" aria-label="กรองตามคน"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกคน</SelectItem>
            {people.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.kind} onValueChange={set("kind")}>
          <SelectTrigger size="sm" className="w-44" aria-label="กรองตามประเภท"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกประเภท</SelectItem>
            {ACTION_GROUPS.map((g) => <SelectItem key={g.label} value={g.label}>{g.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.project} onValueChange={set("project")}>
          <SelectTrigger size="sm" className="w-52" aria-label="กรองตามโปรเจกต์"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">ทุกโปรเจกต์</SelectItem>
            </SelectGroup>
            {projects.length > 0 && (
              <SelectGroup>
                <SelectLabel>โปรเจกต์ที่มีอยู่</SelectLabel>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </div>

      {error && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}

      {!rows && !error ? (
        <div className="grid gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : rows && !rows.length ? (
        <div className="grid place-items-center gap-2 py-16 text-center text-muted-foreground">
          <History className="size-8" />
          <p className="text-sm">ยังไม่มีกิจกรรมตามตัวกรองนี้</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.day} className="grid gap-2">
            <h2 className="text-xs font-medium text-muted-foreground">{g.day}</h2>
            <Card className="gap-0 py-0">
              <CardContent className="p-0">
                <ol className="divide-y">
                  {g.items.map((r) => {
                    const project = r.project_id ? live.get(r.project_id) : undefined;
                    const pageLive = project && r.page_id && project.pages.some((q) => q.id === r.page_id);
                    const href = project ? `/w/${wid}/p/${project.id}/${pageLive ? r.page_id : project.pages[0]?.id ?? "new"}` : null;
                    const target = [r.project_name, r.page_title].filter(Boolean).join(" / ");
                    return (
                      <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-medium text-brand uppercase">{r.email[0] ?? "?"}</span>
                        <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
                          <p className="min-w-0">
                            <strong className="font-medium">{r.email || "ไม่ทราบผู้ใช้"}</strong>{" "}
                            <span className={cn("text-muted-foreground", tone[r.action])}>{ACTION_LABEL[r.action] ?? r.action}</span>
                            {target && <>{" "}{href ? <Link href={href} className="font-medium underline-offset-2 hover:underline">{target}</Link> : <span className="font-medium">{target}</span>}</>}
                          </p>
                          {r.detail && <p className="truncate text-xs text-muted-foreground">{r.detail}</p>}
                        </div>
                        <time dateTime={r.created_at} className="shrink-0 text-xs text-muted-foreground tabular-nums">{time(r.created_at)}</time>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          </section>
        ))
      )}

      {more && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => load(true)} disabled={loading}>{loading && <Loader2 className="animate-spin" />}โหลดเพิ่ม</Button>
        </div>
      )}
    </div>
  );
}
