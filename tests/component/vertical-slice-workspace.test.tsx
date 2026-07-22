// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VerticalSliceWorkspace } from "../../src/presentation/features/vertical-slice/vertical-slice-workspace.js";
import {
  createSampleActivitySet,
  createSamplePreparationMap,
  createSampleSource,
  SAMPLE_PARTIAL_WRITTEN_ANSWER,
} from "../../src/application/sample/sample-vertical-slice.js";
import { toPersistedIngestionSession } from "../../src/presentation/persistence/ingestion-session.js";

describe("vertical slice workspace", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() });
    vi.stubGlobal("crypto", { randomUUID: () => "session-test-id" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: true, data: { liveAiEnabled: false, sampleModeEnabled: true } }) }));
  });

  it("completes the provider-free mixed sample and reveals rubric, diagnosis, and evidence", async () => {
    const user = userEvent.setup();
    render(createElement(VerticalSliceWorkspace));
    await user.click(screen.getByRole("button", { name: "Try mixed-source sample" }));
    expect(screen.getAllByRole("heading", { name: /Page [123]/u })).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Confirm reviewed source" }));
    await user.click(screen.getByRole("button", { name: "Build preparation map" }));
    expect(await screen.findByText("সালোকসংশ্লেষণের পরিচয়")).toBeInTheDocument();
    expect(screen.getByText(/Fixed composition · 6 marks/u)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Generate mixed assessment" }));
    expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /B\. অক্সিজেন/u }));
    await user.click(screen.getByRole("button", { name: /Next question/u }));
    expect(screen.getByLabelText<HTMLTextAreaElement>("Your short answer").value).toMatch(/পানি ও কার্বন ডাই-অক্সাইড/u);
    const reviewButton = screen.getByRole("button", { name: "Review and submit" });
    await user.click(reviewButton);
    expect(screen.getByRole("dialog")).toHaveTextContent("Both answers are ready");
    expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(reviewButton).toHaveFocus();
    await user.click(reviewButton);
    await user.click(screen.getByRole("button", { name: "Confirm submission" }));
    expect(await screen.findByText("3 / 6")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How the written mark was built" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Weak concepts, ordered by urgency" })).toBeInTheDocument();
    const evidenceButtons = screen.getAllByRole("button", { name: /View source/u });
    const firstEvidence = evidenceButtons[0];
    expect(firstEvidence).toBeDefined();
    if (firstEvidence !== undefined) await user.click(firstEvidence);
    expect(screen.getAllByTestId("evidence-context")[0]).toHaveTextContent("অক্সিজেন নির্গত হয়");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("preserves the confirmed source when live analysis fails", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true, data: { liveAiEnabled: true } }) } as Response)
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: false, requestId: "request-failed", error: { code: "PROVIDER_TIMEOUT", message: "Generation took too long.", retryable: true } }) } as Response);
    render(createElement(VerticalSliceWorkspace));
    await user.type(screen.getByLabelText("Learning material"), "Plants use sunlight to turn water and carbon dioxide into food.");
    await user.click(screen.getByRole("button", { name: "Review pasted text" }));
    await user.click(screen.getByRole("button", { name: "Confirm reviewed source" }));
    await user.click(screen.getByRole("button", { name: "Build preparation map" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Confirmed source, review work, and entered answers remain saved");
    expect(window.localStorage.getItem("ankur.ingestion-session.v3")).toContain("M01-P001-S001");
    await user.click(screen.getByRole("button", { name: /Edit reviewed pages/u }));
    expect(screen.getByLabelText("Editable extraction")).toHaveValue("Plants use sunlight to turn water and carbon dioxide into food.");
  });

  it("rejects malformed persisted state safely", () => {
    window.localStorage.setItem("ankur.ingestion-session.v3", JSON.stringify({ schemaVersion: 1, stage: "results" }));
    render(createElement(VerticalSliceWorkspace));
    expect(screen.getByRole("heading", { name: "What would you like to learn?" })).toBeInTheDocument();
    expect(screen.queryByText("3 / 6")).not.toBeInTheDocument();
  });

  it("edits the source and invalidates stale generated artifacts", async () => {
    const user = userEvent.setup();
    render(createElement(VerticalSliceWorkspace));
    await user.click(screen.getByRole("button", { name: "Try mixed-source sample" }));
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

  it("preserves both answers and the assessment when written grading fails", async () => {
    const source = createSampleSource();
    const map = createSamplePreparationMap(source);
    const activity = createSampleActivitySet(source, map);
    window.localStorage.setItem("ankur.ingestion-session.v3", toPersistedIngestionSession({
      stage: "assessment",
      mode: "live",
      sourceKind: "text",
      pages: [],
      priorityInstruction: "",
      confirmedSource: source,
      preparationMap: map,
      assessmentConfiguration: { title: activity.title, selectedConceptIds: map.concepts.map((concept) => concept.id), difficulty: "medium" },
      activitySet: activity,
      selectedOptionId: "B",
      writtenAnswer: SAMPLE_PARTIAL_WRITTEN_ANSWER,
      currentQuestionIndex: 1,
    }));
    vi.mocked(fetch)
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true, data: { liveAiEnabled: true } }) } as Response)
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: false, requestId: "written-failed", error: { code: "PROVIDER_TIMEOUT", message: "Generation took too long.", retryable: true } }) } as Response);
    const user = userEvent.setup();
    render(createElement(VerticalSliceWorkspace));
    expect(await screen.findByLabelText("Your short answer")).toHaveValue(SAMPLE_PARTIAL_WRITTEN_ANSWER);
    await user.click(screen.getByRole("button", { name: "Review and submit" }));
    await user.click(screen.getByRole("button", { name: "Confirm submission" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your answers and assessment remain saved");
    expect(screen.getByLabelText("Your short answer")).toHaveValue(SAMPLE_PARTIAL_WRITTEN_ANSWER);
    expect(window.localStorage.getItem("ankur.ingestion-session.v3")).toContain(SAMPLE_PARTIAL_WRITTEN_ANSWER);
    expect(screen.getByRole("button", { name: "Review and submit" })).toBeEnabled();
  });
});
