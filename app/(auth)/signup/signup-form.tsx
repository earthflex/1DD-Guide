"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authMessage } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim();
    setPending(true);
    setError("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: String(form.get("password")),
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=/workspaces` },
    });
    setPending(false);
    if (error) return setError(authMessage(error));
    if (data.session) {
      await supabase.rpc("guide_accept_invites");
      router.replace("/workspaces");
      router.refresh();
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="grid gap-2 text-sm">
        <p>ส่งลิงก์ยืนยันไปที่ <strong>{sentTo}</strong> แล้ว</p>
        <p className="text-muted-foreground">เปิดอีเมลแล้วกดลิงก์ยืนยัน ระบบจะพาเข้าสู่ระบบให้อัตโนมัติ หากไม่เห็นอีเมล ให้ดูในโฟลเดอร์สแปม</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">อีเมล</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">รหัสผ่าน</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <p className="text-xs text-muted-foreground">อย่างน้อย 8 ตัวอักษร</p>
      </div>
      <FormError message={error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "กำลังสร้างบัญชี…" : "สร้างบัญชี"}
      </Button>
    </form>
  );
}
