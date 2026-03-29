import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  // 保存原始环境变量
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // 设置必填环境变量的默认值
    process.env.HUB_URL = "https://hub.example.com";
    process.env.BASE_URL = "https://app.example.com";
    process.env.SLACK_BOT_TOKEN = "xoxb-test-token";
    process.env.SLACK_APP_TOKEN = "xapp-test-token";
    process.env.SLACK_CHANNEL_ID = "C12345";
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = { ...originalEnv };
  });

  it("应正确加载所有配置项", () => {
    process.env.PORT = "9090";
    process.env.DB_PATH = "/tmp/test.db";

    const config = loadConfig();

    expect(config.port).toBe("9090");
    expect(config.hubUrl).toBe("https://hub.example.com");
    expect(config.baseUrl).toBe("https://app.example.com");
    expect(config.dbPath).toBe("/tmp/test.db");
    expect(config.slackBotToken).toBe("xoxb-test-token");
    expect(config.slackAppToken).toBe("xapp-test-token");
    expect(config.slackChannelId).toBe("C12345");
  });

  it("应使用默认值（port=8082, dbPath=data/slack.db）", () => {
    delete process.env.PORT;
    delete process.env.DB_PATH;

    const config = loadConfig();

    expect(config.port).toBe("8082");
    expect(config.dbPath).toBe("data/slack.db");
  });

  it("缺少 HUB_URL 时应抛出错误", () => {
    delete process.env.HUB_URL;
    expect(() => loadConfig()).toThrow("缺少环境变量 HUB_URL");
  });

  it("缺少 BASE_URL 时应抛出错误", () => {
    delete process.env.BASE_URL;
    expect(() => loadConfig()).toThrow("缺少环境变量 BASE_URL");
  });

  it("缺少 SLACK_BOT_TOKEN 时应抛出错误", () => {
    delete process.env.SLACK_BOT_TOKEN;
    expect(() => loadConfig()).toThrow("缺少环境变量 SLACK_BOT_TOKEN");
  });

  it("缺少 SLACK_APP_TOKEN 时应抛出错误", () => {
    delete process.env.SLACK_APP_TOKEN;
    expect(() => loadConfig()).toThrow("缺少环境变量 SLACK_APP_TOKEN");
  });

  it("缺少 SLACK_CHANNEL_ID 时应抛出错误", () => {
    delete process.env.SLACK_CHANNEL_ID;
    expect(() => loadConfig()).toThrow("缺少环境变量 SLACK_CHANNEL_ID");
  });
});
