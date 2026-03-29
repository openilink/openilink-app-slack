import { describe, it, expect } from "vitest";
import { getManifest } from "../../src/hub/manifest.js";
import type { Config } from "../../src/config.js";
import type { ToolDefinition } from "../../src/hub/types.js";

describe("getManifest", () => {
  const mockConfig: Config = {
    port: "8082",
    hubUrl: "https://hub.example.com",
    baseUrl: "https://app.example.com",
    dbPath: "data/slack.db",
    slackBotToken: "xoxb-test",
    slackAppToken: "xapp-test",
    slackChannelId: "C12345",
  };

  it("应返回正确的基本结构", () => {
    const manifest = getManifest(mockConfig);

    expect(manifest.slug).toBe("slack-bridge");
    expect(manifest.name).toBe("Slack Bridge");
    expect(manifest.description).toContain("微信");
    expect(manifest.description).toContain("Slack");
    expect(manifest.icon).toBeDefined();
    expect(Array.isArray(manifest.events)).toBe(true);
    expect(Array.isArray(manifest.scopes)).toBe(true);
  });

  it("应包含 message 和 command 事件订阅", () => {
    const manifest = getManifest(mockConfig);
    expect(manifest.events).toContain("message");
    expect(manifest.events).toContain("command");
  });

  it("应包含必要的权限范围", () => {
    const manifest = getManifest(mockConfig);
    expect(manifest.scopes).toContain("message:read");
    expect(manifest.scopes).toContain("message:write");
    expect(manifest.scopes).toContain("tools:write");
  });

  it("应正确生成 OAuth 和 Webhook URL", () => {
    const manifest = getManifest(mockConfig);

    expect(manifest.oauth_setup_url).toBe("https://app.example.com/oauth/setup");
    expect(manifest.oauth_redirect_url).toBe("https://app.example.com/oauth/redirect");
    expect(manifest.webhook_url).toBe("https://app.example.com/hub/webhook");
  });

  it("URL 应基于 config.baseUrl 生成", () => {
    const customConfig = { ...mockConfig, baseUrl: "https://custom.example.com" };
    const manifest = getManifest(customConfig);

    expect(manifest.webhook_url).toBe("https://custom.example.com/hub/webhook");
    expect(manifest.oauth_setup_url).toBe("https://custom.example.com/oauth/setup");
    expect(manifest.oauth_redirect_url).toBe("https://custom.example.com/oauth/redirect");
  });

  it("不传 toolDefinitions 时 tools 应为 undefined", () => {
    const manifest = getManifest(mockConfig);
    expect(manifest.tools).toBeUndefined();
  });

  it("应正确注入 tool 定义", () => {
    const tools: ToolDefinition[] = [
      {
        name: "send_message",
        description: "发送消息",
        command: "/send_message",
        parameters: { text: { type: "string" } },
      },
      {
        name: "list_channels",
        description: "列出频道",
        command: "/list_channels",
      },
    ];

    const manifest = getManifest(mockConfig, tools);

    expect(manifest.tools).toBeDefined();
    expect(manifest.tools).toHaveLength(2);
    expect(manifest.tools![0].name).toBe("send_message");
    expect(manifest.tools![1].name).toBe("list_channels");
  });
});
