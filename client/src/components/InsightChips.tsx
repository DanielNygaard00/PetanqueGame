import type { Insight } from "../stats/insights";
const TONE: Record<string, string> = { good: "bg-olive/15 text-olive", bad: "bg-bordeaux/10 text-bordeaux", neutral: "bg-ink/5 text-ink/70" };
export function InsightChips({ items }: { items: Insight[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i, idx) => (
        <span key={idx} className={`rounded-full px-3 py-1 text-sm ${TONE[i.tone ?? "neutral"]}`}>{i.text}</span>
      ))}
    </div>
  );
}
