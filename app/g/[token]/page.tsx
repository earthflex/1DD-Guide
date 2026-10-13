import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicGuide } from "./public-guide";

export const metadata: Metadata = { title: "คู่มือ", robots: { index: false, follow: false } };

// The guide loads in the browser through the public read RPC.
export const instant = false;

export default function PublicGuidePage() {
  return (
    <Suspense>
      <PublicGuide />
    </Suspense>
  );
}
