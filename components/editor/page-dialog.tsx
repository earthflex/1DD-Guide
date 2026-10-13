"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { create } from "zustand";
import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { savePage } from "@/lib/editor";
import { safeURL } from "@/lib/guide-core";
import { useWorkspace } from "@/lib/store";

const usePageDialog = create<{ target: { pid: string; pageId: string | null } | null }>()(() => ({ target: null }));

/** Open the add-page dialog (pageId null) or the edit dialog for one page. */
export const openPageDialog = (pid: string, pageId: string | null = null) =>
  usePageDialog.setState({ target: { pid, pageId } });

export function PageDialogHost() {
  const target = usePageDialog((s) => s.target);
  const close = () => usePageDialog.setState({ target: null });
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        {target && <PageForm key={`${target.pid}/${target.pageId}`} pid={target.pid} pageId={target.pageId} onDone={close} />}
      </DialogContent>
    </Dialog>
  );
}

function PageForm({ pid, pageId, onDone }: { pid: string; pageId: string | null; onDone: () => void }) {
  const router = useRouter();
  const wid = useWorkspace((s) => s.wid);
  const page = useWorkspace((s) => s.projects.find((p) => p.id === pid)?.pages.find((q) => q.id === pageId));
  const [error, setError] = useState("");
  const edit = !!pageId;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title")).trim(), url = String(form.get("url")).trim();
    if (!title) return setError("กรุณาใส่ชื่อเนื้อหา");
    if (url && !safeURL(url)) return setError("URL ต้องขึ้นต้นด้วย https:// หรือ http://");
    const id = savePage(pid, pageId, { title, url, description: String(form.get("description")) });
    onDone();
    router.push(`/w/${wid}/p/${pid}/${id}`);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <DialogHeader><DialogTitle>{edit ? "แก้ไขเนื้อหา" : "เพิ่มเนื้อหา"}</DialogTitle></DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="page-title">ชื่อเนื้อหา</Label>
        <Input id="page-title" name="title" required maxLength={160} defaultValue={page?.title ?? ""} placeholder="เช่น วิธีเปลี่ยนรูปหน้าแรก" autoFocus />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="page-url">URL หน้าหลังบ้าน</Label>
        <Input id="page-url" name="url" type="url" maxLength={2000} defaultValue={page?.url ?? ""} placeholder="https://example.com/wp-admin/…" />
        <p className="text-xs text-muted-foreground">ลิงก์ใช้เปิดหน้าต้นทาง การจับภาพต้องเลือกแท็บที่ล็อกอินแล้ว</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="page-description">คำเกริ่น</Label>
        <Textarea id="page-description" name="description" maxLength={10000} defaultValue={page?.description ?? ""} />
      </div>
      <FormError message={error} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>ยกเลิก</Button>
        <Button type="submit">{edit ? "บันทึก" : "เพิ่มเนื้อหา"}</Button>
      </DialogFooter>
    </form>
  );
}
