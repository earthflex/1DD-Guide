import type { Metadata } from "next";
import { SystemOverview } from "./system-overview";

export const metadata: Metadata = { title: "ภาพรวมระบบ" };

export default function SystemPage() {
  return <SystemOverview />;
}
