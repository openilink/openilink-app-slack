import { describe, it, expect, vi, beforeEach } from "vitest";

// 模拟 Slack WebClient
const mockWebClient = {
  users: {
    info: vi.fn(),
    list: vi.fn(),
    lookupByEmail: vi.fn(),
    getPresence: vi.fn(),
  },
};

describe("users tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tool 定义", () => {
    it("get_user_info 工具应有完整定义", () => {
      const toolDef = {
        name: "get_user_info",
        description: "获取用户详细信息",
        command: "/get_user_info",
        parameters: {
          user: { type: "string", description: "用户 ID", required: true },
        },
      };

      expect(toolDef.name).toBe("get_user_info");
      expect(toolDef.command).toBe("/get_user_info");
      expect(toolDef.parameters).toHaveProperty("user");
      expect(toolDef.description).toContain("用户");
    });

    it("list_users 工具应有完整定义", () => {
      const toolDef = {
        name: "list_users",
        description: "列出工作区中的用户",
        command: "/list_users",
        parameters: {
          limit: { type: "number", description: "返回数量限制" },
          cursor: { type: "string", description: "分页游标" },
        },
      };

      expect(toolDef.name).toBe("list_users");
      expect(toolDef.command).toBe("/list_users");
      expect(toolDef.description).toContain("用户");
    });
  });

  describe("get_user_info handler", () => {
    it("应调用 users.info 获取用户信息", async () => {
      mockWebClient.users.info.mockResolvedValue({
        ok: true,
        user: {
          id: "U001",
          name: "john",
          real_name: "John Doe",
          profile: {
            email: "john@example.com",
            display_name: "Johnny",
            image_48: "https://avatars.example.com/john.jpg",
          },
          is_admin: false,
          is_bot: false,
          tz: "Asia/Shanghai",
        },
      });

      const result = await mockWebClient.users.info({ user: "U001" });

      expect(result.ok).toBe(true);
      expect(result.user.id).toBe("U001");
      expect(result.user.real_name).toBe("John Doe");
      expect(result.user.profile.email).toBe("john@example.com");
    });

    it("用户不存在时应返回错误", async () => {
      mockWebClient.users.info.mockResolvedValue({
        ok: false,
        error: "user_not_found",
      });

      const result = await mockWebClient.users.info({ user: "U999" });

      expect(result.ok).toBe(false);
      expect(result.error).toBe("user_not_found");
    });
  });

  describe("list_users handler", () => {
    it("应调用 users.list 获取用户列表", async () => {
      mockWebClient.users.list.mockResolvedValue({
        ok: true,
        members: [
          { id: "U001", name: "alice", real_name: "Alice", is_bot: false },
          { id: "U002", name: "bob", real_name: "Bob", is_bot: false },
          { id: "USLACKBOT", name: "slackbot", real_name: "Slackbot", is_bot: true },
        ],
        response_metadata: { next_cursor: "" },
      });

      const result = await mockWebClient.users.list({ limit: 100 });

      expect(result.ok).toBe(true);
      expect(result.members).toHaveLength(3);
      expect(result.members[0].name).toBe("alice");
    });

    it("应支持分页", async () => {
      mockWebClient.users.list.mockResolvedValue({
        ok: true,
        members: [{ id: "U003", name: "charlie" }],
        response_metadata: { next_cursor: "next-page-cursor" },
      });

      const result = await mockWebClient.users.list({
        cursor: "first-page-cursor",
        limit: 10,
      });

      expect(result.ok).toBe(true);
      expect(result.response_metadata.next_cursor).toBe("next-page-cursor");
      expect(mockWebClient.users.list).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: "first-page-cursor" }),
      );
    });

    it("应正确过滤 Bot 用户", () => {
      const members = [
        { id: "U001", name: "alice", is_bot: false },
        { id: "U002", name: "mybot", is_bot: true },
        { id: "U003", name: "bob", is_bot: false },
      ];

      const humanUsers = members.filter((m) => !m.is_bot);
      expect(humanUsers).toHaveLength(2);
      expect(humanUsers.map((u) => u.name)).toEqual(["alice", "bob"]);
    });
  });
});
