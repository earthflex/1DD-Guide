"use client";

import {
  ArrowLeft, ArrowLeftRight, Check, ChevronRight, ChevronsUpDown, FolderOpen, Gauge, KeyRound, CircleAlert, CircleHelp, Download, History, Images, LayoutGrid, Loader2, LogOut, Plus,
  Puzzle, RefreshCw, RotateCw, Settings, Settings2, Upload, Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppDialogs } from "@/components/app-dialogs";
import { InlineInput } from "@/components/inline-input";
import { ConfirmHost, confirmDialog } from "@/components/confirm";
import { openPageDialog, PageDialogHost } from "@/components/editor/page-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset,
  SidebarGroupLabel, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton,
  SidebarMenuSubItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { hasUnsaved, saveStateOf, useWorkspace } from "@/lib/store";
import { exportJSON, renameProject } from "@/lib/projects";
import { loadPublications } from "@/lib/publications";
import { openDialog } from "@/lib/ui";
import { visible } from "@/lib/dom";
import { jumpToFrame, useEditor } from "@/lib/editor";
import { frames } from "@/lib/guide-core";
import { cn } from "@/lib/utils";
import { lastWorkspace, signOut } from "@/lib/workspaces";
import { importGuideFile } from "@/components/workspace/import-guide";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { wid } = useParams<{ wid: string }>();
  const load = useWorkspace((s) => s.load);
  const status = useWorkspace((s) => s.status);
  const loadError = useWorkspace((s) => s.loadError);
  const loadedWid = useWorkspace((s) => s.wid);

  useEffect(() => {
    if (useWorkspace.getState().wid !== wid) void load(wid);
    lastWorkspace.set(wid);
    void loadPublications(wid);
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
          <Tooltip>
            <TooltipTrigger asChild><SidebarTrigger className="-ml-1" aria-keyshortcuts="Control+\ Meta+\" /></TooltipTrigger>
            <TooltipContent side="bottom">ซ่อน / แสดงแถบด้านข้าง (Ctrl / Cmd + {"\\"})</TooltipContent>
          </Tooltip>
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
      <ConfirmHost />
      <PageDialogHost />
      <AppDialogs />
    </SidebarProvider>
  );
}

function WorkspaceSidebar({ wid }: { wid: string }) {
  const router = useRouter();
  const { pid, pageId } = useParams<{ pid?: string; pageId?: string }>();
  const project = useWorkspace((s) => (pid ? s.projects.find((p) => p.id === pid) : undefined));
  const activePage = project?.pages.find((q) => q.id === pageId) ?? project?.pages[0];
  const pathname = usePathname();
  const onMedia = pathname.endsWith("/media"), onMembers = pathname.endsWith("/members");
  // Sub-heading sections under each page: shown for the open page unless toggled.
  const [openPages, setOpenPages] = useState<Record<string, boolean>>({});
  const activeFrame = useEditor((s) => s.activeFrame);
  const activeSection = (() => {
    if (!activePage) return "";
    const all = frames(activePage), at = Math.max(0, all.findIndex((f) => f.id === activeFrame));
    for (let i = at; i >= 0; i--) if (all[i].section !== undefined) return all[i].id;
    return "";
  })();
  function goToSection(event: React.MouseEvent, pageId: string, frameId: string) {
    if (pageId === activePage?.id && pathname.includes(`/p/${pid}/`)) {
      event.preventDefault();
      jumpToFrame(frameId);
      return;
    }
    // Another page: let the link navigate, then scroll once its editor is on screen.
    let tries = 0;
    const wait = () => (visible(`#editor-image-${frameId}`) ? jumpToFrame(frameId) : ++tries < 40 && setTimeout(wait, 100));
    setTimeout(wait, 100);
  }
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
                <SidebarMenuButton asChild isActive={!project && pathname === `/w/${wid}`}>
                  <Link href={`/w/${wid}`}>{project ? <ArrowLeft /> : <LayoutGrid />}โปรเจกต์ทั้งหมด</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {project && (
          <SidebarGroup>
            <div className="px-2 pb-2">
              <InlineInput value={project.name} maxLength={120} aria-label={`ชื่อโปรเจกต์ ${project.name}`} title="พิมพ์เพื่อแก้ชื่อโปรเจกต์"
                onCommit={(v) => renameProject(project.id, v)} className="font-medium" />
              <p className="truncate text-xs text-muted-foreground">{project.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") || "ยังไม่ได้ระบุเว็บไซต์"}</p>
            </div>
            <SidebarGroupLabel>เนื้อหา</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu aria-label="เนื้อหา">
                {project.pages.map((q, n) => {
                  const href = `/w/${wid}/p/${project.id}/${q.id}`;
                  const sections = frames(q).filter((f) => f.section?.trim());
                  const open = sections.length > 0 && (openPages[q.id] ?? q.id === activePage?.id);
                  return (
                    <SidebarMenuItem key={q.id}>
                      <SidebarMenuButton asChild isActive={q.id === activePage?.id} className={cn("h-auto py-2 data-[active=true]:bg-brand/10 data-[active=true]:text-foreground", sections.length && "pr-8")}>
                        <Link href={href} aria-current={q.id === activePage?.id ? "page" : undefined}>
                          <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">{String(n + 1).padStart(2, "0")}</span>
                          <span className="line-clamp-2">{q.title || "เนื้อหาใหม่"}</span>
                        </Link>
                      </SidebarMenuButton>
                      {sections.length > 0 && (
                        <SidebarMenuAction
                          aria-expanded={open}
                          aria-label={`${open ? "ซ่อน" : "แสดง"}หัวข้อย่อยของ ${q.title}`}
                          title={open ? "ซ่อนหัวข้อย่อย" : "แสดงหัวข้อย่อย"}
                          onClick={() => setOpenPages((o) => ({ ...o, [q.id]: !open }))}
                          className="top-2"
                        >
                          <ChevronRight className={cn("transition-transform", open && "rotate-90")} />
                        </SidebarMenuAction>
                      )}
                      {open && (
                        <SidebarMenuSub>
                          {sections.map((f) => (
                            <SidebarMenuSubItem key={f.id}>
                              <SidebarMenuSubButton asChild size="sm" isActive={q.id === activePage?.id && f.id === activeSection}
                                className="h-auto py-1.5 data-[active=true]:bg-brand/10 data-[active=true]:text-brand">
                                <Link href={href} onClick={(e) => goToSection(e, q.id, f.id)}>
                                  <span className="line-clamp-2">{f.section}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                })}
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => openPageDialog(project.id)} className="text-muted-foreground">
                    <Plus />เพิ่มเนื้อหา
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {project && (
          <SidebarGroup className="pt-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => openDialog({ kind: "project-settings", pid: project.id })}><Settings2 />ตั้งค่าโปรเจกต์</SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={onMedia}>
                  <Link href={`/w/${wid}/media`}><Images />คลังไฟล์</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.endsWith("/activity")}>
                  <Link href={`/w/${wid}/activity`}><History />กิจกรรม</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={onMembers}>
                  <Link href={`/w/${wid}/members`}><Users />สมาชิก</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <WorkspaceMenu wid={wid} onLogout={logout} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function WorkspaceName() {
  const { wid, pid, pageId } = useParams<{ wid: string; pid?: string; pageId?: string }>();
  const name = useWorkspace((s) => s.name);
  const ready = useWorkspace((s) => s.status === "ready");
  const project = useWorkspace((s) => (pid ? s.projects.find((p) => p.id === pid) : undefined));
  const page = project?.pages.find((q) => q.id === pageId) ?? project?.pages[0];
  const title = page ? `${page.title} · ${project!.name}` : project?.name ?? name;
  useEffect(() => { if (ready && title) document.title = `${title} — 1DD Guide`; }, [ready, title]);
  if (!ready) return <Skeleton className="h-4 w-32" />;
  return (
    <nav aria-label="ตำแหน่งปัจจุบัน" className="flex min-w-0 items-center gap-1.5 text-sm">
      {project ? <Link href={`/w/${wid}`} className="truncate text-muted-foreground hover:text-foreground">{name}</Link> : <strong className="truncate font-medium">{name}</strong>}
      {project && <><span className="text-muted-foreground">/</span><strong className="truncate font-medium">{project.name}</strong></>}
    </nav>
  );
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
      <Button size="sm" variant="outline" onClick={() => exportJSON(useWorkspace.getState().projects)}>สำรองข้อมูล</Button>
      {!conflict && <Button size="sm" variant="outline" onClick={retry}>ลองบันทึกอีกครั้ง</Button>}
      {wid && <Button size="sm" variant="outline" onClick={() => load(wid)}>โหลดล่าสุดจากคลาวด์</Button>}
    </div>
  );
}

/** Workspace actions from the legacy "เพิ่มเติม" menu, in one dropdown at the bottom of the sidebar. */
function WorkspaceMenu({ wid, onLogout }: { wid: string; onLogout: () => void }) {
  const router = useRouter();
  const name = useWorkspace((s) => s.name);
  const importInput = useRef<HTMLInputElement>(null);

  async function reload() {
    const ws = useWorkspace.getState();
    if (hasUnsaved() || ws.saveError) {
      const ok = await confirmDialog("โหลดข้อมูลล่าสุด", "งานที่ยังไม่ได้บันทึกในหน้านี้จะหายไป แนะนำให้สำรอง JSON ก่อน", "โหลดล่าสุด", true);
      if (!ok) return;
    }
    await ws.load(wid);
    toast.success("โหลดข้อมูลล่าสุดแล้ว");
  }

  async function onImport(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    try {
      const first = await importGuideFile(file);
      if (!first) return;
      toast.success("นำเข้าคู่มือเรียบร้อยแล้ว");
      router.push(`/w/${wid}/p/${first.id}/${first.pages[0]?.id ?? "new"}`);
    } catch (e) { toast.error((e as Error).message); }
  }

  function openImport() {
    importInput.current?.click();
  }

  function backupAll() {
    const { projects } = useWorkspace.getState();
    if (!projects.length) toast.info("ยังไม่มีโปรเจกต์ให้สำรอง");
    else void exportJSON(projects);
  }

  return (
    <>
      <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={onImport} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton size="lg" aria-label="เมนู Workspace" className="data-[state=open]:bg-sidebar-accent">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand/10 text-brand"><FolderOpen className="size-4" /></span>
            <span className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate font-medium">{name || "Workspace"}</span>
              <span className="truncate text-xs text-muted-foreground">ทีม · ข้อมูล · ช่วยเหลือ</span>
            </span>
            <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
          <DropdownMenuLabel>Workspace</DropdownMenuLabel>
          <DropdownMenuItem asChild><Link href={`/w/${wid}/members`}><Users />สมาชิกในทีม</Link></DropdownMenuItem>
          <DropdownMenuItem onSelect={backupAll}><Download />สำรองข้อมูลทั้งหมด</DropdownMenuItem>
          <DropdownMenuItem onSelect={openImport}><Upload />นำเข้าคู่มือ</DropdownMenuItem>
          <DropdownMenuItem onSelect={reload}><RefreshCw />โหลดข้อมูลล่าสุด</DropdownMenuItem>
          <DropdownMenuItem asChild><Link href={`/w/${wid}/settings`}><Settings />ตั้งค่า Workspace</Link></DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>ช่วยเหลือ</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => openDialog({ kind: "extension" })}><Puzzle />ส่วนขยายจับภาพ</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDialog({ kind: "help" })}><CircleHelp />วิธีใช้งาน</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => openDialog({ kind: "password" })}><KeyRound />เปลี่ยนรหัสผ่าน</DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/workspaces"><ArrowLeftRight />เปลี่ยน Workspace</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/system"><Gauge />ภาพรวมระบบ (ทุก Workspace)</Link></DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={onLogout}><LogOut />ออกจากระบบ</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
