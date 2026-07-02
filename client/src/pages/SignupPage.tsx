import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

export function SignupPage() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [email, setE] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try { await signup(username, password, email, code); nav("/"); }
    catch (err: any) { setError(err?.response?.data?.message ?? "Kunne ikke oprette bruger"); }
  }

  return (
    <AuthLayout title="Opret bruger">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Brugernavn" value={username} onChange={(e) => setU(e.target.value)} />
        <Input label="Email (valgfri)" value={email} onChange={(e) => setE(e.target.value)} />
        <Input label="Adgangskode (valgfri)" type="password" value={password} onChange={(e) => setP(e.target.value)} />
        <Input label="Tilmeldingskode" value={code} onChange={(e) => setCode(e.target.value)} />
        {error && <p className="text-sm text-bordeaux">{error}</p>}
        <Button type="submit" className="w-full">Opret</Button>
        <p className="text-sm text-ink/60">Har du en bruger? <Link className="text-terracotta" to="/login">Log ind</Link></p>
      </form>
    </AuthLayout>
  );
}
