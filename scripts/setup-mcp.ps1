[CmdletBinding()]
param(
  [string]$WorkerUrl = "https://dsocr-worker.vee5208.workers.dev/ocr",
  [int]$TimeoutMs = 120000,
  [switch]$Persist,
  [switch]$InstallDependencies,
  [switch]$ConfigureClients,
  [switch]$StartServer
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path "$PSScriptRoot/..").Path

Write-Host "=== DS OCR MCP 设置脚本 ===" -ForegroundColor Cyan
Write-Host "仓库路径: $repoRoot"

if ($InstallDependencies) {
  Write-Host "`n[1/4] 安装 npm 依赖..." -ForegroundColor Yellow
  Push-Location $repoRoot
  try {
    npm install | Write-Host
  } finally {
    Pop-Location
  }
}

Write-Host "`n[2/4] 配置环境变量..." -ForegroundColor Yellow
$env:DSOCR_WORKER_URL = $WorkerUrl
$env:DSOCR_TIMEOUT_MS = $TimeoutMs.ToString()
Write-Host "  当前会话 DSOCR_WORKER_URL = $WorkerUrl"
Write-Host "  当前会话 DSOCR_TIMEOUT_MS = $TimeoutMs"

if ($Persist) {
  Write-Host "  持久化环境变量到用户级别..." -ForegroundColor Green
  setx DSOCR_WORKER_URL $WorkerUrl | Out-Null
  setx DSOCR_TIMEOUT_MS $TimeoutMs | Out-Null

  $envFile = Join-Path $repoRoot ".env.mcp"
  @(
    "# 自动生成，请按需调整"
    "DSOCR_WORKER_URL=$WorkerUrl"
    "DSOCR_TIMEOUT_MS=$TimeoutMs"
  ) | Set-Content -Encoding UTF8 $envFile
  Write-Host "  已写入 $envFile"
}

if ($ConfigureClients) {
  Write-Host "`n[3/4] 配置 MCP 客户端..." -ForegroundColor Yellow
  $command = "npm run start --workspace @dsocr/mcp-server"

  if (Get-Command claude -ErrorAction SilentlyContinue) {
    Write-Host "  配置 Claude CLI..." -ForegroundColor Green
    try {
      & claude mcp remove dsocr -y | Out-Null
    } catch {
      # 忽略不存在的错误
    }
    & claude mcp add dsocr --transport stdio --command $command --cwd $repoRoot
  } else {
    Write-Warning "未检测到 Claude CLI（命令 claude）。请参考 https://docs.claude.ai/cli 安装后再次运行 -ConfigureClients。"
  }

  if (Get-Command codex -ErrorAction SilentlyContinue) {
    Write-Host "  配置 Codex CLI..." -ForegroundColor Green
    try {
      & codex mcp remove dsocr | Out-Null
    } catch {
    }
    & codex mcp add dsocr --transport stdio --command $command --cwd $repoRoot
  } else {
    Write-Warning "未检测到 Codex CLI（命令 codex）。若已安装，请确保在当前终端可执行，然后重新运行 -ConfigureClients。"
  }
}

if ($StartServer) {
  Write-Host "`n[4/4] 启动 MCP 服务..." -ForegroundColor Yellow
  $startArgs = "-NoExit", "-Command", "cd `"$repoRoot`"; npm run start --workspace @dsocr/mcp-server"
  Start-Process "powershell.exe" -ArgumentList $startArgs
  Write-Host "已在新终端窗口中启动 dsocr-mcp，请留意日志输出。"
} else {
  Write-Host "`n可通过以下命令手动启动 MCP：" -ForegroundColor Green
  Write-Host "  cd `"$repoRoot`""
  Write-Host "  npm run start --workspace @dsocr/mcp-server"
}

Write-Host "`n脚本执行完毕。" -ForegroundColor Cyan
