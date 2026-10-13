"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Password field with a show/hide toggle inside the input. `revealed` makes the toggle controlled. */
export function PasswordInput({ className, revealed, onRevealedChange, ...props }: Omit<React.ComponentProps<"input">, "type"> & {
  revealed?: boolean;
  onRevealedChange?: (v: boolean) => void;
}) {
  const [own, setOwn] = useState(false);
  const visible = revealed ?? own;
  const setVisible = (v: boolean) => { setOwn(v); onRevealedChange?.(v); };
  const label = visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน";
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-11", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {visible ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
      </button>
    </div>
  );
}
