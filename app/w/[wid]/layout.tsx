import { Suspense } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

// Not async: the shell reads the workspace ID on the client, so the layout stays in the static shell.
export default function WorkspaceLayout({ children }: LayoutProps<"/w/[wid]">) {
  return (
    <Suspense>
      <WorkspaceShell>{children}</WorkspaceShell>
    </Suspense>
  );
}
