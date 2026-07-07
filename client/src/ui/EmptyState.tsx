// client/src/ui/EmptyState.tsx
import { Link } from "react-router-dom";
import { Card } from "./Card";
import { Button } from "./Button";

type Props = { emoji: string; title: string; hint?: string; cta?: { label: string; to: string } };

export function EmptyState({ emoji, title, hint, cta }: Props) {
  return (
    <Card className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="text-4xl">{emoji}</span>
      <h3 className="font-display text-xl">{title}</h3>
      {hint && <p className="text-sm text-ink/60">{hint}</p>}
      {cta && <Link to={cta.to} className="mt-2"><Button type="button">{cta.label}</Button></Link>}
    </Card>
  );
}
