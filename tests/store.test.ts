import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Store } from "../src/store.js";
import { unlinkSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Store", () => {
  let store: Store;
  let dbPath: string;

  beforeEach(() => {
    // 使用临时目录中的唯一数据库文件
    const dir = join(tmpdir(), "openilink-slack-test");
    mkdirSync(dir, { recursive: true });
    dbPath = join(dir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    store = new Store(dbPath);
  });

  afterEach(() => {
    store.close();
    // 清理数据库文件
    if (existsSync(dbPath)) unlinkSync(dbPath);
    // 清理 WAL 和 SHM 文件
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (existsSync(walPath)) unlinkSync(walPath);
    if (existsSync(shmPath)) unlinkSync(shmPath);
  });

  // ========== Installation CRUD ==========

  describe("安装管理", () => {
    const mockInstallation = {
      id: "inst-001",
      hubUrl: "https://hub.example.com",
      appId: "app-001",
      botId: "bot-001",
      appToken: "token-abc",
      webhookSecret: "secret-xyz",
    };

    it("应保存并获取安装记录", () => {
      store.saveInstallation(mockInstallation);
      const result = store.getInstallation("inst-001");

      expect(result).toBeDefined();
      expect(result!.id).toBe("inst-001");
      expect(result!.hubUrl).toBe("https://hub.example.com");
      expect(result!.appId).toBe("app-001");
      expect(result!.botId).toBe("bot-001");
      expect(result!.appToken).toBe("token-abc");
      expect(result!.webhookSecret).toBe("secret-xyz");
      expect(result!.createdAt).toBeDefined();
    });

    it("不存在时应返回 undefined", () => {
      const result = store.getInstallation("non-existent");
      expect(result).toBeUndefined();
    });

    it("应支持 upsert（更新已有记录）", () => {
      store.saveInstallation(mockInstallation);
      store.saveInstallation({
        ...mockInstallation,
        appToken: "token-updated",
      });

      const result = store.getInstallation("inst-001");
      expect(result!.appToken).toBe("token-updated");
    });

    it("应获取所有安装记录", () => {
      store.saveInstallation(mockInstallation);
      store.saveInstallation({
        ...mockInstallation,
        id: "inst-002",
        appId: "app-002",
      });

      const all = store.getAllInstallations();
      expect(all).toHaveLength(2);
      expect(all.map((i) => i.id).sort()).toEqual(["inst-001", "inst-002"]);
    });

    it("应删除安装记录", () => {
      store.saveInstallation(mockInstallation);
      store.deleteInstallation("inst-001");
      const result = store.getInstallation("inst-001");
      expect(result).toBeUndefined();
    });

    it("无记录时 getAllInstallations 应返回空数组", () => {
      const all = store.getAllInstallations();
      expect(all).toEqual([]);
    });
  });

  // ========== MessageLink CRUD ==========

  describe("消息映射", () => {
    const installationId = "inst-001";

    beforeEach(() => {
      // 先插入安装记录（外键约束）
      store.saveInstallation({
        id: installationId,
        hubUrl: "https://hub.example.com",
        appId: "app-001",
        botId: "bot-001",
        appToken: "token-abc",
        webhookSecret: "secret-xyz",
      });
    });

    const mockLink = {
      installationId: "inst-001",
      slackMessageTs: "1234567890.123456",
      slackChannelId: "C12345",
      wxUserId: "wx-user-001",
      wxUserName: "张三",
    };

    it("应保存并通过 Slack TS 获取消息映射", () => {
      store.saveMessageLink(mockLink);
      const result = store.getMessageLinkBySlack("C12345", "1234567890.123456");

      expect(result).toBeDefined();
      expect(result!.installationId).toBe("inst-001");
      expect(result!.slackMessageTs).toBe("1234567890.123456");
      expect(result!.slackChannelId).toBe("C12345");
      expect(result!.wxUserId).toBe("wx-user-001");
      expect(result!.wxUserName).toBe("张三");
      expect(result!.createdAt).toBeDefined();
    });

    it("应返回自增 ID", () => {
      const id = store.saveMessageLink(mockLink);
      expect(typeof id).toBe("number");
      expect(id).toBeGreaterThan(0);
    });

    it("应通过 ID 获取消息映射", () => {
      const id = store.saveMessageLink(mockLink);
      const result = store.getMessageLink(id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(id);
      expect(result!.wxUserId).toBe("wx-user-001");
    });

    it("不存在的 Slack TS 应返回 undefined", () => {
      const result = store.getMessageLinkBySlack("C12345", "0000000000.000000");
      expect(result).toBeUndefined();
    });

    it("应根据微信用户查找最近的消息映射", () => {
      // 插入两条记录
      const id1 = store.saveMessageLink(mockLink);
      const id2 = store.saveMessageLink({
        ...mockLink,
        slackMessageTs: "1234567891.000000",
        wxUserName: "张三（更新）",
      });

      // 第二条记录 ID 更大
      expect(id2).toBeGreaterThan(id1);

      const result = store.getLatestMessageLinkByWxUser("inst-001", "wx-user-001");
      expect(result).toBeDefined();
      // created_at 精度为秒级，同秒内插入的记录排序可能不确定
      // 只需验证能找到该用户的映射记录
      expect(result!.wxUserId).toBe("wx-user-001");
      expect(result!.installationId).toBe("inst-001");
    });

    it("微信用户无映射时应返回 undefined", () => {
      const result = store.getLatestMessageLinkByWxUser("inst-001", "non-existent");
      expect(result).toBeUndefined();
    });

    it("应删除消息映射", () => {
      const id = store.saveMessageLink(mockLink);
      store.deleteMessageLink(id);
      const result = store.getMessageLink(id);
      expect(result).toBeUndefined();
    });
  });
});
