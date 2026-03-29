/**
 * Slack Bridge 集成测试
 *
 * 测试 Hub <-> App 的完整通信链路，不依赖 Slack SDK：
 * 1. Mock Hub Server 模拟 OpeniLink Hub
 * 2. 创建轻量 App HTTP 服务器（仅含 webhook handler）
 * 3. 使用内存 SQLite 存储 + Mock SlackClient
 * 4. 验证微信->Slack 和 Slack->微信的双向桥接
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import { Store } from "../../src/store.js";
import { handleWebhook } from "../../src/hub/webhook.js";
import { WxToSlack } from "../../src/bridge/wx-to-slack.js";
import { SlackToWx } from "../../src/bridge/slack-to-wx.js";
import type { SlackMessageData } from "../../src/slack/event.js";
import {
  startMockHub,
  injectMessage,
  getMessages,
  resetMock,
  waitFor,
  MOCK_HUB_URL,
  MOCK_WEBHOOK_SECRET,
  MOCK_APP_TOKEN,
  MOCK_INSTALLATION_ID,
  MOCK_BOT_ID,
  APP_PORT,
} from "./setup.js";

// ─── Mock SlackClient ───
// 模拟 Slack 客户端，不连接真实 Slack，仅记录发送的消息

/** 记录 sendText 调用 */
let slackSentTexts: Array<{ channel: string; text: string; ts: string }> = [];
/** 记录 sendBlocks 调用 */
let slackSentBlocks: Array<{ channel: string; blocks: any[]; text: string; ts: string }> = [];
/** 自增计数器，用于生成唯一 ts */
let slackTsCounter = 0;

/**
 * 创建 Mock SlackClient
 * 实现 sendText 和 sendBlocks 方法，返回模拟的消息 ts
 */
function createMockSlackClient() {
  return {
    web: {} as any,
    sendText: async (channel: string, text: string, _threadTs?: string): Promise<string> => {
      slackTsCounter++;
      const ts = `slack_ts_${slackTsCounter}`;
      slackSentTexts.push({ channel, text, ts });
      return ts;
    },
    sendBlocks: async (channel: string, blocks: any[], text: string, _threadTs?: string): Promise<string> => {
      slackTsCounter++;
      const ts = `slack_ts_${slackTsCounter}`;
      slackSentBlocks.push({ channel, blocks, text, ts });
      return ts;
    },
    replyText: async (channel: string, _threadTs: string, text: string): Promise<string> => {
      slackTsCounter++;
      const ts = `slack_reply_${slackTsCounter}`;
      slackSentTexts.push({ channel, text, ts });
      return ts;
    },
  };
}

// ─── 测试主体 ───

describe("Slack Bridge 集成测试", () => {
  let mockHubHandle: { server: http.Server; close: () => Promise<void> };
  let appServer: http.Server;
  let store: Store;
  let wxToSlack: WxToSlack;
  let slackToWx: SlackToWx;
  const defaultChannel = "test_channel_001";

  beforeAll(async () => {
    // 1. 启动 Mock Hub Server
    mockHubHandle = await startMockHub();

    // 2. 初始化内存数据库和存储
    store = new Store(":memory:");

    // 3. 注入 installation 记录（模拟已完成 OAuth 安装）
    store.saveInstallation({
      id: MOCK_INSTALLATION_ID,
      hubUrl: MOCK_HUB_URL,
      appId: "test-app",
      botId: MOCK_BOT_ID,
      appToken: MOCK_APP_TOKEN,
      webhookSecret: MOCK_WEBHOOK_SECRET,
    });

    // 4. 创建 Mock SlackClient 和桥接模块
    const mockSlack = createMockSlackClient();
    wxToSlack = new WxToSlack(mockSlack as any, store, defaultChannel);
    slackToWx = new SlackToWx(store, defaultChannel);

    // 5. 启动轻量 App HTTP 服务器（只处理 /hub/webhook）
    appServer = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${APP_PORT}`);

      if (req.method === "POST" && url.pathname === "/hub/webhook") {
        await handleWebhook(req, res, store, async (event, _installationId) => {
          if (!event.event) return;
          const eventType = event.event.type;

          if (eventType.startsWith("message.")) {
            // 微信->Slack 桥接
            const installation = store.getInstallation(event.installation_id);
            if (installation) {
              await wxToSlack.handleWxEvent(event, installation);
            }
          }
        });
        return;
      }

      // 健康检查
      if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      res.writeHead(404);
      res.end("Not Found");
    });

    await new Promise<void>((resolve, reject) => {
      appServer.on("error", reject);
      appServer.listen(APP_PORT, () => {
        console.log(`[test] App Server 已启动，端口 ${APP_PORT}`);
        resolve();
      });
    });
  });

  afterAll(async () => {
    // 关闭 App 服务器
    await new Promise<void>((resolve) =>
      appServer.close(() => {
        console.log("[test] App Server 已关闭");
        resolve();
      }),
    );

    // 关闭 Mock Hub Server
    await mockHubHandle.close();

    // 关闭数据库
    store.close();
  });

  beforeEach(() => {
    // 每个测试前重置消息记录（但不重置计数器，确保 ts 全局唯一）
    resetMock();
    slackSentTexts = [];
    slackSentBlocks = [];
  });

  // ─── 健康检查 ───

  it("Mock Hub Server 健康检查", async () => {
    const res = await fetch(`${MOCK_HUB_URL}/health`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toEqual({ status: "ok" });
  });

  it("App Server 健康检查", async () => {
    const res = await fetch(`http://localhost:${APP_PORT}/health`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toEqual({ status: "ok" });
  });

  // ─── 微信->Slack 方向测试 ───

  it("微信文本消息应通过 Hub->App->Slack 链路转发", async () => {
    // Mock Hub 注入微信消息 -> 转发到 App webhook -> WxToSlack 转发到 Slack
    await injectMessage("user_alice", "你好 Slack");

    // 等待 WxToSlack 处理完成（Slack 端收到 Block Kit 消息）
    await waitFor(async () => slackSentBlocks.length > 0, 5000);

    // 验证 Slack 端收到了 Block Kit 格式的转发消息
    expect(slackSentBlocks.length).toBe(1);
    expect(slackSentBlocks[0].channel).toBe(defaultChannel);
    expect(slackSentBlocks[0].text).toContain("user_alice");
    expect(slackSentBlocks[0].text).toContain("你好 Slack");
  });

  it("多条微信消息应依次转发到 Slack", async () => {
    await injectMessage("user_alice", "第一条消息");
    await injectMessage("user_bob", "第二条消息");

    // 等待两条消息都转发完成
    await waitFor(async () => slackSentBlocks.length >= 2, 5000);

    expect(slackSentBlocks.length).toBe(2);
    expect(slackSentBlocks[0].text).toContain("第一条消息");
    expect(slackSentBlocks[1].text).toContain("第二条消息");
  });

  it("消息映射应正确保存到 Store", async () => {
    await injectMessage("user_charlie", "测试映射");

    await waitFor(async () => slackSentBlocks.length > 0, 5000);

    // 验证 Store 中保存了消息映射
    const link = store.getLatestMessageLinkByWxUser(MOCK_INSTALLATION_ID, "user_charlie");
    expect(link).toBeDefined();
    expect(link!.wxUserId).toBe("user_charlie");
    expect(link!.wxUserName).toBe("user_charlie");
    expect(link!.installationId).toBe(MOCK_INSTALLATION_ID);
    // ts 应该是 Mock SlackClient 生成的
    expect(link!.slackMessageTs).toMatch(/^slack_ts_/);
    expect(link!.slackChannelId).toBe(defaultChannel);
  });

  // ─── Slack->微信 方向测试 ───

  it("Slack 回复消息应通过 SlackToWx->HubClient 转发到微信", async () => {
    // 先模拟一条微信->Slack 的消息，建立消息映射
    await injectMessage("user_dave", "你好，请回复我");

    await waitFor(async () => slackSentBlocks.length > 0, 5000);

    // 获取映射中的 Slack 消息 ts
    const link = store.getLatestMessageLinkByWxUser(MOCK_INSTALLATION_ID, "user_dave");
    expect(link).toBeDefined();
    const slackTs = link!.slackMessageTs;

    // 模拟 Slack 用户在线程中回复这条消息
    const slackReplyData: SlackMessageData = {
      channel: defaultChannel,
      messageTs: `reply_ts_${Date.now()}`,
      threadTs: slackTs, // 线程根消息 ts（即之前转发的消息）
      text: "收到，已处理",
      userId: "slack_user_001",
    };

    // 获取所有 installation 并触发 SlackToWx 处理
    const installations = store.getAllInstallations();
    await slackToWx.handleSlackMessage(slackReplyData, installations);

    // 等待 HubClient 将消息发送到 Mock Hub
    await waitFor(async () => {
      const msgs = await getMessages();
      return msgs.length > 0;
    }, 5000);

    // 验证 Mock Hub 收到了回复消息
    const hubMessages = await getMessages();
    expect(hubMessages.length).toBe(1);
    expect(hubMessages[0].to).toBe("user_dave");
    expect(hubMessages[0].type).toBe("text");
    expect(hubMessages[0].content).toEqual({ text: "收到，已处理" });
  });

  it("Slack 回复不在映射中的消息应被忽略", async () => {
    // 模拟一条 Slack 消息，但 threadTs 在 Store 中没有对应映射
    const slackData: SlackMessageData = {
      channel: defaultChannel,
      messageTs: `orphan_ts_${Date.now()}`,
      threadTs: "nonexistent_thread_ts",
      text: "这条消息找不到映射",
      userId: "slack_user_002",
    };

    const installations = store.getAllInstallations();
    await slackToWx.handleSlackMessage(slackData, installations);

    // Mock Hub 不应收到任何消息
    const hubMessages = await getMessages();
    expect(hubMessages.length).toBe(0);
  });

  it("非目标频道的 Slack 消息应被忽略", async () => {
    // 先建立映射
    await injectMessage("user_eve", "建立映射");
    await waitFor(async () => slackSentBlocks.length > 0, 5000);
    const link = store.getLatestMessageLinkByWxUser(MOCK_INSTALLATION_ID, "user_eve");

    // 模拟来自其他频道的消息
    const slackData: SlackMessageData = {
      channel: "other_channel_999", // 非默认频道
      messageTs: `other_ts_${Date.now()}`,
      threadTs: link!.slackMessageTs,
      text: "来自其他频道",
      userId: "slack_user_003",
    };

    const installations = store.getAllInstallations();
    await slackToWx.handleSlackMessage(slackData, installations);

    // Mock Hub 不应收到消息（被 channel 过滤掉）
    const hubMessages = await getMessages();
    expect(hubMessages.length).toBe(0);
  });

  it("没有 threadTs 的 Slack 消息应被忽略", async () => {
    // 模拟一条没有 threadTs 的消息（非线程回复）
    const slackData: SlackMessageData = {
      channel: defaultChannel,
      messageTs: `no_thread_ts_${Date.now()}`,
      text: "这不是一条线程回复",
      userId: "slack_user_004",
    };

    const installations = store.getAllInstallations();
    await slackToWx.handleSlackMessage(slackData, installations);

    // Mock Hub 不应收到消息
    const hubMessages = await getMessages();
    expect(hubMessages.length).toBe(0);
  });

  // ─── Webhook 验证测试 ───

  it("无效签名的 webhook 请求应被拒绝（401）", async () => {
    const hubEvent = {
      v: 1,
      type: "event",
      trace_id: "tr_bad_sig",
      installation_id: MOCK_INSTALLATION_ID,
      bot: { id: MOCK_BOT_ID },
      event: {
        type: "message.text",
        id: "evt_bad",
        timestamp: Math.floor(Date.now() / 1000),
        data: { from_id: "hacker", from_name: "hacker", content: "恶意消息" },
      },
    };

    const res = await fetch(`http://localhost:${APP_PORT}/hub/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Timestamp": "12345",
        "X-Signature": "invalid_signature_here",
      },
      body: JSON.stringify(hubEvent),
    });

    // 应返回 401
    expect(res.status).toBe(401);

    // Slack 端不应收到任何消息
    expect(slackSentTexts.length).toBe(0);
    expect(slackSentBlocks.length).toBe(0);
  });

  it("缺少 installation_id 的请求应被拒绝（400）", async () => {
    const hubEvent = {
      v: 1,
      type: "event",
      trace_id: "tr_no_inst",
      // 没有 installation_id
      bot: { id: MOCK_BOT_ID },
      event: {
        type: "message.text",
        id: "evt_no_inst",
        timestamp: Math.floor(Date.now() / 1000),
        data: { from_id: "user", content: "test" },
      },
    };

    const res = await fetch(`http://localhost:${APP_PORT}/hub/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Timestamp": "12345",
        "X-Signature": "whatever",
      },
      body: JSON.stringify(hubEvent),
    });

    expect(res.status).toBe(400);
  });

  it("url_verification 请求应正确返回 challenge", async () => {
    const verifyEvent = {
      v: 1,
      type: "url_verification",
      challenge: "test_challenge_token_123",
    };

    const res = await fetch(`http://localhost:${APP_PORT}/hub/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(verifyEvent),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toEqual({ challenge: "test_challenge_token_123" });
  });

  // ─── 完整双向链路测试 ───

  it("完整双向链路：微信->Slack->微信", async () => {
    // 步骤 1: 微信用户发消息 -> Hub -> App -> Slack
    await injectMessage("user_frank", "你好，请帮我查个信息");

    await waitFor(async () => slackSentBlocks.length > 0, 5000);

    // 验证 Slack 端收到消息
    expect(slackSentBlocks.length).toBe(1);
    expect(slackSentBlocks[0].text).toContain("user_frank");
    expect(slackSentBlocks[0].text).toContain("你好，请帮我查个信息");

    // 步骤 2: Slack 用户回复 -> App -> Hub -> 微信
    const link = store.getLatestMessageLinkByWxUser(MOCK_INSTALLATION_ID, "user_frank");
    expect(link).toBeDefined();

    const replyData: SlackMessageData = {
      channel: defaultChannel,
      messageTs: `reply_frank_${Date.now()}`,
      threadTs: link!.slackMessageTs,
      text: "查好了，结果如下...",
      userId: "slack_user_helper",
    };

    const installations = store.getAllInstallations();
    await slackToWx.handleSlackMessage(replyData, installations);

    // 验证 Mock Hub 收到了回复
    await waitFor(async () => {
      const msgs = await getMessages();
      return msgs.length > 0;
    }, 5000);

    const hubMessages = await getMessages();
    expect(hubMessages.length).toBe(1);
    expect(hubMessages[0].to).toBe("user_frank");
    expect(hubMessages[0].content).toEqual({ text: "查好了，结果如下..." });
  });
});
