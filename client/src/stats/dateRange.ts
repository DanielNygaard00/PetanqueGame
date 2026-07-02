import type { Match } from "../api/types";
export type RangePreset = "all" | "year" | "30d";
export function filterByRange(matches: Match[], preset: RangePreset, now: Date): Match[] {
  if (preset === "all") return matches;
  if (preset === "year") {
    const y = String(now.getFullYear());
    return matches.filter((m) => (m.Dato ?? "").slice(0, 4) === y);
  }
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const nowStr = now.toISOString().slice(0, 10);
  return matches.filter((m) => { const d = m.Dato ?? ""; return d >= cutoffStr && d <= nowStr; });
}
