# Frontend Visual Boost (Vite + React + Tailwind) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pétanque app's frontend — a Vite + React + TypeScript + Tailwind single-page app with a "French apéro / terrace" visual identity, covering auth, match list, match entry form, and a stats dashboard, wired to the Worker API.

**Architecture:** SPA under `client/`. React Router for pages; TanStack Query for server state (matches, options, drink hierarchy); an axios instance attaches the JWT and redirects to `/login` on 401/403. react-hook-form + zod for the match form. Recharts for dashboard charts. Builds to `client/dist`, served by the Worker (see backend plan).

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, React Router, TanStack Query, axios, react-hook-form, zod, Recharts, Vitest + React Testing Library + MSW.

## Global Constraints

- Lives in `client/`; production build outputs to `client/dist` (served by the Worker `assets` binding).
- API base is `/api`; the Vite dev server proxies `/api` → `http://localhost:8787` (the Worker).
- JWT is stored in `localStorage` under key `pq_token`; all API calls send `Authorization: Bearer <token>`; a 401/403 clears the token and redirects to `/login`.
- The API speaks Danish keys exactly (see backend spec). The UI may show Danish labels for domain fields.
- Palette (Tailwind tokens): terracotta `#C65D3B`, olive `#6B7A4F`, cream `#F5EFE1`, ink `#2B2622`, steel `#8A8D91`, bordeaux `#7B2D3B`, gold `#D9A441`.
- Fonts: Fraunces (display/headings), Inter (body).
- Routes: `/login`, `/signup`, `/` (dashboard), `/matches`, `/matches/new`, `/matches/:id/edit`.

---

### Task 1: Scaffold Vite app, Tailwind, design tokens, fonts

**Files:**
- Create: `client/package.json`, `client/vite.config.ts`, `client/tsconfig.json`, `client/index.html`
- Create: `client/tailwind.config.ts`, `client/postcss.config.js`, `client/src/index.css`
- Create: `client/src/main.tsx`, `client/src/App.tsx`

**Interfaces:**
- Produces: a running dev app on `:5173` proxying `/api` → `:8787`; Tailwind tokens `bg-cream`, `text-ink`, `text-terracotta`, etc.; font families `font-display` (Fraunces) and `font-sans` (Inter).

- [ ] **Step 1: Create the Vite React TS app and install deps**

```bash
cd client 2>/dev/null || mkdir client && cd client
npm create vite@latest . -- --template react-ts
npm install
npm install react-router-dom @tanstack/react-query axios react-hook-form zod @hookform/resolvers recharts
npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom msw
npx tailwindcss init -p --ts
```

- [ ] **Step 2: Configure the Vite dev proxy and test env**

```typescript
// client/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
```

- [ ] **Step 3: Configure Tailwind tokens**

```typescript
// client/tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        terracotta: "#C65D3B",
        olive: "#6B7A4F",
        cream: "#F5EFE1",
        ink: "#2B2622",
        steel: "#8A8D91",
        bordeaux: "#7B2D3B",
        gold: "#D9A441",
      },
      fontFamily: {
        display: ['"Fraunces"', "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      boxShadow: { card: "0 2px 12px rgba(43, 38, 34, 0.08)" },
      borderRadius: { card: "14px" },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 4: Global styles, fonts, paper-grain background**

```css
/* client/src/index.css */
@import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap");
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { color-scheme: light; }
  body {
    @apply bg-cream text-ink font-sans antialiased;
    background-image: radial-gradient(rgba(43, 38, 34, 0.035) 1px, transparent 1px);
    background-size: 4px 4px;
  }
  h1, h2, h3 { @apply font-display; }
}
```

- [ ] **Step 5: Minimal `App.tsx` and test setup file**

```tsx
// client/src/App.tsx
export default function App() {
  return <h1 className="text-terracotta p-8 text-3xl">Pétanque</h1>;
}
```

```typescript
// client/src/test/setup.ts
import "@testing-library/jest-dom";
```

- [ ] **Step 6: Verify dev server renders**

Run: `npm run dev` and open `http://localhost:5173`.
Expected: "Pétanque" heading in terracotta on a cream, faintly-textured background.

- [ ] **Step 7: Commit**

```bash
git add client/package.json client/package-lock.json client/vite.config.ts client/tailwind.config.ts client/postcss.config.js client/tsconfig.json client/index.html client/src/main.tsx client/src/App.tsx client/src/index.css client/src/test/setup.ts
git commit -m "feat(client): scaffold Vite+React+Tailwind with apéro design tokens"
```

---

### Task 2: API types and axios client with auth interceptor

**Files:**
- Create: `client/src/api/types.ts`
- Create: `client/src/api/client.ts`
- Test: `client/src/api/client.test.ts`

**Interfaces:**
- Produces:
  - `TOKEN_KEY = "pq_token"`, `getToken()`, `setToken(t)`, `clearToken()`.
  - `api` — an axios instance with `baseURL: "/api"`, a request interceptor adding `Authorization`, and a response interceptor that on 401/403 calls `clearToken()` and redirects to `/login`.
  - Types: `Match` (Danish-keyed), `Option = { id: string; name: string }`, `DrinkHierarchy`, `AuthResponse`.

- [ ] **Step 1: Write the failing test**

```typescript
// client/src/api/client.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { api, setToken, getToken, TOKEN_KEY } from "./client";

describe("api client", () => {
  beforeEach(() => localStorage.clear());

  it("attaches the bearer token to requests", async () => {
    setToken("abc123");
    const cfg = await (api.interceptors.request as any).handlers[0].fulfilled({ headers: {} });
    expect(cfg.headers.Authorization).toBe("Bearer abc123");
  });

  it("clears token and redirects on 401", async () => {
    setToken("abc");
    const rejected = (api.interceptors.response as any).handlers[0].rejected;
    const redirect = vi.fn();
    Object.defineProperty(window, "location", { value: { assign: redirect, href: "" }, writable: true });
    await rejected({ response: { status: 401 } }).catch(() => {});
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/client.test.ts`
Expected: FAIL — `./client` not found.

- [ ] **Step 3: Write the implementation**

```typescript
// client/src/api/types.ts
export type AuthResponse = { token: string; user: { id: string; username: string } };
export type Option = { id: string; name: string };
export type DrinkHierarchy = { types: Option[]; categories: Option[]; brands: Option[]; names: Option[] };

export type Match = {
  id: string;
  Dato?: string;
  Gruppe_Bool?: boolean;
  Gruppe_medlemmer?: string;
  "Konsekutive spil"?: number;
  Spiller?: string;
  Arena?: string;
  Modstander?: string;
  Vundet?: boolean;
  Point?: number;
  Drik_Type?: string;
  Drik_Kategori?: string;
  Drik_Brand?: string;
  Drik_Land?: string;
  Drik_Navn?: string;
  Vin_Region?: string;
  "Spillets genstande"?: string;
};
```

```typescript
// client/src/api/client.ts
import axios from "axios";

export const TOKEN_KEY = "pq_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      clearToken();
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/api/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/api/types.ts client/src/api/client.ts client/src/api/client.test.ts
git commit -m "feat(client): api types and axios client with auth interceptor"
```

---

### Task 3: Auth context, provider, and protected route

**Files:**
- Create: `client/src/auth/AuthContext.tsx`
- Create: `client/src/auth/RequireAuth.tsx`
- Test: `client/src/auth/AuthContext.test.tsx`

**Interfaces:**
- Consumes: `api`, `setToken`, `clearToken`, `getToken`, `AuthResponse`.
- Produces:
  - `AuthProvider` and `useAuth()` → `{ user, login(username, password), signup(username, password, email?), logout(), isAuthenticated }`.
  - `RequireAuth` — wraps protected routes; redirects to `/login` when `!isAuthenticated`.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/auth/AuthContext.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./AuthContext";
import { api } from "../api/client";

function Probe() {
  const { login, isAuthenticated } = useAuth();
  return (
    <div>
      <span>{isAuthenticated ? "in" : "out"}</span>
      <button onClick={() => login("ida", "pw")}>login</button>
    </div>
  );
}

beforeEach(() => localStorage.clear());

describe("AuthContext", () => {
  it("logs in and flips to authenticated", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: { token: "t", user: { id: "1", username: "ida" } } } as any);
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText("out")).toBeInTheDocument();
    await userEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByText("in")).toBeInTheDocument());
    expect(localStorage.getItem("pq_token")).toBe("t");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/auth/AuthContext.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// client/src/auth/AuthContext.tsx
import { createContext, useContext, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { getToken, setToken, clearToken } from "../api/client";
import type { AuthResponse } from "../api/types";

type User = { id: string; username: string } | null;
type AuthValue = {
  user: User;
  isAuthenticated: boolean;
  login: (username: string, password?: string) => Promise<void>;
  signup: (username: string, password?: string, email?: string) => Promise<void>;
  logout: () => void;
};

const AuthCtx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);

  async function authenticate(path: string, payload: object) {
    const { data } = await api.post<AuthResponse>(path, payload);
    setToken(data.token);
    setUser(data.user);
  }

  const value: AuthValue = {
    user,
    isAuthenticated: !!user || !!getToken(),
    login: (username, password) => authenticate("/auth/login", { username, password }),
    signup: (username, password, email) => authenticate("/auth/signup", { username, password, email }),
    logout: () => { clearToken(); setUser(null); },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

```tsx
// client/src/auth/RequireAuth.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { ReactNode } from "react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/auth/AuthContext.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/auth/AuthContext.tsx client/src/auth/RequireAuth.tsx client/src/auth/AuthContext.test.tsx
git commit -m "feat(client): auth context, provider, and RequireAuth guard"
```

---

### Task 4: UI kit — Button, Card, Input, Badge, StatCard

**Files:**
- Create: `client/src/ui/Button.tsx`, `Card.tsx`, `Input.tsx`, `Badge.tsx`, `StatCard.tsx`
- Test: `client/src/ui/Badge.test.tsx`

**Interfaces:**
- Produces:
  - `<Button variant="primary"|"ghost" .../>` — terracotta primary, subtle ghost.
  - `<Card>` — cream/white panel, `shadow-card`, `rounded-card`.
  - `<Input label={...} error={...} .../>` — labeled text input.
  - `<Badge tone="win"|"loss"|"group"|"streak">` — colored pill (gold win, bordeaux loss, olive group, terracotta streak).
  - `<StatCard label value hint?>` — dashboard metric card.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/ui/Badge.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("applies the win tone", () => {
    render(<Badge tone="win">Vundet</Badge>);
    const el = screen.getByText("Vundet");
    expect(el.className).toContain("bg-gold");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/Badge.test.tsx`
Expected: FAIL — `./Badge` not found.

- [ ] **Step 3: Write the components**

```tsx
// client/src/ui/Badge.tsx
const TONES = {
  win: "bg-gold text-ink",
  loss: "bg-bordeaux text-cream",
  group: "bg-olive text-cream",
  streak: "bg-terracotta text-cream",
} as const;

export function Badge({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}
```

```tsx
// client/src/ui/Button.tsx
import type { ButtonHTMLAttributes } from "react";
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" };
export function Button({ variant = "primary", className = "", ...rest }: Props) {
  const base = "inline-flex items-center justify-center rounded-card px-4 py-2 font-semibold transition disabled:opacity-50";
  const styles = variant === "primary"
    ? "bg-terracotta text-cream hover:bg-terracotta/90 shadow-card"
    : "bg-transparent text-ink hover:bg-ink/5 border border-ink/15";
  return <button className={`${base} ${styles} ${className}`} {...rest} />;
}
```

```tsx
// client/src/ui/Card.tsx
export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`bg-white/70 rounded-card shadow-card p-5 ${className}`}>{children}</div>;
}
```

```tsx
// client/src/ui/Input.tsx
import { forwardRef, type InputHTMLAttributes } from "react";
type Props = InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string };
export const Input = forwardRef<HTMLInputElement, Props>(({ label, error, className = "", ...rest }, ref) => (
  <label className="block">
    {label && <span className="mb-1 block text-sm font-medium text-ink/80">{label}</span>}
    <input ref={ref} className={`w-full rounded-card border border-ink/15 bg-cream px-3 py-2 outline-none focus:border-terracotta ${className}`} {...rest} />
    {error && <span className="mt-1 block text-sm text-bordeaux">{error}</span>}
  </label>
));
Input.displayName = "Input";
```

```tsx
// client/src/ui/StatCard.tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/Badge.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/ui/
git commit -m "feat(client): apéro UI kit (Button, Card, Input, Badge, StatCard)"
```

---

### Task 5: SelectOrAdd component

**Files:**
- Create: `client/src/ui/SelectOrAdd.tsx`
- Test: `client/src/ui/SelectOrAdd.test.tsx`

**Interfaces:**
- Produces: `<SelectOrAdd label value onChange options onAdd? />` where `options: string[]`, `value: string`, `onChange(v: string)`; picking an existing value or typing a new one both call `onChange`; when a typed value is not in `options` and `onAdd` is provided, an "Add" affordance calls `onAdd(value)`.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/ui/SelectOrAdd.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectOrAdd } from "./SelectOrAdd";

describe("SelectOrAdd", () => {
  it("selects an existing option", async () => {
    const onChange = vi.fn();
    render(<SelectOrAdd label="Arena" value="" options={["Kongens Have", "Fælleden"]} onChange={onChange} />);
    await userEvent.click(screen.getByText("Kongens Have"));
    expect(onChange).toHaveBeenCalledWith("Kongens Have");
  });

  it("offers to add a new value not in options", async () => {
    const onAdd = vi.fn();
    const onChange = vi.fn();
    render(<SelectOrAdd label="Arena" value="" options={["Fælleden"]} onChange={onChange} onAdd={onAdd} />);
    await userEvent.type(screen.getByRole("textbox"), "Nyhavn");
    await userEvent.click(screen.getByRole("button", { name: /tilføj/i }));
    expect(onAdd).toHaveBeenCalledWith("Nyhavn");
    expect(onChange).toHaveBeenCalledWith("Nyhavn");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/SelectOrAdd.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// client/src/ui/SelectOrAdd.tsx
import { useState } from "react";
import { Input } from "./Input";
import { Button } from "./Button";

type Props = {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onAdd?: (v: string) => void;
};

export function SelectOrAdd({ label, value, options, onChange, onAdd }: Props) {
  const [query, setQuery] = useState(value);
  const trimmed = query.trim();
  const matches = trimmed
    ? options.filter((o) => o.toLowerCase().includes(trimmed.toLowerCase()))
    : options;
  const isNew = trimmed.length > 0 && !options.some((o) => o.toLowerCase() === trimmed.toLowerCase());

  return (
    <div className="space-y-2">
      <Input
        label={label}
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); }}
      />
      <div className="flex flex-wrap gap-1.5">
        {matches.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => { setQuery(o); onChange(o); }}
            className={`rounded-full border px-2.5 py-0.5 text-sm ${o === value ? "border-terracotta bg-terracotta/10" : "border-ink/15 hover:bg-ink/5"}`}
          >
            {o}
          </button>
        ))}
      </div>
      {isNew && onAdd && (
        <Button variant="ghost" type="button" onClick={() => { onAdd(trimmed); onChange(trimmed); }}>
          Tilføj "{trimmed}"
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/SelectOrAdd.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/ui/SelectOrAdd.tsx client/src/ui/SelectOrAdd.test.tsx
git commit -m "feat(client): SelectOrAdd pick-or-create field"
```

---

### Task 6: Data hooks (matches, options, hierarchy)

**Files:**
- Create: `client/src/api/hooks.ts`
- Test: `client/src/api/hooks.test.tsx`

**Interfaces:**
- Consumes: `api`, types.
- Produces: `useMatches()`, `useCreateMatch()`, `useUpdateMatch()`, `useDeleteMatch()`, `useOptions(collection)`, `useAddOption(collection)`, `useDrinkHierarchy()`. Mutations invalidate the relevant query keys.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/api/hooks.test.tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMatches } from "./hooks";
import { api } from "./client";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useMatches", () => {
  it("fetches matches", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: [{ id: "1", Spiller: "Ida" }] } as any);
    const { result } = renderHook(() => useMatches(), { wrapper });
    await waitFor(() => expect(result.current.data?.length).toBe(1));
    expect(result.current.data?.[0].Spiller).toBe("Ida");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/hooks.test.tsx`
Expected: FAIL — `./hooks` not found.

- [ ] **Step 3: Write the implementation**

```tsx
// client/src/api/hooks.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Match, Option, DrinkHierarchy } from "./types";

export function useMatches() {
  return useQuery({ queryKey: ["matches"], queryFn: async () => (await api.get<Match[]>("/matches")).data });
}
export function useCreateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<Match>) => (await api.post<Match>("/matches", m)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matches"] }),
  });
}
export function useUpdateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...m }: Partial<Match> & { id: string }) => (await api.put<Match>(`/matches/${id}`, m)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matches"] }),
  });
}
export function useDeleteMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/matches/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matches"] }),
  });
}
export function useOptions(collection: string) {
  return useQuery({
    queryKey: ["options", collection],
    queryFn: async () => (await api.get<Option[]>(`/options/${collection}`)).data,
  });
}
export function useAddOption(collection: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => (await api.post<Option>(`/options/${collection}`, { name })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["options", collection] }),
  });
}
export function useDrinkHierarchy() {
  return useQuery({
    queryKey: ["drinkHierarchy"],
    queryFn: async () => (await api.get<DrinkHierarchy>("/options/drinks/hierarchy")).data,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/api/hooks.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/api/hooks.ts client/src/api/hooks.test.tsx
git commit -m "feat(client): TanStack Query data hooks"
```

---

### Task 7: Router, app shell, and providers

**Files:**
- Modify: `client/src/App.tsx`, `client/src/main.tsx`
- Create: `client/src/components/Layout.tsx`

**Interfaces:**
- Consumes: `AuthProvider`, `RequireAuth`, page components (created in later tasks — import lazily/placeholder now, replace as built).
- Produces: `<App/>` mounting `QueryClientProvider` + `AuthProvider` + `BrowserRouter` with the six routes; `<Layout/>` — header with the pétanque wordmark, nav (Dashboard, Matches, Log match), and a logout button.

- [ ] **Step 1: Write the layout and router**

```tsx
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
          <Link to="/matches/new"><Button>Log kamp</Button></Link>
          <Button variant="ghost" onClick={() => { logout(); nav("/login"); }}>Log ud</Button>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8"><Outlet /></main>
    </div>
  );
}
```

```tsx
// client/src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { DashboardPage } from "./pages/DashboardPage";
import { MatchesPage } from "./pages/MatchesPage";
import { MatchFormPage } from "./pages/MatchFormPage";

const qc = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/matches" element={<MatchesPage />} />
              <Route path="/matches/new" element={<MatchFormPage />} />
              <Route path="/matches/:id/edit" element={<MatchFormPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Add temporary page stubs so it compiles**

Create `client/src/pages/{LoginPage,SignupPage,DashboardPage,MatchesPage,MatchFormPage}.tsx`, each `export function <Name>() { return <div>TODO</div>; }`. These are replaced in Tasks 8–10.

- [ ] **Step 3: Verify it compiles and routes render**

Run: `npm run dev`, visit `/login` (stub) and `/` (redirects to `/login` when logged out).
Expected: no console errors; redirect works.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx client/src/components/Layout.tsx client/src/pages/
git commit -m "feat(client): router, app shell, providers"
```

---

### Task 8: Login and Signup pages

**Files:**
- Create: `client/src/pages/LoginPage.tsx` (replace stub), `client/src/pages/SignupPage.tsx` (replace stub)
- Create: `client/src/components/AuthLayout.tsx`
- Test: `client/src/pages/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, `Input`, `Button`, `Card`.
- Produces: split-screen auth pages — an apéro hero panel (terracotta→bordeaux gradient, boule motif) beside the form. On success, navigate to `/`.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/pages/LoginPage.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "./LoginPage";
import * as ctx from "../auth/AuthContext";

describe("LoginPage", () => {
  it("submits credentials via useAuth().login", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(ctx, "useAuth").mockReturnValue({ login } as any);
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText(/brugernavn/i), "ida");
    await userEvent.type(screen.getByLabelText(/adgangskode/i), "pw");
    await userEvent.click(screen.getByRole("button", { name: /log ind/i }));
    expect(login).toHaveBeenCalledWith("ida", "pw");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/LoginPage.test.tsx`
Expected: FAIL — LoginPage is still the stub (no form).

- [ ] **Step 3: Write the implementation**

```tsx
// client/src/components/AuthLayout.tsx
export function AuthLayout({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-end bg-gradient-to-br from-terracotta to-bordeaux p-10 text-cream md:flex">
        <div className="mb-6 text-6xl">◕ ◕ ◕</div>
        <h1 className="font-display text-4xl">Pétanque · Apéro</h1>
        <p className="mt-2 max-w-sm text-cream/80">Log dine kampe — og hvad der blev drukket imens.</p>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h2 className="mb-6 font-display text-3xl">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
```

```tsx
// client/src/pages/LoginPage.tsx
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
```

```tsx
// client/src/pages/SignupPage.tsx
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
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try { await signup(username, password, email); nav("/"); }
    catch (err: any) { setError(err?.response?.data?.message ?? "Kunne ikke oprette bruger"); }
  }

  return (
    <AuthLayout title="Opret bruger">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Brugernavn" value={username} onChange={(e) => setU(e.target.value)} />
        <Input label="Email (valgfri)" value={email} onChange={(e) => setE(e.target.value)} />
        <Input label="Adgangskode (valgfri)" type="password" value={password} onChange={(e) => setP(e.target.value)} />
        {error && <p className="text-sm text-bordeaux">{error}</p>}
        <Button type="submit" className="w-full">Opret</Button>
        <p className="text-sm text-ink/60">Har du en bruger? <Link className="text-terracotta" to="/login">Log ind</Link></p>
      </form>
    </AuthLayout>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/LoginPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/LoginPage.tsx client/src/pages/SignupPage.tsx client/src/components/AuthLayout.tsx client/src/pages/LoginPage.test.tsx
git commit -m "feat(client): login and signup pages with apéro hero"
```

---

### Task 9: Matches list + Match form (with cascading drink picker)

**Files:**
- Create: `client/src/pages/MatchesPage.tsx` (replace stub)
- Create: `client/src/pages/MatchFormPage.tsx` (replace stub)
- Create: `client/src/components/DrinkPicker.tsx`
- Create: `client/src/components/MatchCard.tsx`
- Test: `client/src/components/DrinkPicker.test.tsx`

**Interfaces:**
- Consumes: `useMatches`, `useCreateMatch`, `useUpdateMatch`, `useDeleteMatch`, `useOptions`, `useAddOption`, `SelectOrAdd`, `Badge`, `Card`, `Button`, `Input`.
- Produces:
  - `MatchesPage` — filter bar (player/arena/won/group) + a list of `MatchCard`s + CSV export link.
  - `MatchFormPage` — create/edit; reads `:id` (edit mode loads from `useMatches`).
  - `DrinkPicker` — cascading type → category → brand → name selects; when `Drik_Type === "Vin"`, reveals a wine-region field. Emits a partial `Match` via `onChange`.

- [ ] **Step 1: Write the failing test for DrinkPicker cascade**

```tsx
// client/src/components/DrinkPicker.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DrinkPicker } from "./DrinkPicker";

const opts = ["Øl", "Vin"];

describe("DrinkPicker", () => {
  it("reveals wine region only when type is Vin", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<DrinkPicker value={{}} typeOptions={opts} onChange={onChange} />);
    expect(screen.queryByLabelText(/vin_region|region/i)).toBeNull();
    rerender(<DrinkPicker value={{ Drik_Type: "Vin" }} typeOptions={opts} onChange={onChange} />);
    expect(screen.getByLabelText(/region/i)).toBeInTheDocument();
  });

  it("emits the chosen type", async () => {
    const onChange = vi.fn();
    render(<DrinkPicker value={{}} typeOptions={opts} onChange={onChange} />);
    await userEvent.click(screen.getByText("Øl"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ Drik_Type: "Øl" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DrinkPicker.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write DrinkPicker**

```tsx
// client/src/components/DrinkPicker.tsx
import { SelectOrAdd } from "../ui/SelectOrAdd";
import { Input } from "../ui/Input";
import type { Match } from "../api/types";

type Props = {
  value: Partial<Match>;
  typeOptions: string[];
  categoryOptions?: string[];
  brandOptions?: string[];
  nameOptions?: string[];
  onChange: (patch: Partial<Match>) => void;
};

export function DrinkPicker({ value, typeOptions, categoryOptions = [], brandOptions = [], nameOptions = [], onChange }: Props) {
  const set = (patch: Partial<Match>) => onChange({ ...value, ...patch });
  const isWine = value.Drik_Type === "Vin";
  return (
    <div className="space-y-3">
      <SelectOrAdd label="Drik type" value={value.Drik_Type ?? ""} options={typeOptions} onChange={(v) => set({ Drik_Type: v })} />
      <SelectOrAdd label="Kategori" value={value.Drik_Kategori ?? ""} options={categoryOptions} onChange={(v) => set({ Drik_Kategori: v })} />
      <SelectOrAdd label="Brand" value={value.Drik_Brand ?? ""} options={brandOptions} onChange={(v) => set({ Drik_Brand: v })} />
      <SelectOrAdd label="Navn" value={value.Drik_Navn ?? ""} options={nameOptions} onChange={(v) => set({ Drik_Navn: v })} />
      {isWine && (
        <Input label="Region" value={value.Vin_Region ?? ""} onChange={(e) => set({ Vin_Region: e.target.value })} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run DrinkPicker test to verify it passes**

Run: `npx vitest run src/components/DrinkPicker.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Write MatchCard, MatchesPage, MatchFormPage**

```tsx
// client/src/components/MatchCard.tsx
import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import type { Match } from "../api/types";

export function MatchCard({ m }: { m: Match }) {
  return (
    <Card className="flex items-center justify-between">
      <div>
        <div className="font-display text-lg">{m.Spiller} <span className="text-ink/40">vs</span> {m.Modstander}</div>
        <div className="text-sm text-ink/60">{m.Dato} · {m.Arena} · {m.Point} point</div>
        {m.Drik_Navn && <div className="mt-1 text-sm text-bordeaux">🍷 {m.Drik_Navn}{m.Drik_Land ? ` (${m.Drik_Land})` : ""}</div>}
      </div>
      <div className="flex items-center gap-2">
        {m.Gruppe_Bool && <Badge tone="group">Gruppe</Badge>}
        <Badge tone={m.Vundet ? "win" : "loss"}>{m.Vundet ? "Vundet" : "Tabt"}</Badge>
        <Link to={`/matches/${m.id}/edit`} className="text-sm text-terracotta">Rediger</Link>
      </div>
    </Card>
  );
}
```

```tsx
// client/src/pages/MatchesPage.tsx
import { useState } from "react";
import { useMatches } from "../api/hooks";
import { MatchCard } from "../components/MatchCard";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { getToken } from "../api/client";

export function MatchesPage() {
  const { data = [], isLoading } = useMatches();
  const [q, setQ] = useState("");
  const [onlyWins, setOnlyWins] = useState(false);
  const filtered = data.filter((m) =>
    (!q || [m.Spiller, m.Arena, m.Modstander].some((f) => f?.toLowerCase().includes(q.toLowerCase()))) &&
    (!onlyWins || m.Vundet));

  async function exportCsv() {
    const res = await fetch("/api/export", { headers: { Authorization: `Bearer ${getToken()}` } });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url; a.download = "petanque_data.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input label="Søg" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyWins} onChange={(e) => setOnlyWins(e.target.checked)} /> Kun sejre</label>
        <div className="ml-auto"><Button variant="ghost" onClick={exportCsv}>Eksportér CSV</Button></div>
      </div>
      {isLoading ? <p>Henter…</p> : <div className="space-y-3">{filtered.map((m) => <MatchCard key={m.id} m={m} />)}</div>}
    </div>
  );
}
```

```tsx
// client/src/pages/MatchFormPage.tsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMatches, useCreateMatch, useUpdateMatch, useOptions, useAddOption } from "../api/hooks";
import { DrinkPicker } from "../components/DrinkPicker";
import { SelectOrAdd } from "../ui/SelectOrAdd";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import type { Match } from "../api/types";

export function MatchFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: matches = [] } = useMatches();
  const create = useCreateMatch();
  const update = useUpdateMatch();
  const players = useOptions("players");
  const arenas = useOptions("arenas");
  const drinkTypes = useOptions("drink_types");
  const addArena = useAddOption("arenas");
  const addPlayer = useAddOption("players");

  const [form, setForm] = useState<Partial<Match>>({ Vundet: false, Gruppe_Bool: false });
  useEffect(() => {
    if (id) { const m = matches.find((x) => x.id === id); if (m) setForm(m); }
  }, [id, matches]);

  const set = (patch: Partial<Match>) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (id) await update.mutateAsync({ id, ...form });
    else await create.mutateAsync(form);
    nav("/matches");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-3">
        <Input label="Dato" type="date" value={form.Dato ?? ""} onChange={(e) => set({ Dato: e.target.value })} />
        <SelectOrAdd label="Spiller" value={form.Spiller ?? ""} options={(players.data ?? []).map((o) => o.name)} onChange={(v) => set({ Spiller: v })} onAdd={(v) => addPlayer.mutate(v)} />
        <SelectOrAdd label="Arena" value={form.Arena ?? ""} options={(arenas.data ?? []).map((o) => o.name)} onChange={(v) => set({ Arena: v })} onAdd={(v) => addArena.mutate(v)} />
        <Input label="Modstander" value={form.Modstander ?? ""} onChange={(e) => set({ Modstander: e.target.value })} />
        <Input label="Point" type="number" value={form.Point ?? ""} onChange={(e) => set({ Point: Number(e.target.value) })} />
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.Vundet} onChange={(e) => set({ Vundet: e.target.checked })} /> Vundet</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.Gruppe_Bool} onChange={(e) => set({ Gruppe_Bool: e.target.checked })} /> Gruppespil</label>
        {form.Gruppe_Bool && <Input label="Gruppemedlemmer" value={form.Gruppe_medlemmer ?? ""} onChange={(e) => set({ Gruppe_medlemmer: e.target.value })} />}
        <Input label="Konsekutive spil" type="number" value={form["Konsekutive spil"] ?? ""} onChange={(e) => set({ "Konsekutive spil": Number(e.target.value) })} />
        <Input label="Spillets genstande" value={form["Spillets genstande"] ?? ""} onChange={(e) => set({ "Spillets genstande": e.target.value })} />
      </Card>
      <Card><DrinkPicker value={form} typeOptions={(drinkTypes.data ?? []).map((o) => o.name)} onChange={(patch) => setForm(patch)} /></Card>
      <Button type="submit">{id ? "Gem ændringer" : "Log kamp"}</Button>
    </form>
  );
}
```

- [ ] **Step 6: Run the full client suite**

Run: `npx vitest run`
Expected: PASS — all client suites.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/MatchesPage.tsx client/src/pages/MatchFormPage.tsx client/src/components/DrinkPicker.tsx client/src/components/MatchCard.tsx client/src/components/DrinkPicker.test.tsx
git commit -m "feat(client): matches list, match form, cascading drink picker, CSV export"
```

---

### Task 10: Stats dashboard

**Files:**
- Create: `client/src/pages/DashboardPage.tsx` (replace stub)
- Create: `client/src/stats/derive.ts`
- Test: `client/src/stats/derive.test.ts`

**Interfaces:**
- Consumes: `useMatches`, `StatCard`, `Card`, Recharts.
- Produces:
  - `deriveStats(matches: Match[])` → `{ total, wins, winRate, totalPoints, longestStreak, topArenas: {name,count}[], topDrinks: {name,count}[], pointsOverTime: {date,points}[] }`.
  - `DashboardPage` — stat cards (win-rate, total points, longest streak, matches played), a points-over-time line chart, top arenas and top drinks lists, and recent matches.

- [ ] **Step 1: Write the failing test**

```typescript
// client/src/stats/derive.test.ts
import { describe, it, expect } from "vitest";
import { deriveStats } from "./derive";

const M = [
  { id: "1", Dato: "2026-06-01", Vundet: true, Point: 13, Arena: "A", Drik_Navn: "Rosé" },
  { id: "2", Dato: "2026-06-02", Vundet: true, Point: 11, Arena: "A", Drik_Navn: "Rosé" },
  { id: "3", Dato: "2026-06-03", Vundet: false, Point: 7, Arena: "B", Drik_Navn: "Øl" },
] as any;

describe("deriveStats", () => {
  it("computes win rate, points, streak and tops", () => {
    const s = deriveStats(M);
    expect(s.total).toBe(3);
    expect(s.wins).toBe(2);
    expect(s.winRate).toBeCloseTo(66.67, 1);
    expect(s.totalPoints).toBe(31);
    expect(s.longestStreak).toBe(2);
    expect(s.topArenas[0]).toEqual({ name: "A", count: 2 });
    expect(s.topDrinks[0]).toEqual({ name: "Rosé", count: 2 });
    expect(s.pointsOverTime).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stats/derive.test.ts`
Expected: FAIL — `./derive` not found.

- [ ] **Step 3: Write `deriveStats`**

```typescript
// client/src/stats/derive.ts
import type { Match } from "../api/types";

function topBy(matches: Match[], key: keyof Match) {
  const counts = new Map<string, number>();
  for (const m of matches) {
    const v = m[key];
    if (typeof v === "string" && v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count).slice(0, 5);
}

export function deriveStats(matches: Match[]) {
  const byDate = [...matches].sort((a, b) => (a.Dato ?? "").localeCompare(b.Dato ?? ""));
  const total = matches.length;
  const wins = matches.filter((m) => m.Vundet).length;
  const totalPoints = matches.reduce((s, m) => s + (m.Point ?? 0), 0);

  let streak = 0, longestStreak = 0;
  for (const m of byDate) {
    if (m.Vundet) { streak++; longestStreak = Math.max(longestStreak, streak); }
    else streak = 0;
  }

  return {
    total,
    wins,
    winRate: total ? (wins / total) * 100 : 0,
    totalPoints,
    longestStreak,
    topArenas: topBy(matches, "Arena"),
    topDrinks: topBy(matches, "Drik_Navn"),
    pointsOverTime: byDate.map((m) => ({ date: m.Dato ?? "", points: m.Point ?? 0 })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stats/derive.test.ts`
Expected: PASS.

- [ ] **Step 5: Write DashboardPage**

```tsx
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
```

- [ ] **Step 6: Verify build and full suite**

Run: `npx vitest run && npm run build`
Expected: tests PASS; build outputs `client/dist`.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/DashboardPage.tsx client/src/stats/derive.ts client/src/stats/derive.test.ts
git commit -m "feat(client): stats dashboard with charts and derived metrics"
```

---

### Task 11: End-to-end local wiring check

**Files:** none (verification task)

**Interfaces:** confirms the Worker serves the built SPA and the API together.

- [ ] **Step 1: Build the client**

Run: `cd client && npm run build`
Expected: `client/dist/index.html` exists.

- [ ] **Step 2: Run the Worker (from repo root) with local D1 and open the app**

Run: `npm run db:migrate:local && npm run dev` (Worker on `:8787`), then open `http://localhost:8787`.
Expected: the SPA loads from the Worker; signup → dashboard works end-to-end against local D1.

- [ ] **Step 3: Commit any config fixes**

```bash
git add -A
git commit -m "chore: verify end-to-end Worker + SPA local wiring"
```

---

## Self-Review

**Spec coverage:**
- Vite + React + TS + Tailwind, apéro palette/fonts/texture → Task 1. ✅
- JWT in localStorage, axios interceptor, 401/403 redirect → Task 2. ✅
- AuthContext + protected routes → Tasks 3, 7. ✅
- TanStack Query for matches/options/hierarchy with invalidation → Task 6. ✅
- UI kit + SelectOrAdd → Tasks 4, 5. ✅
- Login/Signup split layout → Task 8. ✅
- Matches list with filters + drink chip + CSV export → Task 9. ✅
- Match form + cascading drink picker (wine region conditional) → Task 9. ✅
- Dashboard: win-rate, points, streak, points-over-time, top arenas, top drinks, recent → Task 10. ✅
- Builds to `client/dist`, served by Worker; Vite proxy for dev → Tasks 1, 11. ✅
- Vitest + RTL (+ MSW available) TDD → all test tasks. ✅

**Placeholder scan:** Task 7 intentionally creates page *stubs* that Tasks 8–10 replace; each replacement is a full implementation. No residual TODOs after Task 10. MSW is installed (Task 1) and available; unit tests use `vi.spyOn(api, ...)` which is sufficient for the logic under test, so no separate MSW handler file is required.

**Type consistency:** `Match` (Danish keys) used consistently across types/hooks/components; `Option = {id,name}` stable; `deriveStats` return shape matches DashboardPage usage; `SelectOrAdd` props (`value/options/onChange/onAdd`) stable across DrinkPicker and MatchFormPage. ✅
