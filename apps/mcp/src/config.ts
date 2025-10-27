import { z } from "zod";

const configSchema = z.object({
  workerUrl: z
    .string()
    .url()
    .default("http://127.0.0.1:8787/ocr"),
  requestTimeoutMs: z
    .number()
    .int()
    .positive()
    .default(120_000),
  userAgent: z
    .string()
    .min(1)
    .default("dsocr-mcp/0.1.0")
});

export type DsocrConfig = z.infer<typeof configSchema>;

export function loadConfig(): DsocrConfig {
  const raw = {
    workerUrl:
      process.env.DSOCR_WORKER_URL ??
      process.env.DSOCR_ENDPOINT ??
      "http://127.0.0.1:8787/ocr",
    requestTimeoutMs: parseNumber(process.env.DSOCR_TIMEOUT_MS),
    userAgent:
      process.env.DSOCR_USER_AGENT ??
      `dsocr-mcp/${process.env.npm_package_version ?? "0.1.0"}`
  };

  return configSchema.parse(raw);
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
