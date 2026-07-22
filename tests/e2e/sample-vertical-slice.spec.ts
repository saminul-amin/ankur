import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function startSample(page: Page) {
  await page.getByRole("button", { name: "Try mixed-source sample" }).click();
  await page.getByRole("button", { name: "Confirm reviewed source" }).click();
  await page.getByRole("button", { name: "Build preparation map" }).click();
  await expect(page.getByRole("heading", { name: "সালোকসংশ্লেষণের পরিচয়" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
});

test("completes the fixed offline sample journey with valid evidence", async ({ page }) => {
  await page.getByRole("button", { name: "Start learning" }).click();
  await expect(page.locator("#workspace")).toBeFocused();
  await startSample(page);
  await page.getByRole("button", { name: "Generate one grounded MCQ" }).click();
  await page.getByRole("radio", { name: /B\. অক্সিজেন/u }).check();
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByText("Correct — 1/1")).toBeVisible();
  await page.getByRole("button", { name: /View source/u }).click();
  await expect(page.getByTestId("evidence-context")).toContainText("অক্সিজেন নির্গত হয়");
});

test("critical source and assessment controls are keyboard operable", async ({ page }) => {
  const sample = page.getByRole("button", { name: "Try mixed-source sample" });
  await sample.focus();
  await expect(sample).toBeFocused();
  await page.keyboard.press("Enter");
  const confirm = page.getByRole("button", { name: "Confirm reviewed source" });
  await confirm.focus();
  await page.keyboard.press("Enter");
  const build = page.getByRole("button", { name: "Build preparation map" });
  await build.focus();
  await page.keyboard.press("Enter");
  const generate = page.getByRole("button", { name: "Generate one grounded MCQ" });
  await generate.focus();
  await page.keyboard.press("Enter");
  const option = page.getByRole("radio", { name: /B\. অক্সিজেন/u });
  await option.focus();
  await page.keyboard.press("Space");
  await expect(option).toBeChecked();
  const submit = page.getByRole("button", { name: "Submit answer" });
  await submit.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Correct — 1/1")).toBeVisible();
});

test("has no automated WCAG A/AA violations in the source and result states", async ({ page }) => {
  const sourceResults = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(sourceResults.violations).toEqual([]);

  await startSample(page);
  await page.getByRole("button", { name: "Generate one grounded MCQ" }).click();
  await page.getByRole("radio", { name: /B\. অক্সিজেন/u }).check();
  await page.getByRole("button", { name: "Submit answer" }).click();
  const resultResults = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(resultResults.violations).toEqual([]);
});

test("reduced motion removes meaningful transition duration", async ({ page }) => {
  await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  const duration = await page.getByRole("button", { name: "Start learning" }).evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration));
  expect(duration).toBeLessThan(0.001);
});
