/**
 * App 配置接口
 * 注意：slackBotToken / slackAppToken / slackChannelId 在云端托管模式下为可选，
 * 用户会在 OAuth setup 页面自行填写并加密存储到本地数据库。
 */
export interface Config {
  /** HTTP 服务端口，默认 "8082" */
  port: string;
  /** Hub 服务地址，必填 */
  hubUrl: string;
  /** 当前 App 的公网访问地址，必填 */
  baseUrl: string;
  /** SQLite 数据库路径，默认 "data/slack.db" */
  dbPath: string;
  /** Slack Bot Token（可选，云端托管模式下由用户在安装时填写） */
  slackBotToken: string;
  /** Slack App Token（可选，云端托管模式下由用户在安装时填写） */
  slackAppToken: string;
  /** 默认转发到的 Slack 频道 ID（可选） */
  slackChannelId: string;
}

/** 从环境变量加载配置 */
export function loadConfig(): Config {
  const cfg: Config = {
    port: process.env.PORT ?? "8082",
    hubUrl: process.env.HUB_URL ?? "",
    baseUrl: process.env.BASE_URL ?? "",
    dbPath: process.env.DB_PATH ?? "data/slack.db",
    slackBotToken: process.env.SLACK_BOT_TOKEN ?? "",
    slackAppToken: process.env.SLACK_APP_TOKEN ?? "",
    slackChannelId: process.env.SLACK_CHANNEL_ID ?? "",
  };

  // 只有 HUB_URL 和 BASE_URL 是必填，Slack 凭证在云端托管模式下由用户安装时填写
  const missing: string[] = [];
  if (!cfg.hubUrl) missing.push("HUB_URL");
  if (!cfg.baseUrl) missing.push("BASE_URL");

  if (missing.length > 0) {
    throw new Error(`缺少必填环境变量: ${missing.join(", ")}`);
  }

  return cfg;
}
