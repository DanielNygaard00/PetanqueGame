// client/src/pages/AwardsPage.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AwardsPage } from "./AwardsPage";
import { api } from "../api/client";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });
const game = (id: string, dato: string, winner: string, loser: string): Match => ({
  id, Dato: dato,
  teams: [
    { team: 0, score: 13, won: true, players: [pl(winner)] },
    { team: 1, score: 5, won: false, players: [pl(loser)] },
  ],
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><AwardsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AwardsPage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("renders awards for the default month period", async () => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    vi.spyOn(api, "get").mockResolvedValue({ data: [
      game("3", `${ym}-03`, "Ida", "Bo"),
      game("2", `${ym}-02`, "Ida", "Bo"),
      game("1", `${ym}-01`, "Ida", "Bo"),
    ] } as any);
    renderPage();
    expect(await screen.findByText("Periodens spiller")).toBeInTheDocument();
    expect(screen.getAllByText("Ida").length).toBeGreaterThan(0);
  });

  it("shows the empty state when the period has too few matches", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: [game("1", "2001-01-01", "Ida", "Bo")] } as any);
    renderPage();
    expect(await screen.findByText("Ikke nok kampe i perioden endnu")).toBeInTheDocument();
  });

  it("switches period via the toggle", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: [
      game("3", "2001-01-03", "Ida", "Bo"),
      game("2", "2001-01-02", "Ida", "Bo"),
      game("1", "2001-01-01", "Ida", "Bo"),
    ] } as any);
    renderPage();
    expect(await screen.findByText("Ikke nok kampe i perioden endnu")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Altid" }));
    expect(await screen.findByText("Periodens spiller")).toBeInTheDocument();
  });
});
