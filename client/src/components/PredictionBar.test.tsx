// client/src/components/PredictionBar.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PredictionBar } from "./PredictionBar";

describe("PredictionBar", () => {
  it("renders labels and rounded percentages", () => {
    render(<PredictionBar probA={0.6449} labelA="Ida + Ann" labelB="Bo" />);
    expect(screen.getByText(/Ida \+ Ann · 64%/)).toBeInTheDocument();
    expect(screen.getByText(/36% · Bo/)).toBeInTheDocument();
  });
});
