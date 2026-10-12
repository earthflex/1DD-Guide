"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWorkspace } from "@/lib/workspaces";

export function NewWorkspaceDialog({ onCreated, trigger }: { onCreated: (id: string) => void; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name")).trim();
    if (!name) return setError("กรุณาใส่ชื่อ");
    setPending(true);
    setError("");
    try {
      const id = await createWorkspace(name);
      setOpen(false);
      onCreated(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>สร้าง Workspace</DialogTitle>
            <DialogDescription>คุณจะเป็นเจ้าของ Workspace นี้ และเชิญสมาชิกเข้ามาช่วยทำคู่มือได้</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="ws-name">ชื่อ Workspace</Label>
            <Input id="ws-name" name="name" required maxLength={120} placeholder="เช่น 1DD Team" autoFocus />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>{pending ? "กำลังสร้าง…" : "สร้าง Workspace"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
