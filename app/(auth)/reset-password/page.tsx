import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "ตั้งรหัสผ่านใหม่" };

// Reached from the reset email via /auth/callback, so the proxy guarantees a session.
export default function ResetPasswordPage() {
  return (
    <AuthCard title="ตั้งรหัสผ่านใหม่">
      <ResetForm />
    </AuthCard>
  );
}
