/**
 * 工具注册中心
 * 收集所有工具模块的定义和处理器
 */
import type { WebClient } from "@slack/web-api";
import type { ToolDefinition, ToolHandler } from "../hub/types.js";
import { messagingTools } from "./messaging.js";
import { channelsTools } from "./channels.js";
import { filesTools } from "./files.js";
import { usersTools } from "./users.js";
import { remindersTools } from "./reminders.js";
import { bookmarksTools } from "./bookmarks.js";

/** 工具模块接口 */
export interface ToolModule {
  definitions: ToolDefinition[];
  createHandlers: (web: WebClient) => Map<string, ToolHandler>;
}

/** 所有工具模块列表 */
const allModules: ToolModule[] = [
  messagingTools,
  channelsTools,
  filesTools,
  usersTools,
  remindersTools,
  bookmarksTools,
];

/**
 * 收集所有工具模块的定义和处理器
 * @param web Slack WebClient 实例
 * @returns 包含所有工具定义和处理器的对象
 */
export function collectAllTools(web: WebClient): {
  definitions: ToolDefinition[];
  handlers: Map<string, ToolHandler>;
} {
  const definitions: ToolDefinition[] = [];
  const handlers = new Map<string, ToolHandler>();

  for (const mod of allModules) {
    // 收集定义
    definitions.push(...mod.definitions);

    // 收集处理器
    const moduleHandlers = mod.createHandlers(web);
    for (const [name, handler] of moduleHandlers) {
      handlers.set(name, handler);
    }
  }

  return { definitions, handlers };
}
