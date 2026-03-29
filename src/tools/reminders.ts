/**
 * 提醒相关工具模块
 * 包含创建提醒、列出提醒等功能
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
    name: "create_reminder",
    description: "创建 Slack 提醒",
    command: "create_reminder",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "提醒内容" },
        time: {
          type: "string",
          description: "提醒时间，支持 Unix 时间戳或自然语言，例如 \"in 15 minutes\"",
        },
      },
      required: ["text", "time"],
    },
  },
  {
    name: "list_reminders",
    description: "列出当前用户的所有 Slack 提醒",
    command: "list_reminders",
  },
];

/** 创建工具处理器 */
function createHandlers(web: WebClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 创建提醒
  handlers.set("create_reminder", async (ctx: ToolContext) => {
    try {
      const { text, time } = ctx.args;
      const result = await web.reminders.add({ text, time });
      const reminder = result.reminder;
      if (!reminder) {
        return "提醒创建成功，但未返回详细信息。";
      }
      const completeTime = reminder.time
        ? new Date(Number(reminder.time) * 1000).toLocaleString("zh-CN")
        : "未知";
      return `提醒创建成功。内容: ${reminder.text}，提醒时间: ${completeTime}，ID: ${reminder.id}`;
    } catch (err: any) {
      return `创建提醒失败: ${err.message ?? String(err)}`;
    }
  });

  // 列出提醒
  handlers.set("list_reminders", async (ctx: ToolContext) => {
    try {
      const result = await web.reminders.list();
      const reminders = result.reminders ?? [];
      if (reminders.length === 0) {
        return "当前没有提醒。";
      }
      const lines = reminders.map((r, i) => {
        const text = r.text ?? "无内容";
        const time = r.time
          ? new Date(Number(r.time) * 1000).toLocaleString("zh-CN")
          : "未知时间";
        const completed = r.complete_ts && Number(r.complete_ts) > 0 ? "已完成" : "待提醒";
        return `${i + 1}. ${text} - ${time} (${completed}，ID: ${r.id})`;
      });
      return `共 ${reminders.length} 条提醒:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出提醒失败: ${err.message ?? String(err)}`;
    }
  });

  return handlers;
}

/** 提醒工具模块 */
export const remindersTools: ToolModule = { definitions, createHandlers };
