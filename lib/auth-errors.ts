/** Map Supabase Auth errors to the Thai messages users see. */
export function authMessage(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return "";
  if (/failed to fetch|fetch failed|network/i.test(error.message ?? "")) {
    return "ติดต่อระบบไม่ได้ ตรวจอินเทอร์เน็ต หรือค่า NEXT_PUBLIC_SUPABASE_URL แล้วลองใหม่";
  }
  const code = error.code ?? "";
  const map: Record<string, string> = {
    invalid_credentials: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    email_not_confirmed: "บัญชียังไม่ได้ยืนยัน กรุณาติดต่อผู้ดูแลระบบ",
    over_request_rate_limit: "ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
  };
  return map[code] ?? error.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่";
}
