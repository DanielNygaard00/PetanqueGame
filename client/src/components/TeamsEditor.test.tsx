// client/src/components/TeamsEditor.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TeamsEditor, type TeamInput } from "./TeamsEditor";

describe("TeamsEditor", () => {
  it("adds a team when '+ Tilføj hold' is clicked", () => {
    const onChange = vi.fn();
    const value: TeamInput[] = [{ score: null, players: ["Ida"] }, { score: null, players: ["Bo"] }];
    render(<TeamsEditor value={value} onChange={onChange} playerOptions={["Ida", "Bo", "Cy"]} />);
    fireEvent.click(screen.getByText("+ Tilføj hold"));
    expect(onChange).toHaveBeenCalledWith([...value, { score: null, players: [] }]);
  });

  it("marks the highest-scoring team as winner", () => {
    const value: TeamInput[] = [{ score: 13, players: ["Ida"] }, { score: 5, players: ["Bo"] }];
    render(<TeamsEditor value={value} onChange={() => {}} playerOptions={["Ida", "Bo"]} />);
    expect(screen.getByText(/Hold 1 🏆/)).toBeInTheDocument();
  });

  it("adds an existing player when its chip is clicked", () => {
    const onChange = vi.fn();
    const value: TeamInput[] = [
      { score: null, players: [] },
      { score: null, players: ["Bo"] },
    ];
    render(<TeamsEditor value={value} onChange={onChange} playerOptions={["Ida", "Bo"]} />);
    fireEvent.click(screen.getAllByText("+ Ida")[0]);
    expect(onChange).toHaveBeenCalledWith([
      { score: null, players: ["Ida"] },
      { score: null, players: ["Bo"] },
    ]);
  });

  it("adds a brand-new player via input + button and calls onAddPlayer", () => {
    const onChange = vi.fn();
    const onAddPlayer = vi.fn();
    const value: TeamInput[] = [
      { score: null, players: [] },
      { score: null, players: [] },
    ];
    render(<TeamsEditor value={value} onChange={onChange} playerOptions={["Ida"]} onAddPlayer={onAddPlayer} />);
    fireEvent.change(screen.getAllByLabelText("Ny spiller")[0], { target: { value: "Zoe" } });
    fireEvent.click(screen.getAllByText("Tilføj spiller")[0]);
    expect(onAddPlayer).toHaveBeenCalledWith("Zoe");
    expect(onChange).toHaveBeenCalledWith([
      { score: null, players: ["Zoe"] },
      { score: null, players: [] },
    ]);
  });
});
