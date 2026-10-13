"use client";

import { Download, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportJSON } from "@/lib/projects";
import { useWorkspace } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { deleteWorkspace, renameWorkspace } from "@/lib/workspace-actions";
import { lastWorkspace } from "@/lib/workspaces";

export function WorkspaceSettings() {
  const router = useRouter();
  const wid = useWorkspace((s) => s.wid)!;
  const name = useWorkspace((s) => s.name);
  const projects = useWorkspace((s) => s.projects);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [renameError, setRenameError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState<"" | "rename" | "delete">("");

  useEffect(() => {
    void createClient().rpc("guide_is_owner", { wid }).then((r: { data: unknown }) => setIsOwner(!!r.data));
  }, [wid]);

  async function onRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = String(new FormData(event.currentTarget).get("name")).trim();
    if (next === name) return;
    setPending("rename");
    setRenameError("");
    const result = await renameWorkspace(wid, next);
    setPending("");
    if (!result.ok) return setRenameError(result.error);
    useWorkspace.setState({ name: next });
    toast.success("เปลี่ยนชื่อ Workspace แล้ว");
  }

  async function onDelete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("delete");
    setDeleteError("");
    await useWorkspace.getState().flush();
    const result = await deleteWorkspace(wid, confirm);
    setPending("");
    if (!result.ok) return setDeleteError(result.error);
    if (lastWorkspace.get() === wid) lastWorkspace.clear();
    useWorkspace.setState({ wid: null, status: "idle", projects: [], name: "" });
    toast.success(`ลบ Workspace “${name}” แล้ว`);
    router.replace("/workspaces");
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">ตั้งค่า Workspace</h1>
        <p className="text-sm text-muted-foreground">{name} · {projects.length} โปรเจกต์</p>
      </div>
      {isOwner === null && <p className="text-sm text-muted-foreground">กำลังตรวจสิทธิ์…</p>}
      {isOwner === false && (
        <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">เฉพาะเจ้าของ Workspace เท่านั้นที่เปลี่ยนชื่อหรือลบ Workspace ได้</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ชื่อ Workspace</CardTitle>
          <CardDescription>สมาชิกทุกคนเห็นชื่อนี้ในหน้าเลือก Workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <form key={name} onSubmit={onRename} className="flex flex-wrap items-end gap-2">
            <div className="grid min-w-60 flex-1 gap-2">
              <Label htmlFor="ws-name" className="sr-only">ชื่อ Workspace</Label>
              <Input id="ws-name" name="name" defaultValue={name} required maxLength={120} disabled={!isOwner} />
            </div>
            <Button type="submit" disabled={!isOwner || pending === "rename"}>{pending === "rename" && <Loader2 className="animate-spin" />}บันทึกชื่อ</Button>
          </form>
          <FormError message={renameError} />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">ลบ Workspace</CardTitle>
          <CardDescription>
            ลบได้เฉพาะ Workspace ที่ไม่มีโปรเจกต์แล้ว ระบบจะลบไฟล์ที่เหลือในคลังไฟล์ และสิทธิ์ของสมาชิกทุกคน บัญชีของสมาชิกยังอยู่ ย้อนคืนไม่ได้
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {projects.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <span className="flex-1">
                ยังมี {projects.length} โปรเจกต์ใน Workspace นี้ ลบโปรเจกต์ทั้งหมดก่อน (สำรองเป็น JSON ไว้ได้ แล้วนำเข้าใน Workspace อื่นภายหลัง)
              </span>
              <Button variant="outline" size="sm" onClick={() => exportJSON(projects)}><Download />สำรองข้อมูลทั้งหมด</Button>
              <Button asChild variant="outline" size="sm"><Link href={`/w/${wid}`}>ไปที่โปรเจกต์</Link></Button>
            </div>
          )}
          <form onSubmit={onDelete} className="grid gap-2">
            <Label htmlFor="ws-confirm">พิมพ์ <strong className="select-all">{name}</strong> เพื่อยืนยัน</Label>
            <div className="flex flex-wrap gap-2">
              <Input id="ws-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" disabled={!isOwner || projects.length > 0} className="min-w-60 flex-1" />
              <Button type="submit" variant="destructive" disabled={!isOwner || projects.length > 0 || confirm.trim() !== name || pending === "delete"}>
                {pending === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />}ลบ Workspace ถาวร
              </Button>
            </div>
            <FormError message={deleteError} />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
