import { callSiliconFlow } from "../src/services/siliconflow";
import type { Env } from "../src";
import type { NormalizedOcrRequest } from "../src/types";

async function main() {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 SILICONFLOW_API_KEY 环境变量。");
  }

  const env: Env = { SILICONFLOW_API_KEY: apiKey };

  const request: NormalizedOcrRequest = {
    images: [
      {
        data: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/320px-PNG_transparency_demonstration_1.png",
        source: "remote_url"
      }
    ],
    outputs: ["plain_text", "markdown"],
    mode: "markdown",
    prompt: undefined,
    language: "zh-CN",
    rawResponse: false,
    temperature: 0,
    topP: undefined,
    maxTokens: 2048,
    userMetadata: {
      test: "quick"
    }
  };

  const result = await callSiliconFlow(env, request);
  console.log("识别返回：", JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("调用失败", error);
  process.exit(1);
});
