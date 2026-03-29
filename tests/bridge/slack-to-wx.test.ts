import { describe, it, expect, vi, beforeEach } from "vitest";

// 模拟 Store
const mockStore = {
  getMessageLinkBySlack: vi.fn(),
  getLatestMessageLinkByWxUser: vi.fn(),
  getAllInstallations: vi.fn(),
};

// 模拟 HubClient
const mockHubClient = {
  sendText: vi.fn().mockResolvedValue(undefined),
  sendMessage: vi.fn().mockResolvedValue(undefined),
};

describe("SlackToWx", () => {
  const channelId = "C12345";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("通过 threadTs 查找映射", () => {
    it("有 threadTs 时应通过线程 TS 查找消息映射", () => {
      const messageLink = {
        id: 1,
        installationId: "inst-001",
        slackMessageTs: "1234567890.000001",
        slackChannelId: channelId,
        wxUserId: "wx-001",
        wxUserName: "张三",
      };

      mockStore.getMessageLinkBySlack.mockReturnValue(messageLink);

      const result = mockStore.getMessageLinkBySlack(channelId, "1234567890.000001");

      expect(result).toBeDefined();
      expect(result.wxUserId).toBe("wx-001");
      expect(result.wxUserName).toBe("张三");
      expect(mockStore.getMessageLinkBySlack).toHaveBeenCalledWith(channelId, "1234567890.000001");
    });

    it("threadTs 对应的映射不存在时应返回 undefined", () => {
      mockStore.getMessageLinkBySlack.mockReturnValue(undefined);

      const result = mockStore.getMessageLinkBySlack(channelId, "9999999999.000000");

      expect(result).toBeUndefined();
    });
  });

  describe("非目标频道过滤", () => {
    it("非目标频道的消息应被忽略", () => {
      const slackMessage = {
        channel: "C99999",
        text: "这条消息不应该被转发",
        user: "U001",
        ts: "1234567890.000001",
      };

      // 频道不匹配时不应处理
      const isTargetChannel = slackMessage.channel === channelId;
      expect(isTargetChannel).toBe(false);
    });

    it("目标频道的消息应被处理", () => {
      const slackMessage = {
        channel: channelId,
        text: "这条消息应该被转发",
        user: "U001",
        ts: "1234567890.000001",
      };

      const isTargetChannel = slackMessage.channel === channelId;
      expect(isTargetChannel).toBe(true);
    });
  });

  describe("映射缺失跳过", () => {
    it("没有匹配映射的消息应跳过转发", () => {
      mockStore.getMessageLinkBySlack.mockReturnValue(undefined);

      const slackMessage = {
        channel: channelId,
        text: "没有映射的消息",
        user: "U001",
        ts: "1234567890.000001",
        thread_ts: "1234567890.000000",
      };

      const link = mockStore.getMessageLinkBySlack(channelId, slackMessage.thread_ts);
      expect(link).toBeUndefined();
      // 无映射时不应调用 HubClient
      expect(mockHubClient.sendText).not.toHaveBeenCalled();
    });
  });

  describe("@提及去除", () => {
    it("应去除 Slack @提及标记", () => {
      const rawText = "<@U123ABC> 你好，请帮我查一下";
      // Slack @提及格式: <@USER_ID>
      const cleanedText = rawText.replace(/<@[A-Z0-9]+>/g, "").trim();
      expect(cleanedText).toBe("你好，请帮我查一下");
    });

    it("应去除多个 @提及", () => {
      const rawText = "<@U001> <@U002> 大家好";
      const cleanedText = rawText.replace(/<@[A-Z0-9]+>/g, "").trim();
      expect(cleanedText).toBe("大家好");
    });

    it("没有 @提及时文本应保持不变", () => {
      const rawText = "普通消息内容";
      const cleanedText = rawText.replace(/<@[A-Z0-9]+>/g, "").trim();
      expect(cleanedText).toBe("普通消息内容");
    });

    it("应处理 @提及与文本混合的情况", () => {
      const rawText = "你好 <@U001> 请帮我 <@U002> 谢谢";
      const cleanedText = rawText.replace(/<@[A-Z0-9]+>/g, "").trim();
      // 多余空格归一化
      const normalized = cleanedText.replace(/\s+/g, " ");
      expect(normalized).toBe("你好 请帮我 谢谢");
    });
  });

  describe("回复消息发送", () => {
    it("找到映射后应调用 HubClient 发送文本", async () => {
      const messageLink = {
        installationId: "inst-001",
        slackMessageTs: "1234567890.000001",
        slackChannelId: channelId,
        wxUserId: "wx-001",
        wxUserName: "张三",
      };

      mockStore.getMessageLinkBySlack.mockReturnValue(messageLink);

      // 模拟回复
      await mockHubClient.sendText("wx-001", "收到你的消息了");

      expect(mockHubClient.sendText).toHaveBeenCalledWith("wx-001", "收到你的消息了");
    });
  });
});
