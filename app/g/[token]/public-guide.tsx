"use client";

import { Loader2, Lock } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FormError } from "@/components/auth/auth-card";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { validateImport } from "@/lib/guide-core";
import { createClient } from "@/lib/supabase/client";
import { GUIDE_SANDBOX, makeHTML } from "@/lib/viewer";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "password"; error?: string }
  | { kind: "ready"; html: string; name: string };

/** Remembered for this tab only, so a reload doesn't ask again but closing the tab forgets it. */
const remember = (token: string) => `1dd-guide-pass:${token}`;

async function render(raw: { projects: { updatedAt: string }[] }) {
  const [p] = validateImport(raw);
  p.updatedAt = raw.projects[0].updatedAt;
  return { html: await makeHTML(p), name: p.name };
}

/** Read-only customer guide from a share link, ported from legacy openPublic(), plus viewing passwords. */
export function PublicGuide() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let live = true;
    (async (): Promise<State> => {
      if (!/^[a-f0-9]{64}$/.test(token) && !/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(token)) return { kind: "error", message: "ลิงก์คู่มือไม่ถูกต้อง" };
      const supabase = createClient();
      const { data: raw, error } = await supabase.rpc("guide_read_publication", { share_token: token });
      if (error) return { kind: "error", message: "ติดต่อระบบไม่ได้ กรุณาลองใหม่" };
      if (raw) return { kind: "ready", ...(await render(raw)) };
      const { data: locked } = await supabase.rpc("guide_publication_protected", { share_token: token });
      if (!locked) return { kind: "error", message: "คู่มือนี้ไม่พร้อมใช้งาน หรือลิงก์ถูกเพิกถอนแล้ว" };
      const saved = sessionStorage.getItem(remember(token));
      if (saved) {
        const { data } = await supabase.rpc("guide_read_publication_with_password", { share_token: token, pass: saved });
        if (data) return { kind: "ready", ...(await render(data)) };
        sessionStorage.removeItem(remember(token));
      }
      return { kind: "password" };
    })().then(
      (s) => live && setState(s),
      (e: Error) => live && setState({ kind: "error", message: e.message }),
    );
    return () => { live = false; };
  }, [token]);

  useEffect(() => {
    if (state.kind === "ready") document.title = state.name + " — 1DD Guide";
  }, [state]);

  async function unlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pass = String(new FormData(event.currentTarget).get("password"));
    setPending(true);
    try {
      const { data, error } = await createClient().rpc("guide_read_publication_with_password", { share_token: token, pass });
      if (error) throw new Error("ติดต่อระบบไม่ได้ กรุณาลองใหม่");
      if (!data) { setState({ kind: "password", error: "รหัสผ่านไม่ถูกต้อง" }); return; }
      sessionStorage.setItem(remember(token), pass);
      setState({ kind: "ready", ...(await render(data)) });
    } catch (e) {
      setState({ kind: "password", error: (e as Error).message });
    } finally {
      setPending(false);
    }
  }

  if (state.kind === "ready")
    return <iframe sandbox={GUIDE_SANDBOX} title={`คู่มือ ${state.name}`} srcDoc={state.html} className="fixed inset-0 size-full border-0" />;

  return (
    <main className="grid min-h-svh place-items-center bg-muted/40 p-6">
      <div className="grid w-full max-w-sm justify-items-center gap-4 text-center">
        <div className="grid justify-items-center gap-2">
          <Image src="/brand/1dd-logo.png" alt="1DD" width={48} height={48} priority />
          <strong className="text-lg font-medium">Guide</strong>
        </div>
        {state.kind === "password" ? (
          <form onSubmit={unlock} className="grid w-full gap-4 rounded-xl border bg-card p-6 text-left shadow-sm">
            <div className="grid justify-items-center gap-2 text-center">
              <span className="grid size-10 place-items-center rounded-full bg-brand/10 text-brand"><Lock className="size-5" /></span>
              <h1 className="font-medium">คู่มือนี้ต้องใส่รหัสผ่าน</h1>
              <p className="text-sm text-muted-foreground">ใส่รหัสผ่านที่ได้รับพร้อมลิงก์</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <PasswordInput id="password" name="password" required autoFocus autoComplete="off" className="h-11 text-base md:text-base" />
            </div>
            <FormError message={state.error ?? ""} />
            <Button type="submit" disabled={pending} className="h-11 bg-brand text-base text-brand-foreground hover:bg-brand/90">
              {pending && <Loader2 className="animate-spin" />}เปิดคู่มือ
            </Button>
          </form>
        ) : (
          <p role={state.kind === "error" ? "alert" : "status"} className="text-sm text-muted-foreground">
            {state.kind === "error" ? state.message : "กำลังเปิดคู่มือ…"}
          </p>
        )}
      </div>
    </main>
  );
}
