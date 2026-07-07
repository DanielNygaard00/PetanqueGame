// client/src/pages/DashboardPage.tsx
import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useMatches } from "../api/hooks";
import { deriveStats } from "../stats/derive";
import { filterByRange, type RangePreset } from "../stats/dateRange";
import { deriveInsights } from "../stats/insights";
import { headToHead } from "../stats/headToHead";
import { StatCard } from "../ui/StatCard";
import { Card } from "../ui/Card";
import { MatchCard } from "../components/MatchCard";
import { InsightsBar } from "../components/InsightsBar";
import { InsightChips } from "../components/InsightChips";
import { useAuth } from "../auth/AuthContext";
import { playerDrinkStats } from "../stats/drinkStats";
import { SkeletonCards } from "../ui/Skeleton";

const TIME_LABELS: Record<string, string> = { morning: "Morgen (5–11)", afternoon: "Eftermiddag (12–16)", evening: "Aften (17–21)", night: "Nat (22–4)", unknown: "Ukendt tid" };

export function DashboardPage() {
  const { data = [], isLoading } = useMatches();
  const { user } = useAuth();

  const players = useMemo(() => {
    const names = new Set<string>();
    for (const m of data) for (const t of m.teams ?? []) for (const p of t.players) names.add(p.name);
    return Array.from(names).sort();
  }, [data]);

  const [player, setPlayer] = useState<string>("");
  useEffect(() => {
    if (!player && players.length) setPlayer(players.includes(user?.username ?? "") ? user!.username : players[0]);
  }, [players, player, user]);

  const [range, setRange] = useState<RangePreset>("all");
  const scoped = useMemo(() => filterByRange(data, range, new Date()), [data, range]);
  const s = useMemo(() => deriveStats(scoped, player), [scoped, player]);
  const insights = useMemo(() => deriveInsights(scoped, player), [scoped, player]);
  const h2h = useMemo(() => (player ? headToHead(scoped, player) : []), [scoped, player]);
  const drinkers = useMemo(() => playerDrinkStats(scoped), [scoped]);

  if (isLoading) return <SkeletonCards count={4} />;

  return (
    <div className="space-y-6">
      {/* Filters: player + date range */}
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="player-filter" className="text-sm font-medium text-ink/70">
          Spiller
        </label>
        <select
          id="player-filter"
          value={player}
          onChange={(e) => setPlayer(e.target.value)}
          className="w-full rounded-card border border-ink/10 bg-white/70 px-3 py-1.5 text-sm text-ink shadow-card focus:outline-none focus:ring-2 focus:ring-terracotta/40 sm:w-auto"
        >
          {players.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <label htmlFor="range-filter" className="text-sm font-medium text-ink/70">
          Periode
        </label>
        <select
          id="range-filter"
          value={range}
          onChange={(e) => setRange(e.target.value as RangePreset)}
          className="w-full rounded-card border border-ink/10 bg-white/70 px-3 py-1.5 text-sm text-ink shadow-card focus:outline-none focus:ring-2 focus:ring-terracotta/40 sm:w-auto"
        >
          <option value="all">Alt</option>
          <option value="year">I år</option>
          <option value="30d">Seneste 30 dage</option>
        </select>
      </div>

      {/* Insight chips */}
      <InsightChips items={insights} />

      {/* v1 stat cards + totalDrinks */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Sejrsrate" value={`${s.winRate.toFixed(0)}%`} hint={`${s.wins}/${s.total} kampe`} />
        <StatCard label="Point i alt" value={s.totalPoints} />
        <StatCard label="Længste stime" value={s.longestStreak} hint="sejre i træk" />
        <StatCard label="Kampe" value={s.total} />
        <StatCard label="Drikke i alt" value={s.totalDrinks} hint="enheder" />
      </div>

      {/* Head-to-head (only when h2h has rows) */}
      {h2h.length > 0 && (
        <Card>
          <h3 className="mb-3 text-lg">Head-to-head</h3>

          {/* Desktop table */}
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="text-left text-ink/50">
                <th className="pb-1 font-normal">Modstander</th>
                <th className="pb-1 font-normal text-right">V–T</th>
                <th className="pb-1 font-normal text-right">Sejrsrate</th>
                <th className="pb-1 font-normal text-right">Avg margin</th>
              </tr>
            </thead>
            <tbody>
              {h2h.map((row) => (
                <tr key={row.opponent} className="border-t border-ink/5">
                  <td className="py-1">{row.opponent}</td>
                  <td className="py-1 text-right">{row.wins}–{row.losses}</td>
                  <td className="py-1 text-right">{row.winRate.toFixed(0)}%</td>
                  <td className="py-1 text-right">{row.avgMargin >= 0 ? "+" : ""}{row.avgMargin.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile card list */}
          <div className="space-y-2 md:hidden">
            {h2h.map((row) => (
              <div key={row.opponent} className="rounded-card border border-ink/10 bg-white/60 px-4 py-3">
                <div className="font-medium">{row.opponent}</div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-ink/70">
                  <span>V–T: {row.wins}–{row.losses}</span>
                  <span>Sejrsrate: {row.winRate.toFixed(0)}%</span>
                  <span>Margin: {row.avgMargin >= 0 ? "+" : ""}{row.avgMargin.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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

      {/* Drink stats */}
      <Card>
        <h3 className="mb-3 font-display text-lg">Hvem drikker mest</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink/50">
              <th className="pb-1 font-normal">Spiller</th>
              <th className="pb-1 font-normal text-right">Enheder</th>
              <th className="pb-1 font-normal text-right">Liter</th>
              <th className="pb-1 font-normal text-right">Pr. kamp</th>
            </tr>
          </thead>
          <tbody>
            {drinkers.map((d) => (
              <tr key={d.name} className="border-t border-ink/5">
                <td className="py-1">{d.name}</td>
                <td className="py-1 text-right">{d.units}</td>
                <td className="py-1 text-right">{d.litres.toFixed(1)}</td>
                <td className="py-1 text-right">{d.unitsPerGame.toFixed(1)}</td>
              </tr>
            ))}
            {drinkers.length === 0 && <tr><td className="py-1 text-ink/40" colSpan={4}>Ingen data endnu</td></tr>}
          </tbody>
        </table>
      </Card>

      {/* Recent matches */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg">Seneste kampe</h3>
          <Link to="/matches" className="text-sm text-terracotta">Se alle</Link>
        </div>
        <div className="space-y-3">
          {scoped.slice(0, 5).map((m) => <MatchCard key={m.id} m={m} />)}
        </div>
      </div>
    </div>
  );
}
