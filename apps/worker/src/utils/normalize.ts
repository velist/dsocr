import { HttpError } from "../errors";
import {
  DEFAULT_OUTPUTS,
  MODE_PRESETS,
  OUTPUT_MODE_ALIASES,
  OUTPUT_MODE_DEFINITIONS,
  type OutputMode
} from "@dsocr/shared";
import type { NormalizedImage, NormalizedOcrRequest } from "../types";
import { fileToImagePayload, normalizeImageValue } from "./image";

export async function normalizeOcrRequest(
  request: Request
): Promise<NormalizedOcrRequest> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return parseJsonBody(request);
  }

  if (contentType.includes("multipart/form-data")) {
    return parseFormData(request);
  }

  if (!contentType) {
    throw new HttpError(
      415,
      "缺少 Content-Type 头，暂不支持自动推断请求格式。"
    );
  }

  throw new HttpError(
    415,
    `暂不支持的 Content-Type：${contentType}，请改用 application/json 或 multipart/form-data。`
  );
}

async function parseJsonBody(request: Request): Promise<NormalizedOcrRequest> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    throw new HttpError(400, "JSON 解析失败，请检查请求体是否为合法 JSON。", {
      originalError: String(error)
    });
  }

  if (!body || typeof body !== "object") {
    throw new HttpError(400, "请求体应为 JSON 对象。");
  }

  return normalizeFromObject(body as Record<string, unknown>);
}

async function parseFormData(
  request: Request
): Promise<NormalizedOcrRequest> {
  const formData = await request.formData();
  const images: NormalizedImage[] = [];
  const restPayload: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (key === "image" || key === "images" || key === "file") {
      if (value instanceof File) {
        if (value.size === 0) {
          continue;
        }
        images.push(await fileToImagePayload(value));
      } else if (typeof value === "string") {
        images.push(
          normalizeImageValue(value, {
            label: key
          })
        );
      }
      continue;
    }

    if (key === "image_url" || key === "image_urls") {
      if (typeof value === "string") {
        if (value.trim().startsWith("data:")) {
          images.push(
            normalizeImageValue(value, {
              label: key
            })
          );
        } else {
          for (const url of splitMaybeCsv(value)) {
            images.push(
              normalizeImageValue(url, {
                label: key
              })
            );
          }
        }
      }
      continue;
    }

    if (key === "image_base64" || key === "image_data" || key === "imageData") {
      if (typeof value === "string") {
        images.push(
          normalizeImageValue(value, {
            label: key
          })
        );
      }
      continue;
    }

    if (key === "payload") {
      if (typeof value === "string" && value.trim()) {
        try {
          const parsed = JSON.parse(value);
          if (parsed && typeof parsed === "object") {
            Object.assign(restPayload, parsed);
          }
        } catch (error) {
          throw new HttpError(400, "payload 字段不是合法的 JSON 字符串。", {
            originalError: String(error)
          });
        }
      }
      continue;
    }

    if (restPayload[key] === undefined) {
      restPayload[key] = value;
    } else if (Array.isArray(restPayload[key])) {
      (restPayload[key] as unknown[]).push(value);
    } else {
      restPayload[key] = [restPayload[key], value];
    }
  }

  return normalizeFromObject(restPayload, images);
}

function normalizeFromObject(
  payload: Record<string, unknown>,
  preNormalizedImages: NormalizedImage[] = []
): NormalizedOcrRequest {
  const images = [...preNormalizedImages, ...gatherImages(payload)];
  if (!images.length) {
    throw new HttpError(
      400,
      "至少需要提供一张图片，可通过字段 images、image、image_url、image_base64 或 multipart/form-data 文件上传。"
    );
  }

  const {
    prompt,
    mode,
    language,
    outputs,
    temperature,
    topP,
    maxTokens,
    rawResponse,
    userMetadata
  } = extractControls(payload);

  return {
    images,
    prompt,
    mode,
    language,
    outputs,
    temperature,
    topP,
    maxTokens,
    rawResponse,
    userMetadata
  };
}

function gatherImages(payload: Record<string, unknown>): NormalizedImage[] {
  const images: NormalizedImage[] = [];
  const addImageValue = (value: unknown, label: string) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        images.push(
          normalizeImageValue(item, {
            label
          })
        );
      }
      return;
    }

    if (value !== undefined) {
      images.push(
        normalizeImageValue(value, {
          label
        })
      );
    }
  };

  if (Array.isArray(payload.images) || payload.images) {
    addImageValue(payload.images, "images");
  }

  if (payload.image !== undefined) {
    addImageValue(payload.image, "image");
  }

  if (payload.image_url !== undefined) {
    addImageValue(payload.image_url, "image_url");
  }

  if (payload.image_urls !== undefined) {
    addImageValue(payload.image_urls, "image_urls");
  }

  if (payload.image_base64 !== undefined) {
    addImageValue(payload.image_base64, "image_base64");
  }

  if (payload.imageData !== undefined) {
    addImageValue(payload.imageData, "imageData");
  }

  if (payload.dataUrl !== undefined) {
    addImageValue(payload.dataUrl, "dataUrl");
  }

  return images;
}

function extractControls(payload: Record<string, unknown>) {
  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : undefined;
  const mode = typeof payload.mode === "string" ? payload.mode.trim() : undefined;
  const language =
    typeof payload.language === "string"
      ? payload.language.trim()
      : typeof payload.lang === "string"
      ? payload.lang.trim()
      : undefined;

  const outputs = resolveOutputModes(
    payload.outputs ??
      payload.output_modes ??
      payload.format ??
      payload.formats ??
      payload.return ??
      payload.output
  );

  const mergedOptions = typeof payload.options === "object" && payload.options
    ? { ...(payload.options as Record<string, unknown>) }
    : {};

  const temperature = pickNumber(
    payload.temperature,
    mergedOptions.temperature,
    mergedOptions.temp
  );

  const topP = pickNumber(
    payload.topP,
    payload.top_p,
    mergedOptions.topP,
    mergedOptions.top_p
  );

  const maxTokens = pickNumber(
    payload.max_tokens,
    payload.maxTokens,
    mergedOptions.max_tokens,
    mergedOptions.maxTokens
  );

  const rawResponse = pickBoolean(
    payload.rawResponse,
    payload.raw_response,
    mergedOptions.rawResponse
  );

  const userMetadata =
    (payload.metadata as Record<string, unknown> | undefined) ??
    (payload.user_metadata as Record<string, unknown> | undefined);

  if (mode && !MODE_PRESETS[mode] && !prompt) {
    throw new HttpError(
      400,
      `无法识别的 mode: ${mode}。如需自定义，请显式提供 prompt，或选择现有预设：${Object.keys(
        MODE_PRESETS
      ).join(", ")}`
    );
  }

  return {
    prompt,
    mode,
    language,
    outputs,
    temperature,
    topP,
    maxTokens,
    rawResponse,
    userMetadata
  };
}

function resolveOutputModes(input: unknown): OutputMode[] {
  if (Array.isArray(input)) {
    return cleanseOutputModes(input);
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      return DEFAULT_OUTPUTS;
    }

    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return cleanseOutputModes(parsed);
        }
      } catch {
        // fall back to CSV parsing
      }
    }

    return cleanseOutputModes(splitMaybeCsv(trimmed));
  }

  if (input === undefined || input === null) {
    return DEFAULT_OUTPUTS;
  }

  return cleanseOutputModes([input]);
}

function cleanseOutputModes(values: unknown[]): OutputMode[] {
  const normalized: OutputMode[] = [];
  for (const value of values) {
    if (typeof value !== "string") {
      throw new HttpError(400, "输出格式 outputs 应为字符串或字符串数组。");
    }
    const key = value.trim();
    if (!key) continue;
    const canonical =
      OUTPUT_MODE_DEFINITIONS[key as OutputMode]
        ? (key as OutputMode)
        : OUTPUT_MODE_ALIASES[key.toLowerCase()];

    if (!canonical || !OUTPUT_MODE_DEFINITIONS[canonical]) {
      throw new HttpError(
        400,
        `不支持的输出格式 ${value}，可选项：${Object.keys(
          OUTPUT_MODE_DEFINITIONS
        ).join(", ")}`
      );
    }

    if (!normalized.includes(canonical)) {
      normalized.push(canonical);
    }
  }

  if (!normalized.length) {
    return DEFAULT_OUTPUTS;
  }

  return normalized;
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const maybe = Number(value);
      if (!Number.isNaN(maybe)) {
        return maybe;
      }
    }
  }
  return undefined;
}

function pickBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      if (["true", "1", "yes", "y"].includes(value.trim().toLowerCase())) {
        return true;
      }
      if (["false", "0", "no", "n"].includes(value.trim().toLowerCase())) {
        return false;
      }
    }
  }
  return undefined;
}

export function splitMaybeCsv(value: string): string[] {
  return value
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
