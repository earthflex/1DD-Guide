import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "สร้างบัญชี" };

export default function SignupPage() {
  return (
    <AuthCard
      title="สร้างบัญชีทีม"
      description="หลังสมัคร ให้เปิดอีเมลยืนยันก่อนเข้าใช้งาน"
      footer={<>มีบัญชีแล้ว? <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">เข้าสู่ระบบ</Link></>}
    >
      <SignupForm />
    </AuthCard>
  );
}
