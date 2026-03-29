/**
 * 用户相关工具模块
 * 包含获取用户信息、列出用户、列出用户组等功能
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
    name: "get_user_info",
    description: "获取指定 Slack 用户的详细信息",
    command: "get_user_info",
    parameters: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "用户 ID" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "list_users",
    description: "列出 Slack 工作区中的用户",
    command: "list_users",
    parameters: {
      type: "object",
      properties: {
        count: { type: "number", description: "获取数量" },
      },
    },
  },
  {
    name: "list_usergroups",
    description: "列出 Slack 工作区中的所有用户组",
    command: "list_usergroups",
  },
];

/** 创建工具处理器 */
function createHandlers(web: WebClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 获取用户信息
  handlers.set("get_user_info", async (ctx: ToolContext) => {
    try {
      const { user_id } = ctx.args;
      const result = await web.users.info({ user: user_id });
      const u = result.user;
      if (!u) {
        return `未找到用户 ${user_id} 的信息。`;
      }
      const lines = [
        `用户名: ${u.name ?? "未知"}`,
        `显示名称: ${u.real_name ?? "未知"}`,
        `用户 ID: ${u.id ?? "未知"}`,
        `邮箱: ${u.profile?.email ?? "未公开"}`,
        `头衔: ${u.profile?.title ?? "无"}`,
        `状态: ${u.profile?.status_text || "无"}`,
        `时区: ${u.tz ?? "未知"}`,
        `是否管理员: ${u.is_admin ? "是" : "否"}`,
        `是否机器人: ${u.is_bot ? "是" : "否"}`,
        `账号状态: ${u.deleted ? "已停用" : "活跃"}`,
      ];
      return lines.join("\n");
    } catch (err: any) {
      return `获取用户信息失败: ${err.message ?? String(err)}`;
    }
  });

  // 列出用户
  handlers.set("list_users", async (ctx: ToolContext) => {
    try {
      const { count } = ctx.args;
      const result = await web.users.list({
        ...(count ? { limit: count } : {}),
      });
      const members = result.members ?? [];
      if (members.length === 0) {
        return "工作区暂无用户。";
      }
      const lines = members
        .filter((u) => !u.deleted) // 过滤已停用用户
        .map((u, i) => {
          const name = u.name ?? "未知";
          const realName = u.real_name ?? "";
          const id = u.id ?? "未知";
          const isBot = u.is_bot ? " [机器人]" : "";
          return `${i + 1}. ${realName || name} (@${name}, ${id})${isBot}`;
        });
      return `共 ${lines.length} 名活跃用户:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出用户失败: ${err.message ?? String(err)}`;
    }
  });

  // 列出用户组
  handlers.set("list_usergroups", async (ctx: ToolContext) => {
    try {
      const result = await web.usergroups.list();
      const groups = result.usergroups ?? [];
      if (groups.length === 0) {
        return "工作区暂无用户组。";
      }
      const lines = groups.map((g, i) => {
        const name = g.name ?? "未知";
        const handle = g.handle ?? "未知";
        const id = g.id ?? "未知";
        const desc = g.description ? ` - ${g.description}` : "";
        const userCount = g.user_count ?? 0;
        return `${i + 1}. ${name} (@${handle}, ${id})，${userCount} 名成员${desc}`;
      });
      return `共 ${groups.length} 个用户组:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出用户组失败: ${err.message ?? String(err)}`;
    }
  });

  return handlers;
}

/** 用户工具模块 */
export const usersTools: ToolModule = { definitions, createHandlers };
