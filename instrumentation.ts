export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionEnv } = await import("@/lib/config/env");
    assertProductionEnv();

    // Local-development workaround only: some home networks' DNS resolvers
    // time out on the Neon hostname, so use a public resolver there. Hosting
    // platforms (Render) have working DNS and must keep their own resolver.
    if (process.env.NODE_ENV !== "production") {
      const dns = await import("dns");
      dns.setServers(["8.8.8.8", "1.1.1.1"]);
    }

    // Open the database connection at boot and keep it warm.
    const { warmDatabase } = await import("@/db");
    warmDatabase();
  }
}
