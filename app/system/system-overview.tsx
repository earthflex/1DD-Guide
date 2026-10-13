"use client";

import { ArrowLeft, Database, FolderOpen, HardDrive, Loader2, LogIn, RefreshCw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { lastWorkspace } from "@/lib/workspaces";

/** Supabase free-tier limits the team watches. */
const DB_LIMIT = 500 * 1024 * 1024, STORAGE_LIMIT = 1024 * 1024 * 1024;

type WorkspaceRow = {
  id: string; name: string; updated_at: string; document_bytes: number; projects: number; members: number;
  owners: string[]; my_role: "owner" | "editor" | null; publications: number; publication_bytes: number; files: number; file_bytes: number;
};
type Overview = { database_bytes: number; storage_bytes: number; workspaces: WorkspaceRow[] };

async function fetchOverview(): Promise<Overview> {
  const { data, error } = await createClient().rpc("guide_system_overview");
  if (error) {
    if (/function .*does not exist|Could not find the function/i.test(error.message))
      throw new Error("ยังไม่ได้เปิดใช้หน้าภาพรวมระบบ ผู้ดูแลต้องรัน supabase/setup.sql ล่าสุดใน Supabase ก่อน");
    throw new Error(error.message);
  }
  if (!data) throw new Error("หน้านี้สำหรับบัญชีที่อยู่ในทีมแล้วเท่านั้น ให้เจ้าของ Workspace เพิ่มคุณเป็นสมาชิกก่อน");
  return data as Overview;
}

function Meter({ icon, label, used, limit, note }: { icon: React.ReactNode; label: string; used: number; limit: number; note: string }) {
  const pct = Math.min(100, (used / limit) * 100);
  const tone = pct >= 85 ? "bg-destructive" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">{icon}{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{formatBytes(used)} <span className="text-sm font-normal text-muted-foreground">/ {formatBytes(limit)}</span></CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
          <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">ใช้ไป {pct.toFixed(1)}% · {note}</p>
      </CardContent>
    </Card>
  );
}

export function SystemOverview() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState("");

  const load = () => fetchOverview().then((d) => { setData(d); setError(""); }, (e: Error) => setError(e.message));
  useEffect(() => {
    fetchOverview().then(setData, (e: Error) => setError(e.message));
  }, []);

  async function join(w: WorkspaceRow) {
    setJoining(w.id);
    const { error } = await createClient().rpc("guide_join_workspace", { wid: w.id });
    setJoining("");
    if (error) return void toast.error(error.message);
    toast.success(`เข้าร่วม ${w.name} แล้ว`);
    lastWorkspace.set(w.id);
    router.push(`/w/${w.id}`);
  }

  const rows = [...(data?.workspaces ?? [])].sort((a, b) =>
    (b.document_bytes + b.publication_bytes + b.file_bytes) - (a.document_bytes + a.publication_bytes + a.file_bytes));
  const dbParts = rows.reduce((n, w) => n + w.document_bytes + w.publication_bytes, 0);

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <Image src="/brand/1dd-logo.png" alt="1DD" width={36} height={36} />
        <div className="flex-1">
          <h1 className="text-2xl font-medium tracking-tight">ภาพรวมระบบ</h1>
          <p className="text-sm text-muted-foreground">ทุก Workspace ในระบบ และพื้นที่ที่ใช้ เทียบกับโควตา Supabase แพ็กเกจฟรี</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="รีเฟรช" onClick={load}><RefreshCw /></Button>
        <Button asChild variant="outline"><Link href="/workspaces"><ArrowLeft />Workspace ของฉัน</Link></Button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}

      {!data && !error ? (
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      ) : data && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Meter icon={<Database className="size-4" />} label="ฐานข้อมูล (Database)" used={data.database_bytes} limit={DB_LIMIT}
              note={`ข้อมูลคู่มือ ${formatBytes(dbParts)} ที่เหลือเป็นระบบของ Supabase · เกิน 500 MB จะบันทึกไม่ได้`} />
            <Meter icon={<HardDrive className="size-4" />} label="ไฟล์รูป (Storage)" used={data.storage_bytes} limit={STORAGE_LIMIT}
              note="ลบไฟล์ที่ไม่ได้ใช้ได้ที่หน้าคลังไฟล์ของแต่ละ Workspace" />
          </div>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
              <CardTitle className="text-base">Workspace ทั้งหมด ({rows.length})</CardTitle>
              <CardDescription>เรียงจากใช้พื้นที่มากสุด · ลิงก์เผยแพร่เก็บรูปไว้ในฐานข้อมูล จึงนับรวมในฐานข้อมูล</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-4 py-2 font-medium">Workspace</th>
                    <th className="px-3 py-2 text-right font-medium">โปรเจกต์</th>
                    <th className="px-3 py-2 text-right font-medium">สมาชิก</th>
                    <th className="px-3 py-2 text-right font-medium">ข้อมูลคู่มือ</th>
                    <th className="px-3 py-2 text-right font-medium">ลิงก์เผยแพร่</th>
                    <th className="px-3 py-2 text-right font-medium">ไฟล์รูป</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((w) => (
                    <tr key={w.id} className="align-middle">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="size-4 shrink-0 text-brand" />
                          <strong className="font-medium">{w.name}</strong>
                          {w.my_role && <Badge variant="outline">{w.my_role === "owner" ? "เจ้าของ" : "สมาชิก"}</Badge>}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          เจ้าของ {w.owners.join(", ") || "—"} · แก้ไข {new Date(w.updated_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{w.projects}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{w.members}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatBytes(w.document_bytes)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{w.publications ? <>{formatBytes(w.publication_bytes)} <span className="text-xs text-muted-foreground">({w.publications})</span></> : "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{w.files ? <>{formatBytes(w.file_bytes)} <span className="text-xs text-muted-foreground">({w.files})</span></> : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {w.my_role ? (
                          <Button asChild size="sm" variant="outline"><Link href={`/w/${w.id}`} onClick={() => lastWorkspace.set(w.id)}>เปิด</Link></Button>
                        ) : (
                          <Button size="sm" onClick={() => join(w)} disabled={joining === w.id}>
                            {joining === w.id ? <Loader2 className="animate-spin" /> : <LogIn />}เข้าร่วม
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
