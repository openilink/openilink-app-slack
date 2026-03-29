/**
 * 文件相关工具模块
 * 包含上传文件（提示）、列出文件、获取文件信息等功能
 */
import type { WebClient } from "@slack/web-api";
import type { ToolDefinition, ToolContext, ToolHandler } from "../hub/types.js";

/** 工具模块接口 */
export interface ToolModule {
  definitions: ToolDefinition[];
  createHandlers: (web: WebClient) => Map<string, ToolHandler>;
}

/** 工具定义列表 */
const definitions: ToolDefinition[] = [
  {
    name: "upload_file",
    description: "上传文件到 Slack 频道（注意: 当前 tool 无法接收二进制数据，仅返回操作提示）",
    command: "upload_file",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", description: "目标频道 ID" },
        filename: { type: "string", description: "文件名" },
      },
      required: ["channel", "filename"],
    },
  },
  {
    name: "list_files",
    description: "列出 Slack 工作区或指定频道中的文件",
    command: "list_files",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", description: "频道 ID，可选，不传则列出所有文件" },
        count: { type: "number", description: "获取数量" },
      },
    },
  },
  {
    name: "get_file_info",
    description: "获取指定文件的详细信息",
    command: "get_file_info",
    parameters: {
      type: "object",
      properties: {
        file_id: { type: "string", description: "文件 ID" },
      },
      required: ["file_id"],
    },
  },
];

/** 创建工具处理器 */
function createHandlers(web: WebClient): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // 上传文件（提示模式）
  handlers.set("upload_file", async (ctx: ToolContext) => {
    try {
      const { channel, filename } = ctx.args;
      return (
        `文件上传功能提示: 当前 tool 调用无法直接接收二进制文件数据。` +
        `\n要上传文件 "${filename}" 到频道 ${channel}，请通过 Slack 客户端或 API 直接调用 files.uploadV2 方法，` +
        `\n需要提供 channel_id、file（Buffer 或 ReadStream）和 filename 参数。`
      );
    } catch (err: any) {
      return `上传文件操作失败: ${err.message ?? String(err)}`;
    }
  });

  // 列出文件
  handlers.set("list_files", async (ctx: ToolContext) => {
    try {
      const { channel, count } = ctx.args;
      const result = await web.files.list({
        ...(channel ? { channel } : {}),
        ...(count ? { count } : {}),
      });
      const files = result.files ?? [];
      if (files.length === 0) {
        return channel ? `频道 ${channel} 暂无文件。` : "工作区暂无文件。";
      }
      const lines = files.map((f, i) => {
        const name = f.name ?? "未知文件名";
        const id = f.id ?? "未知";
        const size = f.size ? `${(f.size / 1024).toFixed(1)} KB` : "未知大小";
        const type = f.filetype ?? "未知类型";
        const created = f.created
          ? new Date(f.created * 1000).toLocaleString("zh-CN")
          : "未知时间";
        return `${i + 1}. ${name} (${id}) - ${type}，${size}，创建于 ${created}`;
      });
      const scope = channel ? `频道 ${channel}` : "工作区";
      return `${scope}共 ${files.length} 个文件:\n${lines.join("\n")}`;
    } catch (err: any) {
      return `列出文件失败: ${err.message ?? String(err)}`;
    }
  });

  // 获取文件信息
  handlers.set("get_file_info", async (ctx: ToolContext) => {
    try {
      const { file_id } = ctx.args;
      const result = await web.files.info({ file: file_id });
      const f = result.file;
      if (!f) {
        return `未找到文件 ${file_id} 的信息。`;
      }
      const lines = [
        `文件名: ${f.name ?? "未知"}`,
        `文件 ID: ${f.id ?? "未知"}`,
        `文件类型: ${f.filetype ?? "未知"}`,
        `MIME 类型: ${f.mimetype ?? "未知"}`,
        `文件大小: ${f.size ? `${(f.size / 1024).toFixed(1)} KB` : "未知"}`,
        `上传用户: ${f.user ?? "未知"}`,
        `创建时间: ${f.created ? new Date(f.created * 1000).toLocaleString("zh-CN") : "未知"}`,
        `下载链接: ${f.url_private ?? "无"}`,
        `公开链接: ${f.permalink ?? "无"}`,
      ];
      return lines.join("\n");
    } catch (err: any) {
      return `获取文件信息失败: ${err.message ?? String(err)}`;
    }
  });

  return handlers;
}

/** 文件工具模块 */
export const filesTools: ToolModule = { definitions, createHandlers };
