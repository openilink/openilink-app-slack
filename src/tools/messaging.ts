/**
 * 消息相关工具模块
 * 包含发送、回复、更新、删除消息，查看历史，查看线程，添加表情，Pin 消息等功能
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
    name: "send_slack_message",
    description: "向指定 Slack 频道发送消息",
    command: "send_slack_message",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", description: "频道 ID" },
        text: { type: "string", description: "消息内容" },
        thread_ts: { type: "string", description: "线程时间戳，可选，用于在线程中发送消息" },
      },
      required: ["channel", "text"],
    },
  },
  {
    name: "reply_slack_message",
    description: "回复 Slack 频道中的某条消息（在线程中回复）",
    command: "reply_slack_message",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", description: "频道 ID" },
        thread_ts: { type: "string", description: "要回复的消息的线程时间戳" },
        text: { type: "string", description: "回复内容" },
      },
      required: ["channel", "thread_ts", "text"],
    },
  },
  {
    name: "update_slack_message",
    description: "更新 Slack 频道中已发送的消息",
    command: "update_slack_message",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", description: "频道 ID" },
        ts: { type: "string", description: "要更新的消息时间戳" },
        text: { type: "string", description: "更新后的消息内容" },
      },
      required: ["channel", "ts", "text"],
    },
  },
  {
    name: "delete_slack_message",
    description: "删除 Slack 频道中的指定消息",
    command: "delete_slack_message",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", description: "频道 ID" },
        ts: { type: "string", description: "要删除的消息时间戳" },
      },
      required: ["channel", "ts"],
    },
  },
  {
    name: "get_message_history",
    description: "查看指定 Slack 频道的消息历史",
    command: "get_message_history",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", description: "频道 ID" },
        count: { type: "number", description: "获取消息数量，默认 20" },
      },
      required: ["channel"],
    },
  },
  {
    name: "get_thread_replies",
    description: "查看 Slack 消息线程中的所有回复",
    command: "get_thread_replies",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", description: "频道 ID" },
        thread_ts: { type: "string", description: "线程的父消息时间戳" },
      },
      required: ["channel", "thread_ts"],
    },
  },
  {
    name: "add_reaction",
    description: "为 Slack 消息添加表情回应",
    command: "add_reaction",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", description: "频道 ID" },
        timestamp: { type: "string", description: "消息时间戳" },
        emoji: { type: "string", description: "表情名称（不含冒号），例如 thumbsup" },
      },
      required: ["channel", "timestamp", "emoji"],
    },
  },
  {
    name: "pin_message",
    description: "将 Slack 消息固定（Pin）到频道",
    command: "pin_message",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", description: "频道 ID" },
        timestamp: { type: "string", description: "消息时间戳" },
      },
      required: ["channel", "timestamp"],
    },
  },
];

/** 创建工具处理器 */
function createHandlers(web: WebClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 发送消息
  handlers.set("send_slack_message", async (ctx: ToolContext) => {
    try {
      const { channel, text, thread_ts } = ctx.args;
      const result = await web.chat.postMessage({
        channel,
        text,
        ...(thread_ts ? { thread_ts } : {}),
      });
      return `消息发送成功。频道: ${channel}，时间戳: ${result.ts}`;
    } catch (err: any) {
      return `发送消息失败: ${err.message ?? String(err)}`;
    }
  });

  // 回复消息
  handlers.set("reply_slack_message", async (ctx: ToolContext) => {
    try {
      const { channel, thread_ts, text } = ctx.args;
      const result = await web.chat.postMessage({
        channel,
        text,
        thread_ts,
      });
      return `回复消息成功。频道: ${channel}，线程: ${thread_ts}，回复时间戳: ${result.ts}`;
    } catch (err: any) {
      return `回复消息失败: ${err.message ?? String(err)}`;
    }
  });

  // 更新消息
  handlers.set("update_slack_message", async (ctx: ToolContext) => {
    try {
      const { channel, ts, text } = ctx.args;
      await web.chat.update({ channel, ts, text });
      return `消息更新成功。频道: ${channel}，时间戳: ${ts}`;
    } catch (err: any) {
      return `更新消息失败: ${err.message ?? String(err)}`;
    }
  });

  // 删除消息
  handlers.set("delete_slack_message", async (ctx: ToolContext) => {
    try {
      const { channel, ts } = ctx.args;
      await web.chat.delete({ channel, ts });
      return `消息删除成功。频道: ${channel}，时间戳: ${ts}`;
    } catch (err: any) {
      return `删除消息失败: ${err.message ?? String(err)}`;
    }
  });

  // 查看频道消息历史
  handlers.set("get_message_history", async (ctx: ToolContext) => {
    try {
      const { channel, count } = ctx.args;
      const limit = count ?? 20;
      const result = await web.conversations.history({ channel, limit });
      const messages = result.messages ?? [];
      if (messages.length === 0) {
        return `频道 ${channel} 暂无消息。`;
      }
      const lines = messages.map((msg, i) => {
        const time = msg.ts ? new Date(Number(msg.ts) * 1000).toLocaleString("zh-CN") : "未知时间";
        const user = msg.user ?? "未知用户";
        const text = msg.text ?? "(无文本)";
        return `${i + 1}. [${time}] <${user}>: ${text} (ts: ${msg.ts})`;
      });
      return `频道 ${channel} 最近 ${messages.length} 条消息:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `获取消息历史失败: ${err.message ?? String(err)}`;
    }
  });

  // 查看线程回复
  handlers.set("get_thread_replies", async (ctx: ToolContext) => {
    try {
      const { channel, thread_ts } = ctx.args;
      const result = await web.conversations.replies({ channel, ts: thread_ts });
      const messages = result.messages ?? [];
      if (messages.length === 0) {
        return `线程 ${thread_ts} 暂无回复。`;
      }
      const lines = messages.map((msg, i) => {
        const time = msg.ts ? new Date(Number(msg.ts) * 1000).toLocaleString("zh-CN") : "未知时间";
        const user = msg.user ?? "未知用户";
        const text = msg.text ?? "(无文本)";
        return `${i + 1}. [${time}] <${user}>: ${text} (ts: ${msg.ts})`;
      });
      return `线程 ${thread_ts} 共 ${messages.length} 条消息:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `获取线程回复失败: ${err.message ?? String(err)}`;
    }
  });

  // 添加表情回应
  handlers.set("add_reaction", async (ctx: ToolContext) => {
    try {
      const { channel, timestamp, emoji } = ctx.args;
      await web.reactions.add({ channel, timestamp, name: emoji });
      return `表情 :${emoji}: 添加成功。频道: ${channel}，消息: ${timestamp}`;
    } catch (err: any) {
      return `添加表情失败: ${err.message ?? String(err)}`;
    }
  });

  // Pin 消息
  handlers.set("pin_message", async (ctx: ToolContext) => {
    try {
      const { channel, timestamp } = ctx.args;
      await web.pins.add({ channel, timestamp });
      return `消息已固定。频道: ${channel}，消息: ${timestamp}`;
    } catch (err: any) {
      return `固定消息失败: ${err.message ?? String(err)}`;
    }
  });

  return handlers;
}

/** 消息工具模块 */
export const messagingTools: ToolModule = { definitions, createHandlers };
