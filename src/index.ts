import { createServer, type Server } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadConfig } from "./config.js";
import { Store } from "./store.js";
import { handleOAuthSetup, handleOAuthRedirect, cleanExpired } from "./hub/oauth.js";
import { handleWebhook } from "./hub/webhook.js";
import { getManifest } from "./hub/manifest.js";
import { HubClient } from "./hub/client.js";
import { Router } from "./router.js";
import { SlackClient } from "./slack/client.js";
import { createSlackApp, type SlackMessageData } from "./slack/event.js";
import { collectAllTools } from "./tools/index.js";
import { WxToSlack } from "./bridge/wx-to-slack.js";
import { SlackToWx } from "./bridge/slack-to-wx.js";
import type { HubEvent } from "./hub/types.js";

/** 启动服务 */
async function main(): Promise<void> {
  const config = loadConfig();

  // 确保数据库目录存在
  mkdirSync(dirname(config.dbPath), { recursive: true });

  const store = new Store(config.dbPath);

  // 初始化 Slack 客户端
  const slackClient = new SlackClient(config.slackBotToken, config.slackChannelId);

  // 收集所有 Tool 定义和 Handler
  const { definitions, handlers } = collectAllTools(slackClient.web);

  // 初始化命令路由器
  const router = new Router(handlers);

  // 初始化消息桥接
  const wxToSlack = new WxToSlack(slackClient, store, config.slackChannelId);
  const slackToWx = new SlackToWx(store, config.slackChannelId);

  // 创建 Slack Bolt App（Socket Mode）
  const slackApp = createSlackApp(
    config.slackBotToken,
    config.slackAppToken,
    async (data: SlackMessageData) => {
      // Slack 消息回调：将 Slack 回复转发回微信
      const installations = store.getAllInstallations();
      await slackToWx.handleSlackMessage(data, installations);
    },
  );

  // 定期清理过期的 PKCE 缓存
  const cleanupTimer = setInterval(cleanExpired, 60_000);

  /**
   * 处理 Hub 推送的事件
   * - command 类型 → Router 路由到 Tool Handler
   * - message.* 类型 → WxToSlack 桥接到 Slack
   */
  async function onHubEvent(event: HubEvent, installationId: string): Promise<void> {
    if (!event.event) return;

    const { type } = event.event;
    const installation = store.getInstallation(installationId);
    if (!installation) return;

    const hubClient = new HubClient(installation.hubUrl, installation.appToken);

    console.log(`[Event] 收到事件: type=${type}, installation=${installationId}`);

    if (type === "command") {
      // 命令路由
      const result = await router.handleCommand(event, installation, hubClient);
      if (result) {
        // 通过 Hub API 回复结果给用户
        const userId = event.event.data?.user_id;
        if (userId) {
          await hubClient.sendText(userId, result, event.trace_id);
        }
      }
    } else if (type.startsWith("message")) {
      // 微信消息桥接到 Slack
      await wxToSlack.handleWxEvent(event, installation);
    }
  }

  // 创建 HTTP 服务器
  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", config.baseUrl);
    const path = url.pathname;

    // CORS 预检
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Timestamp, X-Signature",
      });
      res.end();
      return;
    }

    try {
      // 健康检查
      if (path === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, version: "0.1.0" }));
        return;
      }

      // Manifest
      if (path === "/manifest.json" && req.method === "GET") {
        const manifest = getManifest(config, definitions);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(manifest));
        return;
      }

      // OAuth 安装流程
      if (path === "/oauth/setup" && req.method === "GET") {
        handleOAuthSetup(req, res, config);
        return;
      }

      if (path === "/oauth/redirect" && req.method === "GET") {
        await handleOAuthRedirect(req, res, config, store);
        return;
      }

      // Hub Webhook
      if (path === "/hub/webhook" && req.method === "POST") {
        await handleWebhook(req, res, store, onHubEvent);
        return;
      }

      // 404
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
    } catch (err) {
      console.error("[Server] 请求处理异常:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal Server Error" }));
      }
    }
  });

  // 启动 Slack Socket Mode
  await slackApp.start();
  console.log("[Slack] Socket Mode 已连接");

  // 启动 HTTP 服务
  server.listen(Number(config.port), () => {
    console.log(`[Server] Slack Bridge 已启动，监听端口 ${config.port}`);
    console.log(`[Server] Manifest: ${config.baseUrl}/manifest.json`);
    console.log(`[Server] Webhook: ${config.baseUrl}/hub/webhook`);
    console.log(`[Server] Health: ${config.baseUrl}/health`);
  });

  // 优雅关闭
  function shutdown(signal: string): void {
    console.log(`[Server] 收到 ${signal} 信号，开始优雅关闭...`);

    clearInterval(cleanupTimer);

    // 并行关闭所有服务
    Promise.all([
      slackApp.stop().catch((err: unknown) => console.error("[Slack] 关闭失败:", err)),
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
    ])
      .then(() => {
        store.close();
        console.log("[Server] 已优雅关闭");
        process.exit(0);
      })
      .catch((err) => {
        console.error("[Server] 关闭异常:", err);
        process.exit(1);
      });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[Server] 启动失败:", err);
  process.exit(1);
});
