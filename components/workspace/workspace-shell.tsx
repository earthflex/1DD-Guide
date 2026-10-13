"use client";

import { ArrowLeftRight, Check, CircleAlert, LayoutGrid, Loader2, LogOut, RotateCw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { hasUnsaved, saveStateOf, useWorkspace } from "@/lib/store";
import { lastWorkspace, signOut } from "@/lib/workspaces";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { wid } = useParams<{ wid: string }>();
  const load = useWorkspace((s) => s.load);
  const status = useWorkspace((s) => s.status);
  const loadError = useWorkspace((s) => s.loadError);
  const loadedWid = useWorkspace((s) => s.wid);

  useEffect(() => {
    if (useWorkspace.getState().wid !== wid) void load(wid);
    lastWorkspace.set(wid);
  }, [wid, load]);

  // Warn before closing the tab while a save is pending, like the legacy app.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (hasUnsaved()) e.preventDefault(); };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, []);

  const ready = status === "ready" && loadedWid === wid;

  return (
    <SidebarProvider>
      <WorkspaceSidebar wid={wid} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <WorkspaceName />
          <div className="ml-auto"><SaveStatus /></div>
        </header>
        <SaveBanner />
        {status === "error" ? (
          <div className="m-auto grid max-w-md gap-4 p-6 text-center">
            <p role="alert" className="text-sm text-destructive">{loadError}</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => load(wid)}><RotateCw />ลองใหม่</Button>
              <Button asChild variant="ghost"><Link href="/workspaces">เลือก Workspace อื่น</Link></Button>
            </div>
          </div>
        ) : ready ? children : (
          <div className="grid gap-6 p-6 md:p-8">
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="aspect-[4/3] w-full" />)}
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}

function WorkspaceSidebar({ wid }: { wid: string }) {
  const router = useRouter();
  async function logout() {
    await useWorkspace.getState().flush();
    await signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <Sidebar>
      <SidebarHeader>
        <Link href={`/w/${wid}`} className="flex items-center gap-2 px-2 py-1.5" aria-label="1DD Guide หน้ารวมโปรเจกต์">
          <Image src="/brand/1dd-logo.png" alt="1DD" width={28} height={28} />
          <span className="text-lg font-medium tracking-tight">Guide</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive>
                  <Link href={`/w/${wid}`}><LayoutGrid />โปรเจกต์ทั้งหมด</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/workspaces"><ArrowLeftRight />เปลี่ยน Workspace</Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout}><LogOut />ออกจากระบบ</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function WorkspaceName() {
  const name = useWorkspace((s) => s.name);
  const ready = useWorkspace((s) => s.status === "ready");
  return ready ? <span className="truncate text-sm font-medium">{name}</span> : <Skeleton className="h-4 w-32" />;
}

function SaveStatus() {
  const state = useWorkspace(saveStateOf);
  const ready = useWorkspace((s) => s.status === "ready");
  if (!ready) return null;
  const view = {
    saved: { icon: <Check />, text: "บันทึกบนคลาวด์แล้ว", cls: "text-muted-foreground" },
    saving: { icon: <Loader2 className="animate-spin" />, text: "กำลังบันทึก…", cls: "text-muted-foreground" },
    error: { icon: <CircleAlert />, text: "ยังบันทึกไม่ได้", cls: "text-destructive" },
  }[state];
  return (
    <span role="status" className={`flex items-center gap-1.5 text-xs [&_svg]:size-3.5 ${view.cls}`}>
      {view.icon}{view.text}
    </span>
  );
}

function SaveBanner() {
  const saveError = useWorkspace((s) => s.saveError);
  const conflict = useWorkspace((s) => s.conflict);
  const wid = useWorkspace((s) => s.wid);
  const retry = useWorkspace((s) => s.retry);
  const load = useWorkspace((s) => s.load);
  if (!saveError) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive">
      <span className="flex-1">{saveError}</span>
      {conflict && wid
        ? <Button size="sm" variant="outline" onClick={() => load(wid)}>โหลดล่าสุดจากคลาวด์</Button>
        : <Button size="sm" variant="outline" onClick={retry}>ลองบันทึกอีกครั้ง</Button>}
    </div>
  );
}
