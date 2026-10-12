/** Map Supabase Auth errors to the Thai messages users see. */
export function authMessage(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return "";
  const code = error.code ?? "";
  const map: Record<string, string> = {
    invalid_credentials: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    email_not_confirmed: "ยังไม่ได้ยืนยันอีเมล กรุณาเปิดลิงก์ในอีเมลก่อน",
    user_already_exists: "อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบหรือกดลืมรหัสผ่าน",
    weak_password: "รหัสผ่านง่ายเกินไป กรุณาใช้อย่างน้อย 8 ตัวอักษร",
    over_email_send_rate_limit: "ส่งอีเมลบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
    over_request_rate_limit: "ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
    signup_disabled: "ระบบปิดการสมัครบัญชีใหม่อยู่",
    same_password: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม",
  };
  return map[code] ?? error.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่";
}
