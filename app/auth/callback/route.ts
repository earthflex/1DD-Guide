import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

/** Email confirm / password reset links land here with a PKCE `code`. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const failed = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  if (searchParams.get("error")) {
    const expired = searchParams.get("error_code") === "otp_expired";
    return failed(expired ? "ลิงก์ในอีเมลหมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่" : searchParams.get("error_description") ?? "ยืนยันไม่สำเร็จ");
  }
  const code = searchParams.get("code");
  if (!code) return failed("ลิงก์ไม่ถูกต้อง");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return failed("ลิงก์หมดอายุหรือเปิดคนละเบราว์เซอร์กับที่สมัคร กรุณาเข้าสู่ระบบหรือขอลิงก์ใหม่");
  await supabase.rpc("guide_accept_invites");
  return NextResponse.redirect(`${origin}${next}`);
}
