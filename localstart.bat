@echo off
chcp 65001 > nul
cd /d %~dp0

echo ============================================
echo   ShortsHelper v2.0 - FastAPI Server
echo ============================================
echo.

if not exist venv (
    echo [1/3] 가상환경 생성 중...
    python -m venv venv
)

echo [2/3] 패키지 설치 중...
call venv\Scripts\activate
pip install -r requirements.txt -q

echo.
echo [3/3] 서버 시작...
echo.
echo   접속 주소: http://localhost:8101
echo.

uvicorn app.main:app --host 0.0.0.0 --port 8101 --reload

pause
