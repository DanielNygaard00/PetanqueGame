// client/src/components/DrinksEditor.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DrinksEditor } from "./DrinksEditor";

const opts = { typeOptions: ["Øl", "Vin"], categoryOptions: [], brandOptions: [], nameOptions: [] };

describe("DrinksEditor", () => {
  it("adds a drink row", async () => {
    const onChange = vi.fn();
    render(<DrinksEditor value={[]} onChange={onChange} {...opts} />);
    await userEvent.click(screen.getByRole("button", { name: /tilføj drik/i }));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ count: 1 })]);
  });

  it("removes a drink row", async () => {
    const onChange = vi.fn();
    render(<DrinksEditor value={[{ type: "Øl", count: 2 }]} onChange={onChange} {...opts} />);
    await userEvent.click(screen.getByRole("button", { name: /fjern/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("edits count for a row", async () => {
    const onChange = vi.fn();
    render(<DrinksEditor value={[{ type: "Øl", count: 1 }]} onChange={onChange} {...opts} />);
    const countInput = screen.getByLabelText(/antal/i);
    await userEvent.clear(countInput);
    await userEvent.type(countInput, "3");
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ count: 3 })]);
  });
});
