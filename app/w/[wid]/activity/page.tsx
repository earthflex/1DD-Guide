import type { Metadata } from "next";
import { ActivityPage } from "@/components/activity/activity-page";

// Workspace data loads in the browser, so the shell shows a skeleton until it arrives.
export const instant = false;

export const metadata: Metadata = { title: "กิจกรรม" };

export default function Activity() {
  return <ActivityPage />;
}
