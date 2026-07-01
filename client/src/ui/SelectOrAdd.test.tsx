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

  it("reflects a value prop that arrives after mount (edit prefill)", () => {
    const { rerender } = render(<SelectOrAdd label="Spiller" value="" options={["Ida", "Bo"]} onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
    rerender(<SelectOrAdd label="Spiller" value="Ida" options={["Ida", "Bo"]} onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveValue("Ida");
  });
});
