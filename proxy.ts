import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets, fonts, images and the extension zip.
  matcher: ["/((?!_next/static|_next/image|icon.png|fonts/|brand/|.*\\.(?:png|jpg|jpeg|webp|svg|ico|woff2|zip)$).*)"],
};
