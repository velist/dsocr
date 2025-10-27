import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config";
import { registerOcrTool } from "./tools/ocr";

async function main() {
  const config = loadConfig();

  const server = new McpServer({
    name: "dsocr-mcp",
    version: "0.1.0"
  });

  registerOcrTool(server, config);

  const transport = new StdioServerTransport();
  console.error(
    `[dsocr-mcp] 已启动，Worker 端点：${config.workerUrl}，超时：${config.requestTimeoutMs}ms`
  );

  await server.connect(transport);
}

main().catch((error) => {
  console.error("[dsocr-mcp] 启动失败", error);
  process.exit(1);
});
