// Turns whatever an API put in its "error" field into a readable sentence.
// Validation errors can arrive as a plain string or as a Zod "flatten()"
// object; showing the object directly produced "[object Object]".
export function errorText(error: unknown, fallback: string): string {
  if (typeof error === "string" && error) return error;

  if (error && typeof error === "object") {
    const { fieldErrors, formErrors } = error as {
      fieldErrors?: Record<string, string[] | undefined>;
      formErrors?: string[];
    };

    const first =
      Object.values(fieldErrors ?? {}).flat()[0] ?? formErrors?.[0];

    if (typeof first === "string" && first) return first;
  }

  return fallback;
}

// First human-readable message from a failed Zod parse.
export function zodMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input";
}
