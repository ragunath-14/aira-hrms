import { test, expect } from "@playwright/test";

// These tests intentionally avoid anything that touches the database
// (no real login, signup, or tenant data) since this environment only
// has a placeholder DATABASE_URL. They cover the middleware/route-level
// behavior that works without a live Postgres connection.

test.describe("Login page", () => {
  test("renders the login form", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });

  test("requires email and password before submitting", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.getByPlaceholder("Email");
    const passwordInput = page.getByPlaceholder("Password");

    await page.getByRole("button", { name: "Login" }).click();

    // HTML5 required validation should block submission and keep focus
    // on the first invalid field instead of navigating away.
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      emailInput.evaluate((el: HTMLInputElement) => el.validity.valid),
    ).resolves.toBe(false);
    await expect(
      passwordInput.evaluate((el: HTMLInputElement) => el.validity.valid),
    ).resolves.toBe(false);
  });
});

test.describe("Sign-up is disabled", () => {
  test("the signup page sends visitors to login", async ({ page }) => {
    await page.goto("/signup");

    await expect(page).toHaveURL(/\/login$/);
  });

  test("the public sign-up endpoint is closed", async ({ request }) => {
    const response = await request.post("/api/auth/sign-up/email", {
      data: { name: "X", email: "x@example.com", password: "A-long-password-123" },
    });

    expect(response.status()).toBe(403);
  });
});

test.describe("Route protection (proxy middleware)", () => {
  test("redirects an unauthenticated user away from the dashboard", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/login\?callbackUrl=%2F$/);
  });

  test("redirects an unauthenticated user away from a nested HR route", async ({
    page,
  }) => {
    await page.goto("/employees");

    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Femployees$/);
  });

  test("allows the login page itself without redirecting", async ({
    page,
  }) => {
    const response = await page.goto("/login");

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("Route protection (API routes)", () => {
  test("rejects an unauthenticated employees API call with 401, not a 500", async ({
    request,
  }) => {
    const response = await request.get("/api/employees");

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  test("rejects an unauthenticated tenant API call with 401", async ({
    request,
  }) => {
    const response = await request.get("/api/tenant");

    expect(response.status()).toBe(401);
  });

  test("does not gate the auth API routes behind a session", async ({
    request,
  }) => {
    // /api/auth/* must stay reachable even with no session cookie,
    // since that's how sign-in itself happens.
    const response = await request.post("/api/auth/sign-in/email", {
      data: { email: "nobody@example.com", password: "wrong-password" },
    });

    // With a placeholder DB this may 500 once it tries to query, but it
    // must not be redirected/blocked by the proxy (which would come back
    // as a 307/401 before ever reaching the auth handler).
    expect([200, 401, 422, 500]).toContain(response.status());
  });
});
