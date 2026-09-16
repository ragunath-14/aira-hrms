import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET(request: Request) {
  const result = await requirePermission(
    request,
    PERMISSIONS.TENANT_READ,
  );

  if (!result.authorized) {
    return Response.json(
      {
        error: result.error,
      },
      {
        status: result.status,
      },
    );
  }

  return Response.json({
    message: "Access granted",
    user: result.user,
    tenant: result.tenant,
    membership: result.membership,
  });
}