/** Hub 推送到 App 的 Webhook 事件 */
export interface HubEvent {
  /** 协议版本 */
  v: number;
  /** 事件类型 */
  type: "event" | "url_verification";
  /** 追踪 ID */
  trace_id: string;
  /** URL 验证时的 challenge 字符串 */
  challenge?: string;
  /** 安装 ID */
  installation_id: string;
  /** Bot 信息 */
  bot: { id: string };
  /** 具体事件内容 */
  event?: {
    /** 事件类型，如 "message"、"command" */
    type: string;
    /** 事件唯一 ID */
    id: string;
    /** 事件时间戳 */
    timestamp: number;
    /** 事件数据 */
    data: Record<string, any>;
  };
}

/** 安装记录 */
export interface Installation {
  /** 安装 ID */
  id: string;
  /** Hub 服务地址 */
  hubUrl: string;
  /** App ID */
  appId: string;
  /** Bot ID */
  botId: string;
  /** 用于调用 Hub Bot API 的令牌 */
  appToken: string;
  /** Webhook 签名密钥 */
  webhookSecret: string;
  /** 创建时间 */
  createdAt?: string;
}

/** 消息关联记录 */
export interface MessageLink {
  /** 自增 ID */
  id?: number;
  /** 安装 ID */
  installationId: string;
  /** Slack 消息时间戳（作为消息 ID） */
  slackMessageTs: string;
  /** Slack 频道 ID */
  slackChannelId: string;
  /** 微信用户 ID */
  wxUserId: string;
  /** 微信用户名 */
  wxUserName: string;
  /** 创建时间 */
  createdAt?: string;
}

/** 工具定义 */
export interface ToolDefinition {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 工具对应的命令 */
  command: string;
  /** 工具参数定义 */
  parameters?: Record<string, any>;
}

/** 工具执行上下文 */
export interface ToolContext {
  /** 安装 ID */
  installationId: string;
  /** Bot ID */
  botId: string;
  /** 用户 ID */
  userId: string;
  /** 追踪 ID */
  traceId: string;
  /** 工具参数 */
  args: Record<string, any>;
}

/** 工具处理器函数 */
export type ToolHandler = (ctx: ToolContext) => Promise<string>;
