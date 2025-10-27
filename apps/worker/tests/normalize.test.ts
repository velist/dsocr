import { describe, expect, it } from "vitest";
import { normalizeOcrRequest, splitMaybeCsv } from "../src/utils/normalize";

const SAMPLE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M8ABAwC/0FzybgAAAAASUVORK5CYII=";

describe("normalizeOcrRequest", () => {
  it("应支持 JSON 请求并解析 image_url", async () => {
    const request = new Request("https://example.com/ocr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        image_url: "https://example.com/test.png",
        outputs: ["plain_text", "markdown"]
      })
    });

    const normalized = await normalizeOcrRequest(request);
    expect(normalized.images).toHaveLength(1);
    expect(normalized.images[0].data).toBe("https://example.com/test.png");
    expect(normalized.outputs).toEqual(["plain_text", "markdown"]);
  });

  it("应支持 Base64 图片并自动包装为 dataURL", async () => {
    const request = new Request("https://example.com/ocr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        image_base64: {
          base64: SAMPLE_BASE64,
          mimeType: "image/png"
        },
        outputs: "plain_text"
      })
    });

    const normalized = await normalizeOcrRequest(request);
    expect(normalized.images).toHaveLength(1);
    expect(normalized.images[0].data.startsWith("data:image/png;base64,")).toBe(
      true
    );
    expect(normalized.outputs).toEqual(["plain_text"]);
  });

  it("应拒绝未知输出格式", async () => {
    const request = new Request("https://example.com/ocr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        image_url: "https://example.com/test.png",
        outputs: ["unknown-format"]
      })
    });

    await expect(normalizeOcrRequest(request)).rejects.toMatchObject({
      status: 400
    });
  });
});

describe("splitMaybeCsv", () => {
  it("应正确分割多个 URL", () => {
    const value = "https://a.com/a.png, https://b.com/b.png";
    expect(splitMaybeCsv(value)).toEqual([
      "https://a.com/a.png",
      "https://b.com/b.png"
    ]);
  });

  it("遇到空串时返回空数组", () => {
    expect(splitMaybeCsv(" , ")).toEqual([]);
  });
});
