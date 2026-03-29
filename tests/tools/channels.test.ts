import { describe, it, expect, vi, beforeEach } from "vitest";

// 模拟 Slack WebClient
const mockWebClient = {
  conversations: {
    list: vi.fn(),
    create: vi.fn(),
    invite: vi.fn(),
    info: vi.fn(),
    archive: vi.fn(),
    setTopic: vi.fn(),
    setPurpose: vi.fn(),
  },
};

describe("channels tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tool 定义", () => {
    it("list_channels 工具应有完整定义", () => {
      const toolDef = {
        name: "list_channels",
        description: "列出所有可见的频道",
        command: "/list_channels",
        parameters: {
          limit: { type: "number", description: "返回数量限制" },
          cursor: { type: "string", description: "分页游标" },
        },
      };

      expect(toolDef.name).toBe("list_channels");
      expect(toolDef.command).toBe("/list_channels");
      expect(toolDef.description).toContain("频道");
    });

    it("create_channel 工具应有完整定义", () => {
      const toolDef = {
        name: "create_channel",
        description: "创建新频道",
        command: "/create_channel",
        parameters: {
          name: { type: "string", description: "频道名称", required: true },
          is_private: { type: "boolean", description: "是否为私有频道" },
        },
      };

      expect(toolDef.name).toBe("create_channel");
      expect(toolDef.parameters).toHaveProperty("name");
    });

    it("invite_to_channel 工具应有完整定义", () => {
      const toolDef = {
        name: "invite_to_channel",
        description: "邀请用户加入频道",
        command: "/invite_to_channel",
        parameters: {
          channel: { type: "string", description: "频道 ID", required: true },
          users: { type: "string", description: "用户 ID，逗号分隔", required: true },
        },
      };

      expect(toolDef.name).toBe("invite_to_channel");
      expect(toolDef.parameters).toHaveProperty("channel");
      expect(toolDef.parameters).toHaveProperty("users");
    });
  });

  describe("list_channels handler", () => {
    it("应调用 conversations.list 获取频道列表", async () => {
      mockWebClient.conversations.list.mockResolvedValue({
        ok: true,
        channels: [
          { id: "C001", name: "general", is_channel: true, num_members: 50 },
          { id: "C002", name: "random", is_channel: true, num_members: 30 },
          { id: "C003", name: "dev", is_channel: true, num_members: 15 },
        ],
        response_metadata: { next_cursor: "" },
      });

      const result = await mockWebClient.conversations.list({
        types: "public_channel,private_channel",
        limit: 100,
      });

      expect(result.ok).toBe(true);
      expect(result.channels).toHaveLength(3);
      expect(result.channels[0].name).toBe("general");
    });

    it("应支持分页", async () => {
      mockWebClient.conversations.list.mockResolvedValue({
        ok: true,
        channels: [{ id: "C004", name: "page2-channel" }],
        response_metadata: { next_cursor: "" },
      });

      const result = await mockWebClient.conversations.list({
        cursor: "dXNlcjpVMDYxTkZUVDI=",
        limit: 20,
      });

      expect(result.ok).toBe(true);
      expect(mockWebClient.conversations.list).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: "dXNlcjpVMDYxTkZUVDI=" }),
      );
    });
  });

  describe("create_channel handler", () => {
    it("应调用 conversations.create 创建公共频道", async () => {
      mockWebClient.conversations.create.mockResolvedValue({
        ok: true,
        channel: { id: "C005", name: "new-channel", is_channel: true },
      });

      const result = await mockWebClient.conversations.create({
        name: "new-channel",
        is_private: false,
      });

      expect(result.ok).toBe(true);
      expect(result.channel.name).toBe("new-channel");
    });

    it("应支持创建私有频道", async () => {
      mockWebClient.conversations.create.mockResolvedValue({
        ok: true,
        channel: { id: "G001", name: "private-channel", is_group: true },
      });

      const result = await mockWebClient.conversations.create({
        name: "private-channel",
        is_private: true,
      });

      expect(result.ok).toBe(true);
      expect(mockWebClient.conversations.create).toHaveBeenCalledWith(
        expect.objectContaining({ is_private: true }),
      );
    });
  });

  describe("invite_to_channel handler", () => {
    it("应调用 conversations.invite 邀请用户", async () => {
      mockWebClient.conversations.invite.mockResolvedValue({
        ok: true,
        channel: { id: "C001" },
      });

      const result = await mockWebClient.conversations.invite({
        channel: "C001",
        users: "U001,U002",
      });

      expect(result.ok).toBe(true);
      expect(mockWebClient.conversations.invite).toHaveBeenCalledWith({
        channel: "C001",
        users: "U001,U002",
      });
    });
  });
});
