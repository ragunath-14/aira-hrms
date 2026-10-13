import { expect, test, type APIRequestContext } from "@playwright/test";

const PASSWORD = "Passw0rd!123";

// Better Auth rate-limits sign-ins on a production server (a few per 10 s),
// so wait out a 429 instead of failing.
async function login(request: APIRequestContext, email: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await request.post("/api/auth/sign-in/email", {
      data: { email, password: PASSWORD },
    });

    if (res.ok()) return;
    expect(res.status()).toBe(429);
    await new Promise((r) => setTimeout(r, 10_500));
  }

  throw new Error(`Could not sign in as ${email}`);
}

test.describe("holidays and announcements", () => {
  test.setTimeout(120_000);

  test("HR can add and delete a holiday; employee can read but not write", async ({
    playwright,
    baseURL,
  }) => {
    const hr = await playwright.request.newContext({ baseURL });
    await login(hr, "hr@acme-corp.test");

    const name = `E2E Holiday ${Date.now()}`;
    const created = await hr.post("/api/holidays", {
      data: { name, date: "2031-05-05", type: "company" },
    });
    expect(created.status()).toBe(201);
    const holiday = await created.json();

    // Duplicate on the same date is rejected.
    const dup = await hr.post("/api/holidays", {
      data: { name, date: "2031-05-05", type: "company" },
    });
    expect(dup.status()).toBe(409);

    // Bad date is rejected by validation.
    const bad = await hr.post("/api/holidays", {
      data: { name: "Bad", date: "05/05/2031" },
    });
    expect(bad.status()).toBe(400);

    const emp = await playwright.request.newContext({ baseURL });
    await login(emp, "employee@acme-corp.test");

    const list = await emp.get("/api/holidays?year=2031");
    expect(list.ok()).toBeTruthy();
    expect((await list.json()).some((h: { name: string }) => h.name === name)).toBe(true);

    expect(
      (await emp.post("/api/holidays", { data: { name: "x", date: "2031-06-06" } })).status(),
    ).toBe(403);
    expect((await emp.delete(`/api/holidays/${holiday.id}`)).status()).toBe(403);

    expect((await hr.delete(`/api/holidays/${holiday.id}`)).ok()).toBeTruthy();
  });

  test("holidays are isolated per tenant", async ({ playwright, baseURL }) => {
    const acme = await playwright.request.newContext({ baseURL });
    await login(acme, "hr@acme-corp.test");
    const name = `Acme only ${Date.now()}`;
    const res = await acme.post("/api/holidays", {
      data: { name, date: "2032-02-02" },
    });
    const created = await res.json();

    const globex = await playwright.request.newContext({ baseURL });
    await login(globex, "owner@globex-inc.test");
    const list = await (await globex.get("/api/holidays?year=2032")).json();
    expect(list.some((h: { name: string }) => h.name === name)).toBe(false);
    // Cannot delete another tenant's holiday either.
    expect((await globex.delete(`/api/holidays/${created.id}`)).status()).toBe(404);

    await acme.delete(`/api/holidays/${created.id}`);
  });

  test("HR posts an announcement and the employee is notified", async ({
    playwright,
    baseURL,
  }) => {
    const hr = await playwright.request.newContext({ baseURL });
    await login(hr, "hr@acme-corp.test");

    const title = `E2E notice ${Date.now()}`;
    const created = await hr.post("/api/announcements", {
      data: { title, body: "Test body", pinned: true },
    });
    expect(created.status()).toBe(201);
    const item = await created.json();

    const emp = await playwright.request.newContext({ baseURL });
    await login(emp, "employee@acme-corp.test");

    const list = await (await emp.get("/api/announcements")).json();
    expect(list[0].title).toBe(title); // pinned sorts first

    const notes = await (await emp.get("/api/employee/notifications")).json();
    expect(JSON.stringify(notes)).toContain(title);

    expect(
      (await emp.post("/api/announcements", { data: { title: "x", body: "y" } })).status(),
    ).toBe(403);

    expect((await hr.delete(`/api/announcements/${item.id}`)).ok()).toBeTruthy();
  });

  test("dashboard insights hide HR-only data from employees", async ({
    playwright,
    baseURL,
  }) => {
    const emp = await playwright.request.newContext({ baseURL });
    await login(emp, "employee@acme-corp.test");
    const e = await (await emp.get("/api/dashboard/insights")).json();
    expect(e.attendanceWeek).toBeNull();
    expect(e.headcountByDepartment).toBeNull();

    const owner = await playwright.request.newContext({ baseURL });
    await login(owner, "owner@acme-corp.test");
    const o = await (await owner.get("/api/dashboard/insights")).json();
    expect(o.attendanceWeek).toHaveLength(7);
    expect(Array.isArray(o.headcountByDepartment)).toBe(true);
  });
});

test("mobile layout exposes the navigation menu", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/login");
  await page.fill('input[type="email"]', "owner@acme-corp.test");
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  // Wait for the page itself rather than the URL: a slow first compile on a
  // dev server can make the redirect take well over the default timeout.
  const menu = page.getByRole("button", { name: "Open navigation menu" });
  await expect(menu).toBeVisible({ timeout: 60_000 });
  await menu.click();
  await page.getByRole("link", { name: "All Employees" }).click();
  await expect(page).toHaveURL(/\/employees/);
});
