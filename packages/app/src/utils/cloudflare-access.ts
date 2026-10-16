import type {
  DaemonTransportFactory,
  WebSocketFactory,
} from "@getpaseo/client/internal/daemon-client-transport-types";

// Fork: Cloudflare Access service-token headers for daemons behind
// Cloudflare Tunnel + Access. Sent on the WebSocket upgrade request of
// wss://<host>:443/ws. Daemon password auth is unchanged (hello message).
export const CF_ACCESS_CLIENT_ID_HEADER = "CF-Access-Client-Id";
export const CF_ACCESS_CLIENT_SECRET_HEADER = "CF-Access-Client-Secret";

const HTTP_HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

export function isValidHeaderValue(value: string): boolean {
  return value.length > 0 && !/[\r\n]/.test(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Build the header record stored on a directTcp connection. Values are trimmed. */
export function buildCloudflareAccessHeaders(input: {
  clientId: string;
  clientSecret: string;
}): Record<string, string> {
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Cloudflare Access client ID and secret are required.");
  }
  if (!isValidHeaderValue(clientId) || !isValidHeaderValue(clientSecret)) {
    throw new Error("Cloudflare Access credentials must not contain line breaks.");
  }
  return {
    [CF_ACCESS_CLIENT_ID_HEADER]: clientId,
    [CF_ACCESS_CLIENT_SECRET_HEADER]: clientSecret,
  };
}

/** Read one stored credential back out of a connection's headers (for edit forms). */
export function getCloudflareAccessCredential(
  headers: Record<string, string> | undefined,
  name: string,
): string {
  const value = headers?.[name];
  return typeof value === "string" ? value : "";
}

/**
 * Validate a stored header record. Returns undefined when the record is
 * missing, empty, or malformed so callers drop it instead of persisting junk.
 * Generic on purpose: the transport carries whatever validated headers the
 * connection holds; the fork UI only ever writes the two CF-Access headers.
 */
export function normalizeConnectionHeadersRecord(
  value: unknown,
): Record<string, string> | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }
  const headers: Record<string, string> = {};
  for (const [name, headerValue] of Object.entries(value)) {
    if (
      typeof headerValue !== "string" ||
      !HTTP_HEADER_NAME_PATTERN.test(name) ||
      !isValidHeaderValue(headerValue.trim())
    ) {
      return undefined;
    }
    headers[name] = headerValue.trim();
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

export function hasConnectionHeaders(
  headers: Record<string, string> | undefined,
): headers is Record<string, string> {
  return !!headers && Object.keys(headers).length > 0;
}

export interface DirectTcpTransportSelection {
  transportFactory?: DaemonTransportFactory;
  webSocketFactory?: WebSocketFactory;
}

/**
 * Pick how a direct TCP connection dials. Header-carrying connections go
 * through the Electron main-process bridge (Node `ws` can set upgrade
 * headers; the renderer WebSocket cannot). Headerless connections keep the
 * renderer/native WebSocket they always used -- routing them through the
 * bridge regressed macOS LAN connections in upstream #3067.
 */
export function selectDirectTcpTransport(input: {
  headers?: Record<string, string>;
  createBridgeFactory: () => DaemonTransportFactory | null;
  webSocketFactory: WebSocketFactory;
}): DirectTcpTransportSelection {
  if (hasConnectionHeaders(input.headers)) {
    const bridge = input.createBridgeFactory();
    if (bridge) {
      return { transportFactory: bridge };
    }
  }
  return { webSocketFactory: input.webSocketFactory };
}
