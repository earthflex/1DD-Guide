import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "ลืมรหัสผ่าน" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="ขอลิงก์ตั้งรหัสผ่านใหม่"
      footer={<Link href="/login" className="underline-offset-4 hover:underline">กลับไปเข้าสู่ระบบ</Link>}
    >
      <ForgotForm />
    </AuthCard>
  );
}
