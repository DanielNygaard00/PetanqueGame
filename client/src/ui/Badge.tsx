import React from "react";

const TONES = {
  win: "bg-gold text-ink",
  loss: "bg-bordeaux text-cream",
  group: "bg-olive text-cream",
  streak: "bg-terracotta text-cream",
} as const;

export function Badge({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}
