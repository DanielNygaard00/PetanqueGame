import type { Match } from "../api/types";
export type RangePreset = "all" | "year" | "30d";
export function ymd(d: Date): string {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function filterByRange(matches: Match[], preset: RangePreset, now: Date): Match[] {
  if (preset === "all") return matches;
  if (preset === "year") {
    const y = String(now.getFullYear());
    return matches.filter((m) => (m.Dato ?? "").slice(0, 4) === y);
  }
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = ymd(cutoff);
  const nowStr = ymd(now);
  return matches.filter((m) => { const d = m.Dato ?? ""; return d >= cutoffStr && d <= nowStr; });
}
