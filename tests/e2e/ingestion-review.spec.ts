import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Try mixed-source sample" }).click();
});

test("reviews a mixed source, recovers it, and preserves page-grounded evidence", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Page 1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Page 2" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Page 3" })).toBeVisible();
  await page.locator("#page-text-2").fill("উদ্ভিদ পানি ও কার্বন ডাই-অক্সাইড ব্যবহার করে খাদ্য তৈরি করে। এই প্রক্রিয়াকে সালোকসংশ্লেষণ বলা হয় এবং এতে অক্সিজেন নির্গত হয়। সংশোধিত পাঠ।");
  const pageThree = page.locator('[data-page="3"]');
  await pageThree.getByRole("checkbox").uncheck();
  await expect(pageThree).toHaveClass(/is-excluded/u);
  await pageThree.getByRole("checkbox").check();
  await page.getByLabel("Learner priority").fill("উপকরণ ও ফলাফলে গুরুত্ব দিন");
  await page.getByRole("button", { name: "Confirm reviewed source" }).click();
  await expect(page.getByRole("heading", { name: /evidence boundary/u })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: /evidence boundary/u })).toBeVisible();
  await expect(page.getByText("উপকরণ ও ফলাফলে গুরুত্ব দিন")).toBeVisible();
  await page.getByRole("button", { name: "Build preparation map" }).click();
  await page.getByRole("button", { name: "Generate mixed assessment" }).click();
  await page.getByRole("radio", { name: /B\. অক্সিজেন/u }).check();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Review and submit" }).click();
  await page.getByRole("button", { name: "Confirm submission" }).click();
  await expect(page.getByText("3 / 6")).toBeVisible();
  await page.getByRole("button", { name: /Page 2.*View source/u }).first().click();
  await expect(page.getByTestId("evidence-context").first()).toContainText("অক্সিজেন নির্গত হয়");
  await expect(page.getByRole("button", { name: /Page 2/u }).first()).toBeVisible();
});

test("critical review controls are keyboard operable", async ({ page }) => {
  const pageTwoEditor = page.locator("#page-text-2");
  await pageTwoEditor.focus();
  await page.keyboard.press("End");
  await page.keyboard.type(" ঠিক");
  const include = page.locator('[data-page="2"]').getByRole("checkbox");
  await include.focus();
  await page.keyboard.press("Space");
  await expect(include).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(include).toBeChecked();
  await page.getByLabel("Learner priority").focus();
  await page.keyboard.type("মূল ধারণা");
  const confirm = page.getByRole("button", { name: "Confirm reviewed source" });
  await confirm.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /evidence boundary/u })).toBeVisible();
});

test("review and confirmed states have no WCAG A/AA violations or mobile overflow", async ({ page }) => {
  const reviewResults = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(reviewResults.violations).toEqual([]);
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  await page.getByRole("button", { name: "Confirm reviewed source" }).click();
  const confirmedResults = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(confirmedResults.violations).toEqual([]);
});
