import { promises as dns } from 'dns';
import { UnprocessableContentError } from '../../lib/errors';

/**
 * SSRF guard: resolves the hostname and rejects any URL that points to a
 * private, loopback, link-local, or cloud-metadata address range.
 *
 * Called both before the initial fetch and after each redirect so that
 * a redirect chain cannot smuggle a request to an internal address.
 */

// IPv4 private/reserved ranges as [network, prefix-length] pairs
const BLOCKED_IPV4_CIDRS: Array<[number, number]> = [
  [0x7f000000, 8],   // 127.0.0.0/8  — loopback
  [0x0a000000, 8],   // 10.0.0.0/8   — RFC 1918
  [0xac100000, 12],  // 172.16.0.0/12 — RFC 1918
  [0xc0a80000, 16],  // 192.168.0.0/16 — RFC 1918
  [0xa9fe0000, 16],  // 169.254.0.0/16 — link-local / AWS metadata
  [0x64400000, 10],  // 100.64.0.0/10 — shared address space (RFC 6598)
  [0x00000000, 8],   // 0.0.0.0/8    — "this" network
  [0xc0000000, 29],  // 192.0.0.0/29 — IETF protocol assignments
  [0xe0000000, 4],   // 224.0.0.0/4  — multicast
  [0xf0000000, 4],   // 240.0.0.0/4  — reserved
];

// IPv6 prefixes that are blocked (as lowercase prefix strings)
const BLOCKED_IPV6_PREFIXES = [
  '::1',             // loopback
  '::ffff:',         // IPv4-mapped
  'fc',              // fc00::/7 — unique local
  'fd',              // fd00::/8 — unique local
  'fe80',            // fe80::/10 — link-local
  '::',              // unspecified / all-zeros
];

export async function assertNotSsrf(url: string): Promise<void> {
  const parsed = parseUrl(url);
  const hostname = parsed.hostname;

  // Reject bare IP addresses directly (no DNS needed)
  if (isIpAddress(hostname)) {
    assertIpNotBlocked(hostname);
    return;
  }

  // Resolve hostname to IPs and check each one
  let addresses: string[];
  try {
    addresses = await resolveHostname(hostname);
  } catch {
    throw new UnprocessableContentError(
      `Cannot resolve hostname: ${hostname}`
    );
  }

  if (addresses.length === 0) {
    throw new UnprocessableContentError(
      `Hostname resolves to no addresses: ${hostname}`
    );
  }

  for (const ip of addresses) {
    assertIpNotBlocked(ip);
  }
}

function parseUrl(url: string): URL {
  try {
    return new URL(url);
  } catch {
    throw new UnprocessableContentError(`Invalid URL: ${url}`);
  }
}

function isIpAddress(hostname: string): boolean {
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  // IPv6 (with or without brackets)
  if (hostname.startsWith('[') || hostname.includes(':')) return true;
  return false;
}

function assertIpNotBlocked(ip: string): void {
  const clean = ip.replace(/^\[|\]$/g, ''); // strip IPv6 brackets

  if (isBlockedIpv4(clean)) {
    throw new UnprocessableContentError(
      `Requests to private/internal IP addresses are not allowed: ${clean}`
    );
  }
  if (isBlockedIpv6(clean)) {
    throw new UnprocessableContentError(
      `Requests to private/internal IPv6 addresses are not allowed: ${clean}`
    );
  }
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return false;

  const ipInt =
    (((nums[0] ?? 0) << 24) |
      ((nums[1] ?? 0) << 16) |
      ((nums[2] ?? 0) << 8) |
      (nums[3] ?? 0)) >>>
    0;

  for (const [network, prefix] of BLOCKED_IPV4_CIDRS) {
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    if ((ipInt & mask) === (network & mask)) return true;
  }
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return BLOCKED_IPV6_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

async function resolveHostname(hostname: string): Promise<string[]> {
  const results = await dns.lookup(hostname, { all: true });
  return results.map((r) => r.address);
}
