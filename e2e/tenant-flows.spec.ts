import { test, expect, type Page } from "@playwright/test";

// These tests run against a real, seeded Neon database (see db/seeds/seed.ts).
// They log in through the actual UI and verify the tenant-isolation and
// RBAC behavior the assignment's acceptance test requires.

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

test.describe("Authenticated login redirect", () => {
  test("owner lands on the HR dashboard", async ({ page }) => {
    await loginAs(page, "owner@acme-corp.test");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "HR Dashboard" })).toBeVisible();
  });

  test("employee lands on the employee self-service page", async ({ page }) => {
    await loginAs(page, "employee@acme-corp.test");
    await expect(page).toHaveURL("/employee");
  });
});

test.describe("Tenant isolation (spec section 4/27 acceptance test)", () => {
  test("Acme owner sees only Acme's employees, never Globex's", async ({ page }) => {
    await loginAs(page, "owner@acme-corp.test");
    await page.goto("/employees");

    await expect(page.getByText("Mona Manager")).toBeVisible();
    await expect(page.getByText("Eddie Employee")).toBeVisible();
    await expect(page.getByText("Marcus Manager")).toHaveCount(0);
    await expect(page.getByText("Elena Employee")).toHaveCount(0);
  });

  test("Globex owner sees only Globex's employees, never Acme's", async ({ page }) => {
    await loginAs(page, "owner@globex-inc.test");
    await page.goto("/employees");

    await expect(page.getByText("Marcus Manager")).toBeVisible();
    await expect(page.getByText("Elena Employee")).toBeVisible();
    await expect(page.getByText("Mona Manager")).toHaveCount(0);
    await expect(page.getByText("Eddie Employee")).toHaveCount(0);
  });
});

test.describe("RBAC: employee cannot perform HR-only actions", () => {
  test("employee cannot approve their own leave request via the API", async ({
    page,
  }) => {
    await loginAs(page, "employee@acme-corp.test");

    const leaveTypes = await (
      await page.request.get("/api/leave-types")
    ).json();
    const casual = leaveTypes.find((t: { name: string }) =>
      t.name.includes("Casual"),
    );

    const created = await (
      await page.request.post("/api/leave-requests", {
        data: {
          leaveTypeId: casual.id,
          startDate: "2026-11-10",
          endDate: "2026-11-11",
          reason: "playwright rbac check",
        },
      })
    ).json();

    const approveResponse = await page.request.patch(
      `/api/leave-requests/${created.id}`,
      { data: { action: "approve" } },
    );

    expect(approveResponse.status()).toBe(403);
  });

  test("employee cannot correct an attendance record via the API", async ({
    page,
  }) => {
    await loginAs(page, "employee@acme-corp.test");

    const checkIn = await page.request.post("/api/attendance/check-in");
    // Either freshly checked in (201) or already checked in today (409) —
    // both leave us with an attendance record id to attack.
    const body = await checkIn.json();
    const attendanceId = body.id ?? body.attendance?.id;

    const correctResponse = await page.request.patch(
      `/api/attendance/${attendanceId}`,
      { data: { status: "absent" } },
    );

    expect(correctResponse.status()).toBe(403);
  });
});

test.describe("Super Admin access control", () => {
  test("platform super admin can see all tenants", async ({ page }) => {
    await loginAs(page, "superadmin@platform.test");
    await page.goto("/admin");

    await expect(page.getByText("Acme Corp")).toBeVisible();
    await expect(page.getByText("Globex Inc")).toBeVisible();
  });

  test("a regular tenant owner is denied on the admin page", async ({ page }) => {
    await loginAs(page, "owner@acme-corp.test");
    await page.goto("/admin");

    await expect(page.getByText(/forbidden/i)).toBeVisible();
  });
});

test.describe("Broken access control (confidentiality + IDOR)", () => {
  test("employee cannot view tenant-wide payroll records", async ({ page }) => {
    await loginAs(page, "employee@acme-corp.test");

    const response = await page.request.get("/api/payroll");
    expect(response.status()).toBe(403);
  });

  test("employee cannot view tenant-wide payslips", async ({ page }) => {
    await loginAs(page, "employee@acme-corp.test");

    const response = await page.request.get("/api/payslips");
    expect(response.status()).toBe(403);
  });

  test("employee cannot allocate their own leave balance", async ({ page }) => {
    await loginAs(page, "employee@acme-corp.test");

    const leaveTypes = await (
      await page.request.get("/api/leave-types")
    ).json();

    const response = await page.request.post("/api/leave-balances", {
      data: {
        employeeId: "irrelevant-blocked-before-lookup",
        leaveTypeId: leaveTypes[0].id,
        year: 2099,
        allocatedDays: 999,
      },
    });

    expect(response.status()).toBe(403);
  });

  test("employee cannot create salary components", async ({ page }) => {
    await loginAs(page, "employee@acme-corp.test");

    const response = await page.request.post("/api/salary-components", {
      data: { name: "Bonus", type: "allowance", amount: "999999" },
    });

    expect(response.status()).toBe(403);
  });

  test("employee cannot view a colleague's attendance list", async ({ page }) => {
    await loginAs(page, "employee@acme-corp.test");

    const response = await page.request.get("/api/attendance");
    expect(response.status()).toBe(403);
  });

  test("employee's own dashboard loads correctly", async ({ page }) => {
    await loginAs(page, "employee@acme-corp.test");

    const response = await page.request.get("/api/employee/dashboard");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.employee.email).toBe("employee@acme-corp.test");
  });

  test("employee querying another employee's leave balance by id gets their own data back, not the other person's", async ({
    page,
  }) => {
    await loginAs(page, "manager@acme-corp.test");
    const managerProfile = await (
      await page.request.get("/api/employee/profile")
    ).json();

    await loginAs(page, "employee@acme-corp.test");
    const ownProfile = await (
      await page.request.get("/api/employee/profile")
    ).json();

    const response = await page.request.get(
      `/api/leave-balances?employeeId=${managerProfile.id}`,
    );
    expect(response.status()).toBe(200);

    const balances = await response.json();
    for (const balance of balances) {
      expect(balance.employeeId).toBe(ownProfile.id);
    }
  });

  test("employee cannot create or edit a colleague's performance goal", async ({
    page,
  }) => {
    await loginAs(page, "manager@acme-corp.test");
    const managerProfile = await (
      await page.request.get("/api/employee/profile")
    ).json();

    await loginAs(page, "hr@acme-corp.test");
    const created = await (
      await page.request.post("/api/performance/goals", {
        data: {
          employeeId: managerProfile.id,
          title: "Playwright-created goal",
        },
      })
    ).json();

    await loginAs(page, "employee@acme-corp.test");

    const createForOther = await page.request.post(
      "/api/performance/goals",
      { data: { employeeId: managerProfile.id, title: "should fail" } },
    );
    expect(createForOther.status()).toBe(403);

    const editOther = await page.request.patch("/api/performance/goals", {
      data: { id: created.id, title: "HACKED", status: "completed" },
    });
    expect(editOther.status()).toBe(403);

    // GET must also be scoped to the caller's own goals for the
    // "employee" role — it should never return a colleague's goal.
    const ownGoals = await (
      await page.request.get("/api/performance/goals")
    ).json();
    expect(
      ownGoals.some((goal: { id: string }) => goal.id === created.id),
    ).toBe(false);
  });
});

test.describe("API hardening (found by API smoke testing)", () => {
  test("employee cannot read tenant-wide reports or the team member list", async ({
    page,
  }) => {
    await loginAs(page, "employee@acme-corp.test");

    // /api/reports exposes headcount, leave counts and payroll totals.
    expect((await page.request.get("/api/reports")).status()).toBe(403);
    // /api/memberships lists every colleague's name, email and role.
    expect((await page.request.get("/api/memberships")).status()).toBe(403);
  });

  test("manager gets the dashboard report without payroll figures", async ({
    page,
  }) => {
    await loginAs(page, "manager@acme-corp.test");

    const res = await page.request.get("/api/reports");
    expect(res.status()).toBe(200);
    const report = await res.json();
    expect(report.payrollVisible).toBe(false);
    expect(report.payroll.latestPeriodNetTotal).toBe("0");
  });

  test("HR still gets payroll figures in the report", async ({ page }) => {
    await loginAs(page, "hr@acme-corp.test");

    const report = await (await page.request.get("/api/reports")).json();
    expect(report.payrollVisible).toBe(true);
  });

  test("every role can load their own notifications", async ({ page }) => {
    for (const email of [
      "owner@acme-corp.test",
      "manager@acme-corp.test",
      "employee@acme-corp.test",
    ]) {
      await loginAs(page, email);
      expect(
        (await page.request.get("/api/notifications")).status(),
        `${email} should be able to read notifications`,
      ).toBe(200);
    }
  });

  test("malformed ids and query params get a 400, never a 500", async ({
    page,
  }) => {
    await loginAs(page, "owner@acme-corp.test");

    const cases: Array<[string, string]> = [
      ["GET", "/api/employees/not-a-uuid"],
      ["PATCH", "/api/leave-requests/not-a-uuid"],
      ["DELETE", "/api/departments/not-a-uuid"],
      ["GET", "/api/attendance?employeeId=x"],
      ["GET", "/api/attendance?month=garbage"],
      ["GET", "/api/attendance/summary?month=2026-13"],
      ["GET", "/api/leave-requests?employeeId=x"],
      ["GET", "/api/employees?departmentId=x"],
    ];

    for (const [method, path] of cases) {
      const res = await page.request.fetch(path, {
        method,
        data: method === "PATCH" ? { action: "approve" } : undefined,
      });
      expect(res.status(), `${method} ${path}`).toBe(400);
    }
  });
});
