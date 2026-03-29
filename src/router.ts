import type { HubEvent, Installation, ToolHandler, ToolContext } from "./hub/types.js";
import { HubClient } from "./hub/client.js";

/**
 * 命令路由器
 * 根据事件中的命令名查找对应的 Tool Handler 并执行
 */
export class Router {
  private handlers: Map<string, ToolHandler>;

  constructor(handlers: Map<string, ToolHandler>) {
    this.handlers = handlers;
  }

  /**
   * 处理命令事件
   * 从 event.event.data 提取命令名（data.command 或 data.name），
   * 去除 "/" 前缀后查找 handler，构建 ToolContext 并执行
   *
   * @param event Hub 推送的事件
   * @param installation 安装记录
   * @param hubClient Hub 客户端（可用于在 handler 中回复消息）
   * @returns handler 执行结果，未找到 handler 时返回 null
   */
  async handleCommand(
    event: HubEvent,
    installation: Installation,
    hubClient: HubClient,
  ): Promise<string | null> {
    if (!event.event) return null;

    const { data } = event.event;
    if (!data) return null;

    // 从 data.command 或 data.name 中提取命令名
    let command: string = data.command ?? data.name ?? "";

    // 去除 "/" 前缀
    if (command.startsWith("/")) {
      command = command.slice(1);
    }

    if (!command) return null;

    // 查找对应的 handler
    const handler = this.handlers.get(command);
    if (!handler) {
      console.warn(`[Router] 未找到命令处理器: ${command}`);
      return null;
    }

    // 构建 ToolContext
    const ctx: ToolContext = {
      installationId: installation.id,
      botId: installation.botId,
      userId: data.user_id ?? "",
      traceId: event.trace_id,
      args: data,
    };

    console.log(`[Router] 执行命令: ${command}, user=${ctx.userId}, trace=${ctx.traceId}`);

    // 执行 handler
    return handler(ctx);
  }
}
