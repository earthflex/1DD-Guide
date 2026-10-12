/** Only allow same-site relative redirects (blocks //evil.com and absolute URLs). */
export function safeNext(value: string | null | undefined, fallback = "/workspaces") {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}
