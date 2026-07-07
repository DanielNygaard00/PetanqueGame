// client/src/ui/EmptyState.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders emoji, title, hint and CTA link", () => {
    render(
      <MemoryRouter>
        <EmptyState emoji="🎯" title="Ingen kampe endnu" hint="Grib kuglerne." cta={{ label: "Log kamp", to: "/matches/new" }} />
      </MemoryRouter>,
    );
    expect(screen.getByText("🎯")).toBeInTheDocument();
    expect(screen.getByText("Ingen kampe endnu")).toBeInTheDocument();
    expect(screen.getByText("Grib kuglerne.")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/matches/new");
  });

  it("omits hint and CTA when absent", () => {
    render(<MemoryRouter><EmptyState emoji="🏆" title="Tom" /></MemoryRouter>);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
