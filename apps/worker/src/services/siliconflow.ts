import {
  DEFAULT_OUTPUTS,
  MODE_PRESETS,
  OUTPUT_MODE_DEFINITIONS,
  type OutputMode
} from "@dsocr/shared";
import { HttpError } from "../errors";
import type {
  NormalizedOcrRequest,
  SiliconFlowChatCompletionRequest,
  SiliconFlowChatCompletionResponse
} from "../types";

const API_ENDPOINT = "https://api.siliconflow.cn/v1/chat/completions";
const MODEL_ID = "deepseek-ai/DeepSeek-OCR";

interface SiliconFlowErrorBody {
  code?: number;
  message?: string;
  [key: string]: unknown;
}

export interface SiliconFlowCallResult {
  requestPayload: SiliconFlowChatCompletionRequest;
  response: SiliconFlowChatCompletionResponse;
  parsedContent?: Record<string, unknown> | null;
  rawContent: string;
  parseError?: string;
}

export async function callSiliconFlow(
  env: { SILICONFLOW_API_KEY: string },
  normalized: NormalizedOcrRequest
): Promise<SiliconFlowCallResult> {
  const key = env.SILICONFLOW_API_KEY;
  if (!key) {
    throw new HttpError(500, "缺少 SILICONFLOW_API_KEY 环境变量。");
  }

  const payload = buildPayload(normalized);
  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let parsed: SiliconFlowChatCompletionResponse | SiliconFlowErrorBody;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new HttpError(
      502,
      "SiliconFlow 返回了非 JSON 数据，无法解析。",
      {
        httpStatus: response.status,
        raw: text,
        originalError: String(error)
      }
    );
  }

  if (!response.ok || (parsed as SiliconFlowErrorBody).code !== undefined) {
    const errBody = parsed as SiliconFlowErrorBody;
    throw new HttpError(
      response.status >= 400 ? response.status : 502,
      `SiliconFlow 接口返回错误${errBody.code !== undefined ? `（${errBody.code}）` : ""}：${
        errBody.message || "未知错误"
      }`,
      {
        httpStatus: response.status,
        body: errBody,
        raw: text,
        request: payload
      }
    );
  }

  const successBody = parsed as SiliconFlowChatCompletionResponse;
  const choice = successBody.choices?.[0];
  const rawContent = choice?.message?.content?.trim() ?? "";

  let parsedContent: Record<string, unknown> | null = null;
  let parseError: string | undefined;

  if (rawContent) {
    try {
      parsedContent = JSON.parse(rawContent);
    } catch (error) {
      parseError = `JSON 解析失败：${(error as Error).message}`;
    }
  }

  return {
    requestPayload: payload,
    response: successBody,
    parsedContent,
    rawContent,
    parseError
  };
}

function buildPayload(
  normalized: NormalizedOcrRequest
): SiliconFlowChatCompletionRequest {
  const outputs = normalized.outputs?.length
    ? normalized.outputs
    : DEFAULT_OUTPUTS;
  const systemPrompt = buildSystemPrompt(outputs, normalized.language);
  const userPrompt = buildUserPrompt(normalized, outputs);
  const responseFormat = buildResponseFormat(outputs);

  const base: SiliconFlowChatCompletionRequest = {
    model: MODEL_ID,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt,
        images: normalized.images.map((image) => image.data)
      }
    ],
    stream: false,
    temperature: normalized.temperature ?? 0,
    top_p: normalized.topP,
    max_tokens: normalized.maxTokens,
    response_format: responseFormat
  };

  // 移除未定义字段，避免 API 报错
  if (base.top_p === undefined) delete base.top_p;
  if (base.max_tokens === undefined) delete base.max_tokens;
  if (!base.response_format) delete base.response_format;

  return base;
}

function buildSystemPrompt(
  outputs: OutputMode[],
  language?: string
): string {
  const expectations = outputs
    .map((mode) => {
      const definition = OUTPUT_MODE_DEFINITIONS[mode];
      return `- ${mode}: ${definition.directive}`;
    })
    .join("\n");

  return [
    "你是 DeepSeek-OCR 的专家，负责根据输入图片输出高质量 OCR 结果。",
    "严格遵守以下要求：",
    "- 始终以 UTF-8 编码输出。",
    "- 所有结果必须包装在 JSON 对象中，键名即输出格式名称。",
    "- 不得添加额外的解释、前后缀或注释。",
    "- 所有换行请直接使用 \"\\n\" 保留，不要进行额外转义。",
    language
      ? `- 输出语言优先使用：${language}，若原文包含多语言，请分别保留。`
      : "- 尽量保留原文语言与大小写。",
    "- 若无法识别内容，使用空字符串返回该字段，同时添加 warnings 数组说明原因。",
    "",
    "各输出字段要求：",
    expectations
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUserPrompt(
  normalized: NormalizedOcrRequest,
  outputs: OutputMode[]
): string {
  const preset = normalized.mode
    ? MODE_PRESETS[normalized.mode] ?? MODE_PRESETS.auto
    : MODE_PRESETS.auto;

  let prompt = normalized.prompt?.trim() || preset.prompt;
  if (!prompt.includes("<image>")) {
    prompt = `<image>\n${prompt}`;
  }

  const outputList = outputs.join(", ");
  const reminder = `<|grounding|>请按照系统提示返回 JSON，对应键名包含：${outputList}。`;

  return `${prompt}\n${reminder}`;
}

function buildResponseFormat(outputs: OutputMode[]) {
  const properties: Record<string, unknown> = {
    plain_text: {
      type: "string",
      description: OUTPUT_MODE_DEFINITIONS.plain_text.description
    },
    markdown: {
      type: "string",
      description: OUTPUT_MODE_DEFINITIONS.markdown.description
    },
    layout_markdown: {
      type: "string",
      description: OUTPUT_MODE_DEFINITIONS.layout_markdown.description
    },
    html: {
      type: "string",
      description: OUTPUT_MODE_DEFINITIONS.html.description
    },
    text_blocks: {
      type: "array",
      description: OUTPUT_MODE_DEFINITIONS.text_blocks.description,
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          bbox: {
            type: "array",
            items: { type: "number" },
            minItems: 4,
            maxItems: 4,
            description: "相对坐标，顺序为 [x1, y1, x2, y2]，取值范围 0-1。"
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1
          }
        },
        required: ["text"],
        additionalProperties: false
      }
    },
    warnings: {
      type: "array",
      description: "可选的提示信息，用于标注识别过程中的异常或不确定性。",
      items: {
        type: "string"
      }
    },
    detected_language: {
      type: "string",
      description: "检测到的主要语言代码（例如 zh-CN、en-US）。"
    }
  };

  const required = outputs.filter((key) => key in OUTPUT_MODE_DEFINITIONS);

  if (!required.length) {
    required.push(...DEFAULT_OUTPUTS);
  }

  return {
    type: "json_schema",
    json_schema: {
      name: "dsocr_multi_output",
      schema: {
        type: "object",
        properties,
        required,
        additionalProperties: false
      }
    }
  };
}
