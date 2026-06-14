/* ═══════════════════════════════════════════════════════
   ShortsHelper — app.js
   FastAPI + Vanilla JS  (v2.0)
═══════════════════════════════════════════════════════ */

const App = (() => {
  // ─── Constants ────────────────────────────────────────
  const PROJECTS_KEY = 'sh_projects';
  const PREFILL_KEY  = 'sh_prefill';
  const MODEL_KEY    = 'sh_model';

  const SECTION_COLORS = {
    '훅':       '#a78bfa',
    '문제 제시': '#f87171',
    '제품 소개': '#34d399',
    '핵심 포인트': '#34d399',
    '사용 장면': '#60a5fa',
    'CTA':      '#fbbf24',
  };

  const ACTION_STYLES = {
    '영상 제작 강력 추천': { color:'#a78bfa', bg:'rgba(124,58,237,.15)' },
    '트렌드 선점 기회':  { color:'#34d399', bg:'rgba(16,185,129,.15)' },
    '급상승 주시':        { color:'#fbbf24', bg:'rgba(245,158,11,.15)' },
    '안정적 수요':        { color:'#38bdf8', bg:'rgba(14,165,233,.15)' },
    '경쟁 심화 주의':    { color:'#f87171', bg:'rgba(239,68,68,.15)' },
  };

  const CAT_COLORS = {
    '생활용품':{ color:'#22d3ee', bg:'rgba(6,182,212,.1)' },
    '주방용품':{ color:'#fb923c', bg:'rgba(249,115,22,.1)' },
    '인테리어':{ color:'#c084fc', bg:'rgba(168,85,247,.1)' },
    '뷰티':    { color:'#f472b6', bg:'rgba(236,72,153,.1)' },
    '건강':    { color:'#4ade80', bg:'rgba(34,197,94,.1)' },
    '육아':    { color:'#facc15', bg:'rgba(234,179,8,.1)' },
    '디지털':  { color:'#60a5fa', bg:'rgba(59,130,246,.1)' },
  };

  // ─── localStorage helpers ──────────────────────────────
  function getProjects() {
    try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]'); }
    catch { return []; }
  }
  function saveProjects(list) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
  }
  function addProject(p) {
    const list = getProjects();
    list.unshift(p);
    saveProjects(list);
    return p;
  }
  function updateProject(id, updates) {
    const list = getProjects().map(p => p.id === id ? { ...p, ...updates } : p);
    saveProjects(list);
  }
  function deleteProject(id) {
    saveProjects(getProjects().filter(p => p.id !== id));
  }
  function getModel() {
    return localStorage.getItem(MODEL_KEY) || 'gemini-2.0-flash';
  }

  // ─── HTTP helpers ──────────────────────────────────────
  async function post(url, data) {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return r.json();
  }
  async function get(url, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const r = await fetch(qs ? `${url}?${qs}` : url);
    return r.json();
  }

  // ─── Toast ─────────────────────────────────────────────
  function toast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // ─── Sidebar ───────────────────────────────────────────
  function initSidebar() {
    const btn     = document.getElementById('menuBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!btn) return;
    function open()  { sidebar.classList.add('open'); overlay.classList.add('active'); }
    function close() { sidebar.classList.remove('open'); overlay.classList.remove('active'); }
    btn.addEventListener('click', () => sidebar.classList.contains('open') ? close() : open());
    overlay.addEventListener('click', close);
  }

  // ─── API status dot ────────────────────────────────────
  async function checkApiStatus() {
    try {
      const s = await get('/api/settings/status');
      const dot = document.getElementById('apiStatusDot');
      if (!dot) return;
      const ok = s.geminiApiKey || s.youtubeApiKey;
      dot.className = 'api-dot ' + (ok ? 'ok' : 'err');
      dot.title = ok ? 'API 연결됨' : 'API 키 미설정';
    } catch {}
  }

  // ─── Markdown → safe HTML ──────────────────────────────
  function md2html(text) {
    if (!text) return '';
    return text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^(#{1,3})\s+(.+)$/gm, (_, h, t) => `<h${h.length+1}>${t}</h${h.length+1}>`)
      .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)+/gs, m => `<ul>${m}</ul>`)
      .replace(/^---$/gm, '<hr>')
      .replace(/\n{2,}/g,'</p><p>')
      .replace(/\n/g,'<br>');
  }

  // ─── Date helper ───────────────────────────────────────
  function fmtDate(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' });
  }
  function fmtNum(n) {
    if (n >= 10000) return (n/10000).toFixed(1)+'만';
    if (n >= 1000) return (n/1000).toFixed(1)+'천';
    return String(n);
  }

  // ─── Status badge HTML ─────────────────────────────────
  function statusBadge(status) {
    const map = { draft:'초안', active:'진행중', completed:'완료', archived:'보관' };
    return `<span class="badge badge-${status}">${map[status]||status}</span>`;
  }

  // ═══════════════════════════════════════════════════════
  // PAGE: Dashboard
  // ═══════════════════════════════════════════════════════
  function initDashboard() {
    const projects = getProjects();
    const today = new Date().toDateString();

    // KPI
    const scripts  = projects.filter(p => p.scriptContent).length;
    const analyzed = projects.filter(p => p.analysisContent && new Date(p.createdAt).toDateString() === today).length;

    document.getElementById('kpiProjects').textContent = projects.length;
    document.getElementById('kpiScripts').textContent  = scripts;
    document.getElementById('kpiAnalyzed').textContent = analyzed;

    // Recent projects
    const tbody = document.getElementById('recentTbody');
    if (!tbody) return;
    const recent = projects.slice(0, 5);
    if (!recent.length) return;
    tbody.innerHTML = recent.map(p => `
      <tr>
        <td><strong>${esc(p.name || '(제목 없음)')}</strong></td>
        <td>${esc(p.category || '-')}</td>
        <td>${fmtDate(p.createdAt)}</td>
        <td>${statusBadge(p.status || 'draft')}</td>
        <td><a href="/projects" class="btn btn-ghost btn-sm">보기 →</a></td>
      </tr>
    `).join('');
  }

  // ═══════════════════════════════════════════════════════
  // PAGE: Explore
  // ═══════════════════════════════════════════════════════
  function initExplore() {
    let selectedPeriod = '오늘';
    let trendPeriod    = 'today';
    let trendCategory  = '전체';

    // Period chips (YouTube)
    document.querySelectorAll('#periodChips .chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#periodChips .chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPeriod = btn.dataset.val;
      });
    });

    // Search
    const searchBtn = document.getElementById('searchBtn');
    const queryEl   = document.getElementById('searchQuery');

    async function doSearch() {
      const q = queryEl.value.trim();
      if (!q) { toast('검색어를 입력하세요.', 'error'); return; }
      show('searchSpinner'); hide('videoResults');
      document.getElementById('searchStats').classList.add('hidden');
      try {
        const data = await get('/api/youtube', { query: q, period: selectedPeriod });
        hide('searchSpinner');
        if (data.error) { toast(data.error, 'error'); return; }
        renderVideos(data);
      } catch (e) {
        hide('searchSpinner'); toast('검색 중 오류가 발생했습니다.', 'error');
      }
    }

    searchBtn.addEventListener('click', doSearch);
    queryEl.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

    // Trend category chips
    document.querySelectorAll('#catChips .chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#catChips .chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        trendCategory = btn.dataset.val;
        loadTrend();
      });
    });

    // Trend period chips
    document.querySelectorAll('#trendPeriodChips .chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#trendPeriodChips .chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        trendPeriod = btn.dataset.val;
        loadTrend();
      });
    });

    document.getElementById('trendRefreshBtn').addEventListener('click', () => {
      loadTrend(true);
    });

    async function loadTrend(force = false) {
      show('trendSpinner');
      document.getElementById('trendTbody').innerHTML =
        '<tr><td colspan="7" class="empty-row">로딩 중...</td></tr>';
      try {
        const data = await get('/api/naver-trend', { period: trendPeriod, category: trendCategory });
        hide('trendSpinner');
        renderTrend(data);
      } catch {
        hide('trendSpinner'); toast('트렌드 데이터 로드 실패', 'error');
      }
    }

    loadTrend();

    // Update source badge
    get('/api/settings/status').then(s => {
      const badge = document.getElementById('trendSourceBadge');
      if (!badge) return;
      if (s.naverClientId && s.naverClientSecret) {
        badge.innerHTML = '<span class="badge badge-active">● 네이버 데이터랩 실시간</span>';
      } else {
        badge.innerHTML = '<span class="badge badge-draft">● Mock 데이터 (네이버 키 미설정)</span>';
      }
    });
  }

  function renderVideos(data) {
    const stats = data.filtered || {};
    const statsEl = document.getElementById('searchStats');
    statsEl.textContent =
      `검색 결과: ${stats.total || 0}개 → 1분 이하: ${stats.shortsDuration || 0}개 → 댓글 30개 이상: ${stats.minComments || 0}개`;
    statsEl.classList.remove('hidden');

    const grid = document.getElementById('videoResults');
    grid.innerHTML = '';
    if (!data.items || !data.items.length) {
      grid.innerHTML = '<p style="color:var(--text-3);padding:20px">조건에 맞는 영상이 없습니다.</p>';
      grid.style.display = 'block';
      return;
    }
    grid.style.display = '';
    data.items.forEach(v => {
      const card = document.createElement('div');
      card.className = 'video-card';
      card.innerHTML = `
        <div class="video-thumb">
          <img src="${esc(v.thumbnailUrl)}" alt="${esc(v.title)}" loading="lazy" />
          <span class="thumb-duration">${esc(v.durationLabel||'')}</span>
          <span class="thumb-shorts"><span class="badge badge-shorts">Shorts</span></span>
        </div>
        <div class="video-info">
          <div class="video-title">${esc(v.title)}</div>
          <div class="video-channel">${esc(v.channelName)}</div>
          <div class="video-meta">
            <span>👁 ${fmtNum(v.viewCount||0)}</span>
            <span>💬 ${fmtNum(v.commentCount||0)}</span>
          </div>
        </div>
        <div class="video-actions">
          <a href="https://youtube.com/shorts/${esc(v.id)}" target="_blank" rel="noopener"
             class="btn btn-ghost btn-sm" style="flex:1;font-size:11px">▶ 보기</a>
          <button class="btn btn-secondary btn-sm" style="flex:1;font-size:11px"
            onclick='App.goScript(${JSON.stringify({ name: v.title, category:"기타", features:"", target:"" })})'>✍️ 대본</button>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function renderTrend(keywords) {
    const tbody = document.getElementById('trendTbody');
    if (!keywords || !keywords.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-row">데이터가 없습니다.</td></tr>';
      return;
    }
    tbody.innerHTML = keywords.map(k => {
      const cat    = CAT_COLORS[k.category] || { color:'#a1a1aa', bg:'rgba(161,161,170,.1)' };
      const action = ACTION_STYLES[k.recommendedAction] || { color:'#a1a1aa', bg:'rgba(161,161,170,.1)' };
      const cr     = k.changeRate;
      const crClass = cr > 0 ? 'up' : cr < 0 ? 'down' : 'flat';
      const crText  = cr > 0 ? `▲ ${cr}%` : cr < 0 ? `▼ ${Math.abs(cr)}%` : '→ 0%';
      const rankCls = k.rank <= 3 ? 'top3' : '';
      return `
        <tr>
          <td><span class="rank-num ${rankCls}">${k.rank}</span></td>
          <td>
            <span style="font-weight:600">${esc(k.keyword)}</span>
            ${k.isHot ? '<span class="badge badge-hot" style="margin-left:6px">HOT</span>' : ''}
            ${k.isNew ? '<span class="badge badge-new" style="margin-left:4px">NEW</span>' : ''}
          </td>
          <td><span class="badge" style="background:${cat.bg};color:${cat.color}">${esc(k.category)}</span></td>
          <td>
            <div class="score-bar-wrap">
              <div class="score-bar"><div class="score-fill" style="width:${k.trendScore}%"></div></div>
              <span class="score-val">${k.trendScore}</span>
            </div>
          </td>
          <td><span class="change-rate ${crClass}">${crText}</span></td>
          <td><span class="action-badge" style="background:${action.bg};color:${action.color}">${esc(k.recommendedAction)}</span></td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm"
                onclick='App.analyzeKeyword(${JSON.stringify(k.keyword)})'>소재분석</button>
              <button class="btn btn-primary btn-sm"
                onclick='App.goScript(${JSON.stringify({ name: k.keyword, category: k.category, features:"", target:"" })})'>대본생성</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function analyzeKeyword(keyword) {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify({
      name: keyword, category: '', features: '', target: '',
      _goAnalysis: true,
    }));
    window.location.href = '/analysis';
  }

  function goScript(prefill) {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify(prefill));
    window.location.href = '/script';
  }

  // ═══════════════════════════════════════════════════════
  // PAGE: Analysis
  // ═══════════════════════════════════════════════════════
  function initAnalysis() {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
      });
    });

    // ─── Text analysis ───
    document.getElementById('ta-analyzeBtn').addEventListener('click', runTextAnalysis);
    document.getElementById('ta-saveBtn').addEventListener('click', saveTextResult);
    document.getElementById('ta-scriptBtn').addEventListener('click', () => {
      const prefill = extractTextPrefill();
      sessionStorage.setItem(PREFILL_KEY, JSON.stringify(prefill));
      window.location.href = '/script';
    });

    // ─── Vision analysis ───
    initDropZone();
    document.getElementById('vision-analyzeBtn').addEventListener('click', runVisionAnalysis);
    document.getElementById('vision-saveBtn').addEventListener('click', saveVisionResult);
    document.getElementById('vision-scriptBtn').addEventListener('click', () => {
      const prefill = extractVisionPrefill();
      sessionStorage.setItem(PREFILL_KEY, JSON.stringify(prefill));
      window.location.href = '/script';
    });
  }

  // Text analysis
  async function runTextAnalysis() {
    const name = document.getElementById('ta-productName').value.trim();
    const cat  = document.getElementById('ta-category').value;
    const desc = document.getElementById('ta-description').value.trim();
    const url  = document.getElementById('ta-url').value.trim();
    if (!name) { toast('제품명을 입력하세요.', 'error'); return; }

    setBtnLoading('ta-analyzeBtn', 'ta-btnText', 'ta-spinner', true);
    hide('ta-guide'); hide('ta-resultCard');

    const prompt = buildAnalysisPrompt(name, cat, desc, url);
    try {
      const data = await post('/api/gemini', { prompt, model: getModel() });
      if (data.error) { toast(data.error, 'error'); }
      else {
        document.getElementById('ta-result').innerHTML = md2html(data.text);
        document.getElementById('ta-resultCard').style.display = '';
        window._taRawResult = data.text;
      }
    } catch { toast('분석 중 오류가 발생했습니다.', 'error'); }
    finally { setBtnLoading('ta-analyzeBtn', 'ta-btnText', 'ta-spinner', false, '🔍 AI 분석 시작'); }
  }

  function buildAnalysisPrompt(name, category, desc, url) {
    return `당신은 한국 쇼핑쇼츠 전문 마케터입니다. 아래 제품을 분석하여 쇼핑쇼츠 기획에 필요한 상세 정보를 제공해 주세요.

## 제품 정보
- **제품명:** ${name}
- **카테고리:** ${category}
- **설명/특징:** ${desc || '(없음)'}
${url ? `- **URL:** ${url}` : ''}

## 분석 요청 항목

### 1. 🔍 제품 식별 및 기본 정보
- **제품명 및 종류:** (정확한 제품명, 용도)
- **주요 소재 / 핵심 스펙:** (소재, 사이즈, 스펙 등)
- **예상 가격대 및 원산지:**

### 2. 💡 핵심 셀링 포인트 Top 3
쇼핑쇼츠에서 강조해야 할 핵심 소구점 3가지를 구체적으로 제시하세요.

### 3. 👥 타겟 고객 분석
- **1순위:** (가장 핵심 타겟, 나이/상황 포함)
- **2순위:** (보조 타겟)
- **구매 동기:**

### 4. 📊 경쟁력 분석
- **차별화 포인트:**
- **경쟁 상품 대비 우위:**
- **주의사항 (약점):**

### 5. 🎬 쇼핑쇼츠 기획안
- **훅 제안 3가지:** (시청자를 멈추게 할 첫 문장)
- **스토리텔링 포인트:**
- **추천 영상 길이:**

분석을 한국어로 상세하게 작성해 주세요.`;
  }

  function saveTextResult() {
    const name = document.getElementById('ta-productName').value.trim() || '제품 분석';
    const cat  = document.getElementById('ta-category').value;
    const raw  = window._taRawResult || '';
    if (!raw) { toast('분석 결과가 없습니다.', 'error'); return; }
    const prefill = extractTextPrefill();
    addProject({
      id: Date.now().toString(), name, category: cat, status: 'draft',
      createdAt: new Date().toISOString(),
      analysisContent: raw,
      formData: prefill,
    });
    toast('프로젝트에 저장되었습니다.', 'success');
  }

  function extractTextPrefill() {
    const raw = window._taRawResult || '';
    return {
      name:     document.getElementById('ta-productName').value.trim(),
      category: document.getElementById('ta-category').value,
      features: extractSection(raw, ['핵심 셀링 포인트', '셀링 포인트', '주요 소재', '핵심 스펙']),
      target:   extractSection(raw, ['1순위', '타겟 고객']),
    };
  }

  // Vision analysis
  let _videoFile = null;
  let _videoFrames = [];

  function initDropZone() {
    const zone  = document.getElementById('dropZone');
    const input = document.getElementById('videoInput');

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('video/')) handleVideoFile(file);
    });
    input.addEventListener('change', () => {
      if (input.files[0]) handleVideoFile(input.files[0]);
    });
  }

  async function handleVideoFile(file) {
    _videoFile = file;
    _videoFrames = [];
    document.getElementById('vision-analyzeBtn').disabled = true;
    hide('framePreview');
    show('frameProgress');
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressText').textContent = '프레임 추출 중...';

    try {
      const frames = await extractVideoFrames(file, 8, (pct) => {
        document.getElementById('progressFill').style.width = pct + '%';
        document.getElementById('progressText').textContent = `프레임 추출 중... ${Math.round(pct)}%`;
      });
      _videoFrames = frames;
      hide('frameProgress');
      renderFramePreview(frames);
      document.getElementById('vision-analyzeBtn').disabled = false;
      toast(`${frames.length}개 프레임 추출 완료`, 'success');
    } catch (e) {
      hide('frameProgress');
      toast('프레임 추출 실패: ' + e.message, 'error');
    }
  }

  async function extractVideoFrames(file, frameCount, onProgress) {
    return new Promise((resolve, reject) => {
      const video  = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx    = canvas.getContext('2d');
      const frames = [];
      let idx = 0;

      video.onloadedmetadata = () => {
        const duration = video.duration;
        if (!duration || duration === Infinity) {
          reject(new Error('영상 길이를 읽을 수 없습니다.')); return;
        }
        const interval = duration / frameCount;
        canvas.width  = 512;
        canvas.height = Math.max(1, Math.round(512 * video.videoHeight / video.videoWidth)) || 288;

        video.onseeked = () => {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL('image/jpeg', 0.72).split(',')[1]);
          if (onProgress) onProgress(((idx) / frameCount) * 100);
          seekNext();
        };
        seekNext();
      };

      function seekNext() {
        if (idx >= frameCount) {
          URL.revokeObjectURL(video.src);
          resolve(frames);
          return;
        }
        video.currentTime = idx * (video.duration / frameCount) + (video.duration / frameCount) * 0.5;
        idx++;
      }

      video.onerror = () => reject(new Error('영상 로드 실패'));
      video.muted   = true;
      video.src     = URL.createObjectURL(file);
    });
  }

  function renderFramePreview(frames) {
    const grid = document.getElementById('framePreview');
    grid.innerHTML = frames.map(f =>
      `<img src="data:image/jpeg;base64,${f}" alt="frame" />`
    ).join('');
    grid.classList.remove('hidden');
  }

  async function runVisionAnalysis() {
    if (!_videoFrames.length) { toast('먼저 영상 파일을 업로드하세요.', 'error'); return; }
    setBtnLoading('vision-analyzeBtn', 'vision-btnText', 'vision-spinner', true);
    hide('vision-guide'); hide('vision-resultCard');

    const prompt = buildVisionPrompt(_videoFile ? _videoFile.name : '영상');
    try {
      const data = await post('/api/gemini-vision', { frames: _videoFrames, prompt, model: getModel() });
      if (data.error) { toast(data.error, 'error'); }
      else {
        document.getElementById('vision-result').innerHTML = md2html(data.text);
        document.getElementById('vision-resultCard').style.display = '';
        window._visionRawResult = data.text;
      }
    } catch { toast('분석 중 오류가 발생했습니다.', 'error'); }
    finally { setBtnLoading('vision-analyzeBtn', 'vision-btnText', 'vision-spinner', false, '⚡ AI 초정밀 분석 시작'); }
  }

  function buildVisionPrompt(filename) {
    return `당신은 한국 쇼핑쇼츠 전문 마케터입니다. 이 영상 프레임들을 분석하여 제품에 대한 초정밀 분석을 해주세요.

## 분석 요청 (파일: ${filename})

### 🔍 제품 식별 및 기본 정보
- **제품명 및 종류:** (영상에서 보이는 제품이 무엇인지 정확히 파악)
- **주요 소재 / 핵심 스펙:** (보이는 소재, 크기, 특이사항)
- **예상 가격대 및 원산지:** (제품 외관으로 추정)

### 💡 핵심 셀링 포인트 Top 3
쇼핑쇼츠에서 강조해야 할 핵심 마케팅 소구점 3가지를 구체적으로 제시하세요.

### 👥 타겟 고객 분석
- **1순위:** (이 제품에 가장 적합한 고객층, 나이/상황/직업 포함)
- **2순위:** (부차적 타겟)
- **구매 동기 및 구매 상황:**

### 📊 경쟁력 및 차별화 분석
- **차별화 포인트:**
- **경쟁 상품 대비 우위:**
- **사용 상황 제안:**

### 🎬 쇼핑쇼츠 기획안
- **훅 제안 3가지:** (시청자를 멈추게 할 첫 마디)
- **스토리텔링 아이디어:**
- **감동/공감 포인트:**
- **추천 영상 길이:**

영상에서 직접 확인되는 정보를 바탕으로 한국어로 상세하게 분석해주세요. 제품명은 한국어로 번역하거나 설명해 주세요.`;
  }

  function saveVisionResult() {
    const raw = window._visionRawResult || '';
    if (!raw) { toast('분석 결과가 없습니다.', 'error'); return; }
    const prefill = extractVisionPrefill();
    addProject({
      id: Date.now().toString(),
      name: prefill.name || '영상 분석',
      category: prefill.category || '기타',
      status: 'draft',
      createdAt: new Date().toISOString(),
      analysisContent: raw,
      formData: prefill,
    });
    toast('프로젝트에 저장되었습니다.', 'success');
  }

  function extractVisionPrefill() {
    const raw = window._visionRawResult || '';
    return {
      name:     extractSection(raw, ['제품명 및 종류', '제품명']),
      category: '기타',
      features: extractSection(raw, ['주요 소재', '핵심 스펙', '핵심 셀링 포인트']),
      target:   extractSection(raw, ['1순위', '타겟 고객']),
    };
  }

  // Extract first matching line from markdown text
  function extractSection(text, keys) {
    for (const key of keys) {
      const re = new RegExp(`\\*\\*${key}[^*]*\\*\\*[:\\s]*([^\\n]+)`, 'i');
      const m  = text.match(re);
      if (m && m[1]) {
        return m[1].replace(/^\*+|\*+$/g,'').replace(/^[-:\s]+/,'').trim();
      }
    }
    return '';
  }

  // ═══════════════════════════════════════════════════════
  // PAGE: Script
  // ═══════════════════════════════════════════════════════
  function initScript() {
    // Load prefill from sessionStorage
    const raw = sessionStorage.getItem(PREFILL_KEY);
    if (raw) {
      try {
        const p = JSON.parse(raw);
        sessionStorage.removeItem(PREFILL_KEY);
        if (p.name)     document.getElementById('sc-productName').value = p.name;
        if (p.category) {
          const sel = document.getElementById('sc-category');
          for (const o of sel.options) if (o.value === p.category) { o.selected = true; break; }
        }
        if (p.features) document.getElementById('sc-features').value = p.features;
        if (p.target)   document.getElementById('sc-target').value   = p.target;
      } catch {}
    }

    document.getElementById('sc-generateBtn').addEventListener('click', generateScript);
    document.getElementById('sc-copyBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(window._scriptRaw || '').then(() => toast('클립보드에 복사됨', 'success'));
    });
    document.getElementById('sc-saveBtn').addEventListener('click', saveScript);
    document.getElementById('sc-regenBtn').addEventListener('click', generateScript);
  }

  async function generateScript() {
    const name     = document.getElementById('sc-productName').value.trim();
    const category = document.getElementById('sc-category').value;
    const features = document.getElementById('sc-features').value.trim();
    const target   = document.getElementById('sc-target').value.trim();
    const duration = document.getElementById('sc-duration').value;
    const tone     = document.getElementById('sc-tone').value;
    const extra    = document.getElementById('sc-extra').value.trim();

    if (!name)     { toast('제품명을 입력하세요.', 'error'); return; }
    if (!features) { toast('주요 특징을 입력하세요.', 'error'); return; }

    setBtnLoading('sc-generateBtn', 'sc-btnText', 'sc-spinner', true);
    hide('sc-guide'); hide('sc-resultCard');

    const prompt = buildScriptPrompt(name, category, features, target, duration, tone, extra);
    try {
      const data = await post('/api/gemini', { prompt, model: getModel() });
      if (data.error) { toast(data.error, 'error'); }
      else {
        window._scriptRaw = data.text;
        renderScript(data.text, duration);
        document.getElementById('sc-resultCard').style.display = '';
      }
    } catch { toast('대본 생성 중 오류가 발생했습니다.', 'error'); }
    finally { setBtnLoading('sc-generateBtn', 'sc-btnText', 'sc-spinner', false, '🚀 대본 생성'); }
  }

  function buildScriptPrompt(name, category, features, target, duration, tone, extra) {
    const toneMap = {
      friendly:     '친근하고 편안한',
      professional: '전문적이고 신뢰감 있는',
      humorous:     '유머러스하고 재치 있는',
      urgent:       '긴박감 있고 행동을 촉구하는',
    };
    const toneDesc = toneMap[tone] || '친근한';

    const sections = {
      15: ['훅', 'CTA'],
      20: ['훅', '제품 핵심', 'CTA'],
      30: ['훅', '문제 제시', '제품 소개', 'CTA'],
      60: ['훅', '문제 제시', '제품 소개', '핵심 포인트', '사용 장면', 'CTA'],
      90: ['훅', '문제 제시', '제품 소개', '핵심 포인트 1', '핵심 포인트 2', '사용 장면', '사용 후기', 'CTA'],
    };
    const secs = sections[duration] || sections[30];

    return `당신은 한국 쇼핑쇼츠 전문 대본 작가입니다.

## 제품 정보
- **제품명:** ${name}
- **카테고리:** ${category}
- **주요 특징:** ${features}
- **타겟 고객:** ${target || '일반 소비자'}
- **영상 길이:** ${duration}초
- **톤 & 스타일:** ${toneDesc}
${extra ? `- **추가 요청:** ${extra}` : ''}

## 대본 구성 (${duration}초 기준)
반드시 아래 섹션으로 나누어 작성하세요. 각 섹션은 **[섹션명]** 형태로 시작하세요.

${secs.map(s => `**[${s}]**\n(${s} 내용을 여기에 작성)`).join('\n\n')}

## 작성 지침
- 각 섹션은 ${duration}초 기준으로 비율에 맞게 분량 조절
- 구어체 사용, 실제로 읽었을 때 자연스럽게
- 이모지 적절히 활용 (훅, CTA에 특히)
- 제품명 반드시 포함
- CTA는 구매 행동 유도 (링크 클릭, 장바구니 등)
- ${toneDesc} 톤 유지

위 구성대로 실제 방송 가능한 대본을 작성해주세요.`;
  }

  function renderScript(text, duration) {
    document.getElementById('sc-rawScript').textContent = text;
    const sections = parseScriptSections(text);
    const wrap = document.getElementById('sc-scriptSections');
    if (sections.length) {
      wrap.innerHTML = sections.map(s => {
        const color = SECTION_COLORS[s.label] || '#a1a1aa';
        return `
          <div class="script-section" style="border-left-color:${color}">
            <div class="script-section-label" style="color:${color}">${esc(s.label)}</div>
            <div class="script-section-text">${esc(s.text)}</div>
          </div>
        `;
      }).join('');
    } else {
      wrap.innerHTML = `<div class="script-section"><div class="script-section-text">${md2html(text)}</div></div>`;
    }
  }

  function parseScriptSections(text) {
    const re = /\*\*\[([^\]]+)\]\*\*/g;
    const matches = [...text.matchAll(re)];
    if (!matches.length) return [];
    const result = [];
    for (let i = 0; i < matches.length; i++) {
      const label = matches[i][1];
      const start = matches[i].index + matches[i][0].length;
      const end   = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const body  = text.slice(start, end).trim();
      result.push({ label, text: body });
    }
    return result;
  }

  function saveScript() {
    const name     = document.getElementById('sc-productName').value.trim() || '대본';
    const category = document.getElementById('sc-category').value;
    const raw      = window._scriptRaw || '';
    if (!raw) { toast('생성된 대본이 없습니다.', 'error'); return; }
    addProject({
      id: Date.now().toString(), name, category, status: 'draft',
      createdAt: new Date().toISOString(),
      scriptContent: raw,
      formData: {
        name, category,
        features: document.getElementById('sc-features').value.trim(),
        target:   document.getElementById('sc-target').value.trim(),
        duration: document.getElementById('sc-duration').value,
        tone:     document.getElementById('sc-tone').value,
      },
    });
    toast('프로젝트에 저장되었습니다.', 'success');
  }

  // ═══════════════════════════════════════════════════════
  // PAGE: Projects
  // ═══════════════════════════════════════════════════════
  let _openProjectId = null;

  function initProjects() {
    renderProjectsTable();

    document.getElementById('projectSearch').addEventListener('input', renderProjectsTable);
    document.getElementById('projectStatusFilter').addEventListener('change', renderProjectsTable);
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    document.getElementById('md-closeBtn').addEventListener('click', closeModal);
    document.getElementById('projectModal').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('md-deleteBtn').addEventListener('click', () => {
      if (!_openProjectId) return;
      if (!confirm('이 프로젝트를 삭제하시겠습니까?')) return;
      deleteProject(_openProjectId);
      closeModal();
      renderProjectsTable();
      toast('프로젝트가 삭제되었습니다.', 'success');
    });
    document.getElementById('md-scriptBtn').addEventListener('click', () => {
      if (!_openProjectId) return;
      const p = getProjects().find(x => x.id === _openProjectId);
      if (!p) return;
      const prefill = {
        name:     p.formData?.name || p.name || '',
        category: p.formData?.category || p.category || '',
        features: p.formData?.features || extractSection(p.analysisContent || '', ['핵심 셀링 포인트','주요 소재','핵심 스펙']),
        target:   p.formData?.target   || extractSection(p.analysisContent || '', ['1순위','타겟 고객']),
      };
      sessionStorage.setItem(PREFILL_KEY, JSON.stringify(prefill));
      window.location.href = '/script';
    });
    document.getElementById('md-statusSaveBtn').addEventListener('click', () => {
      if (!_openProjectId) return;
      const status = document.getElementById('md-statusSelect').value;
      updateProject(_openProjectId, { status });
      renderProjectsTable();
      toast('상태가 저장되었습니다.', 'success');
    });
  }

  function renderProjectsTable() {
    const query  = document.getElementById('projectSearch').value.toLowerCase();
    const filter = document.getElementById('projectStatusFilter').value;
    let list     = getProjects();

    if (query)          list = list.filter(p => (p.name||'').toLowerCase().includes(query) || (p.category||'').toLowerCase().includes(query));
    if (filter !== 'all') list = list.filter(p => (p.status||'draft') === filter);

    const count = document.getElementById('projectCount');
    count.textContent = `총 ${list.length}개 프로젝트`;

    const tbody = document.getElementById('projectsTbody');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-row">프로젝트가 없습니다.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(p => `
      <tr style="cursor:pointer" onclick="App.openProject('${esc(p.id)}')">
        <td><strong>${esc(p.name||'(제목 없음)')}</strong></td>
        <td>${esc(p.category||'-')}</td>
        <td>${fmtDate(p.createdAt)}</td>
        <td>${statusBadge(p.status||'draft')}</td>
        <td onclick="event.stopPropagation()">
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm" onclick="App.openProject('${esc(p.id)}')">상세</button>
            <button class="btn btn-primary btn-sm" onclick="App.goScriptFromProject('${esc(p.id)}')">✍️ 대본</button>
            <button class="btn btn-danger btn-sm" onclick="App.deleteFromTable('${esc(p.id)}')">삭제</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function openProject(id) {
    const p = getProjects().find(x => x.id === id);
    if (!p) return;
    _openProjectId = id;

    document.getElementById('modal-title').textContent   = p.name || '(제목 없음)';
    document.getElementById('md-productName').textContent = p.formData?.name || p.name || '-';
    document.getElementById('md-category').textContent    = p.category || '-';
    document.getElementById('md-target').textContent      = p.formData?.target || extractSection(p.analysisContent||'',['1순위','타겟 고객']) || '-';
    document.getElementById('md-features').textContent    = p.formData?.features || '-';
    document.getElementById('md-status').innerHTML        = statusBadge(p.status||'draft');
    document.getElementById('md-date').textContent        = fmtDate(p.createdAt);
    document.getElementById('md-statusSelect').value      = p.status || 'draft';

    const aSection = document.getElementById('md-analysisSection');
    if (p.analysisContent) {
      aSection.style.display = '';
      document.getElementById('md-analysis').innerHTML = md2html(p.analysisContent);
    } else { aSection.style.display = 'none'; }

    const sSection = document.getElementById('md-scriptSection');
    if (p.scriptContent) {
      sSection.style.display = '';
      document.getElementById('md-script').textContent = p.scriptContent;
    } else { sSection.style.display = 'none'; }

    document.getElementById('projectModal').style.display = 'flex';
  }

  function closeModal() {
    document.getElementById('projectModal').style.display = 'none';
    _openProjectId = null;
  }

  function goScriptFromProject(id) {
    const p = getProjects().find(x => x.id === id);
    if (!p) return;
    const prefill = {
      name:     p.formData?.name || p.name || '',
      category: p.formData?.category || p.category || '',
      features: p.formData?.features || extractSection(p.analysisContent||'',['핵심 셀링 포인트','주요 소재','핵심 스펙']),
      target:   p.formData?.target   || extractSection(p.analysisContent||'',['1순위','타겟 고객']),
    };
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify(prefill));
    window.location.href = '/script';
  }

  function deleteFromTable(id) {
    if (!confirm('삭제하시겠습니까?')) return;
    deleteProject(id);
    renderProjectsTable();
    toast('삭제되었습니다.', 'success');
  }

  // ═══════════════════════════════════════════════════════
  // PAGE: Settings
  // ═══════════════════════════════════════════════════════
  function initSettings() {
    loadApiStatus();

    // Load saved model
    const modelSel = document.getElementById('geminiModel');
    if (modelSel) modelSel.value = getModel();
  }

  async function loadApiStatus() {
    try {
      const s = await get('/api/settings/status');
      setBadge('badge-gemini',     s.geminiApiKey);
      setBadge('badge-youtube',    s.youtubeApiKey);
      setBadge('badge-naverId',    s.naverClientId);
      setBadge('badge-naverSecret',s.naverClientSecret);
    } catch { toast('상태 조회 실패', 'error'); }
  }

  function setBadge(id, saved) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = saved ? '● 저장됨' : '● 미설정';
    el.className = 'status-badge ' + (saved ? 'saved' : '');
  }

  async function saveKey(keyName, inputId, badgeId) {
    const val = document.getElementById(inputId).value.trim();
    if (!val) { toast('키 값을 입력하세요.', 'error'); return; }
    try {
      const data = await post('/api/settings/save', { [keyName]: val });
      if (data.ok) {
        document.getElementById(inputId).value = '';
        setBadge(badgeId, true);
        toast('저장되었습니다.', 'success');
      }
    } catch { toast('저장 실패', 'error'); }
  }

  async function saveNaverKeys() {
    const id  = document.getElementById('key-naverId').value.trim();
    const sec = document.getElementById('key-naverSecret').value.trim();
    if (!id || !sec) { toast('Client ID와 Secret을 모두 입력하세요.', 'error'); return; }
    try {
      const data = await post('/api/settings/save', { naverClientId: id, naverClientSecret: sec });
      if (data.ok) {
        document.getElementById('key-naverId').value   = '';
        document.getElementById('key-naverSecret').value = '';
        setBadge('badge-naverId',     true);
        setBadge('badge-naverSecret', true);
        toast('Naver 키가 저장되었습니다.', 'success');
      }
    } catch { toast('저장 실패', 'error'); }
  }

  async function testGemini() {
    const key = document.getElementById('key-gemini').value.trim();
    if (key) await saveKey('geminiApiKey', 'key-gemini', 'badge-gemini');
    try {
      toast('Gemini 연결 테스트 중...', 'info');
      const data = await post('/api/gemini', { prompt: '안녕하세요. 한 문장으로 답해주세요.', model: getModel() });
      if (data.error) toast('❌ ' + data.error, 'error');
      else toast('✅ Gemini 연결 성공!', 'success');
    } catch { toast('연결 실패', 'error'); }
  }

  function saveModel() {
    const sel = document.getElementById('geminiModel');
    if (!sel) return;
    localStorage.setItem(MODEL_KEY, sel.value);
    toast('모델 설정이 저장되었습니다.', 'success');
  }

  function exportProjects() {
    const data = JSON.stringify(getProjects(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `shortshelper-projects-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearProjects() {
    if (!confirm('모든 프로젝트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    localStorage.removeItem(PROJECTS_KEY);
    toast('모든 프로젝트가 삭제되었습니다.', 'success');
  }

  // ─── UI utilities ──────────────────────────────────────
  function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
  function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

  function setBtnLoading(btnId, textId, spinnerId, loading, resetText) {
    const btn     = document.getElementById(btnId);
    const textEl  = document.getElementById(textId);
    const spinner = document.getElementById(spinnerId);
    if (!btn) return;
    btn.disabled = loading;
    if (textEl)  textEl.textContent = loading ? '처리 중...' : (resetText || textEl.textContent);
    if (spinner) spinner.classList.toggle('hidden', !loading);
  }

  function esc(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ─── Init router ───────────────────────────────────────
  function init() {
    initSidebar();
    checkApiStatus();
    const page = document.body.dataset.page;
    if      (page === 'dashboard') initDashboard();
    else if (page === 'explore')   initExplore();
    else if (page === 'analysis')  initAnalysis();
    else if (page === 'script')    initScript();
    else if (page === 'projects')  initProjects();
    else if (page === 'settings')  initSettings();
  }

  // ─── Public API ────────────────────────────────────────
  return {
    init,
    // exposed for inline onclick handlers
    saveKey, saveNaverKeys, testGemini, saveModel,
    exportProjects, clearProjects,
    goScript, analyzeKeyword,
    openProject, goScriptFromProject, deleteFromTable,
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
