import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleWebhook } from "../../src/hub/webhook.js";
import { createHmac } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { EventEmitter } from "node:events";

/** 创建模拟的 IncomingMessage */
function createMockRequest(body: string, headers: Record<string, string> = {}): IncomingMessage {
  const emitter = new EventEmitter() as IncomingMessage;
  emitter.headers = headers;
  // 模拟数据流：微任务中发送数据
  process.nextTick(() => {
    emitter.emit("data", Buffer.from(body));
    emitter.emit("end");
  });
  return emitter;
}

/** 创建模拟的 ServerResponse */
function createMockResponse(): ServerResponse & {
  _status: number;
  _body: string;
  _headers: Record<string, string>;
} {
  const res = {
    _status: 0,
    _body: "",
    _headers: {} as Record<string, string>,
    headersSent: false,
    writeHead(status: number, headers?: Record<string, string>) {
      res._status = status;
      if (headers) Object.assign(res._headers, headers);
      return res;
    },
    end(body?: string) {
      if (body) res._body = body;
      res.headersSent = true;
    },
  } as unknown as ServerResponse & {
    _status: number;
    _body: string;
    _headers: Record<string, string>;
  };
  return res;
}

/** 生成 HMAC-SHA256 签名 */
function sign(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}:${body}`).digest("hex");
}

describe("handleWebhook", () => {
  const mockStore = {
    getInstallation: vi.fn(),
    saveInstallation: vi.fn(),
    getAllInstallations: vi.fn(),
    deleteInstallation: vi.fn(),
    saveMessageLink: vi.fn(),
    getMessageLinkBySlack: vi.fn(),
    getLatestMessageLinkByWxUser: vi.fn(),
    getMessageLink: vi.fn(),
    deleteMessageLink: vi.fn(),
    close: vi.fn(),
  };

  const mockOnEvent = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("url_verification 事件应返回 challenge", async () => {
    const body = JSON.stringify({
      v: 1,
      type: "url_verification",
      challenge: "test-challenge-abc",
    });
    const req = createMockRequest(body);
    const res = createMockResponse();

    await handleWebhook(req, res, mockStore as any, mockOnEvent);

    expect(res._status).toBe(200);
    expect(JSON.parse(res._body)).toEqual({ challenge: "test-challenge-abc" });
  });

  it("签名验证成功时应调用 onEvent", async () => {
    const installation = {
      id: "inst-001",
      hubUrl: "https://hub.example.com",
      appId: "app-001",
      botId: "bot-001",
      appToken: "token-abc",
      webhookSecret: "secret-xyz",
    };
    mockStore.getInstallation.mockReturnValue(installation);

    const body = JSON.stringify({
      v: 1,
      type: "event",
      trace_id: "trace-001",
      installation_id: "inst-001",
      bot: { id: "bot-001" },
      event: { type: "message", id: "evt-001", timestamp: 1700000000, data: { text: "hello" } },
    });

    const timestamp = "1700000000";
    const signature = sign("secret-xyz", timestamp, body);

    const req = createMockRequest(body, {
      "x-timestamp": timestamp,
      "x-signature": signature,
    });
    const res = createMockResponse();

    await handleWebhook(req, res, mockStore as any, mockOnEvent);

    expect(res._status).toBe(200);
    // 等待异步 onEvent 回调
    await new Promise((r) => setTimeout(r, 50));
    expect(mockOnEvent).toHaveBeenCalledTimes(1);
    expect(mockOnEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "event" }), "inst-001");
  });

  it("签名验证失败时应返回 401", async () => {
    const installation = {
      id: "inst-001",
      webhookSecret: "secret-xyz",
    };
    mockStore.getInstallation.mockReturnValue(installation);

    const body = JSON.stringify({
      v: 1,
      type: "event",
      installation_id: "inst-001",
      bot: { id: "bot-001" },
    });

    const req = createMockRequest(body, {
      "x-timestamp": "1700000000",
      "x-signature": "invalid-signature",
    });
    const res = createMockResponse();

    await handleWebhook(req, res, mockStore as any, mockOnEvent);

    expect(res._status).toBe(401);
    expect(JSON.parse(res._body)).toHaveProperty("error", "签名验证失败");
  });

  it("缺少签名头时应返回 401", async () => {
    mockStore.getInstallation.mockReturnValue({
      id: "inst-001",
      webhookSecret: "secret",
    });

    const body = JSON.stringify({
      v: 1,
      type: "event",
      installation_id: "inst-001",
      bot: { id: "bot-001" },
    });

    const req = createMockRequest(body, {});
    const res = createMockResponse();

    await handleWebhook(req, res, mockStore as any, mockOnEvent);

    expect(res._status).toBe(401);
    expect(JSON.parse(res._body)).toHaveProperty("error", "缺少签名头");
  });

  it("安装记录不存在时应返回 404", async () => {
    mockStore.getInstallation.mockReturnValue(undefined);

    const body = JSON.stringify({
      v: 1,
      type: "event",
      installation_id: "inst-999",
      bot: { id: "bot-001" },
    });

    const req = createMockRequest(body);
    const res = createMockResponse();

    await handleWebhook(req, res, mockStore as any, mockOnEvent);

    expect(res._status).toBe(404);
    expect(JSON.parse(res._body)).toHaveProperty("error", "安装记录不存在");
  });

  it("缺少 installation_id 时应返回 400", async () => {
    const body = JSON.stringify({
      v: 1,
      type: "event",
      bot: { id: "bot-001" },
    });

    const req = createMockRequest(body);
    const res = createMockResponse();

    await handleWebhook(req, res, mockStore as any, mockOnEvent);

    expect(res._status).toBe(400);
    expect(JSON.parse(res._body)).toHaveProperty("error", "缺少 installation_id");
  });
});
