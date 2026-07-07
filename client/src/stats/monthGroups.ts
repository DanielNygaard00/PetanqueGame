// client/src/stats/monthGroups.ts
import type { Match } from "../api/types";
import { matchPerspective } from "./perspective";

export type MonthGroup = { key: string; label: string; matches: Match[]; wins: number; participated: boolean };

export function groupMatchesByMonth(matches: Match[], username?: string): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const m of matches) {
    const key = m.Dato ? m.Dato.slice(0, 7) : "unknown";
    let g = groups.get(key);
    if (!g) {
      const label = key === "unknown"
        ? "Uden dato"
        : new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)
            .toLocaleDateString("da-DK", { month: "long", year: "numeric" });
      g = { key, label, matches: [], wins: 0, participated: false };
      groups.set(key, g);
    }
    g.matches.push(m);
    if (username) {
      const p = matchPerspective(m, username);
      if (p) {
        g.participated = true;
        if (p.won) g.wins++;
      }
    }
  }
  const list = [...groups.values()];
  return [...list.filter((g) => g.key !== "unknown"), ...list.filter((g) => g.key === "unknown")];
}
