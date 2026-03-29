import type { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { generatePKCE } from "../utils/crypto.js";
import type { Store } from "../store.js";
import type { Config } from "../config.js";
import type { ToolDefinition } from "./types.js";
import { HubClient } from "./client.js";

/** PKCE 缓存条目 */
interface PKCEEntry {
  verifier: string;
  hub: string;
  appId: string;
  returnUrl: string;
  expiresAt: number;
}

/** PKCE 缓存，key 为 localState，10 分钟过期 */
const pkceCache = new Map<string, PKCEEntry>();

/** 缓存过期时间：10 分钟 */
const PKCE_TTL_MS = 10 * 60 * 1000;

/** 清理过期的 PKCE 条目 */
export function cleanExpired(): void {
  const now = Date.now();
  for (const [key, entry] of pkceCache) {
    if (entry.expiresAt < now) {
      pkceCache.delete(key);
    }
  }
}

/**
 * 处理 OAuth 安装流程第一步：生成 PKCE 并重定向到 Hub 授权页
 * 路由: GET /oauth/setup
 */
export function handleOAuthSetup(
  req: IncomingMessage,
  res: ServerResponse,
  config: Config,
): void {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const params = url.searchParams;

  const hub = params.get("hub") ?? config.hubUrl;
  const appId = params.get("app_id") ?? "";
  const botId = params.get("bot_id") ?? "";
  const state = params.get("state") ?? "";
  const returnUrl = params.get("return_url") ?? "";

  if (!hub || !appId || !botId) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "缺少必填参数: hub, app_id, bot_id" }));
    return;
  }

  // 清理过期缓存
  cleanExpired();

  // 生成 PKCE
  const { verifier, challenge } = generatePKCE();
  const localState = randomBytes(16).toString("hex");

  // 缓存（含 hub, appId, returnUrl）
  pkceCache.set(localState, {
    verifier,
    hub,
    appId,
    returnUrl,
    expiresAt: Date.now() + PKCE_TTL_MS,
  });

  // 重定向到 Hub 授权页
  const authUrl = `${hub}/api/apps/${appId}/oauth/authorize?bot_id=${encodeURIComponent(botId)}&state=${encodeURIComponent(localState)}&code_challenge=${encodeURIComponent(challenge)}&hub_state=${encodeURIComponent(state)}`;
  res.writeHead(302, { Location: authUrl });
  res.end();
}

/**
 * 处理 OAuth 回调：用授权码 + code_verifier 换取凭证并保存
 * 路由: GET /oauth/redirect
 */
export async function handleOAuthRedirect(
  req: IncomingMessage,
  res: ServerResponse,
  config: Config,
  store: Store,
  toolDefinitions?: ToolDefinition[],
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const params = url.searchParams;

  const code = params.get("code") ?? "";
  const state = params.get("state") ?? "";

  if (!code || !state) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "缺少必填参数: code, state" }));
    return;
  }

  // 清理过期缓存
  cleanExpired();

  // 从缓存取出 PKCE verifier
  const pkceEntry = pkceCache.get(state);
  if (!pkceEntry) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "PKCE 状态无效或已过期" }));
    return;
  }
  pkceCache.delete(state);

  const { verifier, hub, appId, returnUrl } = pkceEntry;

  try {
    // 向 Hub 交换凭证
    const exchangeUrl = `${hub}/api/apps/${appId}/oauth/exchange`;
    const exchangeRes = await fetch(exchangeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: verifier,
      }),
    });

    if (!exchangeRes.ok) {
      const errText = await exchangeRes.text();
      console.error("[oauth] 凭证交换失败:", exchangeRes.status, errText);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "凭证交换失败", detail: errText }));
      return;
    }

    const tokenData = (await exchangeRes.json()) as {
      app_token: string;
      webhook_secret: string;
      app_id: string;
      bot_id: string;
      installation_id: string;
    };

    // 保存安装记录
    store.saveInstallation({
      id: tokenData.installation_id,
      hubUrl: hub,
      appId: tokenData.app_id || appId,
      botId: tokenData.bot_id,
      appToken: tokenData.app_token,
      webhookSecret: tokenData.webhook_secret,
    });

    console.log("[oauth] 安装成功, installation_id:", tokenData.installation_id);

    // OAuth 成功后，同步工具定义到 Hub
    if (toolDefinitions && toolDefinitions.length > 0) {
      try {
        const hubClient = new HubClient(hub, tokenData.app_token);
        await hubClient.syncTools(toolDefinitions);
        console.log("[oauth] 工具定义同步完成");
      } catch (err) {
        console.error("[oauth] 工具定义同步失败:", err);
      }
    }

    // 重定向到 returnUrl（如果有）
    if (returnUrl) {
      res.writeHead(302, { Location: returnUrl });
      res.end();
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, message: "安装成功" }));
    }
  } catch (err) {
    console.error("[oauth] 凭证交换异常:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "凭证交换过程发生异常" }));
  }
}
