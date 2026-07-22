import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const output = "evaluation/ui";

test("captures the required deterministic UI inventory", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Single deterministic screenshot inventory");
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Turn what you read/u })).toBeVisible();
  await page.screenshot({ path: `${output}/landing-desktop.png`, fullPage: true });

  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/source-desktop.png`, fullPage: true });
  await page.screenshot({ path: `${output}/ingestion-source-selection-desktop.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.screenshot({ path: `${output}/landing-mobile.png`, fullPage: true });
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/source-mobile.png`, fullPage: true });
  await page.screenshot({ path: `${output}/ingestion-source-selection-mobile.png`, fullPage: true });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "Page images" }).click();
  await page.route("**/api/transcriptions", async (route) => {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 8_000));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, requestId: "screenshot-request", data: {
        pageNumber: 1, detectedLanguage: "bn", text: "পাতার ক্লোরোফিল সূর্যালোক শোষণ করে এবং উদ্ভিদ খাদ্য তৈরি করে।",
        uncertainSegments: [{ text: "ক্লোরোফিল", reason: "Check the middle consonant cluster." }],
        warnings: ["Review the heading spacing."],
        artifact: { provider: "gemini_api", modelId: "gemma-4-26b-a4b-it", task: "page_transcription", promptVersion: "page-transcription.v1", schemaVersion: "page-transcription.v1", thinkingLevel: "minimal", requestId: "screenshot-request", createdAt: "2026-07-22T00:00:00.000Z", latencyMs: 10, repaired: false },
      } }),
    });
  });
  await page.locator("#image-files").setInputFiles(resolve("evaluation/provider-spike/fixtures/bengali-page.png"));
  await expect(page.getByText(/Transcribing page 1/u)).toBeVisible();
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/ingestion-page-processing-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/ingestion-page-processing-mobile.png`, fullPage: true });
  await expect(page.locator("#page-text-1")).toHaveValue(/ক্লোরোফিল/u, { timeout: 20_000 });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Clear session" }).click();
  await page.getByRole("button", { name: "Try mixed-source sample" }).click();
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/review-desktop.png`, fullPage: true });
  await page.screenshot({ path: `${output}/ingestion-review-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/ingestion-review-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-page="2"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/ingestion-warning-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-page="2"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/ingestion-warning-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Confirm reviewed source" }).click();
  await page.screenshot({ path: `${output}/ingestion-confirmed-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/ingestion-confirmed-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Build preparation map" }).click();
  await expect(page.getByRole("heading", { name: "সালোকসংশ্লেষণের পরিচয়" })).toBeVisible();
  await page.screenshot({ path: `${output}/preparation-map-desktop.png`, fullPage: true });
  await page.getByRole("button", { name: "Generate one grounded MCQ" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/assessment-mobile.png`, fullPage: true });
  await page.getByRole("radio", { name: /B\. অক্সিজেন/u }).check();
  await page.getByRole("button", { name: "Submit answer" }).click();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await expect(page.getByText("Correct — 1/1")).toBeVisible();
  await page.screenshot({ path: `${output}/result-desktop.png`, fullPage: true });
});
