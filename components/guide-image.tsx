"use client";

import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/cloud";
import type { Frame } from "@/lib/guide-core";

/** Shows a frame image: base64 for new images, a signed Storage URL for uploaded ones. */
export function GuideImage({ frame, alt, className, fallback = null }: {
  frame: Pick<Frame, "image" | "_imagePath">;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const path = frame.image ? undefined : frame._imagePath;
  const [resolved, setResolved] = useState<{ path: string; url: string } | null>(null);

  useEffect(() => {
    if (!path) return;
    let live = true;
    signedUrl(path).then((url) => live && setResolved({ path, url }), () => {});
    return () => { live = false; };
  }, [path]);

  const src = frame.image || (resolved && resolved.path === path ? resolved.url : "");
  if (!src) return path ? <div className={className} aria-busy="true" /> : fallback;
  // eslint-disable-next-line @next/next/no-img-element -- signed/base64 URLs; next/image adds nothing here
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />;
}
