/* ═══════════════════════════════════════════════════════
   ShortsHelper — app.js
   FastAPI + Vanilla JS  (v2.0)
═══════════════════════════════════════════════════════ */

const App = (() => {
  // ─── Constants ────────────────────────────────────────
  const PROJECTS_KEY = 'sh_projects';
  const PREFILL_KEY  = 'sh_prefill';
  const MODEL_KEY    = 'sh_model';
  const GOOGLE_VOICE_KEY = 'sh_google_voice';
  const DEFAULT_GOOGLE_VOICE = 'ko-KR-Chirp3-HD-Despina';
  const PRON_KEY     = 'sh_pronunciation';
  const FREE_MODELS  = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.1-flash-lite'];

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

  // ─── Project storage (server: data/projects.json) ───────
  let _projectsCache = null;

  function normalizeMaterial(m) {
    return {
      id: m.id,
      source: m.source || '',
      product_name: m.product_name || '',
      category: m.category || '',
      features: m.features || [],
      hook: m.hook || '',
      cta: m.cta || '',
      image_url: m.image_url || '',
      video_url: m.video_url || '',
      memo: m.memo || '',
      created_at: m.created_at || '',
    };
  }

  function normalizeProject(p) {
    return {
      id: p.id,
      name: p.name || '',
      category: p.category || '',
      status: p.status || 'draft',
      createdAt: p.created_at || p.createdAt || '',
      updatedAt: p.updated_at || p.updatedAt || '',
      scriptContent: p.script_content || p.scriptContent || '',
      analysisContent: p.analysis_content || p.analysisContent || '',
      formData: p.form_data || p.formData || {},
      materials: (p.materials || []).map(normalizeMaterial),
    };
  }

  async function fetchProjects(force = false) {
    if (_projectsCache && !force) return _projectsCache;
    const data = await get('/api/projects');
    if (data.error) throw new Error(data.error);
    _projectsCache = (data.projects || []).map(normalizeProject);
    return _projectsCache;
  }

  function getProjects() {
    return (_projectsCache || []).filter(p => p.id !== 'default');
  }

  function findProjectByName(name) {
    const key = (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key) return null;
    return getProjects().find(p => (p.name || '').trim().toLowerCase().replace(/\s+/g, ' ') === key) || null;
  }

  async function registerMaterial(payload, source = 'unknown') {
    const features = payload.features || [];
    const formData = {
      ...(payload.form_data || payload.formData || {}),
      source,
      name: payload.product_name || payload.name || '',
      features: payload.form_data?.features || payload.formData?.features
        || (Array.isArray(features) ? features.join(', ') : (features || '')),
      hook: payload.hook || '',
      cta: payload.cta || '',
      target: payload.target || '',
      video_id: payload.video_id || '',
      video_url: payload.video_url || '',
      channel_name: payload.channel_name || '',
      video_title: payload.video_title || '',
      selling_points: payload.selling_points || [],
    };
    const body = {
      source,
      product_name: payload.product_name || payload.name || payload.video_title || '소재',
      category: payload.category || formData.category || '기타',
      features: normalizeFeatures(payload.features || formData.features),
      hook: payload.hook || '',
      cta: payload.cta || '',
      selling_points: payload.selling_points || [],
      image_url: payload.image_url || '',
      video_url: payload.video_url || '',
      video_id: payload.video_id || '',
      channel_name: payload.channel_name || '',
      video_title: payload.video_title || '',
      analysis_content: payload.analysis_content || payload.analysisContent || '',
      form_data: formData,
    };
    const data = await post('/api/projects/add-material', body);
    if (data.error) {
      toast(data.error, 'error');
      return false;
    }
    if (!data.ok) {
      toast(formatApiError(data, '소재 등록 실패'), 'error');
      return false;
    }
    // 신규 API: { ok, project } / 구 API: { ok, project_id, material }
    if (data.project?.id || data.material?.id) {
      await fetchProjects(true);
      toast('소재가 등록되었습니다.', 'success');
      return true;
    }
    const pid = data.project_id;
    if (pid) {
      const verify = await get('/api/projects');
      const projects = verify.projects || [];
      const saved = projects.find(p => p.id === pid);
      const legacyMat = data.material?.id
        && projects.some(p => (p.materials || []).some(m => m.id === data.material.id));
      if (saved || legacyMat) {
        await fetchProjects(true);
        toast('소재가 등록되었습니다.', 'success');
        return true;
      }
    }
    toast('저장 확인 실패 — 서버에 반영되지 않았습니다.', 'error');
    return false;
  }

  async function saveProjectToServer(project) {
    const existing = findProjectByName(project.name);
    const id = existing?.id || project.id || Date.now().toString();
    const data = await post('/api/projects/save', {
      id,
      name: project.name,
      category: project.category || existing?.category || '',
      status: project.status || existing?.status || 'draft',
      script_content: project.scriptContent || '',
      analysis_content: project.analysisContent || '',
      form_data: { ...(existing?.formData || {}), ...(project.formData || {}) },
    });
    if (data.error) {
      toast(data.error, 'error');
      return null;
    }
    const verify = await get('/api/projects');
    const saved = (verify.projects || []).find(p => p.id === data.project?.id);
    if (!saved) {
      toast('저장 확인 실패 — 서버에 반영되지 않았습니다.', 'error');
      return null;
    }
    await fetchProjects(true);
    return normalizeProject(saved);
  }

  async function updateProject(id, updates) {
    const existing = getProjects().find(p => p.id === id);
    if (!existing) return false;
    const merged = { ...existing, ...updates };
    const saved = await saveProjectToServer(merged);
    return !!saved;
  }

  async function deleteProject(id) {
    if (id === 'default') {
      toast('기본 프로젝트는 삭제할 수 없습니다.', 'error');
      return false;
    }
    const data = await del('/api/projects/' + encodeURIComponent(id));
    if (data.error) {
      toast(data.error, 'error');
      return false;
    }
    await fetchProjects(true);
    return true;
  }

  function normalizeImportProjects(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.projects)) return parsed.projects;
    return [];
  }

  async function importProjectsFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const projects = normalizeImportProjects(JSON.parse(await file.text()));
        if (!projects.length) {
          toast('가져올 프로젝트가 없습니다. (projects 배열 또는 프로젝트 목록 JSON)', 'error');
          return;
        }
        const data = await post('/api/projects/migrate-local', { projects });
        if (data.error) { toast(data.error, 'error'); return; }
        await fetchProjects(true);
        const errMsg = (data.errors || []).length ? ` (오류 ${data.errors.length}건)` : '';
        toast(`${data.migrated || 0}개 프로젝트를 가져왔습니다.${errMsg}`, 'success');
      } catch {
        toast('JSON 파일을 읽을 수 없습니다.', 'error');
      }
    };
    input.click();
  }
  const SOURCE_LABELS = {
    video_analysis: '영상분석',
    text_analysis: '제품분석',
    vision_analysis: '영상초정밀',
    product_search: '제품검색',
    material_search: '소재검색',
    benchmark: '벤치마킹',
    explore: '소재탐색',
    legacy_materials: '소재',
    unknown: '기타',
  };

  function fmtSource(src) {
    return SOURCE_LABELS[src] || src || '기타';
  }
  function getModel() {
    const saved = localStorage.getItem(MODEL_KEY) || 'gemini-2.5-flash';
    return saved;
  }

  // ─── HTTP helpers ──────────────────────────────────────
  function formatApiError(data, fallback = '요청 실패') {
    if (!data) return fallback;
    if (typeof data.error === 'string') return data.error;
    if (typeof data.message === 'string') return data.message;
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail.map(d => (d && d.msg) || String(d)).join('; ') || fallback;
    }
    return fallback;
  }

  function normalizeFeatures(features) {
    if (Array.isArray(features)) return features;
    if (typeof features === 'string' && features.trim()) {
      return features.split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
    }
    return [];
  }

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
  async function del(url) {
    const r = await fetch(url, { method: 'DELETE' });
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
    fetchProjects().then(projects => {
      const today = new Date().toDateString();
      const scripts  = projects.filter(p => p.scriptContent).length;
      const analyzed = projects.filter(p => p.analysisContent && new Date(p.createdAt).toDateString() === today).length;
      document.getElementById('kpiProjects').textContent = projects.length;
      document.getElementById('kpiScripts').textContent  = scripts;
      document.getElementById('kpiAnalyzed').textContent = analyzed;
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
    }).catch(e => toast(e.message || '프로젝트 로드 실패', 'error'));
  }

  // ═══════════════════════════════════════════════════════
  // PAGE: Explore
  // ═══════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════
  // EXPLORE — YouTube Insight Search
  // ═══════════════════════════════════════════════════════

  let ytRawData = [];
  let ytCurrentSort = 'viewCount';
  let ytSortDescending = true;
  let ytVideoMap = {};

  function getViralBadgeHtml(score) {
    const s = Number(score) || 0;
    let text = '', cls = 'viral-lv-1';
    if (s < 100)       { text = '🏳️ 일반'; cls = 'viral-lv-1'; }
    else if (s < 500)  { text = '🌿 우수'; cls = 'viral-lv-2'; }
    else if (s < 1000) { text = '💧 떡상'; cls = 'viral-lv-3'; }
    else if (s < 5000) { text = '🔮 대박'; cls = 'viral-lv-4'; }
    else if (s < 10000){ text = '🦁 초대박'; cls = 'viral-lv-5'; }
    else               { text = '👑 신의 간택 (100배+)'; cls = 'viral-lv-6'; }
    return `<div class="viral-badge ${cls}">${text}</div>`;
  }

  function sortYtItems(items, sortKey, descending) {
    const sorted = [...items];
    sorted.sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (sortKey === 'date') {
        va = new Date(a.publishedAt || 0).getTime();
        vb = new Date(b.publishedAt || 0).getTime();
      }
      return descending ? (vb - va) : (va - vb);
    });
    return sorted;
  }

  function renderInsightVideos(filterInfo) {
    const statsEl = document.getElementById('searchStats');
    const countEl = document.getElementById('ytResultCount');
    if (filterInfo) {
      const durLabel = filterInfo.durationFilter === 'shorts' ? '1분 이하' : '전체';
      const cmtLabel = filterInfo.commentMin > 0 ? `댓글 ${filterInfo.commentMin}개 이상` : '댓글 전체';
      statsEl.textContent =
        `API 수집: ${filterInfo.total || 0}개 → ${durLabel}: ${filterInfo.afterDuration || 0}개 → ${cmtLabel}: ${filterInfo.afterComments || 0}개`;
      statsEl.classList.remove('hidden');
    }
    if (countEl) countEl.textContent = `검색 결과: ${ytRawData.length}개`;

    const grid = document.getElementById('videoResults');
    if (!grid) return;
    grid.innerHTML = '';
    show('videoResults');

    const items = sortYtItems(ytRawData, ytCurrentSort, ytSortDescending);
    if (!items.length) {
      grid.innerHTML = '<p style="color:var(--text-3);padding:20px;grid-column:1/-1">조건에 맞는 영상이 없습니다.</p>';
      return;
    }

    items.forEach(v => {
      const card = document.createElement('div');
      card.className = 'insight-card';
      const watchUrl = v.url || `https://www.youtube.com/watch?v=${v.id}`;
      card.innerHTML = `
        <div class="insight-thumb" data-url="${esc(watchUrl)}">
          <img src="${esc(v.thumbnailUrl)}" alt="${esc(v.title)}" loading="lazy" />
          <span class="insight-duration">${esc(v.durationLabel || '')}</span>
        </div>
        <div class="insight-body">
          <div class="insight-title" title="${esc(v.title)}">${esc(v.title)}</div>
          <div class="insight-channel">📺 ${esc(v.channelName)} • ${esc(v.publishedDate || '')}</div>
          ${getViralBadgeHtml(v.viralScore)}
          <div class="insight-stats">
            <div class="insight-stat-row"><span>조회수</span><span class="insight-stat-val">${fmtNum(v.viewCount || 0)}</span></div>
            <div class="insight-stat-row"><span>구독자</span><span class="insight-stat-val">${fmtNum(v.subCount || 0)}</span></div>
            <div class="insight-stat-row"><span>기여도</span><span class="insight-stat-val accent">${Math.round(v.viralScore || 0).toLocaleString()}%</span></div>
            <div class="insight-stat-row"><span>댓글</span><span class="insight-stat-val">${fmtNum(v.commentCount || 0)}</span></div>
          </div>
          <div class="insight-actions">
            <button type="button" class="btn btn-ghost btn-sm yt-copy-title-btn">제목 복사</button>
            <button type="button" class="btn btn-primary btn-sm yt-script-btn" data-vid="${esc(v.id)}">✍ 대본 작성</button>
          </div>
        </div>`;

      card.querySelector('.insight-thumb')?.addEventListener('click', () => {
        window.open(watchUrl, '_blank', 'noopener,noreferrer');
      });
      card.querySelector('.yt-copy-title-btn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(v.title || '').then(() => toast('제목이 복사되었습니다.', 'success'));
      });
      card.querySelector('.yt-script-btn')?.addEventListener('click', () => {
        if (window._exploreStartAnalysis) window._exploreStartAnalysis(v);
      });
      grid.appendChild(card);
    });
  }

  function initExploreVideoAnalysis() {
    let exVaPollTimer = null;
    let exCurrentVaResult = null;

    function openPanel(row) {
      show('exAnalysisPanel');
      document.getElementById('exploreYtLayout')?.classList.add('with-panel');
      const titleEl = document.getElementById('exVaTitle');
      if (titleEl) titleEl.textContent = row.title || row.url || '-';
    }

    function closePanel() {
      hide('exAnalysisPanel');
      document.getElementById('exploreYtLayout')?.classList.remove('with-panel');
      if (exVaPollTimer) { clearInterval(exVaPollTimer); exVaPollTimer = null; }
    }

    function switchVaTab(tab) {
      document.querySelectorAll('#exVaTabs .tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.vtab === tab);
      });
      ['product','features','selling','hook','cta','structure','frames'].forEach(k => {
        const el = document.getElementById('exVa' + k.charAt(0).toUpperCase() + k.slice(1));
        if (el) el.classList.toggle('hidden', k !== tab);
      });
    }

    function renderVaResult(result) {
      exCurrentVaResult = result;
      hide('exVaProgress');

      const grid = document.getElementById('exVaProduct');
      if (grid) {
        grid.innerHTML = `
          <div><span class="info-label">상품명</span><span class="info-val">${esc(result.product_name || '-')}</span></div>
          <div><span class="info-label">브랜드</span><span class="info-val">${esc(result.brand || '-')}</span></div>
          <div><span class="info-label">카테고리</span><span class="info-val">${esc(result.category || '-')}</span></div>
          <div><span class="info-label">제품 유형</span><span class="info-val">${esc(result.product_type || '-')}</span></div>`;
      }

      const fillList = (id, items) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = (items || []).map(x => `<li>${esc(x)}</li>`).join('') || '<li>-</li>';
      };
      fillList('exVaFeaturesList', result.features);
      fillList('exVaSellingList', result.selling_points);

      const hookEl = document.getElementById('exVaHookText');
      if (hookEl) hookEl.textContent = result.hook || '-';
      const ctaEl = document.getElementById('exVaCtaText');
      if (ctaEl) ctaEl.textContent = result.cta || '-';

      const structEl = document.getElementById('exVaStructureList');
      if (structEl) {
        structEl.innerHTML = (result.structure || []).map(s => `
          <div class="bm-structure-item">
            <strong>${esc(s.time || s.section || '')}</strong>
            <span>${esc(s.section || '')}</span>
            <p>${esc(s.description || '')}</p>
          </div>`).join('') || '<p class="empty-row">구조 정보 없음</p>';
      }

      const frameGrid = document.getElementById('exVaFrameGrid');
      if (frameGrid) {
        frameGrid.innerHTML = (result.frames || []).map(f => `
          <img src="${esc(f.url)}" alt="프레임 ${f.index}" class="bm-frame-thumb" data-src="${esc(f.url)}" loading="lazy" />`
        ).join('') || '<p class="empty-row">프레임 없음</p>';
        frameGrid.querySelectorAll('.bm-frame-thumb').forEach(img => {
          img.addEventListener('click', () => {
            const modal = document.getElementById('exVaFrameModal');
            const large = document.getElementById('exVaFrameLarge');
            if (modal && large) {
              large.src = img.dataset.src;
              modal.classList.remove('hidden');
            }
          });
        });
      }

      const whyEl = document.getElementById('exVaWhyPopular');
      if (whyEl) {
        if (result.why_popular) {
          whyEl.textContent = '💡 ' + result.why_popular;
          whyEl.classList.remove('hidden');
        } else {
          whyEl.classList.add('hidden');
        }
      }
      switchVaTab('product');
    }

    async function pollVideoAnalysis(videoId) {
      try {
        const data = await get('/api/benchmark/video-analysis/' + encodeURIComponent(videoId));
        const fill = document.getElementById('exVaProgressFill');
        const msg  = document.getElementById('exVaProgressMsg');

        if (data.status === 'running') {
          show('exVaProgress');
          if (fill) fill.style.width = (data.progress || 5) + '%';
          if (msg) msg.textContent = data.message || '분석 중...';
          return;
        }

        if (exVaPollTimer) { clearInterval(exVaPollTimer); exVaPollTimer = null; }

        if (data.status === 'done' && data.result) {
          renderVaResult(data.result);
          toast('영상 분석 완료', 'success');
        } else if (data.status === 'error') {
          hide('exVaProgress');
          toast(data.error || data.message || '분석 실패', 'error');
        } else {
          hide('exVaProgress');
          toast('알 수 없는 분석 상태입니다.', 'error');
        }
      } catch {
        if (exVaPollTimer) { clearInterval(exVaPollTimer); exVaPollTimer = null; }
        hide('exVaProgress');
        toast('분석 상태 조회 실패', 'error');
      }
    }

    async function startVideoAnalysis(row) {
      if (!row || !row.id) { toast('영상 ID가 없습니다.', 'error'); return; }
      if (exVaPollTimer) { clearInterval(exVaPollTimer); exVaPollTimer = null; }

      openPanel(row);
      show('exVaProgress');
      const fillEl = document.getElementById('exVaProgressFill');
      const msgEl  = document.getElementById('exVaProgressMsg');
      if (fillEl) fillEl.style.width = '2%';
      if (msgEl) msgEl.textContent = '분석 요청 중...';

      const payload = {
        video_id: row.id,
        url: row.url || `https://www.youtube.com/watch?v=${row.id}`,
        title: row.title || '',
        channel_name: row.channelTitle || row.channelName || '',
        description: row.description || '',
        product_name: row.product_name || '',
        category: row.category || '',
        whisper_model: 'tiny',
      };

      try {
        const data = await post('/api/benchmark/video-analysis', payload);
        if (data.error) {
          toast(data.error, 'error');
          hide('exVaProgress');
          return;
        }
        if (data.status === 'done' && data.result) {
          renderVaResult(data.result);
          toast('저장된 분석 결과를 불러왔습니다.', 'success');
          return;
        }
        if (msgEl) msgEl.textContent = data.message || '분석 시작...';
        exVaPollTimer = setInterval(() => pollVideoAnalysis(row.id), 1500);
        pollVideoAnalysis(row.id);
      } catch {
        toast('영상 분석 시작 실패', 'error');
        hide('exVaProgress');
      }
    }

    document.getElementById('exAnalysisClose')?.addEventListener('click', closePanel);
    document.querySelectorAll('#exVaTabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchVaTab(btn.dataset.vtab));
    });
    document.getElementById('exVaFrameModal')?.addEventListener('click', () => hide('exVaFrameModal'));
    document.getElementById('exVaSaveMaterial')?.addEventListener('click', async () => {
      if (!exCurrentVaResult) { toast('분석 결과가 없습니다.', 'error'); return; }
      await registerMaterial({
        product_name: exCurrentVaResult.product_name,
        category: exCurrentVaResult.category,
        features: exCurrentVaResult.features,
        hook: exCurrentVaResult.hook,
        cta: exCurrentVaResult.cta,
        selling_points: exCurrentVaResult.selling_points,
        video_id: exCurrentVaResult.video_id,
        video_url: exCurrentVaResult.video_url,
        channel_name: exCurrentVaResult.channel_name,
        video_title: exCurrentVaResult.video_title,
      }, 'explore');
    });
    document.getElementById('exVaGoScript')?.addEventListener('click', () => {
      if (!exCurrentVaResult) { toast('분석 결과가 없습니다.', 'error'); return; }
      const features = [
        ...(exCurrentVaResult.features || []),
        ...(exCurrentVaResult.selling_points || []),
      ].filter(Boolean).join(', ');
      goScript({
        name: exCurrentVaResult.product_name || '',
        category: exCurrentVaResult.category || '기타',
        features,
        target: '',
        hook: exCurrentVaResult.hook || '',
        videoTitle: exCurrentVaResult.video_title || '',
      });
    });
    document.getElementById('exVaGoVideo')?.addEventListener('click', () => {
      if (!exCurrentVaResult) { toast('분석 결과가 없습니다.', 'error'); return; }
      sessionStorage.setItem('sh_video_gen', JSON.stringify(exCurrentVaResult));
      toast('영상 생성 모듈로 분석 데이터를 전달했습니다. (준비 중)', 'success');
    });

    return { startVideoAnalysis };
  }

  function initExplore() {
    let trendPeriod   = 'today';
    let trendCategory = '전체';

    // ── YouTube 라디오 필터 값 읽기 헬퍼 ───────────────────────────
    function getRadio(name) {
      const el = document.querySelector(`input[name="${name}"]:checked`);
      return el ? el.value : null;
    }

    // Search
    const searchBtn = document.getElementById('searchBtn');
    const queryEl   = document.getElementById('searchQuery');

    const exploreVa = initExploreVideoAnalysis();
    window._exploreStartAnalysis = row => exploreVa.startVideoAnalysis(row);

    async function doSearch() {
      const q            = queryEl.value.trim();
      if (!q) { toast('검색어를 입력하세요.', 'error'); return; }
      const period       = getRadio('yt-period')   || '오늘';
      const durationFilter = getRadio('yt-duration') || 'shorts';
      const commentMin   = parseInt(getRadio('yt-comments') || '0', 10);
      const order        = getRadio('yt-order') || 'relevance';

      show('searchSpinner'); hide('videoResults');
      document.getElementById('searchStats').classList.add('hidden');
      hide('ytSortBar');
      try {
        const data = await get('/api/youtube', {
          query: q,
          period,
          duration_filter: durationFilter,
          comment_min: commentMin,
          order,
        });
        hide('searchSpinner');
        if (data.error) { toast(data.error, 'error'); return; }
        ytRawData = data.items || [];
        ytVideoMap = {};
        ytRawData.forEach(v => { if (v.id) ytVideoMap[v.id] = v; });
        show('ytSortBar');
        renderInsightVideos(data.filtered ? {
          total: data.filtered.total,
          afterDuration: data.filtered.afterDuration,
          afterComments: data.filtered.afterComments,
          durationFilter,
          commentMin,
        } : null);
      } catch (e) {
        hide('searchSpinner'); toast('검색 중 오류가 발생했습니다.', 'error');
      }
    }

    searchBtn.addEventListener('click', doSearch);
    queryEl.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

    document.querySelectorAll('.yt-sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        ytCurrentSort = btn.dataset.sort || 'viewCount';
        document.querySelectorAll('.yt-sort-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderInsightVideos();
      });
    });
    document.getElementById('ytOrderToggle')?.addEventListener('click', () => {
      ytSortDescending = !ytSortDescending;
      const toggle = document.getElementById('ytOrderToggle');
      if (toggle) toggle.textContent = ytSortDescending ? '⬇️' : '⬆️';
      renderInsightVideos();
    });

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

  function initExtractor() {
    initProductExtractor();
  }

  function initProductExtractor() {
    const dropZone       = document.getElementById('imgDropZone');
    const fileInput      = document.getElementById('imgFileInput');
    const pickImageBtn   = document.getElementById('pickImageBtn');
    const placeholder    = document.getElementById('dropPlaceholder');
    const previewWrap    = document.getElementById('uploadPreviewWrap');
    const preview        = document.getElementById('uploadedPreview');
    const successMsg     = document.getElementById('uploadSuccess');
    const step2          = document.getElementById('extractStep2');
    const step3          = document.getElementById('extractStep3');
    const extractBtn     = document.getElementById('extractBtn');
    const extractSpinner = document.getElementById('extractSpinner');
    const keywordList    = document.getElementById('keywordList');
    const btnXhs         = document.getElementById('btnXiaohongshu');
    const btnDouyin      = document.getElementById('btnDouyin');
    const btnGoogle      = document.getElementById('btnGoogle');
    const btnGoogleLens  = document.getElementById('btnGoogleLens');
    const resetBtn       = document.getElementById('extractResetBtn');

    if (!dropZone || !fileInput) return;

    let uploadedBase64  = null;
    let uploadedMime    = 'image/jpeg';
    let selectedKeyword = null;

    function isImageFile(file) {
      if (!file) return false;
      if (file.type && file.type.startsWith('image/')) return true;
      return /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name || '');
    }

    function openFilePicker() {
      fileInput.value = '';
      fileInput.click();
    }

    function showUploadedPreview(dataUrl) {
      placeholder.classList.add('hidden');
      preview.src = dataUrl;
      previewWrap.classList.remove('hidden');
      successMsg.classList.remove('hidden');
      dropZone.classList.add('has-image');
    }

    function resetUploadUI() {
      uploadedBase64 = null;
      uploadedMime = 'image/jpeg';
      selectedKeyword = null;
      placeholder.classList.remove('hidden');
      previewWrap.classList.add('hidden');
      preview.src = '';
      successMsg.classList.add('hidden');
      dropZone.classList.remove('has-image', 'drag-over');
      step2.classList.add('hidden');
      step3.classList.add('hidden');
      keywordList.innerHTML = '';
      fileInput.value = '';
    }

    function loadImageFile(file) {
      if (!isImageFile(file)) {
        toast('이미지 파일만 업로드 가능합니다.', 'error');
        return;
      }
      uploadedMime = file.type || 'image/jpeg';
      const reader = new FileReader();
      reader.onerror = () => toast('이미지를 읽을 수 없습니다.', 'error');
      reader.onload = e => {
        const dataUrl = e.target.result;
        if (!dataUrl || typeof dataUrl !== 'string') {
          toast('이미지를 읽을 수 없습니다.', 'error');
          return;
        }
        uploadedBase64 = dataUrl.split(',')[1];
        showUploadedPreview(dataUrl);

        step2.classList.remove('hidden');
        step3.classList.add('hidden');
        keywordList.innerHTML = '';

        doExtract();
      };
      reader.readAsDataURL(file);
    }

    // 클릭 업로드 (제품분석 페이지와 동일 패턴)
    dropZone.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      openFilePicker();
    });

    if (pickImageBtn) {
      pickImageBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        openFilePicker();
      });
    }

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (file) loadImageFile(file);
    });

    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) loadImageFile(file);
    });

    // 추출 버튼
    if (extractBtn) extractBtn.addEventListener('click', doExtract);

    async function doExtract() {
      if (!uploadedBase64) { toast('먼저 이미지를 업로드하세요.', 'error'); return; }
      show('extractSpinner');
      if (extractBtn) extractBtn.disabled = true;

      const prompt = `이 제품 이미지를 분석하고, 중국어 간체(简体中文)로 샤오홍수(小红书)나 더우인(抖音)에서 검색할 때 사용할 제품 검색 키워드를 5개 추출해줘.
반드시 중국어 간체 키워드만 출력하고, 각 키워드는 새 줄에 하나씩, 번호나 추가 설명 없이 키워드만 출력해줘.`;

      try {
        const model = getModel();
        const res = await fetch('/api/gemini-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: uploadedBase64, mime_type: uploadedMime, prompt, model }),
        });
        const data = await res.json();
        hide('extractSpinner');
        if (extractBtn) extractBtn.disabled = false;

        if (data.error) { toast(data.error, 'error'); return; }

        const keywords = (data.text || '')
          .split('\n')
          .map(k => k.replace(/^[\d\.\-\*•]+\s*/, '').trim())
          .filter(k => k.length > 0 && !/^[:\-]+$/.test(k))
          .slice(0, 5);

        if (!keywords.length) { toast('키워드를 추출하지 못했습니다.', 'error'); return; }

        selectedKeyword = keywords[0];
        renderKeywords(keywords);
        step3.classList.remove('hidden');
      } catch (e) {
        hide('extractSpinner');
        if (extractBtn) extractBtn.disabled = false;
        toast('키워드 추출 중 오류가 발생했습니다.', 'error');
      }
    }

    function renderKeywords(keywords) {
      keywordList.innerHTML = '';
      keywords.forEach((kw, i) => {
        const item = document.createElement('div');
        item.className = 'keyword-item' + (i === 0 ? ' keyword-selected' : '');
        item.dataset.kw = kw;
        item.innerHTML = `
          <span class="keyword-text">${esc(kw)}</span>
          <button class="keyword-copy-btn" data-kw="${esc(kw)}">복사</button>
        `;
        // 클릭으로 선택
        item.addEventListener('click', () => {
          document.querySelectorAll('.keyword-item').forEach(el => el.classList.remove('keyword-selected'));
          item.classList.add('keyword-selected');
          selectedKeyword = kw;
        });
        // 복사 버튼
        item.querySelector('.keyword-copy-btn').addEventListener('click', e => {
          e.stopPropagation();
          navigator.clipboard.writeText(kw).then(() => toast(`"${kw}" 복사됨`, 'success'));
          selectedKeyword = kw;
          document.querySelectorAll('.keyword-item').forEach(el => el.classList.remove('keyword-selected'));
          item.classList.add('keyword-selected');
        });
        keywordList.appendChild(item);
      });
    }

    // 플랫폼 연결 버튼
    if (btnXhs) btnXhs.addEventListener('click', () => {
      const kw = selectedKeyword || '';
      window.open(`https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(kw)}`, '_blank');
    });
    if (btnDouyin) btnDouyin.addEventListener('click', () => {
      const kw = selectedKeyword || '';
      window.open(`https://www.douyin.com/search/${encodeURIComponent(kw)}`, '_blank');
    });
    if (btnGoogle) btnGoogle.addEventListener('click', () => {
      const kw = selectedKeyword || '';
      if (!kw) { toast('검색할 키워드를 선택하세요.', 'error'); return; }
      window.open(
        `https://www.google.com/search?q=${encodeURIComponent(kw)}&tbm=isch`,
        '_blank',
        'noopener,noreferrer'
      );
    });

    function isLocalServerHost() {
      const h = window.location.hostname;
      return h === 'localhost' || h === '127.0.0.1' || h === '::1';
    }

    function canUseLensUploadByUrl() {
      return window.location.protocol === 'https:' && !isLocalServerHost();
    }

    if (btnGoogleLens) btnGoogleLens.addEventListener('click', async () => {
      if (!uploadedBase64) {
        toast('먼저 이미지를 업로드하세요.', 'error');
        return;
      }
      btnGoogleLens.disabled = true;
      try {
        const data = await post('/api/extractor/save-image', {
          image: uploadedBase64,
          mime_type: uploadedMime,
        });
        if (data.error) {
          toast(data.error, 'error');
          return;
        }

        if (canUseLensUploadByUrl()) {
          const imageUrl = data.absolute_url || `${window.location.origin}${data.url}`;
          window.open(
            `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`,
            '_blank',
            'noopener,noreferrer'
          );
        } else {
          window.open('https://lens.google.com/', '_blank', 'noopener,noreferrer');
          toast(
            'Google Lens가 열렸습니다. 업로드한 제품 이미지를 직접 올려 검색하세요. (로컬 서버는 URL 자동 전달 불가)',
            'success'
          );
        }
      } catch {
        toast('이미지 저장 중 오류가 발생했습니다.', 'error');
      } finally {
        btnGoogleLens.disabled = false;
      }
    });

    // 초기화
    if (resetBtn) resetBtn.addEventListener('click', resetUploadUI);
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

  async function saveTextResult() {
    const raw  = window._taRawResult || '';
    if (!raw) { toast('분석 결과가 없습니다.', 'error'); return; }
    const prefill = extractTextPrefill();
    const name = prefill.name || document.getElementById('ta-productName').value.trim() || '제품 분석';
    const cat  = document.getElementById('ta-category').value;
    const saved = await saveProjectToServer({
      id: Date.now().toString(),
      name,
      category: cat,
      status: 'draft',
      analysisContent: raw,
      formData: prefill,
    });
    if (saved) toast('소재가 등록되었습니다.', 'success');
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

  async function saveVisionResult() {
    const raw = window._visionRawResult || '';
    if (!raw) { toast('분석 결과가 없습니다.', 'error'); return; }
    const prefill = extractVisionPrefill();
    const name = prefill.name || '영상 분석 - ' + new Date().toLocaleDateString('ko-KR');
    const saved = await saveProjectToServer({
      id: Date.now().toString(),
      name,
      category: prefill.category || '기타',
      status: 'draft',
      analysisContent: raw,
      formData: prefill,
    });
    if (saved) toast('소재가 등록되었습니다.', 'success');
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

  /** TTS에서 읽지 않을 섹션 레이블 */
  const TTS_SKIP_LABELS = [
    '훅', '문제 제시', '문제제시', '제품 소개', '제품소개', '제품 핵심', '제품핵심',
    'CTA', '핵심 포인트', '핵심포인트', '핵심 포인트 1', '핵심 포인트 2',
    '사용 장면', '사용장면', '사용 후기', '사용후기', '오프닝', '클로징', '마무리',
  ];

  /** 제품 정보·대본 구성 등 메타데이터 줄인지 판별 */
  function isScriptMetadataLine(line) {
    const l = line.trim();
    if (!l) return false;
    if (/^[-─—_=*]{3,}$/.test(l)) return true;
    if (/^#{1,3}\s*(?:제품\s*정보|대본\s*구성|작성\s*지침)/i.test(l)) return true;
    if (/^(?:제품\s*정보|대본\s*구성|작성\s*지침)(?:\s*\([^)]*\))?\s*$/i.test(l)) return true;
    if (/^(?:\*\*)?(?:제품명|카테고리|주요\s*특징|타겟\s*고객|영상\s*길이|톤\s*[&＆]?\s*스타일|추가\s*요청)(?:\*\*)?\s*[:：]/i.test(l)) return true;
    if (/^[-*•]\s+(?:\*\*)?(?:제품명|카테고리|주요\s*특징|타겟\s*고객|영상\s*길이|톤\s*[&＆]?\s*스타일|추가\s*요청)/i.test(l)) return true;
    return false;
  }

  function stripScriptMetadata(text) {
    return (text || '')
      .split('\n')
      .filter(line => !isScriptMetadataLine(line))
      .join('\n');
  }

  function parseScriptSections(text) {
    const re = /^[ \t]*\*{0,2}\[([^\]]+)\]\*{0,2}[ \t]*/gm;
    const matches = [...(text || '').matchAll(re)];
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

  /** TTS용: 섹션 본문(낭독 대사)만 추출 */
  function extractNarrationForTTS(text) {
    let t = (text || '').trim();
    if (!t) return '';

    const sections = parseScriptSections(t);
    if (sections.length) {
      return sections
        .map(s => cleanScriptForTTS(s.text))
        .filter(Boolean)
        .join('\n\n')
        .trim();
    }

    const firstSection = t.search(/^[ \t]*\*{0,2}\[[^\]]+\]\*{0,2}/m);
    if (firstSection > 0) t = t.slice(firstSection);

    return cleanScriptForTTS(t);
  }

  /** TTS 텍스트에서 이모지·아이콘·장식 기호 제거 */
  function stripEmojisAndIcons(text) {
    return (text || '')
      // 유니코드 이모지 (ZWJ·피부톤·깃발 시퀀스 포함)
      .replace(/(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\p{Emoji_Modifier}|\uFE0F|\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})*)*/gu, '')
      // 딩뱃·기호권 아이콘 (✅ ✨ 🔥 ★ 등)
      .replace(/[\u2600-\u27BF\u2300-\u23FF\u2B50\u2B55\u2934-\u2935\u3030\u303D\u3297\u3299]/g, '')
      // variation selector 잔여
      .replace(/\uFE0F/g, '')
      // 이모지 제거 후 남은 공백 정리
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/^[ \t]+|[ \t]+$/gm, '');
  }

  /**
   * TTS용 텍스트 정제:
   * 1) 제품 정보·대본 구성 등 메타데이터 제거
   * 2) **[훅]** / [CTA] 등 섹션 레이블 제거
   * 3) (행동 지문) 괄호 안 지문 제거
   * 4) 마크다운 서식 제거
   * 5) 이모지·아이콘 제거
   */
  function cleanScriptForTTS(text) {
    let t = stripScriptMetadata(text || '');

    // **[섹션명]** 또는 [섹션명] — 줄 전체가 레이블인 경우 제거
    t = t.replace(/^[ \t]*(?:#{1,3}\s*)?\*{0,2}\[[^\]]+\]\*{0,2}[ \t]*$/gm, '');
    // 줄 시작의 **[섹션명]** 접두사 제거 (뒤 대사는 유지)
    t = t.replace(/^[ \t]*(?:#{1,3}\s*)?\*{0,2}\[[^\]]+\]\*{0,2}[ \t]*/gm, '');

    // 알려진 섹션명 단독 줄 / "훅:", "CTA -" 형태 제거
    TTS_SKIP_LABELS.forEach(label => {
      const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      t = t.replace(new RegExp(`^[ \\t]*(?:\\*{1,3})?${esc}(?:\\*{1,3})?[ \\t]*$`, 'gim'), '');
      t = t.replace(new RegExp(`^[ \\t]*(?:\\*{1,3})?${esc}(?:\\*{1,3})?[ \\t]*[:：\\-–][ \\t]*`, 'gim'), '');
    });

    // 괄호 행동 지문 제거
    t = t.replace(/（[^）]*）/g, '');
    t = t.replace(/\([^)]*\)/g, '');

    // 마크다own 헤더·볼드·불릿
    t = t.replace(/^#{1,3}\s+/gm, '');
    t = t.replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1');
    t = t.replace(/\*{1,3}/g, '');
    t = t.replace(/^\s*[-*]\s+/gm, '');

    t = stripEmojisAndIcons(t);
    t = t.replace(/\n{3,}/g, '\n\n').trim();
    return t;
  }

  function initTTSCard(scriptText) {
    const ta = document.getElementById('tts-text');
    if (ta) ta.value = extractNarrationForTTS(scriptText);
    show('tts-card');
    loadTTSPresets();
  }

  async function loadTTSVoices() {
    const provider = document.getElementById('tts-provider').value;
    const btn = document.getElementById('tts-loadVoicesBtn');
    const sel = document.getElementById('tts-voice');
    const errEl = document.getElementById('tts-voiceError');
    if (errEl) errEl.textContent = '';
    btn.disabled = true; btn.textContent = '로딩 중...';
    try {
      const data = await get('/api/tts/voices', { provider });
      if (data.error) {
        if (errEl) errEl.textContent = '⚠️ ' + data.error;
        else toast(data.error, 'error');
        return;
      }
      if (!Array.isArray(data) || data.length === 0) {
        if (errEl) errEl.textContent = '⚠️ 음성 목록이 비어 있습니다. API 키를 확인하세요.';
        return;
      }
      sel.innerHTML = '<option value="">-- 음성 선택 --</option>';
      data.forEach(v => {
        const o = document.createElement('option');
        o.value = v.id;
        const gender = v.labels?.gender ? ` (${v.labels.gender})` : '';
        o.textContent = (v.name || v.id) + gender;
        sel.appendChild(o);
      });

      // Chirp3 HD Despina 우선 자동 선택 (TTS-APP 기본과 동일 계열)
      const preferred = localStorage.getItem(GOOGLE_VOICE_KEY) || DEFAULT_GOOGLE_VOICE;
      const pick = [...sel.options].find(o => o.value === preferred)
        || [...sel.options].find(o => o.value.includes('Chirp3-HD-Despina'))
        || [...sel.options].find(o => o.value.includes('Chirp3-HD'));
      if (pick && pick.value) {
        sel.value = pick.value;
        localStorage.setItem(GOOGLE_VOICE_KEY, pick.value);
      }

      toast(`${data.length}개 음성 로드됨`, 'success');
      updateTTSStatusBadges(document.getElementById('tts-provider').value);
    } catch (e) {
      const msg = '음성 목록 로드 실패: ' + (e?.message || e);
      if (errEl) errEl.textContent = '⚠️ ' + msg;
      else toast(msg, 'error');
    }
    finally { btn.disabled = false; btn.textContent = '음성목록 불러오기'; }
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
    // 제공사·음성 표시 업데이트 (voice_name 우선, voice 드롭다운 텍스트 fallback)
    updateTTSStatusBadges(p.provider, p.voice_name || p.voice_id || '--');
  }

  // 현재 제공사·선택된 음성 표시 카드 업데이트
  function updateTTSStatusBadges(provider, voiceName) {
    const provEl  = document.getElementById('tts-activeProvider');
    const voiceEl = document.getElementById('tts-activeVoice');
    if (provEl) {
      const label = provider === 'google' ? 'Google Cloud TTS' : 'ElevenLabs';
      provEl.textContent = label;
    }
    if (voiceEl) {
      if (voiceName !== undefined) {
        voiceEl.textContent = voiceName || '--';
      } else {
        // voice 드롭다운에서 읽기
        const sel = document.getElementById('tts-voice');
        const opt = sel?.selectedOptions?.[0];
        voiceEl.textContent = (opt && opt.value) ? opt.textContent : '--';
      }
    }
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
    const rawText = document.getElementById('tts-text').value.trim();
    if (!rawText) { toast('변환할 텍스트를 입력하세요.', 'error'); return; }
    const text = extractNarrationForTTS(rawText);
    if (!text) { toast('TTS로 읽을 대사가 없습니다.', 'error'); return; }

    const provider = document.getElementById('tts-provider').value;
    const voiceId  = document.getElementById('tts-voice').value;
    if (provider === 'google' && !voiceId) {
      toast('Google TTS: 음성목록 불러오기 후 Chirp3 HD 음성을 선택하세요.', 'error');
      return;
    }
    if (provider === 'google' && voiceId) {
      localStorage.setItem(GOOGLE_VOICE_KEY, voiceId);
    }

    setBtnLoading('tts-generateBtn', 'tts-btnText', 'tts-spinner', true);
    hide('tts-playerArea');
    const body = {
      text,
      provider,
      voice_id:         voiceId,
      speaking_rate:    parseFloat(document.getElementById('tts-rate').value),
      pitch:            parseFloat(document.getElementById('tts-pitch').value),
      stability:        parseFloat(document.getElementById('tts-stability').value),
      similarity_boost: parseFloat(document.getElementById('tts-similarity').value),
      style:            parseFloat(document.getElementById('tts-style').value),
      speaker_boost:    document.getElementById('tts-speakerBoost').checked,
      use_pronunciation: provider !== 'google' && localStorage.getItem(PRON_KEY) !== 'false',
      sentence_split:    provider === 'google' && document.getElementById('tts-sentenceSplit')?.checked !== false,
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
      const chunkMsg = data.chunks > 1 ? ` (${data.chunks}문장 합성)` : '';
      toast(`MP3 생성 완료!${chunkMsg}`, 'success');
    } catch { toast('TTS 생성 중 오류 발생', 'error'); }
    finally { setBtnLoading('tts-generateBtn', 'tts-btnText', 'tts-spinner', false, '🎙️ MP3 생성'); }
  }

  function toggleTTSProviderOptions(provider) {
    if (provider === 'google') {
      document.getElementById('tts-elOptions').classList.add('hidden');
      document.getElementById('tts-googleOptions').classList.remove('hidden');
      document.getElementById('tts-googleSentenceRow')?.classList.remove('hidden');
    } else {
      document.getElementById('tts-elOptions').classList.remove('hidden');
      document.getElementById('tts-googleOptions').classList.add('hidden');
      document.getElementById('tts-googleSentenceRow')?.classList.add('hidden');
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
      updateTTSStatusBadges(e.target.value);
      if (e.target.value === 'google') {
        const sel = document.getElementById('tts-voice');
        if (sel && sel.options.length <= 1) loadTTSVoices();
      }
    });
    document.getElementById('tts-voice').addEventListener('change', () => {
      const provider = document.getElementById('tts-provider').value;
      const voiceId  = document.getElementById('tts-voice').value;
      if (provider === 'google' && voiceId) {
        localStorage.setItem(GOOGLE_VOICE_KEY, voiceId);
      }
      updateTTSStatusBadges(provider);
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
    // 초기 표시 업데이트
    updateTTSStatusBadges(document.getElementById('tts-provider').value);
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

## 출력 형식 (필수)
- **제품 정보, 대본 구성, 작성 지침을 다시 출력하지 마세요.**
- 제품명·카테고리·특징·타겟 등 메타데이터 줄을 나열하지 마세요.
- **오직 **[${secs[0]}]** 로 시작하는 낭독 대본만** 출력하세요.
- 각 섹션은 **[섹션명]** 한 줄로 시작하고, 다음 줄부터 실제 대사를 작성하세요.

위 구성대로 실제 방송 가능한 낭독 대본만 작성해주세요.`;
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

  async function saveScript() {
    const name     = document.getElementById('sc-productName').value.trim() || '대본';
    const category = document.getElementById('sc-category').value;
    const raw      = window._scriptRaw || '';
    if (!raw) { toast('생성된 대본이 없습니다.', 'error'); return; }
    const saved = await saveProjectToServer({
      id: Date.now().toString(), name, category, status: 'draft',
      scriptContent: raw,
      formData: {
        name, category,
        features: document.getElementById('sc-features').value.trim(),
        target:   document.getElementById('sc-target').value.trim(),
        duration: document.getElementById('sc-duration').value,
        tone:     document.getElementById('sc-tone').value,
      },
    });
    if (saved) toast('프로젝트에 저장되었습니다.', 'success');
  }

  // ═══════════════════════════════════════════════════════
  // PAGE: Projects
  // ═══════════════════════════════════════════════════════
  let _openProjectId = null;

  function initProjects() {
    fetchProjects(true).then(() => {
      renderProjectsTable();
    }).catch(e => toast(e.message || '프로젝트 로드 실패', 'error'));

    document.getElementById('projectSearch').addEventListener('input', renderProjectsTable);
    document.getElementById('projectStatusFilter').addEventListener('change', renderProjectsTable);
    document.getElementById('migrateLocalBtn')?.addEventListener('click', importProjectsFromFile);
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
    document.getElementById('md-deleteBtn').addEventListener('click', async () => {
      if (!_openProjectId) return;
      if (!confirm('이 프로젝트를 삭제하시겠습니까?')) return;
      const ok = await deleteProject(_openProjectId);
      if (!ok) return;
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
    document.getElementById('md-statusSaveBtn').addEventListener('click', async () => {
      if (!_openProjectId) return;
      const status = document.getElementById('md-statusSelect').value;
      const ok = await updateProject(_openProjectId, { status });
      if (!ok) return;
      renderProjectsTable();
      toast('상태가 저장되었습니다.', 'success');
    });
    document.getElementById('md-mp3Btn')?.addEventListener('click', generateProjectMP3);
    document.querySelectorAll('.modal-tab').forEach(btn => {
      btn.addEventListener('click', () => switchProjectTab(btn.dataset.tab));
    });
  }

  const PROJECT_TTS_VOICE = 'ko-KR-Chirp3-HD-Despina';

  function setMdTtsProgress(pct, msg) {
    const fill = document.getElementById('md-ttsProgressFill');
    const text = document.getElementById('md-ttsProgressMsg');
    if (fill) fill.style.width = Math.min(100, Math.max(0, pct)) + '%';
    if (text) text.textContent = msg || '';
  }

  function resetMdTtsUI() {
    hide('md-ttsProgress');
    hide('md-ttsPlayer');
    setMdTtsProgress(0, '');
    const btn = document.getElementById('md-mp3Btn');
    if (btn) btn.disabled = false;
  }

  async function pollTtsJob(jobId) {
    return new Promise((resolve, reject) => {
      const timer = setInterval(async () => {
        try {
          const st = await get('/api/tts/job/' + encodeURIComponent(jobId));
          if (st.error && !st.status) {
            clearInterval(timer);
            reject(new Error(st.error));
            return;
          }
          setMdTtsProgress(st.progress || 0, st.message || '합성 중...');
          if (st.status === 'done') {
            clearInterval(timer);
            resolve(st);
          } else if (st.status === 'error') {
            clearInterval(timer);
            reject(new Error(st.error || st.message || 'MP3 생성 실패'));
          }
        } catch (e) {
          clearInterval(timer);
          reject(e);
        }
      }, 700);
    });
  }

  async function generateProjectMP3() {
    if (!_openProjectId) return;
    const p = getProjects().find(x => x.id === _openProjectId);
    if (!p?.scriptContent) {
      toast('저장된 대본이 없습니다.', 'error');
      return;
    }
    const text = extractNarrationForTTS(p.scriptContent);
    if (!text) {
      toast('TTS로 읽을 대사가 없습니다.', 'error');
      return;
    }

    const btn = document.getElementById('md-mp3Btn');
    if (btn) btn.disabled = true;
    hide('md-ttsPlayer');
    show('md-ttsProgress');
    setMdTtsProgress(2, '요청 중...');

    try {
      const start = await post('/api/tts/job', {
        text,
        provider: 'google',
        voice_id: PROJECT_TTS_VOICE,
        speaking_rate: 1.1,
        pitch: 1.0,
        use_pronunciation: false,
        sentence_split: true,
      });
      if (start.error) {
        toast(start.error, 'error');
        hide('md-ttsProgress');
        return;
      }
      const result = await pollTtsJob(start.job_id);
      hide('md-ttsProgress');
      const audio = document.getElementById('md-ttsAudio');
      const dl = document.getElementById('md-ttsDownload');
      if (audio && result.url) {
        audio.src = result.url + '?t=' + Date.now();
        audio.play().catch(() => {});
      }
      if (dl && result.url) {
        dl.href = result.url;
        dl.download = result.file || 'tts.mp3';
      }
      show('md-ttsPlayer');
      const chunkMsg = result.chunks > 1 ? ` (${result.chunks}문장 합성)` : '';
      toast('MP3 생성 완료!' + chunkMsg, 'success');
    } catch (e) {
      hide('md-ttsProgress');
      toast(e.message || 'MP3 생성 실패', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
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
    tbody.innerHTML = list.map(p => {
      const hasScript = !!(p.scriptContent && p.scriptContent.trim());
      const hasAnalysis = !!(p.analysisContent && p.analysisContent.trim());
      const typeBtns = `
        <div class="proj-type-btns">
          <button type="button" class="proj-type-btn ${hasScript ? 'has-data' : ''}" data-type="script"
            onclick="event.stopPropagation(); App.openProject('${esc(p.id)}','script')">✍️ 대본</button>
          <button type="button" class="proj-type-btn ${hasAnalysis ? 'has-data' : ''}" data-type="analysis"
            onclick="event.stopPropagation(); App.openProject('${esc(p.id)}','analysis')">📊 분석</button>
        </div>`;
      const src = p.formData?.source;
      const srcBadge = src
        ? `<span class="badge badge-active" style="font-size:10px;padding:1px 6px;margin-top:4px;display:inline-block">${esc(fmtSource(src))}</span>`
        : '';
      return `
      <tr style="cursor:pointer" onclick="App.openProject('${esc(p.id)}')">
        <td>
          <div><strong>${esc(p.name||'(제목 없음)')}</strong></div>
          ${typeBtns}
          ${srcBadge}
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

  function switchProjectTab(tab) {
    document.querySelectorAll('.modal-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.modal-tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `md-tab-${tab}`);
    });
  }

  function renderProjectModalContent(p, tab = 'script') {
    const hasScript = !!(p.scriptContent && p.scriptContent.trim());
    const hasAnalysis = !!(p.analysisContent && p.analysisContent.trim());

    const scriptEl = document.getElementById('md-script');
    const scriptEmpty = document.getElementById('md-script-empty');
    const tSection = document.getElementById('md-ttsSection');
    if (hasScript) {
      scriptEl.textContent = p.scriptContent;
      scriptEl.style.display = '';
      scriptEmpty.style.display = 'none';
      tSection.style.display = '';
      resetMdTtsUI();
    } else {
      scriptEl.style.display = 'none';
      scriptEmpty.style.display = '';
      tSection.style.display = 'none';
    }

    const analysisEl = document.getElementById('md-analysis');
    const analysisEmpty = document.getElementById('md-analysis-empty');
    if (hasAnalysis) {
      analysisEl.style.display = '';
      analysisEmpty.style.display = 'none';
      renderAnalysisResult(p.analysisContent, 'md-analysis');
    } else {
      analysisEl.style.display = 'none';
      analysisEl.innerHTML = '';
      analysisEmpty.style.display = '';
    }

    const defaultTab = tab || (hasScript ? 'script' : 'analysis');
    switchProjectTab(defaultTab);
  }

  function openProject(id, tab = 'script') {
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

    renderProjectModalContent(p, tab);

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

  async function deleteFromTable(id) {
    if (!confirm('삭제하시겠습니까?')) return;
    const ok = await deleteProject(id);
    if (!ok) return;
    renderProjectsTable();
    toast('삭제되었습니다.', 'success');
  }

  // ═══════════════════════════════════════════════════════
  // PAGE: Settings
  // ═══════════════════════════════════════════════════════
  function initSettings() {
    loadApiStatus();

    // Load saved model — if previously saved a paid-only model, fall back to free default
    const modelSel = document.getElementById('geminiModel');
    if (modelSel) {
      const saved = getModel();
      modelSel.value = saved;
      if (!FREE_MODELS.includes(saved)) {
        // Show warning inline if a paid model is currently selected
        const warn = document.createElement('p');
        warn.style.cssText = 'font-size:0.78rem;color:#f59e0b;margin-top:4px';
        warn.textContent = `⚠️ 현재 선택된 모델(${saved})은 유료 전용입니다. 무료 API 키 사용 시 permission error가 발생합니다.`;
        modelSel.parentNode.insertBefore(warn, modelSel.nextSibling);
      }
    }

    // 발음 교정 체크박스 초기 상태
    const pronChk = document.getElementById('pronunciation-enabled');
    if (pronChk) {
      const enabled = localStorage.getItem(PRON_KEY) !== 'false';
      pronChk.checked = enabled;
      _updatePronBadge(enabled);
    }

    // 발음 사전 목록 로드
    loadPronunciationDict();
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
    const isFreeTier = FREE_MODELS.includes(sel.value);
    if (!isFreeTier) {
      toast(`${sel.value} 저장됨. ⚠️ 유료 전용 모델 — 무료 API 키로 사용 시 PERMISSION_DENIED 오류 발생`, 'info');
    } else {
      toast('모델 설정이 저장되었습니다.', 'success');
    }
  }

  // ─── 발음 교정 설정 ───────────────────────────────────────
  function _updatePronBadge(enabled) {
    const badge = document.getElementById('pronunciation-badge');
    if (!badge) return;
    badge.textContent = enabled ? 'ON' : 'OFF';
    badge.style.background = enabled ? 'var(--accent-light)' : 'var(--bg-hover)';
    badge.style.color = enabled ? 'var(--accent)' : 'var(--text-3)';
  }

  function savePronunciationSetting() {
    const chk = document.getElementById('pronunciation-enabled');
    if (!chk) return;
    localStorage.setItem(PRON_KEY, chk.checked ? 'true' : 'false');
    _updatePronBadge(chk.checked);
    toast(`발음 교정 ${chk.checked ? '활성화' : '비활성화'}됨`, 'success');
  }

  async function loadPronunciationDict() {
    const tbody = document.getElementById('pron-dict-body');
    if (!tbody) return;
    try {
      const list = await get('/api/pronunciation');
      if (!Array.isArray(list)) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--red)">로드 실패</td></tr>';
        return;
      }
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-3)">등록된 항목이 없습니다.</td></tr>';
        return;
      }
      tbody.innerHTML = list.map(e => `
        <tr>
          <td><code>${esc(e.src)}</code></td>
          <td><code>${esc(e.dst)}</code></td>
          <td>
            <button type="button" class="btn btn-danger btn-sm pron-del-btn" style="padding:2px 8px;font-size:11px"
              data-pron-del="${esc(e.src)}">삭제</button>
          </td>
        </tr>
      `).join('');
      tbody.querySelectorAll('.pron-del-btn').forEach(btn => {
        btn.addEventListener('click', () => deletePronunciationEntry(btn.dataset.pronDel));
      });
    } catch {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--red)">로드 실패</td></tr>';
    }
  }

  async function savePronunciationEntry() {
    const src = document.getElementById('pron-src')?.value.trim();
    const dst = document.getElementById('pron-dst')?.value.trim();
    if (!src || !dst) { toast('원본 단어와 발음 표기를 모두 입력하세요.', 'error'); return; }
    try {
      await post('/api/pronunciation', { src, dst });
      document.getElementById('pron-src').value = '';
      document.getElementById('pron-dst').value = '';
      toast(`"${src}" → "${dst}" 저장됨`, 'success');
      loadPronunciationDict();
    } catch { toast('저장 실패', 'error'); }
  }

  async function deletePronunciationEntry(src) {
    if (!confirm(`"${src}" 항목을 삭제하시겠습니까?`)) return;
    try {
      await fetch(`/api/pronunciation/${encodeURIComponent(src)}`, { method: 'DELETE' });
      toast(`"${src}" 삭제됨`, 'success');
      loadPronunciationDict();
    } catch { toast('삭제 실패', 'error'); }
  }

  async function exportProjects() {
    try {
      const data = await get('/api/projects');
      if (data.error) { toast(data.error, 'error'); return; }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `shortshelper-projects-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast('내보내기 실패', 'error'); }
  }

  async function clearProjects() {
    if (!confirm('모든 프로젝트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      await fetchProjects(true);
      for (const p of [...getProjects()]) {
        await deleteProject(p.id);
      }
      await fetchProjects(true);
      toast('모든 프로젝트 데이터가 삭제되었습니다.', 'success');
    } catch { toast('삭제 실패', 'error'); }
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

  // ─── Benchmark ─────────────────────────────────────────
  function initBenchmark() {
    const channelsEl   = document.getElementById('bmChannels');
    const verifyBtn    = document.getElementById('bmVerifyBtn');
    const resetChBtn   = document.getElementById('bmResetChannelsBtn');
    const runBtn       = document.getElementById('bmRunBtn');
    const stopBtn      = document.getElementById('bmStopBtn');
    const startDateEl  = document.getElementById('bmStartDate');
    const endDateEl    = document.getElementById('bmEndDate');
    const sortSelect   = document.getElementById('bmSortSelect');

    if (!channelsEl) return;

    // 기본 날짜: 최근 30일
    const today = new Date();
    const ago30 = new Date(today); ago30.setDate(today.getDate() - 30);
    const fmt = d => d.toISOString().slice(0, 10);
    if (startDateEl && !startDateEl.value) startDateEl.value = fmt(ago30);
    if (endDateEl && !endDateEl.value) endDateEl.value = fmt(today);

    let pollTimer = null;
    let vaPollTimer = null;
    let resultData = null;
    let activeTab = 'raw';
    let videoRowMap = {};
    let currentVaResult = null;
    let currentVaRow = null;

    function setStatusBadge(status) {
      const badge = document.getElementById('bmStatusBadge');
      if (!badge) return;
      const map = {
        idle: ['대기 중', 'badge-draft'],
        waiting: ['대기 중', 'badge-draft'],
        running: ['진행 중', 'badge-active'],
        done: ['완료', 'badge-active'],
        error: ['오류', 'badge-shorts'],
        stopped: ['중지됨', 'badge-draft'],
      };
      const [text, cls] = map[status] || ['대기 중', 'badge-draft'];
      badge.textContent = text;
      badge.className = 'bm-status-badge badge ' + cls;
    }

    function updateProgress(status) {
      setStatusBadge(status.status || 'idle');
      const pct = status.progress || 0;
      const fill = document.getElementById('bmProgressFill');
      const txt  = document.getElementById('bmProgressText');
      if (fill) fill.style.width = pct + '%';
      if (txt) txt.textContent = pct + '%';
      const ch = document.getElementById('bmCurrentChannel');
      if (ch) ch.textContent = status.current_channel || '-';
      const logBox = document.getElementById('bmLogBox');
      if (logBox && status.logs && status.logs.length) {
        logBox.textContent = status.logs.join('\n');
        logBox.scrollTop = logBox.scrollHeight;
      }
      const running = status.status === 'running';
      if (runBtn) runBtn.disabled = running;
      if (stopBtn) stopBtn.classList.toggle('hidden', !running);
    }

    async function verifyChannels() {
      verifyBtn.disabled = true;
      try {
        const data = await post('/api/benchmark/channels', {
          channels_text: channelsEl.value,
        });
        if (data.error) { toast(data.error, 'error'); return; }
        renderChannelTable(data.channels || []);
        show('bmChannelResult');
        toast(`채널 확인 완료: 성공 ${data.okCount} / 오류 ${data.errorCount}`, 'success');
      } catch {
        toast('채널 확인 중 오류', 'error');
      } finally {
        verifyBtn.disabled = false;
      }
    }

    function renderChannelTable(channels) {
      const tbody = document.getElementById('bmChannelTbody');
      if (!tbody) return;
      tbody.innerHTML = channels.map((c, i) => {
        const ok = !c.error;
        return `<tr>
          <td>${i + 1}</td>
          <td>${esc(c.title || c.input || '-')}</td>
          <td>${ok ? fmtNum(c.subscriberCount) : '-'}</td>
          <td>${ok ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">링크</a>` : esc(c.input || '')}</td>
          <td>${ok ? '<span class="badge badge-active">확인</span>' : `<span class="badge badge-shorts">${esc(c.error)}</span>`}</td>
        </tr>`;
      }).join('');
    }

    function getRunParams() {
      return {
        channels_text: channelsEl.value,
        start_date: startDateEl.value,
        end_date: endDateEl.value,
        min_views: parseInt(document.getElementById('bmMinViews').value, 10) || 50000,
        max_videos_per_channel: parseInt(document.getElementById('bmMaxVideos').value, 10) || 50,
        max_shorts_seconds: parseInt(document.getElementById('bmMaxSeconds').value, 10) || 75,
        analysis_mode: document.getElementById('bmAnalysisMode').value,
        whisper_model: document.getElementById('bmWhisperModel').value,
      };
    }

    async function startRun() {
      if (!startDateEl.value || !endDateEl.value) {
        toast('시작일과 종료일을 입력하세요.', 'error'); return;
      }
      runBtn.disabled = true;
      try {
        const data = await post('/api/benchmark/run', getRunParams());
        if (data.error) { toast(data.error, 'error'); runBtn.disabled = false; return; }
        toast('벤치마킹 분석을 시작합니다.', 'success');
        startPolling();
      } catch {
        toast('분석 시작 실패', 'error');
        runBtn.disabled = false;
      }
    }

    async function stopRun() {
      try {
        await post('/api/benchmark/stop', {});
        toast('분석 중지 요청됨', 'success');
      } catch { toast('중지 실패', 'error'); }
    }

    function startPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(pollStatus, 2000);
      pollStatus();
    }

    async function pollStatus() {
      try {
        const status = await get('/api/benchmark/status');
        updateProgress(status);
        if (status.status === 'done' || status.status === 'error' || status.status === 'stopped') {
          clearInterval(pollTimer);
          pollTimer = null;
          if (runBtn) runBtn.disabled = false;
          if (stopBtn) stopBtn.classList.add('hidden');
          if (status.status === 'error' && status.error) toast(status.error, 'error');
          await loadResult();
        }
      } catch { /* ignore poll errors */ }
    }

    function sortRawRows(rows, sortKey) {
      const copy = [...rows];
      if (sortKey === 'views_desc') copy.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
      else if (sortKey === 'count_desc') {
        const cnt = {};
        copy.forEach(r => { const k = r.product_name || ''; cnt[k] = (cnt[k] || 0) + 1; });
        copy.sort((a, b) => (cnt[b.product_name] || 0) - (cnt[a.product_name] || 0));
      } else if (sortKey === 'channel_asc') copy.sort((a, b) => (a.channelTitle || '').localeCompare(b.channelTitle || ''));
      return copy;
    }

    function renderResults(data) {
      resultData = data;
      show('bmResultCard');
      show('bmSortRow');

      videoRowMap = {};
      (data.raw_rows || []).forEach(r => { if (r.id) videoRowMap[r.id] = r; });
      (data.top_videos || []).forEach(v => {
        if (v.id && !videoRowMap[v.id]) videoRowMap[v.id] = v;
      });

      const rawRows = sortRawRows(data.raw_rows || [], sortSelect ? sortSelect.value : 'views_desc');
      const rawTbody = document.getElementById('bmRawTbody');
      if (rawTbody) {
        rawTbody.innerHTML = rawRows.map((r, i) => `<tr>
          <td>${i + 1}</td>
          <td>${esc(r.channelTitle || '')}</td>
          <td>${esc(r.title || '')}</td>
          <td>${fmtNum(r.viewCount)}</td>
          <td>${r.id ? `<button type="button" class="btn btn-ghost btn-sm bm-analyze-btn" data-vid="${esc(r.id)}">🔍 분석</button>` : '-'}</td>
          <td>${esc(r.publishedAt || '')}</td>
          <td>${esc(r.durationLabel || '')}</td>
          <td>${esc(r.product_name || '')}</td>
          <td>${esc(r.brand || '')}</td>
          <td>${esc(r.category || '')}</td>
          <td><a href="${esc(r.url)}" target="_blank" rel="noopener">보기</a></td>
        </tr>`).join('') || '<tr><td colspan="11" class="empty-row">데이터 없음</td></tr>';
      }

      const tpTbody = document.getElementById('bmTopProductsTbody');
      if (tpTbody) {
        tpTbody.innerHTML = (data.top_products || []).map(p => `<tr>
          <td>${p.rank}</td><td>${esc(p.product_name)}</td><td>${p.count}</td>
          <td>${fmtNum(p.total_views)}</td><td>${fmtNum(p.avg_views)}</td>
        </tr>`).join('') || '<tr><td colspan="5" class="empty-row">데이터 없음</td></tr>';
      }

      const tvTbody = document.getElementById('bmTopVideosTbody');
      if (tvTbody) {
        tvTbody.innerHTML = (data.top_videos || []).map(v => `<tr>
          <td>${esc(v.channel)}</td><td>${esc(v.title)}</td>
          <td>${fmtNum(v.viewCount)}</td>
          <td>${v.id ? `<button type="button" class="btn btn-ghost btn-sm bm-analyze-btn" data-vid="${esc(v.id)}">🔍 분석</button>` : '-'}</td>
          <td><a href="${esc(v.url)}" target="_blank" rel="noopener">보기</a></td>
        </tr>`).join('') || '<tr><td colspan="5" class="empty-row">데이터 없음</td></tr>';
      }

      const sumTbody = document.getElementById('bmSummaryTbody');
      if (sumTbody) {
        sumTbody.innerHTML = (data.product_summary || []).map(s => `<tr>
          <td>${esc(s.product_name)}</td><td>${s.count}</td>
          <td>${fmtNum(s.total_views)}</td><td>${fmtNum(s.avg_views)}</td>
        </tr>`).join('') || '<tr><td colspan="4" class="empty-row">데이터 없음</td></tr>';
      }

      const patList = document.getElementById('bmPatternsList');
      if (patList) {
        patList.innerHTML = (data.title_patterns || []).map(p => `<li>${esc(p)}</li>`).join('')
          || '<li class="empty-row">패턴 없음</li>';
      }

      setupDownloads(data.files || {});
    }

    function setupDownloads(files) {
      const map = { bmDlRaw: files.raw, bmDlProducts: files.products, bmDlPatterns: files.patterns };
      Object.entries(map).forEach(([id, fname]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.onclick = fname
          ? () => { window.open('/api/benchmark/download/' + encodeURIComponent(fname), '_blank'); }
          : null;
        btn.disabled = !fname;
      });
    }

    async function loadResult() {
      try {
        const data = await get('/api/benchmark/result');
        if (data.error) return;
        renderResults(data);
      } catch { /* no result yet */ }
    }

    function switchTab(tab) {
      activeTab = tab;
      document.querySelectorAll('.bm-tabs .tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
      });
      const panels = { raw: 'bmTabRaw', products: 'bmTabProducts', videos: 'bmTabVideos', patterns: 'bmTabPatterns', summary: 'bmTabSummary' };
      Object.entries(panels).forEach(([k, id]) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', k !== tab);
      });
      if (sortSelect) sortSelect.parentElement.classList.toggle('hidden', tab !== 'raw' && tab !== 'summary');
    }

    // ── 영상 심층 분석 ──────────────────────────────────────
    function openAnalysisPanel(row) {
      currentVaRow = row;
      show('bmAnalysisPanel');
      document.getElementById('bmResultsLayout')?.classList.add('with-panel');
      document.getElementById('bmVaTitle').textContent = row.title || row.url || '-';
    }

    function closeAnalysisPanel() {
      hide('bmAnalysisPanel');
      document.getElementById('bmResultsLayout')?.classList.remove('with-panel');
      if (vaPollTimer) { clearInterval(vaPollTimer); vaPollTimer = null; }
    }

    function switchVaTab(tab) {
      document.querySelectorAll('.bm-va-tabs .tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.vtab === tab);
      });
      ['product','features','selling','hook','cta','structure','frames'].forEach(k => {
        const el = document.getElementById('bmVa' + k.charAt(0).toUpperCase() + k.slice(1));
        if (el) el.classList.toggle('hidden', k !== tab);
      });
    }

    function renderVaResult(result) {
      currentVaResult = result;
      hide('bmVaProgress');

      const grid = document.getElementById('bmVaProduct');
      if (grid) {
        grid.innerHTML = `
          <div><span class="info-label">상품명</span><span class="info-val">${esc(result.product_name || '-')}</span></div>
          <div><span class="info-label">브랜드</span><span class="info-val">${esc(result.brand || '-')}</span></div>
          <div><span class="info-label">카테고리</span><span class="info-val">${esc(result.category || '-')}</span></div>
          <div><span class="info-label">제품 유형</span><span class="info-val">${esc(result.product_type || '-')}</span></div>`;
      }

      const fillList = (id, items) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = (items || []).map(x => `<li>${esc(x)}</li>`).join('') || '<li>-</li>';
      };
      fillList('bmVaFeaturesList', result.features);
      fillList('bmVaSellingList', result.selling_points);

      const hookEl = document.getElementById('bmVaHookText');
      if (hookEl) hookEl.textContent = result.hook || '-';
      const ctaEl = document.getElementById('bmVaCtaText');
      if (ctaEl) ctaEl.textContent = result.cta || '-';

      const structEl = document.getElementById('bmVaStructureList');
      if (structEl) {
        structEl.innerHTML = (result.structure || []).map(s => `
          <div class="bm-structure-item">
            <strong>${esc(s.time || s.section || '')}</strong>
            <span>${esc(s.section || '')}</span>
            <p>${esc(s.description || '')}</p>
          </div>`).join('') || '<p class="empty-row">구조 정보 없음</p>';
      }

      const frameGrid = document.getElementById('bmVaFrameGrid');
      if (frameGrid) {
        frameGrid.innerHTML = (result.frames || []).map(f => `
          <img src="${esc(f.url)}" alt="프레임 ${f.index}" class="bm-frame-thumb" data-src="${esc(f.url)}" loading="lazy" />`
        ).join('') || '<p class="empty-row">프레임 없음</p>';
        frameGrid.querySelectorAll('.bm-frame-thumb').forEach(img => {
          img.addEventListener('click', () => {
            const modal = document.getElementById('bmVaFrameModal');
            const large = document.getElementById('bmVaFrameLarge');
            if (modal && large) {
              large.src = img.dataset.src;
              modal.classList.remove('hidden');
            }
          });
        });
      }

      const whyEl = document.getElementById('bmVaWhyPopular');
      if (whyEl) {
        if (result.why_popular) {
          whyEl.textContent = '💡 ' + result.why_popular;
          whyEl.classList.remove('hidden');
        } else {
          whyEl.classList.add('hidden');
        }
      }
      switchVaTab('product');
    }

    async function pollVideoAnalysis(videoId) {
      try {
        const data = await get('/api/benchmark/video-analysis/' + encodeURIComponent(videoId));
        const fill = document.getElementById('bmVaProgressFill');
        const msg  = document.getElementById('bmVaProgressMsg');

        if (data.status === 'running') {
          show('bmVaProgress');
          if (fill) fill.style.width = (data.progress || 5) + '%';
          if (msg) msg.textContent = data.message || '분석 중...';
          return;
        }

        if (vaPollTimer) { clearInterval(vaPollTimer); vaPollTimer = null; }

        if (data.status === 'done' && data.result) {
          renderVaResult(data.result);
          toast('영상 분석 완료', 'success');
        } else if (data.status === 'error') {
          hide('bmVaProgress');
          toast(data.error || data.message || '분석 실패', 'error');
        } else if (data.status === 'idle') {
          if (msg) msg.textContent = '분석 대기 중...';
        } else {
          hide('bmVaProgress');
          toast('알 수 없는 분석 상태입니다. 다시 시도하세요.', 'error');
        }
      } catch (e) {
        if (vaPollTimer) { clearInterval(vaPollTimer); vaPollTimer = null; }
        hide('bmVaProgress');
        toast('분석 상태 조회 실패', 'error');
      }
    }

    async function startVideoAnalysis(row) {
      if (!row || !row.id) { toast('영상 ID가 없습니다.', 'error'); return; }
      if (vaPollTimer) { clearInterval(vaPollTimer); vaPollTimer = null; }

      openAnalysisPanel(row);
      show('bmVaProgress');
      document.getElementById('bmVaProgressFill').style.width = '2%';
      document.getElementById('bmVaProgressMsg').textContent = '분석 요청 중...';

      const whisper = document.getElementById('bmWhisperModel')?.value || 'tiny';
      const payload = {
        video_id: row.id,
        url: row.url || `https://www.youtube.com/shorts/${row.id}`,
        title: row.title || '',
        channel_name: row.channelTitle || row.channel || '',
        description: row.description || '',
        product_name: row.product_name || '',
        category: row.category || '',
        whisper_model: whisper,
      };

      try {
        const data = await post('/api/benchmark/video-analysis', payload);
        if (data.error) {
          toast(data.error, 'error');
          hide('bmVaProgress');
          return;
        }
        if (data.status === 'done' && data.result) {
          renderVaResult(data.result);
          toast('저장된 분석 결과를 불러왔습니다.', 'success');
          return;
        }
        document.getElementById('bmVaProgressMsg').textContent = data.message || '분석 시작...';
        vaPollTimer = setInterval(() => pollVideoAnalysis(row.id), 1500);
        pollVideoAnalysis(row.id);
      } catch {
        toast('영상 분석 시작 실패', 'error');
        hide('bmVaProgress');
      }
    }

    async function saveVaMaterial() {
      if (!currentVaResult) { toast('분석 결과가 없습니다.', 'error'); return; }
      await registerMaterial({
        product_name: currentVaResult.product_name,
        category: currentVaResult.category,
        features: currentVaResult.features,
        hook: currentVaResult.hook,
        cta: currentVaResult.cta,
        selling_points: currentVaResult.selling_points,
        video_id: currentVaResult.video_id,
        video_url: currentVaResult.video_url,
        channel_name: currentVaResult.channel_name,
        video_title: currentVaResult.video_title,
      }, 'benchmark');
    }

    function goScriptFromVa() {
      if (!currentVaResult) { toast('분석 결과가 없습니다.', 'error'); return; }
      const features = [
        ...(currentVaResult.features || []),
        ...(currentVaResult.selling_points || []),
      ].filter(Boolean).join(', ');
      goScript({
        name: currentVaResult.product_name || '',
        category: currentVaResult.category || '기타',
        features,
        target: '',
        hook: currentVaResult.hook || '',
        videoTitle: currentVaResult.video_title || '',
      });
    }

    function goVideoFromVa() {
      if (!currentVaResult) { toast('분석 결과가 없습니다.', 'error'); return; }
      sessionStorage.setItem('sh_video_gen', JSON.stringify(currentVaResult));
      toast('영상 생성 모듈로 분석 데이터를 전달했습니다. (준비 중)', 'success');
    }

    document.getElementById('bmResultCard')?.addEventListener('click', e => {
      const btn = e.target.closest('.bm-analyze-btn');
      if (!btn) return;
      const row = videoRowMap[btn.dataset.vid];
      if (row) startVideoAnalysis(row);
    });

    document.getElementById('bmAnalysisClose')?.addEventListener('click', closeAnalysisPanel);
    document.querySelectorAll('.bm-va-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchVaTab(btn.dataset.vtab));
    });
    document.getElementById('bmVaFrameModal')?.addEventListener('click', () => {
      hide('bmVaFrameModal');
    });
    document.getElementById('bmVaSaveMaterial')?.addEventListener('click', saveVaMaterial);
    document.getElementById('bmVaGoScript')?.addEventListener('click', goScriptFromVa);
    document.getElementById('bmVaGoVideo')?.addEventListener('click', goVideoFromVa);

    verifyBtn.addEventListener('click', verifyChannels);
    resetChBtn.addEventListener('click', () => {
      channelsEl.value = channelsEl.dataset.default || '';
    });
    runBtn.addEventListener('click', startRun);
    stopBtn.addEventListener('click', stopRun);

    document.querySelectorAll('.bm-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        if (resultData) renderResults(resultData);
      });
    }

    // 페이지 로드 시 진행/결과 복원
    get('/api/benchmark/status').then(status => {
      updateProgress(status);
      if (status.status === 'running') startPolling();
      else if (status.status === 'done' || status.status === 'stopped') loadResult();
    });
  }

  // ─── Init router ───────────────────────────────────────
  function init() {
    initSidebar();
    checkApiStatus();
    const page = document.body.dataset.page;
    if      (page === 'dashboard') initDashboard();
    else if (page === 'explore')   initExplore();
    else if (page === 'extractor') initExtractor();
    else if (page === 'benchmark')  initBenchmark();
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
    savePronunciationSetting, savePronunciationEntry, deletePronunciationEntry,
    exportProjects, clearProjects,
    goScript, analyzeKeyword,
    openProject, goScriptFromProject, deleteFromTable,
    importProjectsFromFile,
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
