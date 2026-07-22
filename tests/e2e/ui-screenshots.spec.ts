import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const output = "evaluation/ui";

async function buildSample(page: Page) {
  await page.getByRole("button", { name: "Try mixed-source sample" }).click();
  await page.getByRole("button", { name: "Confirm reviewed source" }).click();
  await page.getByRole("button", { name: "Build preparation map" }).click();
  await expect(page.getByRole("heading", { name: "Shape a small, revealing check." })).toBeVisible();
}

async function hideDevelopmentChrome(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

test("captures the Task 04 mixed-assessment UI inventory", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Single deterministic screenshot inventory");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await hideDevelopmentChrome(page);
  await buildSample(page);
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/assessment-builder-desktop.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/assessment-builder-mobile.png`, fullPage: true });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Generate mixed assessment" }).click();
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/assessment-mcq-desktop.png`, fullPage: true });
  await page.getByRole("radio", { name: /^B\./u }).check();
  await page.getByRole("button", { name: "Next question" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/assessment-written-mobile.png`, fullPage: true });
  await page.getByRole("button", { name: "Review and submit" }).click();
  await page.screenshot({ path: `${output}/assessment-submit-confirmation.png`, fullPage: true });
  await page.getByRole("button", { name: "Keep editing" }).click();

  await page.evaluate(() => {
    const key = "ankur.ingestion-session.v3";
    const raw = localStorage.getItem(key);
    if (raw === null) throw new Error("Expected a persisted assessment.");
    const state = JSON.parse(raw) as { mode: string };
    state.mode = "live";
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.route("**/api/written-evaluations", async (route) => {
    const body = route.request().postDataJSON() as {
      operationId: string;
      sourceVersionId: string;
      question: {
        id: string;
        requiredConceptIds: string[];
        evidence: Array<{ segmentId: string; quote?: string }>;
        rubric: Array<{ id: string; maximumMarks: number; requiredConceptIds: string[] }>;
      };
    };
    const first = body.question.rubric[0];
    if (first === undefined) throw new Error("Expected a rubric criterion.");
    const covered = [...new Set(first.requiredConceptIds)];
    const missing = body.question.requiredConceptIds.filter((id) => !covered.includes(id));
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 3_000));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        requestId: "task04-screenshot-request",
        data: {
          schemaVersion: "written-evaluation.v1",
          questionId: body.question.id,
          sourceVersionId: body.sourceVersionId,
          awardedMarks: first.maximumMarks,
          maximumMarks: 5,
          status: "partially_correct",
          criterionResults: body.question.rubric.map((criterion, index) => ({
            criterionId: criterion.id,
            awardedMarks: index === 0 ? criterion.maximumMarks : 0,
            maximumMarks: criterion.maximumMarks,
            state: index === 0 ? "met" : "not_met",
            reason: index === 0 ? "The answer covers this source-grounded criterion." : "This criterion is not yet present in the answer.",
          })),
          coveredConceptIds: covered,
          missingConceptIds: missing,
          incorrectClaims: [],
          unsupportedClaims: [],
          feedback: "A useful start. Add the missing source-grounded roles and result.",
          evidence: body.question.evidence,
          recommendedRevisionConceptIds: missing,
          artifact: {
            provider: "gemini_api",
            modelId: "gemma-4-26b-a4b-it",
            task: "written_evaluation",
            promptVersion: "written-evaluation.v1",
            schemaVersion: "written-evaluation.v1",
            thinkingLevel: "high",
            requestId: body.operationId,
            createdAt: "2026-07-22T00:00:00.000Z",
            latencyMs: 3000,
            repaired: false,
          },
        },
      }),
    });
  });
  await page.reload();
  await hideDevelopmentChrome(page);
  await expect(page.getByLabel("Your short answer")).not.toHaveValue("");
  await page.getByRole("button", { name: "Review and submit" }).click();
  await page.getByRole("button", { name: "Confirm submission" }).click();
  await expect(page.getByText(/Gemma 4 is reconciling each rubric criterion/u)).toBeVisible();
  await page.screenshot({ path: `${output}/assessment-written-grading-loading.png`, fullPage: true });
  await expect(page.getByRole("heading", { name: "Your mixed assessment result" })).toBeVisible({ timeout: 10_000 });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/mixed-result-desktop.png`, fullPage: true });
  await page.locator(".rubric-breakdown").screenshot({ path: `${output}/mixed-result-rubric.png` });
  await page.locator(".weak-concepts").screenshot({ path: `${output}/mixed-result-weak-concepts.png` });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#workspace").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/mixed-result-mobile.png`, fullPage: true });
});
