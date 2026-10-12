import Link from "next/link";
import { Button } from "@/components/ui/button";

// Phase 1 placeholder: the dashboard and editor arrive in phases 2–4.
export default function WorkspacePage() {
  return (
    <main className="m-auto grid max-w-md gap-4 p-6 text-center">
      <h1 className="text-xl font-medium">Workspace</h1>
      <p className="text-sm text-muted-foreground">หน้ารวมโปรเจกต์กำลังพัฒนาในขั้นถัดไป</p>
      <Button asChild variant="outline"><Link href="/workspaces">กลับไปเลือก Workspace</Link></Button>
    </main>
  );
}
