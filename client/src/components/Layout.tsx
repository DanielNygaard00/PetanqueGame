// client/src/components/Layout.tsx
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../ui/Button";

const NAV = [
  { to: "/", label: "Oversigt" },
  { to: "/matches", label: "Kampe" },
  { to: "/matches/new", label: "Log" },
  { to: "/rankings", label: "Rangliste" },
  { to: "/roster", label: "Spillere" },
];

export function Layout() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <header className="flex items-center justify-between border-b border-ink/10 bg-cream/80 px-4 py-3 backdrop-blur md:px-6 md:py-4">
        <Link to="/" className="font-display text-xl text-terracotta md:text-2xl">Pétanque · Apéro</Link>
        <nav className="hidden items-center gap-4 text-sm md:flex">
          {NAV.map((n) => <Link key={n.to} to={n.to} className="hover:text-terracotta">{n.label}</Link>)}
          <Button variant="ghost" onClick={() => { logout(); nav("/login"); }}>Log ud</Button>
        </nav>
        <Button variant="ghost" className="md:hidden" onClick={() => { logout(); nav("/login"); }}>Log ud</Button>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8"><Outlet /></main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-ink/10 bg-cream/95 backdrop-blur md:hidden">
        {NAV.map((n) => {
          const isActive = (to: string) => {
            if (to === "/") return pathname === "/";
            if (to === "/matches") return pathname === "/matches" || (pathname.startsWith("/matches/") && !pathname.startsWith("/matches/new"));
            if (to === "/matches/new") return pathname === "/matches/new";
            return pathname.startsWith(to);
          };
          const active = isActive(n.to);
          return (
            <Link key={n.to} to={n.to} className={`flex flex-col items-center min-h-[44px] justify-center py-2 text-xs ${active ? "text-terracotta" : "text-ink/60"}`}>
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
