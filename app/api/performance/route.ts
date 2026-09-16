import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { db } from "@/db";
import {
  employees,
  performanceReviews,
} from "@/db/schema";
import { getCurrentTenant } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
    const auth = await requireRole(request, [
  "owner",
  "admin",
  "hr",
]);

if (!auth.authorized) {
  return NextResponse.json(
    { error: auth.error },
    { status: auth.status },
  );
}

    const reviews = await db
      .select()
      .from(performanceReviews)
      .where(
        eq(
          performanceReviews.tenantId,
          context.tenant.id,
        ),
      );

    return NextResponse.json(reviews);
  } catch (error) {
    console.error(
      "GET performance reviews error:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to fetch performance reviews" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
    const auth = await requireRole(request, [
  "owner",
  "admin",
  "hr",
]);

if (!auth.authorized) {
  return NextResponse.json(
    { error: auth.error },
    { status: auth.status },
  );
}

    const body = await request.json();

    const {
      employeeId,
      reviewPeriod,
      rating,
      comments,
      status,
    } = body;

    if (!employeeId || !reviewPeriod) {
      return NextResponse.json(
        {
          error:
            "employeeId and reviewPeriod are required",
        },
        { status: 400 },
      );
    }

    const [employee] = await db
      .select({
        id: employees.id,
      })
      .from(employees)
      .where(
        and(
          eq(employees.id, employeeId),
          eq(
            employees.tenantId,
            context.tenant.id,
          ),
        ),
      )
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const [review] = await db
      .insert(performanceReviews)
      .values({
        tenantId: context.tenant.id,
        employeeId,
        reviewPeriod,
        rating: rating ?? null,
        comments: comments ?? null,
        status: status || "draft",
      })
      .returning();

    return NextResponse.json(review, {
      status: 201,
    });
  } catch (error) {
    console.error(
      "POST performance review error:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to create performance review" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getCurrentTenant(request);

    if (!context) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
const auth = await requireRole(request, [
  "owner",
  "admin",
  "hr",
]);

if (!auth.authorized) {
  return NextResponse.json(
    { error: auth.error },
    { status: auth.status },
  );
}
    const body = await request.json();

    const {
      id,
      rating,
      comments,
      status,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Review id is required" },
        { status: 400 },
      );
    }

    const [updatedReview] = await db
      .update(performanceReviews)
      .set({
        rating: rating ?? null,
        comments: comments ?? null,
        status: status || "draft",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(performanceReviews.id, id),
          eq(
            performanceReviews.tenantId,
            context.tenant.id,
          ),
        ),
      )
      .returning();

    if (!updatedReview) {
      return NextResponse.json(
        { error: "Performance review not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(updatedReview);
  } catch (error) {
    console.error(
      "PATCH performance review error:",
      error,
    );

    return NextResponse.json(
      { error: "Failed to update performance review" },
      { status: 500 },
    );
  }
}