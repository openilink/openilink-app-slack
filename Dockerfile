# ========== 构建阶段 ==========
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制依赖描述文件，利用缓存
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# 复制源码并编译
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# ========== 运行阶段 ==========
FROM node:20-alpine AS runner

WORKDIR /app

# 安装生产依赖（better-sqlite3 需要原生编译）
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm rebuild better-sqlite3

# 复制编译产物
COPY --from=builder /app/dist dist/

# 创建非 root 用户和数据目录
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    mkdir -p /data && chown appuser:appgroup /data

# 设置默认环境变量
ENV DB_PATH=/data/slack.db
ENV PORT=8082

# 挂载数据卷
VOLUME ["/data"]

# 切换到非 root 用户
USER appuser

EXPOSE 8082

CMD ["node", "dist/index.js"]
