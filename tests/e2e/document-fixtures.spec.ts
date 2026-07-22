import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

function transcriptionResponse(pageNumber: number) {
  return {
    ok: true,
    requestId: `fixture-${String(pageNumber)}`,
    data: {
      pageNumber,
      detectedLanguage: "bn",
      text: `পৃষ্ঠা ${String(pageNumber)}-এর বিশ্বস্ত বাংলা প্রতিলিপি। উদ্ভিদ সূর্যালোক ব্যবহার করে খাদ্য তৈরি করে এবং অক্সিজেন নির্গত করে।`,
      uncertainSegments: [],
      warnings: [],
      artifact: {
        provider: "gemini_api", modelId: "gemma-4-26b-a4b-it", task: "page_transcription",
        promptVersion: "page-transcription.v1", schemaVersion: "page-transcription.v1", thinkingLevel: "minimal",
        requestId: `fixture-${String(pageNumber)}`, createdAt: "2026-07-22T00:00:00.000Z", latencyMs: 10, repaired: false,
      },
    },
  };
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Browser document fixtures run once in desktop Chromium");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
});

test("renders a three-page digital PDF entirely in the browser without transcription", async ({ page }) => {
  let transcriptionCalls = 0;
  await page.route("**/api/transcriptions", async (route) => { transcriptionCalls += 1; await route.abort(); });
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await page.locator("#pdf-file").setInputFiles(resolve("evaluation/ingestion/fixtures/three-page-digital.pdf"));
  await expect(page.getByRole("heading", { name: "Page 3" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".ui-badge").filter({ hasText: "Embedded text" })).toHaveCount(3);
  expect(transcriptionCalls).toBe(0);
  await expect(page.locator(".page-preview img")).toHaveCount(3);
});

test("routes only the scanned page of a mixed PDF to one-image transcription", async ({ page }) => {
  const requestBodies: string[] = [];
  await page.route("**/api/transcriptions", async (route) => {
    const body = route.request().postData() ?? "";
    requestBodies.push(body);
    const parsed = JSON.parse(body) as { pageNumber: number };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(transcriptionResponse(parsed.pageNumber)) });
  });
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await page.locator("#pdf-file").setInputFiles(resolve("evaluation/ingestion/fixtures/three-page-mixed.pdf"));
  await expect(page.locator("#page-text-2")).toHaveValue(/বিশ্বস্ত বাংলা প্রতিলিপি/u, { timeout: 20_000 });
  expect(requestBodies).toHaveLength(1);
  expect(requestBodies[0]).not.toContain("%PDF");
  expect(requestBodies[0]).toContain('"pageNumber":2');
  expect(requestBodies[0]).toContain('"mimeType":"image/jpeg"');
  await expect(page.locator(".ui-badge").filter({ hasText: "Embedded text" })).toHaveCount(2);
  await expect(page.locator(".ui-badge").filter({ hasText: "Gemma draft" })).toHaveCount(1);
});

test("renders and transcribes all three pages of the selected scanned PDF", async ({ page }) => {
  let transcriptionCalls = 0;
  await page.route("**/api/transcriptions", async (route) => {
    transcriptionCalls += 1;
    const parsed = JSON.parse(route.request().postData() ?? "{}") as { pageNumber: number };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(transcriptionResponse(parsed.pageNumber)) });
  });
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await page.locator("#pdf-file").setInputFiles(resolve("evaluation/ingestion/fixtures/three-page-scanned.pdf"));
  await expect(page.locator("#page-text-3")).toHaveValue(/বিশ্বস্ত বাংলা প্রতিলিপি/u, { timeout: 30_000 });
  expect(transcriptionCalls).toBe(3);
  await expect(page.locator(".ui-badge").filter({ hasText: "Gemma draft" })).toHaveCount(3);
});

test("processes three standalone Bengali page images as ordered pages", async ({ page }) => {
  let transcriptionCalls = 0;
  await page.route("**/api/transcriptions", async (route) => {
    transcriptionCalls += 1;
    const parsed = JSON.parse(route.request().postData() ?? "{}") as { pageNumber: number };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(transcriptionResponse(parsed.pageNumber)) });
  });
  const image = resolve("evaluation/provider-spike/fixtures/bengali-page.png");
  await page.getByRole("button", { name: "Page images" }).click();
  await page.locator("#image-files").setInputFiles([image, image, image]);
  await expect(page.locator("#page-text-3")).toHaveValue(/বিশ্বস্ত বাংলা প্রতিলিপি/u, { timeout: 30_000 });
  expect(transcriptionCalls).toBe(3);
  await expect(page.getByRole("heading", { name: /^Page [123]$/u })).toHaveCount(3);
});

test("keeps completed page drafts editable when one provider request fails", async ({ page }) => {
  await page.route("**/api/transcriptions", async (route) => {
    const parsed = JSON.parse(route.request().postData() ?? "{}") as { pageNumber: number };
    if (parsed.pageNumber === 2) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({
        ok: false, requestId: "fixture-failure", error: { code: "PROVIDER_UNAVAILABLE", message: "The learning service is temporarily unavailable.", retryable: true },
      }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(transcriptionResponse(parsed.pageNumber)) });
  });
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await page.locator("#pdf-file").setInputFiles(resolve("evaluation/ingestion/fixtures/three-page-scanned.pdf"));
  await expect(page.locator("#page-text-3")).toHaveValue(/বিশ্বস্ত বাংলা প্রতিলিপি/u, { timeout: 30_000 });
  await expect(page.locator("#page-text-1")).toHaveValue(/বিশ্বস্ত বাংলা প্রতিলিপি/u);
  await expect(page.locator('[data-page="2"]').getByRole("alert")).toContainText("other reviewed pages are preserved");
  await page.locator("#page-text-2").fill("শিক্ষার্থী হাতে সংশোধিত পাঠ লিখেছেন।");
  await expect(page.locator("#page-text-1")).toHaveValue(/বিশ্বস্ত বাংলা প্রতিলিপি/u);
  await expect(page.locator("#page-text-2")).toHaveValue("শিক্ষার্থী হাতে সংশোধিত পাঠ লিখেছেন।");
});
