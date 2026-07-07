// client/src/pages/RivalryPage.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RivalryPage } from "./RivalryPage";
import { api } from "../api/client";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });
const meet = (id: string, winner: string, ws: number, loser: string, ls: number): Match => ({
  id, Dato: `2026-07-${id.padStart(2, "0")}`,
  teams: [
    { team: 0, score: ws, won: true, players: [pl(winner)] },
    { team: 1, score: ls, won: false, players: [pl(loser)] },
  ],
});

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/rivalry/:a/:b" element={<RivalryPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RivalryPage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("renders record, streak, and meetings", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: [
      meet("3", "Ida", 13, "Bo", 5),
      meet("2", "Ida", 13, "Bo", 9),
      meet("1", "Bo", 13, "Ida", 7),
    ] } as any);
    renderAt("/rivalry/Ida/Bo");
    expect(await screen.findByText("Ida mod Bo")).toBeInTheDocument();
    expect(screen.getByText("2–1")).toBeInTheDocument();
    expect(screen.getByText(/Ida har vundet de sidste 2/)).toBeInTheDocument();
    // Meetings render as match cards (3 links to match detail)
    expect(screen.getAllByRole("link").length).toBeGreaterThanOrEqual(3);
  });

  it("shows the empty state when the players never met", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: [meet("1", "Ida", 13, "Bo", 7)] } as any);
    renderAt("/rivalry/Ida/Cy");
    expect(await screen.findByText("Ingen indbyrdes kampe endnu")).toBeInTheDocument();
  });

  it("decodes URL-encoded names", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: [meet("1", "Søren Å", 13, "Bo", 7)] } as any);
    renderAt(`/rivalry/${encodeURIComponent("Søren Å")}/Bo`);
    expect(await screen.findByText("Søren Å mod Bo")).toBeInTheDocument();
    expect(screen.getByText("1–0")).toBeInTheDocument();
  });
});
