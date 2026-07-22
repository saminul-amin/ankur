// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { AnkurMark } from "../../src/presentation/components/brand/ankur-mark.js";
import { GrowthRail } from "../../src/presentation/components/learning/growth-rail.js";

describe("visual foundation semantics", () => {
  it("exposes the compact original Ankur mark with an accessible name", () => {
    render(createElement(AnkurMark, { compact: true }));
    expect(screen.getByRole("img", { name: "Ankur" })).toBeInTheDocument();
  });

  it("announces the active learning stage and keeps deferred revision visibly blocked", () => {
    render(createElement(GrowthRail, { stage: "assessment" }));
    expect(screen.getByText("Practice")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Revise").closest("li")).toHaveClass("growth-rail__step--blocked");
  });
});
