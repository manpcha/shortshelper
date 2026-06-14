# ShortsHelper v2.0

쇼핑쇼츠 기획 및 대본 작성 자동화 플랫폼 (FastAPI 기반)

## 기술 스택

- **백엔드**: FastAPI + Python
- **프론트엔드**: HTML + CSS + Vanilla JavaScript
- **템플릿**: Jinja2
- **AI**: Gemini API (텍스트 + Vision)
- **데이터**: YouTube Data API v3, Naver DataLab API

## 빠른 시작

### Windows

```bat
localstart.bat
```

### 수동 실행

```bash
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate      # Linux/Mac

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8101 --reload
```

접속: http://localhost:8101

## API 키 설정

`.env` 파일에 키를 입력하거나 웹 설정 화면(/settings)에서 입력하세요.

```env
GEMINI_API_KEY=your_key
YOUTUBE_API_KEY=your_key
NAVER_CLIENT_ID=your_id
NAVER_CLIENT_SECRET=your_secret
```

> ⚠️ `.env` 파일은 절대 GitHub에 커밋하지 마세요.

## 주요 기능

| 메뉴 | 기능 |
|------|------|
| 대시보드 | KPI 요약, 최근 프로젝트 |
| 소재탐색 | YouTube 쇼츠 검색, 키워드 트렌드 |
| 제품분석 | 텍스트 분석 + 영상 초정밀 분석 (Gemini Vision) |
| 대본생성 | AI 쇼핑쇼츠 대본 자동 생성 |
| 프로젝트 관리 | localStorage 기반 프로젝트 CRUD |
| 설정 | API 키 관리 |

## 프로젝트 구조

```
shortshelper/
├─ .env                    # API 키 (비공개)
├─ requirements.txt
├─ localstart.bat
├─ app/
│  ├─ main.py              # FastAPI 앱
│  └─ services/
│     ├─ gemini_service.py
│     ├─ youtube_service.py
│     ├─ naver_service.py
│     ├─ trend_service.py
│     └─ env_manager.py
├─ templates/              # Jinja2 HTML 템플릿
└─ static/                 # CSS + JS
```
