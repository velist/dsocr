@echo off
setlocal
cd /d "%~dp0.."
npm run start --workspace @dsocr/mcp-server
endlocal
