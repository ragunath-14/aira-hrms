import { test, expect, type Page } from "@playwright/test";


import { insertApprovedLeave } from "./helpers/past-leave";

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

type LeaveType = {
  id: string;
  name: string;
  encashmentAllowed: boolean;
};

type LeaveBalance = {
  leaveTypeId: string;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
};

async function getLeaveType(page: Page, nameIncludes: string) {
  const types: LeaveType[] = await (
    await page.request.get("/api/leave-types")
  ).json();
  const match = types.find((t) => t.name.includes(nameIncludes));
  if (!match) {
    throw new Error(`No leave type matching "${nameIncludes}"`);
  }
  return match;
}

async function getBalance(page: Page, leaveTypeId: string) {
  const balances: LeaveBalance[] = await (
    await page.request.get("/api/employee/leave-balances")
  ).json();
  const match = balances.find((b) => b.leaveTypeId === leaveTypeId);
  if (!match) {
    throw new Error(`No leave balance for leave type ${leaveTypeId}`);
  }
  return match;
}

test.describe("Employee portal navigation (restructured)", () => {
  test("dashboard nav links to every section, and every section loads", async ({
    page,
  }) => {
    await loginAs(page, "employee@acme-corp.test");
    await expect(page).toHaveURL("/employee");

    const sectionNav = page.getByRole("navigation", { name: "Sections" });

    for (const label of ["Attendance", "Leave", "Payslips", "Documents", "Notifications"]) {
      // Notifications carries an unread-count badge in its accessible
      // name (e.g. "Notifications 3"), so match on a leading label
      // rather than requiring an exact string. Scoped to the section
      // nav since the header also has a "Notifications" bell link.
      await expect(
        sectionNav.getByRole("link", { name: new RegExp(`^${label}\\b`) }),
      ).toBeVisible();
    }

    for (const path of [
      "/employee/attendance",
      "/employee/leave",
      "/employee/leave/planner",
      "/employee/leave/encashment",
      "/employee/leave/adjustment",
      "/employee/leave/ltc",
      "/employee/leave/rules",
      "/employee/payslips",
      "/employee/documents",
      "/employee/notifications",
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should return 200`).toBe(200);
    }
  });

  test("leave rules page shows Earned Leave as encashable, Casual Leave as not", async ({
    page,
  }) => {
    await loginAs(page, "employee@acme-corp.test");
    await page.goto("/employee/leave/rules");

    // Scope to the card-title elements specifically (not their ancestor
    // Card/CardHeader divs, which also "contain" the same text) so this
    // doesn't hit a strict-mode multi-match.
    const earnedTitle = page
      .locator('[data-slot="card-title"]')
      .filter({ hasText: "Earned Leave" });
    const casualTitle = page
      .locator('[data-slot="card-title"]')
      .filter({ hasText: "Casual Leave" });

    await expect(earnedTitle).toBeVisible();
    await expect(earnedTitle.getByText("Encashable")).toBeVisible();

    await expect(casualTitle).toBeVisible();
    await expect(casualTitle.getByText("Encashable")).toHaveCount(0);
  });
});

test.describe("Leave Planner", () => {
  test("employee can add a planned leave entry through the UI, then remove it", async ({
    page,
  }) => {
    await loginAs(page, "employee@acme-corp.test");
    await page.goto("/employee/leave/planner");

    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill("2026-12-20");
    await dateInputs.nth(1).fill("2026-12-24");
    await page.getByRole("button", { name: "Add to Planner" }).click();

    const row = page.getByRole("row").filter({ hasText: "2026-12-20" });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Remove" }).click();
    await expect(row).toHaveCount(0);
  });

  test("employee cannot delete another employee's leave plan", async ({ page }) => {
    await loginAs(page, "manager@acme-corp.test");
    const created = await (
      await page.request.post("/api/employee/leave-plans", {
        data: { startDate: "2026-12-01", endDate: "2026-12-02" },
      })
    ).json();

    await loginAs(page, "employee@acme-corp.test");
    const response = await page.request.delete(
      `/api/employee/leave-plans/${created.id}`,
    );
    expect(response.status()).toBe(404);
  });

  test("employee cannot plan leave against another tenant's leave type", async ({
    page,
  }) => {
    await loginAs(page, "employee@globex-inc.test");
    const globexCasual = await getLeaveType(page, "Casual Leave");

    await loginAs(page, "employee@acme-corp.test");
    const response = await page.request.post("/api/employee/leave-plans", {
      data: {
        leaveTypeId: globexCasual.id,
        startDate: "2026-12-05",
        endDate: "2026-12-06",
      },
    });
    expect(response.status()).toBe(404);

    const plans = await (
      await page.request.get("/api/employee/leave-plans")
    ).json();
    expect(
      plans.some((p: { leaveTypeId: string }) => p.leaveTypeId === globexCasual.id),
    ).toBe(false);
  });
});

test.describe("Leave Encashment", () => {
  test("employee can encash an allowed leave type and HR approval deducts the balance", async ({
    page,
  }) => {
    await loginAs(page, "employee@acme-corp.test");
    const earned = await getLeaveType(page, "Earned Leave");
    expect(earned.encashmentAllowed).toBe(true);

    const before = await getBalance(page, earned.id);

    const createResponse = await page.request.post("/api/employee/leave-encashment", {
      data: {
        leaveTypeId: earned.id,
        year: new Date().getFullYear(),
        daysRequested: 1,
        reason: "playwright encashment test",
      },
    });
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();
    expect(created.status).toBe("pending");

    await loginAs(page, "hr@acme-corp.test");
    const approveResponse = await page.request.patch(
      `/api/leave-encashment/${created.id}`,
      { data: { action: "approve" } },
    );
    expect(approveResponse.status()).toBe(200);

    await loginAs(page, "employee@acme-corp.test");
    const after = await getBalance(page, earned.id);
    expect(after.usedDays).toBe(before.usedDays + 1);
    expect(after.remainingDays).toBe(before.remainingDays - 1);
  });

  test("employee cannot encash a leave type that does not allow it", async ({ page }) => {
    await loginAs(page, "employee@acme-corp.test");
    const casual = await getLeaveType(page, "Casual Leave");
    expect(casual.encashmentAllowed).toBe(false);

    const response = await page.request.post("/api/employee/leave-encashment", {
      data: {
        leaveTypeId: casual.id,
        year: new Date().getFullYear(),
        daysRequested: 1,
      },
    });
    expect(response.status()).toBe(400);
  });

  test("employee cannot approve their own encashment request", async ({ page }) => {
    await loginAs(page, "employee@acme-corp.test");
    const earned = await getLeaveType(page, "Earned Leave");
    const bal = await getBalance(page, earned.id);
    if (bal.remainingDays < 1) {
      await loginAs(page, "hr@acme-corp.test");
      const adj = await (
        await page.request.post("/api/employee/leave-adjustment", {
          data: { leaveTypeId: earned.id, year: new Date().getFullYear(), requestedDays: 5, reason: "test top-up" },
        })
      ).json();
      await page.request.patch(`/api/leave-adjustment/${adj.id}`, { data: { action: "approve" } });
      await loginAs(page, "employee@acme-corp.test");
    }

    const created = await (
      await page.request.post("/api/employee/leave-encashment", {
        data: { leaveTypeId: earned.id, year: new Date().getFullYear(), daysRequested: 1 },
      })
    ).json();

    const response = await page.request.patch(`/api/leave-encashment/${created.id}`, {
      data: { action: "approve" },
    });
    expect(response.status()).toBe(403);
  });

  test("a different tenant's HR cannot approve this tenant's encashment request", async ({
    page,
  }) => {
    await loginAs(page, "employee@acme-corp.test");
    const earned = await getLeaveType(page, "Earned Leave");
    const bal = await getBalance(page, earned.id);
    if (bal.remainingDays < 1) {
      await loginAs(page, "hr@acme-corp.test");
      const adj = await (
        await page.request.post("/api/employee/leave-adjustment", {
          data: { leaveTypeId: earned.id, year: new Date().getFullYear(), requestedDays: 5, reason: "test top-up" },
        })
      ).json();
      await page.request.patch(`/api/leave-adjustment/${adj.id}`, { data: { action: "approve" } });
      await loginAs(page, "employee@acme-corp.test");
    }

    const created = await (
      await page.request.post("/api/employee/leave-encashment", {
        data: { leaveTypeId: earned.id, year: new Date().getFullYear(), daysRequested: 1 },
      })
    ).json();

    await loginAs(page, "hr@globex-inc.test");
    const response = await page.request.patch(`/api/leave-encashment/${created.id}`, {
      data: { action: "approve" },
    });
    expect(response.status()).toBe(404);
  });
});

test.describe("Leave Adjustment", () => {
  test("HR-approved adjustment credits days, employee cannot approve their own", async ({
    page,
  }) => {
    await loginAs(page, "employee@acme-corp.test");
    const sick = await getLeaveType(page, "Sick Leave");
    const before = await getBalance(page, sick.id);

    const created = await (
      await page.request.post("/api/employee/leave-adjustment", {
        data: {
          leaveTypeId: sick.id,
          year: new Date().getFullYear(),
          requestedDays: 2,
          reason: "playwright adjustment test",
        },
      })
    ).json();

    const selfApprove = await page.request.patch(`/api/leave-adjustment/${created.id}`, {
      data: { action: "approve" },
    });
    expect(selfApprove.status()).toBe(403);

    await loginAs(page, "hr@acme-corp.test");
    const approveResponse = await page.request.patch(
      `/api/leave-adjustment/${created.id}`,
      { data: { action: "approve" } },
    );
    expect(approveResponse.status()).toBe(200);

    await loginAs(page, "employee@acme-corp.test");
    const after = await getBalance(page, sick.id);
    expect(after.allocatedDays).toBe(before.allocatedDays + 2);
    expect(after.remainingDays).toBe(before.remainingDays + 2);
  });

  test("rejecting an adjustment leaves the balance untouched", async ({ page }) => {
    await loginAs(page, "employee@acme-corp.test");
    const sick = await getLeaveType(page, "Sick Leave");
    const before = await getBalance(page, sick.id);

    const created = await (
      await page.request.post("/api/employee/leave-adjustment", {
        data: { leaveTypeId: sick.id, year: new Date().getFullYear(), requestedDays: -3 },
      })
    ).json();

    await loginAs(page, "hr@acme-corp.test");
    const rejectResponse = await page.request.patch(
      `/api/leave-adjustment/${created.id}`,
      { data: { action: "reject", comment: "not approved" } },
    );
    expect(rejectResponse.status()).toBe(200);
    expect((await rejectResponse.json()).status).toBe("rejected");

    await loginAs(page, "employee@acme-corp.test");
    const after = await getBalance(page, sick.id);
    expect(after.remainingDays).toBe(before.remainingDays);
  });
});

test.describe("LTC Claims", () => {
  test("employee can submit a claim and HR can approve it", async ({ page }) => {
    await loginAs(page, "employee@acme-corp.test");

    const created = await (
      await page.request.post("/api/employee/ltc-claims", {
        data: {
          blockYear: "2026-2027",
          destination: "Goa",
          amountClaimed: 15000,
          reason: "playwright LTC test",
        },
      })
    ).json();
    expect(created.status).toBe("pending");

    const selfApprove = await page.request.patch(`/api/ltc-claims/${created.id}`, {
      data: { action: "approve" },
    });
    expect(selfApprove.status()).toBe(403);

    await loginAs(page, "manager@acme-corp.test");
    const approveResponse = await page.request.patch(`/api/ltc-claims/${created.id}`, {
      data: { action: "approve" },
    });
    expect(approveResponse.status()).toBe(200);
    expect((await approveResponse.json()).status).toBe("approved");
  });

  test("LTC claim appears in the employee's own list via the UI", async ({ page }) => {
    await loginAs(page, "employee@acme-corp.test");
    await page.request.post("/api/employee/ltc-claims", {
      data: { blockYear: "2027-2028", destination: "Manali", amountClaimed: 8000 },
    });

    await page.goto("/employee/leave/ltc");
    // .first(): repeated runs against this shared demo DB can leave more
    // than one "Manali" claim behind; we only need to know at least one
    // renders, not exactly how many.
    await expect(page.getByText("Manali").first()).toBeVisible();
  });
});

test.describe("Cancelling a leave request", () => {
  test("employee can cancel a pending request they own", async ({ page }) => {
    await loginAs(page, "employee@acme-corp.test");
    const casual = await getLeaveType(page, "Casual Leave");
    const created = await (
      await page.request.post("/api/leave-requests", {
        data: {
          leaveTypeId: casual.id,
          startDate: "2026-12-28",
          endDate: "2026-12-28",
          reason: "playwright cancel test (pending)",
        },
      })
    ).json();

    const cancelResponse = await page.request.patch(
      `/api/employee/leave-requests/${created.id}`,
      { data: { action: "cancel" } },
    );
    expect(cancelResponse.status()).toBe(200);
    expect((await cancelResponse.json()).status).toBe("cancelled");
  });

  test("cancelling an approved future request restores the leave balance", async ({
    page,
  }) => {
    await loginAs(page, "employee@acme-corp.test");
    const casual = await getLeaveType(page, "Casual Leave");
    const before = await getBalance(page, casual.id);

    // A weekday, 3+ days out (past the notice rule), still inside this year
    // (where the balance lives) and with no existing leave of ours on it.
    const taken = new Set(
      (
        (await (await page.request.get("/api/employee/leave-requests")).json()) as {
          startDate: string;
          status: string;
        }[]
      )
        .filter((r) => r.status !== "cancelled" && r.status !== "rejected")
        .map((r) => r.startDate),
    );
    let freeWeekday = "";
    for (let i = 3; i < 120 && !freeWeekday; i++) {
      const d = new Date(Date.now() + i * 86_400_000);
      const iso = d.toISOString().slice(0, 10);
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6 && !taken.has(iso) && iso.startsWith(String(new Date().getUTCFullYear()))) {
        freeWeekday = iso;
      }
    }
    expect(freeWeekday, "need a free weekday this year").not.toBe("");

    const created = await (
      await page.request.post("/api/leave-requests", {
        data: {
          leaveTypeId: casual.id,
          startDate: freeWeekday,
          endDate: freeWeekday,
          reason: "playwright cancel test (approved)",
        },
      })
    ).json();
    expect(
      created.id,
      `leave request creation should return an id, got: ${JSON.stringify(created)}`,
    ).toBeTruthy();

    await loginAs(page, "manager@acme-corp.test");
    await page.request.patch(`/api/leave-requests/${created.id}`, {
      data: { action: "approve" },
    });

    await loginAs(page, "employee@acme-corp.test");
    const afterApproval = await getBalance(page, casual.id);
    expect(afterApproval.remainingDays).toBe(before.remainingDays - 1);

    const cancelResponse = await page.request.patch(
      `/api/employee/leave-requests/${created.id}`,
      { data: { action: "cancel" } },
    );
    expect(cancelResponse.status()).toBe(200);

    const afterCancel = await getBalance(page, casual.id);
    expect(afterCancel.remainingDays).toBe(before.remainingDays);
  });

  test("employee cannot cancel an approved request that has already started", async ({
    page,
  }) => {
    // The app refuses to create leave in the past, so a leave that has
    // already started can only exist as stored data. Insert one directly
    // (once; later runs reuse it) instead of going through the API.
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

    await loginAs(page, "employee@acme-corp.test");

    const existingRequests = await (
      await page.request.get("/api/employee/leave-requests")
    ).json();
    let target = existingRequests.find(
      (r: { startDate: string; status: string }) =>
        r.startDate === yesterday && r.status === "approved",
    );

    if (!target) {
      target = await insertApprovedLeave("employee@acme-corp.test", yesterday);
    }

    const response = await page.request.patch(
      `/api/employee/leave-requests/${target.id}`,
      { data: { action: "cancel" } },
    );
    expect(response.status()).toBe(400);
  });

  test("employee cannot cancel a colleague's leave request", async ({ page }) => {
    await loginAs(page, "manager@acme-corp.test");
    const casual = await getLeaveType(page, "Casual Leave");
    const created = await (
      await page.request.post("/api/leave-requests", {
        data: {
          leaveTypeId: casual.id,
          startDate: "2026-12-30",
          endDate: "2026-12-30",
          reason: "playwright IDOR test",
        },
      })
    ).json();

    await loginAs(page, "employee@acme-corp.test");
    const response = await page.request.patch(
      `/api/employee/leave-requests/${created.id}`,
      { data: { action: "cancel" } },
    );
    expect(response.status()).toBe(404);
  });
});

test.describe("Leave type rules management (admin)", () => {
  test("HR can update a leave type's rules, employee cannot", async ({ page }) => {
    await loginAs(page, "employee@acme-corp.test");
    const earned = await getLeaveType(page, "Earned Leave");
    const denied = await page.request.patch(`/api/leave-types/${earned.id}`, {
      data: { rulesText: "hacked" },
    });
    expect(denied.status()).toBe(403);

    await loginAs(page, "hr@acme-corp.test");
    const response = await page.request.patch(`/api/leave-types/${earned.id}`, {
      data: { minNoticeDays: 10 },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).minNoticeDays).toBe(10);

    // restore the seeded value so repeated runs stay meaningful
    await page.request.patch(`/api/leave-types/${earned.id}`, {
      data: { minNoticeDays: 7 },
    });
  });
});
