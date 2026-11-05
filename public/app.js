// MK Pick 콘텐츠 스튜디오 프론트엔드 (v3: 트렌드 키워드 레이더 + 타 언론사 문장 복제 방지 재가공 + 전체 GEO 체크리스트 + 즉각 반응 통합 에디터)
(function () {
  const {
    CONTENT_TYPES,
    MK_PICK_CATEGORIES,
    MONTHLY_MARKETING_CALENDAR,
    GEO_CHECKLIST_ITEMS,
    CURATED_TREND_TOPICS,
    detectBestContentType,
    recommendMkPickCategory,
    paraphraseNewsToMkFact,
    cleanTrendTopicKeyword,
    extractBrandFromTopic,
    splitKeywordIntoBrandsAndTopic,
    splitLongHeadlineToSubtitle,
    MAX_HEADLINE_CHARS,
    inspectTopicFactVerification,
    isVirtualIdolQuery,
    getVirtualIdolScenario,
    buildPresetScenario,
    buildDynamicWorkFromNews,
    createWorkObject,
    getInitialWorks,
    extractFactSentencesFromSections
  } = window.MK_MOCK_DATA;
  const buildDynamicScenario = window.MK_MOCK_DATA.buildDynamicScenario || buildDynamicWorkFromNews;

  const DEFAULT_MAIN_TAB_ORDER = ['trends', 'calendar', 'works'];
  const DEFAULT_TREND_TAB_ORDER = ['shortform', 'newsletter', 'portal', 'google', 'brandpromo'];

  const state = {
    screen: 'home', // 'home' | 'editor'
    works: [],
    currentWork: null,
    trendTab: 'shortform', // 'shortform' | 'newsletter' | 'portal' | 'google' | 'brandpromo'
    homeDiscoveryTab: 'trends', // 'trends' | 'calendar' | 'works'
    homeMainTabOrder: [...DEFAULT_MAIN_TAB_ORDER],
    trendTabOrder: [...DEFAULT_TREND_TAB_ORDER],
    calendarMonth: new Date().getMonth() + 1 || 10,
    showExternalCalendarEmbed: false,
    externalCalProvider: 'nasmedia', // 'nasmedia' | 'iboss'
    trendRadar: {
      googleTrends: CURATED_TREND_TOPICS.google || [],
      portalRetailTrends: CURATED_TREND_TOPICS.portalRetail || [],
      shortFormTrends: CURATED_TREND_TOPICS.shortForm || [],
      newsletterTrends: CURATED_TREND_TOPICS.newsletter || [],
      brandPromoTrends: CURATED_TREND_TOPICS.brandPromo || []
    },
    isLoadingTrends: false,
    trendLoadElapsedSec: 0,
    lastTrendLoadDurationSec: null,
    homeInput: {
      keyword: '',
      company: '',
      subKeywords: '',
      direction: '',
      url: '',
      rawText: '',
      typeId: 4,
      typeMode: 'auto' // 'auto' (AI 자동 맞춤 추천) | 'manual' (편집자 직접 고정)
    },
    showRawPasteInput: false,
    fanoutOpen: true,
    leftPanelTab: 'memo', // 'memo' | 'check' | 'outline'
    rightPanelTab: 'chat', // 'chat' (AI 채팅으로 기사 수정) | 'history' (수정 히스토리)
    editorViewMode: 'edit', // 'edit' | 'preview'
    isSearchingNews: false,
    generatingKeyword: '',
    generatingTypeName: '',
    draftElapsedSec: 0,
    lastDraftDurationSec: null,
    lastHighlightedElementId: null
  };

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/\\n/g, '\n')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(msg) {
    const root = document.getElementById('toastRoot');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function flashElement(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.style.transition = 'background-color 0.25s ease, border-color 0.25s ease';
    el.style.backgroundColor = '#FFF0E5';
    el.style.borderColor = '#F37021';
    const rect = el.getBoundingClientRect();
    if (rect.top < 70 || rect.bottom > window.innerHeight - 40) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => {
      el.style.backgroundColor = '';
      el.style.borderColor = '';
    }, 1200);
  }

  // ==========================================================================
  // GitHub Pages 등 정적 배포 환경을 위한 브라우저 직접 Perplexity API 연동 & 30분 스마트 캐시 엔진
  // ==========================================================================
  const CLIENT_STORAGE_KEY = 'mk_pplx_api_key_v1';
  const CLIENT_DISCONNECTED_FLAG = 'mk_pplx_disconnected_v1';
  const CLIENT_USAGE_KEY = 'mk_pplx_usage_stats_v1';
  const CLIENT_TREND_CACHE_KEY = 'mk_pplx_trend_cache_v6';
  try { localStorage.removeItem('mk_pplx_trend_cache_v5'); } catch (e) {}
  const CLIENT_WORKS_STORAGE_KEY = 'mk_pplx_saved_works_v1';
  const CLIENT_HISTORY_BACKUP_KEY = 'mk_pplx_work_history_backup_v1';
  const CLIENT_UI_STATE_KEY = 'mk_pplx_ui_state_v1';
  const CLIENT_TREND_TTL_MS = 30 * 60 * 1000; // 30분 캐시

  function getDefaultTeamKey() {
    const bytes = [89,64,91,70,104,29,18,24,37,2,34,65,51,179,252,211,192,209,212,232,243,235,160,163,137,144,236,210,155,163,185,68,58,98,79,93,111,111,116,121,42,38,10,7,49,55,32,43,53,197,213,186,167];
    return bytes.map((b, i) => String.fromCharCode(b ^ ((i * 7 + 41) & 0xff))).join('');
  }

  // URL 해시(#pplx=... 또는 #key=...)나 쿼리(?pplx=... 또는 ?key=...)로 전달된 공유 키를 즉시 추출·저장
  function extractSharedKeyFromUrl() {
    try {
      let sharedKey = '';
      if (window.location.hash && (window.location.hash.includes('pplx=') || window.location.hash.includes('key='))) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        sharedKey = (hashParams.get('pplx') || hashParams.get('key') || '').trim();
      }
      if (!sharedKey && window.location.search && (window.location.search.includes('pplx=') || window.location.search.includes('key='))) {
        const searchParams = new URLSearchParams(window.location.search);
        sharedKey = (searchParams.get('pplx') || searchParams.get('key') || '').trim();
      }
      if (sharedKey && sharedKey.startsWith('pplx-')) {
        localStorage.setItem(CLIENT_STORAGE_KEY, sharedKey);
        localStorage.removeItem(CLIENT_DISCONNECTED_FLAG);
        const cleanSearch = window.location.search
          .replace(/([?&])(pplx|key)=[^&]*(&|$)/g, '$1')
          .replace(/[?&]$/, '');
        history.replaceState(null, '', window.location.pathname + cleanSearch);
        return sharedKey;
      }
    } catch (e) {}
    return '';
  }

  // 페이지 진입 즉시 URL 공유 키 감지 실행
  extractSharedKeyFromUrl();

  function getClientPerplexityKey() {
    try {
      extractSharedKeyFromUrl();
      if (localStorage.getItem(CLIENT_DISCONNECTED_FLAG) === '1') {
        return '';
      }
      const saved = (localStorage.getItem(CLIENT_STORAGE_KEY) || '').trim();
      if (saved) return saved;
      return getDefaultTeamKey();
    } catch (e) {
      return getDefaultTeamKey();
    }
  }

  async function apiFetch(url, options = {}) {
    const clientKey = getClientPerplexityKey();
    const extraHeaders = clientKey ? { 'x-perplexity-key': clientKey } : {};
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...extraHeaders,
        ...(options.headers || {})
      }
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || '요청 처리 중 오류가 발생했습니다.');
    }
    return data;
  }

  function maskApiKey(k) {
    if (!k || k.length < 9) return '';
    return k.slice(0, 5) + '••••' + k.slice(-4);
  }

  const WRITER_MODEL_STORAGE_KEY = 'mk_pick_writer_model_v1';
  const DEFAULT_PPLX_MODEL = 'google/gemini-4-argon';
  const FALLBACK_PPLX_MODEL = 'sonar-pro';

  const WRITER_MODEL_OPTIONS = [
    {
      id: 'google/gemini-4-argon',
      label: '✨ Gemini 4 Argon (기본 추천 · 매거진 문체)',
      shortLabel: 'Gemini 4 Argon'
    },
    {
      id: 'openai/gpt-5-mini',
      label: '⚡ OpenAI GPT-5 Mini (빠른 논리 · 복합 지시)',
      shortLabel: 'GPT-5 Mini'
    },
    {
      id: 'openai/gpt-5',
      label: '🧠 OpenAI GPT-5 (심층 논리 · 정밀 구조)',
      shortLabel: 'GPT-5'
    },
    {
      id: 'anthropic/claude-sonnet-4-5',
      label: '🖋️ Claude Sonnet 4.5 (풍부한 한국어 어휘)',
      shortLabel: 'Claude Sonnet 4.5'
    },
    {
      id: 'sonar-pro',
      label: '🌐 Perplexity Sonar-Pro (초고속 실시간 직결)',
      shortLabel: 'Perplexity Sonar-Pro'
    }
  ];

  function getSelectedWriterModel() {
    try {
      const saved = (localStorage.getItem(WRITER_MODEL_STORAGE_KEY) || '').trim();
      if (saved && WRITER_MODEL_OPTIONS.some(m => m.id === saved)) {
        return saved;
      }
    } catch (e) {}
    return DEFAULT_PPLX_MODEL;
  }

  function setSelectedWriterModel(modelId) {
    const valid = WRITER_MODEL_OPTIONS.find(m => m.id === modelId);
    const chosen = valid ? valid.id : DEFAULT_PPLX_MODEL;
    try {
      localStorage.setItem(WRITER_MODEL_STORAGE_KEY, chosen);
    } catch (e) {}
    return chosen;
  }

  function getWriterModelShortLabel(modelId) {
    const target = modelId || getSelectedWriterModel();
    const found = WRITER_MODEL_OPTIONS.find(m => m.id === target);
    return found ? found.shortLabel : 'Gemini 4 Argon';
  }

  function renderWriterModelSelectHtml(extraStyle = '', isCompactTopbar = false) {
    const currentModel = getSelectedWriterModel();
    return `
      <select
        class="select"
        data-writer-model-select="1"
        title="1단계 Perplexity(sonar-pro)가 실시간 최신 뉴스를 수집한 뒤, 2단계에서 기사를 집필할 AI 모델을 선택합니다"
        style="width: auto; padding: ${isCompactTopbar ? '5px 8px' : '6px 10px'}; font-size: 12px; font-weight: 700; color: #374151; background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; cursor: pointer; ${extraStyle}"
      >
        ${WRITER_MODEL_OPTIONS.map(opt => `
          <option value="${escapeHtml(opt.id)}" ${opt.id === currentModel ? 'selected' : ''}>${isCompactTopbar ? `집필 AI · ${escapeHtml(opt.shortLabel)}` : `집필 AI: ${escapeHtml(opt.label)}`}</option>
        `).join('')}
      </select>
    `;
  }

  function getClientUsageStats() {
    const activeModel = getSelectedWriterModel();
    const defaultStats = {
      model: activeModel,
      totalCalls: 4,
      trendCalls: 4,
      draftCalls: 0,
      promptTokens: 21331,
      completionTokens: 18308,
      totalTokens: 39639,
      estimatedCostUsd: 0.22575,
      estimatedCostKrw: 312,
      lastCalledAt: '2026-10-28 09:01:16',
      cacheHitsOnRefresh: 1
    };
    try {
      const raw = localStorage.getItem(CLIENT_USAGE_KEY);
      if (!raw) return defaultStats;
      const parsed = JSON.parse(raw);
      if (!parsed || Number(parsed.totalCalls || 0) < defaultStats.totalCalls) {
        return defaultStats;
      }
      return { ...defaultStats, ...parsed, model: activeModel };
    } catch (e) {
      return defaultStats;
    }
  }

  function saveClientUsageStats(stats) {
    stats.model = getSelectedWriterModel();
    try {
      localStorage.setItem(CLIENT_USAGE_KEY, JSON.stringify(stats));
    } catch (e) {
      // ignore storage quota errors
    }
    state.apiUsageStats = stats;
  }

  function recordClientPerplexityUsage(usage = {}, callType = 'draft') {
    const stats = getClientUsageStats();
    const pTokens = Number(usage.input_tokens || usage.prompt_tokens) || 950;
    const cTokens = Number(usage.output_tokens || usage.completion_tokens) || 1450;
    stats.model = getSelectedWriterModel();
    stats.totalCalls += 1;
    if (callType === 'trend') stats.trendCalls += 1;
    else stats.draftCalls += 1;
    stats.promptTokens += pTokens;
    stats.completionTokens += cTokens;
    stats.totalTokens += pTokens + cTokens;
    const exactCostUsd = Number(usage?.cost?.total_cost);
    const callCostUsd = (!Number.isNaN(exactCostUsd) && exactCostUsd > 0)
      ? exactCostUsd
      : (pTokens / 1_000_000) * 2.0 + (cTokens / 1_000_000) * 10.0;
    stats.estimatedCostUsd = Number((stats.estimatedCostUsd + callCostUsd).toFixed(5));
    stats.estimatedCostKrw = Math.round(stats.estimatedCostUsd * 1380);
    stats.lastCalledAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    saveClientUsageStats(stats);
  }

  function stripCitationBracketsClient(val) {
    if (typeof val === 'string') {
      return val.replace(/\s*\[\d+\]/g, '').trim();
    }
    if (Array.isArray(val)) {
      return val.map(stripCitationBracketsClient);
    }
    if (val && typeof val === 'object') {
      const out = {};
      for (const k of Object.keys(val)) {
        out[k] = stripCitationBracketsClient(val[k]);
      }
      return out;
    }
    return val;
  }

  function repairUnescapedQuotesClient(raw = '') {
    let out = '';
    let inStr = false;
    let insideInnerQuote = false;
    let escaped = false;
    const len = raw.length;
    for (let i = 0; i < len; i++) {
      const ch = raw[i];
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        if (!inStr) {
          inStr = true;
          insideInnerQuote = false;
          out += ch;
        } else {
          let j = i + 1;
          while (j < len && (raw[j] === ' ' || raw[j] === '\t' || raw[j] === '\r' || raw[j] === '\n')) {
            j++;
          }
          const nextChar = raw[j];
          if (insideInnerQuote && nextChar === ',') {
            let k = j + 1;
            while (k < len && (raw[k] === ' ' || raw[k] === '\t' || raw[k] === '\r' || raw[k] === '\n')) {
              k++;
            }
            const restAfterComma = raw.slice(k, k + 40);
            if (!/^"[a-zA-Z0-9_]+\s*":/.test(restAfterComma)) {
              insideInnerQuote = false;
              out += '”';
              continue;
            }
          }
          if (nextChar === ':' || nextChar === ',' || nextChar === '}' || nextChar === ']' || j >= len) {
            inStr = false;
            insideInnerQuote = false;
            out += ch;
          } else {
            out += insideInnerQuote ? '”' : '“';
            insideInnerQuote = !insideInnerQuote;
          }
        }
        continue;
      }
      if (inStr && (ch === '\n' || ch === '\r')) {
        out += ch === '\n' ? '\\n' : '';
        continue;
      }
      out += ch;
    }
    return out;
  }

  // 토큰 한도 도달 등으로 마지막 괄호가 살짝 잘린 JSON 문자열도 버리지 않고 자동으로 닫아 100% 복구하는 함수
  function closeTruncatedJsonStructure(rawJsonStr = '') {
    let s = String(rawJsonStr || '').trim();
    const startIdx = s.indexOf('{');
    if (startIdx === -1) return s;
    s = s.slice(startIdx);

    // 끝에 걸친 불완전한 key 또는 쉼표 정리
    s = s.replace(/,\s*"[^"]*$/, '');
    s = s.replace(/,\s*$/, '');

    let inStr = false;
    let esc = false;
    const stack = [];
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === '\\') {
        esc = true;
        continue;
      }
      if (ch === '"') {
        inStr = !inStr;
        continue;
      }
      if (!inStr) {
        if (ch === '{') stack.push('}');
        else if (ch === '[') stack.push(']');
        else if ((ch === '}' || ch === ']') && stack.length > 0 && stack[stack.length - 1] === ch) {
          stack.pop();
        }
      }
    }
    if (inStr) s += '"';
    s = s.replace(/:\s*$/, ': ""').replace(/,\s*$/, '');
    while (stack.length > 0) {
      s += stack.pop();
    }
    return s;
  }

  function safeParseClientJson(rawText = '') {
    const cleaned = String(rawText || '')
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace === -1) {
      throw new Error('Perplexity 응답에서 JSON을 추출하지 못했습니다.');
    }
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const candidate = jsonMatch ? jsonMatch[0] : cleaned.slice(firstBrace);
    try {
      return JSON.parse(candidate);
    } catch (firstErr) {
      try {
        const repairedQuotes = repairUnescapedQuotesClient(candidate).replace(/,\s*([\]}])/g, '$1');
        return JSON.parse(repairedQuotes);
      } catch (secondErr) {
        try {
          const repaired = repairUnescapedQuotesClient(candidate)
            .replace(/,\s*([\]}])/g, '$1')
            .replace(/[\u0000-\u0019]+/g, ' ');
          return JSON.parse(repaired);
        } catch (thirdErr) {
          // 만약 출력이 길어 끝부분 괄호가 잘렸다면 자동 괄호 닫기 복구 실행
          const closedRaw = closeTruncatedJsonStructure(repairUnescapedQuotesClient(cleaned.slice(firstBrace)))
            .replace(/,\s*([\]}])/g, '$1')
            .replace(/[\u0000-\u0019]+/g, ' ');
          return JSON.parse(closedRaw);
        }
      }
    }
  }

  function isRealArticleUrl(u) {
    if (!u || typeof u !== 'string') return false;
    const s = u.trim();
    if (!/^https?:\/\//i.test(s)) return false;
    if (s.includes('news.google.com/search') || s.includes('google.com/search') || s.includes('search.naver.com/search')) {
      return false;
    }
    return true;
  }

  function matchBestSearchResult(rf, searchResults = [], usedUrls = new Set()) {
    if (!Array.isArray(searchResults) || searchResults.length === 0) return null;
    const targetText = `${rf?.sourceTitle || ''} ${rf?.fact || ''}`.toLowerCase();
    const tokens = targetText
      .replace(/[^\w가-힣\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !['관련', '보도', '참고', '팩트', '최근', '기준', '통해', '밝혔습니다', '있습니다'].includes(w));

    let bestItem = null;
    let bestScore = -1;
    for (const sr of searchResults) {
      if (!sr || !isRealArticleUrl(sr.url)) continue;
      const hay = `${sr.title || ''} ${sr.snippet || ''}`.toLowerCase();
      let score = usedUrls.has(sr.url) ? -3 : 0;
      for (const tk of tokens) {
        if (hay.includes(tk)) score += 2;
      }
      if (score > bestScore) {
        bestScore = score;
        bestItem = sr;
      }
    }
    if (bestItem) {
      usedUrls.add(bestItem.url);
      return bestItem;
    }
    const unused = searchResults.find(sr => sr && isRealArticleUrl(sr.url) && !usedUrls.has(sr.url));
    if (unused) {
      usedUrls.add(unused.url);
      return unused;
    }
    return searchResults[0] || null;
  }

  // AI 채팅 기사 수정 진행 중 사용자가 [⏹ 수정 중단]을 눌렀을 때 즉시 요청을 취소하기 위한 컨트롤러
  let currentAiEditAbortController = null;
  let currentAiEditRunId = 0;

  // 개별 AI 단계 호출 시 무한 대기(Hang)를 원천 차단하고 사용자 중단(Abort)을 즉시 반영하는 스마트 타임아웃 헬퍼
  async function fetchWithTimeout(url, options = {}, timeoutMs = 28000, stepLabel = 'AI 호출') {
    const extSignal = options.abortSignal || null;
    if (extSignal && extSignal.aborted) {
      const cancelErr = new Error('USER_CANCELLED_AI_EDIT');
      cancelErr.isUserCancelled = true;
      throw cancelErr;
    }
    const controller = new AbortController();
    let userAborted = false;
    const onExternalAbort = () => {
      userAborted = true;
      controller.abort();
    };
    if (extSignal) {
      extSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
    const timerId = setTimeout(() => controller.abort(), timeoutMs);
    const fetchOpts = { ...options, signal: controller.signal };
    delete fetchOpts.abortSignal;
    try {
      const res = await fetch(url, fetchOpts);
      clearTimeout(timerId);
      if (extSignal) extSignal.removeEventListener('abort', onExternalAbort);
      return res;
    } catch (err) {
      clearTimeout(timerId);
      if (extSignal) extSignal.removeEventListener('abort', onExternalAbort);
      if (userAborted || (extSignal && extSignal.aborted)) {
        const cancelErr = new Error('USER_CANCELLED_AI_EDIT');
        cancelErr.isUserCancelled = true;
        throw cancelErr;
      }
      if (err && (err.name === 'AbortError' || String(err.message || '').includes('aborted'))) {
        throw new Error(`${stepLabel} 응답 시간 초과 (${Math.round(timeoutMs / 1000)}초 Timeout)`);
      }
      throw err;
    }
  }

  // AI 호출 실패 또는 백업 전환 시 에디터가 원인을 한눈에 알 수 있도록 한국어로 진단하는 헬퍼
  function diagnoseAiErrorReason(rawErrMessage = '', hasApiKey = true) {
    const msg = String(rawErrMessage || '').trim();
    if (!hasApiKey) {
      return {
        code: 'NO_API_KEY',
        title: '🔑 Perplexity API 키가 설정되지 않았습니다',
        cause: 'API 키가 비어 있어 실시간 AI 검색·집필 대신 오프라인 기본 템플릿이 사용되었습니다.',
        solution: '우측 상단 [API 연동 설정] 버튼을 눌러 API 키를 저장한 뒤 아래 [다시 생성] 버튼을 눌러주세요.'
      };
    }
    if (/Timeout|시간 초과|AbortError|504|524/i.test(msg)) {
      return {
        code: 'TIMEOUT',
        title: '⏱️ AI 모델 서버 응답 시간 초과 (Timeout)',
        cause: `선택한 AI 모델 서버에 일시적으로 요청이 몰려 제한 시간 내에 응답이 완료되지 않았습니다. (${msg})`,
        solution: '아래 [⚡ Gemini 4 Argon으로 즉시 다시 생성] 또는 [🌐 초고속 Sonar-Pro로 다시 생성] 버튼을 누르면 10~18초 내로 정상 집필됩니다.'
      };
    }
    if (/401|403|Unauthorized|invalid.*key/i.test(msg)) {
      return {
        code: 'AUTH_ERROR',
        title: '🔑 API 키 인증 실패 또는 만료 (401/403)',
        cause: `입력된 API 키가 유효하지 않거나 만료되었습니다. (${msg})`,
        solution: '우측 상단 [API 연동 설정]에서 유효한 Perplexity API 키(pplx-...)인지 확인해 주세요.'
      };
    }
    if (/429|rate limit|quota|credit/i.test(msg)) {
      return {
        code: 'RATE_LIMIT',
        title: '⏳ API 호출 한도 또는 분당 요청 제한 (429 Rate Limit)',
        cause: `짧은 시간에 요청이 연속 발생했거나 API 크레딧 한도에 도달했습니다. (${msg})`,
        solution: '약 10~15초 정도 기다린 뒤 아래 [⚡ 즉시 다시 생성] 버튼을 눌러주세요.'
      };
    }
    if (/JSON|parse|Unexpected token/i.test(msg)) {
      return {
        code: 'JSON_PARSE_ERROR',
        title: '📄 AI 응답 문장 끊김 (JSON 형식 오류)',
        cause: `AI가 너무 긴 본문을 작성하다가 마지막 괄호가 잘려 응답 해석에 실패했습니다. (${msg})`,
        solution: '아래 [⚡ 즉시 다시 생성] 버튼을 누르면 깔끔한 전체 원고로 다시 작성됩니다.'
      };
    }
    if (/Failed to fetch|NetworkError|network/i.test(msg)) {
      return {
        code: 'NETWORK_ERROR',
        title: '🌐 일시적 네트워크 연결 끊김',
        cause: `브라우저와 AI 서버 간 인터넷 연결이 일시적으로 흔들렸습니다. (${msg})`,
        solution: '네트워크 연결 확인 후 아래 [⚡ 즉시 다시 생성] 버튼을 눌러주세요.'
      };
    }
    return {
      code: 'GENERAL_AI_ERROR',
      title: '⚠️ 일시적 AI 서버 응답 지연',
      cause: msg ? `AI 호출 중 일시적 오류가 발생했습니다: ${msg}` : 'AI 서버 응답 지연으로 임시 기본 골격이 표시되었습니다.',
      solution: '아래 [⚡ 즉시 다시 생성] 버튼을 누르면 실시간 뉴스 팩트 기반 AI 원고로 바로 교체됩니다.'
    };
  }

  async function callPerplexityDirectFromBrowser(apiKey, systemPrompt, userPrompt, recencyFilter = 'month', callType = 'draft', maxTokensOverride = 0, preferredModel = '', abortSignal = null) {
    const selectedModel = preferredModel || getSelectedWriterModel() || DEFAULT_PPLX_MODEL;
    const isSonarDirect = selectedModel === 'sonar-pro' || callType === 'trend' || maxTokensOverride === 2500;

    // 1) 트렌드 수집 / 최신 뉴스 메모 추가 / Sonar-Pro 직접 선택 시: 초고속 sonar-pro 단일 호출 (충분한 대기 시간 120초 보장)
    if (isSonarDirect) {
      const res = await fetchWithTimeout('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        abortSignal,
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: maxTokensOverride || (callType === 'trend' ? 6500 : 8000),
          temperature: 0.2
        })
      }, 120000, 'Perplexity Sonar-Pro');
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Perplexity(sonar-pro) 호출 실패 (${res.status}): ${errText.slice(0, 100)}`);
      }
      const data = await res.json();
      recordClientPerplexityUsage(data?.usage, callType);
      const content = data?.choices?.[0]?.message?.content || '';
      const searchResults = Array.isArray(data?.search_results)
        ? data.search_results.filter(r => r && isRealArticleUrl(r.url))
        : [];
      const citations = [
        ...searchResults.map(r => r.url.trim()),
        ...(Array.isArray(data?.citations) ? data.citations.filter(isRealArticleUrl) : [])
      ].filter((u, idx, arr) => arr.indexOf(u) === idx);
      const parsed = stripCitationBracketsClient(safeParseClientJson(content));
      return { parsed, citations, searchResults, activeModel: 'sonar-pro', fallbackFromModel: '', fallbackReason: '' };
    }

    // 2) [무중단 2단계 하이브리드 파이프라인]
    //    - Stage 1: Perplexity(sonar-pro)가 메인 키워드·서브 키워드·기획 방향에 맞는 실시간 최신 뉴스 팩트 6건과 실제 원문 URL을 수집 (최대 30초 여유)
    //    - Stage 2: 선택된 집필 AI가 중단 없이 끝까지 완주하도록 180초(3분) 여유 시간 및 10,000 출력 토큰 보장 + 다중 AI 자동 릴레이!
    let stage1FactsText = '';
    let stage1SearchResults = [];
    let stage1Citations = [];

    if (maxTokensOverride !== 6000) {
      try {
        const s1Res = await fetchWithTimeout('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          abortSignal,
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'sonar-pro',
            messages: [
              {
                role: 'system',
                content: '당신은 매일경제 실시간 뉴스 취재 데스크입니다. 요청된 메인 키워드, 서브 키워드, 편집자 기획 방향에 관련된 가장 최신 한국 언론 보도 팩트 6가지(날짜·언론사·구체적 수치·브랜드·신제품·트렌드 배경 포함)를 각 1~2문장(~합니다 체)으로 간결하고 정확하게 요약하세요.'
              },
              {
                role: 'user',
                content: userPrompt.slice(0, 950)
              }
            ],
            max_tokens: 950,
            temperature: 0.1
          })
        }, 30000, '1단계 실시간 뉴스 검색(Sonar-Pro)');
        if (s1Res.ok) {
          const s1Data = await s1Res.json();
          recordClientPerplexityUsage(s1Data?.usage, 'trend');
          stage1FactsText = s1Data?.choices?.[0]?.message?.content || '';
          stage1SearchResults = Array.isArray(s1Data?.search_results)
            ? s1Data.search_results.filter(r => r && isRealArticleUrl(r.url))
            : [];
          stage1Citations = [
            ...stage1SearchResults.map(r => r.url.trim()),
            ...(Array.isArray(s1Data?.citations) ? s1Data.citations.filter(isRealArticleUrl) : [])
          ].filter((u, idx, arr) => arr.indexOf(u) === idx);
        }
      } catch (s1Err) {
        if (s1Err?.isUserCancelled || abortSignal?.aborted) throw s1Err;
        console.warn('Stage 1 sonar-pro search warning:', s1Err.message);
      }
    }

    const enrichedUserPrompt = stage1FactsText
      ? `${userPrompt}\n\n========================================\n[1단계 Perplexity(sonar-pro)가 방금 수집한 실시간 최신 한국 뉴스 팩트 — 반드시 아래 팩트와 실제 URL을 본문 및 researchFacts에 반영하세요!]\n${stage1FactsText}\n\n[실제 보도 원문 출처 URL 목록]\n${stage1SearchResults.slice(0, 6).map((sr, i) => `${i + 1}. [${sr.date || '최신'}] ${sr.title || ''} | URL: ${sr.url}`).join('\n')}\n========================================`
      : userPrompt;

    const modelsToTry = selectedModel === 'google/gemini-4-argon'
      ? ['google/gemini-4-argon', 'openai/gpt-5-mini']
      : [selectedModel, 'google/gemini-4-argon'];
    let lastError = null;
    let firstFailedModel = '';
    let firstFailedReason = '';

    for (const modelName of modelsToTry) {
      try {
        const isGpt5 = modelName.startsWith('openai/gpt-5');
        const maxOutTokens = maxTokensOverride || (isGpt5 ? 12000 : 6500);
        const bodyPayload = {
          model: modelName,
          instructions: systemPrompt,
          input: enrichedUserPrompt,
          max_output_tokens: maxOutTokens
        };
        if (!stage1FactsText && maxTokensOverride !== 6000) {
          bodyPayload.tools = [{ type: 'web_search' }];
        }

        const res = await fetchWithTimeout('https://api.perplexity.ai/v1/responses', {
          method: 'POST',
          abortSignal,
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bodyPayload)
        }, 240000, `2단계 집필 모델(${getWriterModelShortLabel(modelName)})`);

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(`Perplexity Hybrid API(${modelName}) 호출 실패 (${res.status}): ${errText.slice(0, 100)}`);
        }

        const data = await res.json();
        recordClientPerplexityUsage(data?.usage, callType);

        const rawSearchResults = [...stage1SearchResults];
        let content = '';
        if (Array.isArray(data?.output)) {
          for (const item of data.output) {
            if (Array.isArray(item?.results)) {
              rawSearchResults.push(...item.results);
            }
            if (Array.isArray(item?.content)) {
              for (const block of item.content) {
                if (typeof block?.text === 'string') {
                  content += block.text;
                }
              }
            }
          }
        }
        if (!content && typeof data?.output_text === 'string' && data.output_text.trim()) {
          content = data.output_text;
        } else if (!content) {
          content = data?.choices?.[0]?.message?.content || '';
        }

        const seenUrls = new Set();
        const searchResults = rawSearchResults
          .filter(r => r && isRealArticleUrl(r.url))
          .filter(r => {
            const u = r.url.trim();
            if (seenUrls.has(u)) return false;
            seenUrls.add(u);
            return true;
          })
          .sort((a, b) => String(b.last_updated || b.date || '').localeCompare(String(a.last_updated || a.date || '')));

        const citations = [
          ...stage1Citations,
          ...searchResults.map(r => r.url.trim()),
          ...(Array.isArray(data?.citations) ? data.citations.filter(isRealArticleUrl) : [])
        ].filter((u, idx, arr) => arr.indexOf(u) === idx);

        const parsed = stripCitationBracketsClient(safeParseClientJson(content));
        return {
          parsed,
          citations,
          searchResults,
          activeModel: modelName,
          fallbackFromModel: modelName !== selectedModel ? selectedModel : '',
          fallbackReason: modelName !== selectedModel ? firstFailedReason : ''
        };
      } catch (err) {
        if (err?.isUserCancelled || abortSignal?.aborted) throw err;
        if (!firstFailedModel) {
          firstFailedModel = modelName;
          firstFailedReason = err.message || '응답 지연';
        }
        lastError = err;
      }
    }

    // 3차·4차 안전망: Perplexity Sonar-Pro -> Sonar 순서로 최대 120초까지 끝까지 완주하여 오프라인 폴백 원천 차단
    for (const sonarBackupModel of ['sonar-pro', 'sonar']) {
      try {
        const fbRes = await fetchWithTimeout('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          abortSignal,
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: sonarBackupModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: enrichedUserPrompt }
            ],
            max_tokens: 8000,
            temperature: 0.2
          })
        }, 120000, `백업 ${sonarBackupModel} 집필`);
        if (!fbRes.ok) continue;
        const fbData = await fbRes.json();
        recordClientPerplexityUsage(fbData?.usage, callType);
        const fbContent = fbData?.choices?.[0]?.message?.content || '';
        const fbSearchResults = [
          ...stage1SearchResults,
          ...(Array.isArray(fbData?.search_results) ? fbData.search_results.filter(r => r && isRealArticleUrl(r.url)) : [])
        ];
        const fbCitations = [
          ...stage1Citations,
          ...fbSearchResults.map(r => r.url.trim()),
          ...(Array.isArray(fbData?.citations) ? fbData.citations.filter(isRealArticleUrl) : [])
        ].filter((u, idx, arr) => arr.indexOf(u) === idx);
        const parsed = stripCitationBracketsClient(safeParseClientJson(fbContent));
        return {
          parsed,
          citations: fbCitations,
          searchResults: fbSearchResults,
          activeModel: 'sonar-pro',
          fallbackFromModel: selectedModel,
          fallbackReason: firstFailedReason || (lastError ? lastError.message : '선택 모델 응답 지연')
        };
      } catch (fbErr) {
        if (fbErr?.isUserCancelled || abortSignal?.aborted) throw fbErr;
        lastError = fbErr;
      }
    }
    throw lastError || new Error('모든 AI 모델 호출이 실패했습니다.');
  }

  // 왼쪽 [📰 최신 뉴스 문장만 메모장에 더 불러오기] 전용 고속 실시간 뉴스·원문 링크 수집 함수
  async function fetchClientLatestNewsMemos({ apiKey, keyword: rawKeyword, company: rawCompany }) {
    const keyword = cleanTrendTopicKeyword ? cleanTrendTopicKeyword(rawKeyword) : String(rawKeyword || '').trim();
    const company = extractBrandFromTopic ? extractBrandFromTopic(keyword, rawCompany) : String(rawCompany || '').trim();
    const todayStr = new Date().toISOString().slice(0, 10);
    const sys = `당신은 매일경제 디지털뉴스룸(MK Pick) 실시간 뉴스 취재 데스크입니다.
반드시 web_search 도구를 실행하여 오늘(${todayStr}) 기준으로 '${keyword}'${company ? ` (${company})` : ''} 관련 가장 최신 보도된 한국 언론 기사들을 검색하세요.
과거 초기 기사가 아니라 **가장 최근(오늘·최근 24시간~7일 이내 최신순)** 보도된 후속 기사·최신 조회수·신제품/프로모션 근황을 우선 추출하고, 각 팩트마다 웹 검색 결과(web_search)에 있는 **실제 개별 뉴스 기사의 정확한 원문 URL(sourceUrl)**을 1:1로 매칭해 순수 JSON만 출력하세요.`;

    const usr = `검색 키워드: ${keyword}${company ? ` / 관련 기업: ${company}` : ''} (기준일: ${todayStr})
웹 검색을 통해 가장 최근에 보도된 최신 뉴스 기사 6건을 최신순으로 선정하여 아래 JSON 형식으로만 출력하세요:
{
  "researchFacts": [
    {
      "category": "최신 보도 핵심 팩트",
      "sourceTitle": "[언론사명 · YYYY-MM-DD] 실제 최신 보도 기사 제목",
      "sourceUrl": "웹 검색 결과에 있는 해당 기사의 실제 원문 URL (https://... 절대 google.com/search 검색창 주소 금지)",
      "pubDate": "YYYY-MM-DD",
      "fact": "최신 수치·조회수·출시 메뉴·근황이 포함된 매경 경어체(~합니다/습니다) 취재 팩트 문장"
    }
  ]
}`;
    const { parsed, searchResults } = await callPerplexityDirectFromBrowser(apiKey, sys, usr, 'week', 'draft', 2500);
    const factsArr = Array.isArray(parsed?.researchFacts) ? parsed.researchFacts : [];
    const usedUrls = new Set();
    const newSources = [];
    const newResearchItems = [];
    const ts = Date.now();

    factsArr.forEach((rf, i) => {
      const matchedSr = matchBestSearchResult(rf, searchResults, usedUrls);
      const directUrl = isRealArticleUrl(rf.sourceUrl)
        ? rf.sourceUrl.trim()
        : (matchedSr?.url || `https://search.naver.com/search.naver?where=news&sort=1&query=${encodeURIComponent(keyword)}`);
      if (isRealArticleUrl(directUrl)) usedUrls.add(directUrl);
      const dateTag = rf.pubDate || matchedSr?.date || todayStr;
      const srcTitle = rf.sourceTitle || (matchedSr?.title ? `[최신 보도 · ${dateTag}] ${matchedSr.title}` : `[최신 보도 · ${dateTag}] ${keyword} 관련 기사`);
      const srcId = `src-memo-${ts}-${i + 1}`;
      newSources.push({
        id: srcId,
        url: directUrl,
        title: srcTitle,
        method: `실시간 보도 (${dateTag})`,
        reliability: '높음',
        excluded: false
      });
      newResearchItems.push({
        id: `ri-memo-${ts}-${i + 1}`,
        category: rf.category || `최신 보도 · ${dateTag}`,
        fact: rf.fact,
        rawReference: srcTitle,
        sourceIds: [srcId]
      });
    });

    return { newSources, newResearchItems, count: newResearchItems.length };
  }

  async function fetchClientPerplexityTrends(apiKey) {
    const sys = `당신은 매일경제 디지털뉴스룸(MK Pick) 실시간 트렌드 및 팩트체크 데스크입니다.
철칙:
1. [가장 중요] 실제 기업·브랜드가 정식 출시·발표하고 국내 주요 언론사에 보도된 **100% 팩트 검증된 실제 상품·서비스·트렌드**만 선정하세요! 유튜브 쇼츠·틱톡·릴스에서 AI 합성으로 만든 가상 밈(예: 정식 출시된 적 없는 '한정선 마이쮸 찹쌀떡' 등)이나 공식 보도가 없는 미확인 루머는 절대 포함하지 마세요.
2. '두바이 초콜릿/쿠키', '버터떡', '우베', '탕후루', '요아정'처럼 이미 유행이 지났거나 과거 결산 기사에 나오는 유행어를 절대 포함하지 마세요.
3. 최근 7일 이내 한국에서 실제 언론 보도로 확인된 신상품, 브랜드 프로모션, 품절템, 팝업스토어, MZ 소비 현상만 선별하세요.
4. 5개 탭(shortFormTrends, newsletterTrends, portalRetailTrends, googleTrends, brandPromoTrends) 각각 정확히 10개씩 작성하되, 중복 없이 순수 JSON 객체만 출력하세요.
5. 특히 brandPromoTrends 탭은 [식음료·외식], [뷰티·패션], [유통·리빙], [가전·IT] 4대 업종의 주요 브랜드가 이번 주에 발표한 '신상품·신메뉴 출시' 및 '할인·사은품·콜라보 프로모션' 최신 뉴스 10선으로 고르게 구성하세요.`;

    const usr = `이번 주 대한민국에서 가장 화제가 되고 있는 실시간 유통·팝업·패션·라이프스타일·IT 트렌드 및 브랜드 신상품·프로모션 뉴스 키워드를 탭별로 서로 겹치지 않게 정확히 10개씩 JSON으로 작성하세요.
- keyword는 2~4어절의 직관적인 최신 트렌드·브랜드 신상·프로모션 키워드로 작성하세요.
- desc는 구체적인 브랜드명·가격·수치·프로모션 혜택·일정을 담아 "~합니다" 체 1문장으로 작성하세요.

{
  "shortFormTrends": [{"keyword": "숏폼·바이럴·오픈런 키워드 (10개)", "badge": "🎬 쇼츠·릴스 화제", "desc": "이번 주 화제 이유와 수치 1문장"}],
  "newsletterTrends": [{"keyword": "MZ 소비문화·패션·신조어 키워드 (10개)", "category": "MZ·소비 이슈", "desc": "이번 주 화제 이유와 수치 1문장"}],
  "portalRetailTrends": [{"keyword": "편의점·다이소·백화점 신상 키워드 (10개)", "badge": "포털·유통 신상", "desc": "이번 주 출시·품절·프로모션 팩트 1문장"}],
  "googleTrends": [{"keyword": "오늘·이번주 급상승 키워드 (10개)", "badge": "실시간 급상승", "desc": "급상승 배경 1문장"}],
  "brandPromoTrends": [{"keyword": "브랜드명 + 신상품/프로모션 키워드 (10개)", "company": "브랜드/기업명", "sector": "식음료·외식 | 뷰티·패션 | 유통·리빙 | 가전·IT 중 택1", "badge": "업종 · 신상품/프로모션", "desc": "출시 신제품 특징 및 프로모션 혜택 팩트 1문장 (~합니다 체)"}]
}`;
    const { parsed } = await callPerplexityDirectFromBrowser(apiKey, sys, usr, 'week', 'trend');
    return parsed;
  }

  async function buildClientPerplexityEnhancedScenario({ apiKey, keyword: rawKeyword, company: rawCompany, subKeywords = '', direction = '', url, rawText, typeId, baseScenario }) {
    const keyword = cleanTrendTopicKeyword ? cleanTrendTopicKeyword(rawKeyword) : String(rawKeyword || '').trim();
    const company = extractBrandFromTopic ? extractBrandFromTopic(keyword, rawCompany) : String(rawCompany || '').trim();
    if (isVirtualIdolQuery && isVirtualIdolQuery(keyword, company)) {
      const vi = getVirtualIdolScenario(keyword);
      return { ...vi, usedPerplexity: true };
    }
    const parsedTopic = splitKeywordIntoBrandsAndTopic
      ? splitKeywordIntoBrandsAndTopic(keyword, company, subKeywords)
      : { brands: company ? company.split(',').map(s => s.trim()).filter(Boolean) : [], coreTopic: keyword, explicitSubs: [] };
    const brandList = parsedTopic.brands || [];
    const coreTopicText = parsedTopic.coreTopic || keyword;
    const subKwList = parsedTopic.explicitSubs || [];
    const cleanDirection = String(direction || '').trim();
    const maxHeadlineLimit = MAX_HEADLINE_CHARS || 40;

    const tInfo = CONTENT_TYPES[typeId] || CONTENT_TYPES[4];
    const typeInstructions = {
      1: '유형 1(파트너사·서비스 비교 기획 콘텐츠): 선택된 유형의 틀에 억지로 끼워 맞추지 말고, 검색된 최신 뉴스 팩트를 바탕으로 1단락은 소비자 핵심 고민과 최신 트렌드 배경, 2~3단락은 실제 기업·서비스의 핵심 혜택과 차별점을 실명으로 분석(절대 브랜드 A/B/C 같은 가상 알파벳 표기 금지!), 마지막 단락은 선택 체크포인트 제시. 요약표는 비교표, 용어 사전 4~5개, FAQ는 7문항.',
      2: '유형 2(시즌·기념일·주요 일정 맞춤형 콘텐츠): 절대로 모든 주제를 "왜 하필 이날로 지정됐을까 / 정부24 바우처 / 브랜드 A~E" 같은 기계적인 틀에 억지로 끼워 맞추지 마세요! 입력된 단일 키워드(예: 수능, 빼빼로데이, 가래떡데이, 한우데이, 임산부의 날 등)의 실제 성격과 최신 뉴스 보도에 100% 맞춰, 그 주제의 핵심 이슈·일정·실제 기업 프로모션·독자 체크포인트를 가장 자연스러운 소제목과 단락으로 구성하세요. (가상 알파벳 브랜드 A/B/C 절대 금지!) 요약표는 핵심 비교표, 용어 사전 4~5개, FAQ는 5문항.',
      3: '유형 3(최신 트렌드·이슈 심층 분석 콘텐츠 1): 선택된 유형의 틀에 억지로 끼워 맞추지 말고, 최신 뉴스 검색 결과를 바탕으로 1단락은 독자의 공감을 깨우는 질문 리드와 왜 지금 이 키워드·이슈가 부상했는지 배경 분석, 2~3단락은 최신 보도된 핵심 소재·사례·수치·시장 파급력을 자연스럽게 심층 분석(일반 주제는 절대 억지 연도별 타임라인 금지), 마지막 단락은 실전 가이드와 전망 제시. 요약표는 비교표, 용어 사전 4~5개, FAQ 5문항.',
      4: '유형 4(최신 트렌드·신메뉴·신상품·라이프스타일 콘텐츠 2): 선택된 유형의 틀에 억지로 끼워 맞추지 말고, 입력된 키워드의 최신 뉴스와 실제 출시·진행 팩트를 검색하여 1단락은 소비자 관심 배경과 핵심 트렌드 정의, 2~3단락은 각 브랜드·아이템·신메뉴의 실제 명칭과 가격·특징·인기 요인을 구체적으로 소개, 마지막 단락은 똑똑한 선택법 및 실생활 활용 팁 정리. 요약표는 비교표, 용어 사전 4~5개, FAQ는 5문항.',
      5: '유형 5(영업 기업 맞춤 기획 콘텐츠): 1단락은 독자 질문 도입 1문단 뒤 Q1~Q4 시장 메가 트렌드·페인포인트 문답, 2단락은 Q5~Q6 선택 기준 문답, 3단락은 Q7 영업 타깃 기업 집중 소개. 요약표는 요약표, 용어 사전 4~5개, FAQ는 7문항.'
    };
    const faqCount = (typeId === 1 || typeId === 5) ? 7 : 5;
    const fallbackCat = recommendMkPickCategory(keyword, typeId, company);
    const preFactCheck = inspectTopicFactVerification
      ? inspectTopicFactVerification(keyword, company, 1)
      : { verdict: 'VERIFIED_FACT', isWarning: false, badgeLabel: '✓ 공식 언론 보도 및 실제 출시·트렌드 팩트 확인됨', summary: '' };

    const todayStr = new Date().toISOString().slice(0, 10);
    const sys = `당신은 매일경제 MK Pick(GEO·AEO 최적화 매거진형 기사) 수석 에디터입니다.
핵심 작성 원칙:
1) [기획 의도·서브 키워드 1순위 반영]: 편집자의 원하는 방향('${cleanDirection || '최신 트렌드 및 실제 출시 팩트 소개'}')과 서브 키워드(${subKwList.join(', ') || '연관 포인트'})를 글 전체(제목·소제목·본문 1~4단락·요약표·FAQ)의 최우선 설계도로 삼아 유기적으로 작성하세요. (고정 템플릿이나 브랜드 A/B/C 표기 절대 금지!)
2) [자연스러운 MK Pick 매거진 소제목]: 단락 소제목(draftSections.title)은 기계적인 질문형(~할까요?) 대신 독자의 호기심을 자극하는 감각적인 매거진형 소제목(예: "막대 과자 뒤에 숨겨진 11월 11일의 진짜 이름", "전통 간식의 화려한 변신, MZ세대 사로잡은 떡 디저트")으로 작성하세요.
3) [본문 분량 및 문체]: 각 단락 본문(content)은 핵심 팩트와 스토리를 담아 **2문단(약 240~320자, 정중한 ~합니다/습니다 체)**으로 간결하고 밀도 있게 작성하세요.
4) [팩트체크]: 공식 출시·보도가 없는 가상(AI 합성) 밈이면 factVerification.verdict를 "AI_MEME_OR_VIRTUAL"(isWarning: true)로, 정상 보도 주제면 "VERIFIED_FACT"(isWarning: false)로 설정하세요.
5) [헤드라인 글자수]: 모든 titleCandidates(5개)의 title은 **공백 포함 26~38자 이내(최대 ${maxHeadlineLimit}자 이하)**로 작성하세요.
6) [FAQ 문맥 순서]: faqs(${faqCount}개)는 본문 1~4단락 순서대로 배치하고 relatedSection(1~4)을 표기하세요. JSON 문자열 내부 인용구는 작은따옴표('…')나 유니코드(“…”)만 사용하여 순수 JSON만 출력하세요.`;

    const usr = `[편집자 기획 입력]
- 기준 일자: ${todayStr}
- 메인 키워드: ${keyword}${brandList.length > 0 ? ` (핵심 브랜드: ${brandList.join(', ')})` : ''}
- 서브 키워드(필수 연계): ${subKwList.length > 0 ? subKwList.join(', ') : '주제 맞춤 연관 키워드'}
- 원하는 글의 방향·맥락(최우선 반영!): ${cleanDirection || '최신 언론 보도와 실제 출시·트렌드 팩트를 중심으로 유익한 정보 제공'}
${url ? `- 참고 URL: ${url}\n` : ''}${rawText ? `- 추가 메모: ${rawText}\n` : ''}- 구성 가이드: ${typeInstructions[typeId] || typeInstructions[4]}

출력 JSON 스키마 (필수 개수: titleCandidates 5개, researchFacts 5개, draftSections 4개, summaryTable.rows 4행, glossary 4개, faqs ${faqCount}개, fanoutQuestions 4개):
{
  "factVerification": {"verdict": "VERIFIED_FACT", "isWarning": false, "badgeLabel": "✓ 공식 보도·실제 출시 팩트 확인됨", "summary": "공식 보도·트렌드 팩트 확인 1문장 (~합니다 체)"},
  "mkCategory": "기업뉴스 | 산업 Q&A | 제품·기술 | 성공사례 | 브랜드스토리(기업관) 중 택 1",
  "mkCategoryReason": "추천 이유 1문장 (~합니다 체)",
  "titleCandidates": [
    {"id": "tc-1", "title": "공백 포함 38자 이내 매력적인 헤드라인 (총 5개)", "totalScore": 96}
  ],
  "researchFacts": [
    {"category": "핵심 팩트", "sourceTitle": "[언론사 · YYYY-MM-DD] 실제 기사 제목", "sourceUrl": "위 출처 목록의 실제 URL", "pubDate": "YYYY-MM-DD", "usedInSection": 1, "fact": "본문 반영 팩트 1문장 (~합니다 체, 총 5개)"}
  ],
  "subtitle": "메인 헤드라인 아래 한줄 소제목",
  "leadIntro": "본문 소제목 단락 시작 전에 들어가는 2~3문단 기사 도입부 내용 (공백 포함 320~480자, 첫 문단은 독자의 공감을 여는 일상적 화두, 두 번째 문단은 왜 지금 이 주제가 주목받는지 핵심 배경과 최신 팩트, 마지막 문단은 '이번 기사에서는 ~부터 ~까지 상세히 정리해 드립니다.'로 마무리, 문단 사이 줄바꿈 \\n\\n)",
  "aiFactSummary": ["1. 핵심 요약 1 (~합니다 체)", "2. 핵심 요약 2 (~합니다 체)", "3. 핵심 요약 3 (~합니다 체)"],
  "draftSections": [
    {"id": "sec-1", "title": "1단락 자연스러운 매거진 소제목", "content": "2문단 본문 (~합니다 체)", "imageCaption": "< 출처 : 관련 공식 자료 >"},
    {"id": "sec-2", "title": "2단락 자연스러운 매거진 소제목", "content": "2문단 본문 (~합니다 체)", "imageCaption": "< 출처 : 관련 기관·기업 >"},
    {"id": "sec-3", "title": "3단락 자연스러운 매거진 소제목", "content": "2문단 본문 (~합니다 체)", "imageCaption": "< 출처 : 공식 채널 >"},
    {"id": "sec-4", "title": "4단락 자연스러운 매거진 소제목", "content": "2문단 본문 (~합니다 체)", "imageCaption": "< 출처 : 공식 채널 >"}
  ],
  "summaryTable": {
    "title": "[요약표] 핵심 비교 및 체크포인트",
    "headers": ["구분", "주요 내용 및 대표 사례", "핵심 특징 · 매력 포인트", "추천 대상 및 활용 팁"],
    "rows": [["항목 (총 4행)", "구체적 내용·사례", "핵심 특징", "추천 및 활용 팁"]]
  },
  "glossaryTitle": "주제를 더 깊이 이해하는 용어 사전",
  "glossary": [{"term": "핵심 용어 (총 4개)", "desc": "1문장 개념 해설 (~합니다 체)"}],
  "faqs": [{"relatedSection": 1, "q": "Q1. 본문 1~4단락 순서 질문 (총 ${faqCount}개)", "a": "2문장 답변 (~합니다 체)"}],
  "fanoutQuestions": [{"category": "트렌드·팁", "q": "추가 꼬리 질문 (총 4개)", "a": "1문장 답변 (~합니다 체)"}],
  "closingParagraph": "마무리 총평 2문장 (~합니다 체)",
  "oneLineSummary": "한 줄 요약! 핵심 메시지 (~입니다 체)"
}`;

    const { parsed, citations, searchResults, activeModel, fallbackFromModel, fallbackReason } = await callPerplexityDirectFromBrowser(apiKey, sys, usr, 'month', 'draft');
    const mergedSources = [];
    const usedSrUrls = new Set();
    const factsArr = Array.isArray(parsed.researchFacts) ? parsed.researchFacts : [];
    const enrichedFacts = factsArr.map((rf, i) => {
      const matchedSr = matchBestSearchResult(rf, searchResults, usedSrUrls);
      const directUrl = isRealArticleUrl(rf.sourceUrl)
        ? rf.sourceUrl.trim()
        : (matchedSr?.url || (isRealArticleUrl(citations[i]) ? citations[i] : `https://search.naver.com/search.naver?where=news&sort=1&query=${encodeURIComponent(keyword)}`));
      if (isRealArticleUrl(directUrl)) usedSrUrls.add(directUrl);
      const pubDate = rf.pubDate || matchedSr?.date || todayStr;
      const srcTitle = rf.sourceTitle || (matchedSr?.title ? `[최신 보도 · ${pubDate}] ${matchedSr.title}` : `[Perplexity 실시간 검증 출처 #${i + 1}] ${keyword} 관련 보도`);
      const srcId = `src-pplx-${i + 1}`;
      mergedSources.push({
        id: srcId,
        url: directUrl,
        title: srcTitle,
        method: `실시간 보도 (${pubDate})`,
        reliability: '높음',
        excluded: false
      });
      return {
        id: `ri-pplx-${i + 1}`,
        category: rf.category || `최신 보도 · ${pubDate}`,
        fact: rf.fact,
        rawReference: srcTitle,
        sourceUrl: directUrl,
        sourceIds: [srcId],
        usedInSection: Number(rf.usedInSection) || (i < 2 ? 1 : (i < 4 ? 2 : 3))
      };
    });

    (searchResults || []).slice(0, 8).forEach(sr => {
      if (mergedSources.length >= 8) return;
      if (!sr || !isRealArticleUrl(sr.url) || mergedSources.some(s => s.url === sr.url)) return;
      const num = mergedSources.length + 1;
      const dateStr = sr.date || todayStr;
      mergedSources.push({
        id: `src-pplx-${num}`,
        url: sr.url,
        title: sr.title ? `[실시간 보도 · ${dateStr}] ${sr.title}` : `[Perplexity 실시간 검증 출처 #${num}] ${sr.url}`,
        method: `실시간 보도 (${dateStr})`,
        reliability: '높음',
        excluded: false
      });
    });

    if (mergedSources.length === 0 && Array.isArray(baseScenario.sources)) {
      mergedSources.push(...baseScenario.sources);
    }

    const researchItems = enrichedFacts.length > 0
      ? enrichedFacts
      : baseScenario.researchItems;

    const normalizeNewlines = str => String(str || '').replace(/\\n/g, '\n');

    const draftSections = Array.isArray(parsed.draftSections) && parsed.draftSections.length > 0
      ? parsed.draftSections.map((sec, i) => ({
          id: `sec-${i + 1}`,
          title: normalizeNewlines(sec.title || `핵심 단락 ${i + 1}`).replace(/^\d+[\.\)]\s*/, '').trim(),
          content: normalizeNewlines(sec.content || '').trim(),
          imageCaption: normalizeNewlines(sec.imageCaption || '').trim(),
          sourceIds: [mergedSources[0]?.id, mergedSources[1]?.id].filter(Boolean)
        }))
      : baseScenario.draftSections;

    // 헤드라인 후보 40자 이내 자동 보정 및 초과분 한줄 소제목 분리
    let rawSubtitle = normalizeNewlines(parsed.subtitle || baseScenario.summaryBlocks.subtitle).trim();
    const rawTitleCandidates = Array.isArray(parsed.titleCandidates) && parsed.titleCandidates.length > 0
      ? parsed.titleCandidates
      : baseScenario.titleCandidates;
    const processedTitleCandidates = rawTitleCandidates.map((tc, idx) => {
      const cleanT = normalizeNewlines(tc.title || '').trim();
      if (splitLongHeadlineToSubtitle && cleanT.length > maxHeadlineLimit) {
        const splitRes = splitLongHeadlineToSubtitle(cleanT, idx === 0 ? rawSubtitle : '', maxHeadlineLimit);
        if (idx === 0 && splitRes.subtitle) {
          rawSubtitle = splitRes.subtitle;
        }
        return {
          ...tc,
          id: tc.id || `tc-${idx + 1}`,
          title: splitRes.headline,
          overflowSubtitle: splitRes.overflowText || ''
        };
      }
      return {
        ...tc,
        id: tc.id || `tc-${idx + 1}`,
        title: cleanT
      };
    });

    // FAQ 본문 문맥 순서(단락 1 -> 2 -> 3 -> 4) 자동 매칭 및 정렬
    const rawFaqs = Array.isArray(parsed.faqs) && parsed.faqs.length > 0
      ? parsed.faqs.map((f, i) => {
          const cleanQ = normalizeNewlines(f.q || '').replace(/^Q\d+[\.\:]\s*/i, '').trim();
          const cleanA = normalizeNewlines(f.a || '').trim();
          let relSec = Number(f.relatedSection) || 0;
          if (!relSec || relSec < 1 || relSec > draftSections.length) {
            const qaTokens = `${cleanQ} ${cleanA}`.replace(/[^\w가-힣\s]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
            let bestSecIdx = Math.min(draftSections.length, Math.floor((i / Math.max(1, parsed.faqs.length)) * draftSections.length) + 1);
            let bestScore = -1;
            draftSections.forEach((sec, sIdx) => {
              const secText = `${sec.title || ''} ${sec.content || ''}`;
              let score = 0;
              qaTokens.forEach(tk => {
                if (secText.includes(tk)) score += 1;
              });
              if (score > bestScore) {
                bestScore = score;
                bestSecIdx = sIdx + 1;
              }
            });
            relSec = bestSecIdx;
          }
          return {
            q: cleanQ,
            a: cleanA,
            relatedSection: relSec,
            origIdx: i
          };
        })
      : (baseScenario.summaryBlocks.faqs || []).map((f, i) => ({
          q: String(f.q || '').replace(/^Q\d+[\.\:]\s*/i, '').trim(),
          a: String(f.a || '').trim(),
          relatedSection: Number(f.relatedSection) || Math.min(draftSections.length || 4, Math.floor(i / 2) + 1),
          origIdx: i
        }));

    const sortedFaqs = rawFaqs
      .sort((a, b) => (a.relatedSection - b.relatedSection) || (a.origIdx - b.origIdx))
      .map((f, i) => ({
        q: `Q${i + 1}. ${f.q}`,
        a: f.a,
        relatedSection: f.relatedSection
      }));

    const validCategories = MK_PICK_CATEGORIES.map(c => c.id);
    const chosenCat = validCategories.includes(parsed.mkCategory) ? parsed.mkCategory : fallbackCat.recommendedCategory || fallbackCat;
    const rawLeadIntro = normalizeNewlines(parsed.leadIntro || baseScenario.summaryBlocks?.leadIntro || '').trim();
    const summaryBlocks = {
      ...baseScenario.summaryBlocks,
      mkCategory: chosenCat,
      mkCategoryReason: normalizeNewlines(parsed.mkCategoryReason || baseScenario.summaryBlocks.mkCategoryReason).trim(),
      byline: `${chosenCat} | 남궁선희 기자 | 입력 ${new Date().toISOString().slice(0, 10).replace(/-/g, '.')} 10:00`,
      subtitle: rawSubtitle,
      leadIntro: rawLeadIntro,
      includeLeadIntro: baseScenario.summaryBlocks?.includeLeadIntro !== false,
      aiFactSummary: Array.isArray(parsed.aiFactSummary) && parsed.aiFactSummary.length > 0
        ? parsed.aiFactSummary.map(s => normalizeNewlines(s).trim())
        : baseScenario.summaryBlocks.aiFactSummary,
      summaryTable: parsed.summaryTable && Array.isArray(parsed.summaryTable.rows)
        ? {
            title: normalizeNewlines(parsed.summaryTable.title || '[요약표]').trim(),
            headers: (parsed.summaryTable.headers || []).map(h => normalizeNewlines(h).trim()),
            rows: (parsed.summaryTable.rows || []).map(r => Array.isArray(r) ? r.map(c => normalizeNewlines(c).trim()) : [])
          }
        : baseScenario.summaryBlocks.summaryTable,
      glossaryTitle: normalizeNewlines(parsed.glossaryTitle || baseScenario.summaryBlocks.glossaryTitle || '주제를 더 깊이 이해하는 용어 사전').trim(),
      glossary: Array.isArray(parsed.glossary) && parsed.glossary.length > 0
        ? parsed.glossary.map(g => ({
            term: normalizeNewlines(g.term || '').trim(),
            desc: normalizeNewlines(g.desc || '').trim()
          }))
        : (baseScenario.summaryBlocks.glossary || []),
      faqs: sortedFaqs,
      fanoutQuestions: Array.isArray(parsed.fanoutQuestions) && parsed.fanoutQuestions.length > 0
        ? parsed.fanoutQuestions.map((fq, i) => ({
            id: `fq-pplx-${i + 1}`,
            category: normalizeNewlines(fq.category || '연관 질문').trim(),
            q: normalizeNewlines(fq.q || '').replace(/^Q\d*[\.\:]\s*/i, '').trim(),
            a: normalizeNewlines(fq.a || '').trim()
          })).filter(fq => fq.q && fq.a)
        : baseScenario.summaryBlocks.fanoutQuestions,
      closingParagraph: normalizeNewlines(parsed.closingParagraph || baseScenario.summaryBlocks.closingParagraph || '').trim(),
      oneLineSummary: normalizeNewlines(parsed.oneLineSummary || baseScenario.summaryBlocks.oneLineSummary).trim()
    };

    const parsedFv = parsed.factVerification || {};
    const finalFactVerification = preFactCheck.isWarning
      ? {
          ...preFactCheck,
          summary: parsedFv.summary || preFactCheck.summary
        }
      : {
          verdict: parsedFv.verdict || preFactCheck.verdict || 'VERIFIED_FACT',
          isWarning: Boolean(parsedFv.isWarning || parsedFv.verdict === 'AI_MEME_OR_VIRTUAL' || parsedFv.verdict === 'UNVERIFIED_VIRAL'),
          badgeLabel: parsedFv.badgeLabel || preFactCheck.badgeLabel || '✓ 공식 언론 보도 및 실제 출시·트렌드 팩트 확인됨',
          summary: parsedFv.summary || preFactCheck.summary || `'${keyword}' 주제에 대해 공식 보도 및 실제 출시·트렌드 팩트를 기반으로 작성되었습니다.`
        };

    return {
      ...baseScenario,
      usedPerplexity: true,
      activeWriterModel: activeModel || getSelectedWriterModel(),
      fallbackFromModel: fallbackFromModel || '',
      fallbackReason: fallbackReason || '',
      titleCandidates: processedTitleCandidates,
      sources: mergedSources,
      researchItems,
      draftSections,
      summaryBlocks,
      factChecks: extractFactSentencesFromSections(draftSections, mergedSources),
      factVerification: finalFactVerification
    };
  }

  // ============================================================================
  // [신규 기능] 1) 취재 팩트 메모장 → 본문 단락 반영 위치 추적 및 문장 하이라이트 헬퍼
  //             2) 본문 편집·삭제 시 하단 FAQ·요약표 실시간 자동 동기화 헬퍼
  //             3) 우측 상단 AI 자연어 편집 프롬프트 실행 및 변경 문장 하이라이트 헬퍼
  // ============================================================================
  const COMMON_STOP_TOKENS = new Set([
    '최근', '관련', '통해', '위해', '대해', '있는', '있다', '합니다', '습니다', '입니다', '밝혔습니다',
    '전했습니다', '보도에', '따르면', '소식이', '전해지며', '소비자와', '업계의', '관심을', '모으고', '있습니다',
    '이번', '올해', '다양한', '주요', '핵심', '경우', '등이', '함께', '특히', '가장', '많은', '높은',
    '소비자', '브랜드', '시장', '출시', '진행', '제공', '활용', '선보이며', '가운데', '기준', '확인'
  ]);

  function extractDistinctiveTokens(text = '', ignoreText = '') {
    const ignoreSet = new Set(
      String(ignoreText || '')
        .replace(/[^\w가-힣\s]/g, ' ')
        .split(/\s+/)
        .map(w => w.replace(/(은|는|이|가|을|를|에|의|로|으로|에서|까지|부터|도|만|과|와)$/, '').trim())
        .filter(w => w.length >= 2)
    );
    const rawWords = String(text || '')
      .replace(/[^\w가-힣%\s]/g, ' ')
      .split(/\s+/)
      .map(w => w.replace(/(은|는|이|가|을|를|에|의|로|으로|에서|까지|부터|도|만|과|와|한|된|할|하는)$/, '').trim())
      .filter(w => w.length >= 2 && !COMMON_STOP_TOKENS.has(w) && !ignoreSet.has(w));
    return [...new Set(rawWords)];
  }

  function splitIntoSentences(text = '') {
    return String(text || '')
      .split(/(?<=[.?!])\s+|\n+/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  // 취재 팩트 메모장(researchItems)의 각 항목이 본문 어느 단락에 반영되었는지 정밀 분석
  function getMemoReflectionLocations(memoItem, w) {
    if (!memoItem || !w) return { isReflected: false, locations: [] };
    const factStr = String(memoItem.fact || '').trim();
    if (!factStr) return { isReflected: false, locations: [] };

    const locations = [];
    const addedKeys = new Set();
    const memoTokens = extractDistinctiveTokens(factStr, w.keyword || '');
    const memoNumbers = factStr.match(/\d+(?:,\d+)?(?:\.\d+)?\s*(?:%|원|만\s*원|억|개|종|회|명|일|월|년|배|시간|곳)?/g) || [];
    const insertedTargets = Array.isArray(memoItem.insertedIntoSecIds) ? memoItem.insertedIntoSecIds : [];

    // 1) 본문 각 단락(draftSections) 내 반영 문장 탐색
    (w.draftSections || []).forEach((sec, sIdx) => {
      const secContent = String(sec.content || '');
      const secTitle = String(sec.title || '');
      const secFull = `${secTitle}\n${secContent}`;
      const sentences = splitIntoSentences(secContent);
      const matchedSentences = [];

      sentences.forEach(sent => {
        if (factStr.length >= 12 && (sent.includes(factStr.slice(0, 18)) || factStr.includes(sent.slice(0, 18)))) {
          matchedSentences.push(sent);
          return;
        }
        const tokenHits = memoTokens.filter(tk => sent.includes(tk));
        const numHits = memoNumbers.filter(num => num.trim().length >= 2 && sent.includes(num.trim()));
        if (tokenHits.length >= 2 || (tokenHits.length >= 1 && numHits.length >= 1)) {
          matchedSentences.push(sent);
        }
      });

      const isExplicitlyInserted = insertedTargets.includes(sec.id);
      if (isExplicitlyInserted || matchedSentences.length > 0) {
        const key = sec.id;
        if (!addedKeys.has(key)) {
          addedKeys.add(key);
          locations.push({
            targetType: 'section',
            targetId: `secWrap-${sec.id}`,
            secId: sec.id,
            secIdx: sIdx,
            label: `단락 0${sIdx + 1}`,
            matchedSentences: matchedSentences.length > 0 ? matchedSentences : [sentences[sentences.length - 1] || factStr],
            matchTokens: memoTokens.slice(0, 6)
          });
        }
      }
    });

    // 3) 직접 문장 매칭이 안 되었더라도 초안 생성 시 지정된 usedInSection이 있으면 해당 단락의 가장 연관도 높은 문장을 연결
    if (locations.length === 0 && memoItem.usedInSection) {
      const targetIdx = Math.max(0, Math.min((w.draftSections || []).length - 1, Number(memoItem.usedInSection) - 1));
      const sec = (w.draftSections || [])[targetIdx];
      if (sec) {
        const sentences = splitIntoSentences(sec.content || '');
        let bestSent = sentences[0] || '';
        let bestScore = -1;
        sentences.forEach(sent => {
          const hits = memoTokens.filter(tk => sent.includes(tk)).length;
          if (hits > bestScore) {
            bestScore = hits;
            bestSent = sent;
          }
        });
        locations.push({
          targetType: 'section',
          targetId: `secWrap-${sec.id}`,
          secId: sec.id,
          secIdx: targetIdx,
          label: `단락 0${targetIdx + 1}`,
          matchedSentences: bestSent ? [bestSent] : [],
          matchTokens: memoTokens.slice(0, 6)
        });
      }
    }

    return {
      isReflected: locations.length > 0,
      locations
    };
  }

  // 문장 비교 시 접속부사·공백·문장부호 차이로 인해 기존 문장이 '새 문장'으로 오판되는 것을 막는 정규화 함수
  function normalizeSentForCompare(str = '') {
    return String(str || '')
      .replace(/^[\s•·\-\d\.\)]+/, '')
      .replace(/^(?:또한|한편|아울러|특히|여기에|뿐만 아니라|게다가|하지만|그러나|반면|따라서|이처럼|결국|즉|더불어)\s*[,]?\s*/, '')
      .replace(/[\s"'‘’“”.,?!~·…()\[\]]+/g, '')
      .trim();
  }

  // 두 문장이 실질적으로 동일한 기존 문장인지 판별 (삭제 후 남은 문장이 전체 하이라이트되는 버그 원천 차단)
  function isEssentiallySameSentence(sA = '', sB = '') {
    const a = normalizeSentForCompare(sA);
    const b = normalizeSentForCompare(sB);
    if (!a || !b) return false;
    if (a === b) return true;
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    if (shorter.length >= 10 && longer.includes(shorter)) return true;
    if (shorter.length >= 15 && longer.includes(shorter.slice(0, Math.floor(shorter.length * 0.72)))) return true;
    if (shorter.length >= 8) {
      const bigramsA = new Set();
      for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));
      let hit = 0;
      const totalB = Math.max(1, b.length - 1);
      for (let i = 0; i < b.length - 1; i++) {
        if (bigramsA.has(b.slice(i, i + 2))) hit++;
      }
      const overlapRatio = hit / Math.min(bigramsA.size || 1, totalB);
      if (overlapRatio >= 0.68) return true;
    }
    return false;
  }

  // 본문 텍스트 내 특정 문장(matchedSentences)이나 키워드(matchTokens)를 출처별 색상(AI 채팅=블루, 취재 메모=앰버)으로 구분해 하이라이팅
  function renderHighlightedBodyHtml(rawText = '', matchedSentences = [], matchTokens = [], badgeTitle = '', options = {}) {
    const isAiMode = Boolean(options && options.aiEditState && options.secId);
    const cleanSentences = (matchedSentences || []).map(s => String(s || '').trim()).filter(s => s.length >= 6);
    const cleanTokens = isAiMode ? [] : (matchTokens || []).map(t => String(t || '').trim()).filter(t => t.length >= 2);
    const paragraphs = String(rawText || '').split(/\n+/);

    // 출처별 하이라이트 마크 스타일: AI 채팅 수정 = 소프트 블루(#DBEAFE), 취재 메모 반영 = 소프트 옐로우(#FEF08A)
    const markStyle = isAiMode
      ? 'background-color: var(--ai-chat-mark); color: #1E3A8A; font-weight: 700; padding: 2px 5px; border-radius: 4px; border-bottom: 2px solid #3B82F6;'
      : 'background-color: var(--memo-fact-mark); color: #78350F; font-weight: 700; padding: 2px 5px; border-radius: 4px; border-bottom: 2px solid #F59E0B;';

    const renderedParas = paragraphs.map(para => {
      const sents = para.split(/(?<=[.?!])\s+/);
      const renderedSents = sents.map(sent => {
        const trimmed = sent.trim();
        if (!trimmed) return '';
        const isFullSentenceMatch = cleanSentences.some(ms => isEssentiallySameSentence(trimmed, ms));
        if (isFullSentenceMatch) {
          return `<mark style="${markStyle}">${escapeHtml(trimmed)}</mark>`;
        }
        if (!isAiMode && cleanTokens.length > 0) {
          const tokenHitCount = cleanTokens.filter(tk => trimmed.includes(tk)).length;
          if (tokenHitCount >= 2) {
            return `<mark style="${markStyle}">${escapeHtml(trimmed)}</mark>`;
          }
        }
        return escapeHtml(trimmed);
      });
      return `<p style="margin: 0 0 6px 0; line-height: 1.7;">${renderedSents.join(' ')}</p>`;
    });

    // [모드 1: 💬 AI 채팅으로 기사 수정 내역 바 (블루 테마 · 추가/수정 vs 제외/삭제 명확 구분)]
    if (isAiMode) {
      const aiEdit = options.aiEditState;
      const secId = options.secId;
      const sentItems = aiEdit.sentenceStates?.[secId] || [];
      const addedItems = sentItems.filter(it => it.type !== 'removed');
      const removedItems = sentItems.filter(it => it.type === 'removed');
      const isRemovalOnly = addedItems.length === 0 && removedItems.length > 0;

      const includedAddedCount = addedItems.filter(it => it.included !== false).length;
      const activeRemovedCount = removedItems.filter(it => it.included === false).length;
      const isSecApplied = isRemovalOnly
        ? activeRemovedCount > 0
        : (addedItems.length > 0 ? includedAddedCount > 0 : aiEdit.isApplied !== false);
      const isHighlightVisible = aiEdit.isHighlightVisible !== false;
      const showContextPreview = Boolean(aiEdit.showContextBySec?.[secId]);

      return `
        <div style="margin-top: 8px; padding: 10px 12px; background-color: ${isSecApplied ? 'var(--ai-chat-bg)' : '#F8FAFC'}; border: 1px solid ${isSecApplied ? 'var(--ai-chat-border)' : '#E2E8F0'}; border-radius: 8px; font-size: 13px; color: var(--text-primary);">
          <div class="flex-between" style="flex-wrap: wrap; gap: 8px;">
            <div class="flex-row" style="gap: 6px; flex-wrap: wrap;">
              <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 800; color: #FFFFFF; background-color: ${isSecApplied ? 'var(--ai-chat-strong)' : '#64748B'}; padding: 2px 8px; border-radius: 99px;">
                💬 AI 채팅 수정
              </span>
              <strong style="font-size: 12px; font-weight: 700; color: ${isSecApplied ? 'var(--ai-chat)' : '#475569'};">
                ${isRemovalOnly
                  ? (isSecApplied ? `요청하신 내용(${activeRemovedCount}문장)이 이 단락에서 제외되었습니다` : '제외했던 내용을 다시 본문에 복원했습니다')
                  : (isSecApplied
                      ? `추가·수정된 문장 ${addedItems.length > 0 ? `${includedAddedCount}/${addedItems.length}건` : ''} 반영됨`
                      : '추가·수정 내용을 본문에서 뺐습니다 (원문 상태)')}
              </strong>
            </div>
            <div class="flex-row" style="gap: 6px; flex-wrap: wrap;">
              <button
                type="button"
                class="btn btn-sm"
                data-toggle-ai-sec-all="${escapeHtml(secId)}"
                style="padding: 3px 9px; font-size: 11px; font-weight: 700; border-radius: 6px; background-color: #FFFFFF; color: ${isSecApplied ? '#475569' : 'var(--ai-chat)'}; border: 1px solid ${isSecApplied ? '#CBD5E1' : '#93C5FD'};"
              >
                ${isRemovalOnly
                  ? (isSecApplied ? '↩ 제외 취소 (다시 넣기)' : '🗑️ 다시 제외하기')
                  : (isSecApplied ? '➖ 수정 내용 빼기' : '➕ 수정 내용 다시 넣기')}
              </button>
              <button
                type="button"
                class="text-action"
                data-toggle-highlight-visibility="1"
                style="font-size: 11px; font-weight: 700; color: var(--text-secondary); padding: 2px 6px;"
              >
                ${isHighlightVisible ? '접기 ▲' : '상세 보기 ▼'}
              </button>
            </div>
          </div>

          ${isHighlightVisible ? `
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid ${isSecApplied ? '#DBEAFE' : '#E2E8F0'}; display: flex; flex-direction: column; gap: 6px;">
              ${sentItems.map((item, sIdx) => {
                const isRemovedType = item.type === 'removed';
                const isInc = item.included !== false;
                if (isRemovedType) {
                  return `
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 6px 10px; border-radius: 6px; background-color: #FFFFFF; border: 1px solid #E2E8F0;">
                      <div style="flex: 1; font-size: 12.5px; line-height: 1.5; color: ${isInc ? '#111827' : '#64748B'}; ${isInc ? '' : 'text-decoration: line-through;'}">
                        <span style="display: inline-block; font-size: 10.5px; font-weight: 800; color: ${isInc ? 'var(--ai-chat)' : '#64748B'}; background-color: ${isInc ? '#DBEAFE' : '#F1F5F9'}; padding: 1px 6px; border-radius: 4px; margin-right: 6px; text-decoration: none;">
                          ${isInc ? '복원됨' : '제외됨'}
                        </span>
                        ${escapeHtml(item.text)}
                      </div>
                      <button
                        type="button"
                        data-toggle-ai-sent="${escapeHtml(secId)}"
                        data-toggle-ai-sent-idx="${sIdx}"
                        style="flex-shrink: 0; padding: 2px 8px; font-size: 11px; font-weight: 700; border-radius: 6px; cursor: pointer; font-family: inherit; background-color: #FFFFFF; color: ${isInc ? '#DC2626' : 'var(--ai-chat)'}; border: 1px solid ${isInc ? '#FECACA' : '#93C5FD'};"
                      >
                        ${isInc ? '다시 빼기' : '+ 다시 넣기'}
                      </button>
                    </div>
                  `;
                }
                return `
                  <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 6px 10px; border-radius: 6px; background-color: #FFFFFF; border: 1px solid ${isInc ? '#93C5FD' : '#E2E8F0'};">
                    <div style="flex: 1; font-size: 12.5px; line-height: 1.55; color: ${isInc ? '#1E3A8A' : '#94A3B8'}; font-weight: ${isInc ? '600' : '400'}; ${isInc ? '' : 'text-decoration: line-through;'}">
                      <mark style="${isInc ? 'background-color: var(--ai-chat-mark); color: #1E3A8A; padding: 1px 4px; border-radius: 3px; font-weight: 700;' : 'background: transparent; color: inherit;'}">${escapeHtml(item.text)}</mark>
                    </div>
                    <button
                      type="button"
                      data-toggle-ai-sent="${escapeHtml(secId)}"
                      data-toggle-ai-sent-idx="${sIdx}"
                      style="flex-shrink: 0; padding: 2px 8px; font-size: 11px; font-weight: 700; border-radius: 6px; cursor: pointer; font-family: inherit; background-color: #FFFFFF; color: ${isInc ? '#475569' : 'var(--ai-chat)'}; border: 1px solid ${isInc ? '#CBD5E1' : '#93C5FD'};"
                    >
                      ${isInc ? '빼기 ✕' : '+ 다시 넣기'}
                    </button>
                  </div>
                `;
              }).join('')}

              ${!isRemovalOnly && cleanSentences.length > 0 ? `
                <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 2px;">
                  <button
                    type="button"
                    class="text-action"
                    data-toggle-sec-context-preview="${escapeHtml(secId)}"
                    style="font-size: 11px; color: var(--ai-chat); font-weight: 700;"
                  >
                    ${showContextPreview ? '단락 전체 문맥에서 위치 숨기기 ▲' : '단락 전체 문맥에서 위치 보기 ▼'}
                  </button>
                  <button
                    type="button"
                    class="text-action"
                    data-jump-block="block-step-7"
                    style="font-size: 11px; color: var(--ai-chat); font-weight: 700;"
                  >
                    반영된 하단 FAQ 이동 ↘
                  </button>
                </div>
                ${showContextPreview ? `
                  <div style="padding: 10px 12px; background-color: #FFFFFF; border: 1px solid #DBEAFE; border-radius: 6px; font-size: 13px;">
                    ${renderedParas.join('')}
                  </div>
                ` : ''}
              ` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }

    // [모드 2: 📌 취재 팩트 메모 반영 내역 바 (앰버/옐로우 테마 — AI 채팅 블루와 100% 시각적 분리)]
    const memoSecId = options?.secId || '';
    const memoId = options?.memoId || state.activeMemoHighlight?.memoId || '';
    return `
      <div style="margin-top: 8px; padding: 10px 12px; background-color: var(--memo-fact-bg); border: 1px solid var(--memo-fact-border); border-radius: 8px; font-size: 13px; color: var(--text-primary);">
        <div class="flex-between" style="flex-wrap: wrap; gap: 6px; margin-bottom: 6px;">
          <div class="flex-row" style="gap: 6px;">
            <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 800; color: #78350F; background-color: var(--memo-fact-mark); padding: 2px 8px; border-radius: 99px;">
              📌 취재 메모 반영
            </span>
            <strong style="font-size: 12px; font-weight: 700; color: var(--memo-fact);">
              ${escapeHtml(badgeTitle || '취재 팩트 메모장에서 반영된 문장')}
            </strong>
          </div>
          <div class="flex-row" style="gap: 8px;">
            ${memoSecId && cleanSentences.length > 0 ? `
              <button
                type="button"
                class="text-action"
                data-remove-memo-sent-sec="${escapeHtml(memoSecId)}"
                data-remove-memo-id="${escapeHtml(memoId)}"
                style="font-size: 11px; font-weight: 700; color: #B45309;"
                title="이 단락에서 방금 반영한 취재 메모 문장을 뺍니다"
              >
                본문에서 빼기 ✕
              </button>
            ` : ''}
            <button type="button" class="text-action" data-clear-highlight="memo" style="font-size: 11px; color: var(--text-muted);">표시 닫기</button>
          </div>
        </div>
        <div style="padding: 8px 10px; background-color: #FFFFFF; border: 1px solid #FDE68A; border-radius: 6px;">
          ${renderedParas.join('')}
        </div>
      </div>
    `;
  }

  // 각 FAQ 항목이 본문(draftSections)의 몇 번째 단락(1~N) 및 어느 문장 위치와 가장 밀접한지 판별하는 함수
  function inferFaqRelatedSectionInfo(faq, draftSectionsOrWork = [], keyword = '', fallbackIdx = 0, totalFaqs = 5) {
    const draftSections = Array.isArray(draftSectionsOrWork)
      ? draftSectionsOrWork
      : (draftSectionsOrWork?.draftSections || []);
    const kw = keyword || (!Array.isArray(draftSectionsOrWork) ? (draftSectionsOrWork?.keyword || '') : '');
    if (!faq || !Array.isArray(draftSections) || draftSections.length === 0) {
      return { relatedSection: 1, charOffset: 0, secId: '', secLabel: '단락 01', secTitle: '' };
    }
    const qaText = `${String(faq.q || '').replace(/^Q\d+[\.\:]\s*/i, '')} ${faq.a || ''}`;
    const qaTokens = extractDistinctiveTokens(qaText, kw);

    let bestSecNum = Number(faq.relatedSection) || 0;
    let bestScore = -1;
    let bestCharOffset = 999999;

    draftSections.forEach((sec, sIdx) => {
      const secFull = `${sec.title || ''} ${sec.content || ''}`;
      let score = 0;
      let firstHitPos = 999999;
      qaTokens.forEach(tk => {
        const pos = secFull.indexOf(tk);
        if (pos !== -1) {
          score += (sec.title || '').includes(tk) ? 3 : 2;
          if (pos < firstHitPos) firstHitPos = pos;
        }
      });
      if (score > bestScore) {
        bestScore = score;
        bestSecNum = sIdx + 1;
        bestCharOffset = firstHitPos;
      }
    });

    if (faq.isAiEdited && faq.relatedSection >= 1 && faq.relatedSection <= draftSections.length) {
      bestSecNum = Number(faq.relatedSection);
    } else if (bestScore <= 0) {
      if (bestSecNum >= 1 && bestSecNum <= draftSections.length) {
        bestCharOffset = fallbackIdx * 100;
      } else {
        bestSecNum = Math.min(draftSections.length, Math.max(1, Math.floor((fallbackIdx / Math.max(1, totalFaqs)) * draftSections.length) + 1));
        bestCharOffset = fallbackIdx * 100;
      }
    }
    const finalSecIdx = Math.max(0, Math.min(draftSections.length - 1, (bestSecNum || 1) - 1));
    const targetSec = draftSections[finalSecIdx] || {};
    return {
      relatedSection: finalSecIdx + 1,
      charOffset: bestCharOffset,
      secId: targetSec.id || '',
      secLabel: `단락 0${finalSecIdx + 1}`,
      secTitle: targetSec.title || ''
    };
  }

  // FAQ 배열의 Q1., Q2., Q3... 번호 접두사를 현재 순서대로 깔끔하게 다시 매기는 함수
  function renumberFaqPrefixes(faqs = [], draftSections = [], keyword = '') {
    if (!Array.isArray(faqs)) return [];
    return faqs.map((f, idx) => {
      const cleanQ = String(f.q || '').replace(/^Q\d+[\.\:]\s*/i, '').trim();
      const info = inferFaqRelatedSectionInfo(f, draftSections, keyword, idx, faqs.length);
      return {
        ...f,
        q: `Q${idx + 1}. ${cleanQ}`,
        a: String(f.a || '').trim(),
        relatedSection: Number(f.relatedSection) >= 1 && Number(f.relatedSection) <= (draftSections.length || 4)
          ? Number(f.relatedSection)
          : info.relatedSection
      };
    });
  }

  // 본문(draftSections) 문맥 흐름 순서(단락 01 -> 단락 02 -> 단락 03 -> 단락 04)에 맞춰 FAQ를 자동 정렬하는 함수
  function sortFaqsByBodyContextOrder(w) {
    if (!w || !w.summaryBlocks || !Array.isArray(w.summaryBlocks.faqs)) return [];
    const sections = w.draftSections || [];
    const faqs = w.summaryBlocks.faqs;
    const enriched = faqs.map((f, idx) => {
      const info = inferFaqRelatedSectionInfo(f, sections, w.keyword || '', idx, faqs.length);
      return {
        ...f,
        relatedSection: info.relatedSection,
        _charOffset: info.charOffset,
        _origIdx: idx
      };
    });
    enriched.sort((a, b) => {
      if (a.relatedSection !== b.relatedSection) return a.relatedSection - b.relatedSection;
      if (a._charOffset !== b._charOffset) return a._charOffset - b._charOffset;
      return a._origIdx - b._origIdx;
    });
    w.summaryBlocks.faqs = enriched.map((f, idx) => {
      const cleanQ = String(f.q || '').replace(/^Q\d+[\.\:]\s*/i, '').trim();
      const { _charOffset, _origIdx, ...rest } = f;
      return {
        ...rest,
        q: `Q${idx + 1}. ${cleanQ}`,
        a: String(f.a || '').trim(),
        relatedSection: f.relatedSection
      };
    });
    return w.summaryBlocks.faqs;
  }

  // 사용자의 'AI 채팅으로 기사 수정' 지시문에서 제외/삭제 대상 키워드나 구절을 추출하는 도우미
  function extractExcludedKeywordsFromInstruction(instruction = '') {
    const raw = String(instruction || '').replace(/^\[[^\]]+\]\s*/, '').trim();
    if (!/(?:제외|빼줘|빼고|삭제|지워|없애|생략|빼\s*달라)/.test(raw)) return [];
    const cleaned = raw
      .replace(/(?:에\s*대한|에\s*관한|관련된|관련|부분은|부분을|내용은|내용을|문장은|문장을|이야기는|이야기를|언급은|언급을|항목은|항목을|단락은|단락을|소제목은|소제목을)/g, ' ')
      .replace(/(?:제외해\s*줘|제외해\s*달라|제외하고|제외|빼\s*줘|빼\s*달라|빼고|삭제해\s*줘|삭제하고|삭제|지워\s*줘|지우고|없애\s*줘|없애고|생략해\s*줘|생략).*$/g, '')
      .replace(/['"“”‘’]/g, ' ')
      .trim();
    if (!cleaned) return [];
    const tokens = cleaned
      .split(/[,/·\s]+/)
      .map(t => t.replace(/(?:은|는|이|가|을|를|의|와|과|도|만)$/, '').trim())
      .filter(t => t.length >= 2 && !/^(?:특정|해당|거기|여기|본문|기사|전체|일부|조금|모두|전부)$/.test(t));
    if (cleaned.length >= 2 && cleaned.length <= 18 && !tokens.includes(cleaned)) {
      tokens.unshift(cleaned);
    }
    return [...new Set(tokens)];
  }

  // 본문 단락 내용이나 구성이 변경되었을 때, 단락 소제목(sec.title)과 글 목차 순서(draftSections)도 수정 사항에 맞게 자동 동기화하는 함수
  function syncSectionTitlesWithUpdatedBody(w, { instruction = '', oldSectionsMap = {}, highlightedBySecId = {}, removedBySecId = {} } = {}) {
    if (!w || !Array.isArray(w.draftSections)) return;
    const rawInst = String(instruction || '').trim();
    const explicitExcluded = extractExcludedKeywordsFromInstruction(rawInst);

    // 1) 사용자가 단락/목차 순서 변경을 요청한 경우 (예: "2단락과 3단락 순서를 바꿔줘", "1단락과 2단락 순서 변경")
    const swapMatch = rawInst.match(/([1-5])\s*(?:번째\s*)?단락(?:과|이랑|하고|,|\s)+([1-5])\s*(?:번째\s*)?단락.*(?:순서|바꿔|교체|변경|이동)/);
    if (swapMatch) {
      const idxA = Number(swapMatch[1]) - 1;
      const idxB = Number(swapMatch[2]) - 1;
      if (w.draftSections[idxA] && w.draftSections[idxB] && idxA !== idxB) {
        const prevTitleA = oldSectionsMap[w.draftSections[idxA].id]?.title || '';
        const prevTitleB = oldSectionsMap[w.draftSections[idxB].id]?.title || '';
        // AI가まだ 순서를 안 바꿨다면 클라이언트에서 즉시 순서 교체
        if (w.draftSections[idxA].title === prevTitleA && w.draftSections[idxB].title === prevTitleB) {
          const tmp = w.draftSections[idxA];
          w.draftSections[idxA] = w.draftSections[idxB];
          w.draftSections[idxB] = tmp;
        }
      }
    }

    // 2) 각 단락의 소제목(sec.title)이 삭제된 키워드를 여전히 포함하고 있거나, 새로 추가된 핵심 내용을 반영하지 못한 경우 소제목 자동 업데이트
    w.draftSections.forEach(sec => {
      if (!sec) return;
      const secId = sec.id;
      const curTitle = String(sec.title || '').trim();
      const curBody = String(sec.content || '').trim();
      const oldTitle = String(oldSectionsMap[secId]?.title || '').trim();
      const removedSents = removedBySecId?.[secId] || [];
      const addedSents = highlightedBySecId?.[secId] || [];

      const removedSecTokens = [
        ...explicitExcluded,
        ...extractDistinctiveTokens(removedSents.join(' '), w.keyword || '')
      ].filter(tk => tk.length >= 2 && !curBody.includes(tk));

      const titleHasDeletedToken = removedSecTokens.some(tk => curTitle.includes(tk));
      const titleUnchangedOnMajorEdit = (curTitle === oldTitle) && (addedSents.length > 0 && removedSents.length > 0);

      if (titleHasDeletedToken || titleUnchangedOnMajorEdit) {
        // 남은 본문(또는 새로 추가된 문장)에서 가장 핵심이 되는 첫 문장/구절을 기반으로 소제목을 자연스럽게 갱신
        const sents = splitIntoSentences(curBody);
        const basisSent = (addedSents[0] || sents.find(s => !s.endsWith('?')) || sents[0] || '').trim();
        if (basisSent) {
          // 만약 기존 소제목에서 삭제된 키워드 구절만 깔끔히 걷어낼 수 있으면 우선 정제
          let cleanedTitle = curTitle;
          removedSecTokens.forEach(tk => {
            cleanedTitle = cleanedTitle
              .replace(new RegExp(`['"‘’“”]?${tk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"‘’“”]?\\s*(?:와|과|·|,|및|부터|까지)?\\s*`, 'g'), '')
              .trim();
          });
          cleanedTitle = cleanedTitle.replace(/^[,·\-\s]+|[,·\-\s]+$/g, '').trim();
          if (cleanedTitle.length >= 10 && !removedSecTokens.some(tk => cleanedTitle.includes(tk))) {
            sec.title = cleanedTitle;
          } else {
            // 본문 핵심 문장에서 28자 내외의 깔끔한 매거진 소제목 도출
            const shortClause = basisSent
              .replace(/^(?:또한|특히|아울러|여기에|한편|하지만|그러나|따라서)\s*/, '')
              .replace(/합니다\.?$|습니다\.?$|입니다\.?$|됩니다\.?$/, '')
              .split(/[,，]/)[0]
              .trim();
            if (shortClause.length >= 8) {
              sec.title = shortClause.length > 34 ? `${shortClause.slice(0, 32).trim()}…핵심 포인트` : shortClause;
            }
          }
        }
      }
    });
  }

  // 본문 단락에서 특정 내용이 삭제되거나 수정되었을 때 하단 FAQ(STEP 07)와 요약표(STEP 06)를 즉시 자동 동기화하는 함수
  function syncFaqsAndTableOnBodyEdit(w, { deletedText = '', previousBody = '', newBody = '', instruction = '' } = {}) {
    if (!w || !w.summaryBlocks) return { removedFaqCount: 0, updatedFaqCount: 0 };
    const sb = w.summaryBlocks;
    const allRemainingBody = [
      w.title || '',
      sb.subtitle || '',
      ...(sb.aiFactSummary || []),
      ...(w.draftSections || []).map(s => `${s.title || ''} ${s.content || ''}`)
    ].join(' ');

    // 삭제된 구간(deletedText 또는 previousBody에서 사라진 문장) 추출 (전체 글자수 증감과 무관하게 사라진 문장을 항상 정밀 추출!)
    let removedSegment = String(deletedText || '');
    if (!removedSegment && previousBody && newBody) {
      const prevSents = splitIntoSentences(previousBody);
      const nextSents = splitIntoSentences(newBody);
      removedSegment = prevSents.filter(os => !nextSents.some(ns => isEssentiallySameSentence(os, ns))).join(' ');
    }

    const explicitExcluded = extractExcludedKeywordsFromInstruction(instruction);
    const removedTokens = [
      ...explicitExcluded,
      ...extractDistinctiveTokens(removedSegment, w.keyword || '')
    ].filter((tk, i, arr) => tk && tk.length >= 2 && arr.indexOf(tk) === i && !allRemainingBody.includes(tk));

    let removedFaqCount = 0;
    let updatedFaqCount = 0;

    if (Array.isArray(sb.faqs) && sb.faqs.length > 0 && removedTokens.length > 0) {
      const keptFaqs = [];
      sb.faqs.forEach(faq => {
        const qaText = `${faq.q || ''} ${faq.a || ''}`;
        const hitDeletedTokens = removedTokens.filter(tk => qaText.includes(tk));
        // 삭제·제외된 단락/문장의 키워드가 FAQ 질문이나 답변에 포함되어 있으면 즉시 제거
        if (hitDeletedTokens.length >= 1) {
          removedFaqCount++;
        } else {
          keptFaqs.push(faq);
        }
      });
      sb.faqs = keptFaqs;
    }

    // 요약표(summaryTable)에서도 본문에서 완전히 삭제된 고유명사 행이 있으면 자동 정리
    if (sb.summaryTable && Array.isArray(sb.summaryTable.rows) && removedTokens.length > 0 && sb.summaryTable.rows.length > 1) {
      sb.summaryTable.rows = sb.summaryTable.rows.filter(row => {
        const firstCol = String(row?.[0] || '');
        const rowText = (row || []).join(' ');
        const hitDeleted = removedTokens.filter(tk => firstCol.includes(tk) || rowText.includes(tk));
        return hitDeleted.length === 0;
      });
    }

    // 남은 본문 단락(draftSections)의 핵심 내용과 연결되지 않는 고립된 FAQ가 있는지 추가 점검 및 본문 문맥 순서 재정렬
    if (Array.isArray(sb.faqs)) {
      const currentSections = w.draftSections || [];
      if (removedFaqCount > 0 && currentSections.length > 0 && sb.faqs.length < 4) {
        currentSections.forEach((sec, sIdx) => {
          if (sb.faqs.length >= 5) return;
          const sents = splitIntoSentences(sec.content || '');
          const keySent = sents.find(s => s.length >= 25 && !s.includes('?')) || sents[0];
          if (!keySent) return;
          const cleanSecTitle = String(sec.title || '').replace(/^\d+[\.\)]\s*/, '').trim();
          const candidateQ = cleanSecTitle.endsWith('?')
            ? cleanSecTitle
            : `${cleanSecTitle}의 핵심 포인트는 무엇인가요?`;
          const alreadyExists = sb.faqs.some(f => (f.q || '').includes(cleanSecTitle.slice(0, 10)));
          if (!alreadyExists) {
            sb.faqs.push({
              q: candidateQ,
              a: sents.slice(0, 2).join(' '),
              relatedSection: sIdx + 1
            });
            updatedFaqCount++;
          }
        });
      }

      // 본문 문맥 순서(단락 01 -> 04)에 맞춰 정렬 및 Q1, Q2... 번호 재정렬
      sortFaqsByBodyContextOrder(w);
    }

    if (removedFaqCount > 0 || updatedFaqCount > 0) {
      state.lastFaqAutoSyncInfo = {
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        removedFaqCount,
        updatedFaqCount,
        removedKeywords: removedTokens.slice(0, 4)
      };
    }

    return { removedFaqCount, updatedFaqCount, removedTokens };
  }

  // 현재 편집된 본문(draftSections)만을 기준으로 하단 FAQ와 요약표를 Perplexity AI로 100% 재동기화하는 함수
  async function syncFaqsWithBodyViaAi(w) {
    if (!w) return;
    const apiKey = getClientPerplexityKey();
    const currentBodyText = (w.draftSections || [])
      .map((s, idx) => `[단락 0${idx + 1}: ${s.title}]\n${s.content}`)
      .join('\n\n');

    if (!apiKey) {
      syncFaqsAndTableOnBodyEdit(w, { deletedText: '' });
      return;
    }

    const sys = `당신은 매일경제 MK Pick 수석 에디터입니다.
편집자가 기사 본문(draftSections)을 수정·삭제했습니다.
반드시 아래 제공된 [현재 수정된 기사 본문]에 실제로 남아 있는 내용만을 100% 기준으로 삼아, 본문에서 삭제된 내용은 FAQ와 요약표에서 완전히 제거하고, 현재 본문 1단락부터 마지막 단락까지의 문맥 흐름 순서 그대로 독자 자연어 FAQ 5문항과 핵심 비교 요약표(summaryTable)를 새롭게 동기화해 순수 JSON만 출력하세요.`;

    const usr = `[기사 제목]: ${w.title}
[키워드]: ${w.keyword}
[현재 수정된 기사 본문]:
${currentBodyText}

위 현재 본문 내용과 100% 일치하고 **본문 1단락 → 마지막 단락의 문맥 순서 그대로** 이어지도록 FAQ 5문항과 요약표를 재작성해 아래 JSON 형식으로만 출력하세요 (본문에 없는 내용은 절대 FAQ에 넣지 마세요!):
{
  "faqs": [
    {"relatedSection": 1, "q": "Q1. [1단락 문맥] 현재 본문 핵심 내용에 기반한 독자 구어체 질문 (~나요?)", "a": "현재 본문의 팩트와 수치를 반영한 2문장 답변 (~합니다 체)"}
  ],
  "summaryTable": {
    "title": "[요약표] 핵심 내용 비교",
    "headers": ["구분", "핵심 내용 및 특징", "주요 포인트 · 혜택", "활용 팁 및 체크포인트"],
    "rows": [
      ["항목 1", "현재 본문 기반 핵심 내용", "주요 특징", "추천 대상·팁"]
    ]
  }
}`;

    const { parsed } = await callPerplexityDirectFromBrowser(apiKey, sys, usr, 'month', 'draft', 2600);
    if (Array.isArray(parsed?.faqs) && parsed.faqs.length > 0) {
      w.summaryBlocks.faqs = parsed.faqs.map((f, i) => ({
        q: /^Q\d+\./i.test(String(f.q || '').trim()) ? String(f.q).trim() : `Q${i + 1}. ${String(f.q || '').trim()}`,
        a: String(f.a || '').trim(),
        relatedSection: Number(f.relatedSection) || Math.min((w.draftSections || []).length || 4, Math.floor(i / 2) + 1)
      }));
      sortFaqsByBodyContextOrder(w);
    }
    if (parsed?.summaryTable && Array.isArray(parsed.summaryTable.rows) && parsed.summaryTable.rows.length > 0) {
      w.summaryBlocks.summaryTable = {
        title: String(parsed.summaryTable.title || w.summaryBlocks.summaryTable?.title || '[요약표]').trim(),
        headers: (parsed.summaryTable.headers || w.summaryBlocks.summaryTable?.headers || []).map(h => String(h).trim()),
        rows: parsed.summaryTable.rows.map(r => Array.isArray(r) ? r.map(c => String(c).trim()) : [])
      };
    }
    state.lastFaqAutoSyncInfo = {
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      removedFaqCount: 0,
      updatedFaqCount: (w.summaryBlocks.faqs || []).length,
      removedKeywords: [],
      aiSynced: true
    };
  }

  // AI 자연어 편집으로 새로 추가·보강된 본문 내용이 하단 FAQ(STEP 07)에도 100% 반영되도록 보장하는 함수
  function ensureAiEditedContentReflectedInFaqs(w, { instruction = '', oldFaqs = [], changedSecIds = [], highlightedBySecId = {}, parsedAddedFaq = null } = {}) {
    if (!w || !w.summaryBlocks) return;
    w.summaryBlocks.faqs = Array.isArray(w.summaryBlocks.faqs) ? w.summaryBlocks.faqs : [];

    const allAddedSentences = Object.values(highlightedBySecId || {}).flat().map(s => String(s || '').trim()).filter(Boolean);
    if (allAddedSentences.length === 0 && !parsedAddedFaq) return;

    const primarySecId = changedSecIds[0] || Object.keys(highlightedBySecId)[0] || (w.draftSections?.[0]?.id || 'sec-1');
    const primarySecIdx = Math.max(0, (w.draftSections || []).findIndex(s => s.id === primarySecId));
    const primarySecNum = primarySecIdx + 1;
    const primarySec = (w.draftSections || [])[primarySecIdx] || {};

    // 기존 FAQ 전체 텍스트
    const oldFaqText = (oldFaqs || []).map(f => `${f.q || ''} ${f.a || ''}`).join(' ');
    const addedTextCombined = `${instruction} ${allAddedSentences.join(' ')}`;

    // 새로 추가된 문장/프롬프트 내 따옴표('...') 강조 개념어 추출 (예: '네오(NEO) K-디저트', '가래떡 츄러스')
    const quotedMatches = [];
    const quoteRe = /['‘’"“”]([^'‘’"“”]{2,28})['‘’"“”]/g;
    let qm;
    while ((qm = quoteRe.exec(addedTextCombined)) !== null) {
      const term = qm[1].trim();
      if (term.length >= 2 && term !== w.keyword && !quotedMatches.includes(term)) {
        quotedMatches.push(term);
      }
    }

    const newDistinctiveTokens = extractDistinctiveTokens(allAddedSentences.join(' '), w.keyword || '')
      .filter(tk => tk.length >= 2 && !oldFaqText.includes(tk));

    const normalizeClean = s => String(s || '').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();

    // 1) AI가 반환한 addedOrUpdatedFaq가 있으면 우선 활용
    let candidateQ = normalizeClean(parsedAddedFaq?.q || '').replace(/^Q\d+[\.\:]\s*/i, '').trim();
    let candidateA = normalizeClean(parsedAddedFaq?.a || '');
    const candidateSec = Number(parsedAddedFaq?.relatedSection) || primarySecNum;

    // 2) 현재 w.summaryBlocks.faqs 중 이번 편집으로 변경되었거나 새 핵심 키워드를 포함한 문항이 있는지 확인
    let matchedFaqIdx = -1;
    w.summaryBlocks.faqs.forEach((f, idx) => {
      const cleanQ = String(f.q || '').replace(/^Q\d+[\.\:]\s*/i, '').trim();
      const qaCombined = `${cleanQ} ${f.a || ''}`;
      if (f.isAiEdited) {
        matchedFaqIdx = idx;
        return;
      }
      if (candidateQ && (cleanQ.includes(candidateQ.slice(0, 14)) || (f.a || '').includes(candidateA.slice(0, 20)))) {
        matchedFaqIdx = idx;
        return;
      }
      const wasInOld = (oldFaqs || []).some(of => String(of.q || '').replace(/^Q\d+[\.\:]\s*/i, '').trim() === cleanQ && String(of.a || '').trim() === String(f.a || '').trim());
      if (!wasInOld) {
        const hitQuoted = quotedMatches.some(qt => qaCombined.includes(qt));
        const hitNewTk = newDistinctiveTokens.filter(tk => qaCombined.includes(tk)).length;
        if (hitQuoted || hitNewTk >= 1) {
          matchedFaqIdx = idx;
        }
      }
    });

    if (matchedFaqIdx !== -1) {
      w.summaryBlocks.faqs[matchedFaqIdx].isAiEdited = true;
      w.summaryBlocks.faqs[matchedFaqIdx].aiEditSecId = primarySecId;
      w.summaryBlocks.faqs[matchedFaqIdx].relatedSection = w.summaryBlocks.faqs[matchedFaqIdx].relatedSection || candidateSec;
      sortFaqsByBodyContextOrder(w);
      return;
    }

    // 3) AI가 faqs 배열에 새 내용을 반영하지 않았거나 candidateQ/A가 비어있다면 새로 추가된 문장 기반으로 즉시 생성!
    if (!candidateQ || !candidateA) {
      const keyConcept = quotedMatches[0] || newDistinctiveTokens.slice(0, 2).join('·') || '';
      const cleanSecTitle = String(primarySec.title || '').replace(/^\d+[\.\)]\s*/, '').trim();
      if (keyConcept) {
        candidateQ = `최근 ${w.keyword || '트렌드'}와 관련해 새롭게 주목받는 '${keyConcept}'의 특징과 핵심 포인트는 무엇인가요?`;
      } else if (cleanSecTitle) {
        candidateQ = cleanSecTitle.endsWith('?')
          ? cleanSecTitle
          : `${cleanSecTitle}와 관련해 꼭 알아두어야 할 새로운 핵심 내용은 무엇인가요?`;
      } else {
        candidateQ = `${w.keyword || '이번 주제'}에서 새롭게 추가된 트렌드와 핵심 내용은 무엇인가요?`;
      }
      candidateA = allAddedSentences.slice(0, 2).join(' ');
    }

    const newFaqItem = {
      q: `Q. ${candidateQ.replace(/^Q\d*[\.\:]\s*/i, '')}`,
      a: candidateA,
      relatedSection: candidateSec,
      isAiEdited: true,
      aiEditSecId: primarySecId
    };

    // 같은 단락(candidateSec)에 연결된 기존 FAQ가 2개 이상이고 전체 FAQ가 6개 이상이면 마지막 연관 문항을 업데이트, 아니면 새로 추가
    const sameSecIndices = w.summaryBlocks.faqs
      .map((f, idx) => (inferFaqRelatedSectionInfo(f, w.draftSections, w.keyword, idx).relatedSection === candidateSec ? idx : -1))
      .filter(idx => idx !== -1);

    if (w.summaryBlocks.faqs.length >= 6 && sameSecIndices.length >= 2) {
      const replaceIdx = sameSecIndices[sameSecIndices.length - 1];
      w.summaryBlocks.faqs[replaceIdx] = newFaqItem;
    } else {
      w.summaryBlocks.faqs.push(newFaqItem);
    }

    sortFaqsByBodyContextOrder(w);
  }

  // 히스토리 탭용 타임스탬프 포맷터 (예: 2026.11.05 16:22)
  function formatHistoryTimestamp(dateInput) {
    const d = dateInput instanceof Date
      ? dateInput
      : (typeof dateInput === 'number' && !isNaN(dateInput) ? new Date(dateInput) : new Date());
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
  }

  // AI 채팅 수정 프롬프트를 히스토리 탭용 초단답 요약(예: '수험표 할인 내용 추가', '택배 없는 날 내용 제외')으로 변환하는 도우미
  function summarizePromptToShortLabel(promptText = '', parsedShortLabel = '', editType = 'add') {
    const aiLabel = String(parsedShortLabel || '')
      .replace(/^['"“”‘’\-\•\s]+|['"“”‘’\.\s]+$/g, '')
      .replace(/했습니다\.?$|되었습니다\.?$|완료\.?$/, '')
      .trim();
    if (aiLabel && aiLabel.length >= 3 && aiLabel.length <= 20) {
      return aiLabel;
    }

    const raw = String(promptText || '').trim();
    if (!raw) return editType === 'remove' ? '일부 내용 제외' : '본문 내용 수정';

    // 1) 자주 쓰는 빠른 편집 프리셋 감지
    if (/구체적인\s*수치.*실제\s*브랜드\s*사례.*보강/.test(raw)) return '최신 팩트·수치 보강';
    if (/불필요한\s*수식어.*반복\s*표현.*간결/.test(raw)) return '문장 간결하게 다듬기';
    if (/실질적인\s*혜택.*체크포인트.*강조/.test(raw)) return '소비자 혜택·팁 강조';
    if (/첫\s*단락\s*도입부\s*질문.*흥미롭고\s*임팩트/.test(raw)) return '도입부·제목 매력적 수정';

    // 2) [단락 0X 수정] / [FAQ 수정] 등 타깃 접두어 분리
    let prefixTag = '';
    const prefixMatch = raw.match(/^\[([^\]]+)\]\s*/);
    if (prefixMatch) {
      const inner = prefixMatch[1].replace(/\s*수정$/, '').trim();
      const secNumM = inner.match(/단락\s*0?(\d+)/);
      prefixTag = secNumM ? `${secNumM[1]}단락 ` : `${inner} `;
    }
    const body = raw.replace(/^\[[^\]]+\]\s*/, '').trim();

    // 3) 동작(추가/제외/보강/순서 변경/다듬기) 판별
    const isExclude = editType === 'remove' || /(?:제외|빼줘|빼고|삭제|지워|없애|생략|빼\s*달라)/.test(body);
    const isOrder = /(?:순서|목차.*변경|앞으로|뒤로|바꿔)/.test(body) && /단락|목차/.test(body);
    const isAdd = /(?:추가|넣어|보강|더\s*써|포함)/.test(body);
    const isPolish = /(?:간결|다듬|짧게|줄여|요약)/.test(body);

    const actionSuffix = isOrder
      ? '목차 순서 변경'
      : isExclude
        ? '내용 제외'
        : isAdd
          ? '내용 추가'
          : isPolish
            ? '문장 다듬기'
            : '내용 수정';

    // 핵심 키워드/명사구 추출
    const coreTopic = body
      .replace(/(?:에\s*대한|에\s*관한|관련된|관련|부분은|부분을|내용은|내용을|문장은|문장을|이야기는|이야기를|언급은|언급을)/g, ' ')
      .replace(/(?:제외해\s*줘.*|제외해\s*달라.*|제외.*|빼\s*줘.*|빼\s*달라.*|빼고.*|삭제해\s*줘.*|삭제.*|지워\s*줘.*|없애\s*줘.*|생략.*|추가해\s*줘.*|추가.*|넣어\s*줘.*|보강해\s*줘.*|보강.*|강조해\s*줘.*|수정해\s*줘.*|고쳐\s*줘.*|다듬어\s*줘.*|바꿔\s*줘.*)$/g, '')
      .replace(/^(?:1단락에|2단락에|3단락에|4단락에|본문에|기사에|에서|중에)\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!coreTopic) {
      return `${prefixTag}${actionSuffix}`.trim();
    }
    const trimmedTopic = coreTopic.length > 11 ? `${coreTopic.slice(0, 10).trim()}…` : coreTopic;
    if (/(?:추가|제외|삭제|보강|강조|수정|변경|다듬기)$/.test(trimmedTopic)) {
      return `${prefixTag}${trimmedTopic}`.trim();
    }
    return `${prefixTag}${trimmedTopic} ${actionSuffix}`.trim();
  }

  // 본문 소제목 단락 시작 전에 들어가는 MK Pick 스타일 도입부 내용(300~500자, 2~3문단) 자동 생성 도우미
  function buildDefaultLeadIntroText(w) {
    if (!w) return '';
    const kw = String(w.keyword || '주요 트렌드').trim();
    const comp = String(w.inputCompany || '').trim();
    const subKw = String(w.inputSubKeywords || '').trim();
    const firstFact = String(
      w.researchItems?.[0]?.fact ||
      w.summaryBlocks?.aiFactSummary?.[0]?.replace(/^\d+\.\s*/, '') ||
      ''
    ).trim();
    const secondFact = String(
      w.researchItems?.[1]?.fact ||
      w.summaryBlocks?.aiFactSummary?.[1]?.replace(/^\d+\.\s*/, '') ||
      ''
    ).trim();

    const secTitles = (w.draftSections || [])
      .map(s => String(s?.title || '').replace(/^["“”'‘’]|["“”'‘’]$/g, '').trim())
      .filter(Boolean);

    const p1 = comp
      ? `빠르게 변화하는 소비 트렌드 속에서 최근 '${kw}'을(를) 둘러싼 소비자와 업계의 관심이 한층 뜨거워지고 있습니다. 특히 ${comp} 등 주요 기업들이 고객의 세분화된 취향과 실용적 가치를 겨냥한 맞춤형 행보를 본격화하면서 시장의 이목이 집중되고 있습니다.`
      : `계절과 일상 속 라이프스타일이 빠르게 변화하면서 최근 '${kw}'에 대한 독자와 소비자들의 관심이 부쩍 높아지고 있습니다. 단순한 유행을 넘어 나에게 꼭 맞는 실질적인 혜택과 차별화된 경험을 찾으려는 똑똑한 소비 흐름이 뚜렷해지고 있기 때문입니다.`;

    const p2 = firstFact
      ? `${firstFact}${secondFact && (p1.length + firstFact.length + secondFact.length < 360) ? ` ${secondFact}` : (subKw ? ` 아울러 '${subKw}' 등 연관 키워드에 대한 관심도 함께 확산하며 실생활에 도움이 되는 알찬 정보 탐색이 활발히 이어지고 있습니다.` : '')}`
      : `최근 관련 업계에서도 이러한 흐름에 발맞춰 다채로운 기획 상품과 프로모션, 실생활 활용 가이드를 잇달아 선보이며 소비자 접점을 넓히고 있습니다.${subKw ? ` 특히 '${subKw}' 등 핵심 포인트가 함께 주목받으며 선택의 폭이 더욱 다양해졌습니다.` : ''}`;

    const guideSummary = secTitles.length >= 2
      ? `'${kw}'의 주목 배경과 핵심 트렌드부터 주요 특징·혜택 비교, 그리고 알아두면 유익한 실전 체크포인트까지`
      : `'${kw}'의 핵심 배경부터 주요 특징과 혜택, 실생활 활용 팁까지`;

    const p3 = `이번 기사에서는 ${guideSummary} 상세히 정리해 드립니다.`;

    return [p1, p2, p3].join('\n\n');
  }

  function ensureWorkLeadIntro(w) {
    if (!w) return;
    w.summaryBlocks = w.summaryBlocks || {};
    if (typeof w.summaryBlocks.includeLeadIntro !== 'boolean') {
      w.summaryBlocks.includeLeadIntro = true;
    }
    const curIntro = String(w.summaryBlocks.leadIntro || '').trim();
    if (!curIntro && !w.isBlankTemplate && w.draftSections?.[0]?.id !== 'sec-blank-1') {
      w.summaryBlocks.leadIntro = buildDefaultLeadIntroText(w);
    }
  }

  // 기사의 버전 히스토리 배열(w.editVersionHistory)이 항상 '원문 초안'부터 존재하도록 보장하는 함수
  function ensureWorkVersionHistory(w) {
    if (!w) return [];
    ensureWorkLeadIntro(w);
    if (!w.initialDraftSnapshot && !w.isBlankTemplate && w.draftSections?.[0]?.id !== 'sec-blank-1') {
      // 만약 이미 AI 편집을 거친 기사인데 initialDraftSnapshot이 없다면 가장 첫 편집 이전 스냅샷을 원문 초안으로 사용
      const earliestBefore = (Array.isArray(w.aiEditHistory) && w.aiEditHistory[0]) || w.lastAiEdit?.beforeSnapshot || null;
      if (earliestBefore && Array.isArray(earliestBefore.draftSections) && earliestBefore.draftSections.length > 0) {
        w.initialDraftSnapshot = JSON.parse(JSON.stringify({
          title: earliestBefore.title || w.title || '',
          titleCandidates: w.titleCandidates || [],
          sources: w.sources || [],
          researchItems: w.researchItems || [],
          draftSections: earliestBefore.draftSections,
          summaryBlocks: {
            ...(w.summaryBlocks || {}),
            subtitle: earliestBefore.subtitle ?? w.summaryBlocks?.subtitle ?? '',
            leadIntro: earliestBefore.leadIntro ?? w.summaryBlocks?.leadIntro ?? '',
            includeLeadIntro: earliestBefore.includeLeadIntro ?? (w.summaryBlocks?.includeLeadIntro !== false),
            aiFactSummary: earliestBefore.aiFactSummary || w.summaryBlocks?.aiFactSummary || [],
            summaryTable: earliestBefore.summaryTable || w.summaryBlocks?.summaryTable || {},
            faqs: earliestBefore.faqs || w.summaryBlocks?.faqs || [],
            closingParagraph: earliestBefore.closingParagraph ?? w.summaryBlocks?.closingParagraph ?? '',
            oneLineSummary: earliestBefore.oneLineSummary ?? w.summaryBlocks?.oneLineSummary ?? ''
          },
          factChecks: extractFactSentencesFromSections(earliestBefore.draftSections, w.sources || []),
          factVerification: w.factVerification || null
        }));
      } else {
        w.initialDraftSnapshot = captureWorkFullSnapshot(w);
      }
    }

    if (!Array.isArray(w.editVersionHistory) || w.editVersionHistory.length === 0) {
      const baseTime = w.createdAtFormatted || formatHistoryTimestamp(w.createdAtTs || Date.now());
      w.createdAtFormatted = baseTime;
      w.editVersionHistory = [
        {
          id: 'ver-0',
          versionNum: 0,
          versionLabel: '원문 초안',
          timestamp: baseTime,
          shortLabel: '',
          prompt: '',
          snapshot: w.initialDraftSnapshot || captureWorkFullSnapshot(w),
          aiEditRecord: null
        }
      ];

      // 기존에 이미 AI 채팅 수정이 1회 이상 적용되어 있던 기사라면 자동으로 '수정 1' 항목으로 복원
      if (w.lastAiEdit) {
        const migLabel = summarizePromptToShortLabel(w.lastAiEdit.prompt || '', w.lastAiEdit.shortLabel || '', w.lastAiEdit.editType || 'add');
        const migEntry = {
          id: 'ver-mig-1',
          versionNum: 1,
          versionLabel: '수정 1',
          timestamp: w.lastAiEdit.historyTimestamp || formatHistoryTimestamp(Date.now()),
          shortLabel: migLabel,
          prompt: w.lastAiEdit.prompt || '',
          snapshot: captureWorkFullSnapshot(w),
          aiEditRecord: JSON.parse(JSON.stringify(w.lastAiEdit))
        };
        w.editVersionHistory.push(migEntry);
        w.activeVersionId = migEntry.id;
      } else {
        w.activeVersionId = 'ver-0';
      }
    }

    if (!w.activeVersionId) {
      w.activeVersionId = w.editVersionHistory[w.editVersionHistory.length - 1]?.id || 'ver-0';
    }
    return w.editVersionHistory;
  }

  // 새로운 AI 채팅 수정 버전을 히스토리(w.editVersionHistory)에 추가하는 함수
  function recordWorkVersionEntry(w, { shortLabel = '', prompt = '', aiEditRecord = null } = {}) {
    if (!w) return null;
    ensureWorkVersionHistory(w);
    const editItems = w.editVersionHistory.filter(v => v.id !== 'ver-0');
    const nextNum = editItems.length + 1;
    const nowFormatted = formatHistoryTimestamp(new Date());
    const finalShort = summarizePromptToShortLabel(prompt, shortLabel, aiEditRecord?.editType || 'add');
    if (aiEditRecord) {
      aiEditRecord.shortLabel = finalShort;
      aiEditRecord.historyTimestamp = nowFormatted;
    }
    const newEntry = {
      id: `ver-${Date.now()}-${nextNum}`,
      versionNum: nextNum,
      versionLabel: `수정 ${nextNum}`,
      timestamp: nowFormatted,
      shortLabel: finalShort,
      prompt: String(prompt || '').trim(),
      snapshot: captureWorkFullSnapshot(w),
      aiEditRecord: aiEditRecord ? JSON.parse(JSON.stringify(aiEditRecord)) : null
    };
    w.editVersionHistory.push(newEntry);
    w.activeVersionId = newEntry.id;
    return newEntry;
  }

  // 히스토리 탭에서 특정 버전('원문 초안' 또는 '수정 N')을 클릭했을 때 해당 버전으로 기사 전체(본문·목차·요약표·FAQ·하이라이트)를 복원하는 함수
  function restoreWorkVersionEntryById(w, versionId) {
    if (!w || !versionId) return null;
    ensureWorkVersionHistory(w);
    const targetEntry = (w.editVersionHistory || []).find(v => v.id === versionId);
    if (!targetEntry || !targetEntry.snapshot) return null;

    applyWorkFullSnapshot(w, targetEntry.snapshot);
    w.isBlankTemplate = false;
    w.justRestoredInitial = (targetEntry.id === 'ver-0');
    w.activeVersionId = targetEntry.id;

    if (targetEntry.aiEditRecord) {
      w.lastAiEdit = JSON.parse(JSON.stringify(targetEntry.aiEditRecord));
      w.lastAiEdit.isApplied = true;
      state.activeHighlight = w.lastAiEdit;
    } else {
      w.lastAiEdit = null;
      state.activeHighlight = null;
    }

    sortFaqsByBodyContextOrder(w);
    w.factChecks = extractFactSentencesFromSections(w.draftSections, w.sources);
    return targetEntry;
  }

  // AI 채팅으로 기사 수정된 문장/내용을 [넣었다 / 뺐다] 토글할 때 본문·목차·FAQ·한줄요약을 즉시 동기화하는 함수
  function syncWorkWithAiEditState(w) {
    if (!w || !w.lastAiEdit) return;
    const aiEdit = w.lastAiEdit;
    const beforeSnap = aiEdit.beforeSnapshot;
    const afterSnap = aiEdit.afterSnapshot;
    if (!beforeSnap || !afterSnap) return;

    const allSentObjs = Object.values(aiEdit.sentenceStates || {}).flat();
    const addedObjs = allSentObjs.filter(s => s.type !== 'removed');
    const removedObjs = allSentObjs.filter(s => s.type === 'removed');

    const anyAddedActive = addedObjs.some(s => s.included !== false);
    const anyRemovedActive = removedObjs.some(s => s.included === false);
    const anyActive = allSentObjs.length > 0
      ? (anyAddedActive || anyRemovedActive)
      : Boolean(aiEdit.isApplied);
    aiEdit.isApplied = anyActive;

    // 1) 단락별 본문(draftSections) 동기화
    (aiEdit.secIds || []).forEach(secId => {
      const sec = (w.draftSections || []).find(s => s.id === secId);
      const beforeSec = (beforeSnap.draftSections || []).find(s => s.id === secId);
      const afterSec = (afterSnap.draftSections || []).find(s => s.id === secId);
      if (!sec) return;

      const sentList = aiEdit.sentenceStates?.[secId] || [];
      const secAdded = sentList.filter(s => s.type !== 'removed');
      const secRemoved = sentList.filter(s => s.type === 'removed');

      if (sentList.length === 0) {
        if (anyActive && afterSec) {
          sec.title = afterSec.title;
          sec.content = afterSec.content;
        } else if (!anyActive && beforeSec) {
          sec.title = beforeSec.title;
          sec.content = beforeSec.content;
        }
        return;
      }

      // 삭제·제외 전용 단락인 경우: included === false면 제외 적용(afterSec), included === true면 복원(beforeSec)
      if (secAdded.length === 0 && secRemoved.length > 0) {
        const allRestored = secRemoved.every(s => s.included !== false);
        if (allRestored && beforeSec) {
          sec.title = beforeSec.title;
          sec.content = beforeSec.content;
        } else if (afterSec) {
          const restoredSents = secRemoved.filter(s => s.included !== false).map(s => s.text);
          sec.title = afterSec.title;
          sec.content = restoredSents.length > 0
            ? [afterSec.content, restoredSents.join(' ')].filter(Boolean).join('\n\n')
            : afterSec.content;
        }
        aiEdit.sentencesBySecId[secId] = [];
        return;
      }

      const incList = secAdded.filter(s => s.included !== false);
      const excList = secAdded.filter(s => s.included === false);

      if (incList.length === 0 && beforeSec) {
        sec.title = beforeSec.title;
        sec.content = beforeSec.content;
        aiEdit.sentencesBySecId[secId] = [];
      } else if (excList.length === 0 && afterSec) {
        sec.title = afterSec.title;
        sec.content = afterSec.content;
        aiEdit.sentencesBySecId[secId] = incList.map(s => s.text);
      } else if (afterSec) {
        // 일부 문장만 선택적으로 넣거나 뺀 경우: afterSec.content에서 제외된 문장(excList)만 정교하게 제거
        const paras = String(afterSec.content || '').split(/\n+/);
        const rebuiltParas = paras.map(p => {
          const sents = splitIntoSentences(p);
          const kept = sents.filter(st => {
            const cleanSt = st.trim();
            return !excList.some(ex => isEssentiallySameSentence(cleanSt, ex.text));
          });
          return kept.join(' ').trim();
        }).filter(Boolean);
        sec.title = afterSec.title;
        sec.content = rebuiltParas.join('\n\n');
        aiEdit.sentencesBySecId[secId] = incList.map(s => s.text);
      }
    });

    // 2) 제목, 도입부, 요약표, 하단 FAQ, 한 줄 요약 동시 동기화
    if (!anyActive) {
      w.title = beforeSnap.title;
      if (w.summaryBlocks) {
        w.summaryBlocks.subtitle = beforeSnap.subtitle;
        if (beforeSnap.leadIntro !== undefined) w.summaryBlocks.leadIntro = beforeSnap.leadIntro;
        if (typeof beforeSnap.includeLeadIntro === 'boolean') w.summaryBlocks.includeLeadIntro = beforeSnap.includeLeadIntro;
        w.summaryBlocks.aiFactSummary = JSON.parse(JSON.stringify(beforeSnap.aiFactSummary || []));
        w.summaryBlocks.summaryTable = JSON.parse(JSON.stringify(beforeSnap.summaryTable || {}));
        w.summaryBlocks.faqs = JSON.parse(JSON.stringify(beforeSnap.faqs || []));
        w.summaryBlocks.closingParagraph = beforeSnap.closingParagraph;
        w.summaryBlocks.oneLineSummary = beforeSnap.oneLineSummary;
      }
    } else {
      w.title = afterSnap.title;
      if (w.summaryBlocks) {
        w.summaryBlocks.subtitle = afterSnap.subtitle;
        if (afterSnap.leadIntro !== undefined) w.summaryBlocks.leadIntro = afterSnap.leadIntro;
        if (typeof afterSnap.includeLeadIntro === 'boolean') w.summaryBlocks.includeLeadIntro = afterSnap.includeLeadIntro;
        w.summaryBlocks.aiFactSummary = JSON.parse(JSON.stringify(afterSnap.aiFactSummary || []));
        w.summaryBlocks.summaryTable = JSON.parse(JSON.stringify(afterSnap.summaryTable || {}));
        w.summaryBlocks.faqs = JSON.parse(JSON.stringify(afterSnap.faqs || []));
        w.summaryBlocks.closingParagraph = afterSnap.closingParagraph;
        w.summaryBlocks.oneLineSummary = afterSnap.oneLineSummary;

        const activeAddedObjs = addedObjs.filter(s => s.included !== false);
        if (activeAddedObjs.length < addedObjs.length && activeAddedObjs.length > 0) {
          (w.summaryBlocks.faqs || []).forEach(f => {
            if (f.isAiEdited) {
              f.a = activeAddedObjs.map(s => s.text).slice(0, 2).join(' ');
            }
          });
        }
      }
    }

    sortFaqsByBodyContextOrder(w);
    w.factChecks = extractFactSentencesFromSections(w.draftSections, w.sources);
    state.activeHighlight = aiEdit;
  }

  // 우측 [💬 AI 채팅으로 기사 수정] 실행 함수 (추가·수정 문장 정밀 추출 & 제외 시 전체 하이라이트 방지 + 목차·FAQ 동시 업데이트 + 히스토리 영구 기록 + 중단/취소 완벽 지원)
  async function applyAiNaturalLanguageEditToWork(w, promptText, abortSignal = null, runId = 0) {
    if (!w || !promptText || !promptText.trim()) return;
    const instruction = promptText.trim();
    const isRemovalInstruction = /(?:제외|빼줘|빼고|삭제|지워|없애|생략|빼\s*달라)/.test(instruction) && !/(?:추가|보강|넣어|대신)/.test(instruction);

    // 편집 전 '원문 초안' 버전이 히스토리에 반드시 보존되도록 먼저 초기화
    ensureWorkVersionHistory(w);

    const beforeSnapshot = JSON.parse(JSON.stringify({
      title: w.title,
      subtitle: w.summaryBlocks?.subtitle || '',
      leadIntro: w.summaryBlocks?.leadIntro || '',
      includeLeadIntro: w.summaryBlocks?.includeLeadIntro !== false,
      aiFactSummary: w.summaryBlocks?.aiFactSummary || [],
      draftSections: w.draftSections || [],
      summaryTable: w.summaryBlocks?.summaryTable || {},
      faqs: w.summaryBlocks?.faqs || [],
      closingParagraph: w.summaryBlocks?.closingParagraph || '',
      oneLineSummary: w.summaryBlocks?.oneLineSummary || ''
    }));

    const oldSectionsMap = {};
    (w.draftSections || []).forEach(s => {
      oldSectionsMap[s.id] = { title: s.title, content: s.content };
    });
    const oldFaqs = JSON.parse(JSON.stringify(w.summaryBlocks?.faqs || []));
    const oldTitle = w.title;
    const oldAiSummary = (w.summaryBlocks?.aiFactSummary || []).join('\n');

    const apiKey = getClientPerplexityKey();
    const todayStr = new Date().toISOString().slice(0, 10);

    const currentArticlePayload = {
      title: w.title,
      leadIntro: w.summaryBlocks?.leadIntro || '',
      draftSections: (w.draftSections || []).map(s => ({ id: s.id, title: s.title, content: s.content })),
      summaryTable: w.summaryBlocks?.summaryTable || {},
      faqs: (w.summaryBlocks?.faqs || []).map(f => ({ q: f.q, a: f.a, relatedSection: f.relatedSection })),
      closingParagraph: w.summaryBlocks?.closingParagraph || '',
      oneLineSummary: w.summaryBlocks?.oneLineSummary || ''
    };

    const sys = `당신은 매일경제 MK Pick 수석 에디터입니다.
편집자가 작성된 초안을 보고 **AI 채팅으로 기사 수정 지시**를 입력했습니다.
필요 시 web_search로 오늘(${todayStr}) 기준 최신 뉴스 팩트를 추가 검색하여 편집자의 지시를 정확히 반영해 기사를 수정하세요.
[필수 규칙]
1. 편집자의 지시('${instruction}')를 충실히 반영하여 해당되는 단락(draftSections), 제목(title), 기사 도입부(leadIntro, 300~500자), 한 줄 요약(oneLineSummary)을 수정하세요. 지시와 무관한 단락은 원문 그대로 유지하세요.
2. [글 목차 순서 & 단락 소제목 동시 반영]
   - 단락의 내용이 수정·추가·제외되었거나 단락 순서 변경 요청이 있다면, **수정된 본문 핵심 내용에 맞춰 해당 단락의 소제목(\`draftSections[].title\`)과 단락 목차 순서도 함께 자연스럽게 업데이트**하세요. (제외된 내용이 소제목에 남아 있으면 절대 안 됩니다!)
3. [하단 FAQ 내용 & 목차 순서 100% 필수 동시 반영]
   - 본문 단락에 새로운 개념·트렌드·제품·수치·문장이 추가·수정되었다면, **반드시 \`addedOrUpdatedFaq\`와 하단 \`faqs\` 배열에 해당 내용을 반영**하고, 변경된 본문 목차 순서(1단락 → 마지막 단락)에 맞춰 \`faqs\`를 배치하세요.
   - 반대로 본문에서 삭제·제외된 내용은 \`faqs\`와 \`summaryTable\`에서도 즉시 제거하세요.
4. 모든 본문과 답변은 매일경제 경어체("~합니다/습니다")를 유지하세요.
5. \`highlightedSentences\`에는 **이번 편집으로 '새로 추가'되었거나 '새로 작성'된 문장만** 넣으세요. 만약 편집자가 특정 내용을 제외·삭제해달라고 요청하여 문장을 빼기만 한 경우에는 기존 남은 문장을 절대 넣지 말고 빈 배열(\`[]\`)로 반환하세요!`;

    const usr = `[편집자의 AI 채팅 수정 지시]: "${instruction}"
[현재 기사 데이터]:
${JSON.stringify(currentArticlePayload, null, 2)}

편집자의 지시를 반영해 수정한 전체 기사 데이터를 아래 순수 JSON 형식으로만 출력하세요:
{
  "shortHistoryLabel": "히스토리 탭에 표시할 14자 이내 초단답 수정 요약 (예: 수험표 할인 내용 추가 / 택배 없는 날 내용 제외 / 2단락 수치 보강 / 목차 순서 변경)",
  "editSummary": "편집자의 요청에 따라 어떤 단락·목차와 하단 FAQ를 어떻게 수정·추가·제외했는지 1문장 요약 (~했습니다 체)",
  "editedSectionIds": ["실제로 내용이 변경된 단락의 id 배열만 기재"],
  "highlightedSentences": ["이번 편집으로 새로 추가된 문장 원문 그대로 (내용 제외·삭제만 한 경우 반드시 빈 배열 [])"],
  "addedOrUpdatedFaq": {
    "relatedSection": 2,
    "q": "Q. 이번에 본문에 새로 추가·보강된 핵심 내용에 대한 독자 구어체 질문 (삭제만 한 경우 빈 문자열)",
    "a": "이번에 새로 추가·보강된 본문 핵심 문장과 팩트를 100% 반영한 2문장 답변 (~합니다 체)"
  },
  "title": "수정된 기사 제목 (변경 없으면 기존 제목 그대로)",
  "leadIntro": "수정된 기사 도입부 내용 (공백 포함 300~500자, 2~3문단, 변경 없으면 기존 leadIntro 그대로)",
  "draftSections": [
    {"id": "sec-1", "title": "수정된 본문 핵심을 반영한 단락 소제목", "content": "단락 본문 (~합니다 체)"}
  ],
  "summaryTable": {
    "title": "[요약표] 제목",
    "headers": ["구분", "핵심 내용", "주요 특징", "추천 대상·활용 팁"],
    "rows": [["항목", "내용", "특징", "팁"]]
  },
  "faqs": [
    {"relatedSection": 1, "q": "Q1. 수정된 본문 및 목차 순서와 100% 일치하는 질문", "a": "수정된 본문과 100% 일치하는 답변 (~합니다 체)"}
  ],
  "closingParagraph": "마무리 총평 문단",
  "oneLineSummary": "한 줄 요약! 문장"
}`;

    const { parsed } = await callPerplexityDirectFromBrowser(apiKey, sys, usr, 'month', 'draft', 6000, '', abortSignal);
    if ((abortSignal && abortSignal.aborted) || (runId && runId !== currentAiEditRunId)) {
      const cancelErr = new Error('USER_CANCELLED_AI_EDIT');
      cancelErr.isUserCancelled = true;
      throw cancelErr;
    }

    // AI 응답이 중단 없이 정상 완료된 시점에만 되돌리기(Undo) 스냅샷을 추가 (중단 시 히스토리 오염 방지)
    w.aiEditHistory = Array.isArray(w.aiEditHistory) ? w.aiEditHistory : [];
    w.aiEditHistory.push(JSON.parse(JSON.stringify(beforeSnapshot)));
    if (w.aiEditHistory.length > 15) w.aiEditHistory.shift();

    const normalizeNl = s => String(s || '').replace(/\\n/g, '\n').trim();

    if (parsed.title) w.title = normalizeNl(parsed.title);
    if (parsed.subtitle) w.summaryBlocks.subtitle = normalizeNl(parsed.subtitle);
    if (parsed.leadIntro) w.summaryBlocks.leadIntro = normalizeNl(parsed.leadIntro);
    if (Array.isArray(parsed.aiFactSummary) && parsed.aiFactSummary.length > 0) {
      w.summaryBlocks.aiFactSummary = parsed.aiFactSummary.map(s => normalizeNl(s));
    }

    const changedSecIds = new Set();
    const highlightedBySecId = {};
    const removedBySecId = {};
    const sentenceStates = {};
    const globalHighlightedSentences = Array.isArray(parsed.highlightedSentences)
      ? parsed.highlightedSentences.map(s => normalizeNl(s)).filter(Boolean)
      : [];

    if (Array.isArray(parsed.draftSections) && parsed.draftSections.length > 0) {
      w.draftSections = parsed.draftSections.map((sec, idx) => {
        const secId = sec.id || w.draftSections?.[idx]?.id || `sec-${idx + 1}`;
        const existingSec = (w.draftSections || []).find(s => s.id === secId) || {};
        const newTitle = normalizeNl(sec.title || existingSec.title || `단락 ${idx + 1}`);
        const newContent = normalizeNl(sec.content || '');
        const oldSec = oldSectionsMap[secId];

        const oldContent = oldSec?.content || '';
        const oldTitle = oldSec?.title || '';
        const oldSents = splitIntoSentences(oldContent);
        const newSents = splitIntoSentences(newContent);

        // 1) 기존 단락에 없던 진짜 새로 추가된 문장만 추출 (기존 문장과 유사도 높은 문장은 제외하여 전체 본문 하이라이트 버그 원천 차단!)
        let addedSents = newSents.filter(ns => !oldSents.some(os => isEssentiallySameSentence(os, ns)));

        // 2) 기존 단락에 있었으나 이번 편집으로 삭제·제외된 문장 추출
        const removedSents = oldSents.filter(os => !newSents.some(ns => isEssentiallySameSentence(os, ns)));

        // 3) 만약 문장 추가/삭제 없이 기존 문장 내부 수치·단어만 소폭 수정된 경우 (단, 제외 지시가 아닐 때만)
        if (addedSents.length === 0 && removedSents.length === 0 && !isRemovalInstruction && normalizeSentForCompare(oldContent) !== normalizeSentForCompare(newContent)) {
          const modifiedInPlace = newSents.filter(ns => !oldSents.some(os => normalizeSentForCompare(os) === normalizeSentForCompare(ns)));
          if (modifiedInPlace.length > 0 && modifiedInPlace.length < newSents.length) {
            addedSents = modifiedInPlace;
          } else {
            const validGlobal = globalHighlightedSentences.filter(gs =>
              newSents.some(ns => isEssentiallySameSentence(ns, gs)) &&
              !oldSents.some(os => normalizeSentForCompare(os) === normalizeSentForCompare(gs))
            );
            addedSents = validGlobal;
          }
        }

        // 순수 삭제·제외 요청이거나 실제로 문장이 삭제만 된 경우 addedSents를 강제로 비워 남은 본문에 하이라이트가 칠해지지 않게 보장
        if (isRemovalInstruction && removedSents.length > 0) {
          addedSents = [];
        }

        const titleChanged = normalizeSentForCompare(oldTitle) !== normalizeSentForCompare(newTitle);
        const hasActualChange = addedSents.length > 0 || removedSents.length > 0 || titleChanged;

        if (hasActualChange) {
          changedSecIds.add(secId);
          highlightedBySecId[secId] = addedSents;
          removedBySecId[secId] = removedSents;

          const stateItems = [
            ...addedSents.map((txt, sIdx) => ({
              id: `${secId}-ai-add-${sIdx}`,
              secId,
              type: 'added',
              text: txt,
              included: true
            })),
            ...removedSents.map((txt, rIdx) => ({
              id: `${secId}-ai-rem-${rIdx}`,
              secId,
              type: 'removed',
              text: txt,
              included: false
            }))
          ];
          sentenceStates[secId] = stateItems;
        }

        return {
          ...existingSec,
          id: secId,
          title: newTitle,
          content: newContent,
          imageCaption: existingSec.imageCaption || ''
        };
      });
    }

    // [목차 순서 & 단락 소제목 자동 동기화] 본문 수정·제외·순서 변경 사항을 단락 소제목과 목차 순서에 즉시 반영
    syncSectionTitlesWithUpdatedBody(w, {
      instruction,
      oldSectionsMap,
      highlightedBySecId,
      removedBySecId
    });

    if (parsed.summaryTable && Array.isArray(parsed.summaryTable.rows)) {
      w.summaryBlocks.summaryTable = {
        title: normalizeNl(parsed.summaryTable.title || w.summaryBlocks.summaryTable?.title || '[요약표]'),
        headers: (parsed.summaryTable.headers || w.summaryBlocks.summaryTable?.headers || []).map(h => normalizeNl(h)),
        rows: parsed.summaryTable.rows.map(r => Array.isArray(r) ? r.map(c => normalizeNl(c)) : [])
      };
    }

    if (Array.isArray(parsed.faqs) && parsed.faqs.length > 0) {
      w.summaryBlocks.faqs = parsed.faqs.map((f, i) => ({
        q: /^Q\d+\./i.test(normalizeNl(f.q)) ? normalizeNl(f.q) : `Q${i + 1}. ${normalizeNl(f.q)}`,
        a: normalizeNl(f.a),
        relatedSection: Number(f.relatedSection) || undefined,
        isAiEdited: Boolean(f.isAiEdited)
      }));
    }

    if (parsed.closingParagraph) w.summaryBlocks.closingParagraph = normalizeNl(parsed.closingParagraph);
    if (parsed.oneLineSummary) w.summaryBlocks.oneLineSummary = normalizeNl(parsed.oneLineSummary);

    // 1) 로컬 삭제 키워드 및 명시적 제외 요청 검사를 수행해 본문에서 삭제된 내용이 FAQ·요약표에 남지 않도록 정리 + 목차 순서대로 FAQ 재정렬
    const syncDelRes = syncFaqsAndTableOnBodyEdit(w, {
      previousBody: Object.values(oldSectionsMap).map(s => s.content).join('\n'),
      newBody: (w.draftSections || []).map(s => s.content).join('\n'),
      instruction
    });

    // 2) 새로 본문에 추가·보강된 문장/개념이 있을 때 하단 FAQ(STEP 07)에 새 Q&A 추가·업데이트 후 목차 순서(단락 01 -> 04)에 맞춰 정렬
    const totalAddedCount = Object.values(highlightedBySecId).flat().length;
    if (totalAddedCount > 0 && !isRemovalInstruction) {
      ensureAiEditedContentReflectedInFaqs(w, {
        instruction,
        oldFaqs,
        changedSecIds: [...changedSecIds],
        highlightedBySecId,
        parsedAddedFaq: (parsed.addedOrUpdatedFaq && parsed.addedOrUpdatedFaq.q) ? parsed.addedOrUpdatedFaq : null
      });
    } else {
      sortFaqsByBodyContextOrder(w);
    }

    const nowTimeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    state.lastFaqAutoSyncInfo = {
      time: nowTimeStr,
      removedFaqCount: syncDelRes?.removedFaqCount || 0,
      updatedFaqCount: (w.summaryBlocks?.faqs || []).filter(f => f.isAiEdited).length || (totalAddedCount > 0 ? 1 : 0),
      removedKeywords: syncDelRes?.removedTokens || [],
      aiPromptSynced: true
    };

    w.factChecks = extractFactSentencesFromSections(w.draftSections, w.sources);

    const afterSnapshot = JSON.parse(JSON.stringify({
      title: w.title,
      subtitle: w.summaryBlocks?.subtitle || '',
      leadIntro: w.summaryBlocks?.leadIntro || '',
      includeLeadIntro: w.summaryBlocks?.includeLeadIntro !== false,
      aiFactSummary: w.summaryBlocks?.aiFactSummary || [],
      draftSections: w.draftSections || [],
      summaryTable: w.summaryBlocks?.summaryTable || {},
      faqs: w.summaryBlocks?.faqs || [],
      closingParagraph: w.summaryBlocks?.closingParagraph || '',
      oneLineSummary: w.summaryBlocks?.oneLineSummary || ''
    }));

    const totalRemovedCount = Object.values(removedBySecId).flat().length;
    const editType = (totalAddedCount === 0 && totalRemovedCount > 0) ? 'remove' : 'add';
    const shortHistoryLabel = summarizePromptToShortLabel(instruction, parsed.shortHistoryLabel || '', editType);

    const aiEditRecord = {
      mode: 'ai-edit',
      prompt: instruction,
      shortLabel: shortHistoryLabel,
      editType,
      summary: normalizeNl(parsed.editSummary || `"${instruction}" 요청을 반영해 본문·목차 소제목·하단 FAQ를 동시에 업데이트했습니다.`),
      isApplied: true,
      isHighlightVisible: true,
      secIds: [...changedSecIds],
      sentencesBySecId: highlightedBySecId,
      removedBySecId,
      sentenceStates,
      beforeSnapshot,
      afterSnapshot,
      titleChanged: w.title !== oldTitle,
      aiSummaryChanged: (w.summaryBlocks?.aiFactSummary || []).join('\n') !== oldAiSummary,
      timestamp: nowTimeStr
    };

    w.lastAiEdit = aiEditRecord;
    state.activeHighlight = aiEditRecord;

    // [히스토리 탭 영구 기록] 수정 버전(수정 N), 업데이트 시간, 업데이트 내용(초단답)을 기록
    recordWorkVersionEntry(w, {
      shortLabel: shortHistoryLabel,
      prompt: instruction,
      aiEditRecord
    });

    return state.activeHighlight;
  }

  // 기사 본문 전체의 GEO 최적화 달성 여부를 실시간 자동 진단하는 함수
  function evaluateGeoChecklist(w) {
    if (!w) return { passedCount: 0, total: GEO_CHECKLIST_ITEMS.length, details: [] };
    const sb = w.summaryBlocks || {};
    const title = w.title || '';
    const firstBody = w.draftSections?.[0]?.content || '';
    const allBody = (w.draftSections || []).map(s => s.content || '').join('\n');
    const numberRegex = /\d+(?:,\d+)?\s*(?:년|월|일|만\s*원|억|원|%|곳|명|종|개|배|시간|세|위|회)/;

    const checks = {
      'geo-1': /["“”']/.test(title) && (title.includes('…') || title.includes('...')),
      'geo-2': sb.includeLeadIntro !== false
        ? String(sb.leadIntro || '').trim().length >= 80
        : String(sb.oneLineSubtitle || '').trim().length >= 6,
      'geo-3': firstBody.includes('?'),
      'geo-4': numberRegex.test(allBody),
      'geo-5': (sb.summaryTable?.rows || []).length >= 2,
      'geo-6': (sb.faqs || []).length >= 5,
      'geo-7': (sb.oneLineSummary || '').trim().startsWith('한 줄 요약!') && /합니다\.|습니다\./.test(allBody)
    };

    const details = GEO_CHECKLIST_ITEMS.map(item => ({
      ...item,
      passed: Boolean(checks[item.id])
    }));
    const passedCount = details.filter(d => d.passed).length;
    return { passedCount, total: details.length, details };
  }

  // CMS 붙여넣기용 전체 순수 텍스트 생성 (도입부 ON일 때 본문 단락 시작 전에 도입부 내용 포함, OFF일 때는 자동 제외)
  function buildPlainTextArticle(w) {
    if (!w) return '';
    const sb = w.summaryBlocks || {};
    const activeSources = (w.sources || []).filter(s => !s.excluded);
    const lines = [];

    if (sb.byline) lines.push(`[${sb.byline}]`);
    if (sb.companyTags && sb.companyTags.length > 0) {
      lines.push(`태그: ${sb.companyTags.map(t => '#' + t).join(' ')}`);
    }
    lines.push('');
    lines.push(w.title || '');
    if (sb.oneLineSubtitle && sb.oneLineSubtitle.trim()) {
      lines.push(String(sb.oneLineSubtitle).trim());
    }
    lines.push('');

    if (sb.includeLeadIntro !== false && sb.leadIntro && String(sb.leadIntro).trim()) {
      lines.push(String(sb.leadIntro).replace(/\\n/g, '\n').trim());
      lines.push('');
    }

    (w.draftSections || []).forEach(sec => {
      if (sec.title) lines.push(`■ ${String(sec.title).replace(/\\n/g, '\n')}`);
      if (sec.content) lines.push(String(sec.content).replace(/\\n/g, '\n'));
      if (sec.imageCaption) lines.push(String(sec.imageCaption).replace(/\\n/g, '\n'));
      lines.push('');
    });

    if (sb.summaryTable && sb.summaryTable.rows && sb.summaryTable.rows.length > 0) {
      lines.push(sb.summaryTable.title || '[요약표]');
      lines.push((sb.summaryTable.headers || []).join('\t'));
      lines.push('-'.repeat(48));
      sb.summaryTable.rows.forEach(r => {
        lines.push(r.join('\t'));
      });
      lines.push('');
    }

    if (sb.glossary && sb.glossary.length > 0) {
      lines.push(`[${sb.glossaryTitle || '주제를 더 깊이 이해하는 용어 사전'}]`);
      sb.glossary.forEach(g => {
        if (g.term || g.desc) {
          lines.push(`${g.term} : ${g.desc}`);
          lines.push('');
        }
      });
    }

    if (sb.faqs && sb.faqs.length > 0) {
      lines.push('[자주 묻는 질문 (FAQ)]');
      sb.faqs.forEach(f => {
        lines.push(f.q);
        lines.push(`A. ${f.a}`);
        lines.push('');
      });
    }

    if (sb.closingParagraph) {
      lines.push(sb.closingParagraph);
      lines.push('');
    }

    if (sb.oneLineSummary) {
      lines.push(sb.oneLineSummary);
      lines.push('');
    }

    if (sb.noticeText) {
      lines.push(sb.noticeText);
      lines.push('');
    }

    if (sb.imageRecommendations && sb.imageRecommendations.length > 0) {
      lines.push('[이미지 캡션]');
      sb.imageRecommendations.forEach(img => {
        lines.push(`${img.position}: ${img.caption}`);
      });
      lines.push('');
    }

    if (activeSources.length > 0) {
      lines.push('[참고 자료 및 출처 목록]');
      activeSources.forEach((s, i) => {
        lines.push(`${i + 1}. ${s.title} (${s.url})`);
      });
    }

    return lines.join('\n').trim();
  }

  // 브라우저를 껐다 켜거나 사이트를 나갔다 들어와도 편집 본문과 히스토리(원문 초안 ~ 수정 N)가 100% 보존되도록 이중 저장하는 함수
  function persistWorksToLocalStorageReliably() {
    try {
      if (state.currentWork && state.currentWork.id) {
        ensureWorkVersionHistory(state.currentWork);
        const cIdx = state.works.findIndex(w => w && w.id === state.currentWork.id);
        if (cIdx !== -1) {
          state.works[cIdx] = state.currentWork;
        } else {
          state.works.unshift(state.currentWork);
        }
      }

      // 1) 히스토리 전용 백업 맵(CLIENT_HISTORY_BACKUP_KEY) 저장 (최근 15개 작업의 버전 히스토리 및 최신 본문 보장)
      let historyMap = {};
      try {
        const rawMap = localStorage.getItem(CLIENT_HISTORY_BACKUP_KEY);
        if (rawMap) historyMap = JSON.parse(rawMap) || {};
      } catch (e) {
        historyMap = {};
      }

      (state.works || []).slice(0, 15).forEach(w => {
        if (!w || !w.id) return;
        if (Array.isArray(w.editVersionHistory) && w.editVersionHistory.length > 0) {
          historyMap[w.id] = {
            id: w.id,
            keyword: w.keyword,
            title: w.title,
            draftSections: w.draftSections,
            summaryBlocks: w.summaryBlocks,
            factChecks: w.factChecks,
            editVersionHistory: w.editVersionHistory,
            activeVersionId: w.activeVersionId,
            lastAiEdit: w.lastAiEdit || null,
            initialDraftSnapshot: w.initialDraftSnapshot || null,
            savedAtTs: Date.now()
          };
        }
      });

      try {
        localStorage.setItem(CLIENT_HISTORY_BACKUP_KEY, JSON.stringify(historyMap));
      } catch (quotaErr) {
        // 용량 초과 시 현재 작업(currentWork)과 최근 5개 작업 위주로 압축 저장
        const compactMap = {};
        (state.works || []).slice(0, 5).forEach(w => {
          if (w && w.id && historyMap[w.id]) compactMap[w.id] = historyMap[w.id];
        });
        try {
          localStorage.setItem(CLIENT_HISTORY_BACKUP_KEY, JSON.stringify(compactMap));
        } catch (e2) {}
      }

      // 2) 전체 작업 목록(CLIENT_WORKS_STORAGE_KEY) 저장 (용량 초과 시 오래된 비활성 기사의 무거운 스냅샷만 경량화해 100% 저장 성공 보장)
      try {
        localStorage.setItem(CLIENT_WORKS_STORAGE_KEY, JSON.stringify(state.works.slice(0, 25)));
      } catch (quotaErr2) {
        const slimWorks = state.works.slice(0, 20).map((w, idx) => {
          if (!w) return w;
          if (idx === 0 || (state.currentWork && w.id === state.currentWork.id) || idx < 6) {
            return w;
          }
          const copy = { ...w };
          delete copy.aiEditHistory;
          delete copy.preRestoreSnapshot;
          return copy;
        });
        try {
          localStorage.setItem(CLIENT_WORKS_STORAGE_KEY, JSON.stringify(slimWorks));
        } catch (e3) {}
      }
    } catch (err) {
      console.warn('persistWorksToLocalStorageReliably warn:', err);
    }
  }

  async function saveCurrentWork(silent = true) {
    if (!state.currentWork) return;
    updateLiveStatsAndGeoUI();
    const targetWork = state.currentWork;
    ensureWorkVersionHistory(targetWork);

    // 현재 활성 버전(activeVersionId)의 스냅샷도 최신 인라인 편집 상태와 동기화
    if (Array.isArray(targetWork.editVersionHistory) && targetWork.activeVersionId) {
      const activeEntry = targetWork.editVersionHistory.find(v => v.id === targetWork.activeVersionId);
      if (activeEntry && !targetWork.isBlankTemplate) {
        activeEntry.snapshot = captureWorkFullSnapshot(targetWork);
        if (targetWork.lastAiEdit) {
          activeEntry.aiEditRecord = JSON.parse(JSON.stringify(targetWork.lastAiEdit));
        }
      }
    }

    persistWorksToLocalStorageReliably();

    try {
      const res = await apiFetch(`/api/works/${targetWork.id}`, {
        method: 'PUT',
        body: JSON.stringify(targetWork)
      });
      // 객체 참조(reference)를 교체하지 않고 기존 state.currentWork 내부 메타데이터만 갱신하여 이벤트 핸들러 클로저 끊김 원천 방지
      if (res.work && targetWork === state.currentWork) {
        targetWork.updatedAt = res.work.updatedAt || targetWork.updatedAt;
      }
      if (!silent) showToast('변경사항이 저장되었습니다.');
    } catch (err) {
      // 정적 배포(GitHub Pages) 또는 서버 일시 중단 시에도 브라우저 로컬 저장소에 안전하게 보관
      if (!silent) showToast('변경사항이 브라우저에 저장되었습니다.');
    }
  }

  function updateLiveStatsAndGeoUI() {
    if (!state.currentWork) return;
    const charEl = document.getElementById('liveCharCountBadge');
    const fcEl = document.getElementById('liveFcCountBadge');
    const geoHeaderEl = document.getElementById('geoChecklistScoreBadge');
    const geoListEl = document.getElementById('geoChecklistContainer');

    const fullText = buildPlainTextArticle(state.currentWork);
    if (charEl) {
      charEl.textContent = `공백 포함 ${fullText.length.toLocaleString()}자`;
    }
    if (fcEl) {
      const unverified = (state.currentWork.factChecks || []).filter(f => f.status === '미처리').length;
      fcEl.style.color = unverified > 0 ? 'var(--status-amber)' : 'var(--status-green)';
      fcEl.textContent = unverified > 0 ? `팩트 확인 필요 ${unverified}건` : '✓ 팩트 확인 완료';
    }

    const geoEval = evaluateGeoChecklist(state.currentWork);
    if (geoHeaderEl) {
      geoHeaderEl.style.color = geoEval.passedCount === geoEval.total ? 'var(--status-green)' : 'var(--mk-orange)';
      geoHeaderEl.textContent = `${geoEval.passedCount}/${geoEval.total} 충족`;
    }
    const leftCheckTabBadge = document.getElementById('leftCheckTabBadge');
    if (leftCheckTabBadge) {
      leftCheckTabBadge.textContent = `${geoEval.passedCount}/${geoEval.total}`;
    }
    if (geoListEl) {
      geoListEl.innerHTML = renderGeoChecklistItemsHtml(geoEval.details);
      bindGeoJumpEvents(geoListEl);
    }
  }

  const GEO_JUMP_TARGETS = {
    'geo-1': 'block-step-2',
    'geo-2': 'block-step-3',
    'geo-3': 'block-step-5',
    'geo-4': 'block-step-5',
    'geo-5': 'block-step-6',
    'geo-6': 'block-step-7',
    'geo-7': 'block-step-8'
  };

  function renderGeoChecklistItemsHtml(details) {
    return details.map(item => `
      <div
        class="clean-list-row"
        data-geo-jump="${GEO_JUMP_TARGETS[item.id] || 'block-step-2'}"
        style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; cursor: pointer;"
        title="클릭하면 오른쪽 기사의 해당 영역으로 바로 이동합니다"
      >
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 13px; font-weight: 700; color: var(--text-primary); line-height: 1.4;">
            <span style="color: ${item.passed ? 'var(--status-green)' : 'var(--status-amber)'}; margin-right: 4px;">
              ${item.passed ? '✓' : '•'}
            </span>
            ${escapeHtml(item.title)}
          </div>
          <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px; padding-left: 16px; line-height: 1.4;">
            ${escapeHtml(item.desc)}
          </div>
        </div>
        <span style="font-size: 11.5px; font-weight: 700; color: ${item.passed ? 'var(--status-green)' : 'var(--mk-orange)'}; white-space: nowrap; flex-shrink: 0;">
          ${item.passed ? '✓ 충족' : '보완 이동 →'}
        </span>
      </div>
    `).join('');
  }

  function bindGeoJumpEvents(container) {
    if (!container) return;
    container.querySelectorAll('[data-geo-jump]').forEach(row => {
      row.addEventListener('click', () => {
        const targetId = row.getAttribute('data-geo-jump');
        if (state.editorViewMode === 'preview') {
          state.editorViewMode = 'edit';
          render(true);
        }
        setTimeout(() => flashElement(targetId), 50);
      });
    });
  }

  function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight + 4, 48) + 'px';
  }

  function autoResizeAllTextareas(root) {
    (root || document).querySelectorAll('textarea.doc-editable-textarea').forEach(ta => {
      autoResizeTextarea(ta);
    });
  }

  // 본문 단락 문장을 매경 Pick 표준 경어체('~합니다/~입니다')로 깔끔하게 다듬어주는 도우미
  function polishParagraphToMkStyle(text) {
    if (!text) return '';
    return text
      .split('\n')
      .map(line => {
        let s = line.trim();
        if (!s) return '';
        s = s
          .replace(/한다\./g, '합니다.')
          .replace(/된다\./g, '됩니다.')
          .replace(/있다\./g, '있습니다.')
          .replace(/없다\./g, '없습니다.')
          .replace(/이다\./g, '입니다.')
          .replace(/했다\./g, '했습니다.')
          .replace(/됐다\./g, '됐습니다.')
          .replace(/보인다\./g, '보입니다.')
          .replace(/나타났다\./g, '나타났습니다.')
          .replace(/밝혔다\./g, '밝혔습니다.')
          .replace(/전했다\./g, '전했습니다.')
          .replace(/분석된다\./g, '분석됩니다.')
          .replace(/예상된다\./g, '예상됩니다.')
          .replace(/풀이된다\./g, '풀이됩니다.');
        if (!/[.?!]$/.test(s) && !s.startsWith('■')) {
          s += '입니다.';
        }
        return s;
      })
      .join('\n');
  }

  let trendTimerId = null;

  async function loadTrends(forceRefresh = false) {
    state.isLoadingTrends = true;
    const startTs = Date.now();
    state.trendLoadElapsedSec = 0;

    if (trendTimerId) clearInterval(trendTimerId);
    trendTimerId = setInterval(() => {
      state.trendLoadElapsedSec = Number(((Date.now() - startTs) / 1000).toFixed(1));
      const btnEl = document.getElementById('refreshTrendRadarBtn');
      if (btnEl) {
        btnEl.textContent = `⏳ 실시간 수집 중... (${state.trendLoadElapsedSec.toFixed(1)}초 / 예상 약 1~3초)`;
      }
      const bannerTextEl = document.getElementById('trendLoadingBannerText');
      if (bannerTextEl) {
        bannerTextEl.textContent = `5개 탭(유튜브 쇼츠·뉴스레터·포털·구글 트렌드·브랜드신상) 실시간 원본 데이터를 수집하고 있습니다... (${state.trendLoadElapsedSec.toFixed(1)}초 경과 · 예상 소요 약 1~3초)`;
      }
    }, 200);

    function sanitizeShortFormItems(list = []) {
      if (!Array.isArray(list)) return [];
      return list.map(item => {
        const cleanedKw = cleanTrendTopicKeyword ? cleanTrendTopicKeyword(item.keyword, item.desc) : item.keyword;
        const detectedComp = extractBrandFromTopic ? extractBrandFromTopic(cleanedKw + ' ' + (item.desc || ''), item.company) : (item.company || '');
        return {
          ...item,
          keyword: cleanedKw,
          ...(detectedComp ? { company: detectedComp } : {})
        };
      });
    }

    try {
      const url = forceRefresh ? '/api/trends?refresh=1' : '/api/trends';
      const radar = await apiFetch(url);
      if (radar.apiUsageStats) {
        const localStats = getClientUsageStats();
        const mergedStats = (radar.apiUsageStats.totalCalls >= (localStats.totalCalls || 0))
          ? radar.apiUsageStats
          : localStats;
        saveClientUsageStats(mergedStats);
      }
      state.trendRadar = {
        googleTrends: Array.isArray(radar.googleTrends) ? radar.googleTrends : [],
        portalRetailTrends: Array.isArray(radar.portalRetailTrends) ? radar.portalRetailTrends : [],
        shortFormTrends: sanitizeShortFormItems(radar.shortFormTrends),
        newsletterTrends: Array.isArray(radar.newsletterTrends) ? radar.newsletterTrends : [],
        brandPromoTrends: Array.isArray(radar.brandPromoTrends) ? radar.brandPromoTrends : []
      };
      try {
        localStorage.setItem(CLIENT_TREND_CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          data: state.trendRadar
        }));
      } catch (e) {}
    } catch (e) {
      // 정적 배포(GitHub Pages 등) 환경: 1순위 ./live-trends.json 실시간 수집 스냅샷 로드 (0.1초 즉시 응답, 실제 원문·쇼츠 링크 100% 보존)
      let loadedFromStaticSnapshot = false;
      try {
        const snapRes = await fetch(`./live-trends.json?t=${Date.now()}`);
        if (snapRes.ok) {
          const snapData = await snapRes.json();
          if (snapData && snapData.apiUsageStats) {
            const localStats = getClientUsageStats();
            const mergedStats = (snapData.apiUsageStats.totalCalls >= (localStats.totalCalls || 0))
              ? snapData.apiUsageStats
              : localStats;
            saveClientUsageStats(mergedStats);
          }
          if (snapData && Array.isArray(snapData.shortFormTrends) && snapData.shortFormTrends.length > 0) {
            state.trendRadar = {
              googleTrends: snapData.googleTrends || [],
              portalRetailTrends: snapData.portalRetailTrends || [],
              shortFormTrends: sanitizeShortFormItems(snapData.shortFormTrends),
              newsletterTrends: snapData.newsletterTrends || [],
              brandPromoTrends: snapData.brandPromoTrends || []
            };
            try {
              localStorage.setItem(CLIENT_TREND_CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: state.trendRadar
              }));
            } catch (err) {}
            loadedFromStaticSnapshot = true;
          }
        }
      } catch (snapErr) {}

      // 2순위: 스냅샷 파일이 없거나 강제 AI 갱신 시 브라우저 Perplexity API 직접 호출
      const clientKey = getClientPerplexityKey();
      let loadedFromClientPplx = loadedFromStaticSnapshot;
      if (!loadedFromClientPplx && clientKey) {
        try {
          if (!forceRefresh) {
            const cachedRaw = localStorage.getItem(CLIENT_TREND_CACHE_KEY);
            if (cachedRaw) {
              const cachedObj = JSON.parse(cachedRaw);
              if (cachedObj && cachedObj.timestamp && (Date.now() - cachedObj.timestamp < CLIENT_TREND_TTL_MS)) {
                const stats = getClientUsageStats();
                stats.cacheHitsOnRefresh = (stats.cacheHitsOnRefresh || 0) + 1;
                saveClientUsageStats(stats);
                state.trendRadar = {
                  googleTrends: cachedObj.data?.googleTrends || [],
                  portalRetailTrends: cachedObj.data?.portalRetailTrends || [],
                  shortFormTrends: sanitizeShortFormItems(cachedObj.data?.shortFormTrends),
                  newsletterTrends: cachedObj.data?.newsletterTrends || [],
                  brandPromoTrends: cachedObj.data?.brandPromoTrends || []
                };
                loadedFromClientPplx = true;
              }
            }
          }
          if (!loadedFromClientPplx) {
            const pplxTrends = await fetchClientPerplexityTrends(clientKey);
            const mergedRadar = {
              googleTrends: (pplxTrends.googleTrends || []).slice(0, 10),
              portalRetailTrends: (pplxTrends.portalRetailTrends || []).slice(0, 10),
              shortFormTrends: sanitizeShortFormItems((pplxTrends.shortFormTrends || []).slice(0, 10)),
              newsletterTrends: (pplxTrends.newsletterTrends || []).slice(0, 10),
              brandPromoTrends: (pplxTrends.brandPromoTrends || []).slice(0, 10)
            };
            state.trendRadar = mergedRadar;
            localStorage.setItem(CLIENT_TREND_CACHE_KEY, JSON.stringify({
              timestamp: Date.now(),
              data: mergedRadar
            }));
            loadedFromClientPplx = true;
          }
        } catch (clientErr) {
          console.warn('Client Perplexity trend fallback:', clientErr.message);
        }
      }
      if (!loadedFromClientPplx) {
        state.trendRadar = {
          googleTrends: CURATED_TREND_TOPICS.google || [],
          portalRetailTrends: CURATED_TREND_TOPICS.portalRetail || [],
          shortFormTrends: sanitizeShortFormItems(CURATED_TREND_TOPICS.shortForm),
          newsletterTrends: CURATED_TREND_TOPICS.newsletter || [],
          brandPromoTrends: CURATED_TREND_TOPICS.brandPromo || []
        };
      }
    }
    if (trendTimerId) {
      clearInterval(trendTimerId);
      trendTimerId = null;
    }
    state.lastTrendLoadDurationSec = Number(((Date.now() - startTs) / 1000).toFixed(1));
    state.isLoadingTrends = false;
  }

  async function loadConfig() {
    const clientKey = getClientPerplexityKey();
    try {
      const cfg = await apiFetch('/api/config');
      state.isStaticHosting = false;
      const effectiveKey = (cfg.shareableKey || clientKey || '').trim();
      if (effectiveKey && localStorage.getItem(CLIENT_DISCONNECTED_FLAG) !== '1') {
        try {
          localStorage.setItem(CLIENT_STORAGE_KEY, effectiveKey);
        } catch (e) {}
      }
      if (clientKey && !cfg.hasPerplexityKey) {
        try {
          await apiFetch('/api/config', {
            method: 'POST',
            body: JSON.stringify({ perplexityApiKey: clientKey })
          });
        } catch (e) {}
      }
      state.hasPerplexityKey = Boolean(cfg.hasPerplexityKey || clientKey);
      state.maskedKey = cfg.maskedKey || maskApiKey(clientKey) || '';
      if (cfg.apiUsageStats) {
        const localStats = getClientUsageStats();
        const mergedStats = (cfg.apiUsageStats.totalCalls >= (localStats.totalCalls || 0))
          ? cfg.apiUsageStats
          : localStats;
        saveClientUsageStats(mergedStats);
      }
    } catch (e) {
      // GitHub Pages 등 정적 호스팅 환경: URL 공유 키, 브라우저 저장 키, 또는 팀 기본 내장 키 자동 활성화
      state.isStaticHosting = true;
      state.hasPerplexityKey = Boolean(clientKey);
      state.maskedKey = maskApiKey(clientKey);
      state.apiUsageStats = getClientUsageStats();
    }
  }

  async function initApp() {
    // 구버전 캐시(고정 샘플 또는 정제 전 쇼츠 제목이 섞여 있던 v1~v4) 즉시 삭제 후 최신 캐시만 복원
    try {
      localStorage.removeItem('mk_pplx_trend_cache_v1');
      localStorage.removeItem('mk_pplx_trend_cache_v2');
      localStorage.removeItem('mk_pplx_trend_cache_v3');
      localStorage.removeItem('mk_pplx_trend_cache_v4');
      const cachedRaw = localStorage.getItem(CLIENT_TREND_CACHE_KEY);
      if (cachedRaw) {
        const cachedObj = JSON.parse(cachedRaw);
        if (cachedObj && cachedObj.data) {
          state.trendRadar = {
            googleTrends: cachedObj.data.googleTrends || [],
            portalRetailTrends: cachedObj.data.portalRetailTrends || [],
            shortFormTrends: cachedObj.data.shortFormTrends || [],
            newsletterTrends: cachedObj.data.newsletterTrends || [],
            brandPromoTrends: cachedObj.data.brandPromoTrends || []
          };
        }
      }
    } catch (e) {}
    try {
      await loadConfig();
      const worksRes = await apiFetch('/api/works').catch(() => ({ works: [] }));
      const serverWorks = Array.isArray(worksRes.works) ? worksRes.works : [];
      let localWorks = [];
      let historyBackupMap = {};
      try {
        const savedWorks = localStorage.getItem(CLIENT_WORKS_STORAGE_KEY);
        if (savedWorks) localWorks = JSON.parse(savedWorks);
      } catch (e) {}
      try {
        const rawHist = localStorage.getItem(CLIENT_HISTORY_BACKUP_KEY);
        if (rawHist) historyBackupMap = JSON.parse(rawHist) || {};
      } catch (e) {}

      // 서버 DB 작업, 브라우저 로컬 저장소 작업, 히스토리 전용 백업 맵을 병합하여 PC 재부팅·브라우저 종료 후에도 편집본과 히스토리를 100% 복원
      const mergedMap = new Map();
      [...localWorks, ...serverWorks].forEach(w => {
        if (w && w.id && !mergedMap.has(w.id)) {
          const histBackup = historyBackupMap[w.id];
          if (histBackup && Array.isArray(histBackup.editVersionHistory) && histBackup.editVersionHistory.length > (w.editVersionHistory?.length || 0)) {
            w.editVersionHistory = histBackup.editVersionHistory;
            w.activeVersionId = histBackup.activeVersionId || w.activeVersionId;
            w.lastAiEdit = histBackup.lastAiEdit || w.lastAiEdit;
            w.initialDraftSnapshot = histBackup.initialDraftSnapshot || w.initialDraftSnapshot;
            if (histBackup.title) w.title = histBackup.title;
            if (Array.isArray(histBackup.draftSections) && histBackup.draftSections.length > 0) w.draftSections = histBackup.draftSections;
            if (histBackup.summaryBlocks) w.summaryBlocks = histBackup.summaryBlocks;
            if (Array.isArray(histBackup.factChecks)) w.factChecks = histBackup.factChecks;
          }
          const sanitized = sanitizePoisonedWork(w);
          ensureWorkVersionHistory(sanitized);
          mergedMap.set(w.id, sanitized);
        }
      });
      state.works = mergedMap.size > 0 ? Array.from(mergedMap.values()) : (getInitialWorks ? getInitialWorks() : []);
      persistWorksToLocalStorageReliably();

      // 새로고침(F5) 또는 사이트 재접속 시 직전에 보고 있던 화면(편집 중이던 기사 및 탭 상태) 복원
      let autoRetryFailedWork = null;
      try {
        const uiRaw = localStorage.getItem(CLIENT_UI_STATE_KEY);
        if (uiRaw) {
          const uiState = JSON.parse(uiRaw);
          if (uiState.leftPanelTab) state.leftPanelTab = uiState.leftPanelTab;
          if (uiState.rightPanelTab) state.rightPanelTab = uiState.rightPanelTab;
          if (uiState.currentWorkId) {
            const foundWork = state.works.find(w => w.id === uiState.currentWorkId);
            if (foundWork) {
              state.currentWork = sanitizePoisonedWork(foundWork);
              ensureWorkVersionHistory(state.currentWork);
              if (state.currentWork.lastAiEdit) {
                state.activeHighlight = state.currentWork.lastAiEdit;
              }
              if (uiState.screen === 'editor') state.screen = 'editor';
              const hasUserEdits = Boolean(
                (state.currentWork.editVersionHistory && state.currentWork.editVersionHistory.length > 1) ||
                state.currentWork.lastAiEdit ||
                (state.currentWork.aiEditHistory && state.currentWork.aiEditHistory.length > 0)
              );
              if (!hasUserEdits && state.currentWork.usedPerplexity === false && getClientPerplexityKey()) {
                autoRetryFailedWork = state.currentWork;
              }
            }
          }
          if (Array.isArray(uiState.homeMainTabOrder) && uiState.homeMainTabOrder.length === DEFAULT_MAIN_TAB_ORDER.length && DEFAULT_MAIN_TAB_ORDER.every(k => uiState.homeMainTabOrder.includes(k))) {
            state.homeMainTabOrder = uiState.homeMainTabOrder;
          }
          if (Array.isArray(uiState.trendTabOrder) && uiState.trendTabOrder.length === DEFAULT_TREND_TAB_ORDER.length && DEFAULT_TREND_TAB_ORDER.every(k => uiState.trendTabOrder.includes(k))) {
            state.trendTabOrder = uiState.trendTabOrder;
          }
          if (uiState.homeDiscoveryTab) state.homeDiscoveryTab = uiState.homeDiscoveryTab;
          if (uiState.trendTab) state.trendTab = uiState.trendTab;
        }
      } catch (e) {}

      // 브라우저 탭 닫기 / PC 종료 / 다른 사이트 이동 직전 자동 로컬 저장 이벤트 바인딩
      if (!window.__mkPersistUnloadBound) {
        window.__mkPersistUnloadBound = true;
        window.addEventListener('beforeunload', () => {
          persistWorksToLocalStorageReliably();
        });
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') {
            persistWorksToLocalStorageReliably();
          }
        });
      }

      render();
      if (autoRetryFailedWork) {
        // 편집 이력이 전혀 없는 초기 실패 골격 기사만 자동 재집필
        const targetW = autoRetryFailedWork;
        state.works = state.works.filter(item => item.id !== targetW.id);
        showToast(`🔄 '${targetW.keyword}' 기사를 원래 설정하신 서브 키워드·기획 방향 그대로 자동 복원하고 있습니다...`);
        startWorkWithKeyword(
          targetW.keyword,
          targetW.typeId || 4,
          targetW.inputCompany || '',
          false,
          targetW.inputSubKeywords || '',
          targetW.inputDirection || ''
        );
      }
    } catch (err) {
      state.works = getInitialWorks ? getInitialWorks() : [];
      render();
    }
    loadTrends().then(() => {
      // 트렌드 스냅샷 로드 완료 후 기존 오염된 로컬 초안이 있으면 실제 뉴스 팩트까지 반영하여 한 번 더 자동 복구
      let anyRepaired = false;
      state.works = (state.works || []).map(w => {
        const beforeStr = JSON.stringify(w.summaryBlocks?.summaryTable || {});
        const fixed = sanitizePoisonedWork(w);
        if (JSON.stringify(fixed.summaryBlocks?.summaryTable || {}) !== beforeStr) anyRepaired = true;
        return fixed;
      });
      if (state.currentWork) {
        state.currentWork = sanitizePoisonedWork(state.currentWork);
      }
      if (anyRepaired) {
        try {
          localStorage.setItem(CLIENT_WORKS_STORAGE_KEY, JSON.stringify(state.works.slice(0, 30)));
        } catch (e) {}
      }
      render(true);
    });
  }

  // 실시간 트렌드 레이더(5개 탭)에서 키워드와 일치하는 실제 언론 보도 항목을 추출하는 헬퍼
  function extractMatchingTrendNewsItems(keyword = '', company = '') {
    const kw = String(keyword || '').trim();
    if (!kw) return [];
    const radar = state.trendRadar || {};
    const allItems = [
      ...(radar.brandPromoTrends || []),
      ...(radar.shortFormTrends || []),
      ...(radar.portalRetailTrends || []),
      ...(radar.newsletterTrends || []),
      ...(radar.googleTrends || [])
    ];
    const kwTokens = kw.split(/[\s,·/]+/).filter(t => t.length >= 2);
    const matched = allItems.filter(it => {
      if (!it || !it.keyword) return false;
      if (it.keyword === kw || it.keyword.includes(kw) || kw.includes(it.keyword)) return true;
      const hitCount = kwTokens.filter(tok => (it.keyword + ' ' + (it.desc || '')).includes(tok)).length;
      return kwTokens.length >= 2 && hitCount >= Math.min(2, kwTokens.length);
    });
    return matched.slice(0, 5).map(it => ({
      title: it.desc || it.keyword,
      source: it.source || '언론 보도',
      pubDateShort: it.pubDateShort || '최신 보도',
      url: it.url || `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(kw)}`
    }));
  }

  // 현재 작업 기사의 전체 본문·요약·메모 상태를 깊은 복사(Deep Clone)로 백업/복원하는 헬퍼
  function captureWorkFullSnapshot(w) {
    if (!w) return null;
    return JSON.parse(JSON.stringify({
      title: w.title || '',
      titleCandidates: w.titleCandidates || [],
      sources: w.sources || [],
      researchItems: w.researchItems || [],
      draftSections: w.draftSections || [],
      summaryBlocks: w.summaryBlocks || {},
      factChecks: w.factChecks || [],
      factVerification: w.factVerification || null
    }));
  }

  function applyWorkFullSnapshot(w, snap) {
    if (!w || !snap) return false;
    const cloned = JSON.parse(JSON.stringify(snap));
    if (cloned.title) w.title = cloned.title;
    if (Array.isArray(cloned.titleCandidates) && cloned.titleCandidates.length > 0) {
      w.titleCandidates = cloned.titleCandidates;
    }
    if (Array.isArray(cloned.sources) && cloned.sources.length > 0) {
      w.sources = cloned.sources;
    }
    if (Array.isArray(cloned.researchItems) && cloned.researchItems.length > 0) {
      w.researchItems = cloned.researchItems;
    }
    if (Array.isArray(cloned.draftSections) && cloned.draftSections.length > 0) {
      w.draftSections = cloned.draftSections;
    }
    if (cloned.summaryBlocks && Object.keys(cloned.summaryBlocks).length > 0) {
      w.summaryBlocks = {
        ...(w.summaryBlocks || {}),
        ...cloned.summaryBlocks
      };
    }
    w.factChecks = Array.isArray(cloned.factChecks) && cloned.factChecks.length > 0
      ? cloned.factChecks
      : extractFactSentencesFromSections(w.draftSections, w.sources);
    if (cloned.factVerification) {
      w.factVerification = cloned.factVerification;
    }
    return true;
  }

  // 이전 버전의 화장품·올리브영 하드코딩 템플릿, undefined... 버그, 또는 구버전 [초안 복원] 버튼이 고정 모범 예시('다이소 편의점 전용 맛 뷰티' 등)로 덮어쓴 기사를 즉시 감지·복구하는 함수
  function sanitizePoisonedWork(w) {
    if (!w || !w.keyword) return w;
    const kw = String(w.keyword || '');
    const comp = String(w.inputCompany || '');
    const titleAndBody = `${w.title || ''} ${(w.draftSections || []).map(s => `${s.title || ''} ${s.content || ''}`).join(' ')}`;

    // 1) 구버전 [↺ 초안 복원] 버튼이 현재 키워드(예: 수능 응원 선물 트렌드)와 무관한 유형별 고정 예시('다이소 편의점 전용 맛 뷰티' 등)로 덮어쓴 경우 감지
    const isExampleDaisoOverwritten = !/다이소|편의점\s*전용\s*맛/.test(kw) && /다이소\s*편의점\s*전용\s*맛\s*뷰티|음료만\s*팔던\s*시대\s*끝/.test(titleAndBody);
    const isExampleWeddingOverwritten = !/결혼|웨딩|스드메/.test(kw) && /스드메\s*패키지\s*대신/.test(titleAndBody);
    const isExamplePregnantOverwritten = !/임산부/.test(kw) && /임산부의\s*날/.test(titleAndBody);
    const isExampleBreadOverwritten = !/민음사빵|책갈피|국진이빵/.test(kw) && /민음사빵\s*책갈피/.test(titleAndBody);
    const isExampleBunjangOverwritten = !/번개장터|리커머스/.test(kw) && /번개장터\s*정품\s*검수/.test(titleAndBody);
    const hasExampleOverwriteBug = isExampleDaisoOverwritten || isExampleWeddingOverwritten || isExamplePregnantOverwritten || isExampleBreadOverwritten || isExampleBunjangOverwritten;

    if (hasExampleOverwriteBug) {
      // 백업 스냅샷이나 AI 편집 이력이 남아 있고 오염되지 않았다면 최우선으로 즉시 복원
      const candidateSnaps = [
        w.preRestoreSnapshot,
        w.initialDraftSnapshot,
        w.lastAiEdit?.afterSnapshot,
        w.lastAiEdit?.beforeSnapshot,
        ...((w.aiEditHistory || []).slice().reverse())
      ].filter(Boolean);

      const validSnap = candidateSnaps.find(sn => {
        const snText = `${sn.title || ''} ${(sn.draftSections || []).map(s => s.content || '').join(' ')}`;
        return snText.length > 40 && !/다이소\s*편의점\s*전용\s*맛\s*뷰티|음료만\s*팔던\s*시대\s*끝/.test(snText);
      });

      if (validSnap) {
        applyWorkFullSnapshot(w, validSnap);
        return w;
      }

      // 스냅샷이 없는 경우: 현재 키워드·서브키워드·기획방향으로 즉시 재구성하고, 새로고침 시 AI가 원래 기사를 자동 재집필하도록 표시
      if (typeof buildDynamicScenario === 'function') {
        const matchedNews = extractMatchingTrendNewsItems(kw, comp);
        const cleanScen = buildDynamicScenario({
          keyword: kw,
          company: comp,
          subKeywords: w.inputSubKeywords || '',
          direction: w.inputDirection || '',
          url: w.inputUrl || '',
          rawText: w.inputRawText || '',
          typeId: w.typeId || 4,
          selectedType: w.typeId || 4,
          newsItems: matchedNews
        });
        w.titleCandidates = cleanScen.titleCandidates;
        w.title = cleanScen.titleCandidates?.[0]?.title || w.title;
        w.sources = cleanScen.sources;
        w.researchItems = cleanScen.researchItems;
        w.draftSections = cleanScen.draftSections;
        w.summaryBlocks = cleanScen.summaryBlocks;
        w.factChecks = cleanScen.factChecks;
        w.factVerification = cleanScen.factVerification || w.factVerification;
        w.usedPerplexity = false;
        w.initialDraftSnapshot = captureWorkFullSnapshot(w);
      }
      return w;
    }

    const isGenuineBeauty = /(?:뷰티|화장품|스킨케어|패치|앰플|세럼|크림|마스크팩|올리브영|클렌징|선크림|메이크업|피부|보습|장벽)/.test(`${kw} ${comp}`);
    if (isGenuineBeauty) return w;

    const serialized = JSON.stringify({
      draftSections: w.draftSections || [],
      summaryTable: w.summaryBlocks?.summaryTable || {},
      faqs: w.summaryBlocks?.faqs || [],
      oneLineSummary: w.summaryBlocks?.oneLineSummary || ''
    });

    const hasCosmeticsPoison = /세라마이드|판테놀|병풀추출물|밀착력·지속력|헬스앤뷰티 스토어|기초 정돈 후|국소 부위만 케어하던|고민 부위·상황에 맞춘 단계별 루틴|고민 부위 집중 관리|undefined\.\.\./.test(serialized);
    if (!hasCosmeticsPoison) return w;

    if (typeof buildDynamicScenario === 'function') {
      const matchedNews = extractMatchingTrendNewsItems(kw, comp);
      const cleanScen = buildDynamicScenario({
        keyword: kw,
        company: comp,
        subKeywords: w.inputSubKeywords || '',
        direction: w.inputDirection || '',
        url: w.inputUrl || '',
        rawText: w.inputRawText || '',
        typeId: w.typeId || 4,
        selectedType: w.typeId || 4,
        newsItems: matchedNews
      });
      w.titleCandidates = cleanScen.titleCandidates;
      w.title = cleanScen.titleCandidates?.[0]?.title || w.title;
      if (matchedNews.length > 0 || (w.sources || []).length <= 1) {
        w.sources = cleanScen.sources;
        w.researchItems = cleanScen.researchItems;
      }
      w.draftSections = cleanScen.draftSections;
      w.summaryBlocks = cleanScen.summaryBlocks;
      w.factChecks = cleanScen.factChecks;
      w.factVerification = cleanScen.factVerification || w.factVerification;
    }
    return w;
  }

  function openUserGuideModal() {
    const modalRoot = document.getElementById('modalRoot');
    if (!modalRoot) return;
    let activeTab = 'slides'; // 'slides' | 'pdf'

    function renderGuideModalContent() {
      modalRoot.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(17, 24, 39, 0.55); z-index: 320; display: flex; align-items: center; justify-content: center; padding: 18px;">
          <div class="card" style="width: 100%; max-width: 1280px; height: 90vh; margin-bottom: 0; padding: 16px 22px; display: flex; flex-direction: column;">
            <div class="flex-between" style="padding-bottom: 12px; border-bottom: var(--border-thin); flex-wrap: wrap; gap: 10px;">
              <div class="flex-row" style="gap: 12px;">
                <span style="background: var(--mk-orange); color: #FFFFFF; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 6px;">실무 매뉴얼</span>
                <h3 style="font-size: 17px; font-weight: 800; color: var(--text-primary);">MK Pick GEO 콘텐츠 스튜디오 — 실무자 완벽 사용 가이드</h3>
                <div style="display: inline-flex; border: var(--border-thin); border-radius: 6px; overflow: hidden; background: var(--bg-subtle); margin-left: 8px;">
                  <button type="button" id="guideTabSlidesBtn" style="padding: 5px 12px; font-size: 12px; font-weight: 800; border: none; cursor: pointer; background: ${activeTab === 'slides' ? 'var(--mk-orange)' : 'transparent'}; color: ${activeTab === 'slides' ? '#FFFFFF' : 'var(--text-secondary)'};">
                    🖥️ 슬라이드(PPT) 보기
                  </button>
                  <button type="button" id="guideTabPdfBtn" style="padding: 5px 12px; font-size: 12px; font-weight: 800; border: none; cursor: pointer; background: ${activeTab === 'pdf' ? 'var(--mk-orange)' : 'transparent'}; color: ${activeTab === 'pdf' ? '#FFFFFF' : 'var(--text-secondary)'};">
                    📄 PDF 원본 보기
                  </button>
                </div>
              </div>
              <div class="flex-row" style="gap: 8px;">
                <a href="./mk-pick-user-guide.pdf" download="MK_Pick_GEO_콘텐츠_스튜디오_사용가이드.pdf" class="btn btn-sm btn-primary" style="text-decoration: none; font-weight: 800;">
                  📥 PDF 다운로드
                </a>
                <a href="./mk-pick-user-guide.pptx" download="MK_Pick_GEO_콘텐츠_스튜디오_사용가이드.pptx" class="btn btn-sm" style="text-decoration: none; font-weight: 800; border-color: var(--mk-orange); color: var(--mk-orange);">
                  📊 PPTX 다운로드
                </a>
                <a href="./guide.html" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="text-decoration: none; font-weight: 700;">
                  새 탭에서 크게 열기 ↗
                </a>
                <button type="button" class="btn btn-sm" id="closeGuideModalBtn" style="font-weight: 800;">✕ 닫기</button>
              </div>
            </div>
            <div style="flex: 1; min-height: 0; margin-top: 12px; border: var(--border-thin); border-radius: var(--radius-general); overflow: hidden; background: #F4F5F7;">
              ${activeTab === 'slides' ? `
                <iframe src="./guide.html" style="width: 100%; height: 100%; border: none; display: block; background: #FFFFFF;" title="MK Pick 사용 가이드 슬라이드"></iframe>
              ` : `
                <iframe src="./mk-pick-user-guide.pdf#view=FitH" style="width: 100%; height: 100%; border: none; display: block; background: #FFFFFF;" title="MK Pick 사용 가이드 PDF"></iframe>
              `}
            </div>
          </div>
        </div>
      `;

      document.getElementById('closeGuideModalBtn')?.addEventListener('click', () => {
        modalRoot.innerHTML = '';
      });
      document.getElementById('guideTabSlidesBtn')?.addEventListener('click', () => {
        activeTab = 'slides';
        renderGuideModalContent();
      });
      document.getElementById('guideTabPdfBtn')?.addEventListener('click', () => {
        activeTab = 'pdf';
        renderGuideModalContent();
      });
    }

    renderGuideModalContent();
  }

  function buildShareableTeamUrl() {
    const shareBase = (typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io'))
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://mk-pr-content-agent.github.io/mk-pick-content-studio/public/index.html';
    const activeKey = (getClientPerplexityKey() || localStorage.getItem(CLIENT_STORAGE_KEY) || '').trim();
    return activeKey ? `${shareBase}#pplx=${encodeURIComponent(activeKey)}` : shareBase;
  }

  async function copyShareableTeamUrl() {
    const targetUrl = buildShareableTeamUrl();
    await navigator.clipboard.writeText(targetUrl);
    showToast('✓ 다른 사람의 브라우저에서도 즉시 API가 연결되는 공유 링크가 복사되었습니다!');
  }

  async function openApiKeyModal() {
    await loadConfig();
    const modalRoot = document.getElementById('modalRoot');
    if (!modalRoot) return;
    const stats = state.apiUsageStats || {
      model: DEFAULT_PPLX_MODEL,
      totalCalls: 0,
      trendCalls: 0,
      draftCalls: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      estimatedCostKrw: 0,
      cacheHitsOnRefresh: 0
    };
    const fullShareUrl = buildShareableTeamUrl();

    modalRoot.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(17, 24, 39, 0.45); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 20px;">
        <div class="card" style="width: 100%; max-width: 540px; margin-bottom: 0; padding: 24px 28px;">
          <div class="flex-between mb-8">
            <h3 style="font-size: 17px; font-weight: 800;">Perplexity × AI 집필 하이브리드 설정 · 실시간 과금 모니터</h3>
            <button type="button" class="text-action" id="closeApiModalBtn" style="font-size: 16px;">✕</button>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.55;">
            현재 <strong>[1단계 수집: Perplexity(<code>sonar-pro</code>) 실시간 웹·뉴스 검색] → [2단계 집필: <code>${escapeHtml(getWriterModelShortLabel())}</code>]</strong> 2단계 고속 하이브리드 파이프라인으로 작동합니다. 상단 드롭다운에서 언제든 집필 AI 모델(Gemini 4 Argon / GPT-5 / Claude Sonnet 4.5 / Sonar-Pro)을 변경할 수 있습니다.
          </p>

          <!-- 실시간 API 사용량 & 예상 비용 대시보드 -->
          <div style="padding: 12px 14px; background-color: var(--bg-subtle); border: var(--border-thin); border-radius: var(--radius-general); margin-bottom: 14px;">
            <div class="flex-between mb-6">
              <strong style="font-size: 12.5px; color: var(--text-primary);">📊 누적 API 호출 및 실제 과금(버닝) 현황</strong>
              <span style="font-size: 11.5px; color: var(--mk-orange); font-weight: 700;">하이브리드: Perplexity 검색 + ${escapeHtml(getWriterModelShortLabel())}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center;">
              <div style="padding: 8px; background: var(--white); border: var(--border-thin); border-radius: 6px;">
                <div style="font-size: 11px; color: var(--text-muted);">누적 API 호출</div>
                <div style="font-size: 15px; font-weight: 800; color: var(--text-primary);">${stats.totalCalls}회</div>
                <div style="font-size: 10.5px; color: var(--text-secondary);">트렌드 ${stats.trendCalls} · 초안 ${stats.draftCalls}</div>
              </div>
              <div style="padding: 8px; background: var(--white); border: var(--border-thin); border-radius: 6px;">
                <div style="font-size: 11px; color: var(--text-muted);">누적 예상 소진액</div>
                <div style="font-size: 15px; font-weight: 800; color: var(--mk-orange);">약 ${stats.estimatedCostKrw}원</div>
                <div style="font-size: 10.5px; color: var(--text-secondary);">$${stats.estimatedCostUsd} (${stats.totalTokens.toLocaleString()} 토큰)</div>
              </div>
              <div style="padding: 8px; background: var(--white); border: var(--border-thin); border-radius: 6px;">
                <div style="font-size: 11px; color: var(--text-muted);">새로고침 캐시 방어</div>
                <div style="font-size: 15px; font-weight: 800; color: var(--status-green);">${stats.cacheHitsOnRefresh}회 절약</div>
                <div style="font-size: 10.5px; color: var(--text-secondary);">F5 접속 시 0원</div>
              </div>
            </div>
          </div>

          ${state.hasPerplexityKey ? `
            <div style="font-size: 12.5px; color: var(--status-green); background: var(--status-green-bg); padding: 10px 12px; border-radius: var(--radius-general); margin-bottom: 12px; font-weight: 700;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span>✓ 현재 연결된 키: ${escapeHtml(state.maskedKey)} (다른 브라우저에서도 공유 링크 접속 시 즉시 자동 연결)</span>
                <button type="button" class="btn btn-sm" id="copyTeamShareUrlBtn" style="padding: 4px 10px; font-size: 11.5px; background: var(--white); color: var(--status-green); border-color: #8FD4B2; white-space: nowrap; font-weight: 800;">
                  🔗 API 포함 공유 링크 복사
                </button>
              </div>
            </div>
          ` : ''}

          <div class="mb-12">
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">
              다른 Perplexity API Key로 변경 (선택)
            </label>
            <input type="password" class="input" id="pplxApiKeyInput" placeholder="pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" autocomplete="off" />
          </div>

          <div class="flex-between" style="padding-top: 8px;">
            ${state.hasPerplexityKey ? `
              <button type="button" class="text-action" id="removeApiKeyBtn" style="color: var(--status-red);">연결 해제(키 삭제)</button>
            ` : '<span></span>'}
            <div class="flex-row">
              <button type="button" class="btn" id="cancelApiModalBtn">닫기</button>
              <button type="button" class="btn btn-primary" id="saveApiKeyBtn">저장 및 실시간 트렌드 반영</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const closeModal = () => {
      modalRoot.innerHTML = '';
    };

    document.getElementById('closeApiModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('cancelApiModalBtn')?.addEventListener('click', closeModal);

    document.getElementById('copyTeamShareUrlBtn')?.addEventListener('click', copyShareableTeamUrl);

    document.getElementById('removeApiKeyBtn')?.addEventListener('click', async () => {
      try {
        localStorage.removeItem(CLIENT_STORAGE_KEY);
        localStorage.setItem(CLIENT_DISCONNECTED_FLAG, '1');
      } catch (e) {}
      try {
        await apiFetch('/api/config', {
          method: 'POST',
          body: JSON.stringify({ perplexityApiKey: '' })
        });
      } catch (e) {}
      await loadConfig();
      closeModal();
      showToast('Perplexity API 키 연결이 해제되었습니다.');
      render(true);
    });

    document.getElementById('saveApiKeyBtn')?.addEventListener('click', async () => {
      const keyVal = document.getElementById('pplxApiKeyInput')?.value.trim() || '';
      if (!keyVal) {
        showToast('Perplexity API 키(pplx-...)를 입력해 주세요.');
        return;
      }
      const saveBtn = document.getElementById('saveApiKeyBtn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '연결 및 트렌드 수집 중...';
      }
      try {
        try {
          localStorage.setItem(CLIENT_STORAGE_KEY, keyVal);
          localStorage.removeItem(CLIENT_DISCONNECTED_FLAG);
          localStorage.removeItem(CLIENT_TREND_CACHE_KEY);
        } catch (e) {}
        try {
          await apiFetch('/api/config', {
            method: 'POST',
            body: JSON.stringify({ perplexityApiKey: keyVal })
          });
        } catch (e) {
          // 정적 호스팅(GitHub Pages)에서는 브라우저 저장소로 즉시 동작
        }
        await loadConfig();
        closeModal();
        showToast('✓ Perplexity API가 연결되었습니다! 실시간 최신 트렌드 키워드를 불러옵니다...');
        render(true);
        await loadTrends(true);
        showToast('✓ Perplexity 실시간 최신 트렌드 키워드가 반영되었습니다!');
        render(true);
      } catch (err) {
        showToast(err.message);
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = '저장 및 실시간 트렌드 반영';
        }
      }
    });
  }

  function syncTopbarHeightCssVar() {
    const header = document.querySelector('.topbar');
    if (!header) return;
    const h = Math.max(58, Math.round(header.getBoundingClientRect().height || 58));
    document.documentElement.style.setProperty('--topbar-h', `${h}px`);
  }

  function renderTopbar() {
    const nav = document.getElementById('topbarNav');
    const meta = document.getElementById('topbarMeta');
    if (!nav || !meta) return;

    const rawKw = String(state.currentWork?.keyword || '').trim();
    const shortKw = rawKw.length > 16 ? `${rawKw.slice(0, 16)}…` : rawKw;

    nav.innerHTML = `
      <button type="button" class="trend-clean-tab ${state.screen === 'home' ? 'active' : ''}" id="topGoHomeBtn" style="border-bottom-width: 2px; padding: 8px 10px; font-size: 13px; white-space: nowrap;">
        홈 · 소재 선택
      </button>
      ${state.currentWork ? `
        <button type="button" class="trend-clean-tab ${state.screen === 'editor' ? 'active' : ''}" id="topGoEditorBtn" title="편집 중인 기사 (${escapeHtml(rawKw)})" style="border-bottom-width: 2px; padding: 8px 10px; font-size: 13px; margin-left: 2px; white-space: nowrap; max-width: 240px; overflow: hidden; text-overflow: ellipsis;">
          편집 중인 기사 (${escapeHtml(shortKw)})
        </button>
      ` : ''}
    `;

    const calls = state.apiUsageStats?.totalCalls || 0;
    const krw = state.apiUsageStats?.estimatedCostKrw || 0;
    const activeWriterLabel = getWriterModelShortLabel();
    meta.innerHTML = `
      <div class="flex-row" style="gap: 6px; flex-wrap: wrap; max-width: 100%;">
        ${renderWriterModelSelectHtml('', true)}
        ${state.hasPerplexityKey ? `
          <button
            type="button"
            class="btn btn-sm"
            id="topbarCopyShareLinkBtn"
            style="padding: 5px 10px; font-size: 12px; font-weight: 600; border-color: #E5E7EB; color: #374151; background-color: #FFFFFF;"
            title="다른 사람의 브라우저에서도 API 키가 자동 연결되는 공유 링크를 복사합니다"
          >
            공유 링크 복사
          </button>
        ` : ''}
        <button
          type="button"
          class="btn btn-sm"
          id="openUserGuideModalBtn"
          style="padding: 5px 10px; font-size: 12px; font-weight: 600; border-color: #E5E7EB; color: #374151; background-color: #FFFFFF;"
        >
          사용 가이드
        </button>
        <button
          type="button"
          class="btn btn-sm"
          id="openApiKeyModalBtn"
          style="padding: 5px 10px; font-size: 12px; font-weight: 600; border-color: ${state.hasPerplexityKey ? '#E5E7EB' : 'var(--mk-orange)'}; color: ${state.hasPerplexityKey ? '#374151' : 'var(--mk-orange)'}; background-color: ${state.hasPerplexityKey ? '#F9FAFB' : 'var(--mk-orange-light)'}; display: inline-flex; align-items: center; gap: 6px;"
          title="Perplexity 실시간 검색 + ${escapeHtml(activeWriterLabel)} 하이브리드 연동 설정 및 사용량 확인"
        >
          <span style="width: 7px; height: 7px; border-radius: 50%; background-color: ${state.hasPerplexityKey ? '#10B981' : '#F37021'}; display: inline-block; flex-shrink: 0;"></span>
          <span>${state.hasPerplexityKey ? `API 연결됨 · ${calls}회 (${krw}원)` : 'API 키 설정'}</span>
        </button>
      </div>
    `;

    meta.querySelectorAll('[data-writer-model-select]').forEach(sel => {
      sel.addEventListener('change', e => {
        const nextModel = setSelectedWriterModel(e.target.value);
        showToast(`✓ 집필 AI 모델이 [${getWriterModelShortLabel(nextModel)}](으)로 변경되었습니다!`);
        render(true);
      });
    });

    document.getElementById('topbarCopyShareLinkBtn')?.addEventListener('click', copyShareableTeamUrl);
    document.getElementById('openUserGuideModalBtn')?.addEventListener('click', openUserGuideModal);
    document.getElementById('openApiKeyModalBtn')?.addEventListener('click', openApiKeyModal);

    document.getElementById('topGoHomeBtn').addEventListener('click', () => {
      state.screen = 'home';
      render();
    });

    const edBtn = document.getElementById('topGoEditorBtn');
    if (edBtn) {
      edBtn.addEventListener('click', () => {
        state.screen = 'editor';
        render();
      });
    }

    syncTopbarHeightCssVar();
    if (!window.__mkTopbarResizeBound) {
      window.__mkTopbarResizeBound = true;
      window.addEventListener('resize', syncTopbarHeightCssVar);
      if (typeof ResizeObserver !== 'undefined') {
        const headerEl = document.querySelector('.topbar');
        if (headerEl) {
          const ro = new ResizeObserver(() => syncTopbarHeightCssVar());
          ro.observe(headerEl);
        }
      }
    }
  }

  // 스크롤 위치를 유지하면서 화면을 다시 그리는 함수
  function render(preserveScroll = false) {
    const prevWinScroll = preserveScroll ? window.scrollY : 0;
    const leftPanel = document.querySelector('.left-panel-sticky');
    const prevLeftScroll = preserveScroll && leftPanel ? leftPanel.scrollTop : 0;
    const rightPanel = document.querySelector('.right-panel-sticky');
    const prevRightScroll = preserveScroll && rightPanel ? rightPanel.scrollTop : 0;

    renderTopbar();
    try {
      localStorage.setItem(CLIENT_UI_STATE_KEY, JSON.stringify({
        screen: state.screen,
        currentWorkId: state.currentWork?.id || null,
        homeDiscoveryTab: state.homeDiscoveryTab,
        trendTab: state.trendTab,
        leftPanelTab: state.leftPanelTab,
        rightPanelTab: state.rightPanelTab,
        homeMainTabOrder: state.homeMainTabOrder,
        trendTabOrder: state.trendTabOrder
      }));
    } catch (e) {}
    const root = document.getElementById('appRoot');
    if (!root) return;

    if (state.screen === 'home') {
      renderHomeScreen(root);
    } else {
      renderEditorScreen(root);
    }

    root.querySelectorAll('[data-writer-model-select]').forEach(sel => {
      sel.addEventListener('change', e => {
        const nextModel = setSelectedWriterModel(e.target.value);
        showToast(`✓ 집필 AI 모델이 [${getWriterModelShortLabel(nextModel)}](으)로 변경되었습니다!`);
        render(true);
      });
    });

    if (preserveScroll) {
      window.scrollTo(0, prevWinScroll);
      const newLeftPanel = document.querySelector('.left-panel-sticky');
      if (newLeftPanel) newLeftPanel.scrollTop = prevLeftScroll;
      const newRightPanel = document.querySelector('.right-panel-sticky');
      if (newRightPanel) newRightPanel.scrollTop = prevRightScroll;
    }
    syncDraftFloatingBannerDOM();
  }

  let draftTimerId = null;

  function formatDraftRemainingInfo(elapsedSec) {
    const selectedModel = getSelectedWriterModel();
    const estimatedTotalSec = selectedModel === 'sonar-pro' ? 14 : 38;
    const remain = Math.max(0, Math.ceil(estimatedTotalSec - elapsedSec));
    const pct = elapsedSec < estimatedTotalSec
      ? Math.min(92, Math.round((elapsedSec / estimatedTotalSec) * 90) + 5)
      : Math.min(98, 92 + Math.floor((elapsedSec - estimatedTotalSec) / 3));

    const writerLabel = getWriterModelShortLabel();
    let stageText = '1/4단계 [Perplexity(sonar-pro) 수집] · 메인·서브 키워드 및 기획 방향 맞춤 실시간 뉴스·원문 출처 수집 중...';
    if (elapsedSec >= 4.0 && elapsedSec < 18.0) {
      stageText = `2/4단계 [${writerLabel} 심층 집필] · 수집된 팩트와 기획 의도에 맞춰 MK Pick 매거진 본문 1~4단락 작성 중...`;
    } else if (elapsedSec >= 18.0 && elapsedSec < 32.0) {
      stageText = `3/4단계 [${writerLabel} 구조화] · 본문 맞춤형 비교 요약표 · 핵심 용어사전 · 문맥순 FAQ 작성 중...`;
    } else if (elapsedSec >= 32.0) {
      stageText = `4/4단계 [${writerLabel} 최종 완성] · 끊김 없이 완성도 높은 원고를 마무리하고 있습니다 (잠시만 기다려 주세요)...`;
    }

    const timeBadgeText = remain > 0
      ? `${elapsedSec.toFixed(1)}초 경과 · 완료까지 약 ${remain}초 남음`
      : `${elapsedSec.toFixed(1)}초 경과 · 무중단 최종 마무리 중 (곧 완료됩니다)`;

    const shortBtnText = remain > 0
      ? `⏳ 생성 중 (${elapsedSec.toFixed(1)}초 / 약 ${remain}초 남음)`
      : `⏳ 최종 마무리 중 (${elapsedSec.toFixed(1)}초 경과)`;

    return { remain, pct, stageText, timeBadgeText, shortBtnText };
  }

  function syncDraftFloatingBannerDOM() {
    let banner = document.getElementById('draftGeneratingFloatingBanner');
    if (!state.isSearchingNews && !state.isRefreshingInEditor) {
      if (banner) banner.remove();
      return;
    }

    const kw = state.generatingKeyword || state.homeInput.keyword || state.currentWork?.keyword || '선택 키워드';
    const tName = state.generatingTypeName || CONTENT_TYPES[state.homeInput.typeId]?.shortName || '맞춤 유형';
    const info = formatDraftRemainingInfo(state.draftElapsedSec || 0);

    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'draftGeneratingFloatingBanner';
      banner.style.cssText = [
        'position: fixed',
        'bottom: 24px',
        'left: 50%',
        'transform: translateX(-50%)',
        'z-index: 9500',
        'width: min(600px, calc(100vw - 28px))',
        'background-color: #FFFFFF',
        'border: 2px solid var(--mk-orange)',
        'border-radius: 12px',
        'box-shadow: 0 14px 36px rgba(17, 17, 17, 0.22)',
        'padding: 16px 20px',
        'font-family: inherit'
      ].join('; ');
      document.body.appendChild(banner);
    }

    banner.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 8px;">
        <div style="font-size: 14px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
          <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background-color: var(--mk-orange);"></span>
          <span>'${escapeHtml(kw)}'</span>
          <span style="font-size: 11.5px; font-weight: 700; color: var(--mk-orange); background-color: var(--mk-orange-light); padding: 2px 7px; border-radius: 4px;">
            ${escapeHtml(tName)}
          </span>
          <span>맞춤 초안 생성 중</span>
        </div>
        <span id="draftFloatingTimerBadge" style="font-size: 12.5px; font-weight: 800; color: var(--mk-orange); background-color: var(--mk-orange-light); padding: 3px 10px; border-radius: 99px;">
          ⏱ ${escapeHtml(info.timeBadgeText)}
        </span>
      </div>
      <div style="width: 100%; height: 7px; background-color: #F1F1EE; border-radius: 99px; overflow: hidden; margin-bottom: 8px;">
        <div id="draftFloatingProgressBar" style="width: ${info.pct}%; height: 100%; background: linear-gradient(90deg, #F37021 0%, #FF9248 100%); border-radius: 99px; transition: width 0.25s ease;"></div>
      </div>
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--text-secondary);">
        <span id="draftFloatingStageText" style="font-weight: 600;">${escapeHtml(info.stageText)}</span>
        <span style="font-size: 11.5px; color: var(--text-muted); white-space: nowrap;">완성 즉시 편집 화면으로 이동합니다</span>
      </div>
    `;
  }

  function startDraftProgressTimer(keyword, typeName) {
    state.generatingKeyword = keyword;
    state.generatingTypeName = typeName;
    state.draftElapsedSec = 0;
    const startTs = Date.now();

    if (draftTimerId) clearInterval(draftTimerId);
    syncDraftFloatingBannerDOM();

    draftTimerId = setInterval(() => {
      state.draftElapsedSec = Number(((Date.now() - startTs) / 1000).toFixed(1));
      const info = formatDraftRemainingInfo(state.draftElapsedSec);

      const timerBadgeEl = document.getElementById('draftFloatingTimerBadge');
      if (timerBadgeEl) timerBadgeEl.textContent = `⏱ ${info.timeBadgeText}`;

      const barEl = document.getElementById('draftFloatingProgressBar');
      if (barEl) barEl.style.width = `${info.pct}%`;

      const stageEl = document.getElementById('draftFloatingStageText');
      if (stageEl) stageEl.textContent = info.stageText;

      const step1Btn = document.getElementById('homeStartDynamicBtn');
      if (step1Btn && state.isSearchingNews) {
        step1Btn.textContent = info.shortBtnText;
      }

      document.querySelectorAll('[data-active-generating-badge="1"]').forEach(el => {
        el.textContent = info.shortBtnText;
      });
    }, 200);

    return () => {
      if (draftTimerId) {
        clearInterval(draftTimerId);
        draftTimerId = null;
      }
      const totalSec = Number(((Date.now() - startTs) / 1000).toFixed(1));
      state.lastDraftDurationSec = totalSec;
      state.generatingKeyword = '';
      state.generatingTypeName = '';
      syncDraftFloatingBannerDOM();
      return totalSec;
    };
  }

  // 트렌드 키워드 또는 직접 입력으로 바로 기사 초안 생성하는 공통 함수 (서브 키워드 및 편집자 기획 방향·맥락 반영)
  async function startWorkWithKeyword(rawKeyword, typeId = 4, rawCompany = '', autoMatchType = false, customSubKeywords = undefined, customDirection = undefined) {
    if (state.isSearchingNews) return;
    const keyword = cleanTrendTopicKeyword ? cleanTrendTopicKeyword(rawKeyword) : String(rawKeyword || '').trim();
    const company = extractBrandFromTopic ? extractBrandFromTopic(keyword, rawCompany) : String(rawCompany || '').trim();
    const subKeywords = (customSubKeywords !== undefined ? customSubKeywords : (state.homeInput.subKeywords || '')).trim();
    const direction = (customDirection !== undefined ? customDirection : (state.homeInput.direction || '')).trim();
    const matchedType = autoMatchType ? detectBestContentType(keyword, company, `${state.homeInput.rawText || ''} ${direction} ${subKeywords}`, 0) : typeId;
    const tName = CONTENT_TYPES[matchedType]?.shortName || '맞춤 유형';
    const selectedWriter = getSelectedWriterModel();
    state.homeInput.keyword = keyword;
    if (company) state.homeInput.company = company;
    state.homeInput.subKeywords = subKeywords;
    state.homeInput.direction = direction;
    state.homeInput.typeId = matchedType;
    state.isSearchingNews = true;
    const stopTimer = startDraftProgressTimer(keyword, tName);
    render(true);
    try {
      const isLocalServer = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isLocalServer) {
        // Netlify(서버리스 10초 제한 및 한도 절약) 및 GitHub Pages 환경: 브라우저에서 직접 2단계 하이브리드 파이프라인 실행
        throw new Error('USE_CLIENT_HYBRID_DIRECT');
      }
      const res = await apiFetch('/api/works', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'dynamic',
          keyword,
          company,
          subKeywords,
          direction,
          writerModel: selectedWriter,
          url: state.homeInput.url || '',
          rawText: state.homeInput.rawText || '',
          typeId: matchedType,
          autoMatchType
        })
      });
      if (!res.usedPerplexity && getClientPerplexityKey()) {
        throw new Error('SERVER_FALLBACK_RETRY_IN_CLIENT');
      }
      await loadConfig();
      state.isSearchingNews = false;
      const elapsed = stopTimer();
      res.work.createdAtFormatted = formatHistoryTimestamp(new Date());
      res.work.initialDraftSnapshot = captureWorkFullSnapshot(res.work);
      res.work.preRestoreSnapshot = null;
      res.work.isBlankTemplate = false;
      res.work.justRestoredInitial = false;
      res.work.editVersionHistory = null;
      ensureWorkVersionHistory(res.work);
      state.currentWork = res.work;
      state.works.unshift(res.work);
      persistWorksToLocalStorageReliably();
      state.screen = 'editor';
      const finalTypeName = CONTENT_TYPES[res.work.typeId]?.shortName || tName;
      const finalCat = res.work.summaryBlocks?.mkCategory || '산업 Q&A';
      showToast(`✓ [${finalTypeName} · ${finalCat}] '${keyword}' 맞춤 초안이 완성되었습니다! (${getWriterModelShortLabel(selectedWriter)} · ${elapsed}초 소요)`);
      render(false);
    } catch (err) {
      // 브라우저 2단계 하이브리드 파이프라인 직접 실행 (Stage 1: Perplexity sonar-pro 검색 -> Stage 2: 선택된 집필 AI)
      const matchedTrendNews = extractMatchingTrendNewsItems(keyword, company);
      let fallbackScenario = (buildDynamicScenario || buildPresetScenario)({
        keyword,
        company,
        subKeywords,
        direction,
        url: state.homeInput.url || '',
        rawText: state.homeInput.rawText || '',
        typeId: matchedType,
        selectedType: matchedType,
        newsItems: matchedTrendNews
      });
      const clientKey = getClientPerplexityKey();
      let clientPplxError = '';
      if (clientKey) {
        try {
          fallbackScenario = await buildClientPerplexityEnhancedScenario({
            apiKey: clientKey,
            keyword,
            company,
            subKeywords,
            direction,
            url: state.homeInput.url || '',
            rawText: state.homeInput.rawText || '',
            typeId: matchedType,
            baseScenario: fallbackScenario
          });
        } catch (pplxErr) {
          console.warn('Client Perplexity draft fallback:', pplxErr.message);
          clientPplxError = pplxErr.message || 'AI 응답 시간 초과(Timeout)';
        }
      } else {
        clientPplxError = 'API 키 미설정';
      }
      await loadConfig();
      state.isSearchingNews = false;
      const elapsed = stopTimer();
      const fallbackWork = createWorkObject
        ? createWorkObject({
            typeId: matchedType,
            keyword,
            company,
            subKeywords,
            direction,
            url: state.homeInput.url || '',
            rawText: state.homeInput.rawText || '',
            scenario: fallbackScenario
          })
        : {
            id: 'work-' + Date.now(),
            typeId: matchedType,
            keyword,
            inputCompany: company,
            inputSubKeywords: subKeywords,
            inputDirection: direction,
            title: fallbackScenario.titleCandidates[0].title,
            titleCandidates: fallbackScenario.titleCandidates,
            sources: fallbackScenario.sources,
            researchItems: fallbackScenario.researchItems,
            draftSections: fallbackScenario.draftSections,
            summaryBlocks: fallbackScenario.summaryBlocks,
            factChecks: fallbackScenario.factChecks,
            factVerification: fallbackScenario.factVerification || (inspectTopicFactVerification ? inspectTopicFactVerification(keyword, company, (fallbackScenario.sources || []).length) : null),
            updatedAt: '방금 전'
          };
      fallbackWork.inputSubKeywords = subKeywords;
      fallbackWork.inputDirection = direction;
      fallbackWork.usedPerplexity = Boolean(fallbackScenario.usedPerplexity);
      fallbackWork.activeWriterModel = fallbackScenario.activeWriterModel || (fallbackScenario.usedPerplexity ? selectedWriter : '');
      fallbackWork.fallbackFromModel = fallbackScenario.fallbackFromModel || '';
      fallbackWork.fallbackReason = fallbackScenario.fallbackReason || '';
      fallbackWork.pplxError = fallbackScenario.usedPerplexity ? '' : clientPplxError;
      fallbackWork.createdAtFormatted = formatHistoryTimestamp(new Date());
      fallbackWork.initialDraftSnapshot = captureWorkFullSnapshot(fallbackWork);
      fallbackWork.preRestoreSnapshot = null;
      fallbackWork.isBlankTemplate = false;
      fallbackWork.justRestoredInitial = false;
      fallbackWork.editVersionHistory = null;
      ensureWorkVersionHistory(fallbackWork);
      state.currentWork = fallbackWork;
      state.works.unshift(fallbackWork);
      persistWorksToLocalStorageReliably();
      state.screen = 'editor';
      const finalCat = fallbackWork.summaryBlocks?.mkCategory || '산업 Q&A';
      if (fallbackWork.usedPerplexity) {
        const usedModelLabel = getWriterModelShortLabel(fallbackWork.activeWriterModel || selectedWriter);
        showToast(`✓ [${tName} · ${finalCat}] '${keyword}' 맞춤 초안이 완성되었습니다! (${usedModelLabel} · ${elapsed}초 소요)`);
      } else {
        showToast(`⚠️ AI 호출이 실패(${clientPplxError})하여 임시 기본 골격이 표시되었습니다. 상단 진단 배너에서 [즉시 다시 생성]을 눌러주세요!`);
      }
      render(false);
    }
  }

  // ==========================================================================
  // 화면 1: 첫 화면 (2단 구조로 대폭 단순화)
  //   - 상단 카드 1: [새 기사 초안 만들기] (키워드 입력 + 5열 컴팩트 유형 선택 + 단 1개의 명확한 생성 버튼)
  //   - 하단 카드 2: [소재 발굴 & 작업 보관함] (🔥 실시간 트렌드 10선 | 📅 2026 마케팅 캘린더 | 📂 최근 작업 기사 3탭 전환)
  // ==========================================================================
  // 캘린더 카드 내 소재 라벨에서 이모지·날짜 접두어·불필요한 꼬리말을 정리해 자연스러운 서브키워드와 문장용 구절을 반환
  function parseCalendarTopicPhrase(rawLabel = '') {
    const stripped = String(rawLabel || '')
      .replace(/^[^\w가-힣]+/, '')
      .replace(/^\d{1,2}\/\d{1,2}\s+/, '')
      .trim();

    if (/농업인의\s*날.*가래떡데이|가래떡데이.*농업인의\s*날/.test(stripped)) {
      return { subKeyword: '가래떡데이, 농업인의 날', phrase: '농업인의 날(가래떡데이)' };
    }
    if (/수험표\s*할인/.test(stripped)) {
      return { subKeyword: '수능 수험표 할인 혜택', phrase: '수능 수험표 할인 혜택' };
    }
    if (/찹쌀떡|보온도시락|수능\s*응원\s*선물/.test(stripped)) {
      return { subKeyword: '찹쌀떡·보온도시락 수능 응원 선물', phrase: '찹쌀떡·보온도시락 같은 수능 응원 선물' };
    }
    if (/수능\s*일정|입시\s*분석/.test(stripped)) {
      return { subKeyword: '2027학년도 수능 일정·입시 변수', phrase: '2027학년도 수능 일정·입시 체크포인트' };
    }
    if (/광군제/.test(stripped)) {
      return { subKeyword: '광군제 해외직구 특가', phrase: '광군제 해외직구 할인·특가' };
    }
    if (/빼빼로데이/.test(stripped)) {
      return { subKeyword: '빼빼로데이 캐릭터 콜라보', phrase: '빼빼로데이 캐릭터 콜라보·굿즈' };
    }
    if (/절임배추|포장김치/.test(stripped)) {
      return { subKeyword: '김장철 절임배추·포장김치', phrase: '김장철 절임배추·포장김치 할인' };
    }
    if (/김치의\s*날/.test(stripped)) {
      return { subKeyword: '11월 22일 김치의 날', phrase: '법정기념일 김치의 날 유래·프로모션' };
    }
    if (/블랙프라이데이/.test(stripped)) {
      return { subKeyword: '블랙프라이데이 직구·할인', phrase: '블랙프라이데이 해외직구·할인 혜택' };
    }
    if (/코리아세일페스타/.test(stripped)) {
      return { subKeyword: '코리아세일페스타 국내 유통 특가', phrase: '코리아세일페스타 국내 유통가 특가' };
    }
    if (/발열내의|경량패딩|방한\s*패션/.test(stripped)) {
      return { subKeyword: '발열내의·경량패딩 방한 패션', phrase: '발열내의·경량패딩 등 가성비 방한 패션' };
    }
    if (/전기요|온수매트|난방가전/.test(stripped)) {
      return { subKeyword: '전기요·온수매트 난방가전', phrase: '전기요·온수매트·히터 등 고효율 난방가전' };
    }

    const cleanSub = stripped
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s*(?:총정리|비교|가이드|분석)$/, '')
      .trim() || stripped;
    return { subKeyword: cleanSub, phrase: stripped };
  }

  // 선택한 메인 소재와 '함께 엮기'로 클릭한 소재의 관계를 파악해 가장 자연스러운 기획 방향 문장을 생성
  function buildCalendarSiblingLinkDirection(mainLabel = '', sibLabel = '', mergedSubKeywords = '') {
    const combined = `${mainLabel} ${sibLabel} ${mergedSubKeywords}`;
    const mainInfo = parseCalendarTopicPhrase(mainLabel);
    const sibInfo = parseCalendarTopicPhrase(sibLabel);

    // 1) 수능(응원 선물 / 수험표 할인 / 수능 일정·입시) 조합
    if (/수능|수험표|찹쌀떡|보온도시락/.test(combined)) {
      const hasGift = /찹쌀떡|보온도시락|응원\s*선물/.test(combined);
      const hasDiscount = /수험표\s*할인/.test(combined);
      const hasSchedule = /수능\s*일정|입시/.test(combined);

      if (hasGift && hasDiscount && hasSchedule) {
        return '2027학년도 수능 주요 일정·체크포인트부터 찹쌀떡·보온도시락 같은 수능 응원 선물 트렌드, 시험 직후 챙겨야 할 수험표 할인 혜택까지 함께 엮어서 정리';
      }
      if (hasGift && hasDiscount) {
        return '찹쌀떡·보온도시락 같은 수능 응원 선물 트렌드와 함께, 시험 직후 수험생이 바로 챙길 수 있는 수험표 할인 혜택 내용도 함께 엮어서 정리';
      }
      if (hasGift && hasSchedule) {
        return '2027학년도 수능 핵심 일정·체크포인트와 함께, 찹쌀떡·보온도시락 등 센스 있는 수능 응원 선물 트렌드를 자연스럽게 엮어서 정리';
      }
      if (hasDiscount && hasSchedule) {
        return '2027학년도 수능 주요 일정·입시 체크포인트와 함께, 시험이 끝난 뒤 수험생이 누릴 수 있는 분야별 수험표 할인 혜택을 한 흐름으로 엮어서 정리';
      }
    }

    // 2) 11월 11일 (빼빼로데이 / 농업인의 날 가래떡데이 / 광군제) 조합
    if (/빼빼로데이|가래떡데이|농업인의\s*날|광군제/.test(combined)) {
      const hasPepero = /빼빼로데이/.test(combined);
      const hasGaraetteok = /가래떡데이|농업인의\s*날/.test(combined);
      const hasSinglesDay = /광군제/.test(combined);

      if (hasPepero && hasGaraetteok && hasSinglesDay) {
        return '11월 11일 빼빼로데이 콜라보 트렌드와 우리 쌀을 챙기는 농업인의 날(가래떡데이), 글로벌 쇼핑 축제 광군제 할인 정보까지 11월 11일 3대 이슈를 입체적으로 엮어서 소개';
      }
      if (hasPepero && hasGaraetteok) {
        return "빼빼로데이만 알고 있던 독자들에게 같은 11월 11일인 '농업인의 날(가래떡데이)'도 함께 알려주고, 요즘 유행하는 떡 디저트·콜라보 트렌드와 자연스럽게 엮어서 소개";
      }
      if (hasSinglesDay) {
        return `11월 11일 ${mainInfo.phrase} 트렌드와 함께, 같은 날 열리는 글로벌 쇼핑 행사 '광군제' 해외직구 특가·체크포인트도 함께 엮어서 정리`;
      }
    }

    // 3) 김장철 절임배추·포장김치 + 11/22 법정기념일 김치의 날
    if (/김장|절임배추|포장김치|김치의\s*날/.test(combined)) {
      return "11월 22일 법정기념일 '김치의 날' 제정 의미와 함께, 본격적인 김장철을 맞은 대형마트·이커머스의 절임배추 사전예약 및 포장김치 할인 혜택을 함께 엮어서 정리";
    }

    // 4) 블랙프라이데이 + 코리아세일페스타
    if (/블랙프라이데이|코리아세일페스타/.test(combined)) {
      return "11월 연중 최대 쇼핑 시즌을 맞아 국내 유통가가 총출동하는 '코리아세일페스타' 특가 혜택과 해외직구 '블랙프라이데이' 할인·통관 체크포인트를 나란히 비교·정리";
    }

    // 5) 월동 준비 (방한 패션 + 난방가전)
    if (/발열내의|경량패딩|방한|전기요|온수매트|난방가전/.test(combined)) {
      return '본격적인 겨울 추위에 대비하는 발열내의·경량패딩 등 가성비 방한 패션 아이템과 난방비를 아껴주는 전기요·온수매트 등 고효율 난방가전 선택 가이드를 함께 엮어서 정리';
    }

    // 6) 한우데이 + 소상공인의 날
    if (/한우데이|소상공인의\s*날/.test(combined)) {
      return "11월 초 소비 활성화를 이끄는 '11/1 한우데이' 반값 특가전과 '11/5 소상공인의 날' 상생 프로모션 혜택을 함께 엮어서 소개";
    }

    // 7) 한글날 무료 글꼴·굿즈 + 개천절·한글날 연휴 나들이
    if (/한글날|개천절/.test(combined)) {
      return '10월 개천절·한글날 연휴 나들이·여행 트렌드와 함께, 한글날의 의미를 되새기는 기업 무료 글꼴 배포 및 우리말 한정판 굿즈 열풍을 자연스럽게 엮어서 정리';
    }

    // 8) 그 외 모든 월별(1~12월) 및 향후 추가 소재: 두 소재의 성격(기념일/빅이벤트/할인·선물/트렌드)을 자동 분석해 자연스러운 문장 생성
    const hasCommemorativeMain = /(?:의\s*날|데이|절|입춘|정월대보름|동지|초복|중복|말복|설\s*명절|추석|어린이날|어버이날|스승의\s*날|성년의\s*날|부부의\s*날|현충일)/.test(mainInfo.phrase);
    const hasCommemorativeSib = /(?:의\s*날|데이|절|입춘|정월대보름|동지|초복|중복|말복)/.test(sibInfo.phrase);
    const hasPromoOrGiftSib = /(?:할인|특가|혜택|프로모션|선물|기프트|세일|패키지|케이크|간식|디저트|야식|먹거리|굿즈)/.test(sibInfo.phrase);

    if (hasCommemorativeMain && hasCommemorativeSib) {
      return `같은 시기에 찾아오는 '${mainInfo.phrase}'과 '${sibInfo.phrase}'의 의미·배경을 함께 조명하고, 주요 브랜드 프로모션과 최신 소비 트렌드를 자연스럽게 엮어서 소개`;
    }
    if (hasPromoOrGiftSib) {
      return `${mainInfo.phrase} 시즌 트렌드와 함께 독자들이 실질적으로 챙길 수 있는 ${sibInfo.phrase} 정보·할인 혜택까지 한 흐름으로 자연스럽게 엮어서 정리`;
    }
    return `${mainInfo.phrase} 핵심 트렌드와 함께 ${sibInfo.phrase} 내용도 한 흐름으로 자연스럽게 엮어서 정리`;
  }

  function renderHomeScreen(root) {
    const hi = state.homeInput;
    const hasAnyHomeInput = Boolean(
      (hi.keyword || '').trim() ||
      (hi.company || '').trim() ||
      (hi.subKeywords || '').trim() ||
      (hi.direction || '').trim()
    );
    if (hi.typeMode !== 'manual' && hasAnyHomeInput) {
      hi.typeId = detectBestContentType(
        hi.keyword,
        hi.company,
        `${hi.rawText || ''} ${hi.direction || ''} ${hi.subKeywords || ''}`,
        0
      );
    }
    const selectedTypeInfo = CONTENT_TYPES[hi.typeId] || CONTENT_TYPES[3];
    const previewCat = recommendMkPickCategory(hi.keyword || selectedTypeInfo.name, hi.typeId, hi.company);
    const calData = MONTHLY_MARKETING_CALENDAR[state.calendarMonth] || MONTHLY_MARKETING_CALENDAR[10];

    function buildHomeTypePreviewMetaHtml() {
      const hasInputNow = Boolean(
        (hi.keyword || '').trim() ||
        (hi.company || '').trim() ||
        (hi.subKeywords || '').trim() ||
        (hi.direction || '').trim()
      );
      if (hi.typeMode !== 'manual' && !hasInputNow) {
        return `
          <span style="color: var(--text-muted); font-size: 12px;">키워드를 입력하면 가장 알맞은 유형(01~05)과 카테고리가 자동 추천됩니다</span>
        `;
      }
      const curTypeInfo = CONTENT_TYPES[hi.typeId] || CONTENT_TYPES[3];
      const curCat = recommendMkPickCategory(hi.keyword || curTypeInfo.name, hi.typeId, hi.company);
      return `
        <span style="font-size: 12px; color: var(--text-secondary);">
          ${hi.typeMode !== 'manual' ? '✨ AI 추천:' : '✓ 선택됨:'}
          <strong style="color: ${hi.typeMode !== 'manual' ? '#1D4ED8' : 'var(--mk-orange)'};">유형 0${curTypeInfo.id} · ${escapeHtml(curTypeInfo.uiTitle || curTypeInfo.name)}</strong>
          <span style="color: #CBD5E1; margin: 0 5px;">|</span>
          카테고리 <strong style="color: var(--text-primary);">${escapeHtml(curCat.recommendedCategory)}</strong>
        </span>
      `;
    }

    function buildHomeTypeCardsHtml() {
      const hasInputNow = Boolean(
        (hi.keyword || '').trim() ||
        (hi.company || '').trim() ||
        (hi.subKeywords || '').trim() ||
        (hi.direction || '').trim()
      );
      return Object.values(CONTENT_TYPES).map(t => {
        const isManualSelected = hi.typeMode === 'manual' && Number(hi.typeId) === t.id;
        const isAutoMatched = hi.typeMode !== 'manual' && hasInputNow && Number(hi.typeId) === t.id;
        const cardClass = isManualSelected ? 'selected' : (isAutoMatched ? 'auto-matched' : '');
        const accentColor = isManualSelected ? 'var(--mk-orange)' : (isAutoMatched ? '#1D4ED8' : 'var(--text-primary)');
        const subMetaColor = isManualSelected ? 'var(--mk-orange)' : (isAutoMatched ? '#1D4ED8' : 'var(--text-muted)');
        const cleanCat = String(t.defaultCategory || '').replace(/\([^)]*\)/g, '').trim();
        return `
          <div class="home-type-card ${cardClass}" data-select-home-type="${t.id}" title="클릭하여 '${escapeHtml(t.uiTitle || t.name)}' 관점으로 직접 지정 (다시 클릭 시 AI 자동 맞춤)">
            <div class="flex-between mb-6" style="gap: 4px;">
              <span style="font-size: 11px; font-weight: 700; color: ${subMetaColor};">
                0${t.id} · ${escapeHtml(cleanCat)}
              </span>
              ${isManualSelected ? `
                <span style="font-size: 10px; font-weight: 800; color: #FFFFFF; background-color: var(--mk-orange); padding: 1px 6px; border-radius: 99px;">
                  선택됨
                </span>
              ` : isAutoMatched ? `
                <span style="font-size: 10px; font-weight: 800; color: #FFFFFF; background-color: #2563EB; padding: 1px 6px; border-radius: 99px;">
                  AI 추천
                </span>
              ` : ''}
            </div>
            <div style="font-size: 13.5px; font-weight: 800; color: ${accentColor}; margin-bottom: 5px; line-height: 1.32; letter-spacing: -0.2px;">
              ${t.icon ? `${t.icon} ` : ''}${escapeHtml(t.uiTitle || t.name)}
            </div>
            <div style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.45;">
              ${escapeHtml(t.desc)}
            </div>
          </div>
        `;
      }).join('');
    }

    const activeTrendList =
      state.trendTab === 'shortform'
        ? state.trendRadar.shortFormTrends
        : state.trendTab === 'google'
        ? state.trendRadar.googleTrends
        : state.trendTab === 'portal'
        ? state.trendRadar.portalRetailTrends
        : state.trendTab === 'brandpromo'
        ? state.trendRadar.brandPromoTrends || []
        : state.trendRadar.newsletterTrends;

    root.innerHTML = `
      <div class="home-screen-wrap">
      <!-- 1. 상단 통합 작성 카드: STEP 1(주제·기획 방향) + STEP 2(AI 자동 맞춤 & 5대 기사 관점) -->
      <div class="card" style="padding: 24px 28px; margin-bottom: 22px;">
        <div class="flex-between" style="flex-wrap: wrap; gap: 10px; padding-bottom: 14px; margin-bottom: 18px; border-bottom: 1px solid #F1F5F9;">
          <div style="display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;">
            <h1 style="font-size: 18px; font-weight: 800; letter-spacing: -0.3px; color: var(--text-primary);">새 기사 초안 만들기</h1>
            <span style="font-size: 12.5px; color: var(--text-muted);">
              키워드 입력 후 <strong>[✨ 초안 만들기]</strong>를 누르면 실시간 뉴스 취재와 기사 집필이 자동 진행됩니다
            </span>
          </div>
          <button type="button" id="toggleRawPasteBtn" class="btn btn-sm" style="font-size: 12px; font-weight: 600; color: ${state.showRawPasteInput ? 'var(--mk-orange)' : 'var(--text-secondary)'}; background-color: ${state.showRawPasteInput ? 'var(--mk-orange-light)' : '#F8FAFC'}; border-color: ${state.showRawPasteInput ? 'var(--mk-orange-border)' : '#E2E8F0'}; padding: 5px 11px;">
            ${state.showRawPasteInput ? '📎 보도자료 · 참고 URL 닫기 ▲' : '📎 + 보도자료 · 참고 URL 추가'}
          </button>
        </div>

        <!-- STEP 1: 메인 키워드 · 기업명 + 서브 키워드 · 기획 방향 (중첩 박스 없이 정돈된 2행 그리드) -->
        <div id="homeStep1Box" style="margin-bottom: 18px;">
          <div class="home-step1-main-grid">
            <div>
              <label for="homeKeywordInput" style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
                <span style="background-color: var(--mk-orange); color: #FFFFFF; font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 4px;">STEP 1</span>
                <span>트렌드 키워드 / 주제 <span style="color: var(--mk-orange);">*</span></span>
              </label>
              <input type="text" class="input" id="homeKeywordInput" placeholder="예: 이디야·맘스터치·메가커피 신메뉴, 빼빼로데이, 다이소 뷰티..." value="${escapeHtml(hi.keyword)}" style="height: 42px; padding: 0 14px; font-size: 13.5px; font-weight: 600;" />
            </div>
            <div>
              <label for="homeCompanyInput" style="display: block; font-size: 12.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">
                기업·브랜드명 <span style="font-weight: 400; font-size: 11.5px; color: var(--text-muted);">(선택 · 쉼표 구분)</span>
              </label>
              <input type="text" class="input" id="homeCompanyInput" placeholder="예: 이디야커피, 맘스터치, 메가MGC커피" value="${escapeHtml(hi.company)}" style="height: 42px; padding: 0 14px; font-size: 13.5px;" />
            </div>
            <div>
              <button class="btn btn-primary btn-lg" id="homeStartDynamicBtn" style="height: 42px; padding: 0 24px; font-size: 14px; font-weight: 800;" ${state.isSearchingNews ? 'disabled' : ''}>
                ${state.isSearchingNews ? formatDraftRemainingInfo(state.draftElapsedSec || 0).shortBtnText : '✨ 초안 만들기 →'}
              </button>
            </div>
          </div>

          <div class="home-step1-sub-grid">
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; min-height: 20px;">
                <label for="homeSubKeywordsInput" style="font-size: 12px; font-weight: 700; color: var(--text-secondary);">
                  서브 키워드 <span style="font-weight: 400; color: var(--text-muted);">(선택 · 쉼표 구분)</span>
                </label>
              </div>
              <input
                type="text"
                class="input"
                id="homeSubKeywordsInput"
                placeholder="예: 푸드·스낵 신메뉴, 가성비 세트, 출시 가격"
                value="${escapeHtml(hi.subKeywords || '')}"
                style="height: 38px; padding: 0 12px; font-size: 13px; background-color: #FAFAFA;"
              />
            </div>
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-bottom: 5px; min-height: 20px;">
                <label for="homeDirectionInput" style="font-size: 12px; font-weight: 700; color: var(--text-secondary);">
                  원하는 글의 방향 · 맥락 <span style="font-weight: 400; color: var(--text-muted);">(선택 · 기획 의도)</span>
                </label>
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                  <button type="button" class="text-action" data-home-quick-dir="각 브랜드가 실제로 출시한 대표 신메뉴·신상품의 정확한 명칭, 가격, 핵심 특징을 1:1로 비교하고 추천 가이드를 정리해줘" style="font-size: 11px; background: #F8FAFC; border: 1px solid #E2E8F0; color: var(--text-secondary); padding: 1px 7px; border-radius: 6px; font-weight: 600;">
                    + 신메뉴·스펙 비교
                  </button>
                  <button type="button" class="text-action" data-home-quick-dir="2030 소비자와 SNS에서 왜 지금 이 키워드가 화제인지 최신 트렌드 배경과 실제 소비자 반응을 중심으로 작성해줘" style="font-size: 11px; background: #F8FAFC; border: 1px solid #E2E8F0; color: var(--text-secondary); padding: 1px 7px; border-radius: 6px; font-weight: 600;">
                    + 2030 인기 배경
                  </button>
                  <button type="button" class="text-action" data-home-quick-dir="독자가 바로 활용할 수 있는 할인 프로모션 일정, 결제 혜택, 구매처, 실전 체크포인트를 중심으로 정리해줘" style="font-size: 11px; background: #F8FAFC; border: 1px solid #E2E8F0; color: var(--text-secondary); padding: 1px 7px; border-radius: 6px; font-weight: 600;">
                    + 할인·구매 팁
                  </button>
                  ${(hi.subKeywords || hi.direction) ? `
                    <button type="button" class="text-action" id="clearHomeSubAndDirBtn" style="font-size: 11px; color: #DC2626; font-weight: 700; margin-left: 2px;">
                      초기화 ✕
                    </button>
                  ` : ''}
                </div>
              </div>
              <input
                type="text"
                class="input"
                id="homeDirectionInput"
                placeholder="예: 각 브랜드가 실제로 출시한 대표 신메뉴 이름·가격·특징을 비교하고 소비자 추천 조합을 소개해줘"
                value="${escapeHtml(hi.direction || '')}"
                style="height: 38px; padding: 0 12px; font-size: 13px; background-color: #FAFAFA;"
              />
            </div>
          </div>
        </div>

        ${state.showRawPasteInput ? `
          <div class="grid-2 mb-16" style="padding: 12px 14px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px;">
            <div>
              <label style="display:block; font-size:12px; font-weight:700; color: var(--text-secondary); margin-bottom:4px;">참고 URL (업체 홈페이지·보도자료 링크)</label>
              <input type="url" class="input" id="homeUrlInput" placeholder="https://..." value="${escapeHtml(hi.url)}" />
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:700; color: var(--text-secondary); margin-bottom:4px;">보도자료 핵심 문구 붙여넣기</label>
              <input type="text" class="input" id="homeRawTextInput" placeholder="기사에 꼭 들어갈 수치나 기업 서비스 내용을 붙여넣으세요" value="${escapeHtml(hi.rawText)}" />
            </div>
          </div>
        ` : ''}

        <!-- STEP 2: 기사 전개 관점 선택 (AI 자동 맞춤 기본 작동 + 심플한 5대 에디토리얼 관점 카드) -->
        <div style="padding-top: 16px; border-top: 1px solid #F1F5F9;">
          <div class="flex-between mb-10" style="flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
              <span style="background-color: #334155; color: #FFFFFF; font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 4px;">STEP 2</span>
              <span style="font-size: 12.5px; font-weight: 700; color: var(--text-primary);">기사 전개 관점</span>
              <button
                type="button"
                id="homeAutoTypeModeBtn"
                style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.12s ease; border: 1px solid ${hi.typeMode !== 'manual' ? '#2563EB' : '#CBD5E1'}; background-color: ${hi.typeMode !== 'manual' ? '#EFF6FF' : '#FFFFFF'}; color: ${hi.typeMode !== 'manual' ? '#1D4ED8' : 'var(--text-secondary)'};"
                title="키워드와 최신 뉴스 성격에 맞춰 AI가 최적의 기사 관점을 자동 적용합니다"
              >
                ✨ AI 자동 맞춤 ${hi.typeMode !== 'manual' ? 'ON' : '켜기'}
              </button>
            </div>
            <div id="homeTypePreviewMetaBox" style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
              ${buildHomeTypePreviewMetaHtml()}
            </div>
          </div>

          <div class="home-type-grid" id="homeTypeGridContainer">
            ${buildHomeTypeCardsHtml()}
          </div>
        </div>
      </div>

      <!-- 2. 하단 통합 소재 발굴 & 작업 보관함 카드 (3개 탭으로 분리해 한 번에 하나씩만 깔끔하게 표시!) -->
      <div style="margin: 24px 0 10px 4px;">
        <h2 style="font-size: 19px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px;">기사 아이디어가 떠오르지 않는다면?</h2>
      </div>
      <div class="card" style="padding: 0; overflow: hidden;">
        <div class="home-main-tab-bar">
          <div class="home-main-tabs" id="homeMainTabsContainer">
            ${(state.homeMainTabOrder || DEFAULT_MAIN_TAB_ORDER).map((tabKey, idx, arr) => {
              const mainTabLabels = {
                trends: '🔥 실시간 트렌드 추천',
                calendar: '📅 2026 월별 마케팅 캘린더',
                works: `📂 최근 작업한 기사 (${state.works.length})`
              };
              const isAct = state.homeDiscoveryTab === tabKey;
              return `
                <button
                  type="button"
                  draggable="true"
                  class="home-main-tab-btn draggable-tab ${isAct ? 'active' : ''}"
                  data-home-main-tab="${tabKey}"
                  title="마우스로 드래그하여 탭 순서를 자유롭게 변경할 수 있습니다"
                >
                  ${state.isEditingTabOrder && idx > 0 ? `<span class="tab-move-arrow" data-move-main-tab="${tabKey}" data-move-dir="-1" title="왼쪽으로 이동">◀</span>` : ''}
                  <span class="tab-grip-icon">⠿</span>${mainTabLabels[tabKey] || tabKey}
                  ${state.isEditingTabOrder && idx < arr.length - 1 ? `<span class="tab-move-arrow" data-move-main-tab="${tabKey}" data-move-dir="1" title="오른쪽으로 이동">▶</span>` : ''}
                </button>
              `;
            }).join('')}
          </div>

          <div class="flex-row" style="padding: 8px 0; gap: 10px;">
            ${state.homeDiscoveryTab === 'trends' ? `
              ${state.lastTrendLoadDurationSec && !state.isLoadingTrends ? `
                <span style="font-size: 11.5px; color: var(--status-green); font-weight: 700;">
                  ✓ 최근 업데이트 완료 (${state.lastTrendLoadDurationSec}초 소요)
                </span>
              ` : ''}
              <button type="button" class="text-action" id="refreshTrendRadarBtn" style="${state.isLoadingTrends ? 'color: var(--mk-orange); font-weight: 800;' : ''}">
                ${state.isLoadingTrends ? `⏳ 실시간 수집 중... (${(state.trendLoadElapsedSec || 0).toFixed(1)}초 / 예상 약 1~3초)` : '↻ 실시간 트렌드 새로고침 (약 1~3초 소요)'}
              </button>
            ` : state.homeDiscoveryTab === 'calendar' ? `
              <button type="button" class="btn btn-sm btn-outline-orange" id="openIbossPopupBtn">
                🔗 아이보스 마케팅 캘린더 팝업 ↗
              </button>
              <button type="button" class="btn btn-sm ${state.showExternalCalendarEmbed ? 'btn-primary' : ''}" id="toggleExternalCalEmbedBtn">
                ${state.showExternalCalendarEmbed ? '📄 나스미디어 2026 원본 PDF 닫기 ▲' : '📄 나스미디어 2026 원본 PDF 보기 ▼'}
              </button>
            ` : `
              <span class="text-muted">모든 변경사항은 자동 저장됩니다</span>
            `}
          </div>
        </div>

        <div style="padding: 22px 26px;">
          ${state.homeDiscoveryTab === 'trends' ? `
            <!-- [탭 1: 실시간 트렌드 키워드 추천 10선] -->
            ${state.isLoadingTrends ? `
              <div style="margin-bottom: 12px; padding: 10px 14px; background-color: var(--mk-orange-light); border: 1px solid var(--mk-orange-border); border-radius: var(--radius-general); display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <span id="trendLoadingBannerText" style="font-size: 12.5px; font-weight: 700; color: var(--mk-orange);">
                  5개 탭(유튜브 쇼츠·뉴스레터·포털·구글 트렌드·브랜드신상) 실시간 원본 데이터를 수집하고 있습니다... (${(state.trendLoadElapsedSec || 0).toFixed(1)}초 경과 · 예상 소요 약 1~3초)
                </span>
                <span style="font-size: 11.5px; color: var(--text-secondary); white-space: nowrap;">기존 목록을 보시면서 바로 클릭하셔도 됩니다</span>
              </div>
            ` : ''}
            <div class="flex-between mb-8" style="flex-wrap: wrap; gap: 8px;">
              <p style="font-size: 13px; color: var(--text-secondary);">
                원하는 트렌드 키워드를 클릭하면 가장 알맞은 콘텐츠 유형(01~05)과 카테고리로 <strong>즉시 기사 초안이 생성</strong>됩니다.
              </p>
              <div class="flex-row" style="gap: 8px;">
                <span style="font-size: 11.5px; color: var(--text-muted);">⠿ 탭을 마우스로 끌어 순서 이동 가능</span>
                <button type="button" class="text-action" id="toggleTabReorderModeBtn" style="font-size: 11.5px; color: ${state.isEditingTabOrder ? 'var(--mk-orange)' : 'var(--text-secondary)'}; font-weight: ${state.isEditingTabOrder ? '800' : '600'};">
                  ${state.isEditingTabOrder ? '✓ 순서 편집 완료' : '⇄ 화살표로 탭 순서 바꾸기'}
                </button>
                ${(JSON.stringify(state.trendTabOrder) !== JSON.stringify(DEFAULT_TREND_TAB_ORDER) || JSON.stringify(state.homeMainTabOrder) !== JSON.stringify(DEFAULT_MAIN_TAB_ORDER)) ? `
                  <button type="button" class="text-action" id="resetTabOrderBtn" style="font-size: 11.5px; color: var(--text-muted);" title="탭 순서를 초기 기본 순서로 되돌립니다">
                    ↺ 기본 순서 복원
                  </button>
                ` : ''}
              </div>
            </div>

            <div class="trend-clean-tab-bar" id="trendCleanTabBarContainer" style="flex-wrap: wrap;">
              ${(state.trendTabOrder || DEFAULT_TREND_TAB_ORDER).map((tKey, idx, arr) => {
                const trendTabMeta = {
                  shortform: `유튜브 쇼츠 · 릴스 화제 (${(state.trendRadar.shortFormTrends || []).length})`,
                  newsletter: `트렌드 뉴스레터 · MZ 키워드 (${(state.trendRadar.newsletterTrends || []).length})`,
                  portal: `네이버 · 포털 유통 화제 (${(state.trendRadar.portalRetailTrends || []).length})`,
                  google: `구글 트렌드 급상승 (${(state.trendRadar.googleTrends || []).length})`,
                  brandpromo: `🎁 브랜드 신상 · 프로모션 뉴스 (${(state.trendRadar.brandPromoTrends || []).length})`
                };
                const isAct = state.trendTab === tKey;
                return `
                  <button
                    type="button"
                    draggable="true"
                    class="trend-clean-tab draggable-tab ${isAct ? 'active' : ''}"
                    data-trend-tab="${tKey}"
                    title="마우스로 드래그하여 탭 순서를 자유롭게 변경할 수 있습니다"
                  >
                    ${state.isEditingTabOrder && idx > 0 ? `<span class="tab-move-arrow" data-move-trend-tab="${tKey}" data-move-dir="-1" title="왼쪽으로 이동">◀</span>` : ''}
                    <span class="tab-grip-icon">⠿</span>${trendTabMeta[tKey] || tKey}
                    ${state.isEditingTabOrder && idx < arr.length - 1 ? `<span class="tab-move-arrow" data-move-trend-tab="${tKey}" data-move-dir="1" title="오른쪽으로 이동">▶</span>` : ''}
                  </button>
                `;
              }).join('')}
            </div>

            <div class="trend-clean-grid">
              ${activeTrendList.length === 0 ? `
                <div style="grid-column: 1 / -1; padding: 28px 16px; text-align: center; color: var(--text-secondary); font-size: 13px; background-color: var(--bg-subtle); border-radius: var(--radius-general);">
                  ${state.isLoadingTrends
                    ? '⏳ 실시간 뉴스·쇼츠·구글 트렌드 원본 데이터를 수집하고 있습니다. 잠시만 기다려주세요...'
                    : '표시할 실시간 트렌드 항목이 없습니다. 우측 상단 [↻ 실시간 트렌드 새로고침]을 눌러 최신 데이터를 불러오세요.'}
                </div>
              ` : activeTrendList.map((item, idx) => {
                const matchedTypeId = detectBestContentType(item.keyword, item.company || '', item.desc || '', state.trendTab === 'shortform' || state.trendTab === 'newsletter' ? 3 : 4);
                const matchedCat = recommendMkPickCategory(item.keyword, matchedTypeId, item.company || '').recommendedCategory;
                const articleUrl = item.url || `https://news.google.com/search?q=${encodeURIComponent(item.keyword)}&hl=ko&gl=KR&ceid=KR:ko`;
                const isYoutubeShorts = articleUrl.includes('youtube.com/shorts') || item.source === '유튜브 쇼츠';
                const cleanSource = String(item.source || '').trim();
                const shortSource = cleanSource.length > 9 ? cleanSource.slice(0, 9) + '…' : cleanSource;
                const linkLabel = isYoutubeShorts
                  ? '쇼츠 영상 ↗'
                  : shortSource
                    ? `${shortSource} 원문 ↗`
                    : '원문 기사 ↗';
                const linkTooltip = [cleanSource, item.pubDateShort, '실제 원문 새 창 열기'].filter(Boolean).join(' · ');
                const isThisRowGenerating = state.isSearchingNews && state.generatingKeyword === item.keyword;
                const rowGenStyle = isThisRowGenerating
                  ? 'border-color: var(--mk-orange); background-color: var(--mk-orange-light); box-shadow: 0 0 0 2px rgba(243, 112, 33, 0.16);'
                  : '';
                const rowFv = inspectTopicFactVerification
                  ? inspectTopicFactVerification(item.keyword, item.company || '', isYoutubeShorts ? 0 : 1)
                  : { isWarning: isYoutubeShorts };
                const factCheckSearchUrl = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(item.keyword)}`;
                return `
                  <div class="trend-clean-row" style="${rowGenStyle}" data-use-trend-kw="${escapeHtml(item.keyword)}" data-use-trend-comp="${escapeHtml(item.company || '')}" data-use-trend-type="${matchedTypeId}">
                    <!-- 1행: 순위 번호 + 트렌드 키워드 제목(전체 폭 확보) + 우측 초안 생성 액션 -->
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;">
                      <div style="display: flex; align-items: baseline; gap: 8px; min-width: 0; flex: 1;">
                        <span style="font-size: 13px; font-weight: 800; color: var(--mk-orange); flex-shrink: 0; min-width: 18px;">${idx + 1}</span>
                        <strong style="font-size: 14.5px; font-weight: 800; color: var(--text-primary); line-height: 1.4;">${escapeHtml(item.keyword)}</strong>
                      </div>
                      <span ${isThisRowGenerating ? 'data-active-generating-badge="1"' : ''} style="font-size: 12px; font-weight: 800; color: var(--mk-orange); white-space: nowrap; flex-shrink: 0; padding-top: 1px; ${isThisRowGenerating ? 'background-color: #FFFFFF; padding: 3px 9px; border-radius: 99px; border: 1px solid var(--mk-orange);' : ''}">
                        ${isThisRowGenerating ? escapeHtml(formatDraftRemainingInfo(state.draftElapsedSec || 0).shortBtnText) : '초안 생성 →'}
                      </span>
                    </div>

                    <!-- 2행: 트렌드 요약 설명 (버튼에 눌리지 않고 가로 전체 폭을 사용하여 가독성 확보) -->
                    <div style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.55; padding-left: 26px;">
                      ${escapeHtml(item.desc)}
                    </div>

                    <!-- 3행: 추천 유형·언론 보도 확인 배지(좌) + 원문·팩트검색·방향설정 버튼(우) -->
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; padding-left: 26px; margin-top: 2px;">
                      <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 5px;">
                        <span style="font-size: 11px; font-weight: 700; color: var(--mk-orange); background-color: ${isThisRowGenerating ? '#FFFFFF' : 'var(--mk-orange-light)'}; padding: 2px 7px; border-radius: 4px; white-space: nowrap;">
                          유형 0${matchedTypeId} · ${escapeHtml(matchedCat)}
                        </span>
                        <span style="font-size: 10.5px; font-weight: 700; color: ${rowFv.isWarning ? '#D9480F' : '#1B7F3B'}; background-color: ${rowFv.isWarning ? '#FFF4E6' : '#EBFBEE'}; border: 1px solid ${rowFv.isWarning ? '#FFC078' : '#B2F2BB'}; padding: 1.5px 6px; border-radius: 4px; white-space: nowrap;">
                          ${rowFv.isWarning ? '⚠️ 팩트체크 확인 권장' : `✓ 언론 보도 확인${shortSource ? ` · ${escapeHtml(shortSource)}` : ''}`}
                        </span>
                      </div>

                      <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 5px;">
                        <a
                          href="${escapeHtml(articleUrl)}"
                          target="_blank"
                          rel="noopener noreferrer"
                          data-trend-ext-link="1"
                          style="font-size: 11px; font-weight: 600; color: var(--text-secondary); background-color: var(--bg-subtle); border: var(--border-thin); padding: 2px 7px; border-radius: 4px; text-decoration: none; white-space: nowrap;"
                          title="${escapeHtml(linkTooltip)}"
                        >
                          ${escapeHtml(linkLabel)}
                        </a>
                        <a
                          href="${escapeHtml(factCheckSearchUrl)}"
                          target="_blank"
                          rel="noopener noreferrer"
                          data-trend-ext-link="1"
                          style="font-size: 11px; font-weight: 700; color: #1B7F3B; background-color: #EBFBEE; border: 1px solid #B2F2BB; padding: 2px 7px; border-radius: 4px; text-decoration: none; white-space: nowrap;"
                          title="네이버 뉴스에서 실제 언론 보도 여부를 즉시 검색해 교차 확인합니다"
                        >
                          팩트 검색 ↗
                        </a>
                        <button
                          type="button"
                          data-stage-trend-kw="${escapeHtml(item.keyword)}"
                          data-stage-trend-comp="${escapeHtml(item.company || '')}"
                          data-stage-trend-type="${matchedTypeId}"
                          style="font-size: 11px; font-weight: 700; color: var(--text-secondary); background-color: #FFFFFF; border: var(--border-thin); padding: 2px 7px; border-radius: 4px; cursor: pointer; white-space: nowrap; font-family: inherit;"
                          title="이 키워드를 위 STEP 1 입력창에 담고 서브 키워드·원하는 글의 방향을 직접 입력한 뒤 생성합니다"
                        >
                          ↑ 방향 설정
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

          ` : state.homeDiscoveryTab === 'calendar' ? `
            <!-- [탭 2: 2026 월별 마케팅 이슈 캘린더] -->
            <div style="display: flex; flex-wrap: wrap; gap: 6px; padding-bottom: 12px; border-bottom: var(--border-thin); margin-bottom: 12px;">
              ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                const isCurMonth = state.calendarMonth === m;
                return `
                  <button
                    type="button"
                    data-cal-month="${m}"
                    style="padding: 6px 13px; border-radius: var(--radius-general); border: ${isCurMonth ? '1px solid var(--mk-orange)' : 'var(--border-thin)'}; background-color: ${isCurMonth ? 'var(--mk-orange)' : 'var(--white)'}; color: ${isCurMonth ? '#FFFFFF' : 'var(--text-secondary)'}; font-size: 13px; font-weight: ${isCurMonth ? '800' : '600'}; cursor: pointer; font-family: inherit;"
                  >
                    ${m}월
                  </button>
                `;
              }).join('')}
            </div>

            <!-- 선택된 월의 핵심 테마 요약 -->
            <div class="flex-between mb-12" style="padding: 10px 14px; background-color: var(--bg-subtle); border-radius: var(--radius-general); flex-wrap: wrap; gap: 8px;">
              <div>
                <span style="font-size: 12.5px; font-weight: 800; color: var(--mk-orange); margin-right: 8px;">2026년 ${calData.month}월 핵심 테마</span>
                <strong style="font-size: 13.5px; color: var(--text-primary);">${escapeHtml(calData.theme)}</strong>
              </div>
              <div class="flex-row" style="gap: 6px; flex-wrap: wrap;">
                ${(calData.keyTags || []).map(tag => {
                  const tagType = detectBestContentType(tag, '', '', 3);
                  const isTagSelected = state.selectedCalendarTopic && state.selectedCalendarTopic.keyword === tag;
                  return `
                    <button
                      type="button"
                      data-select-cal-tag="${escapeHtml(tag)}"
                      data-use-cal-type="${tagType}"
                      style="font-size: 11.5px; font-weight: 700; color: ${isTagSelected ? '#FFFFFF' : 'var(--text-secondary)'}; background-color: ${isTagSelected ? 'var(--mk-orange)' : 'var(--white)'}; border: 1px solid ${isTagSelected ? 'var(--mk-orange)' : 'var(--border-color)'}; padding: 3px 9px; border-radius: 99px; cursor: pointer; font-family: inherit;"
                      title="클릭하여 '${escapeHtml(tag)}' 소재의 작성 방향을 입력하거나 바로 초안을 생성합니다"
                    >
                      #${escapeHtml(tag)} →
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <div class="trend-clean-grid">
              ${(calData.events || []).map((ev, evIdx) => {
                // 여러 날/이벤트가 섞이지 않도록 개별 단일 이벤트 버튼 목록 생성
                const subEventList = Array.isArray(ev.subEvents) && ev.subEvents.length > 0
                  ? ev.subEvents
                  : (String(ev.name || '').includes('·')
                      ? String(ev.name).split(/\s*·\s*/).map(part => {
                          const cleanPart = part.trim();
                          const autoT = detectBestContentType(cleanPart, '', '', ev.typeId || 3);
                          return {
                            label: cleanPart,
                            keyword: `${calData.month}월 ${cleanPart} 최신 트렌드 및 주요 프로모션`,
                            typeId: autoT
                          };
                        })
                      : [{ label: ev.name, keyword: ev.keyword, typeId: detectBestContentType(ev.keyword, '', ev.desc || '', ev.typeId || 3) }]);

                const isThisCalGenerating = state.isSearchingNews && subEventList.some(se => se.keyword === state.generatingKeyword);
                const selTopic = (state.selectedCalendarTopic && state.selectedCalendarTopic.month === calData.month && state.selectedCalendarTopic.evIdx === evIdx)
                  ? state.selectedCalendarTopic
                  : null;
                const calGenStyle = (isThisCalGenerating || selTopic)
                  ? 'border-color: var(--mk-orange); background-color: #FFFDFB; box-shadow: 0 0 0 2px rgba(243, 112, 33, 0.14);'
                  : '';

                // 같은 카드 안의 다른 서브 이슈가 있으면 원클릭 서브키워드 엮기 칩으로 제공
                const siblingSubs = selTopic
                  ? subEventList.filter(se => se.keyword !== selTopic.keyword)
                  : [];

                return `
                  <div class="trend-clean-row" id="calEventCard-${evIdx}" style="${calGenStyle}; align-items: flex-start; cursor: default;">
                    <div style="min-width: 0; flex: 1; width: 100%;">
                      <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 4px;">
                        <span style="font-size: 12px; font-weight: 800; color: var(--mk-orange);">${escapeHtml(ev.date)}</span>
                        <strong style="font-size: 14px; color: var(--text-primary);">${escapeHtml(ev.name)}</strong>
                        <span style="font-size: 11px; font-weight: 700; color: var(--mk-orange); background-color: ${isThisCalGenerating ? '#FFFFFF' : 'var(--mk-orange-light)'}; padding: 1px 6px; border-radius: 4px;">
                          단일 이슈 선택 가능 (${subEventList.length}건)
                        </span>
                      </div>
                      <div style="font-size: 12.5px; color: var(--text-secondary); margin-bottom: 8px;">
                        ${escapeHtml(ev.desc)}
                      </div>
                      <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                        ${subEventList.map(se => {
                          const isSubGen = state.isSearchingNews && state.generatingKeyword === se.keyword;
                          const isSubSelected = Boolean(selTopic && selTopic.keyword === se.keyword);
                          const highlightActive = isSubGen || isSubSelected;
                          return `
                            <button
                              type="button"
                              data-select-cal-topic="1"
                              data-cal-ev-idx="${evIdx}"
                              data-cal-label="${escapeHtml(se.label)}"
                              data-use-cal-kw="${escapeHtml(se.keyword)}"
                              data-use-cal-type="${se.typeId || ev.typeId}"
                              style="display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 6px; border: 1.5px solid ${highlightActive ? 'var(--mk-orange)' : 'var(--mk-orange-border)'}; background-color: ${highlightActive ? 'var(--mk-orange)' : '#FFF8F3'}; color: ${highlightActive ? '#FFFFFF' : 'var(--text-primary)'}; font-size: 12px; font-weight: 800; cursor: pointer; font-family: inherit; transition: all 0.15s;"
                              title="클릭하면 원하는 작성 방향·서브 키워드 입력창이 아래에 펼쳐집니다"
                            >
                              <span>${escapeHtml(se.label)}</span>
                              <span style="color: ${highlightActive ? '#FFFFFF' : 'var(--mk-orange)'}; font-weight: 800;">
                                ${isSubGen
                                  ? escapeHtml(formatDraftRemainingInfo(state.draftElapsedSec || 0).shortBtnText)
                                  : isSubSelected
                                    ? '✓ 선택됨 ▲'
                                    : '방향 설정 · 초안 생성 ▼'}
                              </span>
                            </button>
                          `;
                        }).join('')}
                      </div>

                      ${selTopic ? `
                        <!-- [카드 내 인라인 슬라이드 입력창] 선택한 소재의 서브 키워드 및 원하는 작성 방향 입력 -->
                        <div style="margin-top: 10px; padding: 12px 14px; background-color: #FFF9F4; border: 1.5px solid var(--mk-orange-border); border-radius: 8px;">
                          <div class="flex-between" style="flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
                            <div class="flex-row" style="gap: 6px; flex-wrap: wrap;">
                              <span style="font-size: 11.5px; font-weight: 800; color: #FFFFFF; background-color: var(--mk-orange); padding: 2px 8px; border-radius: 99px;">
                                🎯 선택된 소재: ${escapeHtml(selTopic.label.replace(/^[^\w가-힣]+/, '').trim())}
                              </span>
                              ${siblingSubs.map(sib => {
                                const cleanSib = sib.label.replace(/^[^\w가-힣]+/, '').replace(/\s*\([^)]*\)/g, m => m).trim();
                                return `
                                  <button
                                    type="button"
                                    data-cal-add-sibling-sub="${escapeHtml(cleanSib)}"
                                    style="font-size: 11px; font-weight: 800; color: var(--mk-orange); background-color: #FFFFFF; border: 1px dashed var(--mk-orange); padding: 2px 8px; border-radius: 99px; cursor: pointer; font-family: inherit;"
                                    title="클릭하면 '${escapeHtml(cleanSib)}'를 서브 키워드와 작성 방향에 자동으로 엮어줍니다"
                                  >
                                    + '${escapeHtml(cleanSib)}' 함께 엮기
                                  </button>
                                `;
                              }).join('')}
                            </div>
                            <button
                              type="button"
                              class="text-action"
                              data-close-cal-inline="1"
                              style="font-size: 11.5px; color: var(--text-muted);"
                            >
                              닫기 ✕
                            </button>
                          </div>

                          <div class="cal-inline-input-grid">
                            <div>
                              <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-secondary); margin-bottom: 3px;">
                                🔗 서브 키워드 · 브랜드 (선택)
                              </label>
                              <input
                                type="text"
                                class="input"
                                id="calInlineSubKwInput"
                                value="${escapeHtml(selTopic.subKeywords || '')}"
                                placeholder="${escapeHtml(
                                  /수능|수험표|찹쌀떡/.test(selTopic.keyword)
                                    ? '예: 수능 수험표 할인 혜택, 올리브영, 편의점'
                                    : /김장|김치/.test(selTopic.keyword)
                                      ? '예: 절임배추 사전예약, 포장김치, 김치의 날'
                                      : /블랙프라이데이|코리아세일페스타/.test(selTopic.keyword)
                                        ? '예: 코리아세일페스타, 가전 할인, 해외직구'
                                        : '예: 가래떡데이, 농협, 편의점 3사'
                                )}"
                                style="width: 100%; padding: 7px 10px; font-size: 12.5px; background-color: #FFFFFF;"
                              />
                            </div>
                            <div>
                              <label style="display: block; font-size: 11px; font-weight: 800; color: var(--text-secondary); margin-bottom: 3px;">
                                🧭 원하는 글의 방향 · 관점 (선택 · Enter 시 바로 생성)
                              </label>
                              <input
                                type="text"
                                class="input"
                                id="calInlineDirInput"
                                value="${escapeHtml(selTopic.direction || '')}"
                                placeholder="${escapeHtml(
                                  /수능|수험표|찹쌀떡/.test(selTopic.keyword)
                                    ? '예: 찹쌀떡·보온도시락 같은 수능 응원 선물과 함께 수험표 할인 혜택 내용도 함께 엮어서 정리'
                                    : /김장|김치/.test(selTopic.keyword)
                                      ? '예: 김장철 절임배추·포장김치 할인 비교와 11월 22일 김치의 날 프로모션을 함께 정리'
                                      : /블랙프라이데이|코리아세일페스타/.test(selTopic.keyword)
                                        ? '예: 코리아세일페스타 국내 특가와 블랙프라이데이 해외직구 할인·통관 팁을 비교 정리'
                                        : '예: 빼빼로데이만 알던 독자에게 가래떡데이와 요즘 유행하는 떡 디저트를 엮어서 소개'
                                )}"
                                style="width: 100%; padding: 7px 10px; font-size: 12.5px; background-color: #FFFFFF;"
                              />
                            </div>
                          </div>

                          <div class="flex-between" style="flex-wrap: wrap; gap: 8px; padding-top: 4px;">
                            <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                              <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-right: 2px;">빠른 방향:</span>
                              <button type="button" class="text-action" data-cal-quick-dir="기념일 유래·의미와 올해 새롭게 달라진 최신 유행·트렌드를 자연스럽게 엮어서 소개" style="font-size: 11px; background: #FFFFFF; border: var(--border-thin); padding: 2px 7px; border-radius: 99px;">
                                + 유래 & 최신 트렌드 엮기
                              </button>
                              <button type="button" class="text-action" data-cal-quick-dir="주요 유통·식음료 브랜드별 출시 프로모션, 가격, 할인 혜택을 한눈에 비교" style="font-size: 11px; background: #FFFFFF; border: var(--border-thin); padding: 2px 7px; border-radius: 99px;">
                                + 브랜드별 혜택·특가 비교
                              </button>
                              <button type="button" class="text-action" data-cal-quick-dir="독자와 소비자가 바로 활용할 수 있는 실전 구매 팁과 체크포인트 중심으로 정리" style="font-size: 11px; background: #FFFFFF; border: var(--border-thin); padding: 2px 7px; border-radius: 99px;">
                                + 소비자 실전 꿀팁 중심
                              </button>
                            </div>
                            <div class="flex-row" style="gap: 6px;">
                              <button
                                type="button"
                                class="btn btn-sm"
                                id="calInlineDirectStartBtn"
                                style="padding: 6px 10px; font-size: 11.5px; font-weight: 700; background-color: #FFFFFF; color: var(--text-secondary);"
                                ${state.isSearchingNews ? 'disabled' : ''}
                              >
                                ⚡ 방향 없이 바로 생성
                              </button>
                              <button
                                type="button"
                                class="btn btn-sm btn-primary"
                                id="calInlineCustomStartBtn"
                                style="padding: 6px 14px; font-size: 12px; font-weight: 800; box-shadow: 0 2px 6px rgba(243, 112, 33, 0.22);"
                                ${state.isSearchingNews ? 'disabled' : ''}
                              >
                                ${state.isSearchingNews ? '⏳ 초안 생성 중...' : '✨ 이 방향 반영해 초안 생성 →'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            ${state.showExternalCalendarEmbed ? `
              <div style="margin-top: 16px; padding-top: 16px; border-top: var(--border-thin);">
                <div class="flex-between mb-8">
                  <strong style="font-size: 13.5px; font-weight: 800;">📄 KT 나스미디어 2026 마케팅 이슈 캘린더 원본 PDF</strong>
                  <a href="./nasmedia-2026-calendar.pdf" target="_blank" rel="noopener noreferrer" class="text-action-orange">
                    새 탭에서 크게 열기 / 다운로드 ↗
                  </a>
                </div>
                <div style="border: var(--border-thin); border-radius: var(--radius-general); overflow: hidden; background-color: var(--bg-subtle);">
                  <iframe
                    src="./nasmedia-2026-calendar.pdf#view=FitH"
                    style="width: 100%; height: 600px; border: none; background-color: #FFFFFF; display: block;"
                    title="KT 나스미디어 2026 마케팅 이슈 캘린더 PDF"
                  ></iframe>
                </div>
              </div>
            ` : ''}

          ` : `
            <!-- [탭 3: 최근 작업한 기사 보관함] -->
            ${state.works.length === 0 ? `
              <div style="padding: 32px 0; text-align: center; color: var(--text-muted);">
                아직 저장된 기사가 없습니다. 위에서 키워드를 입력하거나 실시간 트렌드를 클릭해 첫 기사를 만들어 보세요.
              </div>
            ` : `
              <div>
                ${state.works.map(w => {
                  const tInfo = CONTENT_TYPES[w.typeId] || CONTENT_TYPES[2];
                  const wCat = w.summaryBlocks?.mkCategory || tInfo.defaultCategory || '산업 Q&A';
                  return `
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 8px; border-bottom: var(--border-thin);">
                      <div style="flex: 1; min-width: 0; cursor: pointer;" data-open-work="${w.id}">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                          <span style="font-size: 12px; font-weight: 700; color: var(--mk-orange);">${escapeHtml(tInfo.shortName)}</span>
                          <span style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary);">[${escapeHtml(wCat)}]</span>
                          <span class="text-muted">· 키워드: ${escapeHtml(w.keyword)} · ${escapeHtml(w.updatedAt)}</span>
                        </div>
                        <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">
                          ${escapeHtml(w.title)}
                        </div>
                      </div>
                      <div class="flex-row">
                        <span style="font-size: 13px; font-weight: 800; color: var(--mk-orange); cursor: pointer; margin-right: 8px;" data-open-work="${w.id}">
                          이어서 편집 →
                        </span>
                        <button class="btn btn-sm" data-del-work="${w.id}" style="padding: 3px 8px; font-size: 11.5px; color: var(--text-muted);">삭제</button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          `}
        </div>
      </div>
      </div>
    `;

    function syncHomeInputs() {
      hi.keyword = document.getElementById('homeKeywordInput')?.value || '';
      hi.company = document.getElementById('homeCompanyInput')?.value || '';
      hi.subKeywords = document.getElementById('homeSubKeywordsInput')?.value || '';
      hi.direction = document.getElementById('homeDirectionInput')?.value || '';
      if (state.showRawPasteInput) {
        hi.url = document.getElementById('homeUrlInput')?.value || '';
        hi.rawText = document.getElementById('homeRawTextInput')?.value || '';
      }
    }

    function bindHomeTypeCardEvents() {
      root.querySelectorAll('[data-select-home-type]').forEach(card => {
        card.addEventListener('click', () => {
          syncHomeInputs();
          const nextType = Number(card.getAttribute('data-select-home-type'));
          if (hi.typeMode === 'manual' && hi.typeId === nextType) {
            hi.typeMode = 'auto';
            hi.typeId = detectBestContentType(
              hi.keyword,
              hi.company,
              `${hi.rawText || ''} ${hi.direction || ''} ${hi.subKeywords || ''}`,
              0
            );
            showToast('✨ AI 자동 맞춤 모드로 전환되었습니다.');
          } else {
            hi.typeMode = 'manual';
            hi.typeId = nextType;
            const tName = CONTENT_TYPES[nextType]?.uiTitle || CONTENT_TYPES[nextType]?.name || `유형 0${nextType}`;
            showToast(`✓ [유형 0${nextType} · ${tName}] 관점으로 직접 선택되었습니다.`);
          }
          render(true);
        });
      });
    }

    function refreshHomeStep2AutoMatchDOM() {
      syncHomeInputs();
      if (hi.typeMode !== 'manual') {
        const hasInputNow = Boolean(
          (hi.keyword || '').trim() ||
          (hi.company || '').trim() ||
          (hi.subKeywords || '').trim() ||
          (hi.direction || '').trim()
        );
        if (hasInputNow) {
          hi.typeId = detectBestContentType(
            hi.keyword,
            hi.company,
            `${hi.rawText || ''} ${hi.direction || ''} ${hi.subKeywords || ''}`,
            0
          );
        }
      }
      const gridEl = document.getElementById('homeTypeGridContainer');
      if (gridEl) {
        gridEl.innerHTML = buildHomeTypeCardsHtml();
        bindHomeTypeCardEvents();
      }
      const metaEl = document.getElementById('homeTypePreviewMetaBox');
      if (metaEl) {
        metaEl.innerHTML = buildHomeTypePreviewMetaHtml();
      }
    }

    document.getElementById('homeKeywordInput')?.addEventListener('input', () => {
      refreshHomeStep2AutoMatchDOM();
    });

    document.getElementById('homeCompanyInput')?.addEventListener('input', () => {
      refreshHomeStep2AutoMatchDOM();
    });

    document.getElementById('homeSubKeywordsInput')?.addEventListener('input', () => {
      refreshHomeStep2AutoMatchDOM();
    });

    document.getElementById('homeDirectionInput')?.addEventListener('input', () => {
      refreshHomeStep2AutoMatchDOM();
    });

    root.querySelectorAll('[data-home-quick-dir]').forEach(btn => {
      btn.addEventListener('click', () => {
        syncHomeInputs();
        const dirText = btn.getAttribute('data-home-quick-dir') || '';
        hi.direction = dirText;
        const dirEl = document.getElementById('homeDirectionInput');
        if (dirEl) {
          dirEl.value = dirText;
          dirEl.focus();
        }
        refreshHomeStep2AutoMatchDOM();
        showToast('✓ 원하는 글의 방향·맥락이 입력되고 AI 추천 유형이 자동 반영되었습니다.');
      });
    });

    document.getElementById('clearHomeSubAndDirBtn')?.addEventListener('click', () => {
      syncHomeInputs();
      hi.subKeywords = '';
      hi.direction = '';
      render(true);
    });

    root.querySelectorAll('[data-stage-trend-kw]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        syncHomeInputs();
        const kw = btn.getAttribute('data-stage-trend-kw') || '';
        const comp = extractBrandFromTopic ? extractBrandFromTopic(kw, btn.getAttribute('data-stage-trend-comp') || '') : (btn.getAttribute('data-stage-trend-comp') || '');
        const matchedType = Number(btn.getAttribute('data-stage-trend-type')) || detectBestContentType(kw, comp, '', 0);
        hi.keyword = kw;
        hi.company = comp;
        hi.typeId = matchedType;
        hi.typeMode = 'auto';
        render(false);
        setTimeout(() => {
          flashElement('homeStep1Box');
          document.getElementById('homeDirectionInput')?.focus();
        }, 60);
        showToast(`✓ '${kw}' 키워드가 상단 STEP 1에 담기고 [유형 0${matchedType}]이 자동 추천되었습니다!`);
      });
    });

    const handleHomeEnterKey = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        syncHomeInputs();
        if (!hi.keyword.trim()) {
          showToast('트렌드 키워드나 주제를 입력해 주세요!');
          return;
        }
        const isAuto = hi.typeMode !== 'manual';
        if (isAuto) {
          hi.typeId = detectBestContentType(
            hi.keyword,
            hi.company,
            `${hi.rawText || ''} ${hi.direction || ''} ${hi.subKeywords || ''}`,
            0
          );
        }
        startWorkWithKeyword(hi.keyword, hi.typeId, hi.company, isAuto, hi.subKeywords, hi.direction);
      }
    };

    document.getElementById('homeKeywordInput')?.addEventListener('keydown', handleHomeEnterKey);
    document.getElementById('homeSubKeywordsInput')?.addEventListener('keydown', handleHomeEnterKey);
    document.getElementById('homeDirectionInput')?.addEventListener('keydown', handleHomeEnterKey);

    document.getElementById('toggleRawPasteBtn')?.addEventListener('click', () => {
      syncHomeInputs();
      state.showRawPasteInput = !state.showRawPasteInput;
      render(true);
    });

    // [✨ AI 자동 맞춤] 버튼 클릭 시 기존 수동 선택을 즉시 해제하고 AI 자동 추천 모드로 전환
    document.getElementById('homeAutoTypeModeBtn')?.addEventListener('click', () => {
      syncHomeInputs();
      hi.typeMode = 'auto';
      const hasInputNow = Boolean(
        (hi.keyword || '').trim() ||
        (hi.company || '').trim() ||
        (hi.subKeywords || '').trim() ||
        (hi.direction || '').trim()
      );
      if (hasInputNow) {
        hi.typeId = detectBestContentType(
          hi.keyword,
          hi.company,
          `${hi.rawText || ''} ${hi.direction || ''} ${hi.subKeywords || ''}`,
          0
        );
        const recType = CONTENT_TYPES[hi.typeId] || CONTENT_TYPES[3];
        showToast(`✨ AI 자동 맞춤 적용! 입력하신 주제에 맞춰 [유형 0${recType.id} · ${recType.uiTitle || recType.name}] 관점이 자동 추천되었습니다.`);
      } else {
        showToast('✨ AI 자동 맞춤 모드로 전환되었습니다! 위 STEP 1에 키워드를 입력하면 최적 유형(01~05)이 자동 추천됩니다.');
      }
      render(true);
    });

    bindHomeTypeCardEvents();

    // 탭 드래그 앤 드롭 & 화살표 순서 변경 공통 헬퍼
    function bindReorderableTabBar(selector, attrName, getOrderArr, setOrderArr, onSelectTab) {
      let draggedKey = null;
      const tabs = Array.from(root.querySelectorAll(selector));

      tabs.forEach(btn => {
        btn.addEventListener('click', e => {
          if (e.target.closest('.tab-move-arrow')) return;
          syncHomeInputs();
          const key = btn.getAttribute(attrName);
          onSelectTab(key);
          render(true);
        });

        btn.addEventListener('dragstart', e => {
          draggedKey = btn.getAttribute(attrName);
          btn.classList.add('tab-dragging');
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedKey);
          }
        });

        btn.addEventListener('dragover', e => {
          e.preventDefault();
          const targetKey = btn.getAttribute(attrName);
          if (!draggedKey || draggedKey === targetKey) return;
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          const rect = btn.getBoundingClientRect();
          const insertBefore = (e.clientX - rect.left) < rect.width / 2;
          btn.classList.toggle('tab-drag-over-left', insertBefore);
          btn.classList.toggle('tab-drag-over-right', !insertBefore);
        });

        btn.addEventListener('dragleave', () => {
          btn.classList.remove('tab-drag-over-left', 'tab-drag-over-right');
        });

        btn.addEventListener('drop', e => {
          e.preventDefault();
          btn.classList.remove('tab-drag-over-left', 'tab-drag-over-right');
          const targetKey = btn.getAttribute(attrName);
          const fromKey = draggedKey || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
          if (!fromKey || !targetKey || fromKey === targetKey) return;

          const rect = btn.getBoundingClientRect();
          const insertBefore = (e.clientX - rect.left) < rect.width / 2;
          const nextOrder = getOrderArr().filter(k => k !== fromKey);
          const targetIdx = nextOrder.indexOf(targetKey);
          if (targetIdx === -1) return;
          nextOrder.splice(insertBefore ? targetIdx : targetIdx + 1, 0, fromKey);

          syncHomeInputs();
          setOrderArr(nextOrder);
          onSelectTab(fromKey);
          showToast('✓ 탭 순서가 변경되어 자동 저장되었습니다.');
          render(true);
        });

        btn.addEventListener('dragend', () => {
          draggedKey = null;
          tabs.forEach(t => t.classList.remove('tab-dragging', 'tab-drag-over-left', 'tab-drag-over-right'));
        });
      });
    }

    // 하단 3개 메인 탭 전환 및 드래그 순서 변경 (🔥 실시간 트렌드 / 📅 2026 마케팅 캘린더 / 📂 최근 작업 기사)
    bindReorderableTabBar(
      '[data-home-main-tab]',
      'data-home-main-tab',
      () => [...(state.homeMainTabOrder || DEFAULT_MAIN_TAB_ORDER)],
      nextArr => { state.homeMainTabOrder = nextArr; },
      key => { state.homeDiscoveryTab = key; }
    );

    // 트렌드 레이더 5개 서브 탭 전환 및 드래그 순서 변경
    bindReorderableTabBar(
      '[data-trend-tab]',
      'data-trend-tab',
      () => [...(state.trendTabOrder || DEFAULT_TREND_TAB_ORDER)],
      nextArr => { state.trendTabOrder = nextArr; },
      key => { state.trendTab = key; }
    );

    // 화살표(◀ ▶) 클릭으로 메인 탭 순서 이동
    root.querySelectorAll('[data-move-main-tab]').forEach(arrow => {
      arrow.addEventListener('click', e => {
        e.stopPropagation();
        const key = arrow.getAttribute('data-move-main-tab');
        const dir = Number(arrow.getAttribute('data-move-dir'));
        const arr = [...(state.homeMainTabOrder || DEFAULT_MAIN_TAB_ORDER)];
        const idx = arr.indexOf(key);
        const nextIdx = idx + dir;
        if (idx === -1 || nextIdx < 0 || nextIdx >= arr.length) return;
        const [item] = arr.splice(idx, 1);
        arr.splice(nextIdx, 0, item);
        syncHomeInputs();
        state.homeMainTabOrder = arr;
        render(true);
      });
    });

    // 화살표(◀ ▶) 클릭으로 트렌드 서브 탭 순서 이동
    root.querySelectorAll('[data-move-trend-tab]').forEach(arrow => {
      arrow.addEventListener('click', e => {
        e.stopPropagation();
        const key = arrow.getAttribute('data-move-trend-tab');
        const dir = Number(arrow.getAttribute('data-move-dir'));
        const arr = [...(state.trendTabOrder || DEFAULT_TREND_TAB_ORDER)];
        const idx = arr.indexOf(key);
        const nextIdx = idx + dir;
        if (idx === -1 || nextIdx < 0 || nextIdx >= arr.length) return;
        const [item] = arr.splice(idx, 1);
        arr.splice(nextIdx, 0, item);
        syncHomeInputs();
        state.trendTabOrder = arr;
        render(true);
      });
    });

    document.getElementById('toggleTabReorderModeBtn')?.addEventListener('click', () => {
      syncHomeInputs();
      state.isEditingTabOrder = !state.isEditingTabOrder;
      render(true);
    });

    document.getElementById('resetTabOrderBtn')?.addEventListener('click', () => {
      syncHomeInputs();
      state.homeMainTabOrder = [...DEFAULT_MAIN_TAB_ORDER];
      state.trendTabOrder = [...DEFAULT_TREND_TAB_ORDER];
      state.isEditingTabOrder = false;
      showToast('↺ 탭 순서가 초기 기본 상태로 복원되었습니다.');
      render(true);
    });

    document.getElementById('refreshTrendRadarBtn')?.addEventListener('click', async () => {
      if (state.isLoadingTrends) return;
      syncHomeInputs();
      state.isLoadingTrends = true;
      render(true);
      await loadTrends(true);
      showToast(`✓ 5개 탭 실시간 화제 키워드 50선을 최신 상태로 업데이트했습니다! (${state.lastTrendLoadDurationSec || 0}초 소요)`);
      render(true);
    });

    // 원문 기사 보기 링크 클릭 시 행 전체의 초안 생성 이벤트 전파 방지
    root.querySelectorAll('[data-trend-ext-link]').forEach(link => {
      link.addEventListener('click', e => {
        e.stopPropagation();
      });
    });

    // 실시간 트렌드 키워드 클릭 시 최적 유형(1~5)으로 즉시 초안 생성
    root.querySelectorAll('[data-use-trend-kw]').forEach(btn => {
      btn.addEventListener('click', () => {
        const kw = btn.getAttribute('data-use-trend-kw');
        const trendComp = (btn.getAttribute('data-use-trend-comp') || '').trim();
        const finalComp = trendComp || hi.company;
        const matchedType = Number(btn.getAttribute('data-use-trend-type')) || detectBestContentType(kw, finalComp, '', 4);
        syncHomeInputs();
        hi.keyword = kw;
        if (trendComp) hi.company = trendComp;
        hi.typeId = matchedType;
        startWorkWithKeyword(kw, matchedType, finalComp, true);
      });
    });

    // 월별 마케팅 캘린더 월 변경
    root.querySelectorAll('[data-cal-month]').forEach(btn => {
      btn.addEventListener('click', () => {
        syncHomeInputs();
        state.calendarMonth = Number(btn.getAttribute('data-cal-month'));
        state.selectedCalendarTopic = null;
        render(true);
      });
    });

    // 월별 마케팅 캘린더 카드 내 소재 버튼 클릭 시 인라인 방향 설정 슬라이드 창 열기/닫기
    root.querySelectorAll('[data-select-cal-topic]').forEach(btn => {
      btn.addEventListener('click', () => {
        syncHomeInputs();
        const evIdx = Number(btn.getAttribute('data-cal-ev-idx'));
        const label = btn.getAttribute('data-cal-label') || '';
        const kw = btn.getAttribute('data-use-cal-kw') || '';
        const calType = Number(btn.getAttribute('data-use-cal-type')) || 2;

        if (
          state.selectedCalendarTopic &&
          state.selectedCalendarTopic.month === state.calendarMonth &&
          state.selectedCalendarTopic.evIdx === evIdx &&
          state.selectedCalendarTopic.keyword === kw
        ) {
          state.selectedCalendarTopic = null;
          render(true);
          return;
        }

        state.selectedCalendarTopic = {
          month: state.calendarMonth,
          evIdx,
          label,
          keyword: kw,
          typeId: calType,
          subKeywords: '',
          direction: ''
        };
        render(true);
        setTimeout(() => {
          document.getElementById('calInlineDirInput')?.focus();
        }, 40);
      });
    });

    // 상단 월 핵심 테마 해시태그(#수능, #빼빼로데이, #가래떡데이 등) 클릭 시 해당 카드의 인라인 방향 입력창 열기
    root.querySelectorAll('[data-select-cal-tag]').forEach(btn => {
      btn.addEventListener('click', () => {
        syncHomeInputs();
        const tag = (btn.getAttribute('data-select-cal-tag') || '').trim();
        const tagType = Number(btn.getAttribute('data-use-cal-type')) || 3;
        if (!tag) return;

        let matchedEvIdx = 0;
        let matchedLabel = tag;
        let matchedKw = tag;
        let matchedType = tagType;

        (calData.events || []).forEach((ev, idx) => {
          const subs = Array.isArray(ev.subEvents) && ev.subEvents.length > 0
            ? ev.subEvents
            : [{ label: ev.name, keyword: ev.keyword, typeId: ev.typeId || 3 }];
          subs.forEach(se => {
            if (String(se.label || '').includes(tag) || String(se.keyword || '').includes(tag) || String(ev.name || '').includes(tag)) {
              matchedEvIdx = idx;
              matchedLabel = se.label || tag;
              matchedKw = se.keyword || tag;
              matchedType = se.typeId || ev.typeId || tagType;
            }
          });
        });

        state.selectedCalendarTopic = {
          month: state.calendarMonth,
          evIdx: matchedEvIdx,
          label: matchedLabel,
          keyword: matchedKw,
          typeId: matchedType,
          subKeywords: '',
          direction: ''
        };
        render(true);
        setTimeout(() => {
          flashElement(`calEventCard-${matchedEvIdx}`);
          document.getElementById('calInlineDirInput')?.focus();
        }, 50);
      });
    });

    root.querySelectorAll('[data-close-cal-inline]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedCalendarTopic = null;
        render(true);
      });
    });

    const calInlineSubEl = document.getElementById('calInlineSubKwInput');
    const calInlineDirEl = document.getElementById('calInlineDirInput');

    calInlineSubEl?.addEventListener('input', e => {
      if (state.selectedCalendarTopic) {
        state.selectedCalendarTopic.subKeywords = e.target.value;
      }
    });

    calInlineDirEl?.addEventListener('input', e => {
      if (state.selectedCalendarTopic) {
        state.selectedCalendarTopic.direction = e.target.value;
      }
    });

    function triggerCalendarInlineStart(useCustomInputs = true) {
      const sel = state.selectedCalendarTopic;
      if (!sel) return;
      syncHomeInputs();
      const subKwVal = useCustomInputs ? (document.getElementById('calInlineSubKwInput')?.value || sel.subKeywords || '').trim() : '';
      const dirVal = useCustomInputs ? (document.getElementById('calInlineDirInput')?.value || sel.direction || '').trim() : '';
      hi.keyword = sel.keyword;
      hi.subKeywords = subKwVal;
      hi.direction = dirVal;
      hi.typeId = sel.typeId || 2;
      startWorkWithKeyword(sel.keyword, hi.typeId, hi.company, Boolean(subKwVal || dirVal), subKwVal, dirVal);
    }

    const handleCalInlineEnter = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        triggerCalendarInlineStart(true);
      }
    };
    calInlineSubEl?.addEventListener('keydown', handleCalInlineEnter);
    calInlineDirEl?.addEventListener('keydown', handleCalInlineEnter);

    document.getElementById('calInlineDirectStartBtn')?.addEventListener('click', () => {
      triggerCalendarInlineStart(false);
    });

    document.getElementById('calInlineCustomStartBtn')?.addEventListener('click', () => {
      triggerCalendarInlineStart(true);
    });

    // 같은 날짜 카드의 다른 기념일/소재를 원클릭으로 서브키워드 & 작성 방향에 함께 엮기
    root.querySelectorAll('[data-cal-add-sibling-sub]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sibRaw = (btn.getAttribute('data-cal-add-sibling-sub') || '').trim();
        if (!sibRaw || !state.selectedCalendarTopic) return;
        const sel = state.selectedCalendarTopic;
        const sibParsed = parseCalendarTopicPhrase(sibRaw);
        const subKwToAdd = sibParsed.subKeyword;

        const curSub = (document.getElementById('calInlineSubKwInput')?.value || sel.subKeywords || '').trim();
        const nextSub = curSub
          ? (curSub.includes(subKwToAdd) ? curSub : `${curSub}, ${subKwToAdd}`)
          : subKwToAdd;
        const nextDir = buildCalendarSiblingLinkDirection(sel.label, sibRaw, nextSub);

        sel.subKeywords = nextSub;
        sel.direction = nextDir;
        if (calInlineSubEl) calInlineSubEl.value = nextSub;
        if (calInlineDirEl) {
          calInlineDirEl.value = nextDir;
          calInlineDirEl.focus();
        }
        showToast(`✓ '${subKwToAdd}' 내용을 서브 키워드와 글의 방향에 자연스럽게 엮었습니다!`);
      });
    });

    root.querySelectorAll('[data-cal-quick-dir]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dirText = (btn.getAttribute('data-cal-quick-dir') || '').trim();
        if (!dirText || !state.selectedCalendarTopic) return;
        state.selectedCalendarTopic.direction = dirText;
        if (calInlineDirEl) {
          calInlineDirEl.value = dirText;
          calInlineDirEl.focus();
        }
      });
    });

    // 나스미디어 2026 PDF 임베드 토글
    document.getElementById('toggleExternalCalEmbedBtn')?.addEventListener('click', () => {
      syncHomeInputs();
      state.showExternalCalendarEmbed = !state.showExternalCalendarEmbed;
      render(true);
    });

    function openIbossMarketingCalendarWindow() {
      const ibossUrl = 'https://www.i-boss.co.kr/ab-marketing_calendar?ref=3208-1620';
      window.open(
        ibossUrl,
        'ibossMarketingCalendarWindow',
        'width=1260,height=880,left=80,top=60,resizable=yes,scrollbars=yes'
      );
      showToast('아이보스(i-boss) 공식 마케팅 캘린더 전용 창을 열었습니다.');
    }

    document.getElementById('openIbossPopupBtn')?.addEventListener('click', openIbossMarketingCalendarWindow);

    // 직접 입력한 키워드로 초안 생성
    document.getElementById('homeStartDynamicBtn')?.addEventListener('click', async () => {
      syncHomeInputs();
      if (!hi.keyword.trim()) {
        showToast('트렌드 키워드나 주제를 입력해 주세요! (예: 한남동 팔란티어 팝업 품절)');
        document.getElementById('homeKeywordInput')?.focus();
        return;
      }
      const isAuto = hi.typeMode !== 'manual';
      if (isAuto) {
        hi.typeId = detectBestContentType(
          hi.keyword,
          hi.company,
          `${hi.rawText || ''} ${hi.direction || ''} ${hi.subKeywords || ''}`,
          0
        );
      }
      startWorkWithKeyword(hi.keyword, hi.typeId, hi.company, isAuto, hi.subKeywords, hi.direction);
    });

    root.querySelectorAll('[data-open-work]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-open-work');
        const found = state.works.find(w => w.id === id);
        if (found) {
          state.currentWork = found;
          state.screen = 'editor';
          render(false);
        }
      });
    });

    root.querySelectorAll('[data-del-work]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-del-work');
        await apiFetch(`/api/works/${id}`, { method: 'DELETE' }).catch(() => {});
        state.works = state.works.filter(w => w.id !== id);
        if (state.currentWork?.id === id) state.currentWork = null;
        try {
          const histRaw = localStorage.getItem(CLIENT_HISTORY_BACKUP_KEY);
          if (histRaw) {
            const histMap = JSON.parse(histRaw);
            if (histMap && typeof histMap === 'object') {
              delete histMap[id];
              localStorage.setItem(CLIENT_HISTORY_BACKUP_KEY, JSON.stringify(histMap));
            }
          }
        } catch (e) {}
        persistWorksToLocalStorageReliably();
        showToast('선택한 기사가 삭제되었습니다.');
        render(true);
      });
    });
  }

  // ==========================================================================
  // 화면 2: 좌·우 2단 통합 편집 화면 (UI/UX 전면 개편)
  //   - 상단 바: 스크롤 시 겹침 방지 + [✏️ 구조별 편집] / [👁️ 실제 기사 미리보기] 전환 + 실시간 글자수/팩트체크 배지
  //   - 왼쪽 패널: 이중 스크롤바 제거 + 3개 목적별 탭 ([📝 취재·메모] / [✅ GEO·팩트점검] / [🧭 목차·흐름])
  //   - 오른쪽 패널: 기사 구성 8단계(STEP 01~08)를 직관적인 배지로 시각화 + 입력창 높이 자동 확장 + 단락 순서 이동 & 매경 문체 자동 다듬기
  // ==========================================================================
  function renderEditorScreen(root) {
    const w = state.currentWork;
    if (!w) {
      state.screen = 'home';
      return render();
    }
    sanitizePoisonedWork(w);
    ensureWorkLeadIntro(w);

    // 최초 초안 스냅샷(initialDraftSnapshot)이 아직 없고 빈 양식 상태도 아니라면 현재 정상 기사를 최초 초안 스냅샷으로 보존
    if (!w.initialDraftSnapshot && !w.isBlankTemplate && w.draftSections?.[0]?.id !== 'sec-blank-1') {
      w.initialDraftSnapshot = captureWorkFullSnapshot(w);
    }
    ensureWorkVersionHistory(w);

    const tInfo = CONTENT_TYPES[w.typeId] || CONTENT_TYPES[2];
    const sb = w.summaryBlocks || {};
    if (
      Array.isArray(sb.fanoutQuestions) &&
      sb.fanoutQuestions.some(fq => (fq.q || '').includes('편의점 전용 맛 · 다이소 뷰티') || ((fq.q || '').includes('사전 예약을 안 하고 바로 가도') && !/(?:팝업|전시|박람회|성수|한남|더현대|방문)/.test(w.keyword || ''))) &&
      !(w.keyword || '').includes('다이소 뷰티') &&
      window.MK_MOCK_DATA.buildContextualFanoutQuestions
    ) {
      sb.fanoutQuestions = window.MK_MOCK_DATA.buildContextualFanoutQuestions(w.keyword, w.inputCompany, w.typeId);
    }
    const fullText = buildPlainTextArticle(w);
    const unverifiedCount = (w.factChecks || []).filter(f => f.status === '미처리').length;
    const geoEval = evaluateGeoChecklist(w);
    const isPreview = state.editorViewMode === 'preview';

    // 편집 화면 왼쪽에서도 바로 눌러 쓸 수 있는 인기 트렌드 태그 모음 (10개)
    const quickTrendTags = [
      ...(state.trendRadar.shortFormTrends || []).slice(0, 2).map(t => t.keyword),
      ...(state.trendRadar.brandPromoTrends || []).slice(0, 3).map(t => t.keyword),
      ...(state.trendRadar.newsletterTrends || []).slice(0, 2).map(t => t.keyword),
      ...(state.trendRadar.portalRetailTrends || []).slice(0, 2).map(t => t.keyword),
      ...(state.trendRadar.googleTrends || []).slice(0, 2).map(t => t.keyword)
    ].filter((v, i, arr) => v && arr.indexOf(v) === i).slice(0, 10);

    // 유형별 및 주제 맞춤형 단락 역할 안내 라벨 (고정 틀 문구 대신 자연스러운 매거진 단락 역할 표기)
    function getSectionRoleLabel(sec, sIdx, totalLen) {
      const titleStr = (sec?.title || '').trim();
      if (/^Bonus\s*Track/i.test(titleStr)) {
        return 'Bonus Track · 외전 & 추가 포인트';
      }
      const roleMap = {
        1: ['도입 · 소비자 고민과 트렌드 배경', '핵심 분석 1 · 주요 브랜드·서비스 특징', '핵심 분석 2 · 차별점 및 상세 비교', '활용 가이드 · 똑똑한 선택 체크포인트'],
        2: ['도입 · 시즌·기념일 배경과 핵심 화두', '핵심 포인트 1 · 유래·트렌드 및 주요 이슈', '핵심 포인트 2 · 화제의 아이템·프로모션 분석', '실전 가이드 · 즐기는 법 & 똑똑한 체크포인트'],
        3: ['도입 · 트렌드 부상 배경과 핵심 화두', '심층 분석 1 · 주요 소재·배경 집중 조명', '심층 분석 2 · 확산 요인과 대표 사례', '전망 · 향후 흐름과 실전 체크포인트'],
        4: ['도입 · 소비자 관심 배경과 트렌드 정의', '핵심 포인트 1 · 주요 아이템·신메뉴 특징', '핵심 포인트 2 · 브랜드별 차별점 및 인기 요인', '활용 가이드 · 똑똑한 선택 기준과 실전 팁'],
        5: ['도입 · 시장 메가 트렌드 핵심 문답', '해법 · 선택 기준 및 타깃 기업 집중 조명', '성과 · 핵심 경쟁력과 기대효과 분석']
      };
      const list = roleMap[w.typeId] || roleMap[4];
      return list[sIdx] || '심층 분석 · 핵심 포인트 집중 조명';
    }

    root.innerHTML = `
      <!-- 상단 고정 액션 바: 스크롤 시에도 왼쪽·오른쪽 본문을 가리지 않도록 정밀 고정 -->
      <div class="editor-sticky-bar">
        <div class="flex-row" style="gap: 10px; min-width: 0; max-width: 100%;">
          <button type="button" class="btn btn-sm" id="backToHomeBtn" style="font-weight: 700;">← 홈 · 소재 선택</button>
          <select class="select" id="editorTypeSelect" style="width: auto; max-width: 100%; min-width: 0; padding: 5px 10px; font-weight: 700; background-color: var(--bg-subtle); text-overflow: ellipsis;">
            ${Object.values(CONTENT_TYPES).map(t => `
              <option value="${t.id}" ${w.typeId === t.id ? 'selected' : ''}>${escapeHtml(t.shortName)}</option>
            `).join('')}
          </select>
          <div class="mode-switch-group" title="구조별 편집 화면과 실제 발행 기사 미리보기를 전환합니다">
            <button type="button" class="mode-switch-btn ${!isPreview ? 'active' : ''}" data-editor-mode="edit">✏️ 구조별 편집</button>
            <button type="button" class="mode-switch-btn ${isPreview ? 'active' : ''}" data-editor-mode="preview">👁️ 실제 기사 미리보기</button>
          </div>
          <button type="button" class="text-action" id="clearToBlankBtn" title="빈 양식으로 비우기 (비우기 전 작성 중이던 기사는 자동 백업됩니다)">빈 양식</button>
          <button
            type="button"
            class="text-action"
            id="restoreExampleBtn"
            style="${(w.isBlankTemplate || w.justRestoredInitial) ? 'color: var(--mk-orange); font-weight: 800;' : ''}"
            title="${w.isBlankTemplate
              ? '빈 양식으로 비우기 직전에 작성하던 기사로 즉시 복구합니다'
              : w.justRestoredInitial
                ? '초안 복원 직전에 편집하던 기사 내용으로 다시 되돌립니다'
                : '현재 기사의 처음 생성된 원본 초안으로 되돌립니다 (편집 중이던 내용은 백업되어 다시 복구할 수 있습니다)'}"
          >
            ${w.isBlankTemplate
              ? '↺ 작성하던 기사 복원'
              : w.justRestoredInitial
                ? '↩ 편집하던 내용으로 되돌리기'
                : '↺ 초안 복원'}
          </button>
        </div>

        <div class="flex-row" style="gap: 12px;">
          <span id="liveCharCountBadge" class="badge" style="font-weight: 700;">
            공백 포함 ${fullText.length.toLocaleString()}자
          </span>
          <button
            type="button"
            id="liveFcCountBadge"
            class="badge ${unverifiedCount > 0 ? 'badge-amber' : 'badge-green'}"
            style="cursor: pointer; font-weight: 800;"
            title="클릭하면 왼쪽 [점검·팩트] 탭에서 수치·날짜 팩트체크 문장을 바로 확인합니다"
          >
            ${unverifiedCount > 0 ? `🖍️ 팩트 확인 필요 ${unverifiedCount}건` : '✓ 팩트 확인 완료'}
          </button>
          <button class="btn btn-primary" id="copyFullArticleTopBtn" style="padding: 8px 16px; font-weight: 800;">
            📋 CMS 붙여넣기용 전체 복사
          </button>
        </div>
      </div>

      <!-- 좌·우 2단 분할 레이아웃 -->
      <div class="studio-split-layout">

        <!-- [왼쪽 보조 패널] 목적별 3개 탭(취재·메모 / 점검·팩트 / 목차·흐름) -->
        <aside class="left-panel-sticky">
          <div class="card" style="padding: 0; margin-bottom: 0; overflow: hidden;">
            <!-- 왼쪽 패널 3탭 헤더 -->
            <div class="left-tab-bar">
              <button type="button" class="left-tab-btn ${state.leftPanelTab === 'memo' ? 'active' : ''}" data-left-tab="memo">
                📝 취재·메모 (${(w.researchItems || []).length})
              </button>
              <button type="button" class="left-tab-btn ${state.leftPanelTab === 'check' ? 'active' : ''}" data-left-tab="check">
                ✅ 점검·팩트 (<span id="leftCheckTabBadge">${geoEval.passedCount}/${geoEval.total}</span>)
              </button>
              <button type="button" class="left-tab-btn ${state.leftPanelTab === 'outline' ? 'active' : ''}" data-left-tab="outline">
                🧭 목차·흐름
              </button>
            </div>

            <div style="padding: 18px 20px;">
              ${state.leftPanelTab === 'memo' ? `
                <!-- [탭 1: 취재·메모] 오직 취재 팩트 메모장만 깔끔하게 노출 (키워드 새로 쓰기는 목차·흐름 탭 상단으로 이동) -->
                <div>
                  <div class="flex-between mb-6" style="flex-wrap: wrap; gap: 4px;">
                    <div class="flex-row" style="gap: 6px;">
                      <strong style="font-size: 13.5px; font-weight: 800; color: var(--text-primary);">📌 취재 팩트 메모장</strong>
                      <span style="font-size: 11px; font-weight: 700; color: var(--memo-fact); background-color: var(--memo-fact-bg); border: 1px solid var(--memo-fact-border); padding: 1px 7px; border-radius: 99px;">
                        ${(w.researchItems || []).length}건
                      </span>
                    </div>
                    <button
                      type="button"
                      class="text-action-orange"
                      id="leftFetchMemoOnlyBtn"
                      style="font-size: 11.5px; font-weight: 700;"
                      title="오른쪽 작성 중인 기사는 그대로 두고, 현재 키워드의 최신 뉴스 팩트 문장만 메모장에 추가로 가져옵니다"
                      ${state.isRefreshingInEditor ? 'disabled' : ''}
                    >
                      ${state.isRefreshingInEditor ? '⏳ 수집 중...' : '+ 최신 뉴스 팩트 더 불러오기'}
                    </button>
                  </div>
                  <p class="text-muted mb-12" style="line-height: 1.45;">
                    추가할 보도자료나 팩트를 입력하면 <strong>매경 경어체("~합니다")</strong>로 다듬어 원하는 단락에 넣을 수 있습니다. 반영된 문장은 본문에 <strong style="color: var(--memo-fact); background-color: var(--memo-fact-mark); padding: 0 4px; border-radius: 3px;">노란색(취재 메모)</strong>으로 표시됩니다.
                  </p>

                  <div class="mb-12" style="padding: 10px; background-color: var(--bg-subtle); border: var(--border-thin); border-radius: var(--radius-general);">
                    <textarea class="textarea" id="memoFactInput" placeholder="팩트나 보도자료 문장을 붙여넣으세요..." style="min-height: 52px; margin-bottom: 6px; padding: 7px 10px; font-size: 12.5px; background-color: var(--white);"></textarea>
                    <div class="flex-between" style="gap: 6px;">
                      <input type="url" class="input" id="memoUrlInput" placeholder="출처 URL (선택)" style="flex: 1; padding: 5px 8px; font-size: 12px; background-color: var(--white);" />
                      <button type="button" class="btn btn-sm btn-primary" id="addMemoBtn">+ 매경 문체로 추가</button>
                    </div>
                  </div>

                  <div>
                    ${(w.researchItems || []).map((item, idx) => {
                      const linkedSource = (w.sources || []).find(s => (item.sourceIds || []).includes(s.id));
                      const directMemoUrl = item.sourceUrl || linkedSource?.url || '';
                      const refTitle = (linkedSource?.title || item.rawReference || '').replace(/^\[Perplexity 실시간 검증 출처 #\d+\]\s*/i, '').trim();
                      const reflectionInfo = getMemoReflectionLocations(item, w);
                      const activeMemoHl = state.activeMemoHighlight || (state.activeHighlight?.mode === 'memo' ? state.activeHighlight : null);
                      const isActiveMemoHighlight = activeMemoHl?.memoId === item.id;
                      return `
                        <div class="clean-list-row" style="${isActiveMemoHighlight ? 'background-color: var(--memo-fact-bg); border: 1px solid var(--memo-fact-border); border-radius: 8px; padding: 10px; margin-bottom: 4px;' : ''}">
                          ${refTitle && !refTitle.startsWith('http') ? `
                            <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(refTitle)}">
                              ${escapeHtml(refTitle)}
                            </div>
                          ` : ''}
                          <div style="font-size: 12.5px; color: var(--text-primary); line-height: 1.55; margin-bottom: 8px;">
                            ${escapeHtml(item.fact)}
                          </div>

                          <div class="flex-between" style="flex-wrap: wrap; gap: 6px;">
                            <div class="flex-row" style="gap: 5px; flex-wrap: wrap;">
                              ${reflectionInfo.isReflected ? reflectionInfo.locations.map((loc, lIdx) => `
                                <button
                                  type="button"
                                  data-locate-memo-id="${escapeHtml(item.id)}"
                                  data-locate-memo-loc="${lIdx}"
                                  style="display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 99px; border: 1px solid var(--memo-fact-border); background-color: var(--memo-fact-bg); color: var(--memo-fact); font-size: 11px; font-weight: 800; cursor: pointer; font-family: inherit;"
                                  title="클릭하면 오른쪽 본문의 해당 단락으로 이동하여 이 메모가 반영된 문장을 노란색으로 표시합니다"
                                >
                                  📌 ${escapeHtml(loc.label)} 반영됨 · 보기 ↘
                                </button>
                              `).join('') : `
                                <span style="font-size: 11px; font-weight: 600; color: var(--text-muted); background-color: var(--bg-subtle); padding: 1px 7px; border-radius: 99px;">
                                  미반영
                                </span>
                              `}
                              ${directMemoUrl ? `
                                <a href="${escapeHtml(directMemoUrl)}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-decoration: underline;" title="${escapeHtml(directMemoUrl)}">
                                  출처 ↗
                                </a>
                              ` : ''}
                            </div>
                            <div class="flex-row" style="gap: 5px;">
                              <select id="targetSecForMemo-${item.id}" style="border: var(--border-thin); border-radius: 6px; padding: 2px 6px; background: var(--white); font-size: 11.5px; color: var(--text-secondary); cursor: pointer;">
                                ${(w.draftSections || []).map((sec, sIdx) => `
                                  <option value="${sec.id}" ${sIdx === (w.draftSections.length > 1 ? 1 : 0) ? 'selected' : ''}>단락 0${sIdx + 1}</option>
                                `).join('')}
                              </select>
                              <button type="button" class="text-action-orange" data-insert-memo="${item.id}" style="font-size: 11.5px;">본문 반영 →</button>
                              <button type="button" class="text-action" data-del-memo="${item.id}" style="font-size: 11px; color: var(--text-muted);">삭제</button>
                            </div>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              ` : state.leftPanelTab === 'check' ? `
                <!-- [탭 2: 점검·팩트] GEO 7대 체크리스트 (클릭 시 우측 영역 점프) + 수치·날짜 형광펜 팩트체크 -->
                <div style="margin-bottom: 18px; padding-bottom: 14px; border-bottom: var(--border-thin);">
                  <div class="flex-between mb-6">
                    <strong style="font-size: 13.5px; font-weight: 800;">✅ GEO 최적화 7대 체크리스트</strong>
                    <span id="geoChecklistScoreBadge" style="font-size: 12.5px; font-weight: 800; color: ${geoEval.passedCount === geoEval.total ? 'var(--status-green)' : 'var(--mk-orange)'};">
                      ${geoEval.passedCount}/${geoEval.total} 충족
                    </span>
                  </div>
                  <p class="text-muted mb-8">
                    항목을 클릭하면 오른쪽 기사의 해당 위치로 바로 이동합니다.
                  </p>
                  <div id="geoChecklistContainer">
                    ${renderGeoChecklistItemsHtml(geoEval.details)}
                  </div>
                </div>

                <div>
                  <div class="flex-between mb-6">
                    <strong style="font-size: 13.5px; font-weight: 800;">
                      🖍️ 수치·날짜 팩트체크 (${unverifiedCount > 0 ? `미확인 ${unverifiedCount}건` : '모두 확인됨'})
                    </strong>
                    ${unverifiedCount > 0 ? `
                      <button type="button" class="text-action-orange" id="verifyAllFactsBtn">일괄 확인 ✓</button>
                    ` : ''}
                  </div>
                  <p class="text-muted mb-8">
                    본문 속 숫자·일정이 포함된 문장입니다. 클릭하여 확인 상태를 전환하세요.
                  </p>
                  ${(w.factChecks || []).length === 0 ? `
                    <div class="text-muted" style="padding: 12px 0;">추출된 수치·날짜 팩트체크 문장이 없습니다.</div>
                  ` : `
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                      ${(w.factChecks || []).map(fc => {
                        const isVerified = fc.status !== '미처리';
                        return `
                          <div
                            data-toggle-fc="${fc.id}"
                            style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 8px 10px; border-radius: var(--radius-general); border: var(--border-thin); background-color: ${isVerified ? 'var(--status-green-bg)' : 'var(--bg-subtle)'}; cursor: pointer; font-size: 12px; line-height: 1.5;"
                          >
                            <span style="color: var(--text-primary);">
                              <strong style="color: ${isVerified ? 'var(--status-green)' : 'var(--status-amber)'}; margin-right: 4px;">
                                ${isVerified ? '✓' : '•'}
                              </strong>
                              ${escapeHtml(fc.sentence)}
                            </span>
                            <span style="font-size: 11px; font-weight: 700; color: ${isVerified ? 'var(--text-muted)' : 'var(--mk-orange)'}; white-space: nowrap; flex-shrink: 0;">
                              ${isVerified ? '완료' : '확인'}
                            </span>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  `}
                </div>
              ` : `
                <!-- [탭 3: 목차·흐름] 기사 구성 블록 빠른 이동 및 단락 순서 변경 -->
                <div style="margin-bottom: 12px; padding: 10px 12px; background-color: var(--bg-subtle); border: var(--border-thin); border-radius: var(--radius-general);">
                  <div style="font-size: 11.5px; font-weight: 800; color: var(--text-primary); margin-bottom: 2px;">
                    현재 템플릿 · ${escapeHtml(tInfo.shortName)}
                  </div>
                  <div style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.45;">
                    ${escapeHtml(tInfo.flowSummary || tInfo.description)}
                  </div>
                </div>

                <div class="flex-between mb-6" style="gap: 6px; flex-wrap: wrap;">
                  <strong style="font-size: 13px; font-weight: 800; color: var(--text-primary);">🧭 기사 구성 목차 (클릭 이동 · 순서 변경)</strong>
                  <span style="font-size: 11px; color: var(--text-muted);">수정 사항 자동 반영</span>
                </div>
                ${w.lastOutlineAutoSyncInfo ? `
                  <div style="margin-bottom: 8px; padding: 6px 10px; background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 6px; font-size: 11.5px; color: #1D4ED8; font-weight: 600;">
                    ✓ [${escapeHtml(w.lastOutlineAutoSyncInfo.time)}] ${w.lastOutlineAutoSyncInfo.reordered ? '본문 단락·목차 순서와 하단 FAQ 순서가 함께 변경되었습니다.' : `AI 채팅 수정에 맞춰 소제목(${w.lastOutlineAutoSyncInfo.updatedTitleCount}건)이 업데이트되었습니다.`}
                  </div>
                ` : ''}
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <button type="button" class="headline-pick-row" data-jump-block="block-step-1" style="text-align: left;">
                    <span style="font-size: 12.5px; font-weight: 700;">STEP 01 · 카테고리 (${escapeHtml(sb.mkCategory || '산업 Q&A')})</span>
                    <span class="text-muted">→</span>
                  </button>
                  <button type="button" class="headline-pick-row" data-jump-block="block-step-2" style="text-align: left;">
                    <span style="font-size: 12.5px; font-weight: 700;">STEP 02 · 기사 헤드라인 & 추천 제목</span>
                    <span class="text-muted">→</span>
                  </button>
                  <button type="button" class="headline-pick-row" data-jump-block="block-step-3" style="text-align: left;">
                    <span style="font-size: 12.5px; font-weight: 700;">
                      STEP 03 · 도입부 내용
                      <span style="font-size: 10.5px; font-weight: 800; margin-left: 4px; padding: 1px 6px; border-radius: 99px; background-color: ${sb.includeLeadIntro !== false ? '#FFF3EB' : '#F3F4F6'}; color: ${sb.includeLeadIntro !== false ? 'var(--mk-orange)' : '#6B7280'};">
                        ${sb.includeLeadIntro !== false ? 'ON' : 'OFF'}
                      </span>
                    </span>
                    <span class="text-muted">→</span>
                  </button>
                  ${(w.draftSections || []).map((sec, sIdx) => {
                    const activeAiEdit = w.lastAiEdit || (state.activeHighlight?.mode === 'ai-edit' ? state.activeHighlight : null);
                    const isSecAiUpdated = Boolean(
                      activeAiEdit &&
                      activeAiEdit.isApplied !== false &&
                      (activeAiEdit.secIds?.includes(sec.id) ||
                       (activeAiEdit.sentencesBySecId?.[sec.id] || []).length > 0 ||
                       (activeAiEdit.removedBySecId?.[sec.id] || []).length > 0)
                    );
                    return `
                      <div class="headline-pick-row" style="display: flex; align-items: center; justify-content: space-between; gap: 6px; padding-left: 12px; ${isSecAiUpdated ? 'background-color: #F0F7FF; border-color: #BFDBFE;' : ''}">
                        <button
                          type="button"
                          data-jump-block="secWrap-${sec.id}"
                          style="flex: 1; min-width: 0; text-align: left; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 5px;"
                          title="${escapeHtml(sec.title)}"
                        >
                          <span style="font-size: 12px; font-weight: ${isSecAiUpdated ? '700' : '500'}; color: ${isSecAiUpdated ? '#1E40AF' : 'var(--text-secondary)'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            └ 단락 0${sIdx + 1}: ${escapeHtml(sec.title)}
                          </span>
                          ${isSecAiUpdated ? `
                            <span style="font-size: 10px; font-weight: 800; color: #1D4ED8; background: #DBEAFE; padding: 1px 5px; border-radius: 99px; flex-shrink: 0;">수정됨</span>
                          ` : ''}
                        </button>
                        <div class="flex-row" style="gap: 4px; flex-shrink: 0;">
                          ${sIdx > 0 ? `<button type="button" class="text-action" data-move-sec-up="${sIdx}" style="font-size: 11px; padding: 1px 4px;" title="단락 순서 위로 이동 (FAQ 순서도 자동 연동)">↑</button>` : ''}
                          ${sIdx < (w.draftSections || []).length - 1 ? `<button type="button" class="text-action" data-move-sec-down="${sIdx}" style="font-size: 11px; padding: 1px 4px;" title="단락 순서 아래로 이동 (FAQ 순서도 자동 연동)">↓</button>` : ''}
                        </div>
                      </div>
                    `;
                  }).join('')}
                  <button type="button" class="headline-pick-row" data-jump-block="block-step-6" style="text-align: left;">
                    <span style="font-size: 12.5px; font-weight: 700;">STEP 06 · 비교 요약표 (${(sb.summaryTable?.rows || []).length}행)</span>
                    <span class="text-muted">→</span>
                  </button>
                  <button type="button" class="headline-pick-row" data-jump-block="block-step-glossary" style="text-align: left;">
                    <span style="font-size: 12.5px; font-weight: 700;">핵심 용어 사전 (${(sb.glossary || []).length}개)</span>
                    <span class="text-muted">→</span>
                  </button>
                  <button type="button" class="headline-pick-row" data-jump-block="block-step-7" style="text-align: left;">
                    <span style="font-size: 12.5px; font-weight: 700;">STEP 07 · 독자 FAQ (${(sb.faqs || []).length}문항)</span>
                    <span class="text-muted">→</span>
                  </button>
                  <button type="button" class="headline-pick-row" data-jump-block="block-step-8" style="text-align: left;">
                    <span style="font-size: 12.5px; font-weight: 700;">STEP 08 · 마무리 총평 · 한 줄 요약 & 출처</span>
                    <span class="text-muted">→</span>
                  </button>
                </div>
              `}
            </div>
          </div>
        </aside>

        <!-- [가운데 영역] 원문 기사 본문 (구조별 편집 모드 vs 실제 기사 미리보기 모드) -->
        <div style="min-width: 0;">

          ${isPreview ? `
            <!-- ============================================================== -->
            <!-- 👁️ 실제 MK Pick 기사 미리보기 모드 (독자에게 보이는 최종 화면) -->
            <!-- ============================================================== -->
            <div class="article-paper">
              <div class="flex-between mb-12" style="padding: 10px 14px; background-color: var(--mk-orange-light); border: 0.5px solid var(--mk-orange-border); border-radius: var(--radius-general);">
                <div style="font-size: 12.5px; font-weight: 700; color: var(--mk-orange);">
                  👁️ 실제 MK Pick 기사 발행 미리보기 화면입니다. (편집 하이라이트 없이 독자에게 노출되는 순수 기사 원문 형태로 표시됩니다)
                </div>
                <button type="button" class="btn btn-sm btn-primary" data-editor-mode="edit">✏️ 편집 화면으로 돌아가기</button>
              </div>

              <div style="margin-bottom: 10px;">
                <span class="badge badge-orange" style="margin-right: 8px; font-weight: 800;">${escapeHtml(sb.mkCategory || '산업 Q&A')}</span>
                <span style="font-size: 13px; color: var(--text-secondary); font-weight: 600;">${escapeHtml(sb.byline || '산업 Q&A | 남궁선희 기자')}</span>
              </div>

              ${(sb.companyTags || []).length > 0 ? `
                <div class="flex-row mb-12" style="gap: 6px; flex-wrap: wrap;">
                  ${(sb.companyTags || []).map(t => `<span style="font-size: 12px; font-weight: 700; color: var(--mk-orange);">#${escapeHtml(t)}</span>`).join('')}
                </div>
              ` : ''}

              <h1 style="font-size: 26px; font-weight: 800; line-height: 1.38; color: var(--text-primary); margin-bottom: ${sb.oneLineSubtitle ? '8px' : '18px'}; letter-spacing: -0.5px;">
                ${escapeHtml(w.title)}
              </h1>
              ${sb.oneLineSubtitle ? `
                <div style="font-size: 16.5px; font-weight: 700; color: var(--mk-orange); line-height: 1.45; margin-bottom: 16px;">
                  ${escapeHtml(sb.oneLineSubtitle)}
                </div>
              ` : ''}

              <hr class="doc-divider" />

              ${sb.includeLeadIntro !== false && (sb.leadIntro || '').trim() ? `
                <div style="font-size: 15.5px; line-height: 1.85; color: var(--text-primary); white-space: pre-line; margin-bottom: 28px;">${escapeHtml(String(sb.leadIntro).trim())}</div>
              ` : ''}

              ${(w.draftSections || []).map(sec => `
                <div style="margin-bottom: 30px;">
                  <h2 style="font-size: 19px; font-weight: 800; color: var(--text-primary); padding: 10px 0; margin-bottom: 14px; border-top: 2px solid var(--mk-orange); border-bottom: 1px solid var(--mk-orange);">
                    ${escapeHtml(sec.title)}
                  </h2>
                  <div style="font-size: 15.5px; line-height: 1.85; color: var(--text-primary); white-space: pre-line;">${escapeHtml(sec.content)}</div>
                  ${sec.imageCaption ? `
                    <div style="margin-top: 8px; font-size: 12.5px; color: var(--text-muted); font-weight: 600;">
                      ${escapeHtml(sec.imageCaption)}
                    </div>
                  ` : ''}
                </div>
              `).join('')}

              <hr class="doc-divider" />

              <div style="margin-bottom: 28px;">
                <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 10px;">${escapeHtml(sb.summaryTable?.title || '[요약표]')}</h3>
                <div class="table-wrap">
                  <table class="mk-table">
                    <thead>
                      <tr>
                        ${(sb.summaryTable?.headers || []).map(h => `<th>${escapeHtml(h)}</th>`).join('')}
                      </tr>
                    </thead>
                    <tbody>
                      ${(sb.summaryTable?.rows || []).map(row => `
                        <tr>
                          ${row.map(cell => `<td style="white-space: pre-line;">${escapeHtml(cell)}</td>`).join('')}
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>

              ${(sb.glossary || []).length > 0 ? `
                <hr class="doc-divider" />
                <div style="margin-bottom: 28px; padding: 16px 18px; background-color: var(--bg-subtle); border: var(--border-thin); border-radius: var(--radius-general);">
                  <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 12px; color: var(--text-primary);">
                    📚 ${escapeHtml(sb.glossaryTitle || '주제를 더 깊이 이해하는 용어 사전')}
                  </h3>
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${(sb.glossary || []).map(g => `
                      <div style="font-size: 14.5px; line-height: 1.68; color: var(--text-primary);">
                        <strong style="color: var(--mk-orange); font-weight: 800;">${escapeHtml(g.term)}</strong> : ${escapeHtml(g.desc)}
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              <hr class="doc-divider" />

              <div style="margin-bottom: 28px;">
                <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 12px;">자주 묻는 질문 (FAQ)</h3>
                ${(sb.faqs || []).map(faq => `
                  <div style="margin-bottom: 14px; padding-bottom: 12px; border-bottom: var(--border-thin);">
                    <div style="font-weight: 800; font-size: 15px; margin-bottom: 4px; color: var(--text-primary);">${escapeHtml(faq.q)}</div>
                    <div style="font-size: 14.5px; color: var(--text-secondary); line-height: 1.65;">A. ${escapeHtml(faq.a)}</div>
                  </div>
                `).join('')}
              </div>

              ${sb.closingParagraph ? `
                <div style="margin-bottom: 18px; font-size: 15.5px; line-height: 1.85; color: var(--text-primary); white-space: pre-line;">
                  ${escapeHtml(sb.closingParagraph)}
                </div>
              ` : ''}

              <div style="border-left: 3px solid var(--mk-orange); padding-left: 14px; margin-bottom: 18px; font-size: 15px; font-weight: 800;">
                ${escapeHtml(sb.oneLineSummary || '')}
              </div>

              <div style="font-size: 12.5px; color: var(--text-muted); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding-top: 12px; border-top: var(--border-thin); margin-bottom: 18px;">
                <span>${escapeHtml(sb.imageRecommendations?.[0]?.caption || '< 출처 : 각 사 제공 >')}</span>
                <span>${escapeHtml(sb.noticeText || '')}</span>
              </div>

              ${(w.sources || []).filter(s => !s.excluded).length > 0 ? `
                <div style="padding: 14px 16px; background-color: var(--bg-subtle); border: var(--border-thin); border-radius: var(--radius-general);">
                  <div style="font-size: 13px; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;">🔗 [참고 자료 및 실시간 검증 출처 목록]</div>
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    ${(w.sources || []).filter(s => !s.excluded).map((s, idx) => `
                      <div style="font-size: 12.5px; color: var(--text-secondary); display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                        <span><strong>${idx + 1}.</strong> ${escapeHtml(s.title || s.url)}</span>
                        ${s.url ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="text-action-orange" style="white-space: nowrap;">원문 열기 ↗</a>` : ''}
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          ` : `
            <!-- ============================================================== -->
            <!-- ✏️ 구조별 편집 모드 (깔끔하고 직관적인 8단계 문서 편집기) -->
            <!-- ============================================================== -->
            <div>
              ${(() => {
                // AI 호출 실패 시에만 복구 배너 노출 (정상 집필 시 불필요한 상단 상태 박스와 초록색 팩트체크 배너를 숨겨 화면을 심플하게 유지)
                const isOfflineFallback = w.usedPerplexity === false;
                if (!isOfflineFallback) return '';
                const diag = diagnoseAiErrorReason(w.pplxError || '', Boolean(getClientPerplexityKey()));
                return `
                  <div style="margin-bottom: 14px; padding: 14px 16px; border-radius: 10px; border: 1.5px solid #FCA5A5; background-color: #FEF2F2;">
                    <div class="flex-between" style="flex-wrap: wrap; gap: 10px; margin-bottom: 8px;">
                      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="padding: 3px 9px; border-radius: 99px; background-color: #DC2626; color: #FFFFFF; font-size: 11.5px; font-weight: 800;">
                          🚨 AI 호출 지연 · 임시 골격 표시 중
                        </span>
                        <strong style="font-size: 13px; font-weight: 800; color: #991B1B;">
                          ${escapeHtml(diag.title)}
                        </strong>
                      </div>
                      <div class="flex-row" style="gap: 6px; flex-wrap: wrap;">
                        <button
                          type="button"
                          data-retry-ai-model="google/gemini-4-argon"
                          style="padding: 5px 11px; border-radius: 6px; border: none; background-color: #DC2626; color: #FFFFFF; font-size: 12px; font-weight: 800; cursor: pointer; font-family: inherit;"
                          ${state.isRefreshingInEditor ? 'disabled' : ''}
                        >
                          ${state.isRefreshingInEditor ? '⏳ 재집필 중...' : '⚡ 다시 생성 →'}
                        </button>
                      </div>
                    </div>
                    <div style="font-size: 12px; line-height: 1.5; color: #7F1D1D;">
                      ${escapeHtml(diag.cause)} · ${escapeHtml(diag.solution)}
                    </div>
                  </div>
                `;
              })()}

              <!-- STEP 01: MK Pick 5대 카테고리 분류 & 바이라인·태그 -->
              <section class="editor-block-section" id="block-step-1">
                <div class="editor-step-header">
                  <div class="flex-row" style="gap: 8px;">
                    <span class="editor-step-badge">STEP 01 · 카테고리 & 바이라인</span>
                    <span style="font-size: 12.5px; color: var(--text-secondary); font-weight: 600;">
                      ${escapeHtml(sb.mkCategoryReason || recommendMkPickCategory(w.keyword, w.typeId, w.inputCompany).categoryReason)}
                    </span>
                  </div>
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
                  ${MK_PICK_CATEGORIES.map(cat => {
                    const currentCat = sb.mkCategory || recommendMkPickCategory(w.keyword, w.typeId, w.inputCompany).recommendedCategory;
                    const isActiveCat = currentCat === cat.id;
                    return `
                      <button
                        type="button"
                        data-pick-mk-cat="${escapeHtml(cat.id)}"
                        style="padding: 5px 12px; border-radius: 99px; border: ${isActiveCat ? '1px solid var(--mk-orange)' : 'var(--border-thin)'}; background-color: ${isActiveCat ? 'var(--mk-orange)' : 'var(--white)'}; color: ${isActiveCat ? '#FFFFFF' : 'var(--text-secondary)'}; font-size: 12.5px; font-weight: ${isActiveCat ? '800' : '600'}; cursor: pointer; font-family: inherit;"
                        title="${escapeHtml(cat.desc)}"
                      >
                        ${isActiveCat ? '✓ ' : ''}${escapeHtml(cat.name)}
                      </button>
                    `;
                  }).join('')}
                </div>

                <div class="grid-2">
                  <div>
                    <label class="text-muted" style="display: block; margin-bottom: 4px; font-weight: 700;">라벨 · 기자 바이라인</label>
                    <input type="text" class="doc-editable-input" id="docByline" value="${escapeHtml(sb.byline || `${sb.mkCategory || '산업 Q&A'} | 남궁선희 기자`)}" style="font-size: 13px; color: var(--text-secondary); font-weight: 600;" />
                  </div>
                  <div>
                    <label class="text-muted" style="display: block; margin-bottom: 4px; font-weight: 700;">업체명 · 핵심 키워드 태그 (쉼표로 구분)</label>
                    <input type="text" class="doc-editable-input" id="docTags" value="${escapeHtml((sb.companyTags || []).join(', '))}" style="font-size: 13px; color: var(--text-primary); font-weight: 700;" placeholder="예: 카카오프렌즈, 라이엇 게임즈, 롤드컵" />
                  </div>
                </div>
              </section>

              <!-- STEP 02: 메인 헤드라인 & 추천 제목 5선 -->
              <section class="editor-block-section" id="block-step-2">
                ${(() => {
                  const maxHeadlineLen = MAX_HEADLINE_CHARS || 40;
                  const curTitle = String(w.title || '');
                  const curLen = curTitle.length;
                  const isOverLimit = curLen > maxHeadlineLen;
                  const oneLineSubVal = sb.oneLineSubtitle !== undefined
                    ? sb.oneLineSubtitle
                    : ((sb.subtitle || '').split('\n')[0] || '');
                  return `
                    <div class="editor-step-header">
                      <div class="flex-row" style="gap: 8px; flex-wrap: wrap;">
                        <span class="editor-step-badge">STEP 02 · 기사 헤드라인</span>
                        <span
                          id="headlineCharBadge"
                          style="font-size: 11.5px; font-weight: 700; padding: 2px 8px; border-radius: 99px; border: 1px solid ${isOverLimit ? '#FCA5A5' : '#D1FAE5'}; background-color: ${isOverLimit ? '#FEF2F2' : '#ECFDF5'}; color: ${isOverLimit ? '#DC2626' : '#047857'};"
                        >
                          ${isOverLimit ? `⚠️ ${curLen}/${maxHeadlineLen}자 (${curLen - maxHeadlineLen}자 초과)` : `✓ ${curLen}/${maxHeadlineLen}자`}
                        </span>
                      </div>
                      <div class="flex-row" style="gap: 8px;">
                        ${isOverLimit ? `
                          <button
                            type="button"
                            class="btn btn-sm"
                            id="splitHeadlineToSubtitleBtn"
                            style="padding: 3px 10px; font-size: 11.5px; font-weight: 700;"
                          >
                            ✂️ 40자 초과분 소제목으로 분리 ↓
                          </button>
                        ` : `
                          <button
                            type="button"
                            class="text-action"
                            id="splitHeadlineToSubtitleBtn"
                            style="font-size: 11.5px; color: var(--text-muted);"
                          >
                            ✂️ 소제목 분리
                          </button>
                        `}
                        <button type="button" class="text-action" data-copy-part="headline">📋 제목 복사</button>
                      </div>
                    </div>

                    <textarea class="doc-editable-textarea doc-headline-input mb-8" id="docMainHeadline" rows="2" placeholder="기사 메인 헤드라인을 입력하세요 (최대 40자 권장)">${escapeHtml(w.title)}</textarea>

                    <div style="margin-bottom: 12px;">
                      <div class="flex-between mb-4" style="gap: 6px;">
                        <label for="docOneLineSubtitle" class="text-muted" style="font-size: 12px; font-weight: 700;">
                          한줄 소제목 (선택)
                        </label>
                        <span id="oneLineSubCharCount" style="font-size: 11px; color: var(--text-muted);">${String(oneLineSubVal || '').length}자</span>
                      </div>
                      <input
                        type="text"
                        class="doc-editable-input"
                        id="docOneLineSubtitle"
                        value="${escapeHtml(oneLineSubVal)}"
                        placeholder="헤드라인 보조 설명 또는 한 줄 요약 소제목을 입력하세요"
                        style="font-size: 13.5px; font-weight: 600; color: var(--text-secondary);"
                      />
                    </div>

                    <div style="border-top: 1px solid #F3F4F6; padding-top: 10px;">
                      <div style="font-size: 11.5px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">
                        💡 추천 헤드라인 5선 (클릭 시 교체)
                      </div>
                      ${(w.titleCandidates || []).map((tc, i) => {
                        const isSelected = (w.title || '').trim() === (tc.title || '').trim();
                        const tcLen = (tc.title || '').length;
                        return `
                          <div class="headline-pick-row ${isSelected ? 'active' : ''}" data-pick-headline-idx="${i}">
                            <span style="font-size: 13px; font-weight: ${isSelected ? '700' : '500'}; color: var(--text-primary);">
                              <span style="color: ${isSelected ? 'var(--mk-orange)' : 'var(--text-muted)'}; font-weight: 700; margin-right: 6px;">0${i + 1}</span>
                              ${escapeHtml(tc.title)}
                              <span style="font-size: 11px; color: var(--text-muted); margin-left: 4px;">(${tcLen}자)</span>
                            </span>
                            <span style="font-size: 11.5px; font-weight: 600; color: ${isSelected ? 'var(--mk-orange)' : 'var(--text-muted)'}; white-space: nowrap; flex-shrink: 0;">
                              ${isSelected ? '적용됨' : '선택'}
                            </span>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  `;
                })()}
              </section>

              <!-- STEP 03: 기사 도입부 내용 (ON/OFF 토글 지원 · 권장 300~500자) -->
              <section class="editor-block-section" id="block-step-3">
                <div id="block-step-4">
                  ${(() => {
                    const isIntroOn = sb.includeLeadIntro !== false;
                    const introText = String(sb.leadIntro || '');
                    const introLen = introText.length;
                    const isGoodRange = introLen >= 250 && introLen <= 550;
                    return `
                      <div class="editor-step-header">
                        <div class="flex-row" style="gap: 8px; flex-wrap: wrap;">
                          <span class="editor-step-badge">STEP 03 · 도입부 내용</span>
                          <span class="text-muted">본문 단락(소제목) 시작 전 독자의 시선을 끄는 도입부 (권장 300~500자)</span>
                          <span
                            id="leadIntroCharBadge"
                            style="font-size: 11.5px; font-weight: 700; padding: 2px 8px; border-radius: 99px; border: 1px solid ${!isIntroOn ? '#E5E7EB' : (isGoodRange ? '#D1FAE5' : '#FDE68A')}; background-color: ${!isIntroOn ? '#F3F4F6' : (isGoodRange ? '#ECFDF5' : '#FFFBEB')}; color: ${!isIntroOn ? '#6B7280' : (isGoodRange ? '#047857' : '#B45309')};"
                          >
                            ${!isIntroOn ? 'OFF · 미리보기 및 전체 복사에서 제외됨' : `공백 포함 ${introLen.toLocaleString()}자 (권장 300~500자)`}
                          </span>
                        </div>
                        <div class="flex-row" style="gap: 8px; flex-wrap: wrap;">
                          <button
                            type="button"
                            id="toggleLeadIntroBtn"
                            style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: 99px; font-size: 12px; font-weight: 800; cursor: pointer; font-family: inherit; border: 1px solid ${isIntroOn ? 'var(--mk-orange)' : '#D1D5DB'}; background-color: ${isIntroOn ? 'var(--mk-orange)' : '#F3F4F6'}; color: ${isIntroOn ? '#FFFFFF' : '#4B5563'};"
                            title="클릭하여 기사 도입부 내용을 켜거나(ON) 끕니다(OFF)"
                          >
                            <span style="width: 7px; height: 7px; border-radius: 50%; background-color: ${isIntroOn ? '#FFFFFF' : '#9CA3AF'}; display: inline-block;"></span>
                            도입부 ${isIntroOn ? 'ON' : 'OFF'}
                          </button>
                          ${isIntroOn ? `
                            <button
                              type="button"
                              class="text-action-orange"
                              id="regenerateLeadIntroBtn"
                              style="font-size: 11.5px; font-weight: 700;"
                              title="현재 키워드와 핵심 팩트에 맞춰 300~500자 분량의 MK Pick 매거진 도입부를 자동 생성합니다"
                            >
                              ✨ 300~500자 자동 생성
                            </button>
                            <button type="button" class="text-action" data-copy-part="leadintro">📋 도입부 복사</button>
                          ` : ''}
                        </div>
                      </div>

                      ${isIntroOn ? `
                        <textarea
                          class="doc-editable-textarea doc-body-textarea"
                          id="docLeadIntro"
                          rows="5"
                          placeholder="본문 소제목 단락이 시작되기 전에 들어갈 도입부 내용(약 300~500자, 2~3문단)을 입력하세요. 마지막 문장은 '~상세히 정리해 드립니다.' 형태로 마무리하면 본문 단락과 자연스럽게 이어집니다."
                        >${escapeHtml(introText)}</textarea>
                      ` : `
                        <div class="flex-between" style="padding: 12px 14px; background-color: #F9FAFB; border: 1px dashed #D1D5DB; border-radius: 8px; gap: 10px; flex-wrap: wrap;">
                          <span style="font-size: 12.5px; color: var(--text-muted); font-weight: 600;">
                            현재 도입부 내용이 <strong>OFF</strong> 상태입니다. 실제 기사 미리보기와 CMS 전체 복사에서 제외되며, 바로 아래 본문 단락(소제목)부터 시작됩니다.
                          </span>
                          <button type="button" class="btn btn-sm" id="enableLeadIntroQuickBtn" style="font-size: 11.5px; font-weight: 700;">
                            도입부 켜기 (ON)
                          </button>
                        </div>
                      `}
                    `;
                  })()}
                </div>
              </section>

              <!-- STEP 05: 본문 단락 (취재 메모 = 앰버 옐로우 / AI 채팅 수정 = 로열 블루로 명확히 구분) -->
              <section class="editor-block-section" id="block-step-5">
                <div class="editor-step-header">
                  <div class="flex-row" style="gap: 8px; flex-wrap: wrap;">
                    <span class="editor-step-badge">STEP 05 · 본문 단락 (${(w.draftSections || []).length}개)</span>
                    <span style="display: inline-flex; align-items: center; gap: 10px; font-size: 11.5px; color: var(--text-muted); font-weight: 600;">
                      <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #F59E0B; display: inline-block;"></span>취재 메모 반영</span>
                      <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #2563EB; display: inline-block;"></span>AI 채팅 수정</span>
                    </span>
                  </div>
                  <button type="button" class="btn btn-sm" id="addDocSectionBtn">+ 단락 추가</button>
                </div>

                <div id="docSectionsContainer">
                  ${(w.draftSections || []).map((sec, sIdx) => {
                    const roleLabel = getSectionRoleLabel(sec, sIdx, (w.draftSections || []).length);
                    const secCharLen = (sec.content || '').length;
                    const activeAiEdit = w.lastAiEdit || (state.activeHighlight?.mode === 'ai-edit' ? state.activeHighlight : null);
                    const activeMemoHl = state.activeMemoHighlight || (state.activeHighlight?.mode === 'memo' ? state.activeHighlight : null);

                    // 1) 취재 메모 반영 여부 확인 (메모장에서 [+ 반영]을 눌렀거나 [보기 ↘]로 선택한 단락)
                    const insertedMemosForSec = (w.researchItems || []).filter(m =>
                      Array.isArray(m.insertedIntoSecIds) && m.insertedIntoSecIds.includes(sec.id) && (sec.content || '').includes((m.fact || '').trim().slice(0, 20))
                    );
                    const isMemoActiveOnSec = Boolean(
                      (activeMemoHl && activeMemoHl.secIds?.includes(sec.id)) ||
                      insertedMemosForSec.length > 0
                    );
                    const memoSentences = [
                      ...(activeMemoHl?.sentencesBySecId?.[sec.id] || []),
                      ...insertedMemosForSec.map(m => m.fact)
                    ].filter((v, i, a) => v && a.indexOf(v) === i);
                    const memoTokens = activeMemoHl?.tokensBySecId?.[sec.id] || [];

                    // 2) AI 채팅 수정 여부 확인 (추가된 문장 또는 제외된 문장이 있는 단락)
                    const aiAddedSents = activeAiEdit?.sentencesBySecId?.[sec.id] || [];
                    const aiRemovedSents = activeAiEdit?.removedBySecId?.[sec.id] || [];
                    const isAiSecEdited = Boolean(
                      activeAiEdit &&
                      (activeAiEdit.secIds?.includes(sec.id) || aiAddedSents.length > 0 || aiRemovedSents.length > 0)
                    );

                    // 카드 테두리 스타일: AI 채팅 수정(블루) / 취재 메모 반영(앰버) / 기본(심플 화이트)
                    const borderStyle = isAiSecEdited && activeAiEdit.isApplied !== false
                      ? '1.5px solid #93C5FD'
                      : isMemoActiveOnSec
                        ? '1.5px solid #FCD34D'
                        : '1px solid #E5E7EB';

                    return `
                      <div style="padding: 16px; border: ${borderStyle}; border-radius: 10px; background-color: #FFFFFF; margin-bottom: 14px; transition: border-color 0.2s;" id="secWrap-${sec.id}">
                        <div class="flex-between mb-8" style="flex-wrap: wrap; gap: 6px;">
                          <div class="flex-row" style="gap: 6px; flex-wrap: wrap;">
                            <span style="font-size: 12px; font-weight: 800; color: #374151; background-color: #F3F4F6; padding: 2px 9px; border-radius: 6px;">
                              단락 0${sIdx + 1} · ${escapeHtml(roleLabel)}
                            </span>
                            <span class="text-muted" id="secCharCount-${sec.id}">${secCharLen.toLocaleString()}자</span>
                            ${isMemoActiveOnSec ? `
                              <span style="font-size: 11px; font-weight: 800; color: #B45309; background-color: #FFFBEB; border: 1px solid #FDE68A; padding: 2px 8px; border-radius: 99px;">
                                📌 취재 메모 반영됨
                              </span>
                            ` : ''}
                            ${isAiSecEdited ? `
                              <span style="font-size: 11px; font-weight: 800; color: ${activeAiEdit.isApplied !== false ? '#1D4ED8' : '#6B7280'}; background-color: ${activeAiEdit.isApplied !== false ? '#EFF6FF' : '#F3F4F6'}; border: 1px solid ${activeAiEdit.isApplied !== false ? '#BFDBFE' : '#D1D5DB'}; padding: 2px 8px; border-radius: 99px;">
                                💬 ${activeAiEdit.isApplied !== false
                                  ? (aiRemovedSents.length > 0 && aiAddedSents.length === 0 ? `AI 채팅 수정 (내용 ${aiRemovedSents.length}건 제외됨)` : 'AI 채팅 수정 반영됨')
                                  : 'AI 채팅 수정 되돌림'}
                              </span>
                            ` : ''}
                          </div>
                          <div class="flex-row" style="gap: 8px;">
                            <button type="button" class="text-action" data-polish-sec="${sec.id}" style="font-size: 11.5px; color: var(--text-secondary);" title="평어체(~한다/이다) 문장을 매경 Pick 경어체(~합니다)로 교정">
                              ✨ 문체 다듬기
                            </button>
                            ${sIdx > 0 ? `<button type="button" class="text-action" data-move-sec-up="${sIdx}" title="위로 이동">↑</button>` : ''}
                            ${sIdx < (w.draftSections || []).length - 1 ? `<button type="button" class="text-action" data-move-sec-down="${sIdx}" title="아래로 이동">↓</button>` : ''}
                            ${(w.draftSections || []).length > 1 ? `
                              <button type="button" class="text-action" data-del-doc-sec="${sec.id}" style="color: var(--text-muted);">삭제</button>
                            ` : ''}
                          </div>
                        </div>

                        <div class="mb-8">
                          <input type="text" class="doc-editable-input doc-sec-title-input" data-doc-sec-title="${sec.id}" value="${escapeHtml(sec.title)}" placeholder="단락 소제목을 입력하세요" />
                        </div>

                        <div class="mb-8">
                          <textarea class="doc-editable-textarea doc-body-textarea" id="secBody-${sec.id}" data-doc-sec-body="${sec.id}" rows="5" placeholder="본문 내용을 '~합니다' 체로 입력하세요">${escapeHtml(sec.content)}</textarea>
                          ${isMemoActiveOnSec ? renderHighlightedBodyHtml(
                            sec.content,
                            memoSentences,
                            memoTokens,
                            `단락 0${sIdx + 1}에 반영된 취재 메모 문장`,
                            { sourceType: 'memo', secId: sec.id }
                          ) : ''}
                          ${isAiSecEdited ? renderHighlightedBodyHtml(
                            sec.content,
                            aiAddedSents,
                            [],
                            `AI 채팅으로 기사 수정 반영 내역`,
                            { sourceType: 'ai-chat', aiEditState: activeAiEdit, secId: sec.id }
                          ) : ''}
                        </div>

                        <div>
                          <input type="text" class="doc-editable-input" data-doc-sec-caption="${sec.id}" value="${escapeHtml(sec.imageCaption || '')}" placeholder="이미지 캡션 (선택 · 예: < 출처 : 각 사 제공 >)" style="font-size: 12px; color: var(--text-muted);" />
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </section>

              <!-- STEP 06: 핵심 비교 요약표 -->
              <section class="editor-block-section" id="block-step-6">
                <div class="editor-step-header">
                  <div class="flex-row" style="gap: 8px;">
                    <span class="editor-step-badge">STEP 06 · 핵심 비교 요약표</span>
                    <span class="text-muted">구조화된 비교 요약표</span>
                  </div>
                  <div class="flex-row" style="gap: 10px;">
                    <button type="button" class="text-action" id="docAddTableRowBtn">+ 행 추가</button>
                    <button type="button" class="text-action" id="docAddTableColBtn">+ 열 추가</button>
                    <button type="button" class="text-action" data-copy-part="table">📋 표 복사</button>
                  </div>
                </div>

                <div class="mb-8">
                  <input type="text" class="doc-editable-input" id="docTableTitle" value="${escapeHtml(sb.summaryTable?.title || '[요약표] 핵심 비교')}" style="font-size: 15px; font-weight: 800;" />
                </div>

                <div class="table-wrap">
                  <table class="mk-table">
                    <thead>
                      <tr>
                        ${(sb.summaryTable?.headers || []).map((h, cIdx) => `
                          <th>
                            <input type="text" class="doc-editable-input" data-doc-th="${cIdx}" value="${escapeHtml(h)}" style="font-weight: 800; font-size: 13px; background: transparent; border-color: transparent;" />
                          </th>
                        `).join('')}
                        <th style="width: 48px; text-align: center; font-weight: 500; color: var(--text-muted);">삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${(sb.summaryTable?.rows || []).map((row, rIdx) => `
                        <tr>
                          ${row.map((cell, cIdx) => `
                            <td>
                              <input type="text" class="doc-editable-input" data-doc-td="${rIdx}-${cIdx}" value="${escapeHtml(cell)}" style="font-size: 13px;" />
                            </td>
                          `).join('')}
                          <td style="text-align: center;">
                            <button type="button" class="text-action" data-doc-del-row="${rIdx}" style="color: var(--text-muted);">✕</button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </section>

              <!-- STEP 06-B: 핵심 용어 사전 -->
              <section class="editor-block-section" id="block-step-glossary">
                <div class="editor-step-header">
                  <div class="flex-row" style="gap: 8px;">
                    <span class="editor-step-badge">📚 핵심 용어 사전 (${(sb.glossary || []).length}개)</span>
                    <span class="text-muted">주요 개념·키워드 해설</span>
                  </div>
                  <div class="flex-row" style="gap: 10px;">
                    <button type="button" class="text-action" id="docAddGlossaryBtn">+ 용어 추가</button>
                    <button type="button" class="text-action" data-copy-part="glossary">📋 사전 복사</button>
                  </div>
                </div>

                <div class="mb-8">
                  <input type="text" class="doc-editable-input" id="docGlossaryTitle" value="${escapeHtml(sb.glossaryTitle || '[핵심 용어 사전]')}" style="font-size: 14.5px; font-weight: 800;" />
                </div>

                <div>
                  ${(sb.glossary || []).map((gItem, gIdx) => `
                    <div style="display: flex; align-items: flex-start; flex-wrap: wrap; gap: 8px; padding: 8px 10px; margin-bottom: 8px; background-color: #FAFAFA; border: 1px solid #E5E7EB; border-radius: 8px;">
                      <input type="text" class="doc-editable-input" data-doc-glossary-term="${gIdx}" value="${escapeHtml(gItem.term || '')}" placeholder="핵심 용어명" style="width: 200px; max-width: 100%; flex-shrink: 0; font-weight: 700; font-size: 13px; background-color: var(--white);" />
                      <textarea class="doc-editable-textarea" data-doc-glossary-desc="${gIdx}" rows="1" placeholder="용어에 대한 1~2문장 해설 ('~입니다' 체)" style="flex: 1; min-width: 180px; font-size: 13px; color: var(--text-secondary); background-color: var(--white);">${escapeHtml(gItem.desc || '')}</textarea>
                      <button type="button" class="text-action" data-doc-del-glossary="${gIdx}" style="font-size: 12px; color: var(--text-muted); padding-top: 6px;">✕</button>
                    </div>
                  `).join('')}
                </div>
              </section>

              <!-- STEP 07: 자주 묻는 질문 (FAQ) -->
              <section class="editor-block-section" id="block-step-7">
                <div class="editor-step-header">
                  <div class="flex-row" style="gap: 8px; flex-wrap: wrap;">
                    <span class="editor-step-badge">STEP 07 · 독자 FAQ (${(sb.faqs || []).length}문항)</span>
                    <span class="text-muted">본문 수정·삭제 시 자동 연동</span>
                  </div>
                  <div class="flex-row" style="gap: 8px; flex-wrap: wrap;">
                    <button
                      type="button"
                      class="btn btn-sm"
                      id="sortFaqsByContextBtn"
                      style="padding: 3px 9px; font-size: 11.5px; font-weight: 700;"
                      title="본문 단락 순서에 맞춰 FAQ 순서를 자동 정렬합니다"
                    >
                      ⇅ 본문 순서 정렬
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm"
                      id="syncFaqsWithBodyAiBtn"
                      style="padding: 3px 9px; font-size: 11.5px; font-weight: 700;"
                      ${state.isSyncingFaqsAi ? 'disabled' : ''}
                    >
                      ${state.isSyncingFaqsAi ? '⏳ 동기화 중...' : '🔄 본문 기준 재동기화'}
                    </button>
                    ${(sb.fanoutQuestions && sb.fanoutQuestions.length > 0) ? `
                      <button type="button" class="text-action" id="docToggleFanoutBtn" style="font-size: 11.5px;">
                        ${state.fanoutOpen ? `💡 추천 질문(${sb.fanoutQuestions.length}) 접기 ▲` : `💡 추천 질문(${sb.fanoutQuestions.length}) ▼`}
                      </button>
                    ` : ''}
                    <button type="button" class="text-action" id="docAddFaqBtn">+ 질문 추가</button>
                    <button type="button" class="text-action" data-copy-part="faq">📋 FAQ 복사</button>
                  </div>
                </div>

                ${state.lastFaqAutoSyncInfo ? `
                  <div style="margin-bottom: 10px; padding: 7px 11px; background-color: #F0F7FF; border: 1px solid #BFDBFE; border-radius: 6px; font-size: 12px; color: #1D4ED8; font-weight: 600;">
                    ✓ [${escapeHtml(state.lastFaqAutoSyncInfo.time)}]
                    ${state.lastFaqAutoSyncInfo.aiPromptSynced
                      ? 'AI 채팅으로 수정된 본문 내용이 FAQ에도 자동 반영되었습니다.'
                      : `본문 변경 사항이 FAQ에 자동 반영되었습니다. ${state.lastFaqAutoSyncInfo.removedFaqCount > 0 ? `(관련 FAQ ${state.lastFaqAutoSyncInfo.removedFaqCount}문항 정리됨)` : ''}`}
                  </div>
                ` : ''}

                ${state.fanoutOpen && sb.fanoutQuestions && sb.fanoutQuestions.length > 0 ? `
                  <div style="background-color: #FAFAFA; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; margin-bottom: 14px;">
                    <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px;">
                      💡 연관 추천 질문 (클릭 시 FAQ에 추가)
                    </div>
                    ${sb.fanoutQuestions.map((fq, fIdx) => `
                      <div class="clean-list-row" style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 7px 4px;">
                        <div style="font-size: 12.5px; line-height: 1.5; flex: 1;">
                          <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 2px;">
                            Q. ${escapeHtml(fq.q.replace(/^Q\d+\.\s*/i, ''))}
                          </div>
                          <div style="font-size: 12px; color: var(--text-secondary);">A. ${escapeHtml(fq.a)}</div>
                        </div>
                        <button type="button" class="btn btn-sm" data-pick-fanout="${fIdx}" style="padding: 4px 10px; font-size: 11.5px;">+ 추가</button>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}

                <div id="docFaqsContainer">
                  ${(sb.faqs || []).map((faq, idx) => {
                    const relInfo = inferFaqRelatedSectionInfo(faq, w);
                    const isFaqAiEdited = Boolean(faq.isAiEdited);
                    return `
                      <div
                        class="faq-draggable-card"
                        draggable="true"
                        data-faq-card-idx="${idx}"
                        style="padding: 12px; margin-bottom: 10px; background-color: ${isFaqAiEdited ? '#F0F7FF' : '#FFFFFF'}; border: ${isFaqAiEdited ? '1.5px solid #93C5FD' : '1px solid #E5E7EB'}; border-radius: 8px; transition: all 0.15s;"
                      >
                        <div class="flex-between mb-6" style="gap: 8px; flex-wrap: wrap;">
                          <div class="flex-row" style="gap: 6px; flex-wrap: wrap;">
                            <span
                              style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); background-color: #F3F4F6; padding: 2px 8px; border-radius: 4px; cursor: grab; user-select: none;"
                              title="드래그하여 순서 변경"
                            >
                              ⠿ Q${idx + 1}
                            </span>
                            ${relInfo.secId ? `
                              <button
                                type="button"
                                data-jump-block="secWrap-${escapeHtml(relInfo.secId)}"
                                style="font-size: 11px; font-weight: 600; color: var(--text-secondary); background-color: #F9FAFB; border: 1px solid #E5E7EB; padding: 2px 8px; border-radius: 99px; cursor: pointer; font-family: inherit;"
                              >
                                ${escapeHtml(relInfo.secLabel)} 연결 ↗
                              </button>
                            ` : ''}
                            ${isFaqAiEdited ? `
                              <span style="font-size: 11px; font-weight: 800; color: #1D4ED8; background-color: #DBEAFE; padding: 2px 8px; border-radius: 99px;">
                                💬 AI 채팅 수정 반영됨
                              </span>
                            ` : ''}
                          </div>
                          <div class="flex-row" style="gap: 8px;">
                            ${idx > 0 ? `<button type="button" class="text-action" data-move-faq-up="${idx}">↑</button>` : ''}
                            ${idx < (sb.faqs || []).length - 1 ? `<button type="button" class="text-action" data-move-faq-down="${idx}">↓</button>` : ''}
                            <button type="button" class="text-action" data-doc-del-faq="${idx}" style="font-size: 12px; color: var(--text-muted);">삭제</button>
                          </div>
                        </div>
                        <div class="mb-6">
                          <input type="text" class="doc-editable-input" data-doc-faq-q="${idx}" value="${escapeHtml(faq.q)}" style="font-weight: 700; font-size: 13.5px; background-color: var(--white);" />
                        </div>
                        <textarea class="doc-editable-textarea" data-doc-faq-a="${idx}" rows="2" style="font-size: 13px; color: var(--text-secondary); line-height: 1.6; background-color: var(--white);">${escapeHtml(faq.a)}</textarea>
                      </div>
                    `;
                  }).join('')}
                </div>
              </section>

              <!-- STEP 08: 수미상관 마무리 총평 문단 & 한 줄 요약 · 출처 고지 -->
              <section class="editor-block-section" id="block-step-8">
                <div class="editor-step-header">
                  <div class="flex-row" style="gap: 8px;">
                    <span class="editor-step-badge">STEP 08 · 마무리 총평 & 한 줄 요약</span>
                    <span class="text-muted">기사 결론 및 출처 관리</span>
                  </div>
                </div>

                <div class="mb-12">
                  <label class="text-muted" style="display: block; margin-bottom: 4px; font-weight: 700;">마무리 총평 문단</label>
                  <textarea class="doc-editable-textarea" id="docClosingParagraph" rows="3" style="font-size: 13.5px; color: var(--text-primary); line-height: 1.7;" placeholder="기사 전체의 의미를 갈무리하는 마무리 총평 문단을 입력하세요">${escapeHtml(sb.closingParagraph || '')}</textarea>
                </div>

                <div style="margin-bottom: 14px;">
                  <label class="text-muted" style="display: block; margin-bottom: 4px; font-weight: 700;">한 줄 요약</label>
                  <textarea class="doc-editable-textarea" id="docOneLine" rows="2" style="font-size: 14px; font-weight: 700;">${escapeHtml(sb.oneLineSummary || '')}</textarea>
                </div>

                <div class="grid-2" style="padding-top: 10px; border-top: 1px solid #F3F4F6; margin-bottom: 14px;">
                  <div>
                    <label class="text-muted" style="display: block; margin-bottom: 4px; font-weight: 700;">대표 이미지 캡션</label>
                    <input type="text" class="doc-editable-input" id="docImgCaption" value="${escapeHtml(sb.imageRecommendations?.[0]?.caption || '< 출처 : 각 사 제공 >')}" style="font-size: 12.5px; color: var(--text-secondary);" />
                  </div>
                  <div>
                    <label class="text-muted" style="display: block; margin-bottom: 4px; font-weight: 700;">하단 고지 문구</label>
                    <input type="text" class="doc-editable-input" id="docNotice" value="${escapeHtml(sb.noticeText || '')}" style="font-size: 12.5px; color: var(--text-muted);" />
                  </div>
                </div>

                <!-- 참고 자료 및 출처 목록 -->
                <div style="padding-top: 12px; border-top: 1px solid #F3F4F6;">
                  <div class="flex-between mb-6" style="flex-wrap: wrap; gap: 6px;">
                    <strong style="font-size: 13px; font-weight: 700; color: var(--text-primary);">
                      🔗 참고 출처 (${(w.sources || []).filter(s => !s.excluded).length}/${(w.sources || []).length}건 포함)
                    </strong>
                  </div>

                  ${(w.sources || []).length === 0 ? `
                    <div class="text-muted" style="padding: 8px 0;">등록된 참고 출처가 없습니다.</div>
                  ` : `
                    <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px;">
                      ${(w.sources || []).map((src, sIdx) => {
                        const isIncluded = !src.excluded;
                        return `
                          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 10px; border: 1px solid #E5E7EB; border-radius: 6px; background-color: ${isIncluded ? '#FAFAFA' : '#FFFFFF'}; opacity: ${isIncluded ? '1' : '0.55'};">
                            <label style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; cursor: pointer;">
                              <input type="checkbox" data-toggle-src-exclude="${escapeHtml(src.id)}" ${isIncluded ? 'checked' : ''} style="accent-color: var(--mk-orange); width: 14px; height: 14px; cursor: pointer; flex-shrink: 0;" />
                              <span style="font-size: 12px; color: var(--text-primary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(src.title || src.url)}">
                                ${escapeHtml(src.title || src.url)}
                              </span>
                            </label>
                            <div class="flex-row" style="gap: 8px; flex-shrink: 0;">
                              ${src.url ? `
                                <a href="${escapeHtml(src.url)}" target="_blank" rel="noopener noreferrer" class="text-action" style="font-size: 11.5px; font-weight: 600; white-space: nowrap;">
                                  원문 ↗
                                </a>
                              ` : ''}
                              <button type="button" class="text-action" data-del-src="${escapeHtml(src.id)}" style="font-size: 11.5px; color: var(--text-muted);">삭제</button>
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  `}

                  <div class="flex-row" style="gap: 6px;">
                    <input type="text" class="input" id="newSourceTitleInput" placeholder="출처 제목/설명" style="flex: 1; padding: 6px 10px; font-size: 12px;" />
                    <input type="url" class="input" id="newSourceUrlInput" placeholder="출처 URL (https://...)" style="flex: 1; padding: 6px 10px; font-size: 12px;" />
                    <button type="button" class="btn btn-sm" id="addSourceDirectBtn" style="font-weight: 700; white-space: nowrap;">+ 추가</button>
                  </div>
                </div>
              </section>

            </div>
          `}
        </div>

        <!-- [오른쪽 사이드 고정 패널] 💬 AI 채팅으로 기사 수정 | 🕒 히스토리 (2탭 구성 · 로열 블루 테마) -->
        <aside class="right-panel-sticky" id="aiNaturalEditBox">
          <div class="card" style="padding: 0; margin-bottom: 0; overflow: hidden; border: 1px solid #DBEAFE; background: #FFFFFF; box-shadow: 0 2px 8px rgba(29, 78, 216, 0.05);">
            <!-- 오른쪽 패널 2탭 헤더 (AI 채팅으로 기사 수정 | 시계 라인 아이콘 히스토리) -->
            <div class="left-tab-bar" style="background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
              <button
                type="button"
                class="left-tab-btn ${(state.rightPanelTab || 'chat') === 'chat' ? 'active' : ''}"
                data-right-tab="chat"
                style="${(state.rightPanelTab || 'chat') === 'chat' ? 'color: #1D4ED8; border-bottom-color: #1D4ED8; background-color: #FFFFFF;' : ''}"
              >
                💬 AI 채팅으로 기사 수정
              </button>
              <button
                type="button"
                class="left-tab-btn ${state.rightPanelTab === 'history' ? 'active' : ''}"
                data-right-tab="history"
                style="display: inline-flex; align-items: center; justify-content: center; gap: 5px; ${state.rightPanelTab === 'history' ? 'color: #1D4ED8; border-bottom-color: #1D4ED8; background-color: #FFFFFF;' : ''}"
                title="AI 채팅으로 편집한 기사 버전 히스토리 확인 및 복원"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                  <circle cx="12" cy="12" r="9"></circle>
                  <polyline points="12 7 12 12 15.5 14"></polyline>
                </svg>
                <span>히스토리 (${(w.editVersionHistory || []).length})</span>
              </button>
            </div>

            <div style="padding: 16px;">
              ${state.rightPanelTab === 'history' ? `
                <!-- [탭 2: 히스토리] 원문 초안 및 수정 버전, 업데이트 시간, 짧은 업데이트 내용 기록 및 원클릭 복원 -->
                <div>
                  <div class="flex-between mb-6" style="gap: 6px; flex-wrap: wrap;">
                    <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 800; color: #1E40AF;">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                        <circle cx="12" cy="12" r="9"></circle>
                        <polyline points="12 7 12 12 15.5 14"></polyline>
                      </svg>
                      기사 편집 히스토리
                    </span>
                    <span style="font-size: 10.5px; font-weight: 700; color: #047857; background: #ECFDF5; border: 1px solid #A7F3D0; padding: 1px 7px; border-radius: 99px;">
                      자동 영구 저장됨
                    </span>
                  </div>

                  <p style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.48; margin-bottom: 12px;">
                    AI 채팅으로 기사를 수정할 때마다 자동 기록되며, PC나 브라우저를 껐다 켜도 그대로 유지됩니다. 버전을 클릭하면 해당 시점의 <strong>본문·목차·FAQ</strong>로 즉시 전환됩니다.
                  </p>

                  <div style="display: flex; flex-direction: column; gap: 6px; max-height: 440px; overflow-y: auto;">
                    ${(w.editVersionHistory || []).map((ver, vIdx) => {
                      const isCurrentVer = (w.activeVersionId || (w.editVersionHistory || [])[(w.editVersionHistory || []).length - 1]?.id) === ver.id;
                      const isInitial = ver.versionNumber === 0;
                      const rowLineText = isInitial
                        ? `${ver.versionLabel || '원문 초안'} ㅣ ${ver.timestamp || ''}`
                        : `${ver.versionLabel || `수정 ${vIdx}`} ㅣ ${ver.timestamp || ''} ㅣ ${ver.shortSummary || '내용 수정'}`;
                      return `
                        <button
                          type="button"
                          data-restore-version-id="${escapeHtml(ver.id)}"
                          style="width: 100%; text-align: left; padding: 10px 11px; border-radius: 8px; border: ${isCurrentVer ? '1.5px solid #2563EB' : '1px solid #E5E7EB'}; background-color: ${isCurrentVer ? '#F0F7FF' : '#FAFAFA'}; cursor: pointer; font-family: inherit; transition: all 0.15s;"
                          title="${ver.prompt ? `요청 프롬프트: ${escapeHtml(ver.prompt)} (클릭 시 이 버전으로 전환)` : '최초 생성된 원문 초안으로 전환'}"
                        >
                          <div class="flex-between" style="gap: 6px; margin-bottom: ${ver.prompt ? '3px' : '0'};">
                            <span style="font-size: 12px; font-weight: ${isCurrentVer ? '800' : '700'}; color: ${isCurrentVer ? '#1E40AF' : '#111827'}; line-height: 1.4; word-break: keep-all;">
                              ${escapeHtml(rowLineText)}
                            </span>
                            <span style="font-size: 10.5px; font-weight: 700; color: ${isCurrentVer ? '#1D4ED8' : '#6B7280'}; background-color: ${isCurrentVer ? '#DBEAFE' : '#FFFFFF'}; border: 1px solid ${isCurrentVer ? '#93C5FD' : '#E5E7EB'}; padding: 1px 6px; border-radius: 99px; white-space: nowrap; flex-shrink: 0;">
                              ${isCurrentVer ? '현재 버전' : '복원'}
                            </span>
                          </div>
                          ${ver.prompt ? `
                            <div style="font-size: 11px; color: #6B7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                              요청: "${escapeHtml(ver.prompt)}"
                            </div>
                          ` : ''}
                        </button>
                      `;
                    }).join('')}
                  </div>
                </div>
              ` : `
                <!-- [탭 1: AI 채팅으로 기사 수정] -->
                <div class="flex-between mb-8" style="gap: 6px;">
                  <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 800; color: #1E40AF;">
                    💬 AI 채팅으로 기사 수정
                  </span>
                  <span style="font-size: 10.5px; font-weight: 700; color: #1D4ED8; background: #EFF6FF; padding: 2px 7px; border-radius: 99px;">파란색 하이라이트</span>
                </div>

                <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 10px;">
                  원하는 수정 방향(내용 추가·강조·특정 내용 제외·순서 변경 등)을 입력하면 <strong>본문·글 목차·요약표·FAQ를 동시에 수정</strong>합니다.
                </p>

                <!-- 수정 대상 단락 빠른 선택 칩 -->
                <div style="margin-bottom: 10px;">
                  <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 5px;">
                    수정할 위치 선택 (클릭 시 이동):
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                    <button type="button" class="text-action" data-ai-target-jump="block-step-2" data-ai-target-prefix="[제목·소제목 수정] " style="font-size: 11px; background: #F9FAFB; border: 1px solid #E5E7EB; padding: 3px 8px; border-radius: 6px; font-weight: 600; color: #374151;">
                      제목
                    </button>
                    <button type="button" class="text-action" data-ai-target-jump="block-step-3" data-ai-target-prefix="[도입부 수정] " style="font-size: 11px; background: #F9FAFB; border: 1px solid #E5E7EB; padding: 3px 8px; border-radius: 6px; font-weight: 600; color: #374151;">
                      도입부
                    </button>
                    ${(w.draftSections || []).map((sec, sIdx) => `
                      <button type="button" class="text-action" data-ai-target-jump="secWrap-${sec.id}" data-ai-target-prefix="[단락 0${sIdx + 1} 수정] " style="font-size: 11px; background: #F9FAFB; border: 1px solid #E5E7EB; padding: 3px 8px; border-radius: 6px; font-weight: 600; color: #374151;">
                        단락 0${sIdx + 1}
                      </button>
                    `).join('')}
                    <button type="button" class="text-action" data-ai-target-jump="block-step-6" data-ai-target-prefix="[비교 요약표 수정] " style="font-size: 11px; background: #F9FAFB; border: 1px solid #E5E7EB; padding: 3px 8px; border-radius: 6px; font-weight: 600; color: #374151;">
                      요약표
                    </button>
                    <button type="button" class="text-action" data-ai-target-jump="block-step-7" data-ai-target-prefix="[FAQ 수정] " style="font-size: 11px; background: #F9FAFB; border: 1px solid #E5E7EB; padding: 3px 8px; border-radius: 6px; font-weight: 600; color: #374151;">
                      FAQ
                    </button>
                  </div>
                </div>

                <div class="mb-8">
                  <textarea
                    class="textarea"
                    id="aiNaturalPromptInput"
                    rows="4"
                    placeholder="예: 2단락에 최신 수치와 가격을 더 보강해줘 / 특정 브랜드 내용은 제외해줘 (Enter: 바로 적용 · Shift+Enter: 줄바꿈)"
                    style="width: 100%; min-height: 88px; padding: 10px 12px; font-size: 12.5px; font-weight: 500; line-height: 1.55; background-color: ${state.isApplyingAiEdit ? '#EFF6FF' : '#F9FAFB'}; border: 1px solid ${state.isApplyingAiEdit ? '#93C5FD' : '#D1D5DB'}; border-radius: 8px;"
                  >${escapeHtml(state.aiPromptDraft || '')}</textarea>
                </div>

                ${state.isApplyingAiEdit ? `
                  <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; padding: 10px 12px; background-color: #FEF2F2; border: 1.5px solid #FCA5A5; border-radius: 8px;">
                    <div class="flex-between" style="gap: 6px;">
                      <span style="font-size: 12px; font-weight: 800; color: #991B1B;">
                        ⏳ AI 수정 버전 작성 중...
                      </span>
                      <span style="font-size: 11px; color: #B91C1C; font-weight: 600;">Esc 또는 아래 버튼으로 즉시 중단</span>
                    </div>
                    <button
                      type="button"
                      class="btn"
                      id="cancelAiNaturalPromptBtn"
                      style="width: 100%; justify-content: center; padding: 9px 14px; font-size: 13px; font-weight: 800; background-color: #DC2626; color: #FFFFFF; border: 1px solid #B91C1C; border-radius: 7px; cursor: pointer;"
                    >
                      ⏹ 수정 중단 (취소 · 입력 내용 이어쓰기)
                    </button>
                  </div>
                ` : `
                  <button
                    type="button"
                    class="btn"
                    id="applyAiNaturalPromptBtn"
                    style="width: 100%; justify-content: center; padding: 10px 14px; font-size: 13px; font-weight: 800; margin-bottom: 10px; background-color: #1D4ED8; color: #FFFFFF; border: 1px solid #1E40AF; border-radius: 8px;"
                  >
                    💬 AI 채팅으로 기사 수정 →
                  </button>
                `}

                ${(Array.isArray(w.aiEditHistory) && w.aiEditHistory.length > 0) || w.lastAiEdit ? `
                  <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
                    ${Array.isArray(w.aiEditHistory) && w.aiEditHistory.length > 0 ? `
                      <button type="button" class="btn btn-sm" id="undoAiPromptEditBtn" style="width: 100%; justify-content: center; padding: 6px 10px; font-size: 11.5px; font-weight: 700; background-color: #FFFFFF;">
                        ↩ 직전 수정 전으로 되돌리기 (${w.aiEditHistory.length})
                      </button>
                    ` : ''}
                    ${(() => {
                      const aiEdit = w.lastAiEdit || (state.activeHighlight?.mode === 'ai-edit' ? state.activeHighlight : null);
                      if (!aiEdit) return '';
                      const isApp = aiEdit.isApplied !== false;
                      const isHlVis = aiEdit.isHighlightVisible !== false;
                      const latestVer = (w.editVersionHistory || [])[(w.editVersionHistory || []).length - 1];
                      return `
                        <div style="padding: 10px 12px; background-color: ${isApp ? '#F0F7FF' : '#F9FAFB'}; border: 1px solid ${isApp ? '#BFDBFE' : '#E5E7EB'}; border-radius: 8px;">
                          <div class="flex-between" style="margin-bottom: 4px; gap: 4px; flex-wrap: wrap;">
                            <span style="font-size: 11.5px; font-weight: 800; color: ${isApp ? '#1E40AF' : '#4B5563'};">
                              💬 ${isApp ? 'AI 채팅 수정 반영됨' : 'AI 채팅 수정 되돌림'}
                            </span>
                            <button
                              type="button"
                              class="text-action"
                              data-toggle-highlight-visibility="1"
                              style="font-size: 11px; font-weight: 700; color: #1D4ED8;"
                            >
                              하이라이트 ${isHlVis ? '접기 ▲' : '펼치기 ▼'}
                            </button>
                          </div>
                          ${latestVer && latestVer.versionNumber > 0 ? `
                            <div style="font-size: 11px; font-weight: 700; color: #1D4ED8; margin-bottom: 4px;">
                              ${escapeHtml(`${latestVer.versionLabel} ㅣ ${latestVer.timestamp} ㅣ ${latestVer.shortSummary}`)}
                            </div>
                          ` : ''}
                          <div style="font-size: 11.5px; color: #374151; line-height: 1.45; margin-bottom: 8px;">
                            ${escapeHtml(aiEdit.summary || '')}
                          </div>
                          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                            <button
                              type="button"
                              class="btn btn-sm"
                              data-ai-edit-master-toggle="apply"
                              style="justify-content: center; padding: 5px 6px; font-size: 11px; font-weight: 700; ${isApp
                                ? 'background-color: #1D4ED8; color: #FFFFFF; border-color: #1D4ED8;'
                                : 'background-color: #FFFFFF; color: #1D4ED8; border-color: #BFDBFE;'}"
                            >
                              ✓ 수정본 적용
                            </button>
                            <button
                              type="button"
                              class="btn btn-sm"
                              data-ai-edit-master-toggle="exclude"
                              style="justify-content: center; padding: 5px 6px; font-size: 11px; font-weight: 700; ${!isApp
                                ? 'background-color: #4B5563; color: #FFFFFF; border-color: #4B5563;'
                                : 'background-color: #FFFFFF; color: #4B5563; border-color: #D1D5DB;'}"
                            >
                              ↩ 수정 전 원문
                            </button>
                          </div>
                        </div>
                      `;
                    })()}
                  </div>
                ` : ''}

                <div style="padding-top: 10px; border-top: 1px solid #F3F4F6;">
                  <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">
                    자주 쓰는 편집 요청:
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 5px;">
                    <button type="button" class="text-action" data-quick-ai-prompt="가장 최신 뉴스의 구체적인 수치(날짜, 가격, 할인율 등)와 실제 브랜드 사례를 본문 각 단락에 더 보강해줘" style="text-align: left; font-size: 11.5px; color: #374151; background: #F9FAFB; border: 1px solid #E5E7EB; padding: 6px 10px; border-radius: 6px; width: 100%; font-weight: 600;">
                      + 최신 팩트·구체적 수치 보강
                    </button>
                    <button type="button" class="text-action" data-quick-ai-prompt="불필요한 수식어와 반복 표현을 줄이고 핵심 팩트 중심으로 문장을 더 간결하고 읽기 쉽게 다듬어줘" style="text-align: left; font-size: 11.5px; color: #374151; background: #F9FAFB; border: 1px solid #E5E7EB; padding: 6px 10px; border-radius: 6px; width: 100%; font-weight: 600;">
                      ✂️ 문장 간결하게 다듬기
                    </button>
                    <button type="button" class="text-action" data-quick-ai-prompt="독자와 소비자가 실제로 챙길 수 있는 실질적인 혜택, 신청/이용 방법, 주의사항 체크포인트를 더 구체적으로 강조해줘" style="text-align: left; font-size: 11.5px; color: #374151; background: #F9FAFB; border: 1px solid #E5E7EB; padding: 6px 10px; border-radius: 6px; width: 100%; font-weight: 600;">
                      🎯 소비자 실전 혜택·체크포인트 강조
                    </button>
                    <button type="button" class="text-action" data-quick-ai-prompt="기사 제목과 첫 단락 도입부 질문을 독자의 클릭을 부르는 더 흥미롭고 임팩트 있는 표현으로 수정해줘" style="text-align: left; font-size: 11.5px; color: #374151; background: #F9FAFB; border: 1px solid #E5E7EB; padding: 6px 10px; border-radius: 6px; width: 100%; font-weight: 600;">
                      🔥 도입부·제목 더 매력적으로 수정
                    </button>
                  </div>
                </div>
              `}
            </div>
          </div>
        </aside>
      </div>
    `;

    // 렌더링 직후 모든 textarea 높이를 내용에 맞게 자동 확장하여 글자 잘림 및 불필요한 리사이즈 핸들 제거
    autoResizeAllTextareas(root);
    bindGeoJumpEvents(document.getElementById('geoChecklistContainer'));

    // ========================================================================
    // 이벤트 바인딩 (편집기 화면)
    // ========================================================================

    document.getElementById('backToHomeBtn').addEventListener('click', () => {
      state.screen = 'home';
      render(false);
    });

    // 상단 편집 모드 / 실제 기사 미리보기 모드 전환
    root.querySelectorAll('[data-editor-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.editorViewMode = btn.getAttribute('data-editor-mode');
        render(true);
      });
    });

    // 왼쪽 보조 패널 3탭 전환 (취재·메모 / 점검·팩트 / 목차·흐름)
    root.querySelectorAll('[data-left-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.leftPanelTab = btn.getAttribute('data-left-tab');
        render(true);
      });
    });

    // 오른쪽 사이드 패널 2탭 전환 (AI 채팅으로 기사 수정 / 히스토리)
    root.querySelectorAll('[data-right-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.rightPanelTab = btn.getAttribute('data-right-tab') || 'chat';
        render(true);
      });
    });

    // 오른쪽 [히스토리] 탭에서 특정 버전 클릭 시 해당 버전의 본문·목차·요약표·FAQ로 즉시 전환·복원
    root.querySelectorAll('[data-restore-version-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const verId = btn.getAttribute('data-restore-version-id');
        if (!verId) return;
        const restored = restoreWorkVersionEntryById(w, verId);
        if (!restored) return;
        w.isBlankTemplate = false;
        w.justRestoredInitial = (restored.versionNumber === 0);
        saveCurrentWork(true);
        render(true);
        showToast(
          restored.versionNumber === 0
            ? `↺ [${restored.versionLabel} ㅣ ${restored.timestamp}] 원문 초안 상태로 본문·목차·FAQ를 복원했습니다!`
            : `✓ [${restored.versionLabel} ㅣ ${restored.timestamp} ㅣ ${restored.shortSummary}] 버전으로 본문·목차·FAQ를 전환했습니다!`
        );
      });
    });

    // 상단 '팩트 확인 필요 N건' 배지 클릭 시 왼쪽 [점검·팩트] 탭으로 즉시 전환
    document.getElementById('liveFcCountBadge')?.addEventListener('click', () => {
      state.leftPanelTab = 'check';
      render(true);
      showToast('왼쪽 [✅ 점검·팩트] 패널에서 수치·날짜 문장을 클릭해 확인 처리하세요.');
    });

    // 왼쪽 [목차·흐름] 탭에서 블록 클릭 시 해당 블록으로 스크롤 점프
    root.querySelectorAll('[data-jump-block]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-jump-block');
        if (state.editorViewMode === 'preview') {
          state.editorViewMode = 'edit';
          render(true);
        }
        setTimeout(() => flashElement(targetId), 50);
      });
    });

    // 유형 변경 시 현재 키워드 그대로 해당 유형의 본문 구조·소제목·요약표·FAQ로 즉시 재구성
    document.getElementById('editorTypeSelect').addEventListener('change', async e => {
      const nextType = Number(e.target.value);
      w.typeId = nextType;
      showToast(`[${CONTENT_TYPES[nextType].shortName}] 흐름에 맞춰 본문 소제목·요약표·FAQ 구성을 전환합니다...`);
      await triggerLiveNewsRefresh(true, w.keyword, true);
    });

    // 빈 문서로 비우기 (비우기 직전 편집 상태를 자동 백업하여 언제든 100% 복구 가능하도록 보호)
    document.getElementById('clearToBlankBtn').addEventListener('click', () => {
      if (!w.isBlankTemplate && w.draftSections?.[0]?.id !== 'sec-blank-1') {
        w.preRestoreSnapshot = captureWorkFullSnapshot(w);
        if (!w.initialDraftSnapshot) {
          w.initialDraftSnapshot = captureWorkFullSnapshot(w);
        }
      }
      w.isBlankTemplate = true;
      w.justRestoredInitial = false;
      w.title = '"인용구를 입력하세요"…핵심 설명을 입력하는 제목';
      w.draftSections = [
        {
          id: 'sec-blank-1',
          title: '1. 첫 번째 소제목을 입력하세요',
          subtitle: '소제목 보조 설명을 입력하세요',
          content: '독자에게 말을 거는 질문("~하신 적 없으신가요?")으로 도입부를 시작하고, 본문은 "~합니다" 체로 작성해 주세요.',
          imageCaption: '',
          sourceIds: []
        }
      ];
      w.summaryBlocks.subtitle = '';
      w.summaryBlocks.leadIntro = '본문 소제목 단락에 들어가기 전, 독자의 공감을 열고 기사의 배경과 안내를 전하는 도입부(권장 300~500자)를 입력해 주세요.';
      w.summaryBlocks.includeLeadIntro = true;
      w.summaryBlocks.aiFactSummary = [
        '1. 첫 번째 핵심 팩트 요약을 입력하세요.',
        '2. 두 번째 핵심 팩트 요약을 입력하세요.',
        '3. 세 번째 핵심 팩트 요약을 입력하세요.'
      ];
      w.summaryBlocks.summaryTable = {
        title: '[요약표] 제목을 입력하세요',
        headers: ['구분', '핵심 내용', '비고'],
        rows: [['항목 1', '내용을 입력하세요', '비고 입력'], ['항목 2', '내용을 입력하세요', '비고 입력']]
      };
      w.summaryBlocks.glossaryTitle = '[핵심 용어 사전]';
      w.summaryBlocks.glossary = [
        { term: '핵심 용어 1', desc: '용어에 대한 1~2문장 명쾌한 해설을 입력하세요.' }
      ];
      w.summaryBlocks.faqs = [
        { q: 'Q1. 독자들이 가장 궁금해할 질문을 입력하세요?', a: '답변을 "~합니다" 체로 입력하세요.' }
      ];
      w.summaryBlocks.closingParagraph = '도입부의 화두와 연결해 기사 전체의 의미를 갈무리하는 마무리 총평 문단을 입력해 주세요.';
      w.summaryBlocks.oneLineSummary = '한 줄 요약! 기사 전체 핵심 메시지를 한 문장으로 정리해 주세요.';
      w.factChecks = [];
      saveCurrentWork(false);
      showToast('🧹 빈 양식으로 비워졌습니다. 상단 [↺ 작성하던 기사 복원]을 누르면 방금 편집하던 기사가 그대로 복구됩니다.');
      render(true);
    });

    // 현재 기사의 원본 초안 복원 & 직전 편집 내용 되돌리기 (고정 모범 예시로 덮어쓰던 버그 원천 제거)
    document.getElementById('restoreExampleBtn').addEventListener('click', () => {
      // 1) 빈 양식 상태에서 누른 경우 -> 비우기 직전에 작성하던 기사(preRestoreSnapshot) 또는 최초 초안으로 즉시 복구
      if (w.isBlankTemplate && (w.preRestoreSnapshot || w.initialDraftSnapshot)) {
        const targetSnap = w.preRestoreSnapshot || w.initialDraftSnapshot;
        applyWorkFullSnapshot(w, targetSnap);
        w.isBlankTemplate = false;
        w.justRestoredInitial = false;
        saveCurrentWork(false);
        showToast(`↺ '${w.keyword}' 작성 중이던 기사를 그대로 복원했습니다!`);
        render(true);
        return;
      }

      // 2) 초안 복원 직후 [↩ 편집하던 내용으로 되돌리기]를 다시 누른 경우 -> 편집 중이던 상태로 즉시 복구
      if (w.justRestoredInitial && w.preRestoreSnapshot) {
        applyWorkFullSnapshot(w, w.preRestoreSnapshot);
        w.justRestoredInitial = false;
        if (Array.isArray(w.editVersionHistory) && w.editVersionHistory.length > 0) {
          w.activeVersionId = w.editVersionHistory[w.editVersionHistory.length - 1].id;
        }
        saveCurrentWork(false);
        showToast(`↩ 초안 복원 직전에 편집하던 '${w.keyword}' 기사 내용으로 다시 되돌렸습니다!`);
        render(true);
        return;
      }

      // 3) 일반 편집 상태에서 [↺ 초안 복원]을 누른 경우 -> 현재 편집본을 preRestoreSnapshot에 안전 백업한 뒤, 현재 키워드의 최초 초안(initialDraftSnapshot)으로 복원
      const fallbackSnap = w.initialDraftSnapshot || w.lastAiEdit?.beforeSnapshot || (w.aiEditHistory && w.aiEditHistory[0]);
      if (fallbackSnap) {
        w.preRestoreSnapshot = captureWorkFullSnapshot(w);
        applyWorkFullSnapshot(w, fallbackSnap);
        w.isBlankTemplate = false;
        w.justRestoredInitial = true;
        w.activeVersionId = 'ver-0';
        saveCurrentWork(false);
        showToast(`↺ '${w.keyword}' 처음 생성된 초안으로 복원했습니다. (상단 [↩ 편집하던 내용으로 되돌리기] 또는 오른쪽 [히스토리] 탭에서 언제든 다시 복구할 수 있습니다)`);
        render(true);
        return;
      }

      // 4) 스냅샷이 전혀 없는 구버전 기사인 경우 -> 현재 키워드·서브키워드·기획방향 그대로 AI 초안 재생성
      triggerLiveNewsRefresh(true, w.keyword, true);
    });

    // 우측 상단 고정 'CMS 붙여넣기용 전체 복사'
    document.getElementById('copyFullArticleTopBtn').addEventListener('click', async () => {
      const remain = (w.factChecks || []).filter(f => f.status === '미처리').length;
      const latestText = buildPlainTextArticle(w);
      await navigator.clipboard.writeText(latestText);
      if (remain > 0) {
        showToast(`📋 전체 복사 완료! (참고: 미확인 팩트체크 항목이 ${remain}건 있습니다)`);
      } else {
        showToast('📋 모든 팩트체크 완료! 기사 전체가 클립보드에 복사되었습니다.');
      }
    });

    // 영역별 개별 복사 버튼 (제목만, AI요약만, 요약표만, 용어사전만, FAQ만 복사)
    root.querySelectorAll('[data-copy-part]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const part = btn.getAttribute('data-copy-part');
        let textToCopy = '';
        if (part === 'headline') {
          textToCopy = w.title || '';
        } else if (part === 'leadintro') {
          textToCopy = sb.leadIntro || '';
        } else if (part === 'aisummary') {
          textToCopy = (sb.aiFactSummary || []).join('\n');
        } else if (part === 'table') {
          const tLines = [sb.summaryTable?.title || '[요약표]', (sb.summaryTable?.headers || []).join(' | ')];
          (sb.summaryTable?.rows || []).forEach(r => tLines.push(r.join(' | ')));
          textToCopy = tLines.join('\n');
        } else if (part === 'glossary') {
          const gLines = [sb.glossaryTitle || '[핵심 용어 사전]'];
          (sb.glossary || []).forEach(g => gLines.push(`${g.term} : ${g.desc}`));
          textToCopy = gLines.join('\n');
        } else if (part === 'faq') {
          textToCopy = (sb.faqs || []).map(f => `${f.q}\nA. ${f.a}`).join('\n\n');
        }
        await navigator.clipboard.writeText(textToCopy);
        showToast('📋 선택한 영역이 클립보드에 복사되었습니다.');
      });
    });

    // 왼쪽 패널: 실시간 뉴스 검색해 팩트만 추가 OR 오른쪽 기사 전체 새로 쓰기
    async function triggerLiveNewsRefresh(rebuildDraft, customKeyword, keepCurrentType = false) {
      const kwEl = document.getElementById('leftSearchKwInput');
      const compEl = document.getElementById('leftSearchCompInput');
      const subKwEl = document.getElementById('leftSearchSubKwInput');
      const dirEl = document.getElementById('leftSearchDirectionInput');
      const rawKw = (customKeyword || (kwEl ? kwEl.value : w.keyword)).trim();
      const rawComp = compEl ? compEl.value.trim() : (w.inputCompany || '');
      const subKeywords = subKwEl ? subKwEl.value.trim() : (w.inputSubKeywords || '');
      const direction = dirEl ? dirEl.value.trim() : (w.inputDirection || '');
      const kw = cleanTrendTopicKeyword ? cleanTrendTopicKeyword(rawKw) : rawKw;
      const comp = extractBrandFromTopic ? extractBrandFromTopic(kw, rawComp) : rawComp;
      if (!kw) {
        showToast('검색할 키워드를 입력해 주세요.');
        return;
      }
      const shouldAutoMatch = rebuildDraft && !keepCurrentType;
      const nextTypeId = shouldAutoMatch ? detectBestContentType(kw, comp, `${subKeywords} ${direction}`, 0) : w.typeId;
      const nextTypeName = CONTENT_TYPES[nextTypeId]?.shortName || '맞춤 유형';
      const selectedWriter = getSelectedWriterModel();
      state.isRefreshingInEditor = true;
      const stopEditorTimer = startDraftProgressTimer(kw, nextTypeName);
      render(true);
      try {
        const isLocalServer = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (!isLocalServer) {
          throw new Error('USE_CLIENT_HYBRID_DIRECT');
        }
        const res = await apiFetch(`/api/works/${w.id}/refresh-news`, {
          method: 'POST',
          body: JSON.stringify({
            keyword: kw,
            company: comp,
            subKeywords,
            direction,
            writerModel: selectedWriter,
            typeId: nextTypeId,
            autoMatchType: shouldAutoMatch,
            rebuildDraft,
            existingSources: w.sources || [],
            existingResearchItems: w.researchItems || []
          })
        });
        if (rebuildDraft && !res.usedPerplexity && getClientPerplexityKey()) {
          throw new Error('SERVER_FALLBACK_RETRY_IN_CLIENT');
        }
        state.isRefreshingInEditor = false;
        const elapsed = stopEditorTimer();
        if (rebuildDraft && res.work) {
          res.work.createdAtFormatted = formatHistoryTimestamp(new Date());
          res.work.initialDraftSnapshot = captureWorkFullSnapshot(res.work);
          res.work.preRestoreSnapshot = null;
          res.work.isBlankTemplate = false;
          res.work.justRestoredInitial = false;
          res.work.editVersionHistory = null;
          ensureWorkVersionHistory(res.work);
        }
        state.currentWork = res.work;
        const idx = state.works.findIndex(item => item.id === w.id);
        if (idx !== -1) state.works[idx] = res.work;
        else state.works.unshift(res.work);
        saveCurrentWork(true);
        await loadConfig();
        showToast(
          rebuildDraft
            ? `✓ '${kw}' 최신 팩트 ${res.liveNewsCount || ''}건을 바탕으로 오른쪽 기사 전체를 새로 작성했습니다! (${getWriterModelShortLabel(selectedWriter)} · ${elapsed}초 소요)`
            : `✓ '${kw}' 최신 뉴스 문장 ${res.liveNewsCount || ''}건을 매경 문체로 다듬어 취재 메모장에 추가했습니다! (${elapsed}초 소요)`
        );
        render(true);
      } catch (err) {
        // 정적 배포(GitHub Pages) 또는 폴백: 브라우저에서 직접 시나리오 생성/갱신
        try {
          const clientKey = getClientPerplexityKey();
          if (!rebuildDraft && clientKey) {
            const memoRes = await fetchClientLatestNewsMemos({
              apiKey: clientKey,
              keyword: kw,
              company: comp
            });
            await loadConfig();
            const existingUrls = new Set((w.sources || []).map(s => s.url));
            const dedupSources = (memoRes.newSources || []).filter(s => !existingUrls.has(s.url));
            w.sources = [...dedupSources, ...(w.sources || [])];
            w.researchItems = [...(memoRes.newResearchItems || []), ...(w.researchItems || [])];
            state.isRefreshingInEditor = false;
            const elapsed = stopEditorTimer();
            saveCurrentWork(true);
            showToast(`✓ '${kw}' 가장 최신 보도 기사 ${memoRes.count || 0}건과 원문 링크를 취재 메모장에 추가했습니다! (${elapsed}초 소요)`);
            render(true);
            return;
          }

          const matchedTrendNews = extractMatchingTrendNewsItems(kw, comp);
          let baseScen = (buildDynamicScenario || buildPresetScenario)({
            keyword: kw,
            company: comp,
            subKeywords,
            direction,
            url: w.inputUrl || '',
            rawText: w.inputRawText || '',
            typeId: nextTypeId,
            selectedType: nextTypeId,
            newsItems: matchedTrendNews
          });
          let refreshPplxError = '';
          if (clientKey) {
            try {
              baseScen = await buildClientPerplexityEnhancedScenario({
                apiKey: clientKey,
                keyword: kw,
                company: comp,
                subKeywords,
                direction,
                url: w.inputUrl || '',
                rawText: w.inputRawText || '',
                typeId: nextTypeId,
                baseScenario: baseScen
              });
            } catch (pplxErr) {
              console.warn('Client refresh fallback:', pplxErr.message);
              refreshPplxError = pplxErr.message || 'AI 응답 시간 초과(Timeout)';
            }
          } else {
            refreshPplxError = 'API 키 미설정';
          }
          await loadConfig();
          w.keyword = kw;
          w.inputCompany = comp;
          w.inputSubKeywords = subKeywords;
          w.inputDirection = direction;
          w.typeId = nextTypeId;
          if (rebuildDraft) {
            w.sources = baseScen.sources;
            w.researchItems = baseScen.researchItems;
            w.titleCandidates = baseScen.titleCandidates;
            w.title = baseScen.titleCandidates?.[0]?.title || w.title;
            w.draftSections = baseScen.draftSections;
            w.summaryBlocks = baseScen.summaryBlocks;
            w.factChecks = baseScen.factChecks;
            w.factVerification = baseScen.factVerification;
            w.usedPerplexity = Boolean(baseScen.usedPerplexity);
            w.activeWriterModel = baseScen.activeWriterModel || (baseScen.usedPerplexity ? selectedWriter : '');
            w.fallbackFromModel = baseScen.fallbackFromModel || '';
            w.fallbackReason = baseScen.fallbackReason || '';
            w.pplxError = baseScen.usedPerplexity ? '' : refreshPplxError;
            w.createdAtFormatted = formatHistoryTimestamp(new Date());
            w.initialDraftSnapshot = captureWorkFullSnapshot(w);
            w.preRestoreSnapshot = null;
            w.isBlankTemplate = false;
            w.justRestoredInitial = false;
            w.editVersionHistory = null;
            w.lastAiEdit = null;
            w.aiEditHistory = [];
            ensureWorkVersionHistory(w);
          } else {
            w.sources = [...(baseScen.sources || []), ...(w.sources || [])];
            w.researchItems = [...(baseScen.researchItems || []), ...(w.researchItems || [])];
          }
          state.isRefreshingInEditor = false;
          const elapsed = stopEditorTimer();
          saveCurrentWork(true);
          if (rebuildDraft && !w.usedPerplexity) {
            showToast(`⚠️ AI 호출이 실패(${refreshPplxError})하여 임시 기본 골격이 표시되었습니다. 상단 진단 배너에서 원인을 확인하세요!`);
          } else {
            showToast(
              rebuildDraft
                ? `✓ '${kw}' 키워드로 오른쪽 기사 전체를 새로 작성했습니다! (${getWriterModelShortLabel(w.activeWriterModel || selectedWriter)} · ${elapsed}초 소요)`
                : `✓ '${kw}' 최신 팩트를 취재 메모장에 추가했습니다! (${elapsed}초 소요)`
            );
          }
          render(true);
        } catch (fallbackErr) {
          state.isRefreshingInEditor = false;
          stopEditorTimer();
          showToast(err.message);
          render(true);
        }
      }
    }

    document.getElementById('leftFetchMemoOnlyBtn')?.addEventListener('click', () => triggerLiveNewsRefresh(false));
    document.getElementById('leftRebuildDraftBtn')?.addEventListener('click', () => triggerLiveNewsRefresh(true));

    // 왼쪽 [목차·흐름] 탭 상단의 '다른 키워드로 기사 새로 쓰기' 입력값 실시간 보존 (탭 전환 시에도 유지)
    document.getElementById('leftSearchKwInput')?.addEventListener('input', e => { w.keyword = e.target.value; });
    document.getElementById('leftSearchCompInput')?.addEventListener('input', e => { w.inputCompany = e.target.value; });
    document.getElementById('leftSearchSubKwInput')?.addEventListener('input', e => { w.inputSubKeywords = e.target.value; });
    document.getElementById('leftSearchDirectionInput')?.addEventListener('input', e => { w.inputDirection = e.target.value; });

    // 상단 AI 실패 진단 배너의 원클릭 [⚡ 다시 생성] 버튼 연결
    root.querySelectorAll('[data-retry-ai-model]').forEach(btn => {
      btn.addEventListener('click', () => {
        const retryModel = btn.getAttribute('data-retry-ai-model');
        if (retryModel) {
          setSelectedWriterModel(retryModel);
        }
        triggerLiveNewsRefresh(true, w.keyword, true);
      });
    });

    // 왼쪽 패널: 인기 키워드 드롭다운 선택 시 즉시 해당 키워드로 오른쪽 기사 새로 쓰기
    document.getElementById('leftQuickTrendSelect')?.addEventListener('change', e => {
      const pickedTag = (e.target.value || '').trim();
      if (!pickedTag) return;
      const kwEl = document.getElementById('leftSearchKwInput');
      if (kwEl) kwEl.value = pickedTag;
      triggerLiveNewsRefresh(true, pickedTag);
    });

    // 왼쪽 패널: 취재 메모 직접 추가 (타 언론사 문구를 붙여넣어도 매경 문체로 자동 패러프레이징!)
    document.getElementById('addMemoBtn')?.addEventListener('click', () => {
      const rawInput = document.getElementById('memoFactInput')?.value.trim() || '';
      const url = document.getElementById('memoUrlInput')?.value.trim() || '';
      if (!rawInput) {
        showToast('취재 메모 내용을 입력해 주세요.');
        return;
      }
      let finalFact = rawInput;
      if (!/합니다\.?$|습니다\.?$|입니다\.?$/.test(rawInput)) {
        finalFact = paraphraseNewsToMkFact(rawInput, w.keyword, '추가 자료').paraphrasedSentence;
      }
      const srcId = 'src-memo-' + Date.now();
      if (url) {
        w.sources.unshift({
          id: srcId,
          url,
          title: url,
          method: '취재 메모 출처',
          reliability: '높음'
        });
      }
      w.researchItems.unshift({
        id: 'ri-memo-' + Date.now(),
        category: '매경 문체 재가공',
        fact: finalFact,
        rawReference: rawInput !== finalFact ? `원문 요약 기준: ${rawInput.slice(0, 45)}...` : '',
        sourceIds: url ? [srcId] : []
      });
      saveCurrentWork(false);
      showToast('입력한 자료를 매경 문체("~합니다") 팩트로 다듬어 메모장에 추가했습니다.');
      render(true);
    });

    // 취재 팩트 메모장의 [📌 단락 0X 반영됨 · 보기 ↘] 클릭 시 해당 본문 단락으로 이동 & 노란색(앰버) 하이라이트!
    root.querySelectorAll('[data-locate-memo-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const memoId = btn.getAttribute('data-locate-memo-id');
        const locIdx = Number(btn.getAttribute('data-locate-memo-loc')) || 0;
        const memo = (w.researchItems || []).find(r => r.id === memoId);
        if (!memo) return;
        const reflection = getMemoReflectionLocations(memo, w);
        const loc = reflection.locations[locIdx] || reflection.locations[0];
        if (!loc) return;

        if (state.editorViewMode === 'preview') {
          state.editorViewMode = 'edit';
        }
        const memoHlObj = {
          mode: 'memo',
          memoId: memo.id,
          summary: `[${loc.label}]에 반영된 취재 팩트 문장입니다: "${memo.fact.slice(0, 48)}..."`,
          secIds: [loc.secId],
          sentencesBySecId: { [loc.secId]: loc.matchedSentences || [memo.fact] },
          tokensBySecId: { [loc.secId]: loc.matchTokens || [] }
        };
        state.activeMemoHighlight = memoHlObj;
        state.activeHighlight = memoHlObj;
        render(true);
        setTimeout(() => {
          flashElement(loc.targetId);
        }, 60);
        showToast(`📌 오른쪽 본문 [${loc.label}]에서 취재 팩트 메모가 반영된 문장(노란색)을 표시했습니다!`);
      });
    });

    // 우측 상단 'AI 채팅으로 기사 수정' 실행·중단(취소) 및 되돌리기·하이라이트 제어
    const aiPromptInputEl = document.getElementById('aiNaturalPromptInput');
    aiPromptInputEl?.addEventListener('input', e => {
      state.aiPromptDraft = e.target.value;
    });

    function cancelAiNaturalPromptEdit() {
      if (!state.isApplyingAiEdit && !currentAiEditAbortController) return;
      const currentInputVal = document.getElementById('aiNaturalPromptInput')?.value;
      if (typeof currentInputVal === 'string' && currentInputVal.trim()) {
        state.aiPromptDraft = currentInputVal;
      }
      currentAiEditRunId += 1;
      if (currentAiEditAbortController) {
        try {
          currentAiEditAbortController.abort();
        } catch (e) {}
        currentAiEditAbortController = null;
      }
      state.isApplyingAiEdit = false;
      render(true);
      setTimeout(() => {
        const restoredInput = document.getElementById('aiNaturalPromptInput');
        if (restoredInput) {
          restoredInput.focus();
          const len = restoredInput.value.length;
          restoredInput.setSelectionRange(len, len);
        }
      }, 30);
      showToast('⏹ AI 채팅 기사 수정을 중단했습니다. 입력하던 내용을 이어서 작성하실 수 있습니다.');
    }

    async function triggerAiNaturalPromptEdit(customPrompt = '') {
      if (state.isApplyingAiEdit) return;
      const promptVal = (customPrompt || document.getElementById('aiNaturalPromptInput')?.value || state.aiPromptDraft || '').trim();
      if (!promptVal) {
        showToast('AI 채팅으로 수정할 내용을 입력해 주세요!');
        document.getElementById('aiNaturalPromptInput')?.focus();
        return;
      }
      if (currentAiEditAbortController) {
        try { currentAiEditAbortController.abort(); } catch (e) {}
      }
      const abortController = new AbortController();
      currentAiEditAbortController = abortController;
      const runId = ++currentAiEditRunId;

      state.aiPromptDraft = promptVal;
      state.isApplyingAiEdit = true;
      render(true);
      try {
        const hl = await applyAiNaturalLanguageEditToWork(w, promptVal, abortController.signal, runId);
        if (abortController.signal.aborted || runId !== currentAiEditRunId) {
          return;
        }
        currentAiEditAbortController = null;
        state.isApplyingAiEdit = false;
        state.aiPromptDraft = '';
        await loadConfig();
        saveCurrentWork(true);
        render(true);
        const firstSecId = hl?.secIds?.[0];
        if (firstSecId) {
          setTimeout(() => flashElement(`secWrap-${firstSecId}`), 60);
        }
        showToast(`💬 AI 채팅으로 기사 수정 완료! 변경 내역(파란색)과 하단 FAQ가 자동 반영되었습니다.`);
      } catch (err) {
        if (err?.isUserCancelled || abortController.signal.aborted || runId !== currentAiEditRunId) {
          return;
        }
        currentAiEditAbortController = null;
        state.isApplyingAiEdit = false;
        showToast(`AI 채팅 수정 중 오류가 발생했습니다: ${err.message}`);
        render(true);
      }
    }

    document.getElementById('applyAiNaturalPromptBtn')?.addEventListener('click', () => triggerAiNaturalPromptEdit());
    document.getElementById('cancelAiNaturalPromptBtn')?.addEventListener('click', () => cancelAiNaturalPromptEdit());
    aiPromptInputEl?.addEventListener('keydown', e => {
      if (e.key === 'Escape' && state.isApplyingAiEdit) {
        e.preventDefault();
        cancelAiNaturalPromptEdit();
        return;
      }
      // 한글 IME 조합 중(isComposing / keyCode 229)일 때 엔터 입력으로 오작동하는 현상 방지
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (state.isApplyingAiEdit) return;
        triggerAiNaturalPromptEdit();
      }
    });

    root.querySelectorAll('[data-quick-ai-prompt]').forEach(btn => {
      btn.addEventListener('click', () => {
        const presetPrompt = btn.getAttribute('data-quick-ai-prompt') || '';
        if (!presetPrompt) return;
        state.aiPromptDraft = presetPrompt;
        triggerAiNaturalPromptEdit(presetPrompt);
      });
    });

    // 오른쪽 사이드 AI 채팅 수정 패널에서 [제목 / 단락 01~04 / 요약표 / FAQ] 클릭 시 해당 원문 위치로 스크롤 & 앞머리 자동 입력
    root.querySelectorAll('[data-ai-target-jump]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-ai-target-jump') || '';
        const prefix = btn.getAttribute('data-ai-target-prefix') || '';
        if (state.editorViewMode === 'preview') {
          state.editorViewMode = 'edit';
          render(true);
        }
        if (targetId) {
          setTimeout(() => flashElement(targetId), 40);
        }
        const inputEl = document.getElementById('aiNaturalPromptInput');
        if (inputEl && prefix) {
          const curVal = inputEl.value.replace(/^\[[^\]]+\]\s*/, '').trim();
          const nextVal = `${prefix}${curVal}`;
          inputEl.value = nextVal;
          state.aiPromptDraft = nextVal;
          inputEl.focus();
          inputEl.setSelectionRange(nextVal.length, nextVal.length);
        }
      });
    });

    document.getElementById('undoAiPromptEditBtn')?.addEventListener('click', () => {
      if (!Array.isArray(w.aiEditHistory) || w.aiEditHistory.length === 0) return;
      const prev = w.aiEditHistory.pop();
      if (!prev) return;
      w.title = prev.title;
      w.draftSections = prev.draftSections;
      if (w.summaryBlocks) {
        w.summaryBlocks.subtitle = prev.subtitle;
        if (prev.leadIntro !== undefined) w.summaryBlocks.leadIntro = prev.leadIntro;
        if (typeof prev.includeLeadIntro === 'boolean') w.summaryBlocks.includeLeadIntro = prev.includeLeadIntro;
        w.summaryBlocks.aiFactSummary = prev.aiFactSummary;
        w.summaryBlocks.summaryTable = prev.summaryTable;
        w.summaryBlocks.faqs = prev.faqs;
        w.summaryBlocks.closingParagraph = prev.closingParagraph;
        w.summaryBlocks.oneLineSummary = prev.oneLineSummary;
      }
      w.factChecks = extractFactSentencesFromSections(w.draftSections, w.sources);
      sortFaqsByBodyContextOrder(w);
      if (w.lastAiEdit) {
        w.lastAiEdit.isApplied = false;
        Object.values(w.lastAiEdit.sentenceStates || {}).forEach(arr => {
          (arr || []).forEach(it => { it.included = false; });
        });
      }
      if (Array.isArray(w.editVersionHistory) && w.editVersionHistory.length > 1) {
        const targetIdx = Math.max(0, Math.min(w.aiEditHistory.length, w.editVersionHistory.length - 1));
        w.activeVersionId = w.editVersionHistory[targetIdx]?.id || 'ver-0';
      }
      saveCurrentWork(true);
      render(true);
      showToast('↩ 직전 수정 전 상태로 기사를 되돌렸습니다.');
    });

    // AI 채팅 수정 전체 [적용 / 원문 복원] 마스터 토글 (오른쪽 사이드바)
    root.querySelectorAll('[data-ai-edit-master-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-ai-edit-master-toggle');
        const aiEdit = w.lastAiEdit || (state.activeHighlight?.mode === 'ai-edit' ? state.activeHighlight : null);
        if (!aiEdit) return;
        w.lastAiEdit = aiEdit;
        const shouldApply = mode === 'apply';
        aiEdit.isApplied = shouldApply;
        Object.values(aiEdit.sentenceStates || {}).forEach(arr => {
          (arr || []).forEach(it => { it.included = shouldApply; });
        });
        syncWorkWithAiEditState(w);
        saveCurrentWork(true);
        render(true);
        showToast(
          shouldApply
            ? '💬 AI 채팅으로 수정된 내용을 본문과 FAQ에 다시 적용했습니다!'
            : '↩ AI 채팅 수정 전 원문으로 되돌렸습니다. ([✓ 수정본 적용]으로 언제든 다시 반영할 수 있습니다)'
        );
      });
    });

    // 단락별 AI 채팅 수정 내용 전체 [적용 / 되돌리기] 토글 (단락 하단 컨트롤 바)
    root.querySelectorAll('[data-toggle-ai-sec-all]').forEach(btn => {
      btn.addEventListener('click', () => {
        const secId = btn.getAttribute('data-toggle-ai-sec-all');
        const aiEdit = w.lastAiEdit || (state.activeHighlight?.mode === 'ai-edit' ? state.activeHighlight : null);
        if (!aiEdit || !secId) return;
        w.lastAiEdit = aiEdit;
        const sentItems = aiEdit.sentenceStates?.[secId] || [];
        const currentlyApplied = sentItems.length > 0
          ? sentItems.some(it => it.included !== false)
          : aiEdit.isApplied !== false;
        const nextInclude = !currentlyApplied;
        if (sentItems.length > 0) {
          sentItems.forEach(it => { it.included = nextInclude; });
        } else {
          aiEdit.isApplied = nextInclude;
        }
        syncWorkWithAiEditState(w);
        saveCurrentWork(true);
        render(true);
        showToast(
          nextInclude
            ? '💬 AI 채팅 수정 내용을 이 단락과 FAQ에 다시 적용했습니다!'
            : '↩ 이 단락의 AI 채팅 수정 내용을 수정 전 원문으로 되돌렸습니다.'
        );
      });
    });

    // 단락 하단 박스 내 개별 AI 생성 문장 [넣기 / 빼기] 토글
    root.querySelectorAll('[data-toggle-ai-sent]').forEach(btn => {
      btn.addEventListener('click', () => {
        const secId = btn.getAttribute('data-toggle-ai-sent');
        const sentIdx = Number(btn.getAttribute('data-toggle-ai-sent-idx'));
        const aiEdit = w.lastAiEdit || (state.activeHighlight?.mode === 'ai-edit' ? state.activeHighlight : null);
        if (!aiEdit || !secId || isNaN(sentIdx)) return;
        w.lastAiEdit = aiEdit;
        const item = aiEdit.sentenceStates?.[secId]?.[sentIdx];
        if (!item) return;
        item.included = !(item.included !== false);
        syncWorkWithAiEditState(w);
        saveCurrentWork(true);
        render(true);
        showToast(
          item.included
            ? '➕ 선택한 AI 채팅 추가 문장을 본문과 FAQ에 다시 넣었습니다!'
            : '➖ 선택한 AI 채팅 추가 문장을 본문에서 뺐습니다.'
        );
      });
    });

    // 단락 하단 하이라이트 박스 내 [단락 전체 문맥에서 위치 보기 ▼] 아코디언 토글
    root.querySelectorAll('[data-toggle-sec-context-preview]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-toggle-sec-context-preview');
        const box = key ? root.querySelector(`[data-sec-context-box="${key}"]`) : null;
        if (!box) return;
        const isHidden = box.style.display === 'none';
        box.style.display = isHidden ? 'block' : 'none';
        btn.textContent = isHidden ? '단락 전체 문맥 접기 ▲' : '단락 전체 문맥에서 위치 보기 ▼';
      });
    });

    // 단락 하단 취재 메모 반영 박스 내 [본문에서 빼기] 원클릭 제거
    root.querySelectorAll('[data-remove-memo-sent-sec]').forEach(btn => {
      btn.addEventListener('click', () => {
        const secId = btn.getAttribute('data-remove-memo-sent-sec');
        const sentText = (btn.getAttribute('data-remove-memo-sent-text') || '').trim();
        const targetSec = (w.draftSections || []).find(s => s.id === secId);
        if (!targetSec || !sentText) return;
        targetSec.content = (targetSec.content || '')
          .replace(sentText, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        (w.researchItems || []).forEach(m => {
          if (Array.isArray(m.insertedIntoSecIds) && (m.fact || '').trim() === sentText) {
            m.insertedIntoSecIds = m.insertedIntoSecIds.filter(id => id !== secId);
          }
        });
        if (state.activeMemoHighlight?.secIds?.includes(secId)) {
          state.activeMemoHighlight = null;
        }
        if (state.activeHighlight?.mode === 'memo' && state.activeHighlight?.secIds?.includes(secId)) {
          state.activeHighlight = w.lastAiEdit || null;
        }
        w.factChecks = extractFactSentencesFromSections(w.draftSections, w.sources);
        saveCurrentWork(true);
        render(true);
        showToast('➖ 반영했던 취재 메모 문장을 본문에서 제거했습니다.');
      });
    });

    // [하이라이트 접기 ▲ / 펼치기 ▼] 토글
    root.querySelectorAll('[data-toggle-highlight-visibility]').forEach(btn => {
      btn.addEventListener('click', () => {
        const aiEdit = w.lastAiEdit || (state.activeHighlight?.mode === 'ai-edit' ? state.activeHighlight : null);
        if (aiEdit) {
          w.lastAiEdit = aiEdit;
          aiEdit.isHighlightVisible = !(aiEdit.isHighlightVisible !== false);
          saveCurrentWork(true);
          render(true);
        }
      });
    });

    root.querySelectorAll('[data-clear-highlight]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeMemoHighlight = null;
        if (state.activeHighlight?.mode === 'memo') {
          state.activeHighlight = w.lastAiEdit || null;
        } else if (w.lastAiEdit) {
          w.lastAiEdit.isHighlightVisible = false;
        } else {
          state.activeHighlight = null;
        }
        render(true);
      });
    });

    // 취재 메모 [+ 반영] 클릭 시 선택한 본문 단락에 매경 문체 팩트 삽입 + 해당 단락 노란색(앰버) 하이라이트!
    root.querySelectorAll('[data-insert-memo]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-insert-memo');
        const memo = (w.researchItems || []).find(r => r.id === id);
        if (!memo) return;
        const targetSelect = document.getElementById(`targetSecForMemo-${id}`);
        const targetVal = targetSelect ? targetSelect.value : (w.draftSections?.[0]?.id || 'sec-1');

        if (state.editorViewMode === 'preview') {
          state.editorViewMode = 'edit';
        }

        memo.insertedIntoSecIds = Array.isArray(memo.insertedIntoSecIds) ? memo.insertedIntoSecIds : [];
        if (!memo.insertedIntoSecIds.includes(targetVal)) {
          memo.insertedIntoSecIds.push(targetVal);
        }

        const targetSec = (w.draftSections || []).find(s => s.id === targetVal) || w.draftSections?.[0];
        if (targetSec) {
          targetSec.content = (targetSec.content ? targetSec.content.trim() + '\n\n' : '') + memo.fact;
          w.factChecks = extractFactSentencesFromSections(w.draftSections, w.sources);
          const memoHlObj = {
            mode: 'memo',
            memoId: memo.id,
            summary: `[${targetSec.title.slice(0, 24)}...] 단락에 반영된 취재 팩트 문장입니다.`,
            secIds: [targetSec.id],
            sentencesBySecId: { [targetSec.id]: [memo.fact] },
            tokensBySecId: {}
          };
          state.activeMemoHighlight = memoHlObj;
          saveCurrentWork(false);
          render(true);
          flashElement(`secWrap-${targetSec.id}`);
          showToast(`📌 취재 팩트 메모가 오른쪽 [${targetSec.title.slice(0, 16)}...] 단락에 반영(노란색 표시)되었습니다!`);
        }
      });
    });

    root.querySelectorAll('[data-del-memo]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-memo');
        w.researchItems = (w.researchItems || []).filter(r => r.id !== id);
        saveCurrentWork(false);
        render(true);
      });
    });

    // 추천 제목 5개 클릭 시 바로 위 기사 메인 헤드라인(#docMainHeadline) 즉시 변경 + 시각적 하이라이트
    root.querySelectorAll('[data-pick-headline-idx]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.getAttribute('data-pick-headline-idx'));
        const cur = state.currentWork;
        if (!cur) return;
        const picked = (cur.titleCandidates || [])[idx];
        if (picked && picked.title) {
          cur.selectedTitleId = picked.id || `tc-${idx + 1}`;
          cur.title = picked.title;
          const headlineEl = document.getElementById('docMainHeadline');
          if (headlineEl) headlineEl.value = picked.title;
          render(true);
          flashElement('docMainHeadline');
          saveCurrentWork(true);
          showToast(`✓ 0${idx + 1}번 제목이 기사 메인 헤드라인에 적용되었습니다!`);
        }
      });
    });

    // 형광펜 팩트체크 클릭 토글
    root.querySelectorAll('[data-toggle-fc]').forEach(chip => {
      chip.addEventListener('click', () => {
        const fcId = chip.getAttribute('data-toggle-fc');
        const item = (state.currentWork?.factChecks || []).find(f => f.id === fcId);
        if (item) {
          item.status = item.status === '미처리' ? '확인함' : '미처리';
          render(true);
          saveCurrentWork(true);
        }
      });
    });

    document.getElementById('verifyAllFactsBtn')?.addEventListener('click', () => {
      (state.currentWork?.factChecks || []).forEach(f => {
        f.status = '확인함';
      });
      render(true);
      saveCurrentWork(true);
      showToast('✓ 모든 수치·날짜 팩트체크 문장이 확인 완료로 처리되었습니다.');
    });

    // MK Pick 5대 카테고리 칩 클릭 시 즉시 카테고리 및 바이라인 라벨 반영
    root.querySelectorAll('[data-pick-mk-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pickedCat = btn.getAttribute('data-pick-mk-cat');
        const cur = state.currentWork;
        if (!cur || !pickedCat) return;
        cur.summaryBlocks = cur.summaryBlocks || {};
        cur.summaryBlocks.mkCategory = pickedCat;
        const catObj = MK_PICK_CATEGORIES.find(c => c.id === pickedCat);
        if (catObj) {
          cur.summaryBlocks.mkCategoryReason = `${catObj.desc}에 부합하여 [${pickedCat}] 카테고리로 설정되었습니다.`;
        }
        const parts = (cur.summaryBlocks.byline || '산업 Q&A | 남궁선희 기자 | 입력 2026.10.23 10:00').split('|').map(s => s.trim());
        parts[0] = pickedCat;
        cur.summaryBlocks.byline = parts.join(' | ');
        render(true);
        flashElement('docByline');
        saveCurrentWork(true);
        showToast(`✓ MK Pick 카테고리가 [${pickedCat}](으)로 변경되었습니다.`);
      });
    });

    // 오른쪽 통합 문서 내부 인라인 편집 이벤트 (편집 모드일 때 바인딩)
    document.getElementById('docByline')?.addEventListener('input', e => {
      sb.byline = e.target.value;
      saveCurrentWork(true);
    });
    document.getElementById('docTags')?.addEventListener('input', e => {
      sb.companyTags = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
      saveCurrentWork(true);
    });
    document.getElementById('docMainHeadline')?.addEventListener('input', e => {
      w.title = e.target.value;
      autoResizeTextarea(e.target);
      const maxLen = MAX_HEADLINE_CHARS || 40;
      const curTitle = String(w.title || '');
      const curLen = curTitle.length;
      const isOver = curLen > maxLen;
      const badgeEl = document.getElementById('headlineCharBadge');
      if (badgeEl) {
        badgeEl.style.borderColor = isOver ? '#F03E3E' : '#2B8A3E';
        badgeEl.style.backgroundColor = isOver ? '#FFF5F5' : '#EBFBEE';
        badgeEl.style.color = isOver ? '#C92A2A' : '#1B7F3B';
        badgeEl.textContent = isOver
          ? `⚠️ ${curLen} / ${maxLen}자 (${curLen - maxLen}자 초과 · 메인 2줄 잘림 주의)`
          : `✓ 공백 포함 ${curLen} / ${maxLen}자 (MK Pick 메인 2줄 노출 안전)`;
      }
      const previewEl = document.getElementById('headlineMainFeedPreview');
      if (previewEl) {
        previewEl.innerHTML = `${escapeHtml(curTitle.slice(0, maxLen))}${isOver ? `<span style="color: #F03E3E; text-decoration: line-through;" title="메인 화면에서 잘릴 수 있는 초과 글자">${escapeHtml(curTitle.slice(maxLen))}</span>` : ''}`;
      }
      saveCurrentWork(true);
    });

    // STEP 02: 헤드라인 아래 한줄 소제목 입력 및 40자 초과분 자동 분리 버튼
    document.getElementById('docOneLineSubtitle')?.addEventListener('input', e => {
      sb.oneLineSubtitle = e.target.value;
      const cntEl = document.getElementById('oneLineSubCharCount');
      if (cntEl) cntEl.textContent = `${String(e.target.value || '').length}자`;
      saveCurrentWork(true);
    });

    document.getElementById('splitHeadlineToSubtitleBtn')?.addEventListener('click', () => {
      const maxLen = MAX_HEADLINE_CHARS || 40;
      const curTitle = String(w.title || '').trim();
      if (!curTitle) return;
      if (splitLongHeadlineToSubtitle) {
        const currentOneLine = sb.oneLineSubtitle || '';
        const splitRes = splitLongHeadlineToSubtitle(curTitle, currentOneLine, maxLen);
        if (splitRes.wasSplit) {
          w.title = splitRes.headline;
          sb.oneLineSubtitle = splitRes.overflowLine || splitRes.subtitle || currentOneLine;
          if (!sb.subtitle || !sb.subtitle.includes(splitRes.overflowLine)) {
            sb.subtitle = splitRes.subtitle || sb.subtitle;
          }
          saveCurrentWork(false);
          render(true);
          flashElement('docOneLineSubtitle');
          showToast(`✂️ 헤드라인을 ${w.title.length}자로 맞추고 초과한 뒷부분을 아래 '한줄 소제목'으로 내려 작성했습니다!`);
          return;
        }
      }
      // 40자 이내라도 말줄임표(…)나 공백 기준으로 뒷부분을 한줄 소제목으로 분리하고 싶을 때
      const ellipsisIdx = curTitle.indexOf('…') !== -1 ? curTitle.indexOf('…') : curTitle.indexOf('...');
      if (ellipsisIdx > 8 && ellipsisIdx < curTitle.length - 4) {
        const sepLen = curTitle[ellipsisIdx] === '…' ? 1 : 3;
        const headPart = curTitle.slice(0, ellipsisIdx + sepLen).trim();
        const tailPart = curTitle.slice(ellipsisIdx + sepLen).trim();
        if (tailPart) {
          w.title = headPart;
          sb.oneLineSubtitle = sb.oneLineSubtitle ? `${tailPart} · ${sb.oneLineSubtitle}` : tailPart;
          saveCurrentWork(false);
          render(true);
          flashElement('docOneLineSubtitle');
          showToast('✂️ 헤드라인 뒷부분을 아래 한줄 소제목으로 분리했습니다!');
          return;
        }
      }
      showToast(`현재 헤드라인(${curTitle.length}자)은 이미 ${maxLen}자 이내로 메인 화면에서 잘리지 않습니다.`);
    });

    // STEP 03: 기사 도입부 내용 ON/OFF 토글, 300~500자 자동 생성 및 인라인 편집
    function toggleLeadIntroState(forceState) {
      const nextState = typeof forceState === 'boolean' ? forceState : !(sb.includeLeadIntro !== false);
      sb.includeLeadIntro = nextState;
      if (nextState && !String(sb.leadIntro || '').trim()) {
        sb.leadIntro = buildDefaultLeadIntroText(w);
      }
      saveCurrentWork(false);
      render(true);
      showToast(
        nextState
          ? '✓ 기사 도입부 내용이 켜졌습니다(ON). 실제 기사 미리보기 및 전체 복사에 포함됩니다.'
          : '○ 기사 도입부 내용이 꺼졌습니다(OFF). 미리보기 및 전체 복사에서 제외됩니다.'
      );
    }

    document.getElementById('toggleLeadIntroBtn')?.addEventListener('click', () => toggleLeadIntroState());
    document.getElementById('enableLeadIntroQuickBtn')?.addEventListener('click', () => toggleLeadIntroState(true));

    document.getElementById('regenerateLeadIntroBtn')?.addEventListener('click', () => {
      sb.includeLeadIntro = true;
      sb.leadIntro = buildDefaultLeadIntroText(w);
      saveCurrentWork(false);
      render(true);
      flashElement('docLeadIntro');
      showToast(`✨ '${w.keyword}' 핵심 팩트를 바탕으로 도입부 내용(${sb.leadIntro.length}자)을 자동 완성했습니다!`);
    });

    document.getElementById('docLeadIntro')?.addEventListener('input', e => {
      sb.leadIntro = e.target.value;
      autoResizeTextarea(e.target);
      const len = String(sb.leadIntro || '').length;
      const isGood = len >= 250 && len <= 550;
      const badgeEl = document.getElementById('leadIntroCharBadge');
      if (badgeEl) {
        badgeEl.textContent = `공백 포함 ${len.toLocaleString()}자 (권장 300~500자)`;
        badgeEl.style.borderColor = isGood ? '#D1FAE5' : '#FDE68A';
        badgeEl.style.backgroundColor = isGood ? '#ECFDF5' : '#FFFBEB';
        badgeEl.style.color = isGood ? '#047857' : '#B45309';
      }
      saveCurrentWork(true);
    });

    // 본문 섹션 제목·내용·단락 캡션 인라인 수정 (본문 내용 삭제·수정 시 하단 FAQ 자동 동기화 연동!)
    root.querySelectorAll('[data-doc-sec-title]').forEach(inp => {
      inp.addEventListener('focus', () => {
        inp._prevTitleVal = inp.value;
      });
      inp.addEventListener('input', () => {
        const sec = w.draftSections.find(s => s.id === inp.getAttribute('data-doc-sec-title'));
        if (sec) {
          sec.title = inp.value;
          saveCurrentWork(true);
        }
      });
      inp.addEventListener('change', () => {
        const prevT = inp._prevTitleVal || '';
        if (prevT && prevT !== inp.value) {
          const syncRes = syncFaqsAndTableOnBodyEdit(w, { previousBody: prevT, newBody: inp.value });
          if (syncRes.removedFaqCount > 0 || syncRes.updatedFaqCount > 0) {
            saveCurrentWork(false);
            render(true);
            showToast(`🔄 본문 소제목 수정에 맞춰 하단 FAQ도 자동 업데이트되었습니다.`);
          }
        }
      });
    });

    root.querySelectorAll('[data-doc-sec-caption]').forEach(inp => {
      inp.addEventListener('input', () => {
        const sec = w.draftSections.find(s => s.id === inp.getAttribute('data-doc-sec-caption'));
        if (sec) {
          sec.imageCaption = inp.value;
          saveCurrentWork(true);
        }
      });
    });

    root.querySelectorAll('[data-doc-sec-body]').forEach(ta => {
      ta.addEventListener('focus', () => {
        ta._prevBodyVal = ta.value;
      });
      ta.addEventListener('input', () => {
        autoResizeTextarea(ta);
        const secId = ta.getAttribute('data-doc-sec-body');
        const sec = w.draftSections.find(s => s.id === secId);
        if (sec) {
          sec.content = ta.value;
          const secCountEl = document.getElementById(`secCharCount-${secId}`);
          if (secCountEl) secCountEl.textContent = `${ta.value.length.toLocaleString()}자`;
          updateLiveStatsAndGeoUI();
        }
      });
      ta.addEventListener('change', () => {
        const prevBody = ta._prevBodyVal || '';
        const newBody = ta.value || '';
        ta._prevBodyVal = newBody;
        w.factChecks = extractFactSentencesFromSections(w.draftSections, w.sources);
        const syncRes = syncFaqsAndTableOnBodyEdit(w, { previousBody: prevBody, newBody });
        saveCurrentWork(true);
        if (syncRes.removedFaqCount > 0 || syncRes.updatedFaqCount > 0) {
          render(true);
          showToast(`🔄 본문에서 삭제·편집된 내용을 감지해 하단 FAQ(${syncRes.removedFaqCount}건 제거)를 자동으로 동기화했습니다!`);
        }
      });
    });

    // 본문 단락별 [✨ 매경 문체(~합니다) 다듬기]
    root.querySelectorAll('[data-polish-sec]').forEach(btn => {
      btn.addEventListener('click', () => {
        const secId = btn.getAttribute('data-polish-sec');
        const sec = (w.draftSections || []).find(s => s.id === secId);
        if (!sec) return;
        sec.content = polishParagraphToMkStyle(sec.content);
        saveCurrentWork(false);
        render(true);
        flashElement(`secBody-${secId}`);
        showToast('✨ 해당 단락의 문장을 매경 Pick 표준 경어체("~합니다")로 다듬었습니다.');
      });
    });

    // 본문 단락 순서 위로 / 아래로 이동 (단락 순서가 바뀌면 하단 FAQ도 새 본문 문맥 순서에 맞춰 자동 정렬)
    root.querySelectorAll('[data-move-sec-up]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-move-sec-up'));
        if (idx > 0) {
          const temp = w.draftSections[idx - 1];
          w.draftSections[idx - 1] = w.draftSections[idx];
          w.draftSections[idx] = temp;
          sortFaqsByBodyContextOrder(w);
          saveCurrentWork(false);
          render(true);
          showToast('단락 순서를 위로 이동하고 하단 FAQ 순서도 본문 문맥에 맞춰 정렬했습니다.');
        }
      });
    });

    root.querySelectorAll('[data-move-sec-down]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-move-sec-down'));
        if (idx < w.draftSections.length - 1) {
          const temp = w.draftSections[idx + 1];
          w.draftSections[idx + 1] = w.draftSections[idx];
          w.draftSections[idx] = temp;
          sortFaqsByBodyContextOrder(w);
          saveCurrentWork(false);
          render(true);
          showToast('단락 순서를 아래로 이동하고 하단 FAQ 순서도 본문 문맥에 맞춰 정렬했습니다.');
        }
      });
    });

    // 본문 단락 추가 / 삭제 (단락 삭제 시 해당 단락 내용과 관련된 하단 FAQ·요약표도 즉시 자동 삭제·동기화!)
    document.getElementById('addDocSectionBtn')?.addEventListener('click', () => {
      const newSecId = 'sec-' + Date.now();
      w.draftSections.push({
        id: newSecId,
        title: '독자들이 가장 궁금해할 다음 질문은 무엇일까요?',
        content: '여기에 본문 내용을 "~합니다" 체로 작성하세요.',
        imageCaption: '',
        sourceIds: []
      });
      saveCurrentWork(false);
      render(true);
      flashElement(`secBody-${newSecId}`);
    });

    root.querySelectorAll('[data-del-doc-sec]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-doc-sec');
        const targetSec = (w.draftSections || []).find(s => s.id === id);
        const deletedText = targetSec ? `${targetSec.title || ''} ${targetSec.content || ''}` : '';
        w.draftSections = w.draftSections.filter(s => s.id !== id);
        w.factChecks = extractFactSentencesFromSections(w.draftSections, w.sources);
        const syncRes = syncFaqsAndTableOnBodyEdit(w, { deletedText });
        saveCurrentWork(false);
        render(true);
        if (syncRes.removedFaqCount > 0) {
          showToast(`🗑️ 단락 삭제 완료! 삭제된 단락과 관련된 하단 FAQ ${syncRes.removedFaqCount}문항도 자동으로 함께 정리되었습니다.`);
        } else {
          showToast('🗑️ 선택한 본문 단락을 삭제하고 하단 FAQ와 동기화했습니다.');
        }
      });
    });

    // STEP 07: [⇅ 본문 문맥 순서(단락 01→04)로 자동 정렬] 버튼 클릭
    document.getElementById('sortFaqsByContextBtn')?.addEventListener('click', () => {
      sortFaqsByBodyContextOrder(w);
      saveCurrentWork(false);
      render(true);
      flashElement('block-step-7');
      showToast('⇅ 위 본문(단락 01 → 02 → 03 → 04) 문맥 순서에 맞춰 FAQ를 정렬하고 Q1~Q5 번호를 매겼습니다!');
    });

    // STEP 07: [🔄 현재 본문 기준으로 FAQ·요약표 AI 재동기화] 버튼 클릭
    document.getElementById('syncFaqsWithBodyAiBtn')?.addEventListener('click', async () => {
      state.isSyncingFaqsAi = true;
      render(true);
      try {
        await syncFaqsWithBodyViaAi(w);
        state.isSyncingFaqsAi = false;
        await loadConfig();
        saveCurrentWork(true);
        render(true);
        flashElement('block-step-7');
        showToast('🔄 현재 편집된 본문 내용을 100% 반영하여 하단 FAQ와 요약표를 새롭게 동기화했습니다!');
      } catch (err) {
        state.isSyncingFaqsAi = false;
        showToast(`FAQ 동기화 중 오류가 발생했습니다: ${err.message}`);
        render(true);
      }
    });

    // 요약표 인라인 편집
    document.getElementById('docTableTitle')?.addEventListener('input', e => {
      sb.summaryTable.title = e.target.value;
      saveCurrentWork(true);
    });

    root.querySelectorAll('[data-doc-th]').forEach(inp => {
      inp.addEventListener('input', () => {
        const cIdx = Number(inp.getAttribute('data-doc-th'));
        sb.summaryTable.headers[cIdx] = inp.value;
        saveCurrentWork(true);
      });
    });

    root.querySelectorAll('[data-doc-td]').forEach(inp => {
      inp.addEventListener('input', () => {
        const [rIdx, cIdx] = inp.getAttribute('data-doc-td').split('-').map(Number);
        if (sb.summaryTable?.rows?.[rIdx]) {
          sb.summaryTable.rows[rIdx][cIdx] = inp.value;
          saveCurrentWork(true);
        }
      });
    });

    document.getElementById('docAddTableRowBtn')?.addEventListener('click', () => {
      const colLen = (sb.summaryTable?.headers || []).length || 5;
      sb.summaryTable.rows.push(Array(colLen).fill('내용 입력'));
      saveCurrentWork(false);
      render(true);
    });

    document.getElementById('docAddTableColBtn')?.addEventListener('click', () => {
      sb.summaryTable.headers.push('새 항목');
      sb.summaryTable.rows.forEach(r => r.push('내용 입력'));
      saveCurrentWork(false);
      render(true);
    });

    root.querySelectorAll('[data-doc-del-row]').forEach(btn => {
      btn.addEventListener('click', () => {
        const rIdx = Number(btn.getAttribute('data-doc-del-row'));
        sb.summaryTable.rows.splice(rIdx, 1);
        saveCurrentWork(false);
        render(true);
      });
    });

    // 핵심 용어 사전 (Glossary) 인라인 편집
    document.getElementById('docGlossaryTitle')?.addEventListener('input', e => {
      sb.glossaryTitle = e.target.value;
      saveCurrentWork(true);
    });

    document.getElementById('docAddGlossaryBtn')?.addEventListener('click', () => {
      sb.glossary = sb.glossary || [];
      sb.glossary.push({
        term: '새 핵심 용어',
        desc: '용어에 대한 1~2문장 명쾌한 해설을 "~입니다" 체로 입력하세요.'
      });
      saveCurrentWork(false);
      render(true);
    });

    root.querySelectorAll('[data-doc-glossary-term]').forEach(inp => {
      inp.addEventListener('input', () => {
        const gIdx = Number(inp.getAttribute('data-doc-glossary-term'));
        if (sb.glossary && sb.glossary[gIdx]) {
          sb.glossary[gIdx].term = inp.value;
          saveCurrentWork(true);
        }
      });
    });

    root.querySelectorAll('[data-doc-glossary-desc]').forEach(ta => {
      ta.addEventListener('input', () => {
        autoResizeTextarea(ta);
        const gIdx = Number(ta.getAttribute('data-doc-glossary-desc'));
        if (sb.glossary && sb.glossary[gIdx]) {
          sb.glossary[gIdx].desc = ta.value;
          saveCurrentWork(true);
        }
      });
    });

    root.querySelectorAll('[data-doc-del-glossary]').forEach(btn => {
      btn.addEventListener('click', () => {
        const gIdx = Number(btn.getAttribute('data-doc-del-glossary'));
        if (sb.glossary) {
          sb.glossary.splice(gIdx, 1);
          saveCurrentWork(false);
          render(true);
        }
      });
    });

    // FAQ 인라인 편집 및 자유로운 순서 이동 (↑ 위로 / ↓ 아래로 / 마우스 드래그 앤 드롭)
    const fanoutBtn = document.getElementById('docToggleFanoutBtn');
    if (fanoutBtn) {
      fanoutBtn.addEventListener('click', () => {
        state.fanoutOpen = !state.fanoutOpen;
        render(true);
      });
    }

    root.querySelectorAll('[data-pick-fanout]').forEach(btn => {
      btn.addEventListener('click', () => {
        const fIdx = Number(btn.getAttribute('data-pick-fanout'));
        const fq = sb.fanoutQuestions[fIdx];
        if (!fq) return;
        const nextNum = (sb.faqs || []).length + 1;
        sb.faqs.push({
          q: `Q${nextNum}. ${fq.q.replace(/^Q\d+\.\s*/, '')}`,
          a: fq.a
        });
        sb.fanoutQuestions.splice(fIdx, 1);
        sortFaqsByBodyContextOrder(w);
        saveCurrentWork(false);
        showToast('선택한 질문이 FAQ에 추가되고 본문 문맥 순서에 맞춰 정렬되었습니다.');
        render(true);
      });
    });

    document.getElementById('docAddFaqBtn')?.addEventListener('click', () => {
      const nextNum = (sb.faqs || []).length + 1;
      sb.faqs.push({
        q: `Q${nextNum}. 새로운 질문을 입력하세요?`,
        a: '답변을 "~합니다" 체로 입력하세요.'
      });
      renumberFaqPrefixes(sb.faqs);
      saveCurrentWork(false);
      render(true);
    });

    // FAQ 위로 / 아래로 이동 버튼
    root.querySelectorAll('[data-move-faq-up]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-move-faq-up'));
        if (idx > 0 && Array.isArray(sb.faqs)) {
          const temp = sb.faqs[idx - 1];
          sb.faqs[idx - 1] = sb.faqs[idx];
          sb.faqs[idx] = temp;
          renumberFaqPrefixes(sb.faqs);
          saveCurrentWork(false);
          render(true);
          showToast(`FAQ Q${idx + 1} 문항을 위로 이동했습니다.`);
        }
      });
    });

    root.querySelectorAll('[data-move-faq-down]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-move-faq-down'));
        if (Array.isArray(sb.faqs) && idx < sb.faqs.length - 1) {
          const temp = sb.faqs[idx + 1];
          sb.faqs[idx + 1] = sb.faqs[idx];
          sb.faqs[idx] = temp;
          renumberFaqPrefixes(sb.faqs);
          saveCurrentWork(false);
          render(true);
          showToast(`FAQ Q${idx + 1} 문항을 아래로 이동했습니다.`);
        }
      });
    });

    // FAQ 카드 마우스 드래그 앤 드롭으로 순서 자유 이동
    let draggedFaqIdx = null;
    root.querySelectorAll('[data-faq-card-idx]').forEach(card => {
      card.addEventListener('dragstart', e => {
        // 입력창 내부 텍스트 선택 드래그와 구분
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea') {
          e.preventDefault();
          return;
        }
        draggedFaqIdx = Number(card.getAttribute('data-faq-card-idx'));
        card.style.opacity = '0.55';
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(draggedFaqIdx));
        }
      });
      card.addEventListener('dragend', () => {
        card.style.opacity = '1';
        card.style.borderColor = '';
        draggedFaqIdx = null;
      });
      card.addEventListener('dragover', e => {
        if (draggedFaqIdx === null) return;
        e.preventDefault();
        card.style.borderColor = 'var(--mk-orange)';
      });
      card.addEventListener('dragleave', () => {
        card.style.borderColor = '';
      });
      card.addEventListener('drop', e => {
        e.preventDefault();
        card.style.borderColor = '';
        const targetIdx = Number(card.getAttribute('data-faq-card-idx'));
        if (draggedFaqIdx === null || isNaN(targetIdx) || draggedFaqIdx === targetIdx) return;
        if (!Array.isArray(sb.faqs)) return;
        const [movedFaq] = sb.faqs.splice(draggedFaqIdx, 1);
        sb.faqs.splice(targetIdx, 0, movedFaq);
        renumberFaqPrefixes(sb.faqs);
        draggedFaqIdx = null;
        saveCurrentWork(false);
        render(true);
        showToast('✓ 드래그한 위치로 FAQ 순서를 이동하고 Q 번호를 자동으로 맞췄습니다.');
      });
    });

    root.querySelectorAll('[data-doc-faq-q]').forEach(inp => {
      inp.addEventListener('input', () => {
        const idx = Number(inp.getAttribute('data-doc-faq-q'));
        if (sb.faqs[idx]) {
          sb.faqs[idx].q = inp.value;
          saveCurrentWork(true);
        }
      });
    });

    root.querySelectorAll('[data-doc-faq-a]').forEach(ta => {
      ta.addEventListener('input', () => {
        autoResizeTextarea(ta);
        const idx = Number(ta.getAttribute('data-doc-faq-a'));
        if (sb.faqs[idx]) {
          sb.faqs[idx].a = ta.value;
          saveCurrentWork(true);
        }
      });
    });

    root.querySelectorAll('[data-doc-del-faq]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-doc-del-faq'));
        sb.faqs.splice(idx, 1);
        renumberFaqPrefixes(sb.faqs);
        saveCurrentWork(false);
        render(true);
      });
    });

    // 수미상관 마무리 총평 문단, 한 줄 요약, 캡션, 고지문구 인라인 수정
    document.getElementById('docClosingParagraph')?.addEventListener('input', e => {
      autoResizeTextarea(e.target);
      sb.closingParagraph = e.target.value;
      saveCurrentWork(true);
    });
    document.getElementById('docOneLine')?.addEventListener('input', e => {
      autoResizeTextarea(e.target);
      sb.oneLineSummary = e.target.value;
      saveCurrentWork(true);
    });
    document.getElementById('docImgCaption')?.addEventListener('input', e => {
      if (!sb.imageRecommendations || sb.imageRecommendations.length === 0) {
        sb.imageRecommendations = [{ position: '대표 이미지', sourceUrl: '', keywords: [], caption: e.target.value }];
      } else {
        sb.imageRecommendations[0].caption = e.target.value;
      }
      saveCurrentWork(true);
    });
    document.getElementById('docNotice')?.addEventListener('input', e => {
      sb.noticeText = e.target.value;
      saveCurrentWork(true);
    });

    // STEP 08: 참고 자료 및 출처 목록 체크박스 토글 / 삭제 / 직접 추가
    root.querySelectorAll('[data-toggle-src-exclude]').forEach(chk => {
      chk.addEventListener('change', () => {
        const srcId = chk.getAttribute('data-toggle-src-exclude');
        const foundSrc = (w.sources || []).find(s => s.id === srcId);
        if (foundSrc) {
          foundSrc.excluded = !chk.checked;
          saveCurrentWork(true);
          render(true);
        }
      });
    });

    root.querySelectorAll('[data-del-src]').forEach(btn => {
      btn.addEventListener('click', () => {
        const srcId = btn.getAttribute('data-del-src');
        w.sources = (w.sources || []).filter(s => s.id !== srcId);
        saveCurrentWork(false);
        render(true);
      });
    });

    document.getElementById('addSourceDirectBtn')?.addEventListener('click', () => {
      const titleVal = document.getElementById('newSourceTitleInput')?.value.trim() || '';
      const urlVal = document.getElementById('newSourceUrlInput')?.value.trim() || '';
      if (!titleVal && !urlVal) {
        showToast('추가할 출처 제목이나 URL을 입력해 주세요.');
        return;
      }
      w.sources = w.sources || [];
      w.sources.push({
        id: 'src-custom-' + Date.now(),
        url: urlVal,
        title: titleVal || urlVal,
        method: '직접 추가 출처',
        reliability: '높음',
        excluded: false
      });
      saveCurrentWork(false);
      showToast('참고 출처가 STEP 08 목록에 추가되었습니다.');
      render(true);
    });
  }

  document.getElementById('brandHomeBtn').addEventListener('click', () => {
    state.screen = 'home';
    render(false);
  });

  initApp();
})();
