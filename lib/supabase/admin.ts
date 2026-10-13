import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Admin client with the secret key. Server only: the key must never reach the browser, so it has
 * no NEXT_PUBLIC_ prefix. Used only to create team accounts, after checking the caller is an owner.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY บน server จึงสร้างบัญชีไม่ได้");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
