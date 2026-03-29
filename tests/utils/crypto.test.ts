import { describe, it, expect } from "vitest";
import { verifySignature, generatePKCE } from "../../src/utils/crypto.js";
import { createHmac, createHash } from "node:crypto";

describe("verifySignature", () => {
  const secret = "test-webhook-secret";
  const timestamp = "1700000000";
  const body = '{"type":"event","data":{}}';

  // 生成正确的签名
  function makeSignature(s: string, ts: string, b: string): string {
    return createHmac("sha256", s).update(`${ts}:${b}`).digest("hex");
  }

  it("签名正确时应返回 true", () => {
    const sig = makeSignature(secret, timestamp, body);
    expect(verifySignature(secret, timestamp, body, sig)).toBe(true);
  });

  it("签名错误时应返回 false", () => {
    expect(verifySignature(secret, timestamp, body, "invalid-signature")).toBe(false);
  });

  it("空 secret 时计算结果应一致", () => {
    const emptySecret = "";
    const sig = makeSignature(emptySecret, timestamp, body);
    expect(verifySignature(emptySecret, timestamp, body, sig)).toBe(true);
  });

  it("timestamp 不同时签名不匹配", () => {
    const sig = makeSignature(secret, timestamp, body);
    expect(verifySignature(secret, "9999999999", body, sig)).toBe(false);
  });

  it("body 不同时签名不匹配", () => {
    const sig = makeSignature(secret, timestamp, body);
    expect(verifySignature(secret, timestamp, '{"type":"other"}', sig)).toBe(false);
  });

  it("签名长度不同时应返回 false", () => {
    expect(verifySignature(secret, timestamp, body, "short")).toBe(false);
  });
});

describe("generatePKCE", () => {
  it("应生成 verifier 和 challenge", () => {
    const pkce = generatePKCE();
    expect(pkce).toHaveProperty("verifier");
    expect(pkce).toHaveProperty("challenge");
    expect(typeof pkce.verifier).toBe("string");
    expect(typeof pkce.challenge).toBe("string");
  });

  it("verifier 应为 Base64URL 编码", () => {
    const { verifier } = generatePKCE();
    // Base64URL 不包含 +, /, =
    expect(verifier).not.toMatch(/[+/=]/);
    expect(verifier.length).toBeGreaterThan(0);
  });

  it("challenge 应为 verifier 的 SHA-256 哈希的 Base64URL 编码", () => {
    const { verifier, challenge } = generatePKCE();
    const expectedChallenge = createHash("sha256").update(verifier).digest("base64url");
    expect(challenge).toBe(expectedChallenge);
  });

  it("每次生成应不同（随机性）", () => {
    const pkce1 = generatePKCE();
    const pkce2 = generatePKCE();
    expect(pkce1.verifier).not.toBe(pkce2.verifier);
    expect(pkce1.challenge).not.toBe(pkce2.challenge);
  });
});
