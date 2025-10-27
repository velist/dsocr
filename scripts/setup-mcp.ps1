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

Write-Host "=== DS OCR MCP setup ===" -ForegroundColor Cyan
Write-Host "Repository path: $repoRoot"

if ($InstallDependencies) {
  Write-Host "`n[1/4] Installing npm dependencies..." -ForegroundColor Yellow
  Push-Location $repoRoot
  try {
    npm install | Write-Host
  } finally {
    Pop-Location
  }
}

Write-Host "`n[2/4] Setting environment variables..." -ForegroundColor Yellow
$env:DSOCR_WORKER_URL = $WorkerUrl
$env:DSOCR_TIMEOUT_MS = $TimeoutMs.ToString()
Write-Host "  Session DSOCR_WORKER_URL = $WorkerUrl"
Write-Host "  Session DSOCR_TIMEOUT_MS = $TimeoutMs"

if ($Persist) {
  Write-Host "  Persisting environment variables for current user..." -ForegroundColor Green
  setx DSOCR_WORKER_URL $WorkerUrl | Out-Null
  setx DSOCR_TIMEOUT_MS $TimeoutMs | Out-Null

  $envFile = Join-Path $repoRoot ".env.mcp"
  @(
    "# Auto-generated, edit if needed"
    "DSOCR_WORKER_URL=$WorkerUrl"
    "DSOCR_TIMEOUT_MS=$TimeoutMs"
  ) | Set-Content -Encoding UTF8 $envFile
  Write-Host "  Wrote $envFile"
}

if ($ConfigureClients) {
  Write-Host "`n[3/4] Configuring MCP clients..." -ForegroundColor Yellow
  $command = "npm run start --workspace @dsocr/mcp-server"

  if (Get-Command claude -ErrorAction SilentlyContinue) {
    Write-Host "  Configuring Claude CLI..." -ForegroundColor Green
    try {
      & claude mcp remove dsocr -y | Out-Null
    } catch {
      # ignore
    }
    & claude mcp add dsocr --transport stdio --command $command --cwd $repoRoot
  } else {
    Write-Warning "Claude CLI (command 'claude') not found. Install it from https://docs.claude.ai/cli and re-run with -ConfigureClients."
  }

  if (Get-Command codex -ErrorAction SilentlyContinue) {
    Write-Host "  Configuring Codex CLI..." -ForegroundColor Green
    try {
      & codex mcp remove dsocr | Out-Null
    } catch {
    }
    & codex mcp add dsocr --transport stdio --command $command --cwd $repoRoot
  } else {
    Write-Warning "Codex CLI (command 'codex') not found. Ensure it is installed and accessible, then rerun with -ConfigureClients."
  }
}

if ($StartServer) {
  Write-Host "`n[4/4] Starting MCP server..." -ForegroundColor Yellow
  $startArgs = "-NoExit", "-Command", "cd `"$repoRoot`"; npm run start --workspace @dsocr/mcp-server"
  Start-Process "powershell.exe" -ArgumentList $startArgs
  Write-Host "A new terminal window has been launched with dsocr-mcp running."
} else {
  Write-Host "`nManual MCP start commands:" -ForegroundColor Green
  Write-Host "  cd `"$repoRoot`""
  Write-Host "  npm run start --workspace @dsocr/mcp-server"
}

Write-Host "`nSetup script completed." -ForegroundColor Cyan
