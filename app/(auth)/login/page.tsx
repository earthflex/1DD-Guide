import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage() {
  return (
    <AuthCard
      title="เข้าสู่ระบบ"
      description="สำหรับทีม 1DD ที่ร่วมกันสร้างและแก้ไขคู่มือ"
      footer={
        <>
          <p>ลืมรหัสผ่านหรือยังไม่มีบัญชี? ติดต่อผู้ดูแลระบบ</p>
          <p className="text-xs">ลูกค้าที่ได้รับลิงก์คู่มือ ไม่ต้องเข้าสู่ระบบ เปิดลิงก์ได้เลย</p>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
