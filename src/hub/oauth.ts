import type { IncomingMessage, ServerResponse } from "node:http";
import { generatePKCE } from "../utils/crypto.js";
import type { Store } from "../store.js";
import type { Config } from "../config.js";
import type { ToolDefinition } from "./types.js";
import { HubClient } from "./client.js";

/** PKCE 缓存条目 */
interface PKCECacheEntry {
  verifier: string;
  createdAt: number;
}

/** PKCE 缓存，key 为 state 参数 */
const pkceCache = new Map<string, PKCECacheEntry>();

/** 缓存过期时间：10 分钟 */
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * 处理 OAuth 安装流程的第一步
 * Hub 跳转到 App 的 /oauth/setup
 * App 生成 PKCE → 重定向到 Hub 授权页面
 */
export function handleOAuthSetup(
  req: IncomingMessage,
  res: ServerResponse,
  config: Config,
): void {
  const url = new URL(req.url ?? "/", config.baseUrl);
  const hubUrl = url.searchParams.get("hub_url") ?? config.hubUrl;
  const appId = url.searchParams.get("app_id") ?? "";

  // 生成 PKCE 密钥对
  const { verifier, challenge } = generatePKCE();

  // 用随机 state 作为缓存 key
  const state = crypto.randomUUID();
  pkceCache.set(state, { verifier, createdAt: Date.now() });

  // 构造 Hub 授权 URL
  const authUrl = new URL("/oauth/authorize", hubUrl);
  authUrl.searchParams.set("app_id", appId);
  authUrl.searchParams.set("redirect_uri", `${config.baseUrl}/oauth/redirect`);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);

  // 重定向到 Hub 授权页面
  res.writeHead(302, { Location: authUrl.toString() });
  res.end();
}

/**
 * 处理 OAuth 回调
 * Hub 授权完成后回调到 /oauth/redirect
 * 用 code + code_verifier 换取 app_token 和 webhook_secret
 */
export async function handleOAuthRedirect(
  req: IncomingMessage,
  res: ServerResponse,
  config: Config,
  store: Store,
  toolDefinitions?: ToolDefinition[],
): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", config.baseUrl);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const installationId = url.searchParams.get("installation_id") ?? "";

    if (!code || !state) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "缺少 code 或 state 参数" }));
      return;
    }

    // 从缓存中获取 PKCE verifier
    const cached = pkceCache.get(state);
    if (!cached) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "无效或过期的 state" }));
      return;
    }
    pkceCache.delete(state);

    // 用 code + code_verifier 向 Hub 换取令牌
    const tokenUrl = new URL("/oauth/token", config.hubUrl);
    const tokenRes = await fetch(tokenUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        code_verifier: cached.verifier,
        redirect_uri: `${config.baseUrl}/oauth/redirect`,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[OAuth] 令牌交换失败:", tokenRes.status, errText);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "令牌交换失败" }));
      return;
    }

    const tokenData = (await tokenRes.json()) as {
      app_token: string;
      webhook_secret: string;
      app_id: string;
      bot_id: string;
      installation_id: string;
    };

    // 保存安装记录
    store.saveInstallation({
      id: tokenData.installation_id || installationId,
      hubUrl: config.hubUrl,
      appId: tokenData.app_id,
      botId: tokenData.bot_id,
      appToken: tokenData.app_token,
      webhookSecret: tokenData.webhook_secret,
    });

    console.log("[OAuth] 安装成功:", tokenData.installation_id || installationId);

    // OAuth 成功后，同步工具定义到 Hub
    if (toolDefinitions && toolDefinitions.length > 0) {
      try {
        const hubClient = new HubClient(config.hubUrl, tokenData.app_token);
        await hubClient.syncTools(toolDefinitions);
        console.log("[OAuth] 工具定义同步完成");
      } catch (err) {
        console.error("[OAuth] 工具定义同步失败:", err);
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, message: "安装成功" }));
  } catch (err) {
    console.error("[OAuth] 处理回调异常:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "内部错误" }));
  }
}

/** 清理过期的 PKCE 缓存条目 */
export function cleanExpired(): void {
  const now = Date.now();
  for (const [state, entry] of pkceCache) {
    if (now - entry.createdAt > CACHE_TTL_MS) {
      pkceCache.delete(state);
    }
  }
}
