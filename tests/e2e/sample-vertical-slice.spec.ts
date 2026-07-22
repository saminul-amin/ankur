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
  await expect(page.getByRole("heading", { name: "Weak concepts, ordered by urgency" })).toBeVisible();
  const evidenceButtons = page.getByRole("button", { name: /View source/u });
  await expect(evidenceButtons.first()).toBeVisible();
  await evidenceButtons.first().click();
  await expect(page.getByTestId("evidence-context").first()).toContainText("অক্সিজেন");

  await page.reload();
  await expect(page.getByText("3 / 6")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Concept performance" })).toBeVisible();
  await page.getByRole("button", { name: "Clear session" }).click();
  await expect(page.getByRole("heading", { name: "What would you like to learn?" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ankur.ingestion-session.v3"))).toBeNull();
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
});

test("honors reduced motion and avoids horizontal overflow", async ({ page }) => {
  await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  const duration = await page.getByRole("button", { name: "Start learning" }).evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration));
  expect(duration).toBeLessThan(0.001);
  await completeAssessment(page);
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});
