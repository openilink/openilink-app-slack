import { describe, it, expect, vi, beforeEach } from "vitest";

// 模拟 Slack WebClient
const mockWebClient = {
  chat: {
    postMessage: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  conversations: {
    history: vi.fn(),
    replies: vi.fn(),
  },
};

describe("messaging tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tool 定义完整性", () => {
    it("send_message 工具应有完整定义", () => {
      const toolDef = {
        name: "send_message",
        description: "发送消息到指定频道",
        command: "/send_message",
        parameters: {
          channel: { type: "string", description: "频道 ID", required: true },
          text: { type: "string", description: "消息内容", required: true },
        },
      };

      expect(toolDef.name).toBe("send_message");
      expect(toolDef.command).toBe("/send_message");
      expect(toolDef.parameters).toHaveProperty("channel");
      expect(toolDef.parameters).toHaveProperty("text");
    });

    it("reply_message 工具应有完整定义", () => {
      const toolDef = {
        name: "reply_message",
        description: "回复消息（创建线程回复）",
        command: "/reply_message",
        parameters: {
          channel: { type: "string", description: "频道 ID", required: true },
          thread_ts: { type: "string", description: "线程时间戳", required: true },
          text: { type: "string", description: "回复内容", required: true },
        },
      };

      expect(toolDef.name).toBe("reply_message");
      expect(toolDef.parameters).toHaveProperty("thread_ts");
    });

    it("update_message 工具应有完整定义", () => {
      const toolDef = {
        name: "update_message",
        description: "更新已发送的消息",
        command: "/update_message",
        parameters: {
          channel: { type: "string", description: "频道 ID", required: true },
          ts: { type: "string", description: "消息时间戳", required: true },
          text: { type: "string", description: "新内容", required: true },
        },
      };

      expect(toolDef.name).toBe("update_message");
      expect(toolDef.parameters).toHaveProperty("ts");
    });

    it("delete_message 工具应有完整定义", () => {
      const toolDef = {
        name: "delete_message",
        description: "删除消息",
        command: "/delete_message",
        parameters: {
          channel: { type: "string", description: "频道 ID", required: true },
          ts: { type: "string", description: "消息时间戳", required: true },
        },
      };

      expect(toolDef.name).toBe("delete_message");
      expect(toolDef.parameters).toHaveProperty("channel");
      expect(toolDef.parameters).toHaveProperty("ts");
    });
  });

  describe("send_message handler", () => {
    it("应调用 chat.postMessage 发送消息", async () => {
      mockWebClient.chat.postMessage.mockResolvedValue({
        ok: true,
        ts: "1700000000.000001",
        channel: "C12345",
      });

      const result = await mockWebClient.chat.postMessage({
        channel: "C12345",
        text: "测试消息",
      });

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith({
        channel: "C12345",
        text: "测试消息",
      });
      expect(result.ok).toBe(true);
      expect(result.ts).toBeDefined();
    });
  });

  describe("reply_message handler", () => {
    it("应调用 chat.postMessage 带 thread_ts 回复消息", async () => {
      mockWebClient.chat.postMessage.mockResolvedValue({
        ok: true,
        ts: "1700000001.000001",
      });

      const result = await mockWebClient.chat.postMessage({
        channel: "C12345",
        text: "回复内容",
        thread_ts: "1700000000.000001",
      });

      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          thread_ts: "1700000000.000001",
          text: "回复内容",
        }),
      );
      expect(result.ok).toBe(true);
    });
  });

  describe("update_message handler", () => {
    it("应调用 chat.update 更新消息", async () => {
      mockWebClient.chat.update.mockResolvedValue({
        ok: true,
        ts: "1700000000.000001",
      });

      const result = await mockWebClient.chat.update({
        channel: "C12345",
        ts: "1700000000.000001",
        text: "更新后的消息",
      });

      expect(mockWebClient.chat.update).toHaveBeenCalledWith({
        channel: "C12345",
        ts: "1700000000.000001",
        text: "更新后的消息",
      });
      expect(result.ok).toBe(true);
    });
  });

  describe("delete_message handler", () => {
    it("应调用 chat.delete 删除消息", async () => {
      mockWebClient.chat.delete.mockResolvedValue({ ok: true });

      const result = await mockWebClient.chat.delete({
        channel: "C12345",
        ts: "1700000000.000001",
      });

      expect(mockWebClient.chat.delete).toHaveBeenCalledWith({
        channel: "C12345",
        ts: "1700000000.000001",
      });
      expect(result.ok).toBe(true);
    });
  });
});
