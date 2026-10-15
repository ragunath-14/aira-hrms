import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { employeePhotos, employees } from "@/db/schema";
import { getCurrentTenant } from "@/lib/auth/authorization";
import { MAX_PHOTO_BYTES, detectImage } from "@/lib/domain/photos";
import { isUuid } from "@/lib/validation/ids";

type Ctx = { params: Promise<{ id: string }> };

const HR_ROLES = ["owner", "admin", "hr"];

// The signed-in person and the employee they are asking about, in one company.
// Returns a response to send back when something is wrong.
async function resolve(request: Request, params: Ctx["params"], needsWrite: boolean) {
  const context = await getCurrentTenant(request);

  if (!context) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { id } = await params;

  if (!isUuid(id)) {
    return { error: NextResponse.json({ error: "Invalid id" }, { status: 400 }) };
  }

  const [employee] = await db
    .select({ id: employees.id, userId: employees.userId })
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.tenantId, context.tenant.id)))
    .limit(1);

  if (!employee) {
    return { error: NextResponse.json({ error: "Employee not found" }, { status: 404 }) };
  }

  // Everyone in the company can see a colleague's photo; changing one is for
  // HR, or for the employee it belongs to.
  if (needsWrite) {
    const isHr = HR_ROLES.includes(context.membership.role);
    const isOwn = employee.userId === context.user.id;

    if (!isHr && !isOwn) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
  }

  return { context, employee };
}

export async function GET(request: Request, { params }: Ctx) {
  try {
    const found = await resolve(request, params, false);
    if (found.error) return found.error;

    const [photo] = await db
      .select({ mimeType: employeePhotos.mimeType, data: employeePhotos.data })
      .from(employeePhotos)
      .where(
        and(
          eq(employeePhotos.employeeId, found.employee.id),
          eq(employeePhotos.tenantId, found.context.tenant.id),
        ),
      )
      .limit(1);

    if (!photo) return NextResponse.json({ error: "No photo" }, { status: 404 });

    return new NextResponse(new Uint8Array(photo.data), {
      headers: {
        "Content-Type": photo.mimeType,
        "Content-Length": String(photo.data.length),
        "X-Content-Type-Options": "nosniff",
        // The page asks with ?v=<version>, so a new photo always has a new address.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("GET employee photo error:", error);

    return NextResponse.json({ error: "Failed to load the photo" }, { status: 500 });
  }
}

// Upload or replace a photo (multipart form with a "file" field).
export async function PUT(request: Request, { params }: Ctx) {
  try {
    const found = await resolve(request, params, true);
    if (found.error) return found.error;

    const declared = Number(request.headers.get("content-length") ?? 0);

    if (declared > MAX_PHOTO_BYTES + 64 * 1024) {
      return NextResponse.json({ error: "That photo is too large (1 MB at most)" }, { status: 413 });
    }

    let form: FormData;

    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "Send the photo as a form upload" }, { status: 400 });
    }

    const file = form.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose a photo to upload" }, { status: 400 });
    }

    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "That photo is too large (1 MB at most)" }, { status: 413 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = detectImage(bytes);

    if (!mimeType) {
      return NextResponse.json({ error: "Upload a JPG, PNG or WebP picture" }, { status: 415 });
    }

    const now = new Date();

    await db
      .insert(employeePhotos)
      .values({
        employeeId: found.employee.id,
        tenantId: found.context.tenant.id,
        mimeType,
        data: bytes,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: employeePhotos.employeeId,
        set: { mimeType, data: bytes, updatedAt: now },
      });

    return NextResponse.json({ version: now.getTime() });
  } catch (error) {
    console.error("PUT employee photo error:", error);

    return NextResponse.json({ error: "Failed to save the photo" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const found = await resolve(request, params, true);
    if (found.error) return found.error;

    await db
      .delete(employeePhotos)
      .where(
        and(
          eq(employeePhotos.employeeId, found.employee.id),
          eq(employeePhotos.tenantId, found.context.tenant.id),
        ),
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE employee photo error:", error);

    return NextResponse.json({ error: "Failed to remove the photo" }, { status: 500 });
  }
}
