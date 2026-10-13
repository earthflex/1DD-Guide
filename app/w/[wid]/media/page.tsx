import type { Metadata } from "next";
import { MediaLibrary } from "@/components/media/media-library";

// Workspace data loads in the browser, so the shell shows a skeleton until it arrives.
export const instant = false;

export const metadata: Metadata = { title: "คลังไฟล์" };

export default function MediaPage() {
  return <MediaLibrary />;
}
