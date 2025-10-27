import { errorResponse, HttpError } from "./errors";
import { normalizeOcrRequest } from "./utils/normalize";
import { callSiliconFlow } from "./services/siliconflow";
import { MODE_PRESETS } from "@dsocr/shared";

export interface Env {
  SILICONFLOW_API_KEY: string;
}

const CORS_HEADERS: HeadersInit = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST,OPTIONS",
  "access-control-allow-headers": "*",
  "content-type": "application/json; charset=utf-8"
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: CORS_HEADERS
        });
      }

      if (request.method === "GET" && url.pathname === "/health") {
        return new Response(
          JSON.stringify({
            status: "ok",
            service: "dsocr-worker"
          }),
          { status: 200, headers: CORS_HEADERS }
        );
      }

      if (request.method !== "POST" || url.pathname !== "/ocr") {
        throw new HttpError(404, "未找到对应的接口路径。");
      }

      const normalized = await normalizeOcrRequest(request);
      const siliconflowResult = await callSiliconFlow(env, normalized);

      const presetPrompt =
        normalized.mode && MODE_PRESETS[normalized.mode]
          ? MODE_PRESETS[normalized.mode].prompt
          : MODE_PRESETS.auto.prompt;

      const parsedWithMeta = siliconflowResult.parsedContent as
        | (Record<string, unknown> & { warnings?: unknown })
        | null;

      const warnings = Array.isArray(parsedWithMeta?.warnings)
        ? (parsedWithMeta?.warnings as unknown[])
        : undefined;

      const responseBody = {
        id: siliconflowResult.response.id,
        model: siliconflowResult.response.model,
        created: siliconflowResult.response.created,
        outputs: siliconflowResult.parsedContent ?? undefined,
        text: siliconflowResult.rawContent,
        parsed: !!siliconflowResult.parsedContent,
        parse_error: siliconflowResult.parseError,
        usage: siliconflowResult.response.usage,
        requested_outputs: normalized.outputs,
        language: normalized.language,
        mode: normalized.mode ?? "auto",
        prompt: normalized.prompt ?? presetPrompt,
        warnings,
        raw_response: normalized.rawResponse
          ? siliconflowResult.response
          : undefined,
        debug_payload: normalized.rawResponse
          ? siliconflowResult.requestPayload
          : undefined
      };

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: CORS_HEADERS
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
};
