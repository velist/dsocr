import type { NormalizedImage } from "../types";
import { HttpError } from "../errors";

const BASE64_REGEX = /^[a-zA-Z0-9+/=\r\n]+$/;

export async function fileToImagePayload(file: File): Promise<NormalizedImage> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);
  const mimeType = file.type || "application/octet-stream";
  return {
    data: `data:${mimeType};base64,${base64}`,
    mimeType,
    filename: file.name,
    source: "data_url"
  };
}

export function normalizeImageValue(
  value: unknown,
  options?: {
    mimeType?: string;
    label?: string;
  }
): NormalizedImage {
  if (typeof value === "string") {
    return normalizeStringImage(value, options);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (typeof record.dataUrl === "string") {
      return normalizeStringImage(record.dataUrl, options);
    }

    if (typeof record.data_url === "string") {
      return normalizeStringImage(record.data_url, options);
    }

    if (typeof record.url === "string") {
      return normalizeStringImage(record.url, options);
    }

    if (typeof record.imageUrl === "string") {
      return normalizeStringImage(record.imageUrl, options);
    }

    if (typeof record.image_url === "string") {
      return normalizeStringImage(record.image_url, options);
    }

    if (typeof record.base64 === "string") {
      return normalizeBase64String(record.base64, record.mimeType, options);
    }

    if (typeof record.data === "string" && record.encoding === "base64") {
      return normalizeBase64String(
        record.data,
        (record.mimeType as string | undefined) ??
          (record.mime_type as string | undefined),
        options
      );
    }

    if (
      typeof record.data === "string" &&
      typeof record.type === "string" &&
      record.type.toLowerCase() === "base64"
    ) {
      return normalizeBase64String(
        record.data,
        (record.mimeType as string | undefined) ??
          (record.mime_type as string | undefined),
        options
      );
    }

    if (typeof record.data === "string" && record.data.trim().startsWith("data:")) {
      return normalizeStringImage(record.data, options);
    }
  }

  throw new HttpError(
    400,
    `无法解析的图片输入${options?.label ? `(${options.label})` : ""}`,
    {
      value
    }
  );
}

function normalizeStringImage(
  value: string,
  options?: { mimeType?: string }
): NormalizedImage {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpError(400, "图片地址或内容不能为空。");
  }

  if (trimmed.startsWith("data:")) {
    return {
      data: trimmed,
      mimeType: extractMimeType(trimmed),
      source: "data_url"
    };
  }

  if (isHttpUrl(trimmed)) {
    return {
      data: trimmed,
      source: "remote_url"
    };
  }

  if (isLikelyBase64(trimmed)) {
    return normalizeBase64String(trimmed, options?.mimeType);
  }

  throw new HttpError(400, "图片字符串既不是合法 URL，也不是 Base64 或 dataURL。");
}

function normalizeBase64String(
  value: string,
  mimeType?: unknown,
  options?: { mimeType?: string }
): NormalizedImage {
  const cleaned = value.trim();
  if (!cleaned) {
    throw new HttpError(400, "Base64 图片内容不能为空。");
  }

  if (!isLikelyBase64(cleaned)) {
    throw new HttpError(400, "提供的 Base64 图片内容无效，无法解码。");
  }

  const derivedMime =
    (typeof mimeType === "string" && mimeType) || options?.mimeType || "image/png";

  return {
    data: `data:${derivedMime};base64,${cleaned}`,
    mimeType: derivedMime,
    source: "data_url"
  };
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
  if (!BASE64_REGEX.test(sanitized)) return false;

  try {
    decodeBase64(sanitized);
    return true;
  } catch {
    return false;
  }
}

function extractMimeType(dataUrl: string): string | undefined {
  const match = /^data:([^;,]+)[;,]/.exec(dataUrl);
  return match?.[1];
}

function decodeBase64(value: string): string {
  if (typeof atob === "function") {
    return atob(value);
  }

  const nodeBuffer = (globalThis as Record<string, any>).Buffer;
  if (nodeBuffer) {
    return nodeBuffer.from(value, "base64").toString("binary");
  }

  throw new Error("当前运行环境不支持 Base64 解码。");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  const nodeBuffer = (globalThis as Record<string, any>).Buffer;
  if (nodeBuffer) {
    return nodeBuffer.from(binary, "binary").toString("base64");
  }

  throw new Error("当前运行环境不支持 Base64 编码。");
}
