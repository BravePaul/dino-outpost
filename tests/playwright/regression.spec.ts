import { test } from "@playwright/test";

const OUT_DIR = "test-results/regression/current";

test.use({ viewport: { width: 1280, height: 720 } });
test.describe.configure({ mode: "serial", timeout: 60_000 });

test("regression-capture: 01 briefing screen", async ({ page }) => {
  await page.goto("/");
  await page.locator("canvas#gameCanvas").waitFor({ state: "visible" });
  await page.getByRole("button", { name: /start mission/i }).waitFor();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT_DIR}/01-briefing.png` });
});

test("regression-capture: 02 mission early frame", async ({ page }) => {
  await page.goto("/");
  await page.locator("canvas#gameCanvas").waitFor({ state: "visible" });
  await page.getByRole("button", { name: /start mission/i }).click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT_DIR}/02-mission-early.png` });
});

test("regression-capture: 03 mission mid frame", async ({ page }) => {
  await page.goto("/");
  await page.locator("canvas#gameCanvas").waitFor({ state: "visible" });
  await page.getByRole("button", { name: /start mission/i }).click();
  await page.waitForTimeout(15000);
  await page.screenshot({ path: `${OUT_DIR}/03-mission-mid.png` });
});
