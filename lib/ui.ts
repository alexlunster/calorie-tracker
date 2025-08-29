// lib/ui.ts

/** Convert ugly_text_with_underscores → "ugly text with underscores" */
export function pretty(label: string | null | undefined): string {
  if (!label) return "";
  return label.replaceAll("_", " ");
}
