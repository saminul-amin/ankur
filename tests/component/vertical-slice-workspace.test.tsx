// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VerticalSliceWorkspace } from "../../src/presentation/features/vertical-slice/vertical-slice-workspace.js";

describe("vertical slice workspace", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("crypto", { randomUUID: () => "session-test-id" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: { liveAiEnabled: false } }),
    }));
  });

  it("completes the provider-free sample flow and reveals source evidence", async () => {
    const user = userEvent.setup();
    render(createElement(VerticalSliceWorkspace));

    await user.click(screen.getByRole("button", { name: "Try fixed offline sample" }));
    await user.click(screen.getByRole("button", { name: "Confirm source and build map" }));
    expect(await screen.findByText("সালোকসংশ্লেষণের পরিচয়")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Generate one grounded MCQ" }));
    await user.click(screen.getByRole("radio", { name: /B\. অক্সিজেন/u }));
    await user.click(screen.getByRole("button", { name: "Submit answer" }));

    expect(await screen.findByText("Correct — 1/1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /View source/u }));
    expect(screen.getByTestId("evidence-context")).toHaveTextContent("অক্সিজেন নির্গত হয়");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("preserves the confirmed source when live analysis fails", async () => {
    const user = userEvent.setup();
    const providerFailure = {
      ok: false,
      requestId: "request-failed",
      error: { code: "PROVIDER_TIMEOUT", message: "Generation took too long.", retryable: true },
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, data: { liveAiEnabled: true } }),
      } as Response)
      .mockResolvedValueOnce({ json: () => Promise.resolve(providerFailure) } as Response);
    render(createElement(VerticalSliceWorkspace));

    await user.type(
      screen.getByLabelText("Learning material"),
      "Plants use sunlight to turn water and carbon dioxide into food.",
    );
    await user.click(screen.getByRole("button", { name: "Review pasted text" }));
    await user.click(screen.getByRole("button", { name: "Confirm source and build map" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your confirmed source remains saved");
    expect(window.localStorage.getItem("ankur.vertical-slice.v1")).toContain("M01-P001-S001");
    expect(screen.getByLabelText("Editable extracted text")).toHaveValue(
      "Plants use sunlight to turn water and carbon dioxide into food.",
    );
  });
});
