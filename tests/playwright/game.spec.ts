import { expect, test } from "@playwright/test";

test("starts a playable browser mission and updates ammo after firing", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas#gameCanvas")).toBeVisible();
  await expect(page.getByRole("button", { name: /start mission/i })).toBeVisible();
  await page.getByRole("button", { name: /start mission/i }).click();
  await expect(page.locator('[data-hud="timer"]')).toContainText(/109|110|108/);
  await expect(page.locator('[data-hud="weapon"]')).toContainText("MARKSMAN");
  await page.keyboard.press("Digit1");
  await expect(page.locator('[data-hud="weapon"]')).toContainText("CARBINE");
  await page.keyboard.press("Digit3");
  await expect(page.locator('[data-hud="weapon"]')).toContainText("SHOTGUN");
  await page.keyboard.press("Digit2");
  await page.mouse.click(640, 360, { button: "right" });
  await expect(page.locator("#hud")).toHaveClass(/scoped/);
  await page.mouse.click(640, 360, { button: "right" });
  await expect(page.locator("#hud")).not.toHaveClass(/scoped/);
  const ammoBefore = await page.locator('[data-hud="ammo"]').innerText();
  await page.mouse.click(640, 360);
  await expect(page.locator('[data-hud="ammo"]')).not.toHaveText(ammoBefore);
});
