import type { IncomingMessage, ServerResponse } from "node:http";
import { verifySignature } from "../utils/crypto.js";
import type { Store } from "../store.js";
import type { HubEvent } from "./types.js";

/**
 * 从请求中读取完整的 body
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * 处理 Hub Webhook 推送
 * - url_verification → 返回 challenge
 * - event → 验证签名 → 查找 installation → 调用 onEvent 回调
 */
export async function handleWebhook(
  req: IncomingMessage,
  res: ServerResponse,
  store: Store,
  onEvent: (event: HubEvent, installationId: string) => Promise<void>,
): Promise<void> {
  try {
    const body = await readBody(req);
    const payload = JSON.parse(body) as HubEvent;

    // URL 验证：直接返回 challenge
    if (payload.type === "url_verification") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ challenge: payload.challenge }));
      return;
    }

    // 查找对应的安装记录
    const installationId = payload.installation_id;
    if (!installationId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "缺少 installation_id" }));
      return;
    }

    const installation = store.getInstallation(installationId);
    if (!installation) {
      console.warn("[Webhook] 未找到安装记录:", installationId);
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "安装记录不存在" }));
      return;
    }

    // 验证签名
    const timestamp = req.headers["x-timestamp"] as string | undefined;
    const signature = req.headers["x-signature"] as string | undefined;

    if (!timestamp || !signature) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "缺少签名头" }));
      return;
    }

    if (!verifySignature(installation.webhookSecret, timestamp, body, signature)) {
      console.warn("[Webhook] 签名验证失败:", installationId);
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "签名验证失败" }));
      return;
    }

    // 先返回 200，再异步处理事件
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));

    // 异步调用事件处理回调
    onEvent(payload, installationId).catch((err) => {
      console.error("[Webhook] 事件处理失败:", err);
    });
  } catch (err) {
    console.error("[Webhook] 处理异常:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "内部错误" }));
    }
  }
}
