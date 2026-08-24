@echo off
chcp 65001 >nul
title THAI FOLK BEAT - เดโม
cd /d "%~dp0"

echo.
echo   THAI FOLK BEAT
echo   เกมจังหวะดนตรีพื้นบ้านอีสาน
echo   =============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [!] ไม่พบ Node.js บนเครื่องนี้
  echo       ติดตั้งได้ที่ https://nodejs.org  แล้วเปิดไฟล์นี้อีกครั้ง
  echo.
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo   ยังไม่มีไฟล์เกมที่ build ไว้ กำลังสร้างให้ ^(ใช้เวลาสักครู่^)...
  echo.
  if not exist "node_modules" call npm install
  call npm run build
  if errorlevel 1 (
    echo.
    echo   [!] สร้างไฟล์เกมไม่สำเร็จ
    pause
    exit /b 1
  )
)

node scripts\serve-demo.mjs
pause
