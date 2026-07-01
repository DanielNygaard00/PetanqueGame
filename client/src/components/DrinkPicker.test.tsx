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
