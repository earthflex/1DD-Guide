"use client";

import { useState } from "react";
import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authMessage } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

export function ForgotForm() {
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    setPending(true);
    setError("");
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
    });
    setPending(false);
    if (error) return setError(authMessage(error));
    setSent(true);
  }

  if (sent) return <p className="text-sm">หากมีบัญชีนี้ ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมล</p>;

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">อีเมล</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      <FormError message={error} />
      <Button type="submit" disabled={pending} className="w-full">{pending ? "กำลังส่ง…" : "ส่งลิงก์"}</Button>
    </form>
  );
}
