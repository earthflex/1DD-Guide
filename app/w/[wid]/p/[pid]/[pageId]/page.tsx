import type { Metadata } from "next";
import { Editor } from "@/components/editor/editor";

// Workspace data loads in the browser, so the shell shows a skeleton until it arrives.
export const instant = false;

export const metadata: Metadata = { title: "แก้ไขคู่มือ" };

export default function EditorPage() {
  return <Editor />;
}
