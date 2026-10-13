import type { Metadata } from "next";
import { MembersPage } from "@/components/members/members-page";

// Workspace data loads in the browser, so the shell shows a skeleton until it arrives.
export const instant = false;

export const metadata: Metadata = { title: "สมาชิก" };

export default function Members() {
  return <MembersPage />;
}
