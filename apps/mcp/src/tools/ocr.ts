import {
  DEFAULT_OUTPUTS,
  OUTPUT_MODE_ALIASES,
  OUTPUT_MODE_DEFINITIONS
} from "@dsocr/shared";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import mime from "mime-types";
import { fileURLToPath } from "url";
import type { DsocrConfig } from "../config";

type ToolHandler = Parameters<McpServer["registerTool"]>[2];

const inputSchema = z
  .object({
    source: z.string().optional(),
    sources: z.array(z.string()).optional(),
    image: z.string().optional(),
    image_url: z.string().optional(),
    image_base64: z.string().optional(),
    outputs: z.union([z.array(z.string()), z.string()]).optional(),
    prompt: z.string().optional(),
    mode: z.string().optional(),
    language: z.string().optional(),
    raw: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
    workerUrl: z.string().url().optional()
  })
  .refine(
    (value) =>
      Boolean(
        value.source ||
          value.sources?.length ||
          value.image ||
          value.image_url ||
          value.image_base64
      ),
    {
      message: "必须至少提供一张图片，可以通过 source/sources/image/image_url/image_base64 字段。"
    }
  );

export function registerOcrTool(server: McpServer, config: DsocrConfig) {
  const handler: ToolHandler = async (rawInput) => {
    const parsed = inputSchema.parse(rawInput);
    const workerUrl = parsed.workerUrl ?? config.workerUrl;

    const sources = collectSources(parsed);
    const resolvedImages = await Promise.all(
      sources.map((item) => resolveSourceToImage(item))
    );

    const outputs = normalizeOutputs(parsed.outputs);

    const payload = {
      images: resolvedImages,
      outputs,
      prompt: parsed.prompt,
      mode: parsed.mode,
      language: parsed.language,
      rawResponse: parsed.raw,
      user_metadata: parsed.metadata
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    let response;
    try {
      response = await fetch(workerUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": config.userAgent
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const text = await safeReadText(response);
      throw new Error(
        `Worker 调用失败 (${response.status}): ${truncate(text, 400)}`
      );
    }

    const result = await response.json();

    const content = formatForModel(result);

    return {
      content: [{ type: "text", text: content }],
      structuredContent: result
    };
  };

  server.registerTool(
    "ocr.transcribe",
    {
      title: "DeepSeek OCR 识别",
      description:
        "调用部署在 Cloudflare Workers 的 DeepSeek-OCR 服务，输出多种文本格式。",
      inputSchema
    },
    handler
  );
}

function collectSources(input: z.infer<typeof inputSchema>): string[] {
  const sources = [
    input.source,
    input.image,
    input.image_url,
    input.image_base64
  ].filter((item): item is string => Boolean(item?.trim()));

  if (input.sources?.length) {
    sources.push(...input.sources);
  }

  return sources;
}

async function resolveSourceToImage(source: string): Promise<string> {
  const trimmed = source.trim();
  if (trimmed.startsWith("data:")) {
    return trimmed;
  }

  if (isHttpUrl(trimmed)) {
    return trimmed;
  }

  if (isLikelyBase64(trimmed)) {
    return `data:image/png;base64,${trimmed}`;
  }

  if (trimmed.startsWith("file://")) {
    const filePath = fileURLToPath(trimmed);
    return readFileAsDataUrl(filePath);
  }

  // 视为本地路径
  return readFileAsDataUrl(trimmed);
}

async function readFileAsDataUrl(filePath: string): Promise<string> {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
  const buffer = await fs.readFile(absolutePath);
  const mimeType = mime.lookup(absolutePath) || "application/octet-stream";
  const base64 = buffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isLikelyBase64(value: string): boolean {
  if (!value) return false;
  const sanitized = value.replace(/\s+/g, "");
  if (sanitized.length % 4 !== 0) return false;
  if (/[^a-zA-Z0-9+/=]/.test(sanitized)) return false;
  try {
    Buffer.from(sanitized, "base64");
    return true;
  } catch {
    return false;
  }
}

function normalizeOutputs(value?: string | string[]): string[] {
  if (!value) return DEFAULT_OUTPUTS;

  const rawValues = Array.isArray(value) ? value : [value];
  const normalized: string[] = [];

  for (const raw of rawValues) {
    const key = raw.trim();
    if (!key) continue;
    const canonical =
      OUTPUT_MODE_DEFINITIONS[key as keyof typeof OUTPUT_MODE_DEFINITIONS]
        ? key
        : OUTPUT_MODE_ALIASES[key.toLowerCase()];
    if (!canonical) {
      throw new Error(
        `不支持的输出格式 ${key}，有效值：${Object.keys(OUTPUT_MODE_DEFINITIONS).join(
          ", "
        )}`
      );
    }
    if (!normalized.includes(canonical)) {
      normalized.push(canonical);
    }
  }

  return normalized.length ? normalized : DEFAULT_OUTPUTS;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    return `读取响应失败: ${String(error)}`;
  }
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}…(${text.length - limit} chars more)`;
}

function formatForModel(result: any): string {
  if (result?.outputs && typeof result.outputs === "object") {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(result.outputs)) {
      const heading =
        OUTPUT_MODE_DEFINITIONS[key as keyof typeof OUTPUT_MODE_DEFINITIONS]
          ?.title ?? key;

      if (typeof value === "string") {
        parts.push(`### ${heading}\n${value}`);
        continue;
      }

      if (value !== undefined) {
        const serialized = JSON.stringify(value, null, 2);
        parts.push(`### ${heading}\n\`\`\`json\n${serialized}\n\`\`\``);
      }
    }
    if (parts.length) {
      return parts.join("\n\n");
    }
  }

  if (typeof result?.text === "string" && result.text.trim()) {
    return result.text;
  }

  return JSON.stringify(result, null, 2);
}

export const __TESTING__ = {
  collectSources,
  normalizeOutputs,
  formatForModel
};
