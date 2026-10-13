import type { Metadata } from "next";
import { WorkspaceSettings } from "@/components/workspace/workspace-settings";

// Workspace data loads in the browser, so the shell shows a skeleton until it arrives.
export const instant = false;

export const metadata: Metadata = { title: "ตั้งค่า Workspace" };

export default function SettingsPage() {
  return <WorkspaceSettings />;
}
