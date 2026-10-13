import type { Metadata } from "next";
import { Dashboard } from "@/components/workspace/dashboard";

export const metadata: Metadata = { title: "โปรเจกต์ทั้งหมด" };

export default function WorkspacePage() {
  return <Dashboard />;
}
