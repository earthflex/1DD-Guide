/**
 * Step descriptions with bold, italic and links, stored as plain text so the data format stays the same:
 * `**bold**`, `*italic*`, `[text](https://…)`, and `\*` `\[` `\]` `\\` for the literal characters.
 * Newlines are kept as "\n". Only http(s) and mailto links are recognised; anything else stays text.
 *
 * Marker rules (the viewer runtime in lib/viewer/source.ts has the same parser, keep them in sync):
 * - A run of asterisks first closes open marks from the top (italic = 1, bold = 2), then opens new ones
 *   (1 = italic, 2 = bold, 3 = bold + italic). Bold always sits outside italic.
 * - A run only closes after a non-space character and only opens before one, so "* item" stays literal.
 * - Marks still open at the end are closed there.
 */
type Mark = "b" | "i";

const escapeHTML = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const ESCAPABLE = "\\*[]";
/** `[text](url)` at the start of a string; the text may hold escapes, the URL no spaces or ")". */
export const LINK_RE = /^\[((?:\\.|[^\]\\\n])+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/;
const unescape = (s: string) => s.replace(/\\(.)/g, (m, c: string) => (ESCAPABLE.includes(c) ? c : m));

type Out = { text(s: string): void; open(m: Mark): void; close(m: Mark): void; link(text: string, url: string): void };

function walk(md: string, out: Out) {
  const stack: Mark[] = [];
  let i = 0;
  while (i < md.length) {
    const c = md[i];
    if (c === "\\" && ESCAPABLE.includes(md[i + 1])) { out.text(md[i + 1]); i += 2; continue; }
    if (c === "[") {
      const m = LINK_RE.exec(md.slice(i));
      if (m) { out.link(unescape(m[1]), m[2]); i += m[0].length; continue; }
      out.text("[");
      i++;
      continue;
    }
    if (c !== "*") {
      let j = i + 1;
      while (j < md.length && md[j] !== "*" && md[j] !== "\\" && md[j] !== "[") j++;
      out.text(md.slice(i, j));
      i = j;
      continue;
    }
    let j = i;
    while (md[j] === "*") j++;
    let n = j - i;
    const canClose = i > 0 && !/\s/.test(md[i - 1]);
    const canOpen = j < md.length && !/\s/.test(md[j]);
    while (canClose && stack.length) {
      const top = stack[stack.length - 1], need = top === "b" ? 2 : 1;
      if (n < need) break;
      out.close(stack.pop()!);
      n -= need;
    }
    if (canOpen && n >= 1 && n <= 3) {
      if (n >= 2 && !stack.includes("b")) { stack.push("b"); out.open("b"); n -= 2; }
      if (n === 1 && !stack.includes("i")) { stack.push("i"); out.open("i"); n -= 1; }
    }
    if (n > 0) out.text("*".repeat(n));
    i = j;
  }
  while (stack.length) out.close(stack.pop()!);
}

const TAG = { b: "strong", i: "em" } as const;

/** Escaped HTML with <strong>/<em>/<a>; newlines stay "\n". `newTab` opens links in a new tab (reader). */
export function richHTML(md: string, newTab = false) {
  let html = "";
  const target = newTab ? ' target="_blank" rel="noopener noreferrer"' : "";
  walk(md, {
    text: (s) => { html += escapeHTML(s); },
    open: (m) => { html += `<${TAG[m]}>`; },
    close: (m) => { html += `</${TAG[m]}>`; },
    link: (text, url) => { html += `<a href="${escapeHTML(url)}"${target}>${escapeHTML(text)}</a>`; },
  });
  return html;
}

/** The text without markers, e.g. for labels. */
export function richPlain(md: string) {
  let text = "";
  walk(md, { text: (s) => { text += s; }, open: () => {}, close: () => {}, link: (s) => { text += s; } });
  return text;
}

export const richEscape = (s: string) => s.replace(/[\\*[\]]/g, (c) => "\\" + c);

/** A link target the format accepts, or "" (adds https:// to a bare domain). */
export function linkURL(raw: string) {
  const v = raw.trim();
  if (!v) return "";
  const url = /^mailto:/i.test(v) ? v : /^https?:\/\//i.test(v) ? v : "https://" + v;
  try {
    const u = new URL(url);
    if (!["http:", "https:", "mailto:"].includes(u.protocol)) return "";
    return u.href.replace(/[\s)]/g, (c) => encodeURIComponent(c));
  } catch {
    return "";
  }
}

/** Old steps had a separate title: show it as a bold first line of the one description field. */
export function mergeTitle(title: string, text: string) {
  const t = title.trim();
  return t ? `**${richEscape(t)}**${text ? "\n" + text : ""}` : text;
}

type Run = { text: string; b: boolean; i: boolean; href?: string };

/** Read a contenteditable element back into the stored format. */
export function richFromDOM(root: HTMLElement) {
  const runs: Run[] = [];
  const push = (text: string, b: boolean, i: boolean, href?: string) => {
    const last = runs[runs.length - 1];
    if (last && !href && !last.href && last.b === b && last.i === i) last.text += text;
    else runs.push({ text, b, i, href });
  };
  const visit = (node: Node, b: boolean, i: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) return push((node.textContent ?? "").replace(/ /g, " "), b, i);
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName;
    if (tag === "BR") return node === root.lastChild ? undefined : push("\n", b, i);
    const block = tag === "DIV" || tag === "P";
    // Chrome wraps lines in <div>s: each one starts a new line.
    if (block && runs.length && !runs[runs.length - 1].text.endsWith("\n")) push("\n", b, i);
    const weight = node.style.fontWeight, style = node.style.fontStyle;
    const nb = tag === "B" || tag === "STRONG" || weight === "bold" || Number(weight) >= 600 ? true : weight === "normal" || (weight !== "" && Number(weight) < 600) ? false : b;
    const ni = tag === "I" || tag === "EM" || style === "italic" ? true : style === "normal" ? false : i;
    // A link is kept whole: its text (formatting inside it is dropped) and a checked URL.
    const href = tag === "A" ? linkURL(node.getAttribute("href") ?? "") : "";
    if (href && node.textContent?.trim()) return push((node.textContent ?? "").replace(/\u00a0/g, " "), nb, ni, href);
    node.childNodes.forEach((child) => visit(child, nb, ni));
  };
  root.childNodes.forEach((child) => visit(child, false, false));

  // Markers hug the words: closes go right after the previous word, opens right before the next one,
  // and whitespace in between is written outside both, so the parser's flanking rules always hold.
  const stack: Mark[] = [];
  let md = "", pending = "";
  for (const run of runs) {
    // A link is one word for the markers; whitespace around its text moves outside the brackets.
    const parts = run.href
      ? (({ 1: lead, 2: core, 3: trail }) => [lead, `[${richEscape(core)}](${run.href})`, trail].filter(Boolean))(/^(\s*)([\s\S]*?)(\s*)$/.exec(run.text)!)
      : run.text.match(/\s+|\S+/g) ?? [];
    for (const part of parts) {
      if (/^\s/.test(part)) { pending += part; continue; }
      const target: Mark[] = [...(run.b ? ["b" as const] : []), ...(run.i ? ["i" as const] : [])];
      let keep = 0;
      while (keep < stack.length && stack[keep] === target[keep]) keep++;
      let closes = "";
      while (stack.length > keep) closes += stack.pop() === "b" ? "**" : "*";
      let opens = "";
      for (const m of target.slice(keep)) { opens += m === "b" ? "**" : "*"; stack.push(m); }
      md += closes + pending + opens + (run.href ? part : richEscape(part));
      pending = "";
    }
  }
  while (stack.length) md += stack.pop() === "b" ? "**" : "*";
  return md + pending;
}
