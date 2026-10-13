import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isUuid } from "@/lib/validation/ids";
import { zodMessage } from "@/lib/format/error-text";
import { performanceReviewSchema } from "@/lib/validation/schemas";
import { logAudit } from "@/lib/domain/audit";
import { requireRole } from "@/lib/auth/authorization";
import { db } from "@/db";
import {
  employees,
  performanceReviews,
} from "@/db/schema";

export async function GET(request: Request) {
  try {
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
          auth.tenant.id,
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

    const parsed = performanceReviewSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: zodMessage(parsed.error) },
        { status: 400 },
      );
    }

    const { employeeId, reviewPeriod, rating, comments, status } = parsed.data;

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
            auth.tenant.id,
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
        tenantId: auth.tenant.id,
        employeeId,
        reviewPeriod,
        rating: rating ?? null,
        comments: comments ?? null,
        status: status || "draft",
      })
      .returning();

    await logAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      action: "performance_review_created",
      entity: "performance_review",
      entityId: review.id,
    });

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

    if (
      rating != null &&
      (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5)
    ) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
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
            auth.tenant.id,
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


export async function DELETE(request: Request) {
  try {
    const auth = await requireRole(request, ["owner", "admin", "hr"]);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const id = new URL(request.url).searchParams.get("id");

    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "A valid id query param is required" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(performanceReviews)
      .where(and(eq(performanceReviews.id, id), eq(performanceReviews.tenantId, auth.tenant.id)))
      .returning({ id: performanceReviews.id });

    if (!deleted) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Review DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
}
