/**
 * 频道相关工具模块
 * 包含列出频道、获取频道信息、创建频道、邀请用户、获取成员、设置主题等功能
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
    name: "list_channels",
    description: "列出 Slack 工作区中的频道",
    command: "list_channels",
    parameters: {
      type: "object",
      properties: {
        types: {
          type: "string",
          description: "频道类型，默认 public_channel,private_channel",
        },
        count: { type: "number", description: "获取数量" },
      },
    },
  },
  {
    name: "get_channel_info",
    description: "获取指定 Slack 频道的详细信息",
    command: "get_channel_info",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", description: "频道 ID" },
      },
      required: ["channel"],
    },
  },
  {
    name: "create_channel",
    description: "创建新的 Slack 频道",
    command: "create_channel",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "频道名称" },
        is_private: { type: "boolean", description: "是否为私有频道，默认 false" },
      },
      required: ["name"],
    },
  },
  {
    name: "invite_to_channel",
    description: "邀请用户加入指定 Slack 频道",
    command: "invite_to_channel",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", description: "频道 ID" },
        user_ids: { type: "string", description: "用户 ID 列表，多个用逗号分隔" },
      },
      required: ["channel", "user_ids"],
    },
  },
  {
    name: "get_channel_members",
    description: "获取指定 Slack 频道的成员列表",
    command: "get_channel_members",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", description: "频道 ID" },
      },
      required: ["channel"],
    },
  },
  {
    name: "set_channel_topic",
    description: "设置 Slack 频道的主题",
    command: "set_channel_topic",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", description: "频道 ID" },
        topic: { type: "string", description: "频道主题内容" },
      },
      required: ["channel", "topic"],
    },
  },
];

/** 创建工具处理器 */
function createHandlers(web: WebClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 列出频道
  handlers.set("list_channels", async (ctx: ToolContext) => {
    try {
      const { types, count } = ctx.args;
      const result = await web.conversations.list({
        types: types ?? "public_channel,private_channel",
        ...(count ? { limit: count } : {}),
      });
      const channels = result.channels ?? [];
      if (channels.length === 0) {
        return "当前工作区没有找到频道。";
      }
      const lines = channels.map((ch, i) => {
        const name = ch.name ?? "未知";
        const id = ch.id ?? "未知";
        const memberCount = ch.num_members ?? 0;
        const isPrivate = ch.is_private ? "私有" : "公开";
        const topic = ch.topic?.value ? ` | 主题: ${ch.topic.value}` : "";
        return `${i + 1}. #${name} (${id}) - ${isPrivate}，${memberCount} 名成员${topic}`;
      });
      return `共找到 ${channels.length} 个频道:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出频道失败: ${err.message ?? String(err)}`;
    }
  });

  // 获取频道信息
  handlers.set("get_channel_info", async (ctx: ToolContext) => {
    try {
      const { channel } = ctx.args;
      const result = await web.conversations.info({ channel });
      const ch = result.channel;
      if (!ch) {
        return `未找到频道 ${channel} 的信息。`;
      }
      const lines = [
        `频道名称: #${ch.name ?? "未知"}`,
        `频道 ID: ${ch.id ?? "未知"}`,
        `类型: ${ch.is_private ? "私有频道" : "公开频道"}`,
        `成员数量: ${ch.num_members ?? "未知"}`,
        `主题: ${ch.topic?.value || "无"}`,
        `描述: ${ch.purpose?.value || "无"}`,
        `创建时间: ${ch.created ? new Date(ch.created * 1000).toLocaleString("zh-CN") : "未知"}`,
        `是否已归档: ${ch.is_archived ? "是" : "否"}`,
      ];
      return lines.join("\n");
    } catch (err: any) {
      return `获取频道信息失败: ${err.message ?? String(err)}`;
    }
  });

  // 创建频道
  handlers.set("create_channel", async (ctx: ToolContext) => {
    try {
      const { name, is_private } = ctx.args;
      const result = await web.conversations.create({
        name,
        is_private: is_private ?? false,
      });
      const ch = result.channel;
      if (!ch) {
        return "频道创建成功，但未返回频道信息。";
      }
      return `频道创建成功。名称: #${ch.name}，ID: ${ch.id}，类型: ${ch.is_private ? "私有" : "公开"}`;
    } catch (err: any) {
      return `创建频道失败: ${err.message ?? String(err)}`;
    }
  });

  // 邀请用户加入频道
  handlers.set("invite_to_channel", async (ctx: ToolContext) => {
    try {
      const { channel, user_ids } = ctx.args;
      await web.conversations.invite({
        channel,
        users: user_ids,
      });
      return `已成功邀请用户 (${user_ids}) 加入频道 ${channel}。`;
    } catch (err: any) {
      return `邀请用户失败: ${err.message ?? String(err)}`;
    }
  });

  // 获取频道成员
  handlers.set("get_channel_members", async (ctx: ToolContext) => {
    try {
      const { channel } = ctx.args;
      const result = await web.conversations.members({ channel });
      const members = result.members ?? [];
      if (members.length === 0) {
        return `频道 ${channel} 暂无成员。`;
      }
      const lines = members.map((id, i) => `${i + 1}. ${id}`);
      return `频道 ${channel} 共 ${members.length} 名成员:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `获取频道成员失败: ${err.message ?? String(err)}`;
    }
  });

  // 设置频道主题
  handlers.set("set_channel_topic", async (ctx: ToolContext) => {
    try {
      const { channel, topic } = ctx.args;
      await web.conversations.setTopic({ channel, topic });
      return `频道 ${channel} 的主题已设置为: ${topic}`;
    } catch (err: any) {
      return `设置频道主题失败: ${err.message ?? String(err)}`;
    }
  });

  return handlers;
}

/** 频道工具模块 */
export const channelsTools: ToolModule = { definitions, createHandlers };
