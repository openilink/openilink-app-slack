import { createHmac, randomBytes, createHash, timingSafeEqual } from "node:crypto";

/**
 * 验证 Webhook 签名
 * 算法: HMAC-SHA256(secret, timestamp + ":" + body)
 * 使用 timingSafeEqual 防止时序攻击
 */
export function verifySignature(
  secret: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}:${body}`)
    .digest("hex");

  // 长度不同时直接返回 false（timingSafeEqual 要求长度一致）
  const sigBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(sigBuf, expectedBuf);
}

/** PKCE 密钥对 */
export interface PKCEPair {
  /** 原始随机字符串 */
  verifier: string;
  /** SHA-256 哈希后的 Base64URL 编码 */
  challenge: string;
}

/**
 * 生成 PKCE 密钥对
 * verifier: 64 字节随机数的 Base64URL 编码
 * challenge: verifier 的 SHA-256 哈希的 Base64URL 编码
 */
export function generatePKCE(): PKCEPair {
  const verifier = randomBytes(64)
    .toString("base64url");

  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");

  return { verifier, challenge };
}
