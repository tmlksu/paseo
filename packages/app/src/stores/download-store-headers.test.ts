import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultHostAppearance } from "@/hosts/appearance";
import type { HostProfile } from "@/types/host-connection";
import { useDownloadStore } from "./download-store";

vi.mock("@/constants/platform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/constants/platform")>();
  return { ...actual, isWeb: false, isNative: true };
});

const recordedResumableCalls: Array<{
  url: string;
  fileUri: string;
  options: unknown;
}> = [];

vi.mock("expo-linking", () => ({
  openURL: vi.fn(),
}));
vi.mock("expo-file-system/legacy", () => ({
  createDownloadResumable: (url: string, fileUri: string, options: unknown) => {
    recordedResumableCalls.push({ url, fileUri, options });
    return { downloadAsync: async () => ({ uri: fileUri }) };
  },
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

describe("download-store Cloudflare Access (native)", () => {
  beforeEach(() => {
    recordedResumableCalls.length = 0;
  });

  it("sends the service-token headers with the file request", async () => {
    await useDownloadStore.getState().startDownload({
      serverId: "srv_test",
      scopeId: "ws1",
      fileName: "cf-native-ok.txt",
      path: "/cf-native-ok.txt",
      daemonProfile: makeProfile(CF_HEADERS),
      requestFileDownloadToken: async () => ({
        token: "tok",
        fileName: "cf-native-ok.txt",
        mimeType: "text/plain",
        error: null,
      }),
    });

    expect(recordedResumableCalls).toHaveLength(1);
    expect(recordedResumableCalls[0]?.url).toContain("https://daemon.example.com/");
    expect(recordedResumableCalls[0]?.options).toEqual({ headers: CF_HEADERS });
    expect(findDownload("cf-native-ok.txt")?.status).toBe("complete");
  });

  it("leaves headerless native downloads unchanged", async () => {
    await useDownloadStore.getState().startDownload({
      serverId: "srv_test",
      scopeId: "ws1",
      fileName: "plain-native-ok.txt",
      path: "/plain-native-ok.txt",
      daemonProfile: makeProfile(),
      requestFileDownloadToken: async () => ({
        token: "tok",
        fileName: "plain-native-ok.txt",
        mimeType: "text/plain",
        error: null,
      }),
    });

    expect(recordedResumableCalls).toHaveLength(1);
    expect(recordedResumableCalls[0]?.options).toBeUndefined();
    expect(findDownload("plain-native-ok.txt")?.status).toBe("complete");
  });
});
