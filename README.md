# @openilink/app-slack

OpeniLink Hub App —— 微信 ↔ Slack 双向桥接 + 23 个 AI Tools。

将微信消息自动桥接到 Slack 频道，同时提供 23 个 Slack 操作工具，支持通过自然语言在微信中操控 Slack 的频道、消息、用户、文件、提醒等功能。

## 功能特性

- **IM 双向桥接**：微信消息自动转发到 Slack 频道（Block Kit 格式），Slack 回复自动发送回微信
- **自然语言操作 Slack**：通过 OpeniLink Hub 的 AI 能力，用自然语言指令操作 Slack 全平台功能
- **23 个 AI Tools**：覆盖消息、频道、用户、文件、提醒、书签六大模块
- **Socket Mode**：Slack 端使用 Socket Mode 连接，无需为 Slack 配置公网入口
- **安全验证**：Webhook 签名验证 + OAuth PKCE 安装流程
- **SQLite 持久化**：消息映射和安装记录存储在本地 SQLite 数据库

## 架构

```mermaid
graph LR
    WX[微信用户] -->|消息| Hub[OpeniLink Hub]
    Hub -->|Webhook| App[Slack Bridge App]
    App -->|Socket Mode| Slack[Slack 工作区]
    Slack -->|事件| App
    App -->|Bot API| Hub
    Hub -->|回复| WX

    subgraph "Slack Bridge App"
        WxToSlack[WxToSlack Bridge]
        SlackToWx[SlackToWx Bridge]
        Router[命令路由]
        Tools[23 个 AI Tools]
    end
```

### 消息流转

```mermaid
sequenceDiagram
    participant WX as 微信用户
    participant Hub as OpeniLink Hub
    participant App as Slack Bridge
    participant Slack as Slack

    Note over WX, Slack: 自动桥接流程
    WX->>Hub: 发送消息
    Hub->>App: Webhook 推送
    App->>Slack: Block Kit 消息
    Slack->>App: 线程回复
    App->>Hub: Bot API 回复
    Hub->>WX: 微信消息

    Note over WX, Slack: 自然语言工具调用
    WX->>Hub: "帮我创建一个 dev 频道"
    Hub->>App: command 事件
    App->>Slack: conversations.create
    Slack-->>App: 创建结果
    App-->>Hub: 工具返回值
    Hub->>WX: "已创建 #dev 频道"
```

## 快速开始

### 1. 创建 Slack App

1. 前往 [Slack API](https://api.slack.com/apps) 创建新的 App
2. 选择 **From scratch**，填写 App Name 和 Workspace
3. 进入 **OAuth & Permissions**，添加以下 Bot Token Scopes：
   - `channels:history` - 读取频道消息
   - `channels:manage` - 管理频道
   - `channels:read` - 读取频道列表
   - `chat:write` - 发送消息
   - `files:read` - 读取文件
   - `files:write` - 上传文件
   - `groups:history` - 读取私有频道消息
   - `groups:read` - 读取私有频道列表
   - `groups:write` - 管理私有频道
   - `im:history` - 读取私信
   - `pins:read` - 读取置顶
   - `pins:write` - 管理置顶
   - `reactions:read` - 读取表情反应
   - `reactions:write` - 添加表情反应
   - `reminders:read` - 读取提醒
   - `reminders:write` - 管理提醒
   - `bookmarks:read` - 读取书签
   - `bookmarks:write` - 管理书签
   - `users:read` - 读取用户信息
   - `users:read.email` - 读取用户邮箱

### 2. 启用 Socket Mode

1. 进入 **Socket Mode** 页面，启用 Socket Mode
2. 生成一个 App-Level Token（Scope 选择 `connections:write`），记录 `xapp-` 开头的 Token

### 3. 安装 App 到 Workspace

1. 进入 **Install App** 页面，点击 **Install to Workspace**
2. 授权安装
3. 记录 **Bot User OAuth Token**（`xoxb-` 开头）

### 4. 订阅事件

1. 进入 **Event Subscriptions**，启用 Events
2. 订阅以下 Bot Events：
   - `message.channels` - 公共频道消息
   - `message.groups` - 私有频道消息

### 5. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
HUB_URL=https://your-hub-url.com
BASE_URL=https://your-app-public-url.com
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_CHANNEL_ID=C0123456789
```

### 6. 启动服务

**Docker Compose（推荐）：**

```bash
docker compose up -d
```

**本地开发：**

```bash
npm install
npm run dev
```

**生产构建：**

```bash
npm run build
npm start
```

## 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `HUB_URL` | 是 | - | OpeniLink Hub 服务地址 |
| `BASE_URL` | 是 | - | 当前 App 的公网访问地址 |
| `SLACK_BOT_TOKEN` | 是 | - | Slack Bot User OAuth Token（`xoxb-` 开头） |
| `SLACK_APP_TOKEN` | 是 | - | Slack App-Level Token（`xapp-` 开头，Socket Mode 用） |
| `SLACK_CHANNEL_ID` | 是 | - | 默认转发微信消息到的 Slack 频道 ID |
| `PORT` | 否 | `8082` | HTTP 服务端口 |
| `DB_PATH` | 否 | `data/slack.db` | SQLite 数据库文件路径 |

## 支持的 23 个 Tools

### 消息操作（Messaging）

| 工具名 | 说明 |
|--------|------|
| `send_message` | 发送消息到频道 |
| `reply_message` | 回复消息（线程回复） |
| `update_message` | 更新已发送的消息 |
| `delete_message` | 删除消息 |
| `get_channel_history` | 获取频道消息历史 |
| `get_thread_replies` | 获取线程回复列表 |
| `add_reaction` | 添加表情反应 |
| `remove_reaction` | 移除表情反应 |
| `pin_message` | 置顶消息 |
| `unpin_message` | 取消置顶 |

### 频道操作（Channels）

| 工具名 | 说明 |
|--------|------|
| `list_channels` | 列出所有频道 |
| `create_channel` | 创建新频道 |
| `invite_to_channel` | 邀请用户加入频道 |
| `archive_channel` | 归档频道 |
| `set_channel_topic` | 设置频道话题 |

### 文件操作（Files）

| 工具名 | 说明 |
|--------|------|
| `upload_file` | 上传文件到频道 |
| `list_files` | 列出文件列表 |

### 用户操作（Users）

| 工具名 | 说明 |
|--------|------|
| `get_user_info` | 获取用户详细信息 |
| `list_users` | 列出工作区用户 |

### 提醒操作（Reminders）

| 工具名 | 说明 |
|--------|------|
| `add_reminder` | 创建提醒 |
| `list_reminders` | 列出提醒列表 |

### 书签操作（Bookmarks）

| 工具名 | 说明 |
|--------|------|
| `add_bookmark` | 添加频道书签 |
| `list_bookmarks` | 列出频道书签 |

## 消息流转说明

### 自动桥接

微信用户发送的消息会通过 Hub Webhook 推送到本 App，然后以 Block Kit 格式转发到指定 Slack 频道。Slack 用户在对应消息线程中回复时，App 会通过 Hub Bot API 将回复发送回微信用户。

### 自然语言工具调用

当 Hub 的 AI 识别到用户意图匹配某个 Tool 时，会发送 `command` 事件到 App。App 的 Router 根据命令名路由到对应的 Tool Handler，执行 Slack API 操作后返回结果。Hub AI 将结果格式化后回复给微信用户。

### 示例对话

- 用户："帮我看一下 general 频道最近的消息" → 调用 `get_channel_history`
- 用户："创建一个叫 project-alpha 的私有频道" → 调用 `create_channel`
- 用户："提醒我明天下午 3 点开会" → 调用 `add_reminder`
- 用户："把这个链接收藏到 dev 频道" → 调用 `add_bookmark`

## 开发指南

### 安装依赖

```bash
npm install
```

### 运行测试

```bash
npm test
```

### 监听模式测试

```bash
npm run test:watch
```

### 类型检查

```bash
npx tsc --noEmit
```

### 项目结构

```
src/
├── index.ts              # 主入口
├── config.ts             # 配置加载
├── store.ts              # SQLite 存储层
├── router.ts             # 命令路由器
├── hub/
│   ├── types.ts          # Hub 类型定义
│   ├── client.ts         # Hub Bot API 客户端
│   ├── manifest.ts       # App Manifest 生成
│   ├── oauth.ts          # OAuth PKCE 安装流程
│   └── webhook.ts        # Webhook 事件处理
├── slack/
│   ├── client.ts         # Slack 客户端封装
│   └── event.ts          # Slack Bolt App & 事件监听
├── bridge/
│   ├── wx-to-slack.ts    # 微信 → Slack 消息桥接
│   └── slack-to-wx.ts    # Slack → 微信 消息桥接
├── tools/
│   ├── index.ts          # Tool 注册入口
│   ├── messaging.ts      # 消息操作 Tools
│   ├── channels.ts       # 频道操作 Tools
│   ├── files.ts          # 文件操作 Tools
│   ├── users.ts          # 用户操作 Tools
│   ├── reminders.ts      # 提醒操作 Tools
│   └── bookmarks.ts      # 书签操作 Tools
└── utils/
    └── crypto.ts         # 签名验证 & PKCE 生成
```

## License

MIT
