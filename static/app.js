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
    return localStorage.getItem(MODEL_KEY) || 'gemini-3.5-flash';
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

  // ─── File export helper ────────────────────────────────
  function exportTextFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`"${filename}" 저장 완료`, 'success');
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
    show('videoResults');
    if (!data.items || !data.items.length) {
      grid.innerHTML = '<p style="color:var(--text-3);padding:20px">조건에 맞는 영상이 없습니다.</p>';
      return;
    }
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
            onclick='App.goScript(${JSON.stringify({ name: "", category:"기타", features:"", target:"", videoTitle: v.title })})'>✍️ 대본</button>
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
    document.getElementById('vision-exportBtn').addEventListener('click', () => {
      const raw = window._visionRawResult || '';
      if (!raw) { toast('저장할 분석 결과가 없습니다.', 'error'); return; }
      exportTextFile(raw, '분석결과.txt');
    });
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
        renderAnalysisResult(data.text, 'ta-result');
        show('ta-resultCard');
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
    const raw  = window._taRawResult || '';
    if (!raw) { toast('분석 결과가 없습니다.', 'error'); return; }
    const prefill = extractTextPrefill();
    const name = prefill.name || document.getElementById('ta-productName').value.trim() || '제품 분석';
    const cat  = document.getElementById('ta-category').value;
    addProject({
      id: Date.now().toString(), name, category: cat, status: 'draft',
      createdAt: new Date().toISOString(),
      analysisContent: raw,
      formData: prefill,
    });
    toast(`"${name}" 프로젝트에 저장되었습니다.`, 'success');
  }

  function extractTextPrefill() {
    const raw = window._taRawResult || '';
    const category = document.getElementById('ta-category').value;
    return {
      name:     document.getElementById('ta-productName').value.trim()
                || simplifyProductName(extractField(raw, ['제품명 및 종류', '제품명'])),
      category,
      features: buildFeaturesFromAnalysis(raw),
      target:   buildTargetFromAnalysis(raw) || buildDefaultTarget(category),
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
        renderAnalysisResult(data.text, 'vision-result');
        show('vision-resultCard');
        window._visionRawResult = data.text;
      }
    } catch { toast('분석 중 오류가 발생했습니다.', 'error'); }
    finally { setBtnLoading('vision-analyzeBtn', 'vision-btnText', 'vision-spinner', false, '⚡ AI 초정밀 분석 시작'); }
  }

  function buildVisionPrompt(filename) {
    return `당신은 한국 쇼핑쇼츠 전문 마케터입니다. 이 영상 프레임들을 분석하여 제품에 대한 초정밀 분석을 해주세요.

## 분석 요청 (파일: ${filename})

### 🔍 제품 식별 및 기본 정보
- **제품명 및 종류:** (영상에서 보이는 제품이 무엇인지 정확히 파악, 한국어로 설명)
- **주요 소재 / 핵심 스펙:** (보이는 소재, 크기, 특이사항)
- **예상 가격대 및 원산지:** (제품 외관으로 추정)
- **영상 속 텍스트 번역 및 활용:** (화면에 보이는 외국어 텍스트가 있다면 원문과 한국어 번역을 제공하고, 각 문구를 한국 쇼핑쇼츠 마케팅 문구로 어떻게 활용할 수 있는지 제안)
  - 예시 형식: \`원문\` (발음): "한국어 번역" → **마케팅 활용**: "한국 쇼핑쇼츠 멘트 제안"

### 💡 핵심 셀링 포인트 Top 3
쇼핑쇼츠에서 강조해야 할 핵심 마케팅 소구점 3가지를 구체적으로 제시하세요.

### 👥 타겟 고객 분석
- **1순위 타겟:** (이 제품에 가장 적합한 고객층, 나이/상황/직업 포함)
- **2순위 타겟:** (부차적 타겟)
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
    // Use AI-extracted name; never use raw video filename as project name
    const name = prefill.name || '영상 분석 - ' + new Date().toLocaleDateString('ko-KR');
    addProject({
      id: Date.now().toString(),
      name,
      category: prefill.category || '기타',
      status: 'draft',
      createdAt: new Date().toISOString(),
      analysisContent: raw,
      formData: prefill,
    });
    toast(`"${name}" 프로젝트에 저장되었습니다.`, 'success');
  }

  function extractVisionPrefill() {
    const raw = window._visionRawResult || '';
    const category = extractCategoryFromText(raw) || '기타';
    return {
      name:       simplifyProductName(extractField(raw, ['제품명 및 종류', '제품명'])),
      category,
      features:   buildFeaturesFromAnalysis(raw),
      target:     buildTargetFromAnalysis(raw) || buildDefaultTarget(category),
      priceRange: extractField(raw, ['예상 가격대', '가격대', '가격']),
    };
  }

  function extractCategoryFromText(text) {
    const cats = ['생활용품','주방용품','인테리어','뷰티','건강','육아','디지털'];
    for (const c of cats) if (text.includes(c)) return c;
    return '';
  }

  // Detect video filenames like "1762228456435_Video3" or "abc_video1"
  function isFilenameLike(str) {
    if (!str) return false;
    return /^\d{8,}/.test(str) || /^\d+[_-]\w/.test(str) || /[Vv]ideo\d+$/i.test(str);
  }

  // Default target by category when AI extraction fails
  function buildDefaultTarget(category) {
    const map = {
      '생활용품': '20-40대 주부 및 1인 가구',
      '주방용품': '요리를 즐기는 20-40대 주부',
      '인테리어': '인테리어에 관심 있는 20-30대 직장인',
      '뷰티':     '피부 관리에 관심 있는 20-30대 여성',
      '건강':     '건강 관리에 관심 있는 30-50대',
      '육아':     '영유아 자녀를 둔 30-40대 부모',
      '디지털':   'IT 기기에 관심 있는 20-40대',
    };
    return map[category] || '20-40대 온라인 쇼핑 이용자';
  }

  // ─── Analysis result helpers ───────────────────────────
  function escRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Shorten overly long product names: remove parentheticals, keep last 3 words if 5+ words
  function simplifyProductName(str) {
    if (!str) return str;
    // Strip markdown bold
    let s = str.replace(/\*+/g, '').trim();
    // Handle slash-separated names: simplify each part
    if (s.includes('/')) {
      return s.split('/').map(p => _shortenNamePart(p.trim())).filter(Boolean).join(' / ');
    }
    return _shortenNamePart(s);
  }

  function _shortenNamePart(s) {
    // Remove parenthetical explanations e.g. "(싱크대 다용도 배수 바스켓)"
    s = s.replace(/[（(][^)）]{2,}[)）]/g, '').trim();
    s = s.replace(/[,、·]+$/, '').trim();
    const words = s.split(/\s+/).filter(Boolean);
    // 5+ words: take the last 3 as the core product name
    if (words.length >= 5) return words.slice(-3).join(' ');
    return s;
  }

  // Robust field extractor — handles **key:** value, plain key: value, AND markdown table | key | value |
  function extractField(text, keys) {
    for (const key of keys) {
      const k = escRegex(key);
      const patterns = [
        // markdown table: | **key** | **value** | (bold inside cells) OR | key | value |
        new RegExp(`[|]\\s*[*]{0,2}\\s*${k}\\s*[*]{0,2}\\s*[|]\\s*[*]{0,2}\\s*([^|*\\n]+?)\\s*[*]{0,2}\\s*[|]`, 'i'),
        // **key:** value — colon INSIDE bold closing (most common Gemini format: **제품명:** 값)
        new RegExp(`\\*\\*${k}[^*]*[：:]\\*\\*\\s*([^\\n]+)`, 'i'),
        // **key** : value — colon OUTSIDE bold
        new RegExp(`\\*\\*${k}[^*]*\\*\\*\\s*[：:]\\s*([^\\n]+)`, 'i'),
        // plain: - key: value  (also handles "1순위 타겟: value" where key has trailing words)
        new RegExp(`(?:^|\\n)[\\-*\\s]*${k}[^：:\\n]*[：:]\\s*([^\\n]+)`, 'im'),
      ];
      for (const re of patterns) {
        const m = text.match(re);
        if (m && m[1]) {
          const val = m[1].replace(/\*+/g, '').replace(/^[-：:\s]+/, '').trim();
          if (val && val.length > 1 && !val.startsWith('(없음') && !val.startsWith('없음')) return val;
        }
      }
    }
    return '';
  }

  // Legacy alias (used in script-from-project extraction)
  function extractSection(text, keys) { return extractField(text, keys); }

  // Parse ### / ## sections from Gemini markdown response
  function parseSections(text) {
    const re = /^#{2,3}\s+(.+)$/gm;
    const matches = [...text.matchAll(re)];
    if (!matches.length) return [{ title: '분석 결과', body: text }];
    const sections = [];
    for (let i = 0; i < matches.length; i++) {
      const title = matches[i][1].trim();
      const start = matches[i].index + matches[i][0].length;
      const end   = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const body  = text.slice(start, end).trim();
      if (body) sections.push({ title, body });
    }
    return sections;
  }

  // Extract FULL text of a section by keyword (for multi-line fields like features)
  function extractSectionContent(text, titleKeywords, maxLines = 6) {
    const sections = parseSections(text);
    for (const kw of titleKeywords) {
      const sec = sections.find(s => s.title.includes(kw));
      if (!sec || !sec.body.trim()) continue;
      const lines = sec.body.split('\n')
        .map(l => l
          .replace(/\*\*([^*]+?)\*\*/g, '$1')   // remove bold
          .replace(/\*([^*]+?)\*/g, '$1')         // remove italic
          .replace(/^\s*[-*•]\s*/, '')             // remove bullet
          .trim()
        )
        .filter(l => l.length > 2 && !l.startsWith('#') && !l.startsWith('('));
      if (lines.length > 0) return lines.slice(0, maxLines).join('\n');
    }
    return '';
  }

  // Build comprehensive features string from analysis
  function buildFeaturesFromAnalysis(text) {
    // Priority 1: 핵심 셀링 포인트 / 소구점 section
    const selling = extractSectionContent(text, ['핵심 셀링 포인트', '셀링 포인트', '소구점'], 5);
    if (selling) return selling;
    // Priority 2: 경쟁력 분석 section
    const comp = extractSectionContent(text, ['경쟁력', '차별화'], 4);
    if (comp) return comp;
    // Priority 3: single field extraction
    return extractField(text, ['주요 소재', '핵심 스펙', '핵심 소구점']);
  }

  // Build clean target string from analysis
  function buildTargetFromAnalysis(text) {
    if (!text) return '';
    // Try multiple "1순위" key variants (Gemini uses different formats)
    const t1 = extractField(text, ['1순위 타겟 고객', '1순위 타겟', '1순위', '주요 타겟', '핵심 타겟']);
    if (t1) return t1;
    // Fallback: first 2 lines of target section
    const sec = extractSectionContent(text, ['타겟 고객', '타겟 분석', '고객 분석', '타겟'], 2);
    if (sec) return sec.split('\n').slice(0, 1).join('').trim();
    return '';
  }

  // Render structured analysis: summary bar + section cards
  function renderAnalysisResult(text, containerId) {
    const el = document.getElementById(containerId);
    if (!el || !text) return;

    const productName = simplifyProductName(extractField(text, ['제품명 및 종류', '제품명']));
    const priceRange  = extractField(text, ['예상 가격대', '가격대', '가격']);
    const target1     = extractField(text, ['1순위']);
    const spec        = extractField(text, ['핵심 스펙', '주요 소재']);

    let html = '';

    // ─ Summary bar
    if (productName || priceRange || target1) {
      html += '<div class="analysis-summary">';
      if (productName) html += `<div class="sum-row"><span class="sum-label">🏷️ 제품명</span><span class="sum-val">${esc(productName)}</span></div>`;
      if (priceRange)  html += `<div class="sum-row"><span class="sum-label">💰 가격대</span><span class="sum-val">${esc(priceRange)}</span></div>`;
      if (target1)     html += `<div class="sum-row"><span class="sum-label">👥 주요 타겟</span><span class="sum-val">${esc(target1)}</span></div>`;
      if (spec)        html += `<div class="sum-row"><span class="sum-label">⚙️ 핵심 스펙</span><span class="sum-val">${esc(spec)}</span></div>`;
      html += '</div>';
    }

    // ─ Section cards
    parseSections(text).forEach(s => {
      html += `<div class="analysis-sec">
        <div class="analysis-sec-title">${esc(s.title)}</div>
        <div class="analysis-sec-body">${md2html(s.body)}</div>
      </div>`;
    });

    el.innerHTML = html || md2html(text);
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

        let filled = [];

        if (p.name) {
          document.getElementById('sc-productName').value = p.name;
          filled.push('제품명');
        }
        if (p.category) {
          const sel = document.getElementById('sc-category');
          for (const o of sel.options) {
            if (o.value === p.category) { o.selected = true; break; }
          }
        }
        if (p.features) {
          document.getElementById('sc-features').value = p.features;
          filled.push('주요 특징');
        }
        if (p.target) {
          document.getElementById('sc-target').value = p.target;
          filled.push('타겟 고객');
        }

        if (filled.length) {
          // 시각적 하이라이트
          ['sc-productName','sc-features','sc-target'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.value) {
              el.style.borderColor = 'var(--accent)';
              el.style.background  = 'rgba(124,58,237,.06)';
              setTimeout(() => {
                el.style.borderColor = '';
                el.style.background  = '';
              }, 2500);
            }
          });
          toast(`분석 결과에서 자동 입력: ${filled.join(', ')}`, 'success');
        }
      } catch {}
    }

    document.getElementById('sc-generateBtn').addEventListener('click', generateScript);
    document.getElementById('sc-copyBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(window._scriptRaw || '').then(() => toast('클립보드에 복사됨', 'success'));
    });
    document.getElementById('sc-saveBtn').addEventListener('click', saveScript);
    document.getElementById('sc-regenBtn').addEventListener('click', generateScript);
    initTTSListeners();
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
        show('sc-resultCard');
        // TTS 카드 표시 및 텍스트 채우기
        initTTSCard(data.text);
      }
    } catch { toast('대본 생성 중 오류가 발생했습니다.', 'error'); }
    finally { setBtnLoading('sc-generateBtn', 'sc-btnText', 'sc-spinner', false, '🚀 대본 생성'); }
  }

  // ═══════════════════════════════════════════════════════
  // TTS — Text-to-Speech
  // ═══════════════════════════════════════════════════════

  function initTTSCard(scriptText) {
    // Fill textarea with plain script text (strip markdown)
    const plain = (scriptText || '')
      .replace(/#{1,3}\s*/g, '')
      .replace(/\*\*/g, '')
      .replace(/^\s*[-*]\s+/gm, '')
      .trim();
    const ta = document.getElementById('tts-text');
    if (ta && !ta.value) ta.value = plain;
    show('tts-card');
    loadTTSPresets();
  }

  async function loadTTSVoices() {
    const provider = document.getElementById('tts-provider').value;
    const btn = document.getElementById('tts-loadVoicesBtn');
    const sel = document.getElementById('tts-voice');
    btn.disabled = true; btn.textContent = '로딩 중...';
    try {
      const data = await get('/api/tts/voices', { provider });
      if (data.error) { toast(data.error, 'error'); return; }
      sel.innerHTML = '<option value="">-- 음성 선택 --</option>';
      data.forEach(v => {
        const o = document.createElement('option');
        o.value = v.id;
        o.textContent = v.name + (v.labels?.gender ? ` (${v.labels.gender})` : '');
        sel.appendChild(o);
      });
      toast(`${data.length}개 음성 로드됨`, 'success');
    } catch { toast('음성 목록 로드 실패', 'error'); }
    finally { btn.disabled = false; btn.textContent = '📋 음성 목록 불러오기'; }
  }

  async function loadTTSPresets() {
    try {
      const presets = await get('/api/tts/presets');
      const sel = document.getElementById('tts-presetSelect');
      sel.innerHTML = '<option value="">-- 프리셋 선택 --</option>';
      presets.forEach(p => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = `${p.name} (${p.provider})`;
        o.dataset.preset = JSON.stringify(p);
        sel.appendChild(o);
      });
    } catch { /* silent */ }
  }

  function applyTTSPreset(preset) {
    const p = typeof preset === 'string' ? JSON.parse(preset) : preset;
    if (!p) return;
    const setV = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setC = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
    setV('tts-provider', p.provider);
    toggleTTSProviderOptions(p.provider);
    setV('tts-voice', p.voice_id);
    setV('tts-rate', p.speaking_rate ?? 1.0);
    setV('tts-pitch', p.pitch ?? 0.0);
    setV('tts-stability', p.stability ?? 0.5);
    setV('tts-similarity', p.similarity_boost ?? 0.75);
    setV('tts-style', p.style ?? 0.0);
    setC('tts-speakerBoost', p.speaker_boost ?? true);
    updateTTSRangeLabels();
  }

  async function saveTTSPreset() {
    const pname = document.getElementById('tts-presetName').value.trim();
    if (!pname) { toast('프리셋 이름을 입력하세요.', 'error'); return; }
    const body = {
      name:             pname,
      provider:         document.getElementById('tts-provider').value,
      voice_id:         document.getElementById('tts-voice').value,
      voice_name:       document.getElementById('tts-voice').selectedOptions[0]?.textContent || '',
      speaking_rate:    parseFloat(document.getElementById('tts-rate').value),
      pitch:            parseFloat(document.getElementById('tts-pitch').value),
      stability:        parseFloat(document.getElementById('tts-stability').value),
      similarity_boost: parseFloat(document.getElementById('tts-similarity').value),
      style:            parseFloat(document.getElementById('tts-style').value),
      speaker_boost:    document.getElementById('tts-speakerBoost').checked,
    };
    try {
      await post('/api/tts/presets/save', body);
      toast(`"${pname}" 프리셋 저장됨`, 'success');
      document.getElementById('tts-presetName').value = '';
      loadTTSPresets();
    } catch { toast('프리셋 저장 실패', 'error'); }
  }

  async function deleteTTSPreset() {
    const sel = document.getElementById('tts-presetSelect');
    const id  = sel.value;
    if (!id) { toast('삭제할 프리셋을 선택하세요.', 'error'); return; }
    if (!confirm('이 프리셋을 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/tts/presets/${id}`, { method: 'DELETE' });
      toast('프리셋 삭제됨', 'success');
      loadTTSPresets();
    } catch { toast('삭제 실패', 'error'); }
  }

  async function generateTTS() {
    const text = document.getElementById('tts-text').value.trim();
    if (!text) { toast('변환할 텍스트를 입력하세요.', 'error'); return; }
    setBtnLoading('tts-generateBtn', 'tts-btnText', 'tts-spinner', true);
    hide('tts-playerArea');
    const body = {
      text,
      provider:         document.getElementById('tts-provider').value,
      voice_id:         document.getElementById('tts-voice').value,
      speaking_rate:    parseFloat(document.getElementById('tts-rate').value),
      pitch:            parseFloat(document.getElementById('tts-pitch').value),
      stability:        parseFloat(document.getElementById('tts-stability').value),
      similarity_boost: parseFloat(document.getElementById('tts-similarity').value),
      style:            parseFloat(document.getElementById('tts-style').value),
      speaker_boost:    document.getElementById('tts-speakerBoost').checked,
    };
    try {
      const data = await post('/api/tts', body);
      if (data.error) { toast(data.error, 'error'); return; }
      const audio = document.getElementById('tts-audio');
      const dl    = document.getElementById('tts-downloadLink');
      audio.src = data.url + '?t=' + Date.now();
      dl.href   = data.url;
      dl.download = data.file;
      show('tts-playerArea');
      audio.play().catch(() => {});
      toast('MP3 생성 완료!', 'success');
    } catch { toast('TTS 생성 중 오류 발생', 'error'); }
    finally { setBtnLoading('tts-generateBtn', 'tts-btnText', 'tts-spinner', false, '🎙️ MP3 생성'); }
  }

  function toggleTTSProviderOptions(provider) {
    if (provider === 'google') {
      document.getElementById('tts-elOptions').classList.add('hidden');
      document.getElementById('tts-googleOptions').classList.remove('hidden');
    } else {
      document.getElementById('tts-elOptions').classList.remove('hidden');
      document.getElementById('tts-googleOptions').classList.add('hidden');
    }
  }

  function updateTTSRangeLabels() {
    const map = [
      ['tts-rate',       'tts-rateVal',       v => v + 'x'],
      ['tts-stability',  'tts-stabilityVal',  v => parseFloat(v).toFixed(2)],
      ['tts-similarity', 'tts-similarityVal', v => parseFloat(v).toFixed(2)],
      ['tts-style',      'tts-styleVal',      v => parseFloat(v).toFixed(2)],
      ['tts-pitch',      'tts-pitchVal',      v => parseFloat(v).toFixed(1)],
    ];
    map.forEach(([inputId, labelId, fmt]) => {
      const inp = document.getElementById(inputId);
      const lbl = document.getElementById(labelId);
      if (inp && lbl) lbl.textContent = fmt(inp.value);
    });
  }

  function initTTSListeners() {
    const rangeIds = ['tts-rate','tts-stability','tts-similarity','tts-style','tts-pitch'];
    rangeIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateTTSRangeLabels);
    });
    document.getElementById('tts-provider').addEventListener('change', e => {
      toggleTTSProviderOptions(e.target.value);
    });
    document.getElementById('tts-loadVoicesBtn').addEventListener('click', loadTTSVoices);
    document.getElementById('tts-savePresetBtn').addEventListener('click', saveTTSPreset);
    document.getElementById('tts-deletePresetBtn').addEventListener('click', deleteTTSPreset);
    document.getElementById('tts-generateBtn').addEventListener('click', generateTTS);
    document.getElementById('tts-presetSelect').addEventListener('change', e => {
      const opt = e.target.selectedOptions[0];
      if (opt && opt.dataset.preset) applyTTSPreset(opt.dataset.preset);
    });
    updateTTSRangeLabels();
  }

  // ═══════════════════════════════════════════════════════
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
    document.getElementById('md-exportBtn').addEventListener('click', () => {
      if (!_openProjectId) return;
      const p = getProjects().find(x => x.id === _openProjectId);
      if (!p || !p.analysisContent) { toast('저장할 분석 결과가 없습니다.', 'error'); return; }
      const fname = (p.name ? p.name.replace(/[\\/:*?"<>|]/g, '_') : '분석결과') + '.txt';
      exportTextFile(p.analysisContent, fname);
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
      const analysis = p.analysisContent || '';
      const category = p.formData?.category || p.category || '';

      const aiName =
        simplifyProductName(extractField(analysis, ['제품명 및 종류','제품명'])) ||
        (!isFilenameLike(p.formData?.name) ? p.formData?.name : '') ||
        (!isFilenameLike(p.name) ? p.name : '');

      const aiTarget =
        buildTargetFromAnalysis(analysis) ||   // always re-extract from raw content first
        buildDefaultTarget(category);

      const prefill = {
        name:     aiName || '',
        category,
        features: p.formData?.features || buildFeaturesFromAnalysis(analysis),
        target:   aiTarget,
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
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">프로젝트가 없습니다.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(p => {
      const badges = [];
      if (p.analysisContent) badges.push('<span class="badge badge-active" style="font-size:10px;padding:1px 6px">📊 분석</span>');
      if (p.scriptContent)   badges.push('<span class="badge badge-completed" style="font-size:10px;padding:1px 6px">✍️ 대본</span>');
      return `
      <tr style="cursor:pointer" onclick="App.openProject('${esc(p.id)}')">
        <td>
          <div><strong>${esc(p.name||'(제목 없음)')}</strong></div>
          ${badges.length ? `<div style="display:flex;gap:4px;margin-top:4px">${badges.join('')}</div>` : ''}
        </td>
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
      </tr>`;
    }).join('');
  }

  function openProject(id) {
    const p = getProjects().find(x => x.id === id);
    if (!p) return;
    _openProjectId = id;

    document.getElementById('modal-title').textContent   = p.name || '(제목 없음)';
    document.getElementById('md-productName').textContent = p.formData?.name || simplifyProductName(extractField(p.analysisContent||'', ['제품명 및 종류','제품명'])) || (!isFilenameLike(p.name) ? p.name : '') || '-';
    document.getElementById('md-category').textContent    = p.category || '-';
    document.getElementById('md-target').textContent      = p.formData?.target || extractField(p.analysisContent||'',['1순위','타겟 고객','주요 타겟']) || '-';
    document.getElementById('md-features').textContent    = p.formData?.features || extractField(p.analysisContent||'',['핵심 셀링 포인트','소구점','핵심 스펙','주요 소재']) || '-';
    document.getElementById('md-status').innerHTML        = statusBadge(p.status||'draft');
    document.getElementById('md-date').textContent        = fmtDate(p.createdAt);
    document.getElementById('md-statusSelect').value      = p.status || 'draft';

    const aSection = document.getElementById('md-analysisSection');
    if (p.analysisContent) {
      aSection.style.removeProperty('display');
      aSection.classList.remove('hidden');
      renderAnalysisResult(p.analysisContent, 'md-analysis');
    } else {
      aSection.style.display = 'none';
    }

    const sSection = document.getElementById('md-scriptSection');
    if (p.scriptContent) {
      sSection.style.removeProperty('display');
      sSection.classList.remove('hidden');
      document.getElementById('md-script').textContent = p.scriptContent;
    } else {
      sSection.style.display = 'none';
    }

    const modal = document.getElementById('projectModal');
    modal.style.removeProperty('display');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }

  function closeModal() {
    document.getElementById('projectModal').style.display = 'none';
    _openProjectId = null;
  }

  function goScriptFromProject(id) {
    const p = getProjects().find(x => x.id === id);
    if (!p) return;
    const analysis = p.analysisContent || '';
    const category = p.formData?.category || p.category || '';

    // AI extraction first; reject filename-like fallbacks
    const aiName =
      simplifyProductName(extractField(analysis, ['제품명 및 종류','제품명'])) ||
      (!isFilenameLike(p.formData?.name) ? p.formData?.name : '') ||
      (!isFilenameLike(p.name) ? p.name : '');

    const aiTarget =
      buildTargetFromAnalysis(analysis) ||   // always re-extract from raw content first
      buildDefaultTarget(category);

    const prefill = {
      name:     aiName || '',
      category,
      features: p.formData?.features || buildFeaturesFromAnalysis(analysis),
      target:   aiTarget,
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
  function show(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    el.style.removeProperty('display'); // inline style="display:none" 도 제거
  }
  function hide(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('hidden');
  }

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
