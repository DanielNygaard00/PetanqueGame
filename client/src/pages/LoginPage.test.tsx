// client/src/pages/LoginPage.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "./LoginPage";
import * as ctx from "../auth/AuthContext";

describe("LoginPage", () => {
  it("submits credentials via useAuth().login", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(ctx, "useAuth").mockReturnValue({ login } as any);
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText(/brugernavn/i), "ida");
    await userEvent.type(screen.getByLabelText(/adgangskode/i), "pw");
    await userEvent.click(screen.getByRole("button", { name: /log ind/i }));
    expect(login).toHaveBeenCalledWith("ida", "pw");
  });
});
