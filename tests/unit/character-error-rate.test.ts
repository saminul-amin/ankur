import { describe, expect, it } from "vitest";

import { characterErrorRate } from "../../src/shared/evaluation/character-error-rate.js";

describe("character error rate", () => {
  it("returns zero for normalized-identical Bengali text", () => {
    expect(characterErrorRate("বাংলা   লেখা\r\nপরীক্ষা", "বাংলা লেখা\nপরীক্ষা")).toBe(0);
  });

  it("counts a single substitution", () => {
    expect(characterErrorRate("কলম", "ফলম")).toBeCloseTo(1 / 3);
  });
});
