import { describe, it, expect } from "vitest";
import { DEFAULT_TEMPLATES } from "../../lib/default-templates";

describe("DEFAULT_TEMPLATES", () => {
  it("ships a substantial library (>=10 seed templates)", () => {
    // Round 2 explicitly asked for a richer, more diverse template library
    // (coder, email, meeting, design, note, etc.). Guard against future
    // accidental shrinkage.
    expect(DEFAULT_TEMPLATES.length).toBeGreaterThanOrEqual(10);
  });

  it("includes the role-specific templates the user asked for", () => {
    const ids = DEFAULT_TEMPLATES.map((t) => t.id);
    // Core roles requested: coder + email + meeting + design + note + casual.
    expect(ids).toContain("coder");
    expect(ids).toContain("email");
    expect(ids).toContain("meeting-notes");
    expect(ids).toContain("design-note");
    expect(ids).toContain("quick-note");
    expect(ids).toContain("casual");
    expect(ids).toContain("professional");
  });

  it("has unique ids across every template", () => {
    const ids = DEFAULT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has monotonically increasing order indices starting from 0", () => {
    for (let i = 0; i < DEFAULT_TEMPLATES.length; i++) {
      expect(DEFAULT_TEMPLATES[i].order).toBe(i);
    }
  });

  it("gives every template a non-empty name and prompt", () => {
    for (const t of DEFAULT_TEMPLATES) {
      expect(t.name.trim().length).toBeGreaterThan(0);
      // Prompts must be substantive — a one-word prompt barely moves Gemini.
      expect(t.prompt.trim().length).toBeGreaterThanOrEqual(20);
    }
  });

  it("coder template preserves code identifiers via explicit instruction", () => {
    // The whole point of the coder template is not mangling identifiers,
    // function names, and CLI flags. Regression-guard the prompt wording.
    const coder = DEFAULT_TEMPLATES.find((t) => t.id === "coder");
    expect(coder).toBeDefined();
    expect(coder!.prompt.toLowerCase()).toMatch(
      /identifier|variable|function|code|backtick/,
    );
  });
});
