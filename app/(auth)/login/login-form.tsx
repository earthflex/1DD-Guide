"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/auth/auth-card";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authMessage } from "@/lib/auth-errors";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState(params.get("error") ?? "");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    });
    if (error) {
      setError(authMessage(error));
      setPending(false);
      return;
    }
    // Claim any pending workspace invites for this email.
    await supabase.rpc("guide_accept_invites");
    router.replace(safeNext(params.get("next")));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="email">อีเมล</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="name@example.com"
          required
          autoFocus
          className="h-11 px-3.5 text-base md:text-base"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">รหัสผ่าน</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          className="h-11 px-3.5 text-base md:text-base"
        />
      </div>
      <FormError message={error} />
      <Button type="submit" disabled={pending} className="h-11 w-full bg-brand text-base text-brand-foreground hover:bg-brand/90">
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </Button>
    </form>
  );
}
