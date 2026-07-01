import "@testing-library/jest-dom";

// Node 26 exposes an experimental (undefined) localStorage global that
// prevents vitest's populateGlobal from copying jsdom's Storage implementation.
// Restore jsdom's localStorage/sessionStorage by reading from the prototype
// chain of the jsdom window (bypassing the shadowed Node 26 property).
if (typeof window !== "undefined") {
  const win = window as any;
  // jsdom stores the real Storage object on window._localStorage
  if (win._localStorage && localStorage !== win._localStorage) {
    Object.defineProperty(globalThis, "localStorage", {
      value: win._localStorage,
      configurable: true,
      writable: true,
    });
  }
  if (win._sessionStorage && sessionStorage !== win._sessionStorage) {
    Object.defineProperty(globalThis, "sessionStorage", {
      value: win._sessionStorage,
      configurable: true,
      writable: true,
    });
  }
}
