/**
 * 书签相关工具模块
 * 包含列出频道书签功能
 */
import type { WebClient } from "@slack/web-api";
import type { ToolDefinition, ToolContext, ToolHandler } from "../hub/types.js";

/** 工具模块接口 */
export interface ToolModule {
  definitions: ToolDefinition[];
  createHandlers: (web: WebClient) => Map<string, ToolHandler>;
}

/** 工具定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "list_bookmarks",
    description: "列出指定 Slack 频道的所有书签",
    command: "list_bookmarks",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", description: "频道 ID" },
      },
      required: ["channel"],
    },
  },
];

/** 创建工具处理器 */
function createHandlers(web: WebClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出书签
  handlers.set("list_bookmarks", async (ctx: ToolContext) => {
    try {
      const { channel } = ctx.args;
      const result = await web.bookmarks.list({ channel_id: channel });
      const bookmarks = result.bookmarks ?? [];
      if (bookmarks.length === 0) {
        return `频道 ${channel} 暂无书签。`;
      }
      const lines = bookmarks.map((b, i) => {
        const title = b.title ?? "无标题";
        const link = b.link ?? "无链接";
        const type = b.type ?? "未知类型";
        const created = b.date_created
          ? new Date(Number(b.date_created) * 1000).toLocaleString("zh-CN")
          : "未知时间";
        return `${i + 1}. ${title} (${type}) - ${link}，创建于 ${created}`;
      });
      return `频道 ${channel} 共 ${bookmarks.length} 个书签:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出书签失败: ${err.message ?? String(err)}`;
    }
  });

  return handlers;
}

/** 书签工具模块 */
export const bookmarksTools: ToolModule = { definitions, createHandlers };
