export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("dns");
    // The local network's DNS resolver times out on the Neon hostname
    // specifically; fall back to a public resolver for server-side lookups.
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  }
}
