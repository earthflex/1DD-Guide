"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { lastWorkspace } from "@/lib/workspaces";

/** `/` opens the last workspace on this browser, otherwise the picker. */
export function HomeRedirect() {
  const router = useRouter();
  useEffect(() => {
    const wid = lastWorkspace.get();
    router.replace(wid ? `/w/${wid}` : "/workspaces");
  }, [router]);
  return <p className="m-auto text-sm text-muted-foreground">กำลังเปิด Guide…</p>;
}
