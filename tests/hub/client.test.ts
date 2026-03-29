import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HubClient } from "../../src/hub/client.js";

describe("HubClient", () => {
  let client: HubClient;
  const hubUrl = "https://hub.example.com";
  const appToken = "test-app-token";

  beforeEach(() => {
    client = new HubClient(hubUrl, appToken);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sendText", () => {
    it("应发送文本消息", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(""),
      });
      vi.stubGlobal("fetch", mockFetch);

      await client.sendText("wx-user-001", "你好", "trace-001");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${hubUrl}/api/bot/send`);
      expect(options.method).toBe("POST");

      const body = JSON.parse(options.body);
      expect(body.to).toBe("wx-user-001");
      expect(body.type).toBe("text");
      expect(body.content).toEqual({ text: "你好" });

      expect(options.headers["Authorization"]).toBe(`Bearer ${appToken}`);
      expect(options.headers["X-Trace-Id"]).toBe("trace-001");
    });

    it("不传 traceId 时不应包含 X-Trace-Id 头", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(""),
      });
      vi.stubGlobal("fetch", mockFetch);

      await client.sendText("wx-user-001", "你好");

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers["X-Trace-Id"]).toBeUndefined();
    });
  });

  describe("sendMessage", () => {
    it("应正确构建请求体", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(""),
      });
      vi.stubGlobal("fetch", mockFetch);

      await client.sendMessage("wx-user-001", "image", { url: "https://img.example.com/1.jpg" });

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.to).toBe("wx-user-001");
      expect(body.type).toBe("image");
      expect(body.content).toEqual({ url: "https://img.example.com/1.jpg" });
    });

    it("API 返回非 200 时应抛出错误", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(
        client.sendText("wx-user-001", "test"),
      ).rejects.toThrow("Hub API 请求失败: 500 Internal Server Error");
    });

    it("请求超时（abort）时应抛出错误", async () => {
      const mockFetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new DOMException("The operation was aborted", "AbortError")), 10);
        });
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(
        client.sendText("wx-user-001", "test"),
      ).rejects.toThrow();
    });
  });

  describe("sendImage", () => {
    it("应发送图片消息", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(""),
      });
      vi.stubGlobal("fetch", mockFetch);

      await client.sendImage("wx-user-001", "https://img.example.com/photo.jpg", "trace-002");

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.type).toBe("image");
      expect(body.content).toEqual({ url: "https://img.example.com/photo.jpg" });
    });
  });

  describe("sendFile", () => {
    it("应发送文件消息", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(""),
      });
      vi.stubGlobal("fetch", mockFetch);

      await client.sendFile("wx-user-001", "https://files.example.com/doc.pdf", "doc.pdf", "trace-003");

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.type).toBe("file");
      expect(body.content).toEqual({ url: "https://files.example.com/doc.pdf", name: "doc.pdf" });
    });
  });
});
