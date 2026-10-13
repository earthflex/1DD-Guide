import type { Metadata } from "next";
import { Dashboard } from "@/components/workspace/dashboard";

// Workspace data loads in the browser, so the shell shows a skeleton until it arrives.
export const instant = false;

export const metadata: Metadata = { title: "โปรเจกต์ทั้งหมด" };

export default function WorkspacePage() {
  return <Dashboard />;
}
