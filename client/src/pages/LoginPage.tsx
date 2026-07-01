import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try { await login(username, password); nav("/"); }
    catch { setError("Forkert brugernavn eller adgangskode"); }
  }

  return (
    <AuthLayout title="Log ind">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Brugernavn" value={username} onChange={(e) => setU(e.target.value)} />
        <Input label="Adgangskode" type="password" value={password} onChange={(e) => setP(e.target.value)} />
        {error && <p className="text-sm text-bordeaux">{error}</p>}
        <Button type="submit" className="w-full">Log ind</Button>
        <p className="text-sm text-ink/60">Ny her? <Link className="text-terracotta" to="/signup">Opret bruger</Link></p>
      </form>
    </AuthLayout>
  );
}
