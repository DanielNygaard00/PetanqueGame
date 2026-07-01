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
