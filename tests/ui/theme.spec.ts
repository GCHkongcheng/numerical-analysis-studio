import { expect, test } from "@playwright/test";

test("theme toggle persists the selected theme across reloads", async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem("nas-theme")) {
      window.localStorage.setItem("nas-theme", "light");
    }
  });

  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page
    .getByRole("button", { name: "切换到深邃极光主题" })
    .click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("nas-theme")))
    .toBe("dark");

  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "切换到暖阳纸张主题" })
  ).toBeVisible();
});
