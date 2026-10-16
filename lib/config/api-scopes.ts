// What an API key may do. A key gets only the scopes it was created with, so a
// key that only publishes openings on a website cannot read applicants' details.
// Pure and free of server imports: the settings screen uses the same list.

export const API_SCOPES = [
  {
    id: "jobs:read",
    label: "Read published openings",
    hint: "List the jobs shown on the website. No personal data.",
  },
  {
    id: "applications:write",
    label: "Send applications",
    hint: "Submit a candidate's application and resume from the website's server.",
  },
  {
    id: "applications:read",
    label: "Read applications",
    hint: "List applicants' names, emails, phone numbers and stages. Personal data.",
  },
] as const;

export type ApiScope = (typeof API_SCOPES)[number]["id"];

export const API_SCOPE_IDS: string[] = API_SCOPES.map((s) => s.id);

// What a new key starts with: enough for a careers page, nothing that exposes
// applicants.
export const DEFAULT_API_SCOPES: ApiScope[] = ["jobs:read", "applications:write"];

// How long a key lives, in days (null = until revoked).
export const KEY_EXPIRY_CHOICES = [30, 90, 180, 365] as const;
