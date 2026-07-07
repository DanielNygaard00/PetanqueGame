// client/src/pages/MatchDetailPage.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MatchDetailPage } from "./MatchDetailPage";
import { api } from "../api/client";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });
const match: Match = {
  id: "1", Dato: "2026-07-01", Tid: "18:00", Arena: "Fælledparken",
  teams: [
    { team: 0, score: 13, won: true, players: [pl("Ida")] },
    { team: 1, score: 7, won: false, players: [pl("Bo")] },
  ],
  drinks: [
    { type: "Øl", brand: "Carlsberg", count: 2, volumeCl: 33, player: "Ida" },
    { type: "Vin", count: 1, player: null },
  ],
};

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/matches/:id" element={<MatchDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MatchDetailPage", () => {
  it("renders teams, scores, winner highlight and Elo deltas", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: [match] } as any);
    renderAt("/matches/1");
    expect((await screen.findAllByText("Ida")).length).toBeGreaterThan(0);
    expect(screen.getByText("13")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("+12 Elo")).toBeInTheDocument();
    expect(screen.getByText("−12 Elo")).toBeInTheDocument();
    expect(screen.getByText("Rediger")).toBeInTheDocument();
  });

  it("groups drinks by player with a Fælles fallback", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: [match] } as any);
    renderAt("/matches/1");
    expect(await screen.findByText("Fælles")).toBeInTheDocument();
    expect(screen.getByText(/Øl · Carlsberg/)).toBeInTheDocument();
    expect(screen.getByText(/2 stk à 33 cl/)).toBeInTheDocument();
  });

  it("shows a not-found state for an unknown id", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: [match] } as any);
    renderAt("/matches/nope");
    expect(await screen.findByText("Kamp ikke fundet.")).toBeInTheDocument();
    expect(screen.getByText("Tilbage til kampe")).toHaveAttribute("href", "/matches");
  });
});
