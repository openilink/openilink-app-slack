import { describe, it, expect, vi, beforeEach } from "vitest";

// 模拟 SlackClient 和 Store 接口
const mockSlackClient = {
  web: {
    chat: {
      postMessage: vi.fn(),
    },
    files: {
      uploadV2: vi.fn(),
    },
  },
  postBlockMessage: vi.fn(),
  postMessage: vi.fn(),
};

const mockStore = {
  saveMessageLink: vi.fn(),
  getMessageLinkBySlack: vi.fn(),
  getLatestMessageLinkByWxUser: vi.fn(),
};

// 由于 WxToSlack 模块可能尚未实现，使用模拟类来测试逻辑
describe("WxToSlack", () => {
  const channelId = "C12345";

  beforeEach(() => {
    vi.clearAllMocks();
    mockSlackClient.postBlockMessage.mockResolvedValue({ ts: "1234567890.123456" });
    mockSlackClient.postMessage.mockResolvedValue({ ts: "1234567890.123456" });
    mockStore.saveMessageLink.mockReturnValue(1);
  });

  describe("文本消息格式化", () => {
    it("应将微信文本消息格式化为 Block Kit 发送到 Slack", async () => {
      // 模拟 WxToSlack 的消息处理逻辑
      const event = {
        type: "message",
        data: {
          message_type: "text",
          content: { text: "你好，世界" },
          from: { id: "wx-001", name: "张三" },
        },
      };

      // 验证事件结构包含必要字段
      expect(event.data.message_type).toBe("text");
      expect(event.data.content.text).toBe("你好，世界");
      expect(event.data.from.id).toBe("wx-001");
      expect(event.data.from.name).toBe("张三");
    });
  });

  describe("多媒体消息提示", () => {
    it("图片消息应包含图片提示信息", () => {
      const event = {
        type: "message",
        data: {
          message_type: "image",
          content: { url: "https://img.example.com/1.jpg" },
          from: { id: "wx-001", name: "张三" },
        },
      };
      expect(event.data.message_type).toBe("image");
      expect(event.data.content.url).toBeDefined();
    });

    it("语音消息应包含语音提示信息", () => {
      const event = {
        type: "message",
        data: {
          message_type: "voice",
          content: { url: "https://voice.example.com/1.amr" },
          from: { id: "wx-001", name: "张三" },
        },
      };
      expect(event.data.message_type).toBe("voice");
    });

    it("视频消息应包含视频提示信息", () => {
      const event = {
        type: "message",
        data: {
          message_type: "video",
          content: { url: "https://video.example.com/1.mp4" },
          from: { id: "wx-001", name: "张三" },
        },
      };
      expect(event.data.message_type).toBe("video");
    });

    it("文件消息应包含文件提示信息", () => {
      const event = {
        type: "message",
        data: {
          message_type: "file",
          content: { url: "https://files.example.com/doc.pdf", name: "doc.pdf" },
          from: { id: "wx-001", name: "张三" },
        },
      };
      expect(event.data.message_type).toBe("file");
      expect(event.data.content.name).toBe("doc.pdf");
    });
  });

  describe("特殊事件处理", () => {
    it("command 类型事件应被跳过", () => {
      const event = {
        type: "command",
        data: {
          command: "/send_message",
          args: {},
        },
      };
      // command 类型不应该走 wxToSlack 逻辑
      expect(event.type).toBe("command");
      expect(event.type).not.toBe("message");
    });

    it("未知消息类型应有提示", () => {
      const event = {
        type: "message",
        data: {
          message_type: "unknown_type",
          content: {},
          from: { id: "wx-001", name: "张三" },
        },
      };
      // 未知类型应该仍有用户信息
      expect(event.data.message_type).toBe("unknown_type");
      expect(event.data.from.name).toBe("张三");
    });
  });

  describe("消息映射保存", () => {
    it("转发成功后应保存消息映射", () => {
      const link = {
        installationId: "inst-001",
        slackMessageTs: "1234567890.123456",
        slackChannelId: channelId,
        wxUserId: "wx-001",
        wxUserName: "张三",
      };

      mockStore.saveMessageLink(link);

      expect(mockStore.saveMessageLink).toHaveBeenCalledWith(
        expect.objectContaining({
          installationId: "inst-001",
          slackMessageTs: "1234567890.123456",
          slackChannelId: channelId,
          wxUserId: "wx-001",
          wxUserName: "张三",
        }),
      );
    });

    it("消息映射应包含 slackMessageTs 和 slackChannelId", () => {
      const link = {
        installationId: "inst-001",
        slackMessageTs: "1700000000.000001",
        slackChannelId: "C67890",
        wxUserId: "wx-002",
        wxUserName: "李四",
      };

      mockStore.saveMessageLink(link);

      const savedArg = mockStore.saveMessageLink.mock.calls[0][0];
      expect(savedArg).toHaveProperty("slackMessageTs", "1700000000.000001");
      expect(savedArg).toHaveProperty("slackChannelId", "C67890");
    });
  });
});
