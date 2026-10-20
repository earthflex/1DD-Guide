"use client";

import { Bold, Italic, Link2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { esc } from "@/lib/guide-core";
import { linkURL, richFromDOM, richHTML } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

const MAX = 10000;
/** Fired on the field by Ctrl / Cmd + K; the FormatButtons for that field open their link box. */
const LINK_EVENT = "rich-text-link";

/**
 * One description field with bold, italic and links (Ctrl/Cmd + B / I / K or the buttons), stored in
 * the plain-text format of lib/rich-text. Paste is plain text (a URL pasted over a selection makes it
 * a link) and Enter is a line break, so the field never holds markup it cannot save.
 */
export function RichTextField({ value, onChange, placeholder, label, className, ...data }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
} & Record<`data-${string}`, string>) {
  const ref = useRef<HTMLDivElement>(null);
  // The value this field last emitted: re-rendering it would move the caret, so only outside changes
  // (undo, another step selected, a teammate's save) are written back into the DOM.
  const own = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || value === own.current) return;
    el.innerHTML = richHTML(value).replace(/\n/g, "<br>");
    own.current = value;
  }, [value]);

  function emit() {
    const el = ref.current!;
    let md = richFromDOM(el);
    if (md.length > MAX) md = md.slice(0, MAX);
    // An emptied field may keep a stray <br>; clear it so the placeholder shows again.
    if (!md.trim() && el.innerHTML) el.innerHTML = "";
    own.current = md;
    onChange(md);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.nativeEvent.isComposing) return;
    const mod = event.metaKey || event.ctrlKey;
    // By key position, so the shortcuts also work while typing with the Thai layout.
    const command = event.code === "KeyB" ? "bold" : event.code === "KeyI" ? "italic" : event.code === "KeyK" ? "link" : null;
    if (mod && command && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      if (command === "link") ref.current?.dispatchEvent(new Event(LINK_EVENT, { bubbles: true }));
      else document.execCommand(command);
    } else if (event.key === "Enter") {
      event.preventDefault();
      document.execCommand("insertLineBreak");
    }
  }

  function onPaste(event: React.ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    const url = /^(https?:\/\/|mailto:)\S+$/i.test(text.trim()) ? linkURL(text) : "";
    if (url && !getSelection()?.isCollapsed) document.execCommand("createLink", false, url);
    else document.execCommand("insertText", false, text);
  }

  return (
    <div
      ref={ref}
      {...data}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      data-placeholder={placeholder}
      tabIndex={0}
      spellCheck
      // execCommand (format, link, line break, paste) fires input too, so every change goes through here.
      onInput={emit}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onDrop={(e) => e.preventDefault()}
      className={cn(
        "min-h-16 w-full cursor-text rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm whitespace-pre-wrap break-words outline-none transition-colors",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&_b]:font-semibold [&_strong]:font-semibold",
        "[&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2",
        "empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
        className,
      )}
    />
  );
}

const closestLink = (node: Node) => (node instanceof Element ? node : node.parentElement)?.closest("a") ?? null;

/** Bold / italic / link buttons for a RichTextField found by `target`. They keep the field's selection. */
export function FormatButtons({ target }: { target: () => HTMLElement | null | undefined }) {
  // The field's selection, saved while the link box has focus and restored to apply the link.
  const [linking, setLinking] = useState<{ range: Range; url: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function format(command: "bold" | "italic") {
    const el = target();
    if (!el) return;
    if (document.activeElement !== el) el.focus();
    document.execCommand(command);
  }

  function openLink() {
    const el = target();
    if (!el) return;
    const sel = getSelection();
    let range: Range;
    if (sel?.rangeCount && el.contains(sel.getRangeAt(0).commonAncestorContainer)) range = sel.getRangeAt(0).cloneRange();
    else { range = document.createRange(); range.selectNodeContents(el); range.collapse(false); }
    const anchor = closestLink(range.startContainer);
    setLinking({ range, url: anchor && el.contains(anchor) ? anchor.getAttribute("href") ?? "" : "" });
  }

  // Ctrl / Cmd + K inside this row's field.
  const open = useRef(openLink);
  useEffect(() => { open.current = openLink; });
  useEffect(() => {
    const onLink = (event: Event) => { if (event.target === target()) open.current(); };
    document.addEventListener(LINK_EVENT, onLink);
    return () => document.removeEventListener(LINK_EVENT, onLink);
  }, [target]);

  function apply(raw: string) {
    const el = target();
    if (!el || !linking) return;
    const url = linkURL(raw);
    el.focus();
    const sel = getSelection()!;
    sel.removeAllRanges();
    sel.addRange(linking.range);
    // Caret inside an existing link: change or remove the whole link.
    const anchor = closestLink(linking.range.startContainer);
    if (anchor && el.contains(anchor) && linking.range.collapsed) sel.selectAllChildren(anchor);
    if (!raw.trim()) document.execCommand("unlink");
    else if (url && sel.isCollapsed) document.execCommand("insertHTML", false, `<a href="${esc(url)}">${esc(url.replace(/^mailto:/, ""))}</a>&nbsp;`);
    else if (url) document.execCommand("createLink", false, url);
    setLinking(null);
  }

  if (linking) {
    return (
      <div className="flex flex-1 items-center gap-1">
        <Input
          ref={input}
          autoFocus
          defaultValue={linking.url}
          placeholder="https://… (เว้นว่างเพื่อเอาลิงก์ออก)"
          aria-label="ลิงก์"
          className="h-7 min-w-0 flex-1 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); apply(e.currentTarget.value); }
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setLinking(null); target()?.focus(); }
          }}
        />
        <Button size="xs" onMouseDown={(e) => e.preventDefault()} onClick={() => apply(input.current?.value ?? "")}>ใส่ลิงก์</Button>
      </div>
    );
  }
  return (
    <div className="flex gap-0.5">
      {([["bold", Bold, "ตัวหนา", "B"], ["italic", Italic, "ตัวเอียง", "I"], ["link", Link2, "ลิงก์", "K"]] as const).map(([command, Icon, name, key]) => (
        <Tooltip key={command}>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon-xs" aria-label={name}
              onMouseDown={(e) => e.preventDefault()} onClick={() => (command === "link" ? openLink() : format(command))}>
              <Icon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{name} (Ctrl / Cmd + {key})</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
