import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage() {
  return (
    <AuthCard
      title="เข้าสู่ระบบ"
      description="ใช้บัญชีของทีมเพื่อเปิด Workspace และคู่มือของคุณ"
      footer={<>ยังไม่มีบัญชี? <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">สร้างบัญชีใหม่</Link></>}
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
