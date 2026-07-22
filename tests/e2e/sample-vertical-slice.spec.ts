import { expect, test } from "@playwright/test";

test("completes the fixed offline sample journey", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try fixed offline sample" }).click();
  await page.getByRole("button", { name: "Confirm source and build map" }).click();
  await expect(page.getByText("সালোকসংশ্লেষণের পরিচয়")).toBeVisible();
  await page.getByRole("button", { name: "Generate one grounded MCQ" }).click();
  await page.getByRole("radio", { name: /B\. অক্সিজেন/u }).check();
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByText("Correct — 1/1")).toBeVisible();
  await page.getByRole("button", { name: /View source/u }).click();
  await expect(page.getByTestId("evidence-context")).toContainText("অক্সিজেন নির্গত হয়");
});
