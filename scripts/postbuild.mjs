// Runs automatically after `npm run build` (npm "postbuild" hook).
//
// On Render this applies the database migrations, loads the roles/permissions
// reference rows and creates the first platform owner (ADMIN_EMAIL /
// ADMIN_PASSWORD), whatever Build Command the service was created with. It does
// nothing on a developer machine or in CI (Render sets RENDER=true).
//
// Every step is idempotent, so running them more than once is harmless. If a
// step fails the build fails and the previous deploy keeps serving.
import { spawnSync } from "node:child_process";

const onRender = process.env.RENDER === "true";
const forced = process.env.RUN_DB_SETUP === "true";

if (!onRender && !forced) {
  console.log("[postbuild] not on Render; skipping database setup.");
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("[postbuild] DATABASE_URL is not set, so the database cannot be set up.");
  process.exit(1);
}

const steps = ["db:migrate", "db:seed:rbac", "db:bootstrap-admin"];

for (const step of steps) {
  console.log(`\n[postbuild] npm run ${step}`);
  const result = spawnSync("npm", ["run", step], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(`[postbuild] "${step}" failed.`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n[postbuild] database is ready.");
