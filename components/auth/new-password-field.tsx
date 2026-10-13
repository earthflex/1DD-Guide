"use client";

import { Copy, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { generatePassword } from "@/lib/password";

/**
 * New-password input with "generate" and "copy". With `confirmName` it also renders the confirm field,
 * and a generated password fills both. Values still submit through the form by `name`.
 */
export function NewPasswordField({ id, name, label = "รหัสผ่าน", confirmName, confirmLabel = "ยืนยันรหัสผ่าน", autoFocus, minLength = 8, length = 14 }: {
  id: string; name: string; label?: string; confirmName?: string; confirmLabel?: string; autoFocus?: boolean;
  /** Shortest allowed password, and the length of generated ones. */
  minLength?: number; length?: number;
}) {
  const [value, setValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [revealed, setRevealed] = useState(false);

  function generate() {
    const pw = generatePassword(length);
    setValue(pw);
    setConfirm(pw);
    setRevealed(true);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(value); toast.success("คัดลอกรหัสผ่านแล้ว"); }
    catch { toast.info("คัดลอกไม่ได้ กรุณาเลือกข้อความแล้วกด Ctrl / ⌘ + C"); }
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={id}>{label}</Label>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="xs" onClick={generate}><Wand2 />สุ่มรหัสผ่าน</Button>
            <Button type="button" variant="ghost" size="xs" onClick={copy} disabled={!value}><Copy />คัดลอก</Button>
          </div>
        </div>
        <PasswordInput id={id} name={name} value={value} onChange={(e) => setValue(e.target.value)}
          revealed={revealed} onRevealedChange={setRevealed}
          required minLength={minLength} maxLength={72} autoComplete="new-password" placeholder={`อย่างน้อย ${minLength} ตัวอักษร`} autoFocus={autoFocus}
          className="font-mono" />
      </div>
      {confirmName && (
        <div className="grid gap-2">
          <Label htmlFor={`${id}-confirm`}>{confirmLabel}</Label>
          <PasswordInput id={`${id}-confirm`} name={confirmName} value={confirm} onChange={(e) => setConfirm(e.target.value)}
            revealed={revealed} onRevealedChange={setRevealed}
            required minLength={minLength} maxLength={72} autoComplete="new-password" className="font-mono" />
        </div>
      )}
    </div>
  );
}
