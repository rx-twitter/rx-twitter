import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { IChannelConfigRepository, GuildConfig } from "@rx-twitter/shared";

vi.mock("@/utils/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const createMockRepo = (): IChannelConfigRepository => ({
  getConfig: vi.fn(),
  saveConfig: vi.fn(),
  notifyUpdate: vi.fn(),
  isChannelAllowed: vi.fn(),
});

const createGuildConfig = (
  overrides: Partial<GuildConfig> = {},
): GuildConfig => ({
  guildId: "guild-1",
  allowAllChannels: false,
  whitelistedChannelIds: [],
  version: 1,
  updatedAt: "2024-01-01T00:00:00Z",
  ...overrides,
});

// -------------------------
// デフォルト環境（REDIS_DOWN_FALLBACK=allow / CONFIG_NOT_FOUND_FALLBACK=deny）
// -------------------------
describe("ChannelConfigService (デフォルト環境)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ChannelConfigService: any;
  let mockRepo: IChannelConfigRepository;

  beforeAll(async () => {
    delete process.env.REDIS_DOWN_FALLBACK;
    delete process.env.CONFIG_NOT_FOUND_FALLBACK;
    vi.resetModules();
    ({ ChannelConfigService } =
      await import("@/core/services/ChannelConfigService"));
  });

  beforeEach(() => {
    mockRepo = createMockRepo();
  });

  describe("isChannelAllowed - kind: found", () => {
    it("allowAllChannels=true の場合 true を返す", async () => {
      vi.mocked(mockRepo.getConfig).mockResolvedValue({
        kind: "found",
        data: createGuildConfig({ allowAllChannels: true }),
      });
      const service = new ChannelConfigService(mockRepo);
      expect(await service.isChannelAllowed("guild-1", "any-channel")).toBe(
        true,
      );
    });

    it("ホワイトリストにチャンネルが含まれる場合 true を返す", async () => {
      vi.mocked(mockRepo.getConfig).mockResolvedValue({
        kind: "found",
        data: createGuildConfig({
          whitelistedChannelIds: ["channel-1", "channel-2"],
        }),
      });
      const service = new ChannelConfigService(mockRepo);
      expect(await service.isChannelAllowed("guild-1", "channel-1")).toBe(true);
    });

    it("ホワイトリストにチャンネルが含まれない場合 false を返す", async () => {
      vi.mocked(mockRepo.getConfig).mockResolvedValue({
        kind: "found",
        data: createGuildConfig({ whitelistedChannelIds: ["channel-1"] }),
      });
      const service = new ChannelConfigService(mockRepo);
      expect(await service.isChannelAllowed("guild-1", "channel-999")).toBe(
        false,
      );
    });
  });

  describe("isChannelAllowed - kind: not_found (デフォルト=deny)", () => {
    it("設定が見つからない場合 false を返す", async () => {
      vi.mocked(mockRepo.getConfig).mockResolvedValue({ kind: "not_found" });
      const service = new ChannelConfigService(mockRepo);
      expect(await service.isChannelAllowed("guild-1", "channel-1")).toBe(
        false,
      );
    });
  });

  describe("isChannelAllowed - kind: error (デフォルト REDIS_DOWN_FALLBACK=allow)", () => {
    it("Redis障害時 true を返す", async () => {
      vi.mocked(mockRepo.getConfig).mockResolvedValue({
        kind: "error",
        error: new Error("redis down"),
      });
      const service = new ChannelConfigService(mockRepo);
      expect(await service.isChannelAllowed("guild-1", "channel-1")).toBe(true);
    });

    it("getConfig が例外を投げた場合 true を返す", async () => {
      vi.mocked(mockRepo.getConfig).mockRejectedValue(
        new Error("unexpected failure"),
      );
      const service = new ChannelConfigService(mockRepo);
      expect(await service.isChannelAllowed("guild-1", "channel-1")).toBe(true);
    });
  });

  describe("performHealthCheck", () => {
    it("リポジトリが performHealthCheck をサポートする場合その結果を返す", async () => {
      const mockRepoWithHealthCheck = {
        ...createMockRepo(),
        performHealthCheck: vi.fn().mockResolvedValue(true),
      };
      const service = new ChannelConfigService(mockRepoWithHealthCheck);
      expect(await service.performHealthCheck()).toBe(true);
    });

    it("performHealthCheck が false を返す場合 false を返す", async () => {
      const mockRepoWithHealthCheck = {
        ...createMockRepo(),
        performHealthCheck: vi.fn().mockResolvedValue(false),
      };
      const service = new ChannelConfigService(mockRepoWithHealthCheck);
      expect(await service.performHealthCheck()).toBe(false);
    });

    it("リポジトリが performHealthCheck をサポートしない場合 true を返す", async () => {
      const service = new ChannelConfigService(mockRepo);
      expect(await service.performHealthCheck()).toBe(true);
    });
  });
});

// -------------------------
// CONFIG_NOT_FOUND_FALLBACK=allow
// -------------------------
describe("ChannelConfigService (CONFIG_NOT_FOUND_FALLBACK=allow)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ChannelConfigService: any;
  let mockRepo: IChannelConfigRepository;

  beforeAll(async () => {
    vi.stubEnv("CONFIG_NOT_FOUND_FALLBACK", "allow");
    vi.resetModules();
    ({ ChannelConfigService } =
      await import("@/core/services/ChannelConfigService"));
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    mockRepo = createMockRepo();
  });

  it("設定が見つからない場合 true を返す", async () => {
    vi.mocked(mockRepo.getConfig).mockResolvedValue({ kind: "not_found" });
    const service = new ChannelConfigService(mockRepo);
    expect(await service.isChannelAllowed("guild-1", "channel-1")).toBe(true);
  });
});

// -------------------------
// REDIS_DOWN_FALLBACK=deny
// -------------------------
describe("ChannelConfigService (REDIS_DOWN_FALLBACK=deny)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ChannelConfigService: any;
  let mockRepo: IChannelConfigRepository;

  beforeAll(async () => {
    vi.stubEnv("REDIS_DOWN_FALLBACK", "deny");
    vi.resetModules();
    ({ ChannelConfigService } =
      await import("@/core/services/ChannelConfigService"));
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    mockRepo = createMockRepo();
  });

  it("Redis障害時 false を返す", async () => {
    vi.mocked(mockRepo.getConfig).mockResolvedValue({
      kind: "error",
      error: new Error("redis down"),
    });
    const service = new ChannelConfigService(mockRepo);
    expect(await service.isChannelAllowed("guild-1", "channel-1")).toBe(false);
  });

  it("getConfig が例外を投げた場合 false を返す", async () => {
    vi.mocked(mockRepo.getConfig).mockRejectedValue(
      new Error("unexpected failure"),
    );
    const service = new ChannelConfigService(mockRepo);
    expect(await service.isChannelAllowed("guild-1", "channel-1")).toBe(false);
  });
});
