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
    guide: `## Slack Bridge 安装指南

安装时会引导您配置 Slack Key，请提前准备好以下信息：

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

### 第 5 步：点击安装
安装过程中会显示配置页面，填写 Slack Bot Token、App Token 即可完成。
安装后可通过 /settings 页面随时修改配置。
`,
  };
}
