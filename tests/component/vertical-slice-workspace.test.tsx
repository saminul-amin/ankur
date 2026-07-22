// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VerticalSliceWorkspace } from "../../src/presentation/features/vertical-slice/vertical-slice-workspace.js";

describe("vertical slice workspace", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() });
    vi.stubGlobal("crypto", { randomUUID: () => "session-test-id" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true, data: { liveAiEnabled: false, sampleModeEnabled: true } }),
    }));
  });

  it("completes the provider-free sample flow and reveals source evidence", async () => {
    const user = userEvent.setup();
    render(createElement(VerticalSliceWorkspace));

    await user.click(screen.getByRole("button", { name: "Try mixed-source sample" }));
    expect(screen.getAllByRole("heading", { name: /Page [123]/u })).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Confirm reviewed source" }));
    expect(screen.getByText(/source-[a-f0-9]+/u)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Build preparation map" }));
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
    await user.click(screen.getByRole("button", { name: "Confirm reviewed source" }));
    await user.click(screen.getByRole("button", { name: "Build preparation map" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Completed extraction and review work remains saved");
    expect(window.localStorage.getItem("ankur.ingestion-session.v2")).toContain("M01-P001-S001");
    await user.click(screen.getByRole("button", { name: /Edit reviewed pages/u }));
    expect(screen.getByLabelText("Editable extraction")).toHaveValue(
      "Plants use sunlight to turn water and carbon dioxide into food.",
    );
  });

  it("rejects malformed persisted UI state and returns to a safe empty source stage", () => {
    window.localStorage.setItem("ankur.ingestion-session.v2", JSON.stringify({ schemaVersion: 1, stage: "results", confirmedSource: { segments: [] } }));
    render(createElement(VerticalSliceWorkspace));

    expect(screen.getByRole("heading", { name: "What would you like to learn?" })).toBeInTheDocument();
    expect(screen.getByLabelText("Learning material")).toHaveValue("");
    expect(screen.queryByText("Correct — 1/1")).not.toBeInTheDocument();
  });

  it("edits, excludes, prioritizes, confirms, and invalidates stale generated artifacts", async () => {
    const user = userEvent.setup();
    render(createElement(VerticalSliceWorkspace));
    await user.click(screen.getByRole("button", { name: "Try mixed-source sample" }));
    const pageTwo = screen.getByLabelText("Editable extraction", { selector: "#page-text-2" });
    await user.type(pageTwo, " সংশোধিত");
    const pageThreeInclude = screen.getAllByRole("checkbox")[2];
    expect(pageThreeInclude).toBeDefined();
    if (pageThreeInclude === undefined) return;
    await user.click(pageThreeInclude);
    await user.click(pageThreeInclude);
    await user.type(screen.getByLabelText("Learner priority"), "উপকরণ ও ফলাফল");
    await user.click(screen.getByRole("button", { name: "Confirm reviewed source" }));
    await user.click(screen.getByRole("button", { name: "Build preparation map" }));
    expect(await screen.findByText("সালোকসংশ্লেষণের পরিচয়")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit source" }));
    await user.type(screen.getByLabelText("Editable extraction", { selector: "#page-text-1" }), " নতুন");
    expect(screen.queryByText("সালোকসংশ্লেষণের পরিচয়")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm reviewed source" })).toBeEnabled();
  });

  it("shows the unavailable runtime state without exposing provider details", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network details that must not appear"));
    render(createElement(VerticalSliceWorkspace));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Live mode unavailable"));
    expect(screen.getByText(/the complete mixed sample remains available/u)).toBeInTheDocument();
    expect(screen.queryByText(/network details/u)).not.toBeInTheDocument();
  });
});
