import { describe, expect, it } from "vitest";
import {
  DEFAULT_OUTPUTS,
  MODE_PRESETS,
  OUTPUT_MODE_DEFINITIONS,
  OUTPUT_MODE_ALIASES
} from "../src";

describe("shared OCR constants", () => {
  it("包含预期的默认输出", () => {
    expect(DEFAULT_OUTPUTS).toEqual([
      "plain_text",
      "markdown",
      "layout_markdown"
    ]);
  });

  it("支持别名映射", () => {
    expect(OUTPUT_MODE_ALIASES.layout).toBe("layout_markdown");
  });

  it("提供 auto 模式预设", () => {
    expect(MODE_PRESETS.auto.prompt).toContain("<image>");
  });

  it("包含 plain_text 定义", () => {
    expect(OUTPUT_MODE_DEFINITIONS.plain_text.title).toContain("纯文本");
  });
});
