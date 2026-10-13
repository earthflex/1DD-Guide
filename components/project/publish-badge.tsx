"use client";

import { Globe, Lock } from "lucide-react";
import type { Project } from "@/lib/guide-core";
import { usePublication } from "@/lib/publications";
import { openDialog } from "@/lib/ui";
import { cn } from "@/lib/utils";

/**
 * Corner status of a project's public link: published (green), with a lock when it needs a password,
 * or amber when the project changed after the last publish. Opens the publish panel.
 */
export function PublishBadge({ project, className }: { project: Project; className?: string }) {
  const pub = usePublication(project.id);
  if (!pub) return null;
  const stale = Date.parse(project.updatedAt) > Date.parse(pub.updatedAt) + 5000;
  const label = stale ? "เผยแพร่แล้ว · มีแก้ไขใหม่" : "เผยแพร่อยู่";
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openDialog({ kind: "publish", pid: project.id }); }}
      title={stale ? "แก้ไขหลังเผยแพร่ ลูกค้ายังเห็นฉบับเดิม กดเพื่ออัปเดตลิงก์" : pub.hasPassword ? "ลิงก์คู่มือต้องใส่รหัสผ่าน" : "ใครมีลิงก์ก็เปิดอ่านได้"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium shadow-sm backdrop-blur transition-colors",
        stale ? "border-amber-300 bg-amber-50/95 text-amber-800 hover:bg-amber-100" : "border-emerald-300 bg-emerald-50/95 text-emerald-800 hover:bg-emerald-100",
        className,
      )}
    >
      {pub.hasPassword ? <Lock className="size-3" /> : <Globe className="size-3" />}{label}
    </button>
  );
}
