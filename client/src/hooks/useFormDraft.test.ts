// client/src/hooks/useFormDraft.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFormDraft } from "./useFormDraft";

type F = { name: string };
const KEY = "test-draft";
const substantial = (f: F) => f.name.length > 0;

describe("useFormDraft", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("restores a stored draft on mount", () => {
    localStorage.setItem(KEY, JSON.stringify({ name: "Ida" }));
    const setForm = vi.fn();
    const { result } = renderHook(() =>
      useFormDraft<F>(KEY, { name: "" }, setForm, { enabled: true, hasSubstance: substantial }));
    expect(setForm).toHaveBeenCalledWith({ name: "Ida" });
    expect(result.current.restored).toBe(true);
  });

  it("ignores malformed stored JSON", () => {
    localStorage.setItem(KEY, "{nope");
    const setForm = vi.fn();
    const { result } = renderHook(() =>
      useFormDraft<F>(KEY, { name: "" }, setForm, { enabled: true, hasSubstance: substantial }));
    expect(setForm).not.toHaveBeenCalled();
    expect(result.current.restored).toBe(false);
  });

  it("saves a substantial form after the debounce", () => {
    const { rerender } = renderHook(({ form }) =>
      useFormDraft<F>(KEY, form, () => {}, { enabled: true, hasSubstance: substantial }),
      { initialProps: { form: { name: "" } } });
    rerender({ form: { name: "Ida" } });
    act(() => { vi.advanceTimersByTime(600); });
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ name: "Ida" });
  });

  it("does not save an insubstantial form", () => {
    renderHook(() =>
      useFormDraft<F>(KEY, { name: "" }, () => {}, { enabled: true, hasSubstance: substantial }));
    act(() => { vi.advanceTimersByTime(600); });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("never reads or writes when disabled", () => {
    localStorage.setItem(KEY, JSON.stringify({ name: "Ida" }));
    const setForm = vi.fn();
    renderHook(() =>
      useFormDraft<F>(KEY, { name: "Bo" }, setForm, { enabled: false, hasSubstance: substantial }));
    act(() => { vi.advanceTimersByTime(600); });
    expect(setForm).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify({ name: "Ida" }));
  });

  it("clear() removes the draft and resets restored", () => {
    localStorage.setItem(KEY, JSON.stringify({ name: "Ida" }));
    const { result } = renderHook(() =>
      useFormDraft<F>(KEY, { name: "" }, () => {}, { enabled: true, hasSubstance: substantial }));
    act(() => { result.current.clear(); });
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(result.current.restored).toBe(false);
  });
});
