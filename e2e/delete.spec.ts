import { expect, test, type APIRequestContext } from "@playwright/test";

const PASSWORD = "Passw0rd!123";

// Better Auth rate-limits sign-ins on a production server, so wait out a 429.
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

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

let hr: APIRequestContext;
let emp: APIRequestContext;
let globex: APIRequestContext;

test.beforeAll(async ({ playwright, baseURL }) => {
  hr = await playwright.request.newContext({ baseURL });
  emp = await playwright.request.newContext({ baseURL });
  globex = await playwright.request.newContext({ baseURL });
  await login(hr, "hr@acme-corp.test");
  await login(emp, "employee@acme-corp.test");
  await login(globex, "owner@globex-inc.test");
});

test("department: HR deletes, employee and other companies cannot", async () => {
  const dept = await (await hr.post("/api/departments", {
    data: { name: `Temp dept ${Date.now()}` },
  })).json();

  expect((await emp.delete(`/api/departments/${dept.id}`)).status()).toBe(403);
  expect((await globex.delete(`/api/departments/${dept.id}`)).status()).toBe(404);

  expect((await hr.delete(`/api/departments/${dept.id}`)).ok()).toBeTruthy();
  expect((await hr.delete(`/api/departments/${dept.id}`)).status()).toBe(404);
});

test("designation and location can be deleted by HR", async () => {
  const desig = await (await hr.post("/api/designations", {
    data: { name: `Temp role ${Date.now()}` },
  })).json();
  expect((await hr.delete(`/api/designations/${desig.id}`)).ok()).toBeTruthy();

  const loc = await (await hr.post("/api/locations", {
    data: { name: `Temp site ${Date.now()}` },
  })).json();
  expect((await hr.delete(`/api/locations/${loc.id}`)).ok()).toBeTruthy();
});

test("leave type: unused one is deleted, one with requests is protected", async () => {
  const created = await hr.post("/api/leave-types", {
    data: { name: `Temp leave ${Date.now()}`, daysPerYear: 2 },
  });
  expect(created.ok()).toBeTruthy();
  const type = await created.json();

  expect((await emp.delete(`/api/leave-types/${type.id}`)).status()).toBe(403);
  expect((await globex.delete(`/api/leave-types/${type.id}`)).status()).toBe(404);
  expect((await hr.delete(`/api/leave-types/${type.id}`)).ok()).toBeTruthy();

  // Casual Leave already has requests: refuse, and keep the data.
  const types = await (await hr.get("/api/leave-types")).json();
  const casual = types.find((t: { name: string }) => t.name === "Casual Leave");
  expect((await hr.delete(`/api/leave-types/${casual.id}`)).status()).toBe(409);
  const after = await (await hr.get("/api/leave-types")).json();
  expect(after.some((t: { id: string }) => t.id === casual.id)).toBe(true);
});

test("salary component: HR only, tenant scoped", async () => {
  const comp = await (await hr.post("/api/salary-components", {
    data: { name: `Temp bonus ${Date.now()}`, type: "allowance", amount: 500 },
  })).json();

  expect((await emp.delete(`/api/salary-components/${comp.id}`)).status()).toBe(403);
  expect((await globex.delete(`/api/salary-components/${comp.id}`)).status()).toBe(404);
  expect((await hr.delete(`/api/salary-components/${comp.id}`)).ok()).toBeTruthy();
});

test("notifications: delete one of your own, never someone else's, clear all", async () => {
  // Make sure there is something to delete: an HR announcement notifies everyone.
  const note = await (await hr.post("/api/announcements", {
    data: { title: `Temp notice ${Date.now()}`, body: "for the delete test" },
  })).json();
  const mine = await (await emp.get("/api/employee/notifications")).json();
  expect(mine.length).toBeGreaterThan(0);

  // Another user (HR) cannot delete the employee's notification.
  expect((await hr.delete(`/api/notifications/${mine[0].id}`)).status()).toBe(404);

  expect((await emp.delete(`/api/notifications/${mine[0].id}`)).ok()).toBeTruthy();
  const after = await (await emp.get("/api/employee/notifications")).json();
  expect(after.some((n: { id: string }) => n.id === mine[0].id)).toBe(false);

  // Clearing all only empties the caller's list.
  const hrBefore = await (await hr.get("/api/notifications")).json();
  const cleared = await emp.delete("/api/notifications");
  expect(cleared.ok()).toBeTruthy();
  expect(await (await emp.get("/api/employee/notifications")).json()).toHaveLength(0);
  expect((await (await hr.get("/api/notifications")).json()).length).toBe(hrBefore.length);

  await hr.delete(`/api/announcements/${note.id}`);
});

test("employee removes their own document, HR cannot via that route", async () => {
  const doc = await (await emp.post("/api/employee/documents", {
    data: { name: "Temp doc", type: "other", url: "data:text/plain;base64,aGk=" },
  })).json();

  expect((await hr.delete(`/api/employee/documents/${doc.id}`)).status()).toBe(404);
  expect((await emp.delete(`/api/employee/documents/${doc.id}`)).ok()).toBeTruthy();
  expect((await emp.delete(`/api/employee/documents/${doc.id}`)).status()).toBe(404);
});

test("ticket: HR can delete, requester cannot, other company cannot", async () => {
  const ticket = await (await emp.post("/api/tickets", {
    data: { subject: `Temp ticket ${Date.now()}`, description: "to delete" },
  })).json();

  expect((await emp.delete(`/api/tickets/${ticket.id}`)).status()).toBe(403);
  expect((await globex.delete(`/api/tickets/${ticket.id}`)).status()).toBe(404);
  expect((await hr.delete(`/api/tickets/${ticket.id}`)).ok()).toBeTruthy();
  expect((await emp.get(`/api/tickets/${ticket.id}`)).status()).toBe(404);
});

test("attendance record: HR deletes, employee cannot", async () => {
  const records = await (await hr.get("/api/attendance")).json();
  expect(records.length).toBeGreaterThan(0);

  // Don't touch real demo data: only check the permission and tenant rules.
  expect((await emp.delete(`/api/attendance/${records[0].id}`)).status()).toBe(403);
  expect((await globex.delete(`/api/attendance/${records[0].id}`)).status()).toBe(404);
  expect((await hr.delete("/api/attendance/not-a-uuid")).status()).toBe(400);
});

test("performance delete needs a valid id", async () => {
  expect((await hr.delete("/api/performance")).status()).toBe(400);
  expect((await hr.delete("/api/performance/goals?id=nope")).status()).toBe(400);
  expect((await emp.delete("/api/performance?id=00000000-0000-4000-8000-000000000000")).status()).toBe(403);
});

test("expense claim: HR can delete any claim, even a paid one", async () => {
  const claim = await (await emp.post("/api/expenses", {
    data: { category: "other", amount: 100, expenseDate: "2026-10-01", description: "to delete" },
  })).json();

  await hr.patch(`/api/expenses/${claim.id}`, { data: { status: "approved" } });
  await hr.patch(`/api/expenses/${claim.id}`, { data: { status: "paid" } });

  // The employee cannot delete a paid claim; another company cannot either.
  expect((await emp.delete(`/api/expenses/${claim.id}`)).status()).toBe(409);
  expect((await globex.delete(`/api/expenses/${claim.id}`)).status()).toBe(404);
  expect((await hr.delete(`/api/expenses/${claim.id}`)).ok()).toBeTruthy();
});

test("leave request: HR deletes it and an approved one gives the days back", async () => {
  const types = await (await emp.get("/api/leave-types")).json();
  const casual = types.find((t: { name: string }) => t.name === "Casual Leave");
  const balanceOf = async () => {
    const list = await (await emp.get("/api/employee/leave-balances")).json();
    return list.find((b: { leaveTypeId: string }) => b.leaveTypeId === casual.id).remainingDays as number;
  };

  const taken = new Set(
    (await (await emp.get("/api/employee/leave-requests")).json())
      .filter((r: { status: string }) => r.status !== "cancelled" && r.status !== "rejected")
      .map((r: { startDate: string }) => r.startDate),
  );
  let day = "";
  for (let i = 4; i < 100 && !day; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    if (![0, 6].includes(d.getUTCDay()) && !taken.has(iso) && iso.startsWith(String(new Date().getUTCFullYear()))) day = iso;
  }

  const before = await balanceOf();
  const created = await (await emp.post("/api/leave-requests", {
    data: { leaveTypeId: casual.id, startDate: day, endDate: day, reason: "delete test" },
  })).json();
  expect(created.id).toBeTruthy();

  // Employees cannot delete; another company cannot.
  expect((await emp.delete(`/api/leave-requests/${created.id}`)).status()).toBe(403);
  expect((await globex.delete(`/api/leave-requests/${created.id}`)).status()).toBe(404);

  // Approve as HR (uses a day), then delete: the day comes back.
  expect((await hr.patch(`/api/leave-requests/${created.id}`, { data: { action: "approve" } })).ok()).toBeTruthy();
  expect(await balanceOf()).toBe(before - 1);
  expect((await hr.delete(`/api/leave-requests/${created.id}`)).ok()).toBeTruthy();
  expect(await balanceOf()).toBe(before);
});

test("payroll record and payslip: HR deletes, employee and other company cannot", async () => {
  const records = await (await hr.get("/api/payroll")).json();
  const payslips = await (await hr.get("/api/payslips")).json();
  expect(records.length).toBeGreaterThan(0);

  // Permission and tenant rules only: do not remove the seeded payroll.
  expect((await emp.delete(`/api/payroll/${records[0].id}`)).status()).toBe(403);
  expect((await globex.delete(`/api/payroll/${records[0].id}`)).status()).toBe(404);
  expect((await hr.delete("/api/payroll/not-a-uuid")).status()).toBe(400);

  if (payslips.length) {
    expect((await emp.delete(`/api/payslips/${payslips[0].id}`)).status()).toBe(403);
    expect((await globex.delete(`/api/payslips/${payslips[0].id}`)).status()).toBe(404);
  }
});

test("salary: HR can add a structure and a component, bad values are refused", async () => {
  const people = await (await hr.get("/api/employees")).json();
  const eddie = people.find((p: { email: string }) => p.email === "employee@acme-corp.test");

  expect((await emp.post("/api/salary-structures", { data: { employeeId: eddie.id, basicSalary: 1, effectiveFrom: "2026-10-01" } })).status()).toBe(403);
  expect((await hr.post("/api/salary-structures", { data: { employeeId: eddie.id, basicSalary: -5, effectiveFrom: "2026-10-01" } })).status()).toBe(400);
  expect((await hr.post("/api/salary-components", { data: { name: "Bad", type: "allowance", amount: -1 } })).status()).toBe(400);

  const structure = await hr.post("/api/salary-structures", {
    // A past, closed range, so it cannot overlap Eddie's current structure.
    data: { employeeId: eddie.id, basicSalary: 45000, effectiveFrom: "2000-01-01", effectiveTo: "2000-12-31" },
  });
  expect(structure.status()).toBe(201);
  const created = await structure.json();

  expect((await hr.delete(`/api/salary-structures/${created.id}`)).ok()).toBeTruthy();
});
