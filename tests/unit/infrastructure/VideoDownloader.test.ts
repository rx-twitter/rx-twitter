/* oxlint-disable typescript-eslint/no-explicit-any */

import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mediaUrl } from "../../fixtures/testMediaUrl";

vi.mock("node:fs", () => ({
  createWriteStream: vi.fn(),
}));
vi.mock("node:https", () => ({ get: vi.fn() }));
vi.mock("node:http", () => ({ get: vi.fn() }));

// モック後にインポート
import { createWriteStream } from "node:fs";
import * as httpsModule from "node:https";
import * as httpModule from "node:http";
import { VideoDownloader } from "@/infrastructure/http/VideoDownloader";

vi.mock("@/utils/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/** 書き込みストリームのモックを生成 */
const createMockWriteStream = () => {
  const stream = new EventEmitter() as ReturnType<typeof createWriteStream>;
  (stream as any).close = vi.fn(); // eslint-disable-line @typescript-eslint/no-explicit-any
  return stream;
};

/** HTTP レスポンスのモックを生成 */
const createMockResponse = (statusCode: number) => {
  const response = new EventEmitter() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  response.statusCode = statusCode;
  response.resume = vi.fn();
  response.pipe = vi.fn();
  return response;
};

describe("VideoDownloader", () => {
  let downloader: VideoDownloader;

  beforeEach(() => {
    downloader = new VideoDownloader();
    vi.clearAllMocks();
  });

  describe("download", () => {
    it("URL をダウンロードできる", async () => {
      const mockWriteStream = createMockWriteStream();
      vi.mocked(createWriteStream).mockReturnValue(mockWriteStream);

      const mockResponse = createMockResponse(200);
      mockResponse.pipe.mockImplementation(() => {
        process.nextTick(() => mockWriteStream.emit("finish"));
      });

      const mockRequest = new EventEmitter();
      vi.mocked(httpModule.get as any).mockImplementation(
        (_url: any, callback: any) => {
          // eslint-disable-line @typescript-eslint/no-explicit-any
          callback(mockResponse);
          return mockRequest;
        },
      );

      await expect(
        downloader.download(mediaUrl("video.mp4"), "/tmp/test.mp4"),
      ).resolves.toBeUndefined();

      expect(createWriteStream).toHaveBeenCalledWith("/tmp/test.mp4");
      expect(mockResponse.pipe).toHaveBeenCalledWith(mockWriteStream);
      expect((mockWriteStream as any).close).toHaveBeenCalled(); // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    it("HTTP URL をダウンロードできる", async () => {
      const mockWriteStream = createMockWriteStream();
      vi.mocked(createWriteStream).mockReturnValue(mockWriteStream);

      const mockResponse = createMockResponse(200);
      mockResponse.pipe.mockImplementation(() => {
        process.nextTick(() => mockWriteStream.emit("finish"));
      });

      const mockRequest = new EventEmitter();
      vi.mocked(httpModule.get as any).mockImplementation(
        (_url: any, callback: any) => {
          // eslint-disable-line @typescript-eslint/no-explicit-any
          callback(mockResponse);
          return mockRequest;
        },
      );

      await expect(
        downloader.download(mediaUrl("video.mp4"), "/tmp/test.mp4"),
      ).resolves.toBeUndefined();

      expect(httpModule.get).toHaveBeenCalled();
      expect(httpsModule.get).not.toHaveBeenCalled();
    });

    it("HTTP 200 以外のレスポンス（例: 404）は reject する", async () => {
      const mockResponse = createMockResponse(404);
      const mockRequest = new EventEmitter();

      vi.mocked(httpModule.get as any).mockImplementation(
        (_url: any, callback: any) => {
          // eslint-disable-line @typescript-eslint/no-explicit-any
          callback(mockResponse);
          return mockRequest;
        },
      );

      await expect(
        downloader.download(mediaUrl("video.mp4"), "/tmp/test.mp4"),
      ).rejects.toThrow("Failed to download file: 404");

      expect(mockResponse.resume).toHaveBeenCalled();
    });

    it("リクエストエラーが発生した場合 reject する", async () => {
      const mockRequest = new EventEmitter();
      vi.mocked(httpModule.get as any).mockImplementation(() => mockRequest); // eslint-disable-line @typescript-eslint/no-explicit-any

      const downloadPromise = downloader.download(
        mediaUrl("video.mp4"),
        "/tmp/test.mp4",
      );
      mockRequest.emit("error", new Error("connection refused"));

      await expect(downloadPromise).rejects.toThrow("connection refused");
    });

    it("書き込みストリームでエラーが発生した場合 reject する", async () => {
      const mockWriteStream = createMockWriteStream();
      vi.mocked(createWriteStream).mockReturnValue(mockWriteStream);

      const mockResponse = createMockResponse(200);
      mockResponse.pipe.mockImplementation(() => {
        process.nextTick(() =>
          mockWriteStream.emit("error", new Error("disk full")),
        );
      });

      const mockRequest = new EventEmitter();
      vi.mocked(httpModule.get as any).mockImplementation(
        (_url: any, callback: any) => {
          // eslint-disable-line @typescript-eslint/no-explicit-any
          callback(mockResponse);
          return mockRequest;
        },
      );

      await expect(
        downloader.download(mediaUrl("video.mp4"), "/tmp/test.mp4"),
      ).rejects.toThrow("disk full");

      expect((mockWriteStream as any).close).toHaveBeenCalled(); // eslint-disable-line @typescript-eslint/no-explicit-any
    });
  });
});
