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
  /** Hub 应用市场一键安装时自动生成配置表单的 JSON Schema */
  config_schema?: Record<string, unknown>;
  /** 安装指南，Markdown 格式 */
  guide?: string;
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
    scopes: ["message:read", "message:write", "tools:write", "config:read"],
    tools: toolDefinitions,
    oauth_setup_url: `${config.baseUrl}/oauth/setup`,
    oauth_redirect_url: `${config.baseUrl}/oauth/redirect`,
    webhook_url: `${config.baseUrl}/hub/webhook`,
    config_schema: {
      type: "object",
      properties: {
        slack_bot_token: {
          type: "string",
          title: "Slack Bot Token",
          description: "xoxb- 开头的 Bot Token",
        },
        slack_app_token: {
          type: "string",
          title: "Slack App Token",
          description: "xapp- 开头，用于 Socket Mode",
        },
        slack_channel_id: {
          type: "string",
          title: "Slack 频道 ID",
          description: "默认转发到的频道（可选）",
        },
      },
      required: ["slack_bot_token", "slack_app_token"],
    },
    guide: `## Slack Bridge 安装指南
### 第 1 步：创建 Slack App
1. 访问 [api.slack.com/apps](https://api.slack.com/apps)
2. Create New App → From scratch
### 第 2 步：启用 Socket Mode
Settings → Socket Mode → Enable
生成 App-Level Token（xapp-），scope 选 connections:write
### 第 3 步：配置 Bot Token
OAuth & Permissions → Bot Token Scopes 添加 chat:write, channels:history, app_mentions:read
Install to Workspace → 获取 xoxb- Bot Token
### 第 4 步：订阅事件
Event Subscriptions → Enable Events → Subscribe to bot events → message.channels, message.im
### 第 5 步：填写上方配置并安装
`,
  };
}
