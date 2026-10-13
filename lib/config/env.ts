// Fails fast at boot when production is missing a required secret or has an
// obviously unsafe value, instead of failing later on the first request.
export function assertProductionEnv() {
  if (process.env.NODE_ENV !== "production") return;

  const problems: string[] = [];

  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    problems.push("BETTER_AUTH_SECRET is not set");
  } else if (secret.length < 32) {
    problems.push("BETTER_AUTH_SECRET must be at least 32 characters");
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    problems.push("DATABASE_URL is not set");
  } else if (!/sslmode=(require|verify-full|verify-ca)/.test(dbUrl)) {
    problems.push("DATABASE_URL must enforce TLS (add ?sslmode=require)");
  }

  const baseUrl = process.env.BETTER_AUTH_URL || process.env.RENDER_EXTERNAL_URL;
  if (!baseUrl) {
    problems.push("BETTER_AUTH_URL (or RENDER_EXTERNAL_URL) is not set");
  } else if (!baseUrl.startsWith("https://") && !baseUrl.startsWith("http://localhost")) {
    problems.push("BETTER_AUTH_URL must be an https:// URL");
  }

  const meetingUrl = process.env.MEETING_BASE_URL;
  if (meetingUrl && !meetingUrl.startsWith("https://")) {
    problems.push("MEETING_BASE_URL must be an https:// URL");
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start with an unsafe configuration:\n - ${problems.join("\n - ")}`,
    );
  }
}
