"use client";

import { Pencil } from "lucide-react";

/** Text that saves on blur/Enter and reverts on Escape, like the legacy inline inputs. */
export function InlineInput({ value, onCommit, className, ...props }: Omit<React.ComponentProps<"input">, "value" | "defaultValue"> & {
  value: string; onCommit: (v: string) => boolean;
}) {
  return (
    <span className="group/inline relative flex min-w-0 flex-1 items-center">
      <input
        key={value}
        defaultValue={value}
        onBlur={(e) => { if (e.target.value.trim() !== value && !onCommit(e.target.value)) e.target.value = value; }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === "Escape") { e.currentTarget.value = value; e.currentTarget.blur(); }
        }}
        className={`w-full min-w-0 truncate rounded-md bg-transparent px-1.5 py-0.5 -mx-1.5 outline-none hover:bg-muted focus:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 ${className ?? ""}`}
        {...props}
      />
      <Pencil className="pointer-events-none absolute right-0 size-3 text-muted-foreground opacity-0 group-hover/inline:opacity-100" />
    </span>
  );
}
