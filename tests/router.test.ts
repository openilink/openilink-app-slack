import { describe, it, expect, vi, beforeEach } from "vitest";
import { Router } from "../src/router.js";
import type { HubEvent, Installation, ToolHandler } from "../src/hub/types.js";
import { HubClient } from "../src/hub/client.js";

describe("Router", () => {
  let router: Router;
  const mockHandler = vi.fn<ToolHandler>();
  const handlers = new Map<string, ToolHandler>();

  const mockInstallation: Installation = {
    id: "inst-001",
    hubUrl: "https://hub.example.com",
    appId: "app-001",
    botId: "bot-001",
    appToken: "token-abc",
    webhookSecret: "secret-xyz",
  };

  const mockHubClient = new HubClient("https://hub.example.com", "token-abc");

  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    mockHandler.mockResolvedValue("执行成功");
    handlers.set("send_message", mockHandler);
    handlers.set("list_channels", vi.fn<ToolHandler>().mockResolvedValue("频道列表"));
    router = new Router(handlers);
  });

  describe("命令路由", () => {
    it("应根据 data.command 路由到正确的 handler", async () => {
      const event: HubEvent = {
        v: 1,
        type: "event",
        trace_id: "trace-001",
        installation_id: "inst-001",
        bot: { id: "bot-001" },
        event: {
          type: "command",
          id: "evt-001",
          timestamp: 1700000000,
          data: {
            command: "/send_message",
            user_id: "wx-001",
            text: "hello",
          },
        },
      };

      const result = await router.handleCommand(event, mockInstallation, mockHubClient);

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(result).toBe("执行成功");
    });

    it("应根据 data.name 路由到正确的 handler", async () => {
      const event: HubEvent = {
        v: 1,
        type: "event",
        trace_id: "trace-002",
        installation_id: "inst-001",
        bot: { id: "bot-001" },
        event: {
          type: "command",
          id: "evt-002",
          timestamp: 1700000000,
          data: {
            name: "list_channels",
            user_id: "wx-001",
          },
        },
      };

      const result = await router.handleCommand(event, mockInstallation, mockHubClient);

      expect(result).toBe("频道列表");
    });

    it("应去除命令的 / 前缀", async () => {
      const event: HubEvent = {
        v: 1,
        type: "event",
        trace_id: "trace-003",
        installation_id: "inst-001",
        bot: { id: "bot-001" },
        event: {
          type: "command",
          id: "evt-003",
          timestamp: 1700000000,
          data: {
            command: "/send_message",
            user_id: "wx-001",
          },
        },
      };

      await router.handleCommand(event, mockInstallation, mockHubClient);

      // 确认使用了去掉 / 后的 "send_message" 查找 handler
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("未知命令", () => {
    it("未知命令应返回 null", async () => {
      const event: HubEvent = {
        v: 1,
        type: "event",
        trace_id: "trace-004",
        installation_id: "inst-001",
        bot: { id: "bot-001" },
        event: {
          type: "command",
          id: "evt-004",
          timestamp: 1700000000,
          data: {
            command: "/unknown_command",
            user_id: "wx-001",
          },
        },
      };

      const result = await router.handleCommand(event, mockInstallation, mockHubClient);

      expect(result).toBeNull();
    });

    it("事件无 event 字段时应返回 null", async () => {
      const event: HubEvent = {
        v: 1,
        type: "event",
        trace_id: "trace-005",
        installation_id: "inst-001",
        bot: { id: "bot-001" },
      };

      const result = await router.handleCommand(event, mockInstallation, mockHubClient);

      expect(result).toBeNull();
    });
  });

  describe("handler 执行", () => {
    it("handler 应收到正确的 ToolContext", async () => {
      const event: HubEvent = {
        v: 1,
        type: "event",
        trace_id: "trace-006",
        installation_id: "inst-001",
        bot: { id: "bot-001" },
        event: {
          type: "command",
          id: "evt-006",
          timestamp: 1700000000,
          data: {
            command: "send_message",
            user_id: "wx-user-001",
            text: "hello world",
            channel: "C12345",
          },
        },
      };

      await router.handleCommand(event, mockInstallation, mockHubClient);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          installationId: "inst-001",
          botId: "bot-001",
          userId: "wx-user-001",
          traceId: "trace-006",
        }),
      );

      // 验证 args 包含事件数据
      const ctx = mockHandler.mock.calls[0][0];
      expect(ctx.args).toBeDefined();
    });

    it("handler 抛出异常时应传播错误", async () => {
      const errorHandler = vi.fn<ToolHandler>().mockRejectedValue(new Error("工具执行失败"));
      handlers.set("failing_tool", errorHandler);
      router = new Router(handlers);

      const event: HubEvent = {
        v: 1,
        type: "event",
        trace_id: "trace-007",
        installation_id: "inst-001",
        bot: { id: "bot-001" },
        event: {
          type: "command",
          id: "evt-007",
          timestamp: 1700000000,
          data: {
            command: "failing_tool",
            user_id: "wx-001",
          },
        },
      };

      await expect(
        router.handleCommand(event, mockInstallation, mockHubClient),
      ).rejects.toThrow("工具执行失败");
    });
  });
});
