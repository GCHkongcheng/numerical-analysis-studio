import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

test("symbol keyboard inserts templates into the active matrix input", async ({ page }) => {
  await page.goto("/");

  const firstCell = page.locator(".matrix-input").first();
  await firstCell.click();
  await firstCell.fill("");

  await page.getByRole("button", { name: "打开符号键盘" }).click();
  await expect(page.getByRole("region", { name: "符号键盘" })).toBeVisible();
  await expect(page.locator(".symbol-keyboard-panel")).toHaveCSS("position", "fixed");
  await expect(page.locator(".symbol-keyboard-backdrop")).toHaveCount(0);
  await expect(page.locator(".symbol-keyboard-rows")).toHaveCSS("display", "grid");
  await expect(page.locator(".symbol-keyboard-row").first()).toHaveCSS("display", "grid");

  await page.getByRole("button", { name: "插入 sqrt()" }).click();
  await expect(firstCell).toHaveValue("sqrt()");

  await page.getByRole("button", { name: "插入 pi" }).click();
  await expect(firstCell).toHaveValue("sqrt(pi)");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "符号键盘" })).toBeHidden();
});

test("symbol keyboard appends exponent operators to selected input text", async ({ page }) => {
  await page.goto("/");

  const firstCell = page.locator(".matrix-input").first();
  await firstCell.click();
  await firstCell.fill("x");
  await firstCell.press("Control+A");

  await page.getByRole("button", { name: "打开符号键盘" }).click();
  await page.getByRole("button", { name: "插入 平方" }).click();

  await expect(firstCell).toHaveValue("x^2");
});

test("symbol keyboard keeps focus while moving the caret and deleting", async ({ page }) => {
  await page.goto("/");

  const firstCell = page.locator(".matrix-input").first();
  await firstCell.click();
  await firstCell.fill("123");

  await page.getByRole("button", { name: "打开符号键盘" }).click();
  await expect(firstCell).toBeFocused();

  await page.getByRole("button", { name: "插入 光标左移" }).click();
  await expect(firstCell).toBeFocused();

  await page.getByRole("button", { name: "插入 退格" }).click();
  await expect(firstCell).toHaveValue("13");
  await expect(firstCell).toBeFocused();
});

test("mobile math inputs use the custom keyboard instead of a virtual keyboard hint", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto("/");

  const firstCell = page.locator(".matrix-input").first();
  await firstCell.click();

  await expect(firstCell).toHaveAttribute("inputmode", "none");
  await expect(firstCell).toHaveCSS("font-size", "16px");
  await expect(page.locator(".symbol-keyboard-panel")).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/symbol-keyboard-open/);
  await expect(firstCell).toBeFocused();
});

test("all keyboard tabs stretch their rows across the full panel", async ({ page }) => {
  await page.goto("/");

  const firstCell = page.locator(".matrix-input").first();
  await firstCell.click();
  await page.locator(".symbol-keyboard-fab").click();

  const tabs = page.locator(".symbol-keyboard-tab");
  const tabCount = await tabs.count();

  for (let index = 0; index < tabCount; index += 1) {
    await tabs.nth(index).click();
    const widths = await page.evaluate(() => {
      const panel = document.querySelector(".symbol-keyboard-panel");
      const row = document.querySelector(".symbol-keyboard-row");
      return {
        panel: panel?.getBoundingClientRect().width ?? 0,
        row: row?.getBoundingClientRect().width ?? 0,
      };
    });

    expect(widths.row).toBeGreaterThan(widths.panel * 0.9);
  }
});
