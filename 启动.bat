@echo off
chcp 65001 > nul
title FLIL 影语 · 启动器
cd /d "%~dp0"

echo.
echo ============================================================
echo   FLIL 影语 · 短剧 AI 流水线 启动器
echo ============================================================
echo.

REM 0) 检查 Node.js
where node >nul 2>nul
if errorlevel 1 (
  echo [X] 未检测到 Node.js. 请先安装 Node 18+ : https://nodejs.org/
  echo.
  pause
  exit /b 1
)

REM 1) 首次启动: 安装依赖
if not exist "node_modules" (
  echo [1/3] 首次启动, 正在安装依赖 ^(npm install^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [X] 依赖安装失败.
    pause
    exit /b 1
  )
) else (
  echo [1/3] 依赖已就绪.
)

REM 2) 检查 prompts 是否已导入
if not exist "public\prompts\manifest.json" (
  echo [2/3] 导入 prompts ^(F:\下载文件\八步 -^> public\prompts^)...
  call npm run import:prompts
  if errorlevel 1 (
    echo [!] prompts 导入失败. 请确认 F:\下载文件\八步\ 存在.
    echo     可手动指定: node scripts\import-prompts.mjs "你的源目录"
    pause
    exit /b 1
  )
) else (
  echo [2/3] prompts 已就绪.
)

REM 3) 启动 dev server + 自动打开浏览器
echo [3/3] 启动 Vite dev server 并自动打开浏览器...
echo.
echo   地址: http://127.0.0.1:5173/
echo   按 Ctrl+C 可停止服务.
echo.

REM 3 秒后异步打开浏览器, 让 Vite 先就绪
start "" cmd /c "timeout /t 3 /nobreak > nul && start http://127.0.0.1:5173/"

REM 阻塞前台运行 dev (关闭窗口 = 关闭服务)
call npm run dev

echo.
echo dev server 已退出.
pause
