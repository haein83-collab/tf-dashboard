@echo off
chcp 65001 > nul
echo TF 대시보드 시작 중...
start "TF 서버" cmd /k "node server/index.js"
timeout /t 2 /nobreak > nul
start "TF 프론트엔드" cmd /k "npx vite"
echo.
echo 잠시 후 브라우저에서 http://localhost:5173 을 열어주세요
echo 기본 비밀번호: tf2024
pause
