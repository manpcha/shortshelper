@echo off
cd /d %~dp0

echo ============================================
echo   ShortsHelper v2.0 - FastAPI Server
echo ============================================

if not exist venv (
    echo [1/4] Creating virtual environment...
    python -m venv venv
)

echo [2/4] Installing packages...
call venv\Scripts\activate.bat
python -m pip install -r requirements.txt -q
python -m pip install certifi -q

set CERTIFI_PATH=%CD%\venv\Lib\site-packages\certifi\cacert.pem

if exist "%CERTIFI_PATH%" (
    set SSL_CERT_FILE=%CERTIFI_PATH%
    set REQUESTS_CA_BUNDLE=%CERTIFI_PATH%
    set GRPC_DEFAULT_SSL_ROOTS_FILE_PATH=%CERTIFI_PATH%
    echo [3/4] SSL cert ready.
) else (
    echo [SSL] certifi cacert.pem not found.
)

echo [4/4] Starting server...
echo URL: http://127.0.0.1:8101

python -m uvicorn app.main:app --host 127.0.0.1 --port 8101

pause