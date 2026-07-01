// client/src/auth/AuthContext.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./AuthContext";
import { api } from "../api/client";

function Probe() {
  const { login, isAuthenticated } = useAuth();
  return (
    <div>
      <span>{isAuthenticated ? "in" : "out"}</span>
      <button onClick={() => login("ida", "pw")}>login</button>
    </div>
  );
}

beforeEach(() => localStorage.clear());

describe("AuthContext", () => {
  it("logs in and flips to authenticated", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: { token: "t", user: { id: "1", username: "ida" } } } as any);
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText("out")).toBeInTheDocument();
    await userEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByText("in")).toBeInTheDocument());
    expect(localStorage.getItem("pq_token")).toBe("t");
  });
});
