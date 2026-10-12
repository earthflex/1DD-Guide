"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authMessage } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

export function ResetForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password"));
    setPending(true);
    setError("");
    const { error } = await createClient().auth.updateUser({ password });
    setPending(false);
    if (error) return setError(authMessage(error));
    toast.success("เปลี่ยนรหัสผ่านแล้ว");
    router.replace("/workspaces");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="password">รหัสผ่านใหม่</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus />
      </div>
      <FormError message={error} />
      <Button type="submit" disabled={pending} className="w-full">{pending ? "กำลังบันทึก…" : "บันทึกรหัสผ่าน"}</Button>
    </form>
  );
}
