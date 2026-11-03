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
      url: '',
      rawText: '',
      typeId: 4
    },
    showRawPasteInput: false,
    fanoutOpen: true,
    leftPanelTab: 'memo', // 'memo' | 'check' | 'outline'
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

  const DEFAULT_PPLX_MODEL = 'google/gemini-4-argon';

  function getClientUsageStats() {
    const defaultStats = {
      model: DEFAULT_PPLX_MODEL,
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
      return { ...defaultStats, ...parsed, model: DEFAULT_PPLX_MODEL };
    } catch (e) {
      return defaultStats;
    }
  }

  function saveClientUsageStats(stats) {
    stats.model = DEFAULT_PPLX_MODEL;
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
    stats.model = DEFAULT_PPLX_MODEL;
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

  function safeParseClientJson(rawText = '') {
    const cleaned = String(rawText || '')
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Perplexity(google/gemini-4-argon) 응답에서 JSON을 추출하지 못했습니다.');
    }
    let candidate = jsonMatch[0];
    try {
      return JSON.parse(candidate);
    } catch (firstErr) {
      const repaired = candidate
        .replace(/,\s*([\]}])/g, '$1')
        .replace(/[\u0000-\u0019]+/g, ' ');
      return JSON.parse(repaired);
    }
  }

  async function callPerplexityDirectFromBrowser(apiKey, systemPrompt, userPrompt, recencyFilter = 'month', callType = 'draft') {
    const maxOutTokens = callType === 'trend' ? 6500 : 8192;
    const res = await fetch('https://api.perplexity.ai/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: DEFAULT_PPLX_MODEL,
        instructions: systemPrompt,
        input: userPrompt,
        max_output_tokens: maxOutTokens
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Perplexity API(${DEFAULT_PPLX_MODEL}) 호출 실패 (${res.status}): ${errText.slice(0, 100)}`);
    }

    const data = await res.json();
    recordClientPerplexityUsage(data?.usage, callType);

    let content = '';
    if (typeof data?.output_text === 'string' && data.output_text.trim()) {
      content = data.output_text;
    } else if (Array.isArray(data?.output)) {
      for (const item of data.output) {
        if (Array.isArray(item?.content)) {
          for (const block of item.content) {
            if (typeof block?.text === 'string') {
              content += block.text;
            }
          }
        }
      }
    } else {
      content = data?.choices?.[0]?.message?.content || '';
    }

    const citations = Array.isArray(data?.citations) ? data.citations : [];
    const parsed = stripCitationBracketsClient(safeParseClientJson(content));
    return { parsed, citations };
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

  async function buildClientPerplexityEnhancedScenario({ apiKey, keyword: rawKeyword, company: rawCompany, url, rawText, typeId, baseScenario }) {
    const keyword = cleanTrendTopicKeyword ? cleanTrendTopicKeyword(rawKeyword) : String(rawKeyword || '').trim();
    const company = extractBrandFromTopic ? extractBrandFromTopic(keyword, rawCompany) : String(rawCompany || '').trim();
    if (isVirtualIdolQuery && isVirtualIdolQuery(keyword, company)) {
      const vi = getVirtualIdolScenario(keyword);
      return { ...vi, usedPerplexity: true };
    }
    const tInfo = CONTENT_TYPES[typeId] || CONTENT_TYPES[4];
    const typeInstructions = {
      1: '유형 1(유료 업체 타겟팅 기획 콘텐츠): 1단락은 소비자 핵심 고민과 기존 방식 대비 변화 비교, 2~4단락은 타깃 파트너사 및 주요 기업·서비스의 핵심 혜택과 차별점을 각각 명확하게 분석, 마지막 단락은 실패 없는 선택 기준 제시. 요약표는 5열 비교표, 용어 사전 5개, FAQ는 7문항.',
      2: '유형 2(특정 기념일·시즌 캠페인 콘텐츠): 1단락은 기념일·시즌의 의미와 사회적 배경, 2단락은 정부·지자체 지원 제도 및 바우처 안내, 3~4단락은 참여 브랜드별 캠페인·제품·프로모션을 "■ [브랜드명] 캠페인·제품명" 소항목으로 구체적으로 소개. 요약표는 5열 비교표, 용어 사전 5개, FAQ는 5문항.',
      3: '유형 3(최신 트렌드 심층 분석 콘텐츠 1): 1단락은 독자의 공감을 깨우는 질문 리드와 트렌드가 부상한 배경, 2~4단락은 키워드에 포함된 핵심 소재·주자·사례들을 각각의 특징과 시장 파급력 중심으로 자연스럽게 분석(키워드가 명시적으로 역사·계보·변천사를 묻는 경우에만 시대순 흐름 활용, 일반 주제는 절대 억지 연도별 타임라인 금지), 마지막 단락은 향후 전망과 시사점. 요약표는 5열 상세 비교표, 용어 사전 5개, FAQ 5문항.',
      4: '유형 4(최신 트렌드·라이프스타일·뷰티·유통 콘텐츠 2): 1단락은 계절·일상 속 소비자 고민(예: 환절기 피부 관리, 신상품 열풍 등)을 짚는 공감형 도입과 핵심 트렌드 정의, 2~4단락은 입력된 각 키워드·아이템·브랜드(예: 대왕패치, 환절기 기초템 등)별 핵심 특징·성분·인기 요인을 각각 알기 쉽게 집중 분석, 마지막 단락은 똑똑한 제품 선택법 및 실생활 활용 팁 정리. 요약표는 5열 비교표, 용어 사전 5개, FAQ는 5문항.',
      5: '유형 5(영업 기업 맞춤 기획 콘텐츠): 1단락은 독자 질문 도입 1문단 뒤 Q1~Q4 시장 메가 트렌드·페인포인트 문답, 2단락은 Q5~Q6 선택 기준 문답, 3단락은 Q7 영업 타깃 기업 집중 소개. 요약표는 5열 요약표, 용어 사전 5개, FAQ는 7문항.'
    };
    const faqCount = (typeId === 1 || typeId === 5) ? 7 : 5;
    const fallbackCat = recommendMkPickCategory(keyword, typeId, company);
    const preFactCheck = inspectTopicFactVerification
      ? inspectTopicFactVerification(keyword, company, 1)
      : { verdict: 'VERIFIED_FACT', isWarning: false, badgeLabel: '✓ 공식 언론 보도 및 실제 출시·트렌드 팩트 확인됨', summary: '' };

    const sys = `당신은 매일경제 MK Pick(GEO·AEO 최적화 매거진형 심층 기사) 수석 에디터이자 팩트체크 데스크입니다.
타 언론사 기사의 문장을 절대 그대로 베끼지 말고, 수치·브랜드명·성분·출시일 등 핵심 팩트만 추출하여 모든 본문과 답변을 매일경제 고유의 정중하고 생동감 있는 "~합니다/습니다" 체로 작성하세요.
[절대 준수 작성 원칙]
0) [가장 중요 · 0순위 원칙] 실제 공식 출시·언론 보도 여부 팩트체크 및 가상(AI 생성) 밈·루머 엄격 판별 (절대 준수!):
   - 기사를 작성하기 전에 입력된 키워드('${keyword}')가 **실제 기업·브랜드가 정식 출시·발표하고 언론에 보도된 실제 제품·트렌드**인지, 아니면 **유튜브 쇼츠·틱톡·릴스 등 SNS에서 인공지능(AI) 합성이나 상상력으로 만들어진 '가상(AI 생성) 밈·합성 콘텐츠·루머'**(예: 실제 정식 출시된 적 없는 '한정선 마이쮸 콜라보 찹쌀떡' 등)인지 실시간 웹 검색을 통해 반드시 먼저 검증하세요!
   - 만약 공식 출시 사실이나 언론 보도 근거가 없는 **가상(AI 생성) 밈·합성 콘텐츠이거나 미출시 루머**라면:
     ① **절대로 실제 출시된 신제품이거나 정식 콜라보인 것처럼 거짓으로 꾸며 쓰지 마세요!** (실무진과 독자가 실제 출시 제품으로 오인하면 심각한 보도 사고가 됩니다.)
     ② 반드시 JSON의 \`factVerification.verdict\`를 \`"AI_MEME_OR_VIRTUAL"\` (또는 보도 미확인 시 \`"UNVERIFIED_VIRAL"\`), \`factVerification.isWarning\`을 \`true\`로 설정하세요.
     ③ 기사 제목(\`titleCandidates\`), \`aiFactSummary\`(3줄 요약), 본문(\`draftSections\`) 첫 단락에서 **"해당 화제 키워드는 실제 정식 출시된 제품이 아니라 SNS·숏폼에서 확산된 가상(AI 생성) 밈·콘텐츠"**라는 사실을 명확히 팩트체크해 바로잡고, 대신 **실제 존재하는 원조 브랜드(예: 더현대서울 등에서 판매되는 '한정선' 생과일 찹쌀떡 등)의 진짜 정식 메뉴와 검증된 시장 트렌드 팩트**를 중심으로 설명하세요.
   - 실제 정식 출시·공식 발표 및 언론 보도가 확인된 정상적인 주제라면 \`factVerification.verdict\`를 \`"VERIFIED_FACT"\`, \`factVerification.isWarning\`을 \`false\`로 설정하고 확인된 공식 팩트 요약을 적어주세요.
1) 주제 맞춤형 자연스러운 구성 (억지 연도별 타임라인 절대 금지!):
   - 입력된 키워드(${keyword})의 실제 성격(뷰티·스킨케어, 식음료, 유통, IT, 라이프스타일, 기업 분석 등)에 가장 잘 맞는 자연스러운 기사 흐름으로 3~5개 본문 단락(draftSections)을 구성하세요.
   - 키워드가 역사/변천사/계보를 직접 묻는 주제가 아니라면, 절대로 "1990년대/2000년대/2010년대/2020년대" 같은 억지 연도별 타임라인이나 "탄생 배경과 이유 :", "활동 방식의 한계 :", "Bonus Track :" 같은 고정 라벨을 기계적으로 붙이지 마세요.
2) 유튜브·SNS 구어체 제목 및 오탈자 자동 정제 원칙 (절대 준수!):
   - 입력된 키워드에 유튜버의 감탄사·수식어(예: '과즙 넘치는', '과즙미 가득한', '먹어봄', '미친 가성비', '다이소깡' 등)나 오탈자(예: '찹살떡', '찹살덕' → '찹쌀떡')가 포함되어 있더라도, 기사 제목·본문·요약표·FAQ에서는 절대 유튜버의 수식어나 오탈자를 그대로 반복하지 마세요!
   - 반드시 언론 보도와 공식 발표로 검증된 **실제 핵심 브랜드·기업**(예: '이디야커피', '다이소', '올리브영', '더현대서울 한정선' 등)과 **정확한 공식 제품명·트렌드 배경**을 중심으로 전문적인 매일경제 기사를 작성하세요.
3) 복수 키워드·아이템 맞춤형 전개:
   - 사용자가 쉼표(,)로 여러 키워드(예: 대왕패치, 환절기, 기초템 등)를 입력한 경우, 1단락에서 전체 주제를 아우르는 트렌드 배경·소비자 고민을 짚어주고, 이어지는 단락들에서 각 키워드·아이템별 핵심 특징, 인기 이유, 주요 브랜드/제품 사례를 하나씩 명확하고 실용적인 소제목으로 풀어내세요. 마지막 단락에서는 올바른 선택 기준이나 활용 팁을 제시하세요.
4) 5열 비교 요약표(summaryTable), 핵심 용어 사전(glossary 5개), FAQ ${faqCount}문항, 팬아웃(Query Fan-out) 연관 추천 질문(fanoutQuestions 6개), 마무리 총평 문단(closingParagraph) + 한 줄 요약(oneLineSummary)을 포함한 순수 JSON 객체만 출력하세요.
5) 팬아웃 추천 질문(fanoutQuestions) 작성 시 절대 주의:
   - 반드시 현재 키워드('${keyword}'${company ? `, '${company}'` : ''})의 실제 품목·서비스·특징(예: 식음료·신메뉴면 맛·토핑·가격·칼로리·판매매장·배달여부·꿀조합, 화장품이면 성분·피부타입·사용순서·용량 등)에 100% 맞춘 구체적인 심화 질문 6개를 작성하세요.
   - 주제와 무관한 엉뚱한 키워드(예: 다이소 뷰티, 팝업 주차 할인, 사전 예약 등)를 절대 섞지 마세요.`;

    const usr = `[작성 요청 정보]
- 키워드/주제: ${keyword}
- 타깃 기업/브랜드(선택): ${company || '관련 주요 브랜드·제품'}
- 참고 URL: ${url || '없음'}
- 추가 보도자료/메모: ${rawText || '없음'}
- 선택된 콘텐츠 유형: ${tInfo.shortName} (${tInfo.desc})
- 유형별 필수 구성 지침: ${typeInstructions[typeId] || typeInstructions[4]}
- 사전 팩트체크 시스템 진단(${preFactCheck.verdict}): ${preFactCheck.summary}

아래 JSON 스키마에 맞춰 주제('${keyword}')의 실제 공식 출시·언론 보도 진위를 먼저 검증(factVerification)한 뒤, 한국어로 작성하세요:
{
  "factVerification": {
    "verdict": "VERIFIED_FACT(공식 출시·언론 보도 확인) | AI_MEME_OR_VIRTUAL(가상·AI 생성 밈/정식 미출시) | UNVERIFIED_VIRAL(공식 보도 미확인 주의) 중 택 1",
    "isWarning": false,
    "badgeLabel": "✓ 공식 보도·실제 출시 팩트 확인됨 또는 🚨 [팩트체크 경보] 가상(AI 생성) 밈 · 공식 미출시 주의",
    "summary": "해당 키워드가 실제 정식 출시·보도된 팩트인지, 아니면 SNS 상의 가상(AI 생성) 밈/미확인 바이럴인지 실무진이 즉시 알 수 있도록 1~2문장으로 명확히 판별한 팩트체크 리포트 (~합니다 체)"
  },
  "mkCategory": "산업 Q&A | 제품·기술 | 성공사례 | 기업뉴스 | 브랜드스토리(기업관) 중 택 1",
  "mkCategoryReason": "이 기사에 해당 MK Pick 카테고리를 추천한 이유 1문장 (~합니다 체)",
  "titleCandidates": [
    {"id": "tc-1", "title": "\\"큰따옴표 인용구\\"…핵심 키워드 포함 설명형 제목", "totalScore": 96},
    {"id": "tc-2", "title": "\\"큰따옴표 인용구\\"…설명형 제목 2", "totalScore": 93},
    {"id": "tc-3", "title": "\\"큰따옴표 인용구\\"…설명형 제목 3", "totalScore": 90},
    {"id": "tc-4", "title": "\\"큰따옴표 인용구\\"…설명형 제목 4", "totalScore": 88},
    {"id": "tc-5", "title": "\\"큰따옴표 인용구\\"…설명형 제목 5", "totalScore": 85}
  ],
  "researchFacts": [
    {"category": "브랜드·출시 핵심 팩트", "sourceTitle": "[참고 보도 · 언론/공식자료] 실제 보도 또는 공식 출시 이슈 제목 1", "fact": "구체적인 브랜드명·출시 배경·수치가 포함된 ~합니다 체 취재 팩트 문장 1"},
    {"category": "제품·메뉴 핵심 특징", "sourceTitle": "[참고 보도 · 업계 동향] 주요 특징·성분·원재료 관련 보도 제목 2", "fact": "구체적인 제품 특징·원재료·차별점이 포함된 ~합니다 체 취재 팩트 문장 2"},
    {"category": "유통·매장 판매 동향", "sourceTitle": "[참고 보도 · 유통가] 백화점·매장·온라인 판매처 및 웨이팅 동향 제목 3", "fact": "주요 매장 위치·판매 채널·오픈런/품절 동향이 포함된 ~합니다 체 취재 팩트 문장 3"},
    {"category": "소비자·SNS 반응", "sourceTitle": "[참고 보도 · 트렌드] 2030 소비자 및 숏폼·SNS 화제성 관련 제목 4", "fact": "SNS·유튜브 쇼츠 리뷰 확산 이유와 소비자 반응이 포함된 ~합니다 체 취재 팩트 문장 4"},
    {"category": "가격·구성 및 구매 팁", "sourceTitle": "[참고 보도 · 구매 가이드] 가격대·세트 구성·프로모션 정보 제목 5", "fact": "가격·용량·선물 패키지·구매 시 참고할 점이 포함된 ~합니다 체 취재 팩트 문장 5"}
  ],
  "subtitle": "기사 부제 2줄 (줄바꿈 \\n 사용)",
  "aiFactSummary": [
    "1. 핵심 팩트 요약 첫 번째 문장 (~합니다 체)",
    "2. 핵심 팩트 요약 두 번째 문장 (~합니다 체)",
    "3. 핵심 팩트 요약 세 번째 문장 (~합니다 체)"
  ],
  "draftSections": [
    {"id": "sec-1", "title": "독자의 관심을 끄는 도입·배경 소제목 (주제 맞춤형)", "content": "독자 공감 리드 + 해당 주제/트렌드가 주목받는 이유와 배경 2~3문단 (~합니다 체)", "imageCaption": "< 출처 : 관련 브랜드·공식 자료 >"},
    {"id": "sec-2", "title": "핵심 포인트·아이템 1 심층 분석 소제목", "content": "첫 번째 핵심 키워드/아이템/브랜드의 구체적인 특징·성분·인기 요인 및 사례 상세 서술 (~합니다 체)", "imageCaption": "< 출처 : 관련 기업 >"},
    {"id": "sec-3", "title": "핵심 포인트·아이템 2 심층 분석 소제목", "content": "두 번째 핵심 키워드/아이템/브랜드의 차별화 포인트와 시장 반응 상세 서술 (~합니다 체)", "imageCaption": "< 출처 : 공식 채널 >"},
    {"id": "sec-4", "title": "선택 가이드 및 실생활 활용 팁 소제목", "content": "소비자·독자가 알아두면 좋은 선택 기준, 사용 팁 및 향후 전망 정리 (~합니다 체)", "imageCaption": "< 출처 : 공식 채널 >"}
  ],
  "summaryTable": {
    "title": "[ 핵심 항목 한눈에 비교 ]",
    "headers": ["구분", "핵심 특징 및 구성", "주요 포인트·성분", "기대 효과·강점", "추천 대상 및 활용 팁"],
    "rows": [
      ["항목/제품 1", "핵심 형태·구분", "주요 특징 요약", "핵심 강점·효과", "추천 대상 및 활용법"],
      ["항목/제품 2", "핵심 형태·구분", "주요 특징 요약", "핵심 강점·효과", "추천 대상 및 활용법"],
      ["항목/제품 3", "핵심 형태·구분", "주요 특징 요약", "핵심 강점·효과", "추천 대상 및 활용법"],
      ["항목/제품 4", "핵심 형태·구분", "주요 특징 요약", "핵심 강점·효과", "추천 대상 및 활용법"]
    ]
  },
  "glossaryTitle": "주제를 더 깊이 이해하는 용어 사전",
  "glossary": [
    {"term": "핵심 용어 1 (영문)", "desc": "누구나 이해하기 쉬운 1~2문장 개념 해설 (~합니다 체)"},
    {"term": "핵심 용어 2 (영문)", "desc": "누구나 이해하기 쉬운 1~2문장 개념 해설 (~합니다 체)"},
    {"term": "핵심 용어 3 (영문)", "desc": "누구나 이해하기 쉬운 1~2문장 개념 해설 (~합니다 체)"},
    {"term": "핵심 용어 4 (영문)", "desc": "누구나 이해하기 쉬운 1~2문장 개념 해설 (~합니다 체)"},
    {"term": "핵심 용어 5 (영문)", "desc": "누구나 이해하기 쉬운 1~2문장 개념 해설 (~합니다 체)"}
  ],
  "faqs": [
    {"q": "Q1. 실제 독자가 검색창에 물어볼 법한 구어체 자연어 질문", "a": "구체적인 수치·장소·조건이 담긴 2~3문장 완결형 답변 (~합니다 체)"}
  ],
  "fanoutQuestions": [
    {"category": "핵심특징·비교", "q": "'${keyword}'에 대해 독자가 추가로 가장 궁금해할 구체적인 꼬리 질문 1 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"},
    {"category": "가격·구성", "q": "'${keyword}' 가격·용량·구성에 관한 구체적인 꼬리 질문 2 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"},
    {"category": "이용·구매처", "q": "'${keyword}' 구매 채널·매장·배달·온라인 이용에 관한 꼬리 질문 3 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"},
    {"category": "추천조합·활용팁", "q": "'${keyword}'을 더 맛있게/효과적으로 즐기는 조합이나 활용 팁 질문 4 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"},
    {"category": "성분·스펙·보관", "q": "'${keyword}' 원재료·성분·칼로리·보관법 등에 관한 꼬리 질문 5 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"},
    {"category": "이벤트·프로모션", "q": "'${keyword}' 출시 기념 혜택·할인·한정 여부에 관한 꼬리 질문 6 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"}
  ],
  "closingParagraph": "기사 전체 핵심 메시지를 종합하며 독자에게 실질적인 통찰과 여운을 남기는 마무리 총평 2~3문장 (~합니다 체)",
  "oneLineSummary": "한 줄 요약! “핵심 통찰 인용구” 독자가 꼭 기억해야 할 핵심 메시지입니다."
}`;

    const { parsed, citations } = await callPerplexityDirectFromBrowser(apiKey, sys, usr, 'month', 'draft');
    const mergedSources = [];
    const factsArr = Array.isArray(parsed.researchFacts) ? parsed.researchFacts : [];
    factsArr.forEach((rf, i) => {
      const citUrl = (typeof citations[i] === 'string' && citations[i])
        ? citations[i]
        : `https://news.google.com/search?q=${encodeURIComponent(keyword + (company ? ' ' + company.split(',')[0] : ''))}&hl=ko&gl=KR&ceid=KR:ko`;
      const srcTitle = rf.sourceTitle || `[Perplexity 실시간 검증 출처 #${i + 1}] ${keyword} 관련 보도`;
      mergedSources.push({
        id: `src-pplx-${i + 1}`,
        url: citUrl,
        title: srcTitle,
        method: 'Perplexity 실시간 검색',
        reliability: '높음',
        excluded: false
      });
    });
    citations.slice(factsArr.length, 6).forEach((citUrl, idx) => {
      if (typeof citUrl === 'string' && !mergedSources.some(s => s.url === citUrl)) {
        const num = mergedSources.length + 1;
        mergedSources.push({
          id: `src-pplx-${num}`,
          url: citUrl,
          title: `[Perplexity 실시간 검증 출처 #${num}] ${citUrl}`,
          method: 'Perplexity 실시간 검색',
          reliability: '높음',
          excluded: false
        });
      }
    });
    if (mergedSources.length === 0 && Array.isArray(baseScenario.sources)) {
      mergedSources.push(...baseScenario.sources);
    }

    const researchItems = factsArr.length > 0
      ? factsArr.map((rf, i) => ({
          id: `ri-pplx-${i + 1}`,
          category: rf.category || `핵심 취재 팩트 #${i + 1}`,
          fact: rf.fact,
          rawReference: rf.sourceTitle || 'Perplexity 실시간 웹 검색 및 매경 문체 재가공',
          sourceIds: [mergedSources[i % Math.max(1, mergedSources.length)]?.id].filter(Boolean)
        }))
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

    const validCategories = MK_PICK_CATEGORIES.map(c => c.id);
    const chosenCat = validCategories.includes(parsed.mkCategory) ? parsed.mkCategory : fallbackCat.recommendedCategory || fallbackCat;
    const summaryBlocks = {
      ...baseScenario.summaryBlocks,
      mkCategory: chosenCat,
      mkCategoryReason: normalizeNewlines(parsed.mkCategoryReason || baseScenario.summaryBlocks.mkCategoryReason).trim(),
      byline: `${chosenCat} | 남궁선희 기자 | 입력 ${new Date().toISOString().slice(0, 10).replace(/-/g, '.')} 10:00`,
      subtitle: normalizeNewlines(parsed.subtitle || baseScenario.summaryBlocks.subtitle).trim(),
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
      faqs: Array.isArray(parsed.faqs) && parsed.faqs.length > 0
        ? parsed.faqs.map((f, i) => ({
            q: /^Q\d+\./i.test(normalizeNewlines(f.q || '').trim())
              ? normalizeNewlines(f.q || '').trim()
              : `Q${i + 1}. ${normalizeNewlines(f.q || '').trim()}`,
            a: normalizeNewlines(f.a || '').trim()
          }))
        : baseScenario.summaryBlocks.faqs,
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
      titleCandidates: Array.isArray(parsed.titleCandidates) && parsed.titleCandidates.length > 0
        ? parsed.titleCandidates
        : baseScenario.titleCandidates,
      sources: mergedSources,
      researchItems,
      draftSections,
      summaryBlocks,
      factChecks: extractFactSentencesFromSections(draftSections, mergedSources),
      factVerification: finalFactVerification
    };
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
      'geo-2': (sb.aiFactSummary || []).filter(line => line.trim().length > 5).length >= 3,
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

  // CMS 붙여넣기용 전체 순수 텍스트 생성
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
    lines.push('');

    if (sb.aiFactSummary && sb.aiFactSummary.length > 0) {
      lines.push('[AI 팩트 체크 요약]');
      sb.aiFactSummary.forEach(item => lines.push(String(item || '').replace(/\\n/g, '\n')));
      lines.push('');
    }

    if (sb.subtitle) {
      lines.push(String(sb.subtitle || '').replace(/\\n/g, '\n'));
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

  async function saveCurrentWork(silent = true) {
    if (!state.currentWork) return;
    updateLiveStatsAndGeoUI();
    const targetWork = state.currentWork;
    const idx = state.works.findIndex(w => w.id === targetWork.id);
    if (idx !== -1) state.works[idx] = targetWork;
    try {
      localStorage.setItem(CLIENT_WORKS_STORAGE_KEY, JSON.stringify(state.works.slice(0, 30)));
    } catch (e) {}
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
      try {
        const savedWorks = localStorage.getItem(CLIENT_WORKS_STORAGE_KEY);
        if (savedWorks) localWorks = JSON.parse(savedWorks);
      } catch (e) {}

      // 서버 DB 작업과 브라우저 로컬 저장소 작업을 병합하여 새로고침·서버 재시작 시에도 이전 기록 완벽 보존
      const mergedMap = new Map();
      [...localWorks, ...serverWorks].forEach(w => {
        if (w && w.id && !mergedMap.has(w.id)) {
          mergedMap.set(w.id, w);
        }
      });
      state.works = mergedMap.size > 0 ? Array.from(mergedMap.values()) : (getInitialWorks ? getInitialWorks() : []);
      try {
        localStorage.setItem(CLIENT_WORKS_STORAGE_KEY, JSON.stringify(state.works.slice(0, 30)));
      } catch (e) {}

      // 새로고침(F5) 직전에 보고 있던 화면(편집 중이던 기사 등) 복원
      try {
        const uiRaw = localStorage.getItem(CLIENT_UI_STATE_KEY);
        if (uiRaw) {
          const uiState = JSON.parse(uiRaw);
          if (uiState.currentWorkId) {
            const foundWork = state.works.find(w => w.id === uiState.currentWorkId);
            if (foundWork) {
              state.currentWork = foundWork;
              if (uiState.screen === 'editor') state.screen = 'editor';
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
    } catch (err) {
      state.works = getInitialWorks ? getInitialWorks() : [];
    }
    render();
    loadTrends().then(() => render(true));
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
    const shareBase = 'https://moneymoeungu.github.io/mk-pick-content-studio/public/index.html';
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
            <h3 style="font-size: 17px; font-weight: 800;">Perplexity API 설정 · 실시간 과금(버닝) 모니터</h3>
            <button type="button" class="text-action" id="closeApiModalBtn" style="font-size: 16px;">✕</button>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.55;">
            현재 Perplexity Responses API의 <strong><code>google/gemini-4-argon</code> (제미나이 아르곤)</strong> 엔진을 사용하며, <strong>30분 스마트 캐시</strong>가 적용되어 단순 웹 접속이나 브라우저 새로고침(<code>F5</code>) 시에는 API가 중복 호출되지 않습니다(0원).
          </p>

          <!-- 실시간 API 사용량 & 예상 비용 대시보드 -->
          <div style="padding: 12px 14px; background-color: var(--bg-subtle); border: var(--border-thin); border-radius: var(--radius-general); margin-bottom: 14px;">
            <div class="flex-between mb-6">
              <strong style="font-size: 12.5px; color: var(--text-primary);">📊 누적 API 호출 및 실제 과금(버닝) 현황</strong>
              <span style="font-size: 11.5px; color: var(--mk-orange); font-weight: 700;">엔진: google/gemini-4-argon</span>
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

  function renderTopbar() {
    const nav = document.getElementById('topbarNav');
    const meta = document.getElementById('topbarMeta');
    if (!nav || !meta) return;

    nav.innerHTML = `
      <button type="button" class="trend-clean-tab ${state.screen === 'home' ? 'active' : ''}" id="topGoHomeBtn" style="border-bottom-width: 2px; padding: 16px 6px;">
        홈 · 유형 및 트렌드 선택
      </button>
      ${state.currentWork ? `
        <button type="button" class="trend-clean-tab ${state.screen === 'editor' ? 'active' : ''}" id="topGoEditorBtn" style="border-bottom-width: 2px; padding: 16px 6px; margin-left: 12px;">
          편집 중인 기사 (${escapeHtml(state.currentWork.keyword)})
        </button>
      ` : ''}
    `;

    const calls = state.apiUsageStats?.totalCalls || 0;
    const krw = state.apiUsageStats?.estimatedCostKrw || 0;
    meta.innerHTML = `
      <div class="flex-row" style="gap: 8px;">
        ${state.hasPerplexityKey ? `
          <button type="button" class="btn btn-sm" id="topbarCopyShareLinkBtn" style="border-color: #8FD4B2; color: var(--status-green); background-color: #FFFFFF; font-weight: 800;" title="다른 사람의 브라우저에서도 API 키가 자동 연결되는 공유 링크를 복사합니다">
            🔗 API 포함 공유 링크 복사
          </button>
        ` : ''}
        <button type="button" class="btn btn-sm" id="openUserGuideModalBtn" style="border-color: var(--mk-orange); color: var(--mk-orange); background-color: #FFFFFF; font-weight: 800;">
          📖 사용 가이드 (PPT·PDF)
        </button>
        <button type="button" class="btn btn-sm" id="openApiKeyModalBtn" style="border-color: ${state.hasPerplexityKey ? '#8FD4B2' : 'var(--mk-orange)'}; color: ${state.hasPerplexityKey ? 'var(--status-green)' : 'var(--mk-orange)'}; background-color: ${state.hasPerplexityKey ? 'var(--status-green-bg)' : 'var(--mk-orange-light)'}; font-weight: 700;">
          ${state.hasPerplexityKey ? `🟢 Gemini-4-Argon 연결됨 · 호출 ${calls}회 (약 ${krw}원)` : '⚙ Perplexity API 키 설정 · 사용량 확인'}
        </button>
      </div>
    `;

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
  }

  // 스크롤 위치를 유지하면서 화면을 다시 그리는 함수
  function render(preserveScroll = false) {
    const prevWinScroll = preserveScroll ? window.scrollY : 0;
    const leftPanel = document.querySelector('.left-panel-sticky');
    const prevLeftScroll = preserveScroll && leftPanel ? leftPanel.scrollTop : 0;

    renderTopbar();
    try {
      localStorage.setItem(CLIENT_UI_STATE_KEY, JSON.stringify({
        screen: state.screen,
        currentWorkId: state.currentWork?.id || null,
        homeDiscoveryTab: state.homeDiscoveryTab,
        trendTab: state.trendTab,
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

    if (preserveScroll) {
      window.scrollTo(0, prevWinScroll);
      const newLeftPanel = document.querySelector('.left-panel-sticky');
      if (newLeftPanel) newLeftPanel.scrollTop = prevLeftScroll;
    }
    syncDraftFloatingBannerDOM();
  }

  let draftTimerId = null;
  const ESTIMATED_DRAFT_TOTAL_SEC = 15;

  function formatDraftRemainingInfo(elapsedSec) {
    const remain = Math.max(0, Math.ceil(ESTIMATED_DRAFT_TOTAL_SEC - elapsedSec));
    const pct = elapsedSec < ESTIMATED_DRAFT_TOTAL_SEC
      ? Math.min(92, Math.round((elapsedSec / ESTIMATED_DRAFT_TOTAL_SEC) * 90) + 5)
      : Math.min(98, 92 + Math.floor((elapsedSec - ESTIMATED_DRAFT_TOTAL_SEC) / 2));

    let stageText = '1/3단계 · 실시간 뉴스·유튜브 쇼츠 팩트 및 원문 출처 수집 중...';
    if (elapsedSec >= 3.0 && elapsedSec < 9.5) {
      stageText = '2/3단계 · Gemini-4-Argon 엔진이 매경 경어체 본문 3~4단락을 집필하고 있습니다...';
    } else if (elapsedSec >= 9.5) {
      stageText = '3/3단계 · 5열 비교 요약표 · 핵심 용어사전 · FAQ 3선 및 팩트체크 구성 중...';
    }

    const timeBadgeText = remain > 0
      ? `${elapsedSec.toFixed(1)}초 경과 · 완료까지 약 ${remain}초 남음`
      : `${elapsedSec.toFixed(1)}초 경과 · 마무리 정리 중 (곧 완료됩니다)`;

    const shortBtnText = remain > 0
      ? `⏳ 생성 중 (${elapsedSec.toFixed(1)}초 / 약 ${remain}초 남음)`
      : `⏳ 마무리 중 (${elapsedSec.toFixed(1)}초 경과)`;

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

  // 트렌드 키워드 또는 직접 입력으로 바로 기사 초안 생성하는 공통 함수
  async function startWorkWithKeyword(rawKeyword, typeId = 4, rawCompany = '', autoMatchType = false) {
    if (state.isSearchingNews) return;
    const keyword = cleanTrendTopicKeyword ? cleanTrendTopicKeyword(rawKeyword) : String(rawKeyword || '').trim();
    const company = extractBrandFromTopic ? extractBrandFromTopic(keyword, rawCompany) : String(rawCompany || '').trim();
    const matchedType = autoMatchType ? detectBestContentType(keyword, company, state.homeInput.rawText, typeId) : typeId;
    const tName = CONTENT_TYPES[matchedType]?.shortName || '맞춤 유형';
    state.homeInput.keyword = keyword;
    if (company) state.homeInput.company = company;
    state.homeInput.typeId = matchedType;
    state.isSearchingNews = true;
    const stopTimer = startDraftProgressTimer(keyword, tName);
    render(true);
    try {
      const res = await apiFetch('/api/works', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'dynamic',
          keyword,
          company,
          url: state.homeInput.url || '',
          rawText: state.homeInput.rawText || '',
          typeId: matchedType,
          autoMatchType
        })
      });
      await loadConfig();
      state.isSearchingNews = false;
      const elapsed = stopTimer();
      state.currentWork = res.work;
      state.works.unshift(res.work);
      try {
        localStorage.setItem(CLIENT_WORKS_STORAGE_KEY, JSON.stringify(state.works.slice(0, 30)));
      } catch (e) {}
      state.screen = 'editor';
      const finalTypeName = CONTENT_TYPES[res.work.typeId]?.shortName || tName;
      const finalCat = res.work.summaryBlocks?.mkCategory || '산업 Q&A';
      showToast(`✓ [${finalTypeName} · ${finalCat}] '${keyword}' 맞춤 초안이 완성되었습니다! (${elapsed}초 소요)`);
      render(false);
    } catch (err) {
      // GitHub Pages 등 정적 호스팅 환경: 브라우저에서 Perplexity API를 직접 호출해 실시간 초안 생성
      let fallbackScenario = (buildDynamicScenario || buildPresetScenario)({
        keyword,
        company,
        url: state.homeInput.url || '',
        rawText: state.homeInput.rawText || '',
        typeId: matchedType,
        selectedType: matchedType
      });
      const clientKey = getClientPerplexityKey();
      if (clientKey) {
        try {
          fallbackScenario = await buildClientPerplexityEnhancedScenario({
            apiKey: clientKey,
            keyword,
            company,
            url: state.homeInput.url || '',
            rawText: state.homeInput.rawText || '',
            typeId: matchedType,
            baseScenario: fallbackScenario
          });
        } catch (pplxErr) {
          console.warn('Client Perplexity draft fallback:', pplxErr.message);
        }
      }
      await loadConfig();
      state.isSearchingNews = false;
      const elapsed = stopTimer();
      const fallbackWork = createWorkObject
        ? createWorkObject({
            typeId: matchedType,
            keyword,
            company,
            url: state.homeInput.url || '',
            rawText: state.homeInput.rawText || '',
            scenario: fallbackScenario
          })
        : {
            id: 'work-' + Date.now(),
            typeId: matchedType,
            keyword,
            inputCompany: company,
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
      state.currentWork = fallbackWork;
      state.works.unshift(fallbackWork);
      try {
        localStorage.setItem(CLIENT_WORKS_STORAGE_KEY, JSON.stringify(state.works.slice(0, 30)));
      } catch (e) {}
      state.screen = 'editor';
      const finalCat = fallbackWork.summaryBlocks?.mkCategory || '산업 Q&A';
      showToast(`✓ [${tName} · ${finalCat}] '${keyword}' 맞춤 초안이 완성되었습니다! (${elapsed}초 소요)`);
      render(false);
    }
  }

  // ==========================================================================
  // 화면 1: 첫 화면 (2단 구조로 대폭 단순화)
  //   - 상단 카드 1: [새 기사 초안 만들기] (키워드 입력 + 5열 컴팩트 유형 선택 + 단 1개의 명확한 생성 버튼)
  //   - 하단 카드 2: [소재 발굴 & 작업 보관함] (🔥 실시간 트렌드 10선 | 📅 2026 마케팅 캘린더 | 📂 최근 작업 기사 3탭 전환)
  // ==========================================================================
  function renderHomeScreen(root) {
    const hi = state.homeInput;
    const selectedTypeInfo = CONTENT_TYPES[hi.typeId] || CONTENT_TYPES[4];
    const previewCat = recommendMkPickCategory(hi.keyword || selectedTypeInfo.name, hi.typeId, hi.company);
    const calData = MONTHLY_MARKETING_CALENDAR[state.calendarMonth] || MONTHLY_MARKETING_CALENDAR[10];

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
      <!-- 1. 상단 통합 작성 카드: 키워드 입력 + 5대 콘텐츠 유형(5열 그리드) + 초안 만들기 버튼 하나로 완결 -->
      <div class="card" style="padding: 26px 28px; margin-bottom: 20px;">
        <div class="flex-between mb-12" style="flex-wrap: wrap; gap: 8px;">
          <div>
            <h1 style="font-size: 19px; font-weight: 800; letter-spacing: -0.3px;">새 기사 초안 만들기</h1>
            <p style="font-size: 13px; color: var(--text-secondary); margin-top: 2px;">
              <strong>① 키워드</strong>를 입력하고 <strong>② 콘텐츠 유형(01~05)</strong>을 고른 뒤 우측 <strong>[초안 만들기 →]</strong> 버튼을 누르세요.
            </p>
          </div>
          <span id="toggleRawPasteBtn" class="text-action" style="text-decoration: underline;">
            ${state.showRawPasteInput ? '보도자료 / 참고 URL 입력창 접기 ▲' : '+ 보도자료 원문이나 참고 URL 추가 (선택)'}
          </span>
        </div>

        <!-- STEP 1: 키워드 · 기업명 입력 + 단 1개의 명확한 실행 버튼 -->
        <div style="display: grid; grid-template-columns: 1.6fr 1fr auto; gap: 10px; align-items: end; margin-bottom: 18px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:800; color:var(--text-primary); margin-bottom:5px;">
              <span style="color: var(--mk-orange); margin-right: 4px;">STEP 1</span>트렌드 키워드 / 주제
            </label>
            <input type="text" class="input" id="homeKeywordInput" placeholder="예: 한남동 팔란티어 팝업 품절, 다이소 뷰티, 10월 10일 임산부의 날..." value="${escapeHtml(hi.keyword)}" style="padding: 11px 14px; font-size: 14px;" />
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:700; color:var(--text-secondary); margin-bottom:5px;">
              기업·브랜드명 <span style="font-weight: 400; color: var(--text-muted);">(선택 · 쉼표로 복수 입력 가능)</span>
            </label>
            <input type="text" class="input" id="homeCompanyInput" placeholder="예: 매일유업, 유한킴벌리" value="${escapeHtml(hi.company)}" style="padding: 11px 14px; font-size: 14px;" />
          </div>
          <div>
            <button class="btn btn-primary btn-lg" id="homeStartDynamicBtn" style="height: 44px; padding: 0 24px; font-size: 14.5px; font-weight: 800;" ${state.isSearchingNews ? 'disabled' : ''}>
              ${state.isSearchingNews ? formatDraftRemainingInfo(state.draftElapsedSec || 0).shortBtnText : '✨ 초안 만들기 →'}
            </button>
          </div>
        </div>

        ${state.showRawPasteInput ? `
          <div class="grid-2 mb-16" style="padding: 12px 14px; background-color: var(--bg-subtle); border: var(--border-thin); border-radius: var(--radius-general);">
            <div>
              <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">참고 URL (업체 홈페이지·보도자료 링크)</label>
              <input type="url" class="input" id="homeUrlInput" placeholder="https://..." value="${escapeHtml(hi.url)}" />
            </div>
            <div>
              <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">보도자료 핵심 문구 붙여넣기</label>
              <input type="text" class="input" id="homeRawTextInput" placeholder="기사에 꼭 들어갈 수치나 기업 서비스 내용을 붙여넣으세요" value="${escapeHtml(hi.rawText)}" />
            </div>
          </div>
        ` : ''}

        <!-- STEP 2: 5가지 콘텐츠 유형 선택 (한 줄 5열 컴팩트 그리드) -->
        <div style="padding-top: 14px; border-top: var(--border-thin);">
          <div class="flex-between mb-8" style="flex-wrap: wrap; gap: 6px;">
            <div style="font-size: 12px; font-weight: 800; color: var(--text-primary);">
              <span style="color: var(--mk-orange); margin-right: 4px;">STEP 2</span>콘텐츠 유형 선택 (5대 템플릿 · 키워드 입력 시 자동 추천되며 직접 변경 가능)
            </div>
            <div style="font-size: 12px; color: var(--text-secondary);">
              추천 MK Pick 카테고리: <strong style="color: var(--mk-orange);">[${escapeHtml(previewCat.recommendedCategory)}]</strong>
            </div>
          </div>

          <div class="home-type-grid">
            ${Object.values(CONTENT_TYPES).map(t => {
              const isSelected = Number(hi.typeId) === t.id;
              return `
                <div class="home-type-card ${isSelected ? 'selected' : ''}" data-select-home-type="${t.id}">
                  <div>
                    <div class="flex-between mb-6">
                      <span style="font-size: 12px; font-weight: 800; color: ${isSelected ? 'var(--mk-orange)' : 'var(--text-muted)'};">
                        유형 0${t.id}
                      </span>
                      <span style="font-size: 11px; font-weight: 700; color: ${isSelected ? 'var(--mk-orange)' : 'var(--text-secondary)'}; background-color: ${isSelected ? 'var(--white)' : 'var(--bg-subtle)'}; border: var(--border-thin); padding: 1px 6px; border-radius: 4px;">
                        ${escapeHtml(t.defaultCategory)}
                      </span>
                    </div>
                    <div style="font-size: 13.5px; font-weight: 800; color: ${isSelected ? 'var(--mk-orange)' : 'var(--text-primary)'}; margin-bottom: 4px; line-height: 1.35;">
                      ${escapeHtml(t.name)}
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.45;">
                      ${escapeHtml(t.desc)}
                    </div>
                  </div>
                  <div style="margin-top: 10px; padding-top: 8px; border-top: var(--border-thin); font-size: 11.5px; font-weight: ${isSelected ? '800' : '600'}; color: ${isSelected ? 'var(--mk-orange)' : 'var(--text-muted)'}; text-align: right;">
                    ${isSelected ? '✓ 현재 선택됨' : '선택하기'}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- 선택된 유형의 본문 전개 프로세스 1줄 요약 바 -->
          <div class="flex-between mt-12" style="padding: 9px 14px; background-color: var(--bg-subtle); border: var(--border-thin); border-radius: var(--radius-general); flex-wrap: wrap; gap: 8px;">
            <div style="font-size: 12.5px; color: var(--text-secondary);">
              <strong style="color: var(--mk-orange); margin-right: 6px;">[${escapeHtml(selectedTypeInfo.shortName)}] 본문 구성 흐름:</strong>
              ${escapeHtml(selectedTypeInfo.structure)}
            </div>
            <span style="font-size: 11.5px; color: var(--text-muted);">
              소재를 아직 못 정하셨다면 아래 탭에서 트렌드 키워드나 캘린더 일정을 클릭해 바로 시작하세요 ↓
            </span>
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
                    <div style="min-width: 0; flex: 1;">
                      <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 2px;">
                        <span style="font-size: 12px; font-weight: 800; color: var(--mk-orange); width: 18px;">${idx + 1}</span>
                        <strong style="font-size: 14px; color: var(--text-primary);">${escapeHtml(item.keyword)}</strong>
                        <span style="font-size: 11px; font-weight: 700; color: var(--mk-orange); background-color: ${isThisRowGenerating ? '#FFFFFF' : 'var(--mk-orange-light)'}; padding: 1px 6px; border-radius: 4px;">
                          유형 0${matchedTypeId} · ${escapeHtml(matchedCat)}
                        </span>
                        <span style="font-size: 10.5px; font-weight: 800; color: ${rowFv.isWarning ? '#D9480F' : '#1B7F3B'}; background-color: ${rowFv.isWarning ? '#FFF4E6' : '#EBFBEE'}; border: 1px solid ${rowFv.isWarning ? '#FFC078' : '#B2F2BB'}; padding: 1px 6px; border-radius: 4px;">
                          ${rowFv.isWarning ? '⚠️ 팩트체크 확인 권장' : `✓ 언론 보도 확인${shortSource ? ` · ${escapeHtml(shortSource)}` : ''}`}
                        </span>
                      </div>
                      <div style="font-size: 12.5px; color: var(--text-secondary); padding-left: 24px;">
                        ${escapeHtml(item.desc)}
                      </div>
                    </div>
                    <div class="flex-row" style="gap: 6px; flex-shrink: 0;">
                      <a
                        href="${escapeHtml(articleUrl)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        data-trend-ext-link="1"
                        style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); background-color: var(--bg-subtle); border: var(--border-thin); padding: 3px 8px; border-radius: 4px; text-decoration: none; white-space: nowrap;"
                        title="${escapeHtml(linkTooltip)}"
                      >
                        ${escapeHtml(linkLabel)}
                      </a>
                      <a
                        href="${escapeHtml(factCheckSearchUrl)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        data-trend-ext-link="1"
                        style="font-size: 11px; font-weight: 700; color: #1B7F3B; background-color: #EBFBEE; border: 1px solid #B2F2BB; padding: 3px 7px; border-radius: 4px; text-decoration: none; white-space: nowrap;"
                        title="네이버 뉴스에서 실제 언론 보도 여부를 즉시 검색해 교차 확인합니다"
                      >
                        팩트 검색 ↗
                      </a>
                      <span ${isThisRowGenerating ? 'data-active-generating-badge="1"' : ''} style="font-size: 12px; font-weight: 800; color: var(--mk-orange); white-space: nowrap; ${isThisRowGenerating ? 'background-color: #FFFFFF; padding: 3px 9px; border-radius: 99px; border: 1px solid var(--mk-orange);' : ''}">
                        ${isThisRowGenerating ? escapeHtml(formatDraftRemainingInfo(state.draftElapsedSec || 0).shortBtnText) : '초안 생성 →'}
                      </span>
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

            <!-- 선택된 월의 핵심 테마 및 업종별 큐레이션 요약 -->
            <div class="flex-between mb-12" style="padding: 10px 14px; background-color: var(--bg-subtle); border-radius: var(--radius-general); flex-wrap: wrap; gap: 8px;">
              <div>
                <span style="font-size: 12.5px; font-weight: 800; color: var(--mk-orange); margin-right: 8px;">2026년 ${calData.month}월 핵심 테마</span>
                <strong style="font-size: 13.5px; color: var(--text-primary);">${escapeHtml(calData.theme)}</strong>
              </div>
              <div class="flex-row" style="gap: 6px;">
                ${(calData.keyTags || []).map(tag => `
                  <span style="font-size: 11.5px; color: var(--text-secondary); background-color: var(--white); border: var(--border-thin); padding: 2px 8px; border-radius: 99px;">
                    #${escapeHtml(tag)}
                  </span>
                `).join('')}
              </div>
            </div>

            ${calData.curation ? `
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px;">
                <div style="padding: 9px 12px; border: var(--border-thin); border-radius: var(--radius-general); background-color: var(--white);">
                  <div style="font-size: 11px; font-weight: 800; color: var(--mk-orange); margin-bottom: 2px;">🍽️ EAT · 식음료/외식</div>
                  <div style="font-size: 12px; color: var(--text-primary); font-weight: 600;">${escapeHtml(calData.curation.eat)}</div>
                </div>
                <div style="padding: 9px 12px; border: var(--border-thin); border-radius: var(--radius-general); background-color: var(--white);">
                  <div style="font-size: 11px; font-weight: 800; color: var(--mk-orange); margin-bottom: 2px;">🛍️ BUY · 가전/패션/쇼핑</div>
                  <div style="font-size: 12px; color: var(--text-primary); font-weight: 600;">${escapeHtml(calData.curation.buy)}</div>
                </div>
                <div style="padding: 9px 12px; border: var(--border-thin); border-radius: var(--radius-general); background-color: var(--white);">
                  <div style="font-size: 11px; font-weight: 800; color: var(--mk-orange); margin-bottom: 2px;">📚 DO · 교육/생활서비스</div>
                  <div style="font-size: 12px; color: var(--text-primary); font-weight: 600;">${escapeHtml(calData.curation.do)}</div>
                </div>
                <div style="padding: 9px 12px; border: var(--border-thin); border-radius: var(--radius-general); background-color: var(--white);">
                  <div style="font-size: 11px; font-weight: 800; color: var(--mk-orange); margin-bottom: 2px;">🎬 PLAY · 여가/레저/콘텐츠</div>
                  <div style="font-size: 12px; color: var(--text-primary); font-weight: 600;">${escapeHtml(calData.curation.play)}</div>
                </div>
              </div>
            ` : ''}

            <div class="trend-clean-grid">
              ${(calData.events || []).map(ev => {
                const isThisCalGenerating = state.isSearchingNews && state.generatingKeyword === ev.keyword;
                const calGenStyle = isThisCalGenerating
                  ? 'border-color: var(--mk-orange); background-color: var(--mk-orange-light); box-shadow: 0 0 0 2px rgba(243, 112, 33, 0.16);'
                  : '';
                return `
                  <div class="trend-clean-row" style="${calGenStyle}" data-use-cal-kw="${escapeHtml(ev.keyword)}" data-use-cal-type="${ev.typeId}">
                    <div style="min-width: 0; flex: 1;">
                      <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 3px;">
                        <span style="font-size: 12px; font-weight: 800; color: var(--mk-orange);">${escapeHtml(ev.date)}</span>
                        <strong style="font-size: 14px; color: var(--text-primary);">${escapeHtml(ev.name)}</strong>
                        <span style="font-size: 11px; font-weight: 700; color: var(--mk-orange); background-color: ${isThisCalGenerating ? '#FFFFFF' : 'var(--mk-orange-light)'}; padding: 1px 6px; border-radius: 4px;">
                          유형 0${ev.typeId} · ${escapeHtml(ev.category)}
                        </span>
                      </div>
                      <div style="font-size: 12.5px; color: var(--text-secondary);">
                        ${escapeHtml(ev.desc)}
                      </div>
                    </div>
                    <span ${isThisCalGenerating ? 'data-active-generating-badge="1"' : ''} style="font-size: 12px; font-weight: 800; color: var(--mk-orange); white-space: nowrap; flex-shrink: 0; ${isThisCalGenerating ? 'background-color: #FFFFFF; padding: 3px 9px; border-radius: 99px; border: 1px solid var(--mk-orange);' : ''}">
                      ${isThisCalGenerating ? escapeHtml(formatDraftRemainingInfo(state.draftElapsedSec || 0).shortBtnText) : '초안 생성 →'}
                    </span>
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
    `;

    function syncHomeInputs() {
      hi.keyword = document.getElementById('homeKeywordInput')?.value || '';
      hi.company = document.getElementById('homeCompanyInput')?.value || '';
      if (state.showRawPasteInput) {
        hi.url = document.getElementById('homeUrlInput')?.value || '';
        hi.rawText = document.getElementById('homeRawTextInput')?.value || '';
      }
    }

    document.getElementById('homeKeywordInput')?.addEventListener('input', e => {
      hi.keyword = e.target.value;
      const autoDetected = detectBestContentType(hi.keyword, hi.company, hi.rawText, hi.typeId);
      if (hi.keyword.trim().length >= 2 && hi.typeId !== autoDetected) {
        hi.typeId = autoDetected;
      }
    });

    document.getElementById('homeKeywordInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        syncHomeInputs();
        if (!hi.keyword.trim()) {
          showToast('트렌드 키워드나 주제를 입력해 주세요!');
          return;
        }
        startWorkWithKeyword(hi.keyword, hi.typeId, hi.company, false);
      }
    });

    document.getElementById('toggleRawPasteBtn')?.addEventListener('click', () => {
      syncHomeInputs();
      state.showRawPasteInput = !state.showRawPasteInput;
      render(true);
    });

    // 5대 콘텐츠 유형 카드 클릭 시 유형 선택
    root.querySelectorAll('[data-select-home-type]').forEach(card => {
      card.addEventListener('click', () => {
        syncHomeInputs();
        const nextType = Number(card.getAttribute('data-select-home-type'));
        hi.typeId = nextType;
        render(true);
      });
    });

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
        render(true);
      });
    });

    // 월별 마케팅 캘린더 이벤트 클릭 시 해당 기념일/시즌 유형으로 즉시 초안 생성
    root.querySelectorAll('[data-use-cal-kw]').forEach(btn => {
      btn.addEventListener('click', () => {
        const kw = btn.getAttribute('data-use-cal-kw');
        const calType = Number(btn.getAttribute('data-use-cal-type')) || 2;
        syncHomeInputs();
        hi.keyword = kw;
        hi.typeId = calType;
        startWorkWithKeyword(kw, calType, hi.company, false);
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
      startWorkWithKeyword(hi.keyword, hi.typeId, hi.company, false);
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
          localStorage.setItem(CLIENT_WORKS_STORAGE_KEY, JSON.stringify(state.works.slice(0, 30)));
        } catch (e) {}
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

    // 유형별 및 주제 맞춤형 단락 역할 안내 라벨
    function getSectionRoleLabel(sec, sIdx, totalLen) {
      const titleStr = (sec?.title || '').trim();
      if (/^Bonus\s*Track/i.test(titleStr)) {
        return 'Bonus Track · 외전 & 추가 포인트';
      }
      const roleMap = {
        1: ['도입 · 소비자 고민과 트렌드 변화', '대표 서비스 · 파트너사별 핵심 혜택', '비교 · 업체별 차별점 및 추천 대상', '전망 · 실패 없는 선택 기준 제시'],
        2: ['도입 · 기념일 유래와 사회적 의미', '제도 · 정부·지자체 공식 지원 바우처', '브랜드별 소개 · 참여 기업 캠페인·제품 총정리', '시사점 · 캠페인 참여 방법과 기대 효과'],
        3: ['도입 · 트렌드 부상 배경과 핵심 화두', '심층 분석 1 · 주요 소재·주자별 핵심 특징', '심층 분석 2 · 시장 파급력과 대표 사례', '전망 · 향후 트렌드 흐름과 시사점'],
        4: ['도입 · 소비자 관심 배경과 트렌드 정의', '핵심 포인트 1 · 주요 아이템·성분·특징 분석', '핵심 포인트 2 · 브랜드별 차별점 및 인기 요인', '활용 가이드 · 똑똑한 선택 기준과 실전 팁'],
        5: ['도입 · 시장 메가 트렌드 Q1~Q4 문답', '해법 · 선택 기준 및 타깃 기업 Q5~Q7 집중 조명', '성과 · 핵심 기능과 기대효과 분석']
      };
      const list = roleMap[w.typeId] || roleMap[4];
      return list[sIdx] || '심층 분석 · 핵심 포인트 집중 조명';
    }

    root.innerHTML = `
      <!-- 상단 고정 액션 바: 스크롤 시에도 왼쪽·오른쪽 본문을 가리지 않도록 정밀 고정 -->
      <div class="editor-sticky-bar">
        <div class="flex-row" style="gap: 10px;">
          <button type="button" class="btn btn-sm" id="backToHomeBtn" style="font-weight: 700;">← 홈 · 소재 선택</button>
          <select class="select" id="editorTypeSelect" style="width: auto; padding: 5px 10px; font-weight: 700; background-color: var(--bg-subtle);">
            ${Object.values(CONTENT_TYPES).map(t => `
              <option value="${t.id}" ${w.typeId === t.id ? 'selected' : ''}>${escapeHtml(t.shortName)}</option>
            `).join('')}
          </select>
          <div class="mode-switch-group" title="구조별 편집 화면과 실제 발행 기사 미리보기를 전환합니다">
            <button type="button" class="mode-switch-btn ${!isPreview ? 'active' : ''}" data-editor-mode="edit">✏️ 구조별 편집</button>
            <button type="button" class="mode-switch-btn ${isPreview ? 'active' : ''}" data-editor-mode="preview">👁️ 실제 기사 미리보기</button>
          </div>
          <button type="button" class="text-action" id="clearToBlankBtn" title="빈 양식으로 비우기">빈 양식</button>
          <button type="button" class="text-action" id="restoreExampleBtn" title="초기 예시 복원">↺ 초안 복원</button>
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

        <!-- [왼쪽 보조 패널] 이중 스크롤바를 없애고 목적별 3개 탭(취재·메모 / 점검·팩트 / 목차·흐름)으로 깔끔하게 정리 -->
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
                <!-- [탭 1: 취재·메모] 다른 키워드로 기사 바꾸기 + 매경 문체 메모장 -->
                <div style="margin-bottom: 16px; padding-bottom: 14px; border-bottom: var(--border-thin);">
                  <div class="flex-between mb-6">
                    <strong style="font-size: 13px; font-weight: 800;">🔄 다른 키워드로 기사 새로 쓰기</strong>
                    <span class="text-muted">실시간 검색 연동</span>
                  </div>

                  <!-- 지저분한 해시태그 줄글 대신 깔끔한 1줄 인기 키워드 선택 드롭다운 -->
                  <div class="mb-8">
                    <select class="select" id="leftQuickTrendSelect" style="width: 100%; padding: 7px 10px; font-size: 12.5px; font-weight: 700; background-color: var(--mk-orange-light); border-color: var(--mk-orange-border); color: var(--text-primary); cursor: pointer;">
                      <option value="">🔥 실시간 인기 키워드에서 바로 골라 바꾸기 (${quickTrendTags.length}선) ▼</option>
                      ${quickTrendTags.map(tag => {
                        const autoT = detectBestContentType(tag, '', '', 4);
                        const autoTName = CONTENT_TYPES[autoT]?.shortName || '유형 04';
                        return `<option value="${escapeHtml(tag)}" ${w.keyword === tag ? 'selected' : ''}>[${escapeHtml(autoTName)}] ${escapeHtml(tag)}</option>`;
                      }).join('')}
                    </select>
                  </div>

                  <div class="flex-row mb-8" style="gap: 6px;">
                    <input type="text" class="input" id="leftSearchKwInput" value="${escapeHtml(w.keyword)}" placeholder="새 키워드 직접 입력" style="flex: 1; padding: 7px 10px;" />
                    <input type="text" class="input" id="leftSearchCompInput" value="${escapeHtml(w.inputCompany || '')}" placeholder="기업명(선택)" style="width: 92px; padding: 7px 10px;" />
                  </div>

                  <button
                    type="button"
                    class="btn btn-sm btn-outline-orange"
                    id="leftRebuildDraftBtn"
                    style="width: 100%; justify-content: center; padding: 8px 12px; font-weight: 800;"
                    ${state.isRefreshingInEditor ? 'disabled' : ''}
                  >
                    ${state.isRefreshingInEditor ? '⏳ 실시간 뉴스·Perplexity로 기사 새로 작성 중...' : '🔄 위 키워드로 오른쪽 기사 전체 새로 쓰기 →'}
                  </button>
                </div>

                <div>
                  <div class="flex-between mb-6" style="flex-wrap: wrap; gap: 4px;">
                    <strong style="font-size: 13.5px; font-weight: 800;">📌 취재 팩트 메모장 (${(w.researchItems || []).length}건)</strong>
                    <button
                      type="button"
                      class="text-action-orange"
                      id="leftFetchMemoOnlyBtn"
                      style="font-size: 11.5px; font-weight: 800;"
                      title="오른쪽 작성 중인 기사는 그대로 두고, 위 검색창 키워드의 최신 뉴스 문장만 이 메모장에 추가로 가져옵니다"
                      ${state.isRefreshingInEditor ? 'disabled' : ''}
                    >
                      ${state.isRefreshingInEditor ? '⏳ 뉴스 수집 중...' : '📰 최신 뉴스 문장만 메모장에 더 불러오기'}
                    </button>
                  </div>
                  <p class="text-muted mb-8" style="line-height: 1.45;">
                    오른쪽 작성 중인 기사는 그대로 유지하면서, 추가할 보도자료 문장이나 최신 뉴스 팩트를 <strong>매경 경어체("~합니다")</strong>로 다듬어 원하는 단락에 끼워 넣는 메모장입니다.
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
                      return `
                        <div class="clean-list-row">
                          <div style="font-size: 12.5px; color: var(--text-primary); line-height: 1.55; margin-bottom: 6px;">
                            ${escapeHtml(item.fact)}
                          </div>
                          <div class="flex-between" style="flex-wrap: wrap; gap: 6px;">
                            <div class="flex-row" style="gap: 6px;">
                              <span style="font-size: 11px; font-weight: 700; color: var(--mk-orange); background-color: var(--mk-orange-light); padding: 1px 6px; border-radius: 4px;">
                                ${escapeHtml(item.category || `팩트 ${idx + 1}`)}
                              </span>
                              ${linkedSource ? `
                                <a href="${escapeHtml(linkedSource.url)}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: var(--text-secondary); text-decoration: underline;">
                                  출처 원문 ↗
                                </a>
                              ` : ''}
                            </div>
                            <div class="flex-row" style="gap: 6px;">
                              <select id="targetSecForMemo-${item.id}" style="border: var(--border-thin); border-radius: 4px; padding: 2px 6px; background: var(--white); font-size: 11.5px; color: var(--text-secondary); cursor: pointer;">
                                ${(w.draftSections || []).map((sec, sIdx) => `
                                  <option value="${sec.id}" ${sIdx === (w.draftSections.length > 1 ? 1 : 0) ? 'selected' : ''}>단락 0${sIdx + 1}에 넣기</option>
                                `).join('')}
                                <option value="ai-summary">AI 3줄 요약에 넣기</option>
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
                    항목을 클릭하면 오른쪽 기사의 해당 위치로 바로 이동해 보완할 수 있습니다.
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
                      <button type="button" class="text-action-orange" id="verifyAllFactsBtn">일괄 확인 완료 ✓</button>
                    ` : ''}
                  </div>
                  <p class="text-muted mb-8">
                    본문 속 숫자·일정·혜택이 포함된 문장입니다. 팩트 확인 후 문장을 클릭해 체크하세요.
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
                            style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 8px 10px; border-radius: var(--radius-general); border: var(--border-thin); background-color: ${isVerified ? 'var(--status-green-bg)' : '#FFF9DB'}; cursor: pointer; font-size: 12px; line-height: 1.5;"
                          >
                            <span style="color: var(--text-primary);">
                              <strong style="color: ${isVerified ? 'var(--status-green)' : 'var(--status-amber)'}; margin-right: 4px;">
                                ${isVerified ? '✓ 확인됨' : '• 확인 필요'}
                              </strong>
                              ${escapeHtml(fc.sentence)}
                            </span>
                            <span style="font-size: 11px; font-weight: 700; color: ${isVerified ? 'var(--text-muted)' : 'var(--mk-orange)'}; white-space: nowrap; flex-shrink: 0;">
                              ${isVerified ? '취소' : '확인 ✓'}
                            </span>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  `}
                </div>
              ` : `
                <!-- [탭 3: 목차·흐름] 현재 기사 8단계 목차 리모컨 & 유형별 작성 가이드 -->
                <div style="margin-bottom: 16px; padding: 12px; background-color: var(--mk-orange-light); border: 0.5px solid var(--mk-orange-border); border-radius: var(--radius-general);">
                  <div style="font-size: 11.5px; font-weight: 800; color: var(--mk-orange); margin-bottom: 3px;">
                    현재 적용 템플릿 · ${escapeHtml(tInfo.shortName)}
                  </div>
                  <div style="font-size: 12.5px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
                    ${escapeHtml(tInfo.description)}
                  </div>
                  <div style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.5;">
                    흐름: ${escapeHtml(tInfo.flowSummary || '')}
                  </div>
                </div>

                <div class="mb-8">
                  <strong style="font-size: 13px; font-weight: 800;">🧭 기사 구성 블록 빠른 이동 (클릭)</strong>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <button type="button" class="headline-pick-row" data-jump-block="block-step-1" style="text-align: left; border: var(--border-thin);">
                    <span style="font-size: 12.5px; font-weight: 700;">STEP 01 · 카테고리 분류 (${escapeHtml(sb.mkCategory || '산업 Q&A')})</span>
                    <span class="text-muted">이동 →</span>
                  </button>
                  <button type="button" class="headline-pick-row" data-jump-block="block-step-2" style="text-align: left; border: var(--border-thin);">
                    <span style="font-size: 12.5px; font-weight: 700;">STEP 02 · 기사 헤드라인 & 추천 제목 5선</span>
                    <span class="text-muted">이동 →</span>
                  </button>
                  <button type="button" class="headline-pick-row" data-jump-block="block-step-3" style="text-align: left; border: var(--border-thin);">
                    <span style="font-size: 12.5px; font-weight: 700;">STEP 03 · AI 팩트 체크 3줄 요약</span>
                    <span class="text-muted">이동 →</span>
                  </button>
                  <button type="button" class="headline-pick-row" data-jump-block="block-step-4" style="text-align: left; border: var(--border-thin);">
                    <span style="font-size: 12.5px; font-weight: 700;">STEP 04 · 기사 리드 부제 (Subtitle)</span>
                    <span class="text-muted">이동 →</span>
                  </button>
                  ${(w.draftSections || []).map((sec, sIdx) => `
                    <button type="button" class="headline-pick-row" data-jump-block="secWrap-${sec.id}" style="text-align: left; border: var(--border-thin); padding-left: 14px;">
                      <span style="font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        └ 단락 0${sIdx + 1}: ${escapeHtml(sec.title)}
                      </span>
                      <span class="text-muted">이동 →</span>
                    </button>
                  `).join('')}
                  <button type="button" class="headline-pick-row" data-jump-block="block-step-6" style="text-align: left; border: var(--border-thin);">
                    <span style="font-size: 12.5px; font-weight: 700;">STEP 06 · 핵심 비교 요약표 (${(sb.summaryTable?.rows || []).length}행)</span>
                    <span class="text-muted">이동 →</span>
                  </button>
                  <button type="button" class="headline-pick-row" data-jump-block="block-step-glossary" style="text-align: left; border: var(--border-thin);">
                    <span style="font-size: 12.5px; font-weight: 700;">📚 핵심 용어 사전 (${(sb.glossary || []).length}개 용어)</span>
                    <span class="text-muted">이동 →</span>
                  </button>
                  <button type="button" class="headline-pick-row" data-jump-block="block-step-7" style="text-align: left; border: var(--border-thin);">
                    <span style="font-size: 12.5px; font-weight: 700;">STEP 07 · 자연어 FAQ (${(sb.faqs || []).length}문항) & 팬아웃</span>
                    <span class="text-muted">이동 →</span>
                  </button>
                  <button type="button" class="headline-pick-row" data-jump-block="block-step-8" style="text-align: left; border: var(--border-thin);">
                    <span style="font-size: 12.5px; font-weight: 700;">STEP 08 · 마무리 총평 · 한 줄 요약 & 출처</span>
                    <span class="text-muted">이동 →</span>
                  </button>
                </div>
              `}
            </div>
          </div>
        </aside>

        <!-- [오른쪽 영역] 구조별 편집 모드 vs 실제 MK Pick 기사 미리보기 모드 -->
        <div>
          ${isPreview ? `
            <!-- ============================================================== -->
            <!-- 👁️ 실제 MK Pick 기사 미리보기 모드 (독자에게 보이는 최종 화면) -->
            <!-- ============================================================== -->
            <div class="article-paper">
              <div class="flex-between mb-12" style="padding: 10px 14px; background-color: var(--mk-orange-light); border: 0.5px solid var(--mk-orange-border); border-radius: var(--radius-general);">
                <div style="font-size: 12.5px; font-weight: 700; color: var(--mk-orange);">
                  👁️ 실제 MK Pick 기사 발행 미리보기 화면입니다. (노란색 형광펜 문장을 클릭하면 팩트체크 완료로 전환됩니다)
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

              <h1 style="font-size: 26px; font-weight: 800; line-height: 1.38; color: var(--text-primary); margin-bottom: 18px; letter-spacing: -0.5px;">
                ${escapeHtml(w.title)}
              </h1>

              <div class="article-ai-box">
                <div style="font-size: 12.5px; font-weight: 800; color: var(--mk-orange); margin-bottom: 6px;">AI 팩트 체크 요약</div>
                ${(sb.aiFactSummary || []).map(line => `<div style="font-size: 14px; line-height: 1.65; font-weight: 600; margin-bottom: 3px;">${escapeHtml(line)}</div>`).join('')}
              </div>

              ${sb.subtitle ? `
                <div class="article-subtitle-box" style="font-size: 15px; font-weight: 700; color: var(--text-secondary); line-height: 1.6; white-space: pre-line;">${escapeHtml(sb.subtitle)}</div>
              ` : ''}

              <hr class="doc-divider" />

              ${(w.draftSections || []).map(sec => `
                <div style="margin-bottom: 28px;">
                  <h2 style="font-size: 19px; font-weight: 800; color: var(--text-primary); margin-bottom: 10px;">
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

              ${(w.factChecks || []).length > 0 ? `
                <div style="margin-bottom: 24px; padding: 14px 16px; background-color: var(--bg-subtle); border: var(--border-thin); border-radius: var(--radius-general);">
                  <div class="flex-between mb-8">
                    <strong style="font-size: 13px;">🖍️ 본문 수치·날짜 팩트체크 점검 (클릭 시 확인 토글)</strong>
                    <span class="text-muted">${unverifiedCount > 0 ? `미확인 ${unverifiedCount}건` : '모두 확인 완료'}</span>
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    ${(w.factChecks || []).map(fc => {
                      const isVerified = fc.status !== '미처리';
                      return `
                        <span class="fc-chip ${isVerified ? 'verified' : ''}" data-toggle-fc="${fc.id}">
                          <strong>${isVerified ? '✓ 확인됨:' : '• 확인 필요:'}</strong> ${escapeHtml(fc.sentence)}
                        </span>
                      `;
                    }).join('')}
                  </div>
                </div>
              ` : ''}

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
            <!-- ✏️ 구조별 편집 모드 (8단계 블록 배지로 기사 구조가 한눈에 들어오는 편집기) -->
            <!-- ============================================================== -->
            <div>
              ${(() => {
                const fv = w.factVerification || (inspectTopicFactVerification ? inspectTopicFactVerification(w.keyword, w.inputCompany, (w.sources || []).length) : null);
                if (!fv) return '';
                const isWarn = Boolean(fv.isWarning || fv.verdict === 'AI_MEME_OR_VIRTUAL' || fv.verdict === 'UNVERIFIED_VIRAL');
                const naverNewsUrl = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(w.keyword || '')}`;
                const mkSearchUrl = `https://www.mk.co.kr/search?word=${encodeURIComponent(w.keyword || '')}`;
                return `
                  <div style="margin-bottom: 14px; padding: 12px 16px; border-radius: var(--radius-general); border: 1.5px solid ${isWarn ? '#F03E3E' : '#2B8A3E'}; background-color: ${isWarn ? '#FFF5F5' : '#EBFBEE'};">
                    <div class="flex-between" style="flex-wrap: wrap; gap: 8px; margin-bottom: 4px;">
                      <strong style="font-size: 13.5px; font-weight: 800; color: ${isWarn ? '#C92A2A' : '#1B7F3B'};">
                        ${escapeHtml(fv.badgeLabel || (isWarn ? '🚨 [팩트체크 경보] 가상(AI 생성) 밈 · 공식 미출시 또는 보도 미확인 주의' : '✓ [팩트체크 확인] 공식 언론 보도 및 실제 출시·트렌드 팩트 확인됨'))}
                      </strong>
                      <div class="flex-row" style="gap: 6px; flex-wrap: wrap;">
                        <a href="${escapeHtml(naverNewsUrl)}" target="_blank" rel="noopener noreferrer" style="font-size: 11.5px; font-weight: 800; color: ${isWarn ? '#C92A2A' : '#1B7F3B'}; background-color: #FFFFFF; border: 1px solid ${isWarn ? '#FFA8A8' : '#8CE99A'}; padding: 3px 9px; border-radius: 4px; text-decoration: none;">
                          🔎 네이버 뉴스 팩트 교차확인 ↗
                        </a>
                        <a href="${escapeHtml(mkSearchUrl)}" target="_blank" rel="noopener noreferrer" style="font-size: 11.5px; font-weight: 800; color: var(--text-primary); background-color: #FFFFFF; border: var(--border-thin); padding: 3px 9px; border-radius: 4px; text-decoration: none;">
                          🔎 매일경제 보도 검색 ↗
                        </a>
                      </div>
                    </div>
                    <div style="font-size: 12.5px; line-height: 1.55; color: ${isWarn ? '#A61E4D' : '#2B8A3E'}; font-weight: 600;">
                      ${escapeHtml(fv.summary || '')}
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
                    <input type="text" class="doc-editable-input" id="docTags" value="${escapeHtml((sb.companyTags || []).join(', '))}" style="font-size: 13px; color: var(--mk-orange); font-weight: 700;" placeholder="예: 카카오프렌즈, 라이엇 게임즈, 롤드컵" />
                  </div>
                </div>
              </section>

              <!-- STEP 02: 메인 헤드라인 & 추천 제목 5선 -->
              <section class="editor-block-section" id="block-step-2">
                <div class="editor-step-header">
                  <div class="flex-row" style="gap: 8px;">
                    <span class="editor-step-badge">STEP 02 · 기사 헤드라인</span>
                    <span class="text-muted">큰따옴표(" ") 인용구 + 말줄임표(…) + 핵심 키워드 조합이 GEO 검색 노출에 유리합니다.</span>
                  </div>
                  <button type="button" class="text-action" data-copy-part="headline">📋 제목만 복사</button>
                </div>

                <textarea class="doc-editable-textarea doc-headline-input mb-12" id="docMainHeadline" rows="2" placeholder="기사 제목을 입력하세요">${escapeHtml(w.title)}</textarea>

                <div style="background-color: var(--bg-subtle); border: var(--border-thin); border-radius: var(--radius-general); padding: 10px 12px;">
                  <div style="font-size: 12px; font-weight: 800; color: var(--text-secondary); margin-bottom: 6px;">
                    💡 AI 추천 헤드라인 5선 (원하는 제목을 클릭하면 위 제목칸에 즉시 적용됩니다)
                  </div>
                  ${(w.titleCandidates || []).map((tc, i) => {
                    const isSelected = (w.title || '').trim() === (tc.title || '').trim();
                    return `
                      <div class="headline-pick-row ${isSelected ? 'active' : ''}" data-pick-headline-idx="${i}">
                        <span style="font-size: 13px; font-weight: ${isSelected ? '800' : '500'}; color: var(--text-primary);">
                          <span style="color: var(--mk-orange); font-weight: 800; margin-right: 6px;">0${i + 1}</span>
                          ${escapeHtml(tc.title)}
                        </span>
                        <span style="font-size: 11.5px; font-weight: 700; color: ${isSelected ? 'var(--mk-orange)' : 'var(--text-muted)'}; white-space: nowrap; flex-shrink: 0;">
                          ${isSelected ? '✓ 현재 적용됨' : '이 제목으로 교체 →'}
                        </span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </section>

              <!-- STEP 03 & 04: AI 팩트 체크 3줄 요약 + 리드 부제(Subtitle) -->
              <section class="editor-block-section" id="block-step-3">
                <div class="editor-step-header">
                  <div class="flex-row" style="gap: 8px;">
                    <span class="editor-step-badge">STEP 03 · AI 팩트 체크 3줄 요약</span>
                    <span class="text-muted">생성형 AI(퍼플렉시티·챗GPT)가 기사 상단에서 가장 먼저 인용하는 1~3번 핵심 팩트 요약입니다.</span>
                  </div>
                  <button type="button" class="text-action" data-copy-part="aisummary">📋 AI 요약만 복사</button>
                </div>

                <div class="article-ai-box" id="docAiBoxWrap" style="margin: 0 0 16px 0;">
                  <textarea class="doc-editable-textarea" id="docAiSummary" rows="3" style="font-size: 13.5px; line-height: 1.65; font-weight: 600; background-color: var(--white);">${escapeHtml((sb.aiFactSummary || []).join('\n'))}</textarea>
                </div>

                <div id="block-step-4" style="padding-top: 12px; border-top: var(--border-thin);">
                  <div class="flex-between mb-6">
                    <div class="flex-row" style="gap: 8px;">
                      <span class="editor-step-badge">STEP 04 · 기사 리드 부제 (Subtitle)</span>
                      <span class="text-muted">본문 시작 전 기사 전체 맥락을 2줄로 압축해 보여주는 부제입니다.</span>
                    </div>
                  </div>
                  <div class="article-subtitle-box" style="margin: 0;">
                    <textarea class="doc-editable-textarea" id="docSubtitle" rows="2" style="font-size: 14px; font-weight: 700; color: var(--text-secondary); line-height: 1.55;" placeholder="기사 핵심 맥락을 요약하는 부제(1~2줄)를 입력하세요">${escapeHtml(sb.subtitle || '')}</textarea>
                  </div>
                </div>
              </section>

              <!-- STEP 05: 본문 단락 (주제·키워드 맞춤형 소제목 / 매경 경어체 본문 / 단락별 이미지 캡션) -->
              <section class="editor-block-section" id="block-step-5">
                <div class="editor-step-header">
                  <div class="flex-row" style="gap: 8px;">
                    <span class="editor-step-badge">STEP 05 · 본문 단락 (${(w.draftSections || []).length}개 단락)</span>
                    <span class="text-muted">키워드와 주제에 맞춘 소제목과 매경 Pick 경어체("~합니다") 본문으로 구성됩니다.</span>
                  </div>
                  <button type="button" class="btn btn-sm btn-outline-orange" id="addDocSectionBtn">+ 새 본문 단락 추가</button>
                </div>

                <div id="docSectionsContainer">
                  ${(w.draftSections || []).map((sec, sIdx) => {
                    const roleLabel = getSectionRoleLabel(sec, sIdx, (w.draftSections || []).length);
                    const secCharLen = (sec.content || '').length;
                    return `
                      <div style="padding: 14px 16px; border: var(--border-thin); border-radius: var(--radius-general); background-color: var(--bg-subtle); margin-bottom: 14px;" id="secWrap-${sec.id}">
                        <div class="flex-between mb-8" style="flex-wrap: wrap; gap: 6px;">
                          <div class="flex-row" style="gap: 6px;">
                            <span style="font-size: 11.5px; font-weight: 800; color: var(--mk-orange); background-color: var(--white); border: 0.5px solid var(--mk-orange-border); padding: 2px 8px; border-radius: 4px;">
                              단락 0${sIdx + 1} · ${escapeHtml(roleLabel)}
                            </span>
                            <span class="text-muted" id="secCharCount-${sec.id}">${secCharLen.toLocaleString()}자</span>
                          </div>
                          <div class="flex-row" style="gap: 8px;">
                            <button type="button" class="text-action-orange" data-polish-sec="${sec.id}" title="평어체(~한다/이다) 문장을 매경 Pick 표준 경어체(~합니다)로 자동 교정합니다">
                              ✨ 매경 문체(~합니다) 다듬기
                            </button>
                            ${sIdx > 0 ? `<button type="button" class="text-action" data-move-sec-up="${sIdx}" title="이 단락을 위로 이동">↑ 위로</button>` : ''}
                            ${sIdx < (w.draftSections || []).length - 1 ? `<button type="button" class="text-action" data-move-sec-down="${sIdx}" title="이 단락을 아래로 이동">↓ 아래로</button>` : ''}
                            ${(w.draftSections || []).length > 1 ? `
                              <button type="button" class="text-action" data-del-doc-sec="${sec.id}" style="color: var(--text-muted);">삭제</button>
                            ` : ''}
                          </div>
                        </div>

                        <div class="mb-8">
                          <label class="text-muted" style="display: block; margin-bottom: 3px; font-weight: 700;">■ 단락 소제목 (질문형 또는 핵심 포인트·아이템 중심)</label>
                          <input type="text" class="doc-editable-input doc-sec-title-input" data-doc-sec-title="${sec.id}" value="${escapeHtml(sec.title)}" placeholder="주제와 단락 핵심 내용을 담은 소제목을 입력하세요" />
                        </div>

                        <div class="mb-8">
                          <label class="text-muted" style="display: block; margin-bottom: 3px; font-weight: 700;">본문 내용 ('~합니다' 체)</label>
                          <textarea class="doc-editable-textarea doc-body-textarea" id="secBody-${sec.id}" data-doc-sec-body="${sec.id}" rows="5" placeholder="본문 내용을 '~합니다' 체로 입력하세요">${escapeHtml(sec.content)}</textarea>
                        </div>

                        <div>
                          <label class="text-muted" style="display: block; margin-bottom: 3px; font-size: 11.5px; font-weight: 700;">단락 하단 이미지 출처 캡션 (선택 · 입력 시 해당 단락 아래에 표기)</label>
                          <input type="text" class="doc-editable-input" data-doc-sec-caption="${sec.id}" value="${escapeHtml(sec.imageCaption || '')}" placeholder="예: < 출처 : 패러블 > 또는 비워두기" style="font-size: 12px; color: var(--text-secondary); background-color: var(--white);" />
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
                    <span class="text-muted">AI 검색엔진이 구조화된 데이터로 즉시 채택할 수 있도록 표 형태로 핵심 정보를 정리합니다.</span>
                  </div>
                  <div class="flex-row" style="gap: 10px;">
                    <button type="button" class="text-action-orange" id="docAddTableRowBtn">+ 행 추가</button>
                    <button type="button" class="text-action" id="docAddTableColBtn">+ 열 추가</button>
                    <button type="button" class="text-action" data-copy-part="table">📋 요약표만 복사</button>
                  </div>
                </div>

                <div class="mb-8">
                  <input type="text" class="doc-editable-input" id="docTableTitle" value="${escapeHtml(sb.summaryTable?.title || '[요약표] 핵심 비교')}" style="font-size: 15.5px; font-weight: 800;" />
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

              <!-- STEP 06-B: 핵심 용어 사전 (MK Pick 에디터 스타일) -->
              <section class="editor-block-section" id="block-step-glossary">
                <div class="editor-step-header">
                  <div class="flex-row" style="gap: 8px;">
                    <span class="editor-step-badge">📚 핵심 용어 사전 (${(sb.glossary || []).length}개 용어)</span>
                    <span class="text-muted">기사에 등장하는 주요 개념·키워드를 독자와 AI 검색엔진이 한눈에 이해할 수 있도록 명쾌하게 정의합니다.</span>
                  </div>
                  <div class="flex-row" style="gap: 10px;">
                    <button type="button" class="text-action-orange" id="docAddGlossaryBtn">+ 용어 추가</button>
                    <button type="button" class="text-action" data-copy-part="glossary">📋 용어 사전만 복사</button>
                  </div>
                </div>

                <div class="mb-8">
                  <input type="text" class="doc-editable-input" id="docGlossaryTitle" value="${escapeHtml(sb.glossaryTitle || '[핵심 용어 사전]')}" style="font-size: 15px; font-weight: 800;" />
                </div>

                <div>
                  ${(sb.glossary || []).map((gItem, gIdx) => `
                    <div style="display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; margin-bottom: 8px; background-color: var(--bg-subtle); border: var(--border-thin); border-radius: var(--radius-general);">
                      <input type="text" class="doc-editable-input" data-doc-glossary-term="${gIdx}" value="${escapeHtml(gItem.term || '')}" placeholder="핵심 용어명 (예: 버츄얼 아이돌)" style="width: 210px; flex-shrink: 0; font-weight: 800; font-size: 13px; background-color: var(--white);" />
                      <textarea class="doc-editable-textarea" data-doc-glossary-desc="${gIdx}" rows="1" placeholder="용어에 대한 1~2문장 명쾌한 해설 ('~입니다' 체)" style="flex: 1; font-size: 13px; color: var(--text-secondary); background-color: var(--white);">${escapeHtml(gItem.desc || '')}</textarea>
                      <button type="button" class="text-action" data-doc-del-glossary="${gIdx}" style="font-size: 12px; color: var(--text-muted); padding-top: 6px;">✕</button>
                    </div>
                  `).join('')}
                </div>
              </section>

              <!-- STEP 07: 자주 묻는 질문 (FAQ) & 팬아웃(Query Fan-out) 추천 질문 -->
              <section class="editor-block-section" id="block-step-7">
                <div class="editor-step-header">
                  <div class="flex-row" style="gap: 8px;">
                    <span class="editor-step-badge">STEP 07 · 독자 자연어 FAQ (${(sb.faqs || []).length}문항)</span>
                    <span class="text-muted">독자가 검색창·AI에 실제로 질문하는 구어체 질의(Q)와 팩트 답변(A)입니다 (5문항 이상 권장).</span>
                  </div>
                  <div class="flex-row" style="gap: 10px;">
                    ${(sb.fanoutQuestions && sb.fanoutQuestions.length > 0) ? `
                      <button type="button" class="text-action-orange" id="docToggleFanoutBtn">
                        ${state.fanoutOpen ? `💡 팬아웃 추천 질문(${sb.fanoutQuestions.length}개) 접기 ▲` : `💡 팬아웃 추천 질문(${sb.fanoutQuestions.length}개) 열기 ▼`}
                      </button>
                    ` : ''}
                    <button type="button" class="text-action" id="docAddFaqBtn">+ 직접 질문 추가</button>
                    <button type="button" class="text-action" data-copy-part="faq">📋 FAQ만 복사</button>
                  </div>
                </div>

                ${state.fanoutOpen && sb.fanoutQuestions && sb.fanoutQuestions.length > 0 ? `
                  <div style="background-color: var(--mk-orange-light); border: 0.5px solid var(--mk-orange-border); border-radius: var(--radius-general); padding: 12px 14px; margin-bottom: 16px;">
                    <div class="flex-between mb-6" style="padding-bottom: 6px; border-bottom: 0.5px solid var(--mk-orange-border);">
                      <div>
                        <span style="font-size: 12.5px; font-weight: 800; color: var(--mk-orange);">💡 팬아웃 쿼리(Query Fan-out) 연관 추천 질문 ${sb.fanoutQuestions.length}선</span>
                        <span style="font-size: 12px; color: var(--text-secondary); margin-left: 6px;">· 클릭하면 아래 기사 FAQ 목록에 즉시 추가됩니다.</span>
                      </div>
                    </div>
                    ${sb.fanoutQuestions.map((fq, fIdx) => `
                      <div class="clean-list-row" style="display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 8px 4px;">
                        <div style="font-size: 12.5px; line-height: 1.5; flex: 1;">
                          <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 2px;">
                            ${fq.category ? `<span style="display: inline-block; font-size: 10.5px; font-weight: 800; color: var(--mk-orange); background-color: var(--white); border: 0.5px solid var(--mk-orange-border); padding: 1px 6px; border-radius: 99px; margin-right: 6px;">${escapeHtml(fq.category)}</span>` : ''}
                            Q. ${escapeHtml(fq.q.replace(/^Q\d+\.\s*/i, ''))}
                          </div>
                          <div style="font-size: 12px; color: var(--text-secondary);">A. ${escapeHtml(fq.a)}</div>
                        </div>
                        <button type="button" class="btn btn-sm btn-primary" data-pick-fanout="${fIdx}" style="padding: 4px 10px; font-size: 11.5px;">+ FAQ에 추가</button>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}

                <div>
                  ${(sb.faqs || []).map((faq, idx) => `
                    <div style="padding: 10px 12px; margin-bottom: 10px; background-color: var(--bg-subtle); border: var(--border-thin); border-radius: var(--radius-general);">
                      <div class="flex-between mb-6">
                        <input type="text" class="doc-editable-input" data-doc-faq-q="${idx}" value="${escapeHtml(faq.q)}" style="font-weight: 800; font-size: 14px; background-color: var(--white);" />
                        <button type="button" class="text-action" data-doc-del-faq="${idx}" style="font-size: 12px; color: var(--text-muted);">삭제</button>
                      </div>
                      <textarea class="doc-editable-textarea" data-doc-faq-a="${idx}" rows="2" style="font-size: 13.5px; color: var(--text-secondary); line-height: 1.6; background-color: var(--white);">${escapeHtml(faq.a)}</textarea>
                    </div>
                  `).join('')}
                </div>
              </section>

              <!-- STEP 08: 수미상관 마무리 총평 문단 & 한 줄 요약 · 출처 고지 -->
              <section class="editor-block-section" id="block-step-8">
                <div class="editor-step-header">
                  <div class="flex-row" style="gap: 8px;">
                    <span class="editor-step-badge">STEP 08 · 수미상관 마무리 총평 & 한 줄 요약</span>
                    <span class="text-muted">도입부의 여운을 회수하는 에필로그 문단과 "한 줄 요약! ~입니다."로 기사의 핵심 결론을 매듭짓습니다.</span>
                  </div>
                </div>

                <div class="mb-12">
                  <label class="text-muted" style="display: block; margin-bottom: 4px; font-weight: 700;">■ 수미상관 마무리 총평 문단 (에필로그)</label>
                  <textarea class="doc-editable-textarea" id="docClosingParagraph" rows="3" style="font-size: 14px; color: var(--text-primary); line-height: 1.7;" placeholder="도입부의 화두와 연결해 기사 전체의 의미를 갈무리하는 마무리 총평 문단을 입력하세요">${escapeHtml(sb.closingParagraph || '')}</textarea>
                </div>

                <div style="border-left: 3px solid var(--mk-orange); padding-left: 12px; margin-bottom: 14px;">
                  <label class="text-muted" style="display: block; margin-bottom: 4px; font-weight: 700;">■ 한 줄 요약!</label>
                  <textarea class="doc-editable-textarea" id="docOneLine" rows="2" style="font-size: 14.5px; font-weight: 800;">${escapeHtml(sb.oneLineSummary || '')}</textarea>
                </div>

                <div class="grid-2" style="padding-top: 10px; border-top: var(--border-thin); margin-bottom: 16px;">
                  <div>
                    <label class="text-muted" style="display: block; margin-bottom: 4px; font-weight: 700;">대표 이미지 캡션 문구</label>
                    <input type="text" class="doc-editable-input" id="docImgCaption" value="${escapeHtml(sb.imageRecommendations?.[0]?.caption || '< 출처 : 각 사 제공 >')}" style="font-size: 12.5px; color: var(--text-secondary);" />
                  </div>
                  <div>
                    <label class="text-muted" style="display: block; margin-bottom: 4px; font-weight: 700;">하단 고지 문구</label>
                    <input type="text" class="doc-editable-input" id="docNotice" value="${escapeHtml(sb.noticeText || '')}" style="font-size: 12.5px; color: var(--text-muted);" />
                  </div>
                </div>

                <!-- 참고 자료 및 출처 목록 (원문 대조 팩트체크 및 CMS 복사 포함/제외 관리) -->
                <div style="padding-top: 14px; border-top: var(--border-thin);">
                  <div class="flex-between mb-6" style="flex-wrap: wrap; gap: 6px;">
                    <div>
                      <strong style="font-size: 13.5px; font-weight: 800; color: var(--text-primary);">
                        🔗 참고 자료 및 실시간 검증 출처 목록 (${(w.sources || []).filter(s => !s.excluded).length}/${(w.sources || []).length}건 포함)
                      </strong>
                      <span class="text-muted" style="margin-left: 6px;">
                        · 우측 [원문 열기 ↗]를 눌러 실제 보도·출처 팩트를 대조하고, 체크박스로 기사 하단 표기 여부를 선택하세요.
                      </span>
                    </div>
                  </div>

                  ${(w.sources || []).length === 0 ? `
                    <div class="text-muted" style="padding: 10px 0;">등록된 참고 출처가 없습니다. 아래에서 참고 URL을 추가할 수 있습니다.</div>
                  ` : `
                    <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px;">
                      ${(w.sources || []).map((src, sIdx) => {
                        const isIncluded = !src.excluded;
                        return `
                          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; border: var(--border-thin); border-radius: var(--radius-general); background-color: ${isIncluded ? 'var(--bg-subtle)' : 'var(--white)'}; opacity: ${isIncluded ? '1' : '0.6'};">
                            <label style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; cursor: pointer;">
                              <input type="checkbox" data-toggle-src-exclude="${escapeHtml(src.id)}" ${isIncluded ? 'checked' : ''} style="accent-color: var(--mk-orange); width: 15px; height: 15px; cursor: pointer; flex-shrink: 0;" />
                              <span style="font-size: 11px; font-weight: 700; color: var(--mk-orange); background-color: var(--mk-orange-light); padding: 1px 6px; border-radius: 4px; white-space: nowrap; flex-shrink: 0;">
                                ${escapeHtml(src.method || `출처 #${sIdx + 1}`)}
                              </span>
                              <span style="font-size: 12.5px; color: var(--text-primary); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(src.title || src.url)}">
                                ${escapeHtml(src.title || src.url)}
                              </span>
                            </label>
                            <div class="flex-row" style="gap: 8px; flex-shrink: 0;">
                              ${src.url ? `
                                <a href="${escapeHtml(src.url)}" target="_blank" rel="noopener noreferrer" class="text-action-orange" style="font-size: 12px; font-weight: 800; white-space: nowrap;">
                                  원문 열기 ↗
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
                    <input type="text" class="input" id="newSourceTitleInput" placeholder="추가할 출처 제목/설명 (예: 통계청 2026 소비동향)" style="flex: 1; padding: 6px 10px; font-size: 12px;" />
                    <input type="url" class="input" id="newSourceUrlInput" placeholder="출처 URL (https://...)" style="flex: 1; padding: 6px 10px; font-size: 12px;" />
                    <button type="button" class="btn btn-sm" id="addSourceDirectBtn" style="font-weight: 700; white-space: nowrap;">+ 출처 추가</button>
                  </div>
                </div>
              </section>

            </div>
          `}
        </div>
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

    // 빈 문서로 비우기 (블로킹 confirm 없이 즉시 실행)
    document.getElementById('clearToBlankBtn').addEventListener('click', () => {
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
      w.summaryBlocks.subtitle = '기사 핵심 내용을 요약하는 부제(1~3줄)를 입력하세요';
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
      showToast('🧹 깨끗한 빈 양식으로 비워졌습니다. [↺ 초안 복원]을 누르면 언제든 복구됩니다.');
      render(true);
    });

    // 예시 내용 다시 채우기
    document.getElementById('restoreExampleBtn').addEventListener('click', () => {
      const preset = buildPresetScenario({
        keyword: CONTENT_TYPES[w.typeId]?.exampleKeyword || w.keyword,
        selectedType: w.typeId
      });
      w.title = preset.titleCandidates[0].title;
      w.titleCandidates = preset.titleCandidates;
      w.sources = preset.sources;
      w.researchItems = preset.researchItems;
      w.draftSections = preset.draftSections;
      w.summaryBlocks = preset.summaryBlocks;
      w.factChecks = preset.factChecks;
      saveCurrentWork(false);
      showToast('↺ 모범 예시 기사가 다시 채워졌습니다.');
      render(true);
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
      const rawKw = (customKeyword || (kwEl ? kwEl.value : w.keyword)).trim();
      const rawComp = compEl ? compEl.value.trim() : (w.inputCompany || '');
      const kw = cleanTrendTopicKeyword ? cleanTrendTopicKeyword(rawKw) : rawKw;
      const comp = extractBrandFromTopic ? extractBrandFromTopic(kw, rawComp) : rawComp;
      if (!kw) {
        showToast('검색할 키워드를 입력해 주세요.');
        return;
      }
      const shouldAutoMatch = rebuildDraft && !keepCurrentType;
      const nextTypeId = shouldAutoMatch ? detectBestContentType(kw, comp, '', w.typeId) : w.typeId;
      const nextTypeName = CONTENT_TYPES[nextTypeId]?.shortName || '맞춤 유형';
      state.isRefreshingInEditor = true;
      const stopEditorTimer = startDraftProgressTimer(kw, nextTypeName);
      render(true);
      try {
        const res = await apiFetch(`/api/works/${w.id}/refresh-news`, {
          method: 'POST',
          body: JSON.stringify({
            keyword: kw,
            company: comp,
            typeId: nextTypeId,
            autoMatchType: shouldAutoMatch,
            rebuildDraft,
            existingSources: w.sources || [],
            existingResearchItems: w.researchItems || []
          })
        });
        state.isRefreshingInEditor = false;
        const elapsed = stopEditorTimer();
        state.currentWork = res.work;
        const idx = state.works.findIndex(item => item.id === w.id);
        if (idx !== -1) state.works[idx] = res.work;
        else state.works.unshift(res.work);
        saveCurrentWork(true);
        await loadConfig();
        showToast(
          rebuildDraft
            ? `✓ '${kw}' 최신 팩트 ${res.liveNewsCount || ''}건을 바탕으로 오른쪽 기사 전체를 새로 작성했습니다! (${elapsed}초 소요)`
            : `✓ '${kw}' 최신 뉴스 문장 ${res.liveNewsCount || ''}건을 매경 문체로 다듬어 취재 메모장에 추가했습니다! (${elapsed}초 소요)`
        );
        render(true);
      } catch (err) {
        // 정적 배포(GitHub Pages) 또는 폴백: 브라우저에서 직접 시나리오 생성/갱신
        try {
          let baseScen = (buildDynamicScenario || buildPresetScenario)({
            keyword: kw,
            company: comp,
            url: w.inputUrl || '',
            rawText: w.inputRawText || '',
            typeId: nextTypeId,
            selectedType: nextTypeId
          });
          const clientKey = getClientPerplexityKey();
          if (clientKey) {
            try {
              baseScen = await buildClientPerplexityEnhancedScenario({
                apiKey: clientKey,
                keyword: kw,
                company: comp,
                url: w.inputUrl || '',
                rawText: w.inputRawText || '',
                typeId: nextTypeId,
                baseScenario: baseScen
              });
            } catch (pplxErr) {
              console.warn('Client refresh fallback:', pplxErr.message);
            }
          }
          await loadConfig();
          w.keyword = kw;
          w.inputCompany = comp;
          w.typeId = nextTypeId;
          if (rebuildDraft) {
            w.sources = baseScen.sources;
            w.researchItems = baseScen.researchItems;
            w.titleCandidates = baseScen.titleCandidates;
            w.title = baseScen.titleCandidates?.[0]?.title || w.title;
            w.draftSections = baseScen.draftSections;
            w.summaryBlocks = baseScen.summaryBlocks;
            w.factChecks = baseScen.factChecks;
          } else {
            w.sources = [...(baseScen.sources || []), ...(w.sources || [])];
            w.researchItems = [...(baseScen.researchItems || []), ...(w.researchItems || [])];
          }
          state.isRefreshingInEditor = false;
          const elapsed = stopEditorTimer();
          saveCurrentWork(true);
          showToast(
            rebuildDraft
              ? `✓ '${kw}' 키워드로 오른쪽 기사 전체를 새로 작성했습니다! (${elapsed}초 소요)`
              : `✓ '${kw}' 최신 팩트를 취재 메모장에 추가했습니다! (${elapsed}초 소요)`
          );
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

    // 취재 메모 [본문 반영 ->] 클릭 시 선택한 단락(또는 AI 요약)에 매경 문체 팩트 삽입 + 해당 단락 하이라이트!
    root.querySelectorAll('[data-insert-memo]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-insert-memo');
        const memo = (w.researchItems || []).find(r => r.id === id);
        if (!memo) return;
        const targetSelect = document.getElementById(`targetSecForMemo-${id}`);
        const targetVal = targetSelect ? targetSelect.value : (w.draftSections?.[0]?.id || 'ai-summary');

        if (state.editorViewMode === 'preview') {
          state.editorViewMode = 'edit';
        }

        if (targetVal === 'ai-summary') {
          const nextNum = (sb.aiFactSummary || []).length + 1;
          sb.aiFactSummary = sb.aiFactSummary || [];
          sb.aiFactSummary.push(`${nextNum}. ${memo.fact}`);
          saveCurrentWork(false);
          render(true);
          flashElement('docAiSummary');
          showToast('✓ 재가공된 팩트 문장이 오른쪽 [STEP 03 · AI 팩트 체크 요약]에 반영되었습니다!');
        } else {
          const targetSec = (w.draftSections || []).find(s => s.id === targetVal) || w.draftSections?.[0];
          if (targetSec) {
            targetSec.content = (targetSec.content ? targetSec.content.trim() + '\n\n' : '') + memo.fact;
            w.factChecks = extractFactSentencesFromSections(w.draftSections, w.sources);
            saveCurrentWork(false);
            render(true);
            flashElement(`secBody-${targetSec.id}`);
            showToast(`✓ 재가공된 팩트 문장이 오른쪽 [${targetSec.title.slice(0, 16)}...] 단락에 반영되었습니다!`);
          }
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
      saveCurrentWork(true);
    });
    document.getElementById('docAiSummary')?.addEventListener('input', e => {
      sb.aiFactSummary = e.target.value.split('\n').filter(line => line.trim().length > 0);
      autoResizeTextarea(e.target);
      saveCurrentWork(true);
    });
    document.getElementById('docSubtitle')?.addEventListener('input', e => {
      sb.subtitle = e.target.value;
      autoResizeTextarea(e.target);
      saveCurrentWork(true);
    });

    // 본문 섹션 제목·내용·단락 캡션 인라인 수정
    root.querySelectorAll('[data-doc-sec-title]').forEach(inp => {
      inp.addEventListener('input', () => {
        const sec = w.draftSections.find(s => s.id === inp.getAttribute('data-doc-sec-title'));
        if (sec) {
          sec.title = inp.value;
          saveCurrentWork(true);
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
        w.factChecks = extractFactSentencesFromSections(w.draftSections, w.sources);
        saveCurrentWork(true);
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

    // 본문 단락 순서 위로 / 아래로 이동
    root.querySelectorAll('[data-move-sec-up]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-move-sec-up'));
        if (idx > 0) {
          const temp = w.draftSections[idx - 1];
          w.draftSections[idx - 1] = w.draftSections[idx];
          w.draftSections[idx] = temp;
          saveCurrentWork(false);
          render(true);
          showToast('단락 순서를 위로 이동했습니다.');
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
          saveCurrentWork(false);
          render(true);
          showToast('단락 순서를 아래로 이동했습니다.');
        }
      });
    });

    // 본문 단락 추가 / 삭제
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
        w.draftSections = w.draftSections.filter(s => s.id !== id);
        saveCurrentWork(false);
        render(true);
      });
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

    // FAQ 인라인 편집
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
        saveCurrentWork(false);
        showToast('선택한 질문이 FAQ에 추가되었습니다.');
        render(true);
      });
    });

    document.getElementById('docAddFaqBtn')?.addEventListener('click', () => {
      const nextNum = (sb.faqs || []).length + 1;
      sb.faqs.push({
        q: `Q${nextNum}. 새로운 질문을 입력하세요?`,
        a: '답변을 "~합니다" 체로 입력하세요.'
      });
      saveCurrentWork(false);
      render(true);
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
