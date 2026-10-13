import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "Passw0rd!123";

async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL(/\/(employee)?$/, {
    timeout: 20_000,
    waitUntil: "domcontentloaded",
  });
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

test.describe("Payroll UI and API", () => {
  test("owner views payroll page and sees human-readable employee names instead of raw UUIDs", async ({
    page,
  }) => {
    await loginAs(page, "owner@acme-corp.test");

    await page.goto("/payroll");
    await expect(page.getByRole("heading", { name: "Payroll", exact: true })).toBeVisible();

    // Wait for the async data fetch to complete and table rows to render
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });

    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Verify employee column displays readable name, not raw UUID
    for (let i = 0; i < count; i++) {
      const firstCell = rows.nth(i).locator("td").first();
      const cellText = (await firstCell.innerText()).trim();

      // Ensure it's not a bare UUID
      expect(cellText).not.toMatch(UUID_REGEX);
      // Ensure it has some text
      expect(cellText.length).toBeGreaterThan(0);
      expect(cellText).not.toBe("—");
    }
  });

  test("HR fetches /api/payroll with joined employeeName and employeeCode", async ({
    page,
  }) => {
    await loginAs(page, "hr@acme-corp.test");

    const response = await page.request.get("/api/payroll");
    expect(response.status()).toBe(200);

    const records = await response.json();
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeGreaterThan(0);

    for (const record of records) {
      expect(record).toHaveProperty("employeeName");
      expect(record).toHaveProperty("employeeCode");
      expect(record.employeeName).toBeTruthy();
      expect(typeof record.employeeName).toBe("string");
      expect(record.employeeName).not.toMatch(UUID_REGEX);
    }
  });

  test("employee cannot access /api/payroll", async ({ page }) => {
    await loginAs(page, "employee@acme-corp.test");

    const response = await page.request.get("/api/payroll");
    expect(response.status()).toBe(403);
  });
});
