// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VerticalSliceWorkspace } from "../../src/presentation/features/vertical-slice/vertical-slice-workspace.js";
import { THEME_STORAGE_KEY } from "../../src/presentation/components/ui/theme-toggle.js";

describe("appearance control and workspace focus", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() });
    vi.stubGlobal("crypto", { randomUUID: () => "session-test-id" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: { liveAiEnabled: false, sampleModeEnabled: true } }),
    }));
  });

  it("persists an explicit appearance choice and applies it to the document", async () => {
    const user = userEvent.setup();
    render(createElement(VerticalSliceWorkspace));
    const toggle = await screen.findByRole("button", { name: "Switch to dark appearance" });
    await user.click(toggle);
    expect(document.documentElement.dataset["theme"]).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    await user.click(screen.getByRole("button", { name: "Switch to light appearance" }));
    expect(document.documentElement.dataset["theme"]).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("hides the marketing introduction once the learner is inside the flow", async () => {
    const user = userEvent.setup();
    render(createElement(VerticalSliceWorkspace));
    expect(screen.getByRole("heading", { name: /Turn what you read/u })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How it works" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try mixed-source sample" }));

    expect(screen.queryByRole("heading", { name: /Turn what you read/u })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "How it works" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Make the extraction trustworthy." })).toBeInTheDocument();
  });
});
