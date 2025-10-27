export type OutputMode =
  | "plain_text"
  | "markdown"
  | "layout_markdown"
  | "html"
  | "text_blocks";

export const DEFAULT_OUTPUTS: OutputMode[] = [
  "plain_text",
  "markdown",
  "layout_markdown"
];

export const OUTPUT_MODE_DEFINITIONS: Record<
  OutputMode,
  {
    title: string;
    description: string;
    directive: string;
  }
> = {
  plain_text: {
    title: "纯文本",
    description:
      "不保留任何额外格式，仅输出段落级文本，适合二次处理或全文检索。",
    directive:
      "以纯文本形式输出识别结果，不要包含 Markdown、HTML、JSON 或其他标记，仅保留段落换行。"
  },
  markdown: {
    title: "结构化 Markdown",
    description:
      "还原标题、列表、表格等文档结构，适合在编辑器中直接浏览。",
    directive:
      "使用 Markdown 语法还原原始文档的层级结构、表格、列表与强调样式，力求贴近原文布局。"
  },
  layout_markdown: {
    title: "布局感知 Markdown",
    description:
      "在 Markdown 中突出版式与区域划分，便于理解复杂排版或二维布局。",
    directive:
      "在 Markdown 中额外标注版块、页眉/页脚、页码、分栏等重要布局信息，可借助引用、代码块或表格凸显相对位置。"
  },
  html: {
    title: "结构化 HTML",
    description:
      "返回语义化 HTML，便于直接嵌入网页或进一步 DOM 处理。",
    directive:
      "使用语义化 HTML 标签（如 <article>、<section>、<header>、<table> 等）表达层级结构，并确保标签闭合。"
  },
  text_blocks: {
    title: "定位分块文本",
    description:
      "按版块或坐标切分的文本片段，便于下游做局部定位或对齐。",
    directive:
      "以 JSON 数组形式给出各文本块，包含字段：text、bbox（相对坐标 [x1,y1,x2,y2]）、confidence（0-1）。"
  }
};

export const OUTPUT_MODE_ALIASES: Record<string, OutputMode> = {
  text: "plain_text",
  plain: "plain_text",
  raw: "plain_text",
  markdown_layout: "layout_markdown",
  layout: "layout_markdown",
  blocks: "text_blocks",
  block: "text_blocks",
  html5: "html"
};

export const MODE_PRESETS: Record<
  string,
  { description: string; prompt: string }
> = {
    auto: {
    description: "根据图片自动选择最合适的识别方式。",
    prompt:
      "<image>\n<|grounding|>请以最高质量识别图像内容，并根据任务自动选择合适的表达方式。"
  },
  plain: {
    description: "仅提取纯文本，无需任何额外格式。",
    prompt: "<image>\nFree OCR."
  },
  markdown: {
    description: "转成 Markdown 文档，保留标题、列表、表格等结构。",
    prompt: "<image>\n<|grounding|>Convert the document to markdown."
  },
  layout: {
    description: "强调版式与区域划分，适合表单或多栏文档。",
    prompt:
      "<image>\n<|grounding|>Convert the document to markdown with explicit layout annotations."
  },
  figure: {
    description: "提取图表、流程图或示意图的关键信息。",
    prompt: "<image>\n<|grounding|>Parse the figure."
  },
  describe: {
    description: "对图片进行详细描述，适合通用图像理解。",
    prompt: "<image>\nDescribe this image in detail."
  }
};
