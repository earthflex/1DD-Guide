"use client";

import { ChevronRight, FolderOpen, LogOut, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NewWorkspaceDialog } from "@/components/workspace/new-workspace-dialog";
import { lastWorkspace, listWorkspaces, signOut, type WorkspaceSummary } from "@/lib/workspaces";

export function WorkspaceList() {
  const router = useRouter();
  const [list, setList] = useState<WorkspaceSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listWorkspaces().then(setList, (e: Error) => setError(e.message));
  }, []);

  const open = (id: string) => {
    lastWorkspace.set(id);
    router.push(`/w/${id}`);
  };

  async function logout() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {list === null && !error && <Skeleton className="h-16 w-full" />}
      {list?.length === 0 && (
        <p className="text-sm text-muted-foreground">ยังไม่มี Workspace สร้างพื้นที่สำหรับทีม หรือให้เจ้าของเชิญด้วยอีเมลของคุณ</p>
      )}
      {list?.map((w) => (
        <Card key={w.id} className="py-0 transition-colors hover:bg-accent/60">
          <CardContent className="p-0">
            <button onClick={() => open(w.id)} className="flex w-full items-center gap-3 px-5 py-4 text-left">
              <FolderOpen className="size-5 text-brand" />
              <span className="flex-1 font-medium">{w.name}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <NewWorkspaceDialog onCreated={open} trigger={<Button><Plus />สร้าง Workspace ใหม่</Button>} />
        <Button variant="ghost" onClick={logout}><LogOut />ออกจากระบบ</Button>
      </div>
    </div>
  );
}
