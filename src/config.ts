/** App 配置接口 */
export interface Config {
  /** HTTP 服务端口，默认 "8082" */
  port: string;
  /** Hub 服务地址，必填 */
  hubUrl: string;
  /** 当前 App 的公网访问地址，必填 */
  baseUrl: string;
  /** SQLite 数据库路径，默认 "data/slack.db" */
  dbPath: string;
  /** Slack Bot Token，必填，xoxb- 开头 */
  slackBotToken: string;
  /** Slack App Token，必填，xapp- 开头，用于 Socket Mode */
  slackAppToken: string;
  /** 默认转发到的 Slack 频道 ID */
  slackChannelId: string;
}

/** 从环境变量加载配置 */
export function loadConfig(): Config {
  const hubUrl = process.env.HUB_URL;
  if (!hubUrl) throw new Error("缺少环境变量 HUB_URL");

  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) throw new Error("缺少环境变量 BASE_URL");

  const slackBotToken = process.env.SLACK_BOT_TOKEN;
  if (!slackBotToken) throw new Error("缺少环境变量 SLACK_BOT_TOKEN");

  const slackAppToken = process.env.SLACK_APP_TOKEN;
  if (!slackAppToken) throw new Error("缺少环境变量 SLACK_APP_TOKEN");

  const slackChannelId = process.env.SLACK_CHANNEL_ID;
  if (!slackChannelId) throw new Error("缺少环境变量 SLACK_CHANNEL_ID");

  return {
    port: process.env.PORT ?? "8082",
    hubUrl,
    baseUrl,
    dbPath: process.env.DB_PATH ?? "data/slack.db",
    slackBotToken,
    slackAppToken,
    slackChannelId,
  };
}
