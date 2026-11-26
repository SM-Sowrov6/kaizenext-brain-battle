type ClassValue = string | number | bigint | boolean | null | undefined | ClassValue[]

/** Tiny className joiner — avoids pulling in clsx/tailwind-merge. */
export function cn(...values: ClassValue[]): string {
  const out: string[] = []
  for (const v of values) {
    if (!v || v === true) continue
    if (Array.isArray(v)) out.push(cn(...v))
    else out.push(String(v))
  }
  return out.join(' ')
}
