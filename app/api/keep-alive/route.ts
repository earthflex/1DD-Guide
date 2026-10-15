import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Daily Vercel Cron (vercel.json): one tiny database query, so the free-tier Supabase project is never
 * paused for inactivity and customers' guide links keep working through quiet weeks.
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; anyone else gets 401.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ ok: false }, { status: 401 });
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.rpc("guide_publication_protected", { share_token: "keep-alive" });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 502 });
  return Response.json({ ok: true, at: new Date().toISOString() });
}
