import dns from "node:dns/promises";
import net from "node:net";

const blockedProtocols = new Set(["file:", "ftp:", "data:", "javascript:"]);

export async function validateTargetUrl(rawUrl: string): Promise<URL> {
  const trimmed = rawUrl.trim();
  if (trimmed.length > 2048) {
    throw new Error("URL is too long.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid absolute URL, including https:// or http://.");
  }

  if (blockedProtocols.has(parsed.protocol) || !["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only public HTTP and HTTPS URLs are supported.");
  }

  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new Error("URL contains unsupported credentials or hostname.");
  }

  await assertPublicHostname(parsed.hostname);
  parsed.hash = "";
  return parsed;
}

async function assertPublicHostname(hostname: string): Promise<void> {
  const lowered = hostname.toLowerCase();
  if (lowered === "localhost" || lowered.endsWith(".localhost")) {
    throw new Error("Localhost URLs are blocked for SSRF protection.");
  }

  const records = await dns.lookup(hostname, { all: true });
  if (records.length === 0) {
    throw new Error("Unable to resolve the target hostname.");
  }

  for (const record of records) {
    if (isPrivateAddress(record.address)) {
      throw new Error("Private network addresses are blocked for SSRF protection.");
    }
  }
}

function isPrivateAddress(address: string): boolean {
  if (net.isIPv6(address)) {
    return (
      address === "::1" ||
      address.startsWith("fc") ||
      address.startsWith("fd") ||
      address.startsWith("fe80:")
    );
  }

  const parts = address.split(".").map(Number);
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}
