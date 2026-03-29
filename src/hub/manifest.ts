import type { Config } from "../config.js";
import type { ToolDefinition } from "./types.js";

/** App Manifest 结构 */
export interface Manifest {
  slug: string;
  name: string;
  description: string;
  icon: string;
  events: string[];
  scopes: string[];
  tools?: ToolDefinition[];
  oauth_setup_url: string;
  oauth_redirect_url: string;
  webhook_url: string;
}

/**
 * 生成 App Manifest
 * 声明 App 的能力、事件订阅、OAuth URL、Webhook URL 等
 */
export function getManifest(config: Config, toolDefinitions?: ToolDefinition[]): Manifest {
  return {
    slug: "slack-bridge",
    name: "Slack Bridge",
    description: "微信 ↔ Slack 双向桥接 + Slack 全平台操作",
    icon: "💬",
    events: ["message", "command"],
    scopes: ["message:read", "message:write", "tools:write"],
    tools: toolDefinitions,
    oauth_setup_url: `${config.baseUrl}/oauth/setup`,
    oauth_redirect_url: `${config.baseUrl}/oauth/redirect`,
    webhook_url: `${config.baseUrl}/hub/webhook`,
  };
}
