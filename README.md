# DS OCR 平台

面向 DeepSeek-OCR 的一体化方案：

- GitHub 仓库：<https://github.com/velist/dsocr>
- **Cloudflare Worker**：统一接收 OCR 请求，整理图片输入、提示词与输出格式，转发至硅基流动 `deepseek-ai/DeepSeek-OCR` 模型，并返回纯文本 / Markdown / 布局信息等多种结果。
- **MCP Server**：基于 Model Context Protocol 的工具服务，可在 Claude Code、Codex CLI 等支持 MCP 的客户端中直接调用该 OCR 能力。
- **Shared 模块**：共享输出格式、提示词等定义，保证 Worker 与 MCP 行为一致。

## 快速开始

### 环境准备

1. 安装依赖
   ```bash
   npm install
   ```
2. 凭据配置
   - 将硅基流动 Key（`siliconflowkey.env`）写入 `apps/worker/.dev.vars`
     ```bash
     printf "SILICONFLOW_API_KEY=%s\n" "$(cat siliconflowkey.env)" > apps/worker/.dev.vars
     ```
   - 部署到 Cloudflare 前，执行：
     ```bash
 npm run deploy --workspace @dsocr/worker  # 首次会提示登录/配置 wrangler
 wrangler secret put SILICONFLOW_API_KEY   # 交互式粘贴 Key
 ```
 - Cloudflare API Token（`allcfkey.env`）可用于 `wrangler login --api-token $(cat allcfkey.env)`。
  - 当前部署实例（示例）：`https://dsocr-worker.vee5208.workers.dev/ocr`

### 本地开发

- 启动 Worker（端口默认 8787）：
  ```bash
  npm run dev --workspace @dsocr/worker
  ```
- 发送测试请求：
  ```bash
  curl -X POST http://127.0.0.1:8787/ocr \
       -H "Content-Type: application/json" \
       -d '{
         "image_url": "https://example.com/sample.png",
         "outputs": ["plain_text", "markdown"]
       }'
  ```

- MCP 服务：
  ```bash
  npm run start --workspace @dsocr/mcp-server
  ```
  > 默认读取 `DSOCR_WORKER_URL` 环境变量（未设置时使用 `http://127.0.0.1:8787/ocr`）。

### 测试

```bash
npm run test            # 运行全部工作区测试
npm run test --workspace @dsocr/worker
npm run test --workspace @dsocr/mcp-server
```

## 目录结构

```
apps/
  worker/      Cloudflare Worker 源码（入口 src/index.ts）
  mcp/         MCP Server 源码（入口 src/index.ts）
packages/
  shared/      公共常量与类型定义
```

## 部署建议

1. **Worker**
   - 编辑 `apps/worker/wrangler.toml` 中的 `name`、`routes` 等参数以匹配目标域名。
   - `wrangler deploy` 部署后可通过 `wrangler tail` 观察日志。
   - 若需图片较大或自定义格式，可在请求体中通过 `mode`、`outputs`、`prompt` 调整行为。
2. **MCP Server**
   - 打包为 Node 脚本后，可放置到任意有 STDIO 能力的环境。
   - Claude Code 配置示例：
     ```bash
     claude mcp add --transport stdio dsocr "node /path/to/apps/mcp/dist/index.js"
     ```
   - Codex CLI 或其他 MCP 客户端，可根据其要求配置指令/路径；默认使用 Worker 端点，如需指向线上地址可设置 `DSOCR_WORKER_URL=https://your.worker.url/ocr`。

## 工具输入说明（MCP）

| 字段 | 类型 | 说明 |
| ---- | ---- | ---- |
| `source` / `sources` | string / string[] | 图片本地路径、`file://`、HTTP URL、dataURL、Base64 均可 |
| `outputs` | string 或 string[] | 指定返回格式，支持 `plain_text`、`markdown`、`layout_markdown`、`html`、`text_blocks` 及其别名 |
| `mode` | string | 对应 Worker 的预设（`auto`、`plain`、`markdown`、`layout` 等） |
| `prompt` | string | 自定义 OCR 指令，若提供将覆盖 `mode` 默认提示词 |
| `language` | string | 优先输出语言提示（如 `zh-CN`、`en-US`） |
| `raw` | boolean | 为 true 时，Worker 会回传原始响应与请求 payload |

## 运行时注意

- Cloudflare Worker 体积限制 10 MB，若需要大文件请在客户端压缩或拆分。
- `outputs` 中的 `text_blocks` 返回 JSON 数组（文本 + 归一化坐标 + 置信度），便于结构化处理。
- MCP 工具默认返回 Markdown 文本以及完整 JSON，可同时满足模型上下文与工程接入需求。

## 后续计划

- 接入流式响应与任务状态跟踪。
- 在 shared 模块加入更多 DS OCR 预设（表格、票据等专用模板）。
- 引入 e2e 测试（Mock fetch）保障 Worker 行为。
