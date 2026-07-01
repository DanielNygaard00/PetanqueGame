import React from "react";
import { Card } from "./Card";

export function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm uppercase tracking-wide text-ink/60">{label}</span>
      <span className="font-display text-3xl text-terracotta">{value}</span>
      {hint && <span className="text-xs text-ink/50">{hint}</span>}
    </Card>
  );
}
