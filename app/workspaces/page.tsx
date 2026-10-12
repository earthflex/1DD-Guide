import type { Metadata } from "next";
import Image from "next/image";
import { WorkspaceList } from "./workspace-list";

export const metadata: Metadata = { title: "เลือก Workspace" };

export default function WorkspacesPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-16">
      <div className="mb-8 flex items-center gap-3">
        <Image src="/brand/1dd-logo.png" alt="1DD" width={40} height={40} priority />
        <div>
          <h1 className="text-2xl font-medium tracking-tight">เลือก Workspace</h1>
          <p className="text-sm text-muted-foreground">สมาชิกใน Workspace แก้ไขได้ทุกโปรเจกต์ในพื้นที่นั้น</p>
        </div>
      </div>
      <WorkspaceList />
    </main>
  );
}
