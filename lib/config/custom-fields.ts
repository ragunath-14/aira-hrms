// Extra fields a company wants on every employee record (Settings -> Custom
// fields): blood group, PF nominee, T-shirt size, anything. The definitions
// live in the company settings; each employee's values live on the employee.

export type CustomFieldType = "text" | "number" | "date";

export type CustomFieldDefinition = {
  // Stable key the values are stored under. Never changes once created.
  id: string;
  label: string;
  type: CustomFieldType;
};

export const MAX_CUSTOM_FIELDS = 20;
export const MAX_CUSTOM_VALUE_LENGTH = 200;

export function resolveCustomFields(settings: unknown): CustomFieldDefinition[] {
  const stored =
    settings && typeof settings === "object"
      ? (settings as Record<string, unknown>).customFields
      : undefined;

  return Array.isArray(stored) ? (stored as CustomFieldDefinition[]) : [];
}
