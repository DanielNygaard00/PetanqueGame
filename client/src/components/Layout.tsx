// client/src/components/Layout.tsx
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../ui/Button";

export function Layout() {
  const { logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-ink/10 bg-cream/80 px-6 py-4 backdrop-blur">
        <Link to="/" className="font-display text-2xl text-terracotta">Pétanque · Apéro</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/" className="hover:text-terracotta">Oversigt</Link>
          <Link to="/matches" className="hover:text-terracotta">Kampe</Link>
          <Link to="/rankings" className="hover:text-terracotta">Rangliste</Link>
          <Link to="/roster" className="hover:text-terracotta">Spillere</Link>
          <Link to="/matches/new"><Button>Log kamp</Button></Link>
          <Button variant="ghost" onClick={() => { logout(); nav("/login"); }}>Log ud</Button>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8"><Outlet /></main>
    </div>
  );
}
