// client/src/pages/DashboardPage.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useMatches } from "../api/hooks";
import { deriveStats } from "../stats/derive";
import { StatCard } from "../ui/StatCard";
import { Card } from "../ui/Card";
import { MatchCard } from "../components/MatchCard";
import { InsightsBar } from "../components/InsightsBar";

const TIME_LABELS: Record<string, string> = { morning: "Morgen (5–11)", afternoon: "Eftermiddag (12–16)", evening: "Aften (17–21)", night: "Nat (22–4)", unknown: "Ukendt tid" };

export function DashboardPage() {
  const { data = [], isLoading } = useMatches();

  const [player, setPlayer] = useState("Alle");
  const players = useMemo(
    () => ["Alle", ...Array.from(new Set(data.map((m) => (m.Spiller ?? "").trim()).filter(Boolean)))],
    [data],
  );
  const filtered = player === "Alle" ? data : data.filter((m) => (m.Spiller ?? "").trim() === player);
  const s = deriveStats(filtered);

  if (isLoading) return <p>Henter…</p>;

  return (
    <div className="space-y-6">
      {/* Player filter */}
      <div className="flex items-center gap-3">
        <label htmlFor="player-filter" className="text-sm font-medium text-ink/70">
          Spiller
        </label>
        <select
          id="player-filter"
          value={player}
          onChange={(e) => setPlayer(e.target.value)}
          className="rounded-card border border-ink/10 bg-white/70 px-3 py-1.5 text-sm text-ink shadow-card focus:outline-none focus:ring-2 focus:ring-terracotta/40"
        >
          {players.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* v1 stat cards + totalDrinks */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Sejrsrate" value={`${s.winRate.toFixed(0)}%`} hint={`${s.wins}/${s.total} kampe`} />
        <StatCard label="Point i alt" value={s.totalPoints} />
        <StatCard label="Længste stime" value={s.longestStreak} hint="sejre i træk" />
        <StatCard label="Kampe" value={s.total} />
        <StatCard label="Drikke i alt" value={s.totalDrinks} hint="enheder" />
      </div>

      {/* Points over time */}
      <Card>
        <h3 className="mb-3 text-lg">Point over tid</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={s.pointsOverTime}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="points" stroke="#C65D3B" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Sober-vs-tipsy */}
      <Card>
        <h3 className="mb-3 font-display text-lg">Ædru vs. festlig</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={s.byUnitsBucket}>
            <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} unit="%" />
            <Tooltip formatter={(v) => (typeof v === "number" ? `${v.toFixed(0)}%` : v)} />
            <Bar dataKey="winRate" name="Sejrsrate" fill="#C65D3B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-ink/50">
              <th className="pb-1 font-normal">Enheder</th>
              <th className="pb-1 font-normal text-right">Kampe</th>
              <th className="pb-1 font-normal text-right">Sejrsrate</th>
              <th className="pb-1 font-normal text-right">Avg margin</th>
            </tr>
          </thead>
          <tbody>
            {s.byUnitsBucket.map((row) => (
              <tr key={row.bucket} className="border-t border-ink/5">
                <td className="py-1">{row.bucket}</td>
                <td className="py-1 text-right">{row.games}</td>
                <td className="py-1 text-right">{row.winRate.toFixed(0)}%</td>
                <td className="py-1 text-right">{row.avgMargin >= 0 ? "+" : ""}{row.avgMargin.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* InsightsBar lists */}
      <div className="grid gap-4 md:grid-cols-2">
        <InsightsBar title="Sejrsrate efter tidspunkt" rows={s.byTimeOfDay.map((r) => ({ ...r, key: TIME_LABELS[r.key] ?? r.key }))} />
        <InsightsBar title="Sejrsrate efter ugedag" rows={s.byWeekday} />
        <InsightsBar title="Bedste baner" rows={s.byArena} />
        <InsightsBar title="Modstandere" rows={s.byOpponent} />
      </div>

      {/* Top arenas + top drinks (v1) */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-lg">Topbaner</h3>
          <ul className="space-y-1 text-sm">
            {s.topArenas.map((a) => (
              <li key={a.name} className="flex justify-between">
                <span>{a.name}</span>
                <span className="text-ink/50">{a.count}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3 className="mb-2 text-lg">Mest loggede drikke</h3>
          <ul className="space-y-1 text-sm">
            {s.topDrinks.map((d) => (
              <li key={d.name} className="flex justify-between">
                <span>🍷 {d.name}</span>
                <span className="text-ink/50">{d.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Consumption by month */}
      <Card>
        <h3 className="mb-3 font-display text-lg">Forbrug pr. måned</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={s.consumptionByMonth}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="units" name="Enheder" fill="#6B7A4F" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Top drinks by units */}
      <Card>
        <h3 className="mb-3 font-display text-lg">Top drikke efter enheder</h3>
        <ul className="space-y-2 text-sm">
          {s.topDrinksByUnits.length === 0 && (
            <li className="text-ink/40">Ingen data endnu</li>
          )}
          {s.topDrinksByUnits.map((d) => (
            <li key={d.name} className="flex items-center justify-between">
              <span>{d.name}</span>
              <span className="rounded-full bg-terracotta/10 px-2 py-0.5 text-xs font-medium text-terracotta">
                {d.units} enheder
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Recent matches */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg">Seneste kampe</h3>
          <Link to="/matches" className="text-sm text-terracotta">Se alle</Link>
        </div>
        <div className="space-y-3">
          {filtered.slice(0, 5).map((m) => <MatchCard key={m.id} m={m} />)}
        </div>
      </div>
    </div>
  );
}
