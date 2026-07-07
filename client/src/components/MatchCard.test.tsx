import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MatchCard } from "./MatchCard";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });
const m: Match = { id: "1", Dato: "2026-04-22", teams: [
  { team: 0, score: 18, won: false, players: [pl("Daniel"), pl("Rasmus")] },
  { team: 1, score: 21, won: true, players: [pl("Marcus"), pl("Søren")] },
] };

describe("MatchCard", () => {
  it("renders both teams with scores", () => {
    render(<MemoryRouter><MatchCard m={m} /></MemoryRouter>);
    expect(screen.getByText(/Daniel \+ Rasmus/)).toBeInTheDocument();
    expect(screen.getByText(/Marcus \+ Søren/)).toBeInTheDocument();
    expect(screen.getByText(/18/)).toBeInTheDocument();
    expect(screen.getByText(/21/)).toBeInTheDocument();
  });

  it("shows a positive Elo delta in olive", () => {
    render(<MemoryRouter><MatchCard m={m} eloDelta={14} /></MemoryRouter>);
    const chip = screen.getByText("+14");
    expect(chip).toHaveClass("text-olive");
  });

  it("shows a negative Elo delta in bordeaux with typographic minus", () => {
    render(<MemoryRouter><MatchCard m={m} eloDelta={-9} /></MemoryRouter>);
    const chip = screen.getByText("−9");
    expect(chip).toHaveClass("text-bordeaux");
  });

  it("shows ±0 for a zero delta", () => {
    render(<MemoryRouter><MatchCard m={m} eloDelta={0} /></MemoryRouter>);
    expect(screen.getByText("±0")).toBeInTheDocument();
  });

  it("hides the chip when eloDelta is absent", () => {
    render(<MemoryRouter><MatchCard m={m} /></MemoryRouter>);
    expect(screen.queryByText(/±0|\+\d|−\d/)).not.toBeInTheDocument();
  });

  it("links the card to the match detail page", () => {
    render(<MemoryRouter><MatchCard m={m} /></MemoryRouter>);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/matches/1");
  });
});
