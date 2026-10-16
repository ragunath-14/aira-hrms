import { lookup } from "dns/promises";
import { isIP } from "net";

// Webhook addresses are typed in by a company, and AIRA's server then calls
// them. Without care that would let someone point AIRA at its own internal
// network (cloud metadata, databases, other services). So only public
// addresses are allowed, checked on every call, and the connection is pinned to
// the address that was checked.

export const WEBHOOK_URL_MAX = 500;

// For local testing only: allows http and private addresses. Never set it on a
// live server.
const allowPrivate = () => process.env.WEBHOOK_ALLOW_PRIVATE_NETWORKS === "true";

function v4Parts(ip: string) {
  return ip.split(".").map(Number);
}

// True for loopback, private, link-local (cloud metadata lives at 169.254.x.x),
// shared, documentation, multicast and reserved addresses.
export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);

  if (kind === 4) {
    const [a, b, c] = v4Parts(ip);

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  if (kind === 6) {
    const lower = ip.toLowerCase();

    // IPv4 inside IPv6 (::ffff:10.0.0.1, 64:ff9b::10.0.0.1): judge the IPv4 part.
    const embedded = /(?:^|:)(\d+\.\d+\.\d+\.\d+)$/.exec(lower)?.[1];

    if (embedded) return isPrivateAddress(embedded);

    const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);

    if (mapped) {
      const hi = parseInt(mapped[1], 16);
      const lo = parseInt(mapped[2], 16);

      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }

    return (
      lower === "::" ||
      lower === "::1" ||
      /^f[cd]/.test(lower) || // fc00::/7 unique local
      /^fe[89ab]/.test(lower) || // fe80::/10 link-local
      /^ff/.test(lower) || // multicast
      lower.startsWith("2001:db8") // documentation
    );
  }

  return true; // not an address at all: never allow
}

export type SafeTarget =
  | { ok: true; url: URL; address: string; family: 4 | 6 }
  | { ok: false; error: string };

// Checks a webhook address and finds the public IP to connect to.
export async function resolveWebhookTarget(raw: string): Promise<SafeTarget> {
  if (raw.length > WEBHOOK_URL_MAX) return { ok: false, error: "That address is too long." };

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "Enter a full web address, like https://example.com/hooks/aira" };
  }

  const priv = allowPrivate();

  if (url.protocol !== "https:" && !(priv && url.protocol === "http:")) {
    return { ok: false, error: "The address must start with https://" };
  }

  if (url.username || url.password) {
    return { ok: false, error: "Do not put a username or password in the address." };
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");

  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    if (!priv) return { ok: false, error: "That address points inside a private network, which is not allowed." };
  }

  let addresses: { address: string; family: number }[];

  try {
    addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true });
  } catch {
    return { ok: false, error: "That address could not be found. Check the spelling." };
  }

  if (addresses.length === 0) return { ok: false, error: "That address could not be found." };

  // Every address the name points at must be public: a name that also points
  // inside is how rebinding tricks start.
  if (!priv && addresses.some((a) => isPrivateAddress(a.address))) {
    return { ok: false, error: "That address points inside a private network, which is not allowed." };
  }

  const chosen = addresses[0];

  return { ok: true, url, address: chosen.address, family: chosen.family === 6 ? 6 : 4 };
}
