// client/src/pages/DashboardPage.tsx
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useMatches } from "../api/hooks";
import { deriveStats } from "../stats/derive";
import { StatCard } from "../ui/StatCard";
import { Card } from "../ui/Card";
import { MatchCard } from "../components/MatchCard";

export function DashboardPage() {
  const { data = [], isLoading } = useMatches();
  if (isLoading) return <p>Henter…</p>;
  const s = deriveStats(data);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Sejrsrate" value={`${s.winRate.toFixed(0)}%`} hint={`${s.wins}/${s.total} kampe`} />
        <StatCard label="Point i alt" value={s.totalPoints} />
        <StatCard label="Længste stime" value={s.longestStreak} hint="sejre i træk" />
        <StatCard label="Kampe" value={s.total} />
      </div>

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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-lg">Topbaner</h3>
          <ul className="space-y-1 text-sm">{s.topArenas.map((a) => <li key={a.name} className="flex justify-between"><span>{a.name}</span><span className="text-ink/50">{a.count}</span></li>)}</ul>
        </Card>
        <Card>
          <h3 className="mb-2 text-lg">Mest loggede drikke</h3>
          <ul className="space-y-1 text-sm">{s.topDrinks.map((d) => <li key={d.name} className="flex justify-between"><span>🍷 {d.name}</span><span className="text-ink/50">{d.count}</span></li>)}</ul>
        </Card>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg">Seneste kampe</h3>
          <Link to="/matches" className="text-sm text-terracotta">Se alle</Link>
        </div>
        <div className="space-y-3">{data.slice(0, 5).map((m) => <MatchCard key={m.id} m={m} />)}</div>
      </div>
    </div>
  );
}
