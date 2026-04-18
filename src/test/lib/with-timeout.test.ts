import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTimeout, TimeoutError } from "../../lib/with-timeout";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the underlying promise's value when it finishes in time", async () => {
    const p = Promise.resolve("ok");
    await expect(withTimeout(p, 100, "x")).resolves.toBe("ok");
  });

  it("rejects with TimeoutError when the underlying promise hangs past the deadline", async () => {
    // A promise that never resolves — this is exactly the scenario a hung
    // Gemini refinement call would look like in production.
    const p = new Promise<string>(() => {});
    const wrapped = withTimeout(p, 1000, "Gemini polish");
    vi.advanceTimersByTime(1000);
    await expect(wrapped).rejects.toBeInstanceOf(TimeoutError);
    await expect(wrapped).rejects.toThrow(/Gemini polish timed out after 1000ms/);
  });

  it("propagates the underlying rejection when the promise fails before the timeout", async () => {
    const p = Promise.reject(new Error("nope"));
    await expect(withTimeout(p, 1000, "x")).rejects.toThrow("nope");
  });

  it("does not reject after the underlying promise has already resolved", async () => {
    // Regression guard: the setTimeout must be cleared on resolve, otherwise
    // Node would keep the event loop alive for the full timeout and surface
    // spurious unhandled rejections.
    const p = Promise.resolve(42);
    const result = await withTimeout(p, 5000, "x");
    expect(result).toBe(42);
    // Advancing past the original timeout must be a no-op.
    vi.advanceTimersByTime(10_000);
    // No assertion throw here means no TimeoutError was raised.
  });
});
