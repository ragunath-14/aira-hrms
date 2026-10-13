// Fills every module with realistic demo data so the whole app can be tried
// out. Safe to run more than once: each section checks for its own marker rows
// first. Run with:  npm run db:seed:demo
import { and, eq, inArray } from "drizzle-orm";

if (
  process.env.NODE_ENV === "production" &&
  process.env.ALLOW_DEMO_SEED !== "true"
) {
  throw new Error("Refusing to insert demo data in production.");
}

import { db } from "@/db/index";
import { attendance } from "@/db/schema/attendance";
import { employees } from "@/db/schema/employees";
import {
  announcements,
  holidays,
} from "@/db/schema/engagement";
import { leaveRequests, leaveTypes } from "@/db/schema/leaves";
import { memberships } from "@/db/schema/memberships";
import { departments, designations, locations } from "@/db/schema/organization";
import { tenants } from "@/db/schema/tenants";
import {
  candidates,
  expenseClaims,
  jobOpenings,
  onboardingTasks,
  shiftAssignments,
  shifts,
  ticketComments,
  tickets,
} from "@/db/schema/workplace";

const PEOPLE: [string, string][] = [
  ["Priya", "Sharma"], ["Rahul", "Verma"], ["Ananya", "Iyer"], ["Karthik", "Reddy"],
  ["Sneha", "Patel"], ["Arjun", "Nair"], ["Divya", "Menon"], ["Vikram", "Singh"],
  ["Pooja", "Gupta"], ["Suresh", "Kumar"], ["Lakshmi", "Narayanan"], ["Manoj", "Joshi"],
];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);
const pick = <T,>(list: T[], i: number) => list[i % list.length];

function isWeekday(d: Date) {
  const dow = d.getUTCDay();
  return dow !== 0 && dow !== 6;
}

async function seedTenant(tenant: typeof tenants.$inferSelect) {
  const tid = tenant.id;
  const slug = tenant.slug;

  const [depts, desigs, locs, hrMember] = await Promise.all([
    db.select().from(departments).where(eq(departments.tenantId, tid)),
    db.select().from(designations).where(eq(designations.tenantId, tid)),
    db.select().from(locations).where(eq(locations.tenantId, tid)),
    db
      .select()
      .from(memberships)
      .where(and(eq(memberships.tenantId, tid), inArray(memberships.role, ["hr", "owner"]))),
  ]);

  const hrUserId = (hrMember.find((m) => m.role === "hr") ?? hrMember[0])?.userId ?? null;

  // ---- Employees -----------------------------------------------------------
  const existing = await db.select().from(employees).where(eq(employees.tenantId, tid));
  const have = new Set(existing.map((e) => e.email));

  const toAdd = PEOPLE.map(([first, last], i) => ({
    tenantId: tid,
    employeeCode: `${slug.toUpperCase()}-1${pad(i + 1)}`,
    firstName: first,
    lastName: last,
    email: `${first}.${last}@${slug}.demo`.toLowerCase(),
    phone: `+91 98${pad(40 + i)}${pad(10 + i)}${pad(20 + i)}`,
    // A spread of tenures: some brand new, some with a work anniversary soon.
    dateOfJoining: i < 3 ? daysFromNow(-5 - i * 7) : daysFromNow(-365 * (1 + (i % 4)) + (i * 4 - 10)),
    dateOfBirth: `${1988 + (i % 8)}-${pad(((new Date().getUTCMonth() + (i % 3)) % 12) + 1)}-${pad(((new Date().getUTCDate() + i * 3) % 27) + 1)}`,
    departmentId: pick(depts, i)?.id ?? null,
    designationId: pick(desigs, i)?.id ?? null,
    locationId: pick(locs, i)?.id ?? null,
    status: i === 11 ? "inactive" : "active",
  })).filter((e) => !have.has(e.email));

  if (toAdd.length) {
    await db.insert(employees).values(toAdd);
  }

  const everyone = await db.select().from(employees).where(eq(employees.tenantId, tid));
  const active = everyone.filter((e) => e.status === "active");

  // Birthdays for the original seeded staff too.
  for (const [i, e] of existing.entries()) {
    if (!e.dateOfBirth) {
      const d = daysFromNow(3 + i * 6);
      await db
        .update(employees)
        .set({ dateOfBirth: `${1990 - i}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` })
        .where(eq(employees.id, e.id));
    }
  }

  // ---- Attendance: last 14 days for everyone active ------------------------
  const statuses = ["present", "present", "present", "present", "late", "present", "half_day", "absent", "present", "leave"] as const;
  const rows: (typeof attendance.$inferInsert)[] = [];

  for (let back = 1; back <= 14; back++) {
    const day = daysFromNow(-back);
    if (!isWeekday(day)) continue;

    active.forEach((e, i) => {
      const status = statuses[(i * 7 + back * 3) % statuses.length];
      const date = ymd(day);
      const inTime = new Date(`${date}T0${status === "late" ? 9 : 8}:${pad(30 + ((i + back) % 25))}:00Z`);
      const outTime = new Date(`${date}T${status === "half_day" ? "13" : "17"}:${pad(15 + ((i * 3 + back) % 40))}:00Z`);

      rows.push({
        tenantId: tid,
        employeeId: e.id,
        attendanceDate: date,
        status,
        checkIn: status === "absent" || status === "leave" ? null : inTime,
        checkOut: status === "absent" || status === "leave" ? null : outTime,
      });
    });
  }

  if (rows.length) {
    await db.insert(attendance).values(rows).onConflictDoNothing();
  }

  // ---- Leave requests in every status --------------------------------------
  const marker = "[demo] ";
  const types = await db.select().from(leaveTypes).where(eq(leaveTypes.tenantId, tid));
  const alreadyLeave = await db
    .select({ reason: leaveRequests.reason })
    .from(leaveRequests)
    .where(eq(leaveRequests.tenantId, tid));

  if (types.length && !alreadyLeave.some((l) => l.reason?.startsWith(marker))) {
    const states = ["pending", "pending", "approved", "approved", "rejected", "pending"];

    await db.insert(leaveRequests).values(
      states.map((status, i) => {
        const start = daysFromNow(10 + i * 4);
        while (!isWeekday(start)) start.setUTCDate(start.getUTCDate() + 1);

        return {
          tenantId: tid,
          employeeId: pick(active, i + 2).id,
          leaveTypeId: pick(types, i).id,
          startDate: ymd(start),
          endDate: ymd(start),
          totalDays: 1,
          reason: `${marker}${pick(["Family function", "Medical appointment", "Personal work", "Travel", "Festival"], i)}`,
          status,
        };
      }),
    );
  }

  // ---- Expense claims ------------------------------------------------------
  const claimsExist = await db
    .select({ id: expenseClaims.id })
    .from(expenseClaims)
    .where(and(eq(expenseClaims.tenantId, tid), eq(expenseClaims.reviewNote, "Demo data")))
    .limit(1);

  if (!claimsExist.length) {
    const claims: [string, number, string, string][] = [
      ["travel", 4850, "Client visit - flight", "paid"],
      ["food", 640.5, "Team lunch", "approved"],
      ["accommodation", 7200, "Hotel, 2 nights, Pune", "approved"],
      ["internet", 999, "Broadband, September", "pending"],
      ["equipment", 3499, "Keyboard and mouse", "pending"],
      ["travel", 1250, "Cab to airport", "pending"],
      ["food", 380, "Working dinner", "rejected"],
      ["other", 15000, "Certification exam fee", "paid"],
    ];

    await db.insert(expenseClaims).values(
      claims.map(([category, amount, description, status], i) => ({
        tenantId: tid,
        employeeId: pick(active, i + 1).id,
        category,
        amount: amount.toFixed(2),
        expenseDate: ymd(daysFromNow(-3 - i * 2)),
        description,
        status,
        reviewedBy: status === "pending" ? null : hrUserId,
        reviewNote: "Demo data",
      })),
    );
  }

  // ---- Recruitment ---------------------------------------------------------
  const jobTitles = ["Backend Engineer", "UI/UX Designer", "Sales Executive", "Payroll Specialist"];
  const haveJobs = await db.select().from(jobOpenings).where(eq(jobOpenings.tenantId, tid));

  if (!haveJobs.some((j) => j.title === jobTitles[0])) {
    const created = await db
      .insert(jobOpenings)
      .values(
        jobTitles.map((title, i) => ({
          tenantId: tid,
          title,
          departmentId: pick(depts, i)?.id ?? null,
          location: pick(["Bengaluru", "Chennai", "Hyderabad", "Remote"], i),
          employmentType: i === 1 ? "contract" : "full_time",
          openings: 1 + (i % 3),
          status: i === 3 ? "closed" : "open",
          description: `We are hiring a ${title} to join the team.`,
        })),
      )
      .returning();

    const names = ["Aditi Rao", "Rohan Das", "Neha Kapoor", "Imran Khan", "Sanjana Pillai", "Tarun Bhatt", "Meghna Roy", "Kabir Anand"];
    const stages = ["applied", "applied", "screening", "screening", "interview", "interview", "offer", "hired"];

    await db.insert(candidates).values(
      names.map((name, i) => ({
        tenantId: tid,
        jobId: created[i % 3].id,
        name,
        email: `${name.split(" ")[0]}.${name.split(" ")[1]}@mail.demo`.toLowerCase(),
        phone: `+91 99${pad(10 + i)}${pad(30 + i)}${pad(50 + i)}`,
        stage: stages[i],
        notes: i % 2 ? "Strong portfolio" : null,
      })),
    );
  }

  // ---- Onboarding and offboarding -----------------------------------------
  const haveTasks = await db
    .select({ id: onboardingTasks.id })
    .from(onboardingTasks)
    .where(eq(onboardingTasks.tenantId, tid))
    .limit(1);

  if (!haveTasks.length) {
    const joiners = everyone.filter((e) => e.email.endsWith(".demo")).slice(0, 2);
    const leaver = everyone.find((e) => e.status === "inactive");

    const make = (employeeId: string, kind: string, titles: string[], doneCount: number) =>
      titles.map((title, i) => ({
        tenantId: tid,
        employeeId,
        kind,
        title,
        done: i < doneCount,
        doneAt: i < doneCount ? new Date() : null,
      }));

    const onboarding = ["Sign offer letter", "Submit ID proof and bank details", "Collect laptop", "Set up email account", "HR policy induction", "Meet the team"];
    const offboarding = ["Hand over work", "Return laptop and access card", "Exit interview", "Final settlement"];

    const values = [
      ...(joiners[0] ? make(joiners[0].id, "onboarding", onboarding, 4) : []),
      ...(joiners[1] ? make(joiners[1].id, "onboarding", onboarding, 1) : []),
      ...(leaver ? make(leaver.id, "offboarding", offboarding, 2) : []),
    ];

    if (values.length) await db.insert(onboardingTasks).values(values);
  }

  // ---- Shifts and this week's roster --------------------------------------
  let shiftList = await db.select().from(shifts).where(eq(shifts.tenantId, tid));

  if (!shiftList.some((s) => s.name === "Night")) {
    const extra = await db
      .insert(shifts)
      .values([
        { tenantId: tid, name: "Evening", startTime: "14:00", endTime: "22:00" },
        { tenantId: tid, name: "Night", startTime: "22:00", endTime: "06:00" },
      ])
      .returning();
    shiftList = [...shiftList, ...extra];
  }

  const monday = new Date();
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const roster: (typeof shiftAssignments.$inferInsert)[] = [];

  for (let d = 0; d < 5; d++) {
    const day = new Date(monday.getTime() + d * 86_400_000);
    active.forEach((e, i) => {
      roster.push({
        tenantId: tid,
        employeeId: e.id,
        shiftId: pick(shiftList, i + d).id,
        date: ymd(day),
      });
    });
  }

  if (roster.length) {
    await db.insert(shiftAssignments).values(roster).onConflictDoNothing();
  }

  // ---- Helpdesk ------------------------------------------------------------
  const haveTickets = await db.select({ subject: tickets.subject }).from(tickets).where(eq(tickets.tenantId, tid));

  if (!haveTickets.some((t) => t.subject.startsWith("[Demo]"))) {
    const list: [string, string, string, string, string][] = [
      ["[Demo] Salary slip for September not visible", "payroll", "high", "open", "I can't see the September payslip in my portal."],
      ["[Demo] Laptop charger replacement", "it", "medium", "in_progress", "My charger stopped working. Need a replacement."],
      ["[Demo] Question about leave carry forward", "leave", "low", "resolved", "How many casual leaves carry forward to next year?"],
      ["[Demo] Update my bank account details", "payroll", "medium", "open", "I changed banks. How do I update my details?"],
      ["[Demo] Work from home policy", "policy", "low", "closed", "Where can I read the latest WFH policy?"],
    ];

    const created = await db
      .insert(tickets)
      .values(
        list.map(([subject, category, priority, status, description], i) => ({
          tenantId: tid,
          employeeId: pick(active, i + 3).id,
          subject,
          category,
          priority,
          status,
          description,
        })),
      )
      .returning();

    if (hrUserId) {
      await db.insert(ticketComments).values([
        { tenantId: tid, ticketId: created[1].id, userId: hrUserId, body: "IT has been informed. A new charger will reach you by Friday." },
        { tenantId: tid, ticketId: created[2].id, userId: hrUserId, body: "Up to 5 casual leaves carry forward. Details are under Leave, Rules." },
        { tenantId: tid, ticketId: created[4].id, userId: hrUserId, body: "The policy is pinned in Announcements." },
      ]);
    }
  }

  // ---- More announcements and holidays ------------------------------------
  const news = await db.select({ title: announcements.title }).from(announcements).where(eq(announcements.tenantId, tid));

  if (!news.some((n) => n.title.startsWith("Quarterly town hall"))) {
    await db.insert(announcements).values([
      { tenantId: tid, title: "Quarterly town hall on Friday", body: "Join us at 4 PM in the main hall or online. Leadership will share Q3 results and the roadmap.", pinned: false },
      { tenantId: tid, title: "Health insurance renewal", body: "Please confirm your dependents' details with HR by the end of the month.", pinned: false },
    ]);
  }

  const year = new Date().getUTCFullYear();
  const haveHolidays = await db.select({ name: holidays.name }).from(holidays).where(eq(holidays.tenantId, tid));

  if (!haveHolidays.some((h) => h.name === "Karthigai Deepam")) {
    await db.insert(holidays).values([
      { tenantId: tid, name: "Karthigai Deepam", date: `${year}-11-24`, type: "optional" },
      { tenantId: tid, name: "Annual Day", date: `${year}-12-18`, type: "company" },
    ]);
  }

  console.log(`  ${tenant.name}: ${everyone.length} employees, ${rows.length} attendance rows checked, demo data ready.`);
}

async function main() {
  const all = await db.select().from(tenants);

  console.log("Seeding demo data...");

  for (const tenant of all) {
    await seedTenant(tenant);
  }

  console.log("Done. Log in with the accounts listed by `npm run db:seed`.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Demo seed failed:", err);
  process.exit(1);
});
