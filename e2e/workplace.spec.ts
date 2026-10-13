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
test.setTimeout(180_000);

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

test("expense claim: submit, validate, review rules, notification", async () => {
  const bad = await emp.post("/api/expenses", {
    data: { category: "travel", amount: -5, expenseDate: "2026-10-01" },
  });
  expect(bad.status()).toBe(400);

  const created = await emp.post("/api/expenses", {
    data: { category: "travel", amount: 1234.5, expenseDate: "2026-10-01", description: "Cab" },
  });
  expect(created.status()).toBe(201);
  const claim = await created.json();
  expect(claim.status).toBe("pending");

  // Employees can't review, and HR doesn't see it as "mine" but sees all.
  expect((await emp.patch(`/api/expenses/${claim.id}`, { data: { status: "approved" } })).status()).toBe(403);
  const all = await (await hr.get("/api/expenses")).json();
  expect(all.some((c: { id: string }) => c.id === claim.id)).toBe(true);

  // Other tenants can't touch it.
  expect((await globex.patch(`/api/expenses/${claim.id}`, { data: { status: "approved" } })).status()).toBe(404);

  // pending -> paid is not allowed; pending -> approved -> paid is.
  expect((await hr.patch(`/api/expenses/${claim.id}`, { data: { status: "paid" } })).status()).toBe(409);
  expect((await hr.patch(`/api/expenses/${claim.id}`, { data: { status: "approved" } })).ok()).toBeTruthy();
  expect((await hr.patch(`/api/expenses/${claim.id}`, { data: { status: "paid" } })).ok()).toBeTruthy();

  const notes = JSON.stringify(await (await emp.get("/api/employee/notifications")).json());
  expect(notes).toContain("₹1,234.50");

  // A decided claim can no longer be withdrawn.
  expect((await emp.delete(`/api/expenses/${claim.id}`)).status()).toBe(409);
});

test("expense claim: own pending claim can be withdrawn, not someone else's", async () => {
  const mine = await (await emp.post("/api/expenses", {
    data: { category: "food", amount: 200, expenseDate: "2026-10-02" },
  })).json();

  // Another company cannot touch it; the employee can withdraw it.
  expect((await globex.delete(`/api/expenses/${mine.id}`)).status()).toBe(404);
  expect((await emp.delete(`/api/expenses/${mine.id}`)).ok()).toBeTruthy();
});

test("recruitment is HR-only and tenant scoped", async () => {
  expect((await emp.get("/api/jobs")).status()).toBe(403);
  expect((await emp.post("/api/jobs", { data: { title: "x" } })).status()).toBe(403);

  const job = await (await hr.post("/api/jobs", {
    data: { title: `QA Engineer ${Date.now()}`, openings: 2, employmentType: "contract" },
  })).json();
  expect(job.status).toBe("open");

  expect((await hr.post("/api/jobs", { data: { title: "" } })).status()).toBe(400);

  const cand = await hr.post("/api/candidates", {
    data: { jobId: job.id, name: "Asha Rao", email: "asha@example.com" },
  });
  expect(cand.status()).toBe(201);
  const candidate = await cand.json();
  expect(candidate.stage).toBe("applied");

  // Another company can't attach a candidate to this job or move one.
  expect(
    (await globex.post("/api/candidates", { data: { jobId: job.id, name: "X", email: "x@example.com" } })).status(),
  ).toBe(404);
  expect((await globex.patch(`/api/candidates/${candidate.id}`, { data: { stage: "hired" } })).status()).toBe(404);

  expect((await hr.patch(`/api/candidates/${candidate.id}`, { data: { stage: "interview" } })).ok()).toBeTruthy();
  expect((await hr.patch(`/api/candidates/${candidate.id}`, { data: { stage: "nope" } })).status()).toBe(400);

  const jobs = await (await hr.get("/api/jobs")).json();
  expect(jobs.find((j: { id: string }) => j.id === job.id).candidateCount).toBe(1);

  expect((await hr.delete(`/api/jobs/${job.id}`)).ok()).toBeTruthy();
});

test("onboarding checklist: HR starts it, employee ticks own tasks only", async () => {
  const people = await (await hr.get("/api/employees")).json();
  const eddie = people.find((p: { email: string }) => p.email === "employee@acme-corp.test");
  const other = people.find((p: { email: string }) => p.email === "manager@acme-corp.test");

  expect((await emp.post("/api/onboarding", { data: { employeeId: eddie.id } })).status()).toBe(403);

  const started = await hr.post("/api/onboarding", { data: { employeeId: eddie.id, kind: "onboarding" } });
  expect(started.status()).toBe(201);
  expect((await started.json()).length).toBeGreaterThan(3);

  // Starting the same checklist twice is refused.
  expect((await hr.post("/api/onboarding", { data: { employeeId: eddie.id, kind: "onboarding" } })).status()).toBe(409);

  const mine = await (await emp.get("/api/onboarding")).json();
  expect(mine.every((t: { employeeId: string }) => t.employeeId === eddie.id)).toBe(true);

  const done = await emp.patch(`/api/onboarding/${mine[0].id}`, { data: { done: true } });
  expect((await done.json()).done).toBe(true);

  // A checklist for someone else is invisible to the employee.
  await hr.post("/api/onboarding", { data: { employeeId: other.id, kind: "onboarding" } });
  const hrView = await (await hr.get("/api/onboarding")).json();
  const theirs = hrView.find((t: { employeeId: string }) => t.employeeId === other.id);
  expect((await emp.patch(`/api/onboarding/${theirs.id}`, { data: { done: true } })).status()).toBe(404);

  // Clean up.
  for (const t of hrView) {
    await hr.delete(`/api/onboarding/${t.id}`);
  }
});

test("shift roster: define a shift, assign, clear, employee sees own only", async () => {
  expect((await emp.post("/api/shifts", { data: { name: "Hack", startTime: "09:00", endTime: "17:00" } })).status()).toBe(403);
  expect((await hr.post("/api/shifts", { data: { name: "Bad", startTime: "9am", endTime: "17:00" } })).status()).toBe(400);

  const shift = await (await hr.post("/api/shifts", {
    data: { name: `Morning ${Date.now()}`, startTime: "06:00", endTime: "14:00" },
  })).json();

  const people = await (await hr.get("/api/employees")).json();
  const eddie = people.find((p: { email: string }) => p.email === "employee@acme-corp.test");
  const mona = people.find((p: { email: string }) => p.email === "manager@acme-corp.test");
  const date = "2031-03-03";

  for (const p of [eddie, mona]) {
    expect((await hr.post("/api/shift-assignments", { data: { employeeId: p.id, shiftId: shift.id, date } })).ok()).toBeTruthy();
  }

  // Re-assigning the same day replaces it instead of duplicating.
  expect((await hr.post("/api/shift-assignments", { data: { employeeId: eddie.id, shiftId: shift.id, date } })).ok()).toBeTruthy();

  const all = await (await hr.get(`/api/shift-assignments?from=${date}&to=${date}`)).json();
  expect(all).toHaveLength(2);

  const own = await (await emp.get(`/api/shift-assignments?from=${date}&to=${date}`)).json();
  expect(own).toHaveLength(1);
  expect(own[0].employeeId).toBe(eddie.id);

  expect((await emp.get("/api/shift-assignments?from=bad&to=bad")).status()).toBe(400);
  expect((await globex.post("/api/shift-assignments", { data: { employeeId: eddie.id, shiftId: shift.id, date } })).status()).toBe(404);

  expect((await hr.post("/api/shift-assignments", { data: { employeeId: eddie.id, shiftId: null, date } })).ok()).toBeTruthy();
  expect(await (await hr.get(`/api/shift-assignments?from=${date}&to=${date}`)).json()).toHaveLength(1);

  expect((await hr.delete(`/api/shifts/${shift.id}`)).ok()).toBeTruthy();
});

test("helpdesk: ticket thread, status rules, privacy", async () => {
  const created = await emp.post("/api/tickets", {
    data: { subject: `Payslip missing ${Date.now()}`, category: "payroll", priority: "high", description: "September payslip is not visible." },
  });
  expect(created.status()).toBe(201);
  const ticket = await created.json();

  expect((await emp.post("/api/tickets", { data: { subject: "", description: "" } })).status()).toBe(400);

  // HR got a notification.
  const hrNotes = JSON.stringify(await (await hr.get("/api/notifications")).json());
  expect(hrNotes).toContain("Payslip missing");

  // Other companies can't read or reply.
  expect((await globex.get(`/api/tickets/${ticket.id}`)).status()).toBe(404);
  expect((await globex.post(`/api/tickets/${ticket.id}`, { data: { body: "hi" } })).status()).toBe(404);

  // HR replies and resolves; employee is notified.
  expect((await hr.post(`/api/tickets/${ticket.id}`, { data: { body: "Fixed, please refresh." } })).status()).toBe(201);
  expect((await hr.patch(`/api/tickets/${ticket.id}`, { data: { status: "resolved" } })).ok()).toBeTruthy();

  const detail = await (await emp.get(`/api/tickets/${ticket.id}`)).json();
  expect(detail.status).toBe("resolved");
  expect(detail.comments).toHaveLength(1);

  const notes = JSON.stringify(await (await emp.get("/api/employee/notifications")).json());
  expect(notes).toContain("New reply on your ticket");

  // The requester can only close, not reopen or mark in progress.
  expect((await emp.patch(`/api/tickets/${ticket.id}`, { data: { status: "in_progress" } })).status()).toBe(403);
  expect((await emp.patch(`/api/tickets/${ticket.id}`, { data: { status: "closed" } })).ok()).toBeTruthy();
});

test("money renders as Indian rupees, never dollars", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', "owner@acme-corp.test");
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/");
  await expect(page.getByText("Payroll Summary")).toBeVisible();
  const body = await page.locator("body").innerText();
  expect(body).toContain("₹");
  expect(body).not.toContain("$");
});
