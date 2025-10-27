import type { OutputMode } from "@dsocr/shared";

export interface NormalizedOcrRequest {
  images: NormalizedImage[];
  prompt?: string;
  mode?: string;
  outputs: OutputMode[];
  language?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  rawResponse?: boolean;
  userMetadata?: Record<string, unknown>;
}

export interface NormalizedImage {
  data: string;
  mimeType?: string;
  filename?: string;
  source: "data_url" | "remote_url";
}

export interface SiliconFlowChatCompletionRequest {
  model: string;
  messages: Array<Record<string, unknown>>;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  response_format?: Record<string, unknown>;
  stream?: boolean;
}

export interface SiliconFlowChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}
