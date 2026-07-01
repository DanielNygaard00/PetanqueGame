import React from "react";

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`bg-white/70 rounded-card shadow-card p-5 ${className}`}>{children}</div>;
}
