import type { ToolDefinition } from "./types.js";

/** Hub Bot API 客户端，用于向微信发送消息、同步工具定义 */
export class HubClient {
  private hubUrl: string;
  private appToken: string;

  constructor(hubUrl: string, appToken: string) {
    this.hubUrl = hubUrl;
    this.appToken = appToken;
  }

  /**
   * 将工具定义同步注册到 Hub
   * PUT {hubUrl}/bot/v1/app/tools
   */
  async syncTools(tools: ToolDefinition[]): Promise<void> {
    const url = `${this.hubUrl}/bot/v1/app/tools`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.appToken}`,
        },
        body: JSON.stringify({ tools }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Hub API 同步工具失败: ${res.status} ${errText}`);
      }
      console.log(`[HubClient] 工具定义同步成功, 共 ${tools.length} 个工具`);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * 发送文本消息
   * @param to 接收者 ID（微信用户 ID）
   * @param text 文本内容
   * @param traceId 可选追踪 ID
   */
  async sendText(to: string, text: string, traceId?: string): Promise<void> {
    await this.sendMessage(to, "text", { text }, traceId);
  }

  /**
   * 发送图片消息
   * @param to 接收者 ID
   * @param imageUrl 图片 URL
   * @param traceId 可选追踪 ID
   */
  async sendImage(to: string, imageUrl: string, traceId?: string): Promise<void> {
    await this.sendMessage(to, "image", { url: imageUrl }, traceId);
  }

  /**
   * 发送文件消息
   * @param to 接收者 ID
   * @param fileUrl 文件 URL
   * @param fileName 文件名
   * @param traceId 可选追踪 ID
   */
  async sendFile(to: string, fileUrl: string, fileName: string, traceId?: string): Promise<void> {
    await this.sendMessage(to, "file", { url: fileUrl, name: fileName }, traceId);
  }

  /**
   * 发送通用消息
   * @param to 接收者 ID
   * @param type 消息类型
   * @param content 消息内容
   * @param traceId 可选追踪 ID
   */
  async sendMessage(
    to: string,
    type: string,
    content: Record<string, any>,
    traceId?: string,
  ): Promise<void> {
    const url = `${this.hubUrl}/api/bot/send`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.appToken}`,
    };
    if (traceId) {
      headers["X-Trace-Id"] = traceId;
    }

    const body = JSON.stringify({
      to,
      type,
      content,
    });

    // 30 秒超时
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Hub API 请求失败: ${res.status} ${errText}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
