// lib/ui.ts
/** Convert ugly_text_with_underscores → "ugly text with underscores" */
export function pretty(label: string | null | undefined): string {
  if (!label) return "";
  return label.replace(/_/g, " "); // compatible with older TS targets
}

/** Clamp a number between 0..100 */
export function pct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}
