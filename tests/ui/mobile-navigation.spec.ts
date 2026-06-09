import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

test("mobile navigation drawer switches modules and closes after selection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "打开导航菜单" }).click();
  await expect(page.getByText("导航菜单")).toBeVisible();

  await page
    .getByRole("button", { name: "线性方程组 直接法与迭代法" })
    .click();

  await expect(page.getByRole("heading", { name: "线性方程组" })).toBeVisible();
  await expect(page.getByText("导航菜单")).toBeHidden();
});
