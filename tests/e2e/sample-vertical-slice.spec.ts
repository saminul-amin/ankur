import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const axeTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function openBuilder(page: Page) {
  await page.getByRole("button", { name: "Try mixed-source sample" }).click();
  await page.getByRole("button", { name: "Confirm reviewed source" }).click();
  await page.getByRole("button", { name: "Build preparation map" }).click();
  await expect(page.getByRole("heading", { name: "Shape a small, revealing check." })).toBeVisible();
  await expect(page.getByText("Fixed composition · 6 marks")).toBeVisible();
}

async function openAssessment(page: Page) {
  await openBuilder(page);
  await page.getByRole("button", { name: "Generate mixed assessment" }).click();
  await expect(page.getByText("Question 1 of 2")).toBeVisible();
}

async function completeAssessment(page: Page) {
  await openAssessment(page);
  await page.getByRole("radio", { name: /^B\./u }).check();
  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page.getByText("Question 2 of 2")).toBeVisible();
  await expect(page.getByLabel("Your short answer")).not.toHaveValue("");
  await page.getByRole("button", { name: "Review and submit" }).click();
  await expect(page.getByRole("dialog")).toContainText("Both answers are ready");
  await page.getByRole("button", { name: "Confirm submission" }).click();
  await expect(page.getByText("3 / 6")).toBeVisible();
}

async function completeAdaptiveRetry(page: Page) {
  await page.getByRole("button", { name: "Build revision plan" }).click();
  await expect(page.getByTestId("revision-plan")).toBeVisible();
  await page.getByRole("button", { name: "Start Weak-Area Retry" }).click();
  await expect(page.getByText("Focused retry")).toBeVisible();
  await page.getByRole("radio", { name: /^A\./u }).check();
  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page.getByLabel("Your short answer")).not.toHaveValue("");
  await page.getByRole("button", { name: "Review and submit" }).click();
  await expect(page.getByRole("dialog")).toContainText("Retry submission");
  await page.getByRole("button", { name: "Confirm submission" }).click();
  await expect(page.getByTestId("adaptive-result")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
});

test("completes and safely recovers the provider-free mixed assessment", async ({ page }) => {
  await page.getByRole("button", { name: "Start learning" }).click();
  await expect(page.locator("#workspace")).toBeFocused();
  await completeAssessment(page);

  await expect(page.getByText("MCQ · 1/1")).toBeVisible();
  await expect(page.getByText("Written · 2/5")).toBeVisible();
  await expect(page.getByRole("heading", { name: "How the written mark was built" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review targets, ordered by urgency" })).toBeVisible();
  const evidenceButtons = page.getByRole("button", { name: /View source/u });
  await expect(evidenceButtons.first()).toBeVisible();
  await evidenceButtons.first().click();
  await expect(page.getByTestId("evidence-context").first()).toContainText("অক্সিজেন");

  await page.getByRole("button", { name: "Build revision plan" }).click();
  await expect(page.getByTestId("revision-plan")).toBeVisible();
  await page.getByRole("button", { name: /View source/u }).first().click();
  await expect(page.getByTestId("evidence-context").first()).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("revision-plan")).toBeVisible();
  await page.getByRole("button", { name: "Start Weak-Area Retry" }).click();
  await page.getByRole("radio", { name: /^A\./u }).check();
  await page.getByRole("button", { name: "Next question" }).click();
  const retryAnswer = await page.getByLabel("Your short answer").inputValue();
  await page.reload();
  await expect(page.getByLabel("Your short answer")).toHaveValue(retryAnswer);
  await page.getByRole("button", { name: "Review and submit" }).click();
  await page.getByRole("button", { name: "Confirm submission" }).click();
  await expect(page.getByRole("heading", { name: "Retry performance improved." })).toBeVisible();
  await expect(page.getByText(/Original/u).first()).toBeVisible();
  await expect(page.getByText(/Retry/u).first()).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("adaptive-result")).toBeVisible();
  await page.getByRole("button", { name: "Clear session" }).click();
  await expect(page.getByRole("heading", { name: "What would you like to learn?" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ankur.ingestion-session.v4"))).toBeNull();
});

test("critical mixed-assessment controls are keyboard operable", async ({ page }) => {
  const sample = page.getByRole("button", { name: "Try mixed-source sample" });
  await sample.focus();
  await page.keyboard.press("Enter");
  const confirmSource = page.getByRole("button", { name: "Confirm reviewed source" });
  await confirmSource.focus();
  await page.keyboard.press("Enter");
  const build = page.getByRole("button", { name: "Build preparation map" });
  await build.focus();
  await page.keyboard.press("Enter");
  const hard = page.getByRole("button", { name: "Hard" });
  await hard.focus();
  await page.keyboard.press("Enter");
  await expect(hard).toHaveAttribute("aria-pressed", "true");
  const generate = page.getByRole("button", { name: "Generate mixed assessment" });
  await generate.focus();
  await page.keyboard.press("Enter");
  const option = page.getByRole("radio", { name: /^B\./u });
  await option.focus();
  await page.keyboard.press("Space");
  await expect(option).toBeChecked();
  const next = page.getByRole("button", { name: "Next question" });
  await next.focus();
  await page.keyboard.press("Enter");
  const written = page.getByLabel("Your short answer");
  await written.focus();
  await page.keyboard.press("End");
  await page.keyboard.type(" আরও একটি কথা।");
  const review = page.getByRole("button", { name: "Review and submit" });
  await review.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Keep editing" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(review).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Confirm submission" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("3 / 6")).toBeVisible();
  const revise = page.getByRole("button", { name: "Build revision plan" });
  await revise.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("revision-plan")).toBeVisible();
  const startRetry = page.getByRole("button", { name: "Start Weak-Area Retry" });
  await startRetry.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Focused retry")).toBeVisible();
});

test("has no automated WCAG A/AA violations across builder, player, and results", async ({ page }) => {
  expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations).toEqual([]);
  await openBuilder(page);
  expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Generate mixed assessment" }).click();
  expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Review and submit" }).click();
  expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Confirm submission" }).click();
  await expect(page.getByText("2 / 6")).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Build revision plan" }).click();
  await expect(page.getByTestId("revision-plan")).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Start Weak-Area Retry" }).click();
  expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Review and submit" }).click();
  await page.getByRole("button", { name: "Confirm submission" }).click();
  await expect(page.getByTestId("adaptive-result")).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations).toEqual([]);
});

test("does not fabricate weakness when every assessed concept is mastered", async ({ page }) => {
  await completeAssessment(page);
  await page.evaluate(() => {
    const key = "ankur.ingestion-session.v4";
    const raw = localStorage.getItem(key);
    if (raw === null) throw new Error("Expected persisted result.");
    const state = JSON.parse(raw) as {
      writtenEvaluation: {
        awardedMarks: number; status: string; criterionResults: Array<{ awardedMarks: number; maximumMarks: number; state: string }>;
        coveredConceptIds: string[]; missingConceptIds: string[]; recommendedRevisionConceptIds: string[];
      };
      activitySet: { questions: [unknown, { requiredConceptIds: string[] }] };
    };
    state.writtenEvaluation.awardedMarks = 5;
    state.writtenEvaluation.status = "correct";
    state.writtenEvaluation.criterionResults = state.writtenEvaluation.criterionResults.map((criterion) => ({ ...criterion, awardedMarks: criterion.maximumMarks, state: "met" }));
    state.writtenEvaluation.coveredConceptIds = state.activitySet.questions[1].requiredConceptIds;
    state.writtenEvaluation.missingConceptIds = [];
    state.writtenEvaluation.recommendedRevisionConceptIds = [];
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "All assessed concepts are mastered" })).toBeVisible();
  await expect(page.getByText(/No weakness is being fabricated/u)).toBeVisible();
  await page.getByRole("button", { name: "Take challenge retry" }).click();
  await expect(page.getByText("Challenge Retry", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("revision-plan")).toContainText("দুর্বল নয়");
});

test("honors reduced motion and avoids horizontal overflow", async ({ page }) => {
  await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  const duration = await page.getByRole("button", { name: "Start learning" }).evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration));
  expect(duration).toBeLessThan(0.001);
  await completeAssessment(page);
  await completeAdaptiveRetry(page);
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});
