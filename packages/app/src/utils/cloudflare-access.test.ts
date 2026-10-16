import { describe, expect, it, vi } from "vitest";
import {
  buildCloudflareAccessHeaders,
  CF_ACCESS_CLIENT_ID_HEADER,
  CF_ACCESS_CLIENT_SECRET_HEADER,
  getCloudflareAccessCredential,
  hasConnectionHeaders,
  normalizeConnectionHeadersRecord,
  selectDirectTcpTransport,
} from "./cloudflare-access";

describe("buildCloudflareAccessHeaders", () => {
  it("builds the two service-token headers", () => {
    expect(
      buildCloudflareAccessHeaders({ clientId: "id.access", clientSecret: "secret-value" }),
    ).toEqual({
      [CF_ACCESS_CLIENT_ID_HEADER]: "id.access",
      [CF_ACCESS_CLIENT_SECRET_HEADER]: "secret-value",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(
      buildCloudflareAccessHeaders({ clientId: "  id.access ", clientSecret: " secret-value\n" }),
    ).toEqual({
      [CF_ACCESS_CLIENT_ID_HEADER]: "id.access",
      [CF_ACCESS_CLIENT_SECRET_HEADER]: "secret-value",
    });
  });

  it("rejects blank credentials", () => {
    expect(() => buildCloudflareAccessHeaders({ clientId: "  ", clientSecret: "s" })).toThrow();
    expect(() => buildCloudflareAccessHeaders({ clientId: "id", clientSecret: "" })).toThrow();
  });
});

describe("getCloudflareAccessCredential", () => {
  it("reads stored credentials back out of headers", () => {
    const headers = buildCloudflareAccessHeaders({
      clientId: "id.access",
      clientSecret: "secret-value",
    });
    expect(getCloudflareAccessCredential(headers, CF_ACCESS_CLIENT_ID_HEADER)).toBe("id.access");
    expect(getCloudflareAccessCredential(headers, CF_ACCESS_CLIENT_SECRET_HEADER)).toBe(
      "secret-value",
    );
    expect(getCloudflareAccessCredential(headers, "Missing")).toBe("");
    expect(getCloudflareAccessCredential(undefined, CF_ACCESS_CLIENT_ID_HEADER)).toBe("");
  });
});

describe("normalizeConnectionHeadersRecord", () => {
  it("drops missing, empty, and malformed header records", () => {
    expect(normalizeConnectionHeadersRecord(undefined)).toBeUndefined();
    expect(normalizeConnectionHeadersRecord({})).toBeUndefined();
    expect(normalizeConnectionHeadersRecord("nope")).toBeUndefined();
    expect(normalizeConnectionHeadersRecord({ "Bad Name": "v" })).toBeUndefined();
    expect(normalizeConnectionHeadersRecord({ Name: "a\nb" })).toBeUndefined();
    expect(normalizeConnectionHeadersRecord({ Name: 42 })).toBeUndefined();
  });

  it("keeps a valid record", () => {
    expect(
      normalizeConnectionHeadersRecord({
        [CF_ACCESS_CLIENT_ID_HEADER]: "id.access",
        [CF_ACCESS_CLIENT_SECRET_HEADER]: "secret-value",
      }),
    ).toEqual({
      [CF_ACCESS_CLIENT_ID_HEADER]: "id.access",
      [CF_ACCESS_CLIENT_SECRET_HEADER]: "secret-value",
    });
  });
});

describe("hasConnectionHeaders", () => {
  it("is false for missing and empty header records", () => {
    expect(hasConnectionHeaders(undefined)).toBe(false);
    expect(hasConnectionHeaders({})).toBe(false);
    expect(hasConnectionHeaders({ [CF_ACCESS_CLIENT_ID_HEADER]: "id" })).toBe(true);
  });
});

describe("selectDirectTcpTransport", () => {
  const webSocketFactory = vi.fn() as unknown as Parameters<
    typeof selectDirectTcpTransport
  >[0]["webSocketFactory"];

  it("keeps headerless connections off the desktop bridge", () => {
    const createBridgeFactory = vi.fn(() => {
      throw new Error("headerless connections must not touch the bridge");
    });
    expect(
      selectDirectTcpTransport({ headers: undefined, createBridgeFactory, webSocketFactory }),
    ).toEqual({ webSocketFactory });
    expect(
      selectDirectTcpTransport({ headers: {}, createBridgeFactory, webSocketFactory }),
    ).toEqual({ webSocketFactory });
    expect(createBridgeFactory).not.toHaveBeenCalled();
  });

  it("routes header-carrying connections through the bridge when available", () => {
    const bridge = vi.fn();
    const createBridgeFactory = vi.fn(() => bridge);
    expect(
      selectDirectTcpTransport({
        headers: { [CF_ACCESS_CLIENT_ID_HEADER]: "id" },
        createBridgeFactory,
        webSocketFactory,
      }),
    ).toEqual({ transportFactory: bridge });
  });

  it("falls back to the app WebSocket when the bridge is unavailable", () => {
    expect(
      selectDirectTcpTransport({
        headers: { [CF_ACCESS_CLIENT_ID_HEADER]: "id" },
        createBridgeFactory: () => null,
        webSocketFactory,
      }),
    ).toEqual({ webSocketFactory });
  });
});
