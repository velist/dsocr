import { describe, expect, it } from "vitest";
import { __TESTING__ } from "../src/tools/ocr";

describe("normalizeOutputs", () => {
  it("支持别名映射", () => {
    const result = __TESTING__.normalizeOutputs(["plain", "layout"]);
    expect(result).toEqual(["plain_text", "layout_markdown"]);
  });

  it("默认返回预设格式", () => {
    const result = __TESTING__.normalizeOutputs();
    expect(result).toEqual(["plain_text", "markdown", "layout_markdown"]);
  });
});

describe("collectSources", () => {
  it("汇总所有单独字段与数组", () => {
  const sources = __TESTING__.collectSources({
    source: "a.png",
    sources: ["b.png"],
    image: "c.png",
    image_url: "https://example.com/d.png",
    image_base64: "data:image/png;base64,xxx"
  } as any);

  expect(sources).toHaveLength(5);
  expect(sources[0]).toBe("a.png");
  expect(sources.some((item) => item.includes("base64"))).toBe(true);
  });
});

describe("formatForModel", () => {
  it("格式化多种输出", () => {
    const text = __TESTING__.formatForModel({
      outputs: {
        plain_text: "hello",
        markdown: "# Title",
        text_blocks: [{ text: "block", bbox: [0, 0, 1, 1] }]
      }
    });

    expect(text).toContain("### 纯文本");
    expect(text).toContain("# Title");
    expect(text).toContain("```json");
  });
});
