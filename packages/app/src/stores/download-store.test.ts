import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultHostAppearance } from "@/hosts/appearance";
import type { HostProfile } from "@/types/host-connection";
import { buildNativeDownloadRequestHeaders, useDownloadStore } from "./download-store";

vi.mock("expo-linking", () => ({
  openURL: vi.fn(),
}));
vi.mock("expo-file-system/legacy", () => ({
  createDownloadResumable: vi.fn(),
}));
vi.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    exists = false;
    constructor(directory: string, name: string) {
      this.uri = `${directory}/${name}`;
    }
  },
  Paths: { cache: "/tmp/paseo-download-test", document: null },
}));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: async () => false,
  shareAsync: vi.fn(),
}));

const CF_HEADERS = {
  "CF-Access-Client-Id": "id.access",
  "CF-Access-Client-Secret": "secret-value",
};

function makeProfile(headers?: Record<string, string>): HostProfile {
  return {
    serverId: "srv_test",
    label: "Test host",
    appearance: defaultHostAppearance(),
    lifecycle: {},
    connections: [
      {
        id: "direct:daemon.example.com:443",
        type: "directTcp",
        endpoint: "daemon.example.com:443",
        useTls: true,
        ...(headers ? { headers } : {}),
      },
    ],
    preferredConnectionId: "direct:daemon.example.com:443",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function findDownload(fileName: string) {
  const matches = [...useDownloadStore.getState().downloads.values()].filter(
    (download) => download.fileName === fileName,
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one download for ${fileName}, found ${matches.length}`);
  }
  return matches[0];
}

describe("download-store Cloudflare Access (web)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails with guidance instead of downloading the Access login page", async () => {
    const { createDownloadResumable } = await import("expo-file-system/legacy");
    await useDownloadStore.getState().startDownload({
      serverId: "srv_test",
      scopeId: "ws1",
      fileName: "cf-web-blocked.txt",
      path: "/cf-web-blocked.txt",
      daemonProfile: makeProfile(CF_HEADERS),
      requestFileDownloadToken: async () => ({
        token: "tok",
        fileName: "cf-web-blocked.txt",
        mimeType: "text/plain",
        error: null,
      }),
    });

    expect(createDownloadResumable).not.toHaveBeenCalled();
    const download = findDownload("cf-web-blocked.txt");
    expect(download?.status).toBe("error");
    expect(download?.message).toContain("Cloudflare Access");
  });

  it("leaves headerless web downloads unchanged", async () => {
    await useDownloadStore.getState().startDownload({
      serverId: "srv_test",
      scopeId: "ws1",
      fileName: "plain-web-ok.txt",
      path: "/plain-web-ok.txt",
      daemonProfile: makeProfile(),
      requestFileDownloadToken: async () => ({
        token: "tok",
        fileName: "plain-web-ok.txt",
        mimeType: "text/plain",
        error: null,
      }),
    });

    const download = findDownload("plain-web-ok.txt");
    expect(download?.status).toBe("complete");
  });
});

describe("buildNativeDownloadRequestHeaders", () => {
  it("returns undefined when the connection carries no headers", () => {
    expect(
      buildNativeDownloadRequestHeaders({
        baseUrl: "https://daemon.example.com",
        authHeader: null,
        authCredentials: null,
        headers: null,
      }),
    ).toBeUndefined();
  });

  it("forwards Cloudflare Access headers", () => {
    expect(
      buildNativeDownloadRequestHeaders({
        baseUrl: "https://daemon.example.com",
        authHeader: null,
        authCredentials: null,
        headers: CF_HEADERS,
      }),
    ).toEqual({ headers: CF_HEADERS });
  });

  it("keeps Authorization winning over a caller-supplied one", () => {
    expect(
      buildNativeDownloadRequestHeaders({
        baseUrl: "https://daemon.example.com",
        authHeader: "Bearer daemon-password",
        authCredentials: null,
        headers: { ...CF_HEADERS, Authorization: "stale" },
      }),
    ).toEqual({
      headers: { ...CF_HEADERS, Authorization: "Bearer daemon-password" },
    });
  });
});
