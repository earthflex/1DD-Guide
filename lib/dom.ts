/**
 * First matching element that is actually shown. Next.js keeps recently visited routes mounted but
 * hidden (React Activity), so the same editor can exist twice in the DOM with identical ids.
 */
export function visible<T extends Element = HTMLElement>(selector: string): T | null {
  for (const el of document.querySelectorAll<T>(selector)) {
    if (el.checkVisibility ? el.checkVisibility() : (el as unknown as HTMLElement).offsetParent !== null) return el;
  }
  return null;
}
