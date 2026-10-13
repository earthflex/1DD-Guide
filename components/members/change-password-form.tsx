"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/auth/auth-card";
import { NewPasswordField } from "@/components/auth/new-password-field";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authMessage } from "@/lib/auth-errors";
import { releaseAccount } from "@/lib/member-actions";
import { createClient } from "@/lib/supabase/client";

/** Change your own password. Checks the current password first so an unattended session cannot change it. */
export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [round, setRound] = useState(0);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, values = new FormData(form);
    const current = String(values.get("current")), next = String(values.get("next")), confirm = String(values.get("confirm"));
    if (next.length < 8 || next.length > 72) return setError("รหัสผ่านใหม่ต้องยาว 8–72 ตัวอักษร");
    if (next !== confirm) return setError("ยืนยันรหัสผ่านใหม่ไม่ตรงกัน");
    if (next === current) return setError("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม");
    setPending(true);
    setError("");
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getClaims();
      const email = data?.claims?.email;
      if (!email) throw new Error("กรุณาเข้าสู่ระบบใหม่");
      const check = await supabase.auth.signInWithPassword({ email, password: current });
      if (check.error) throw new Error(check.error.code === "invalid_credentials" ? "รหัสผ่านปัจจุบันไม่ถูกต้อง" : authMessage(check.error));
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw new Error(error.code === "same_password" ? "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม" : authMessage(error));
      // The account now has a password only its owner knows; the creator loses reset rights.
      await releaseAccount().catch(() => {});
      form.reset();
      setRound((r) => r + 1);
      toast.success("เปลี่ยนรหัสผ่านแล้ว");
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="pw-current">รหัสผ่านปัจจุบัน</Label>
        <PasswordInput id="pw-current" name="current" required autoComplete="current-password" />
      </div>
      <NewPasswordField key={round} id="pw-next" name="next" label="รหัสผ่านใหม่" confirmName="confirm" confirmLabel="ยืนยันรหัสผ่านใหม่" />
      <FormError message={error} />
      <div><Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}เปลี่ยนรหัสผ่าน</Button></div>
    </form>
  );
}
