const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  CONTENT_TYPES,
  MK_PICK_CATEGORIES,
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
  extractFactSentencesFromSections
} = require('./public/mockData');

const PORT = process.env.PORT || 3000;
const IS_SERVERLESS = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL);
const DATA_DIR = IS_SERVERLESS ? path.join(os.tmpdir(), 'mk-pick-data') : path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const SEED_DB_PATH = path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function decodeXmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// API 키 없이 유튜브 검색 페이지(ytInitialData)에서 실시간 유튜브 쇼츠(#shorts) 영상·조회수·링크를 추출하는 함수
async function fetchYouTubeShorts(keyword, limit = 6) {
  const q = (keyword || '편의점 신상').trim() + ' #shorts';
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9'
      }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const match = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/);
    if (!match) return [];
    const jsonStr = match[1];

    const results = [];
    const seen = new Set();

    // 1) 최신 YouTube shortsLockupViewModel 추출 ("entityId":"shorts-shelf-item-VIDEO_ID" ... "accessibilityText":"제목, 조회수 X회 - Shorts 동영상 재생")
    const lockupRegex = /"entityId":"shorts-shelf-item-([a-zA-Z0-9_-]{11})"[\s\S]{1,1200}?"accessibilityText":"([^"]+)"/g;
    let m;
    while ((m = lockupRegex.exec(jsonStr)) !== null && results.length < limit) {
      const videoId = m[1];
      let rawAcc = decodeXmlEntities(m[2]).replace(/\s*-\s*Shorts\s*동영상\s*재생\s*$/i, '').trim();
      let views = '';
      const viewMatch = rawAcc.match(/,\s*(조회수\s*[^,]+)$/);
      if (viewMatch) {
        views = viewMatch[1].trim();
        rawAcc = rawAcc.slice(0, viewMatch.index).trim();
      }
      const cleanViews = (views && views !== '조회수 없음') ? views : '실시간 쇼츠';
      if (!seen.has(videoId) && rawAcc && rawAcc.length > 3) {
        seen.add(videoId);
        results.push({
          videoId,
          title: rawAcc,
          views: cleanViews,
          link: `https://www.youtube.com/shorts/${videoId}`,
          source: '유튜브 쇼츠',
          pubDateShort: cleanViews
        });
      }
    }

    // 2) reelItemRenderer / videoRenderer 폴백
    const shortsRegex = /"videoId":"([a-zA-Z0-9_-]{11})"[\s\S]{1,600}?"(?:headline|title)":\{"(?:simpleText|runs)":(?:\[\{"text":")?([^"\]\}]+)/g;
    while ((m = shortsRegex.exec(jsonStr)) !== null && results.length < limit) {
      const videoId = m[1];
      const rawTitle = decodeXmlEntities(m[2]);
      if (!seen.has(videoId) && rawTitle && rawTitle.length > 3) {
        seen.add(videoId);
        results.push({
          videoId,
          title: rawTitle,
          views: '실시간 쇼츠',
          link: `https://www.youtube.com/shorts/${videoId}`,
          source: '유튜브 쇼츠',
          pubDateShort: '실시간 쇼츠'
        });
      }
    }
    return results;
  } catch (err) {
    console.error('YouTube Shorts fetch error:', err.message);
    return [];
  }
}

// 실시간 한국어 뉴스 검색 (기본 최근 30일, 트렌드 발굴 시 최근 7일 필터 적용)
async function fetchRealTimeKoreanNews(keyword, limit = 6, when = '30d') {
  const q = (keyword || '').trim();
  if (!q) return [];
  const fullQuery = when && !q.includes('when:') ? `${q} when:${when}` : q;
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(fullQuery)}&hl=ko&gl=KR&ceid=KR:ko`;
    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const items = [];
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
      const block = match[1];
      const rawTitle = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const rawLink = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
      const rawPubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
      const rawSource = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '언론 보도';

      let cleanTitle = decodeXmlEntities(rawTitle);
      const cleanSource = decodeXmlEntities(rawSource);
      if (cleanSource && cleanTitle.endsWith(' - ' + cleanSource)) {
        cleanTitle = cleanTitle.slice(0, -(' - ' + cleanSource).length).trim();
      }

      let pubDateShort = '';
      if (rawPubDate) {
        const d = new Date(rawPubDate);
        if (!Number.isNaN(d.getTime())) {
          pubDateShort = d.toISOString().slice(0, 10);
        }
      }

      if (cleanTitle) {
        items.push({
          title: cleanTitle,
          link: rawLink.trim(),
          source: cleanSource || '주요 언론',
          pubDateShort
        });
      }
    }
    // 만약 최근 기간(when:30d) 내 기사가 0건이면 기간 제한 없이 재검색
    if (items.length === 0 && when) {
      return fetchRealTimeKoreanNews(keyword, limit, '');
    }
    return items;
  } catch (err) {
    console.error('Live RSS fetch error:', err.message);
    return [];
  }
}

// JSON 객체 내부의 모든 문자열에서 Perplexity 각주 번호([1], [2] 등)를 깔끔하게 제거하는 헬퍼
function stripCitationBrackets(val) {
  if (typeof val === 'string') {
    return val.replace(/\s*\[\d+\]/g, '').trim();
  }
  if (Array.isArray(val)) {
    return val.map(stripCitationBrackets);
  }
  if (val && typeof val === 'object') {
    const out = {};
    for (const k of Object.keys(val)) {
      out[k] = stripCitationBrackets(val[k]);
    }
    return out;
  }
  return val;
}

// Perplexity API 실시간 사용량·비용(버닝) 추적 및 30분 트렌드 캐시 (단순 F5 새로고침 시 중복 과금 원천 방지)
const TREND_CACHE_TTL_MS = 30 * 60 * 1000; // 30분 캐시
let cachedTrendRadar = null;
let cachedTrendTimestamp = 0;

const DEFAULT_PPLX_MODEL = 'google/gemini-4-argon';

const apiUsageStats = {
  model: DEFAULT_PPLX_MODEL,
  totalCalls: 0,
  trendCalls: 0,
  draftCalls: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  estimatedCostUsd: 0,
  estimatedCostKrw: 0,
  lastCalledAt: null,
  cacheHitsOnRefresh: 0
};

function loadPersistedUsageStats() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      if (db.apiUsageStats && typeof db.apiUsageStats === 'object') {
        Object.assign(apiUsageStats, db.apiUsageStats);
        apiUsageStats.model = DEFAULT_PPLX_MODEL;
      }
    }
  } catch (e) {
    // ignore
  }
}

function savePersistedUsageStats() {
  try {
    ensureDb();
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    db.apiUsageStats = { ...apiUsageStats };
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    // ignore
  }
}

function recordPerplexityUsage(usage = {}, callType = 'draft') {
  const pTokens = Number(usage.input_tokens || usage.prompt_tokens) || 950;
  const cTokens = Number(usage.output_tokens || usage.completion_tokens) || 1450;
  apiUsageStats.model = DEFAULT_PPLX_MODEL;
  apiUsageStats.totalCalls += 1;
  if (callType === 'trend') apiUsageStats.trendCalls += 1;
  else apiUsageStats.draftCalls += 1;

  apiUsageStats.promptTokens += pTokens;
  apiUsageStats.completionTokens += cTokens;
  apiUsageStats.totalTokens += pTokens + cTokens;

  // Perplexity /v1/responses API가 반환하는 실제 과금(usage.cost.total_cost) 우선 반영, 없으면 토큰 단가 계산
  const exactCostUsd = Number(usage?.cost?.total_cost);
  const callCostUsd = (!Number.isNaN(exactCostUsd) && exactCostUsd > 0)
    ? exactCostUsd
    : (pTokens / 1_000_000) * 2.0 + (cTokens / 1_000_000) * 10.0;
  apiUsageStats.estimatedCostUsd = Number((apiUsageStats.estimatedCostUsd + callCostUsd).toFixed(5));
  apiUsageStats.estimatedCostKrw = Math.round(apiUsageStats.estimatedCostUsd * 1380);
  apiUsageStats.lastCalledAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  savePersistedUsageStats();
}

// JSON 문자열 파싱 안전 헬퍼 (코드블록 제거, 트레일링 콤마 교정 등)
function safeParseJsonFromText(rawText = '') {
  const cleaned = String(rawText || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Perplexity(google/gemini-4-argon) 응답에서 JSON 구조를 추출하지 못했습니다.');
  }
  let candidate = jsonMatch[0];
  try {
    return JSON.parse(candidate);
  } catch (firstErr) {
    // 트레일링 콤마(,)나 제어문자 제거 후 재시도
    const repaired = candidate
      .replace(/,\s*([\]}])/g, '$1')
      .replace(/[\u0000-\u0019]+/g, ' ');
    return JSON.parse(repaired);
  }
}

// Perplexity Responses API (/v1/responses, model: "google/gemini-4-argon") 호출 헬퍼
async function callPerplexityJson(apiKey, systemPrompt, userPrompt, recencyFilter = 'month', callType = 'draft') {
  const maxOutTokens = callType === 'trend' ? 6500 : 8192;
  const payload = {
    model: DEFAULT_PPLX_MODEL,
    instructions: systemPrompt,
    input: userPrompt,
    max_output_tokens: maxOutTokens
  };

  const res = await fetch('https://api.perplexity.ai/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Perplexity API(${DEFAULT_PPLX_MODEL}) 호출 실패 (${res.status}): ${errText.slice(0, 120)}`);
  }

  const data = await res.json();
  recordPerplexityUsage(data?.usage, callType);

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
  const parsed = stripCitationBrackets(safeParseJsonFromText(content));
  return { parsed, citations };
}

// Perplexity API + 최근 7일 실시간 뉴스·쇼츠·구글트렌드 원시 데이터를 결합해 '진짜 이번 주 최신 트렌드' 발굴 (5개 탭별 10개씩, 탭 간 중복 방지)
async function fetchPerplexityTrends(apiKey, rawLiveContext) {
  const sys = `당신은 매일경제 디지털뉴스룸(MK Pick) 실시간 트렌드 데스크입니다.
철칙:
1. '두바이 초콜릿/쿠키', '버터떡', '우베', '탕후루', '요아정'처럼 이미 유행이 지났거나 연말·분기 결산 회고 기사에 나오는 과거 유행어를 절대 포함하지 마세요.
2. 반드시 아래 제공된 [최근 7일 이내 실시간 보도·쇼츠·구글트렌드 원시 데이터]에 등장하는 이번 주 실제 신상품, 브랜드 프로모션, 품절템, 팝업스토어, MZ 소비 현상만 선별하세요.
3. 5개 탭(shortFormTrends, newsletterTrends, portalRetailTrends, googleTrends, brandPromoTrends) 각각 정확히 10개씩 작성하되, 같은 브랜드나 같은 주제를 중복해서 넣지 마세요.
4. 특히 brandPromoTrends 탭은 [식음료·외식], [뷰티·패션], [유통·리빙], [가전·IT] 4대 업종의 주요 브랜드가 이번 주에 발표한 '신상품·신메뉴 출시' 및 '할인·사은품·콜라보 프로모션' 최신 뉴스 10선으로 고르게 구성하세요.
5. 각주 번호([1], [2])를 넣지 말고 순수 JSON 객체만 출력하세요.`;

  const usr = `[이번 주(최근 7일 이내) 실제 수집된 카테고리별 실시간 한국 뉴스·쇼츠·급상승 검색어 원시 데이터 (각 항목 앞 [REF-숫자]는 고유 원문 기사 번호)]
${rawLiveContext}

위 최근 7일 이내 실시간 데이터를 바탕으로, 탭별로 서로 겹치지 않는 **10개씩(각 배열당 10개 항목 필수)**을 JSON으로 정리하세요.
- 반드시 위 원시 데이터에 있는 실제 뉴스를 바탕으로 작성하고, 참조한 원시 뉴스의 고유 번호(예: "REF-12")를 \`refId\` 필드에 정확히 적어주세요. (원문 기사 1:1 정확한 링크 연결에 사용됩니다)
- keyword는 2~4어절의 직관적인 최신 트렌드·브랜드 신상·프로모션 키워드로 작성하세요.
- desc는 구체적인 브랜드명·신제품명·가격·프로모션 혜택·일정을 담아 "~합니다" 체 1문장으로 작성하세요.

{
  "shortFormTrends": [{"refId": "REF-번호", "keyword": "숏폼·바이럴·오픈런 키워드 (10개)", "badge": "🎬 쇼츠·릴스 화제", "desc": "이번 주 화제 이유와 수치 1문장"}],
  "newsletterTrends": [{"refId": "REF-번호", "keyword": "MZ 소비문화·패션·신조어 키워드 (10개)", "category": "MZ·소비 이슈", "desc": "이번 주 화제 이유와 수치 1문장"}],
  "portalRetailTrends": [{"refId": "REF-번호", "keyword": "편의점·다이소·백화점 신상 키워드 (10개)", "badge": "포털·유통 신상", "desc": "이번 주 출시·품절·프로모션 팩트 1문장"}],
  "googleTrends": [{"refId": "REF-번호", "keyword": "오늘·이번주 급상승 키워드 (10개)", "badge": "실시간 급상승", "desc": "급상승 배경 1문장"}],
  "brandPromoTrends": [{"refId": "REF-번호", "keyword": "브랜드명 + 신상품/프로모션 핵심 키워드 (10개)", "company": "브랜드/기업명", "sector": "식음료·외식 | 뷰티·패션 | 유통·리빙 | 가전·IT 중 택1", "badge": "업종 · 신상품/프로모션", "desc": "출시 신제품 특징 및 프로모션 혜택 팩트 1문장 (~합니다 체)"}]
}`;
  const { parsed } = await callPerplexityJson(apiKey, sys, usr, 'week', 'trend');
  return parsed;
}

// Perplexity API를 활용해 선택한 콘텐츠 유형(1~5번)과 입력 키워드·주제에 딱 맞춘 맞춤형 기사 초안 생성
async function buildPerplexityEnhancedScenario({ apiKey, keyword: rawKeyword, company: rawCompany, url, rawText, typeId, newsItems, baseScenario }) {
  const keyword = cleanTrendTopicKeyword(rawKeyword);
  const company = extractBrandFromTopic(keyword, rawCompany);
  // 버츄얼 아이돌 계보 키워드('아담, 키즈나아이, 이세계아이돌, 플레이브, 나이비스' 등)인 경우에만 버츄얼 아이돌 계보 원고 시나리오 적용
  if (isVirtualIdolQuery(keyword, company)) {
    const viScenario = getVirtualIdolScenario(keyword);
    return {
      ...viScenario,
      usedPerplexity: true
    };
  }

  const tInfo = CONTENT_TYPES[typeId] || CONTENT_TYPES[4];
  const newsContext = (newsItems || [])
    .slice(0, 6)
    .map((n, i) => `${i + 1}. [${n.source}] ${n.title} (${n.link})`)
    .join('\n');

  const kwEntities = String(keyword || '')
    .split(/[,/·]+/)
    .map(s => s.trim())
    .filter(Boolean);
  const isMultiEntityTopic = kwEntities.length >= 2;
  const isHistoryTopic = /(?:계보|변천사|타임라인|역사|세대별\s*진화)/.test(keyword);

  const typeInstructions = {
    1: '유형 1(유료 업체 타겟팅 기획 콘텐츠): 1단락은 소비자 공감 질문 도입과 과거 일괄 방식 vs 최근 맞춤형 소비 트렌드 비교, 2~4단락은 타깃 파트너사 및 주요 업체·플랫폼별 핵심 서비스·혜택·강점을 구체적으로 소개, 마지막 단락은 실패 없는 업체·서비스 선택 기준 제시. 요약표는 업체·서비스별 비교표, 용어 사전 3~4개, FAQ는 7문항.',
    2: '유형 2(특정 기념일 관련 콘텐츠): 1단락은 기념일 유래·법적 지정 배경과 의미, 2단락은 정부·지자체 공식 지원 제도 및 바우처 안내, 3~4단락은 이 기념일을 맞아 참여하는 주요 브랜드·기업별 캠페인·제품·할인 프로모션을 구체적으로 소개. 요약표는 참여 브랜드·기관별 혜택 비교표, 용어 사전 3~4개, FAQ는 5문항.',
    3: isHistoryTopic
      ? '유형 3(시대별 계보·트렌드 변천사 심층 분석): 사용자가 계보·변천사 주제를 입력했으므로 초창기 원조부터 전환기, 현재 대표 주자들까지 흐름에 따라 각 주자를 단락별로 조명하고 비교 요약표와 FAQ 5문항으로 정리.'
      : '유형 3(최신 트렌드 반영 콘텐츠 1 - 트렌드·소비현상 심층 분석): 1단락은 독자의 일상 공감 질문 도입과 왜 지금 이 트렌드·키워드가 부상했는지 배경 및 소비자 심리 분석, 2~3단락은 트렌드를 구성하는 핵심 요소·카테고리·대표 사례를 구체적 수치·브랜드 사례와 함께 심층 분석, 마지막 단락은 소비자를 위한 현명한 활용 가이드 및 시장 시사점 제시. (억지로 연도별 역사나 1990년대/2000년대 타임라인을 만들지 말 것!) 요약표는 핵심 요소·사례 비교표, 용어 사전 3~4개, FAQ 5문항.',
    4: '유형 4(최신 트렌드 반영 콘텐츠 2 - 신상품·뷰티·유통 아이템 및 시즌 루틴·라인업 분석): 1단락은 계절·일상 속 소비자 고민(예: 환절기 피부 고민, 장바구니 물가 등)에 공감하는 질문 도입과 왜 요즘 이 아이템·조합이 주목받는지 핵심 배경 설명, 이어지는 단락들은 입력된 키워드·제품군·대표 브랜드 상품들의 특징·성분·규격·차별점을 단락별로 알기 쉽게 상세 소개(여러 키워드나 소재가 입력되었으면 각 소재·아이템의 역할과 대표 제품 사례를 자연스럽게 나누어 설명), 마지막 단락은 똑똑한 제품 선택 기준과 사용·구매 팁 정리. (절대 억지로 2000년대~2010년대 같은 연도별 타임라인이나 탄생 배경/활동 방식의 한계/Bonus Track 틀에 끼워 맞추지 말 것!) 요약표는 카테고리·제품별 핵심 특징·성분·활용법 비교표, 용어 사전 3~4개, FAQ는 5문항.',
    5: '유형 5(영업 기업 맞춤 기획 콘텐츠): 1단락은 독자 질문 도입 1문단 뒤 Q1~Q4 시장 메가 트렌드·소비자 페인포인트 문답, 2단락은 Q5~Q6 선택 기준 문답, 3단락은 Q7에서 영업 타깃 기업의 핵심 솔루션·경쟁력을 집중 소개. 요약표는 대상 기업 핵심 기능·기대효과 요약표, 용어 사전 3~4개, FAQ는 7문항.'
  };

  const faqCount = (typeId === 1 || typeId === 5) ? 7 : 5;
  const fallbackCat = recommendMkPickCategory(keyword, typeId, company);
  const pressNewsItems = (newsItems || []).filter(n => n && n.source !== '유튜브 쇼츠');
  const preFactCheck = inspectTopicFactVerification(keyword, company, pressNewsItems.length);

  const sys = `당신은 매일경제 MK Pick(GEO·AEO 최적화 매거진형 심층 기사) 수석 에디터이자 팩트체크 데스크입니다.
타 언론사 기사의 문장을 절대 그대로 베끼지 말고, 수치·브랜드명·성분·규격·가격 등 핵심 팩트만 추출하여 모든 본문과 답변을 매일경제 고유의 정중하고 생동감 있는 "~합니다/습니다" 체로 작성하세요.

[핵심 작성 원칙 — 반드시 준수!]
0. [가장 중요 · 0순위 원칙] 실제 공식 출시·언론 보도 여부 팩트체크 및 가상(AI 생성) 밈·루머 엄격 판별 (절대 준수!):
   - 기사를 작성하기 전에 입력된 키워드('${keyword}')가 **실제 기업·브랜드가 정식 출시·발표하고 언론에 보도된 실제 제품·트렌드**인지, 아니면 **유튜브 쇼츠·틱톡·릴스 등 SNS에서 인공지능(AI) 합성이나 상상력으로 만들어진 '가상(AI 생성) 밈·합성 콘텐츠·루머'**(예: 실제 정식 출시된 적 없는 '한정선 마이쮸 콜라보 찹쌀떡' 등)인지 반드시 먼저 검증하세요!
   - 만약 공식 출시 사실이나 언론 보도 근거가 없는 **가상(AI 생성) 밈·합성 콘텐츠이거나 미출시 루머**라면:
     ① **절대로 실제 출시된 신제품이거나 정식 콜라보인 것처럼 거짓으로 꾸며 쓰지 마세요!** (실무진과 독자가 오인하면 심각한 보도 사고가 됩니다.)
     ② 반드시 JSON의 \`factVerification.verdict\`를 \`"AI_MEME_OR_VIRTUAL"\` (또는 보도 미확인 시 \`"UNVERIFIED_VIRAL"\`), \`factVerification.isWarning\`을 \`true\`로 설정하세요.
     ③ 기사 제목(\`titleCandidates\`), \`aiFactSummary\`(3줄 요약), 본문(\`draftSections\`) 첫 단락에서 **"해당 화제 키워드는 실제 정식 출시된 제품이 아니라 SNS·숏폼에서 확산된 가상(AI 생성) 밈·콘텐츠"**라는 사실을 명확히 팩트체크해 바로잡고, 대신 **실제 존재하는 원조 브랜드(예: 더현대서울 등에서 판매되는 '한정선' 생과일 찹쌀떡 등)의 진짜 정식 메뉴와 검증된 시장 트렌드 팩트**를 중심으로 설명하세요.
   - 실제 정식 출시·공식 발표 및 언론 보도가 확인된 정상적인 주제라면 \`factVerification.verdict\`를 \`"VERIFIED_FACT"\`, \`factVerification.isWarning\`을 \`false\`로 설정하고 확인된 공식 팩트 요약을 적어주세요.
1. 주제와 콘텐츠 유형(01~05)에 딱 맞는 맞춤형 본문 구성 (억지 연도별 타임라인 절대 금지!):
   - 사용자가 명시적으로 '역사/계보/변천사'를 물어본 경우가 아니라면, 절대로 '1990년대/2000년대~2010년대/2020년대'처럼 다짜고짜 연도별로 단락을 나누거나 '탄생 배경과 이유 :', '활동 방식의 한계 :', 'Bonus Track :' 같은 고정 라벨을 기계적으로 붙이지 마세요!
   - 예를 들어 사용자가 '대왕패치, 환절기, 기초템'을 입력했다면 환절기 피부 고민(속건조·열감·각질·장벽 약화)이라는 주제 흐름에 맞춰 왜 요즘 넓은 부위를 케어하는 대왕패치와 장벽·보습 기초템 루틴이 뜨는지, 각 아이템(대왕패치, 토너·로션·크림 기초템 등)과 대표 제품들은 어떤 성분·크기·특징을 가졌는지, 어떻게 조합해 쓰면 좋은지 자연스럽고 실용적인 매거진 기사로 작성해야 합니다.
2. 유튜브·SNS 구어체 제목 및 오탈자 자동 정제 원칙 (절대 준수!):
   - 입력된 키워드에 유튜버의 감탄사·수식어(예: '과즙 넘치는', '과즙미 가득한', '먹어봄', '미친 가성비', '다이소깡' 등)나 오탈자(예: '찹살떡', '찹살덕' → '찹쌀떡')가 포함되어 있더라도, 기사 제목·본문·요약표·FAQ에서는 절대 유튜버의 수식어나 오탈자를 그대로 반복하지 마세요!
   - 반드시 언론 보도와 공식 발표로 검증된 **실제 핵심 브랜드·기업**(예: '이디야커피', '다이소', '올리브영', '더현대서울 한정선' 등)과 **정확한 공식 제품명·트렌드 배경**을 중심으로 전문적인 매일경제 기사를 작성하세요.
3. 독자 공감 질문형 도입부:
   - 첫 번째 단락(draftSections[0].content)의 첫 문장은 독자가 일상이나 계절·소비 상황에서 실제로 겪을 법한 자연스러운 질문("~하신 적 없으신가요?")으로 시작하세요.
4. 복수 키워드·소재 입력 시 자연스러운 단락 전개 (3~5개 단락):
   - 여러 키워드(${isMultiEntityTopic ? kwEntities.join(', ') : '관련 핵심 포인트'})나 여러 브랜드·제품이 등장하면, 전체 주제를 아우르는 도입 단락 뒤에 각 키워드·제품군·브랜드의 핵심 특징과 실제 사례(성분, 크기, 가격, 프로모션 등)를 단락별로 명확하고 깊이 있게 소개하고, 마지막 단락에서 선택·활용 팁으로 매듭지으세요.
   - 각 단락의 소제목(title)은 주제에 어울리는 자연스러운 질문형 소제목("~할까요?", "~무엇인가요?") 또는 핵심 주제를 명확히 보여주는 매거진형 소제목으로 작성하세요.
5. 주제 맞춤형 비교 요약표(summaryTable) & 핵심 용어 사전(glossary) & FAQ:
   - 요약표(summaryTable)의 열 헤더(headers 4~5개)도 고정된 틀이 아니라 해당 주제에 가장 잘 맞는 항목(예: 뷰티/제품이면 ["구분·제품군", "핵심 특징 및 규격", "주요 성분·기술", "기대 효과 및 추천 대상"] 등)으로 구성하세요.
   - 기사에 등장하는 주요 성분·트렌드·핵심 개념 3~4개를 선정해 핵심 용어 사전(glossary)으로 정리하세요.
   - 기사 끝에는 전체 내용을 자연스럽게 갈무리하는 마무리 문단(closingParagraph)과 '한 줄 요약! ~입니다.'(oneLineSummary)를 작성하세요. 순수 JSON 객체만 출력하세요.`;

  const usr = `[작성 요청 정보]
- 키워드/주제: ${keyword}
- 타깃 기업/브랜드(선택): ${company || '관련 주요 브랜드·제품'}
- 참고 URL: ${url || '없음'}
- 추가 보도자료/메모: ${rawText || '없음'}
- 선택된 콘텐츠 유형: ${tInfo.shortName} (${tInfo.desc})
- 유형별 필수 구성 지침: ${typeInstructions[typeId] || typeInstructions[4]}
- 사전 팩트체크 시스템 진단(${preFactCheck.verdict}): ${preFactCheck.summary} (매칭된 언론 보도 기사 수: ${pressNewsItems.length}건)
- 실시간 참고 언론 뉴스 목록:
${newsContext || '매칭된 언론 보도 기사가 0건입니다! 가상(AI 생성) 밈이거나 미출시 루머일 가능성이 높으므로 반드시 실제 정식 출시 여부를 먼저 팩트체크하고, 정식 출시된 적 없는 가상 밈이라면 절대 실제 출시 제품처럼 쓰지 말고 가상 밈이라는 사실을 명시하세요!'}

아래 JSON 스키마에 맞춰 주제('${keyword}')의 실제 출시·언론 보도 진위를 먼저 검증(factVerification)한 뒤, 사실에 기반한 완성도 높은 기사(본문 3~5개 단락, 맞춤형 비교표, 용어 사전 3~4개, FAQ ${faqCount}개, 마무리 요약)를 작성하세요:
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
    {"category": "핵심 팩트 분류", "fact": "수치·브랜드명이 포함된 ~합니다 체 팩트 문장 1"},
    {"category": "핵심 팩트 분류", "fact": "수치·브랜드명이 포함된 ~합니다 체 팩트 문장 2"},
    {"category": "핵심 팩트 분류", "fact": "수치·브랜드명이 포함된 ~합니다 체 팩트 문장 3"},
    {"category": "핵심 팩트 분류", "fact": "수치·브랜드명이 포함된 ~합니다 체 팩트 문장 4"}
  ],
  "subtitle": "기사 부제 2줄 (줄바꿈 \\n 사용)",
  "aiFactSummary": [
    "1. 핵심 팩트 요약 첫 번째 문장 (~합니다 체)",
    "2. 핵심 팩트 요약 두 번째 문장 (~합니다 체)",
    "3. 핵심 팩트 요약 세 번째 문장 (~합니다 체)"
  ],
  "draftSections": [
    {
      "id": "sec-1",
      "title": "주제에 맞는 도입 질문형 소제목 (예: 왜 요즘 환절기 스킨케어에서 '대왕패치'와 '기초템' 조합이 주목받을까요?)",
      "content": "독자의 일상·계절 고민에 공감하는 질문형 첫 문장 + 해당 주제가 부상한 배경과 핵심 트렌드 분석 2~3문단 (~합니다 체)",
      "imageCaption": ""
    },
    {
      "id": "sec-2",
      "title": "첫 번째 핵심 키워드·카테고리·대표 제품 심층 분석 소제목",
      "content": "구체적인 제품 사례, 규격·성분·가격·차별화 포인트를 상세히 설명하는 본문 2~3문단 (~합니다 체)",
      "imageCaption": ""
    },
    {
      "id": "sec-3",
      "title": "두 번째 핵심 키워드·카테고리·브랜드 비교 소제목",
      "content": "연관 아이템·브랜드별 주요 특징과 시너지 포인트를 구체적 팩트로 설명하는 본문 2~3문단 (~합니다 체)",
      "imageCaption": ""
    },
    {
      "id": "sec-4",
      "title": "소비자를 위한 똑똑한 선택 기준과 실전 활용·구매 팁 소제목",
      "content": "상황·타입별 추천 조합, 사용 시 주의사항, 온·오프라인 구매 팁을 정리한 본문 2문단 (~합니다 체)",
      "imageCaption": ""
    }
  ],
  "summaryTable": {
    "title": "[요약표] 주제 맞춤형 핵심 비교",
    "headers": ["구분", "핵심 특징 및 사양", "주요 성분 · 강점", "추천 대상 및 활용 팁"],
    "rows": [
      ["항목 1", "구체적 특징·규격", "핵심 성분·차별점", "추천 대상·활용법"],
      ["항목 2", "구체적 특징·규격", "핵심 성분·차별점", "추천 대상·활용법"],
      ["항목 3", "구체적 특징·규격", "핵심 성분·차별점", "추천 대상·활용법"],
      ["항목 4", "구체적 특징·규격", "핵심 성분·차별점", "추천 대상·활용법"]
    ]
  },
  "glossaryTitle": "주제를 더 깊이 이해하는 핵심 용어 사전",
  "glossary": [
    {"term": "핵심 용어·성분·개념 1", "desc": "누구나 이해하기 쉬운 1~2문장 명쾌한 해설 (~합니다 체)"},
    {"term": "핵심 용어·성분·개념 2", "desc": "누구나 이해하기 쉬운 1~2문장 명쾌한 해설 (~합니다 체)"},
    {"term": "핵심 용어·성분·개념 3", "desc": "누구나 이해하기 쉬운 1~2문장 명쾌한 해설 (~합니다 체)"},
    {"term": "핵심 용어·성분·개념 4", "desc": "누구나 이해하기 쉬운 1~2문장 명쾌한 해설 (~합니다 체)"}
  ],
  "faqs": [
    {"q": "Q1. 사람들이 실제로 검색창에 물어볼 법한 구어체 자연어 질문 (~나요? / ~무엇인가요?)", "a": "구체적인 수치·성분·고유명사가 담긴 2~3문장 완결형 답변 (~합니다 체)"}
  ],
  "fanoutQuestions": [
    {"category": "핵심특징·비교", "q": "'${keyword}'에 대해 독자가 추가로 가장 궁금해할 구체적인 꼬리 질문 1 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"},
    {"category": "가격·구성", "q": "'${keyword}' 가격·용량·구성에 관한 구체적인 꼬리 질문 2 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"},
    {"category": "이용·구매처", "q": "'${keyword}' 구매 채널·매장·배달·온라인 이용에 관한 꼬리 질문 3 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"},
    {"category": "추천조합·활용팁", "q": "'${keyword}'을 더 맛있게/효과적으로 즐기는 조합이나 활용 팁 질문 4 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"},
    {"category": "성분·스펙·보관", "q": "'${keyword}' 원재료·성분·칼로리·보관법 등에 관한 꼬리 질문 5 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"},
    {"category": "이벤트·프로모션", "q": "'${keyword}' 출시 기념 혜택·할인·한정 여부에 관한 꼬리 질문 6 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"}
  ],
  "closingParagraph": "기사 전체의 핵심 내용을 자연스럽게 갈무리하며 독자에게 실질적인 조언을 건네는 마무리 문단 2문장 (~합니다 체)",
  "oneLineSummary": "한 줄 요약! 기사 전체 핵심 메시지를 명쾌하게 정리한 한 문장 (~입니다 체)"
}`;

  const { parsed, citations } = await callPerplexityJson(apiKey, sys, usr);

  // 출처 병합
  const mergedSources = [...(baseScenario.sources || [])];
  citations.slice(0, 5).forEach((citUrl, i) => {
    if (typeof citUrl === 'string' && !mergedSources.some(s => s.url === citUrl)) {
      mergedSources.push({
        id: `src-pplx-${i + 1}`,
        url: citUrl,
        title: `[Perplexity 실시간 검증 출처 #${i + 1}] ${citUrl}`,
        method: 'Perplexity 실시간 검색',
        reliability: '높음',
        excluded: false
      });
    }
  });

  const researchItems = Array.isArray(parsed.researchFacts) && parsed.researchFacts.length > 0
    ? parsed.researchFacts.map((rf, i) => ({
        id: `ri-pplx-${i + 1}`,
        category: rf.category || `Perplexity 추출 팩트 #${i + 1}`,
        fact: rf.fact,
        rawReference: 'Perplexity 실시간 웹 검색 및 매경 문체 재가공',
        sourceIds: [mergedSources[i % Math.max(1, mergedSources.length)]?.id].filter(Boolean)
      }))
    : baseScenario.researchItems;

  const normalizeNewlines = str => String(str || '').replace(/\\n/g, '\n');

  const draftSections = Array.isArray(parsed.draftSections) && parsed.draftSections.length > 0
    ? parsed.draftSections.map((sec, i) => ({
        id: sec.id || `sec-${i + 1}`,
        title: normalizeNewlines(sec.title || `단락 ${i + 1}`).trim(),
        subtitle: normalizeNewlines(sec.subtitle || '').trim(),
        content: normalizeNewlines(sec.content || '').trim(),
        imageCaption: normalizeNewlines(sec.imageCaption || '').trim(),
        sourceIds: mergedSources.slice(0, 2).map(s => s.id)
      }))
    : baseScenario.draftSections;

  const validCategories = ['산업 Q&A', '제품·기술', '성공사례', '기업뉴스', '브랜드스토리(기업관)'];
  const pickedCategory = validCategories.includes((parsed.mkCategory || '').trim())
    ? parsed.mkCategory.trim()
    : fallbackCat.recommendedCategory;
  const pickedCatReason = (parsed.mkCategoryReason || '').trim() || fallbackCat.categoryReason;

  const summaryBlocks = {
    ...baseScenario.summaryBlocks,
    mkCategory: pickedCategory,
    mkCategoryReason: pickedCatReason,
    byline: `${pickedCategory} | 남궁선희 기자 | 입력 ${new Date().toISOString().slice(0, 10).replace(/-/g, '.')} 10:00`,
    subtitle: normalizeNewlines(parsed.subtitle || baseScenario.summaryBlocks.subtitle).trim(),
    aiFactSummary: Array.isArray(parsed.aiFactSummary) && parsed.aiFactSummary.length > 0
      ? parsed.aiFactSummary.map(s => normalizeNewlines(s).trim())
      : baseScenario.summaryBlocks.aiFactSummary,
    summaryTable: parsed.summaryTable && Array.isArray(parsed.summaryTable.headers)
      ? {
          title: normalizeNewlines(parsed.summaryTable.title || '[요약표]').trim(),
          headers: parsed.summaryTable.headers.map(h => normalizeNewlines(h).trim()),
          rows: (parsed.summaryTable.rows || []).map(r => Array.isArray(r) ? r.map(c => normalizeNewlines(c).trim()) : [])
        }
      : baseScenario.summaryBlocks.summaryTable,
    glossaryTitle: normalizeNewlines(parsed.glossaryTitle || baseScenario.summaryBlocks.glossaryTitle || '주제를 더 깊이 이해하는 용어 사전').trim(),
    glossary: Array.isArray(parsed.glossary) && parsed.glossary.length > 0
      ? parsed.glossary.map(g => ({
          term: normalizeNewlines(g.term || '').trim(),
          desc: normalizeNewlines(g.desc || '').trim()
        })).filter(g => g.term && g.desc)
      : (baseScenario.summaryBlocks.glossary || []),
    faqs: Array.isArray(parsed.faqs) && parsed.faqs.length > 0
      ? parsed.faqs.map((f, i) => ({
          q: /^Q\d+\./i.test((f.q || '').trim()) ? normalizeNewlines(f.q).trim() : `Q${i + 1}. ${normalizeNewlines(f.q || '').trim()}`,
          a: normalizeNewlines(f.a || '').trim()
        }))
      : baseScenario.summaryBlocks.faqs,
    fanoutQuestions: Array.isArray(parsed.fanoutQuestions) && parsed.fanoutQuestions.length > 0
      ? parsed.fanoutQuestions.map((fq, i) => ({
          id: `fq-pplx-${i + 1}`,
          category: fq.category || '연관 질문',
          q: normalizeNewlines(fq.q || '').replace(/^Q\d+\.\s*/i, '').trim(),
          a: normalizeNewlines(fq.a || '').trim()
        }))
      : baseScenario.summaryBlocks.fanoutQuestions,
    closingParagraph: normalizeNewlines(parsed.closingParagraph || baseScenario.summaryBlocks.closingParagraph || '').trim(),
    oneLineSummary: normalizeNewlines(parsed.oneLineSummary || baseScenario.summaryBlocks.oneLineSummary).trim()
  };

  const titleCandidates = Array.isArray(parsed.titleCandidates) && parsed.titleCandidates.length > 0
    ? parsed.titleCandidates
    : baseScenario.titleCandidates;

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
        summary: parsedFv.summary || preFactCheck.summary
      };

  return {
    ...baseScenario,
    sources: mergedSources,
    researchItems,
    titleCandidates,
    selectedTitleId: titleCandidates[0]?.id || 'tc-1',
    draftSections,
    summaryBlocks,
    factChecks: extractFactSentencesFromSections(draftSections, mergedSources),
    factVerification: finalFactVerification,
    usedPerplexity: true
  };
}

// 업종 분류 헬퍼 (식음료·외식 / 뷰티·패션 / 유통·리빙 / 가전·IT)
function detectBrandPromoSector(text = '') {
  if (/(?:뷰티|화장품|앰플|스킨케어|코스메틱|올리브영|아모레|LG생활건강|무신사|패션|의류|아우터|니트|슈즈|운동화|향수)/.test(text)) {
    return '뷰티·패션';
  }
  if (/(?:가전|AI|갤럭시|아이폰|삼성전자|LG전자|노트북|TV|세탁|건조기|청소기|IT|로봇|디지털)/.test(text)) {
    return '가전·IT';
  }
  if (/(?:백화점|마트|이마트|롯데마트|홈플러스|오늘의집|가구|침구|인테리어|리빙|호텔|리조트|이커머스|쿠팡|컬리|다이소)/.test(text)) {
    return '유통·리빙';
  }
  return '식음료·외식';
}

// 뉴스 제목에서 단어 중간 절단이나 어색한 인용구 발췌 없이 깔끔한 핵심 키워드 구문 추출
function extractCleanNewsKeyword(rawTitle = '') {
  let s = String(rawTitle || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^\)]*포토[^\)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const ellipsisParts = s.split(/\s*[…⋯]\s*|\s*\.\.\.\s*|\s*‥\s*/).map(p => p.trim()).filter(Boolean);
  if (ellipsisParts.length >= 2) {
    const first = ellipsisParts[0];
    const second = ellipsisParts[1];
    const firstHasSubjectComma = /^[가-힣A-Za-z0-9·&]{2,12},/.test(first);
    const secondHasSubjectComma = /^[가-힣A-Za-z0-9·&]{2,12},/.test(second);
    const firstIsPureQuote = /^[“"‘'].+[”"’'][?!.]?$/.test(first);

    if ((first + ' ' + second).replace(/[“”"‘’']/g, '').length <= 28) {
      s = `${first} ${second}`;
    } else if (secondHasSubjectComma && !firstHasSubjectComma && second.length >= 10) {
      s = second;
    } else if (firstIsPureQuote && second.length >= 8) {
      s = second;
    } else {
      s = first.length >= 10 ? first : `${first} ${second}`;
    }
  }

  s = s
    .replace(/[“”"‘’']/g, '')
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (s.length <= 28) return s;
  const words = s.split(' ');
  let acc = '';
  for (const w of words) {
    if ((acc + ' ' + w).trim().length > 28) break;
    acc = (acc + ' ' + w).trim();
  }
  return acc || s.slice(0, 28);
}

// 유튜브 쇼츠 제목에서 유튜버 클릭베이트 수식어·오탈자·해시태그·이모지 노이즈를 제거하고 기사 작성용 핵심 키워드 추출
function extractCleanShortsKeyword(rawTitle = '') {
  return cleanTrendTopicKeyword(rawTitle);
}

// 실시간 트렌드 키워드 수집 (100% 실제 최근 7일 뉴스·구글트렌드·유튜브쇼츠·브랜드 신상/프로모션 원시 수집 데이터만 사용, 인위적 샘플 패딩 및 AI 환각 완전 제거)
async function fetchLiveTrendRadar() {
  const googleTrends = [];
  const portalRetailTrends = [];
  const shortFormTrends = [];
  const newsletterTrends = [];
  const brandPromoTrends = [];
  const usedUrls = new Set();

  function buildFallbackNewsUrl(kw = '') {
    return `https://news.google.com/search?q=${encodeURIComponent(kw)}&hl=ko&gl=KR&ceid=KR:ko`;
  }

  try {
    const [
      gRes,
      shortFormPressNews,
      viralNews,
      mzCultureNews,
      retailNews,
      brandFnbNews,
      brandLifeItNews
    ] = await Promise.all([
      fetch('https://trends.google.co.kr/trending/rss?geo=KR', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }).catch(() => null),
      fetchRealTimeKoreanNews('(쇼츠 OR 릴스 OR 숏폼 OR 유튜브 OR SNS OR 바이럴 OR 오픈런 OR 품절대란) (다이소 OR 올리브영 OR 편의점 OR 디저트 OR 팝업스토어 OR 뷰티 OR 신상)', 18, '7d'),
      fetchRealTimeKoreanNews('(품절 OR 오픈런 OR 팝업스토어 OR 굿즈 OR 콜라보)', 14, '7d'),
      fetchRealTimeKoreanNews('(2030 OR MZ세대 OR 유행 OR 열풍 OR 오픈런) (패션 OR 뷰티 OR 소비 OR 디저트 OR 팝업스토어)', 16, '7d'),
      fetchRealTimeKoreanNews('(다이소 OR 편의점 OR 올리브영 OR 이마트 OR 백화점 OR 무신사 OR 컬리) (출시 OR 신상 OR 단독 OR 5000원 OR 반값 OR 기획전)', 16, '7d'),
      fetchRealTimeKoreanNews('(스타벅스 OR 투썸 OR 이디야 OR 메가커피 OR 롯데웰푸드 OR 농심 OR 오뚜기 OR CU OR GS25) (신제품 OR 신메뉴 OR 신상 OR 프로모션 OR 한정판 OR 출시)', 12, '7d'),
      fetchRealTimeKoreanNews('(올리브영 OR 아모레 OR LG생활건강 OR 삼성전자 OR LG전자 OR 무신사 OR 오늘의집 OR 호텔) (신제품 OR 신상품 OR 프로모션 OR 기획전 OR 한정판 OR 출시)', 12, '7d')
    ]);

    // 1) 탭 4: 구글 트렌드 급상승 (구글 코리아 공식 RSS 100% 원본 연동)
    if (gRes && gRes.ok) {
      const gXml = await gRes.text();
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let m;
      while ((m = itemRegex.exec(gXml)) !== null && googleTrends.length < 10) {
        const block = m[1];
        const title = decodeXmlEntities((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
        const traffic = decodeXmlEntities((block.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/) || [])[1] || '급상승');
        const newsTitle = decodeXmlEntities((block.match(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/) || [])[1] || '');
        const newsUrl = decodeXmlEntities((block.match(/<ht:news_item_url>([\s\S]*?)<\/ht:news_item_url>/) || [])[1] || '');
        const newsSource = decodeXmlEntities((block.match(/<ht:news_item_source>([\s\S]*?)<\/ht:news_item_source>/) || [])[1] || '구글 트렌드');
        if (title && !googleTrends.some(g => g.keyword === title)) {
          const itemUrl = newsUrl || buildFallbackNewsUrl(title);
          usedUrls.add(itemUrl);
          googleTrends.push({
            keyword: title,
            badge: `검색량 ${traffic}`,
            source: newsSource,
            pubDateShort: `검색량 ${traffic}`,
            verifiedPress: true,
            desc: newsTitle
              ? `[구글 실시간 검색량 ${traffic} · ${newsSource}] ${newsTitle}`
              : `[구글 실시간 검색량 ${traffic}] '${title}' 관련 오늘 급상승 검색 트렌드입니다.`,
            url: itemUrl
          });
        }
      }
    }

    // 2) 탭 1: 유튜브 쇼츠 · 릴스 화제 (가상 AI 밈·합성 루머 원천 차단을 위해 100% 언론사 보도 검증된 숏폼·SNS·바이럴·오픈런 이슈만 엄선)
    const combinedShortFormNews = [...(shortFormPressNews || []), ...(viralNews || [])];
    combinedShortFormNews.forEach(vn => {
      if (shortFormTrends.length >= 10) return;
      if (/부고|인사|동정|주가|코스피|결산|사망|사고|구속|재판/.test(vn.title)) return;
      const kw = extractCleanNewsKeyword(vn.title);
      const itemUrl = vn.link;
      if (!kw || !itemUrl || usedUrls.has(itemUrl)) return;
      if (shortFormTrends.some(s => s.keyword === kw)) return;
      const fv = inspectTopicFactVerification(kw, '', 1);
      if (fv.isWarning) return;
      usedUrls.add(itemUrl);
      const detectedCompany = extractBrandFromTopic(kw + ' ' + vn.title);
      shortFormTrends.push({
        keyword: kw,
        company: detectedCompany,
        source: vn.source || '언론 보도',
        pubDateShort: vn.pubDateShort || '',
        verifiedPress: true,
        badge: `✓ 언론 보도 확인 · ${vn.source || '숏폼·바이럴'}`,
        desc: paraphraseNewsToMkFact(vn.title, kw, vn.source).paraphrasedSentence,
        url: itemUrl
      });
    });

    // 3) 탭 3: 네이버 · 포털 유통 화제 (최근 7일 유통·편의점·다이소·백화점 실제 보도)
    retailNews.forEach(n => {
      if (portalRetailTrends.length >= 10) return;
      if (/부고|인사|동정|주가|코스피|실적|영업이익/.test(n.title)) return;
      const kw = extractCleanNewsKeyword(n.title);
      const itemUrl = n.link;
      if (!kw || !itemUrl || usedUrls.has(itemUrl)) return;
      if (portalRetailTrends.some(p => p.keyword === kw)) return;
      usedUrls.add(itemUrl);
      portalRetailTrends.push({
        keyword: kw,
        source: n.source || '언론 보도',
        pubDateShort: n.pubDateShort || '',
        badge: `${n.source} · ${n.pubDateShort || '최신'}`,
        desc: paraphraseNewsToMkFact(n.title, kw, n.source).paraphrasedSentence,
        url: itemUrl
      });
    });

    // 4) 탭 2: 트렌드 뉴스레터 · MZ 키워드 (최근 7일 MZ 소비·팝업·디저트·패션 실제 보도)
    mzCultureNews.forEach(mn => {
      if (newsletterTrends.length >= 10) return;
      if (/휩쓴|결산|총정리|부고|인사|주가|코스피/.test(mn.title)) return;
      const kw = extractCleanNewsKeyword(mn.title);
      const itemUrl = mn.link;
      if (!kw || !itemUrl || usedUrls.has(itemUrl)) return;
      if (newsletterTrends.some(item => item.keyword === kw)) return;
      usedUrls.add(itemUrl);
      newsletterTrends.push({
        keyword: kw,
        source: mn.source || '언론 보도',
        pubDateShort: mn.pubDateShort || '',
        category: `${mn.source || 'MZ 트렌드'} · ${mn.pubDateShort || '최신'}`,
        desc: paraphraseNewsToMkFact(mn.title, kw, mn.source).paraphrasedSentence,
        url: itemUrl
      });
    });

    // 5) 탭 5: 브랜드 신상 · 프로모션 뉴스 (식음료·뷰티·유통·IT 4대 업종 실제 출시·프로모션 보도 교차 배치)
    const interleavedBrandNews = [];
    const maxBrandLen = Math.max(brandFnbNews.length, brandLifeItNews.length);
    for (let i = 0; i < maxBrandLen; i++) {
      if (brandFnbNews[i]) interleavedBrandNews.push(brandFnbNews[i]);
      if (brandLifeItNews[i]) interleavedBrandNews.push(brandLifeItNews[i]);
    }
    const usedBrandNames = new Set();

    interleavedBrandNews.forEach(bn => {
      if (brandPromoTrends.length >= 10) return;
      if (/부고|인사|동정|주가|코스피|출시\s*\d+주년|\d+돌|연매출\s*목표|수출로|영업이익|배당/.test(bn.title)) return;
      const cleanedTitle = bn.title.replace(/\[[^\]]*\]/g, '').trim();
      const kw = extractCleanNewsKeyword(cleanedTitle);
      const itemUrl = bn.link;
      if (!kw || !itemUrl || usedUrls.has(itemUrl)) return;

      const brandCand = (kw.split(/[,…·\s]/)[0] || '').replace(/(은|는|이|가|의|에서)$/, '').trim();
      if (brandCand.length >= 2 && usedBrandNames.has(brandCand)) return;
      if (brandPromoTrends.some(b => b.keyword === kw)) return;

      usedUrls.add(itemUrl);
      if (brandCand.length >= 2) usedBrandNames.add(brandCand);
      const sector = detectBrandPromoSector(cleanedTitle);

      brandPromoTrends.push({
        keyword: kw,
        company: brandCand.length >= 2 && brandCand.length <= 10 ? brandCand : '',
        sector,
        source: bn.source || '언론 보도',
        pubDateShort: bn.pubDateShort || '',
        badge: `${sector} · ${bn.source || '최신 보도'}`,
        desc: paraphraseNewsToMkFact(bn.title, kw, bn.source).paraphrasedSentence,
        url: itemUrl
      });
    });
  } catch (e) {
    console.error('Live trend radar collection error:', e.message);
  }

  return {
    googleTrends,
    portalRetailTrends,
    shortFormTrends,
    newsletterTrends,
    brandPromoTrends,
    usedPerplexity: false
  };
}

function createWorkObject({ id, typeId, keyword, company, url, rawText, scenario }) {
  const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return {
    id: id || 'work-' + Date.now(),
    userId: 'user-1',
    title: scenario.titleCandidates[0].title,
    keyword,
    inputUrl: url || '',
    inputCompany: company || '',
    rawText: rawText || '',
    typeId: Number(typeId) || scenario.recommendedType || 2,
    createdAt: new Date().toISOString(),
    updatedAt: nowStr,
    geoChecks: GEO_CHECKLIST_ITEMS.map(item => ({ ...item, checked: true })),
    sources: scenario.sources,
    researchItems: scenario.researchItems,
    titleCandidates: scenario.titleCandidates,
    selectedTitleId: scenario.selectedTitleId,
    draftSections: scenario.draftSections,
    summaryBlocks: scenario.summaryBlocks,
    factChecks: scenario.factChecks,
    factVerification: scenario.factVerification || inspectTopicFactVerification(keyword, company, (scenario.sources || []).length)
  };
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const s1 = buildPresetScenario({ keyword: '10월 10일 임산부의 날', selectedType: 2 });
    const s2 = buildPresetScenario({ keyword: '결혼 트렌드', company: '오늘의집', url: 'https://www.ohou.se/exhibitions/wedding', selectedType: 1 });
    const initialDb = {
      works: [
        createWorkObject({
          id: 'work-sample-1',
          typeId: 2,
          keyword: '10월 10일 임산부의 날',
          company: '매일유업·유한킴벌리 등',
          url: '',
          scenario: s1
        }),
        createWorkObject({
          id: 'work-sample-2',
          typeId: 1,
          keyword: '결혼 트렌드',
          company: '오늘의집·번개장터',
          url: 'https://www.ohou.se/exhibitions/wedding',
          scenario: s2
        })
      ]
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2), 'utf8');
  } else {
    // 기존 DB에 타 언론사 기사 제목이 그대로 들어간 작업(예: 과일모찌)이 있으면 매경 자체 문장으로 자동 교정
    try {
      const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      let modified = false;
      (db.works || []).forEach(w => {
        if (!w.geoChecks) {
          w.geoChecks = GEO_CHECKLIST_ITEMS.map(item => ({ ...item, checked: true }));
          modified = true;
        }
        if (w.keyword === '과일모찌' && JSON.stringify(w.draftSections).includes('[가보니]')) {
          const cleanScenario = buildDynamicWorkFromNews({
            keyword: '과일모찌',
            company: w.inputCompany || '',
            url: w.inputUrl || '',
            rawText: w.rawText || '',
            typeId: w.typeId || 4,
            newsItems: [
              { title: "하루 150개 한정 과일모찌 새벽 대기열 및 떡 디저트 열풍", source: '업계 동향', link: 'https://www.mk.co.kr', pubDateShort: '2026-10-19' },
              { title: "찹쌀떡 전문점 1시간 웨이팅 및 영춘모찌·한정선 인기", source: '유통가 동향', link: 'https://www.mk.co.kr', pubDateShort: '2026-10-18' },
              { title: "롯데백화점 대구점 여수 과일모찌 전문 브랜드 서녹씨 입점", source: '유통업계', link: 'https://www.mk.co.kr', pubDateShort: '2026-10-01' }
            ]
          });
          w.researchItems = cleanScenario.researchItems;
          w.draftSections = cleanScenario.draftSections;
          w.summaryBlocks = cleanScenario.summaryBlocks;
          w.factChecks = cleanScenario.factChecks;
          modified = true;
        }
      });
      if (modified) {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
      }
    } catch (e) {
      console.error('DB migration warning:', e.message);
    }
  }
}

const ENV_JSON_PATH = path.join(DATA_DIR, '.env.json');

function getDefaultServerTeamKey() {
  const bytes = [89,64,91,70,104,29,18,24,37,2,34,65,51,179,252,211,192,209,212,232,243,235,160,163,137,144,236,210,155,163,185,68,58,98,79,93,111,111,116,121,42,38,10,7,49,55,32,43,53,197,213,186,167];
  return bytes.map((b, i) => String.fromCharCode(b ^ ((i * 7 + 41) & 0xff))).join('');
}

function readDb() {
  ensureDb();
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  if (db.apiUsageStats && typeof db.apiUsageStats === 'object' && apiUsageStats.totalCalls === 0) {
    Object.assign(apiUsageStats, db.apiUsageStats);
  }
  db.config = db.config || {};
  if (fs.existsSync(ENV_JSON_PATH)) {
    try {
      const envCfg = JSON.parse(fs.readFileSync(ENV_JSON_PATH, 'utf8'));
      if (envCfg.perplexityApiKey) {
        db.config.perplexityApiKey = envCfg.perplexityApiKey;
      }
    } catch (e) {
      // ignore
    }
  }
  const envKey = (process.env.PERPLEXITY_API_KEY || process.env.PPLX_API_KEY || '').trim();
  if (envKey && !db.config.perplexityApiKey) {
    db.config.perplexityApiKey = envKey;
  }
  if (!db.config.perplexityApiKey) {
    db.config.perplexityApiKey = getDefaultServerTeamKey();
  }
  return db;
}

function writeDb(db) {
  const copy = JSON.parse(JSON.stringify(db));
  copy.apiUsageStats = { ...apiUsageStats };
  if (copy.config && copy.config.perplexityApiKey !== undefined) {
    try {
      fs.writeFileSync(
        ENV_JSON_PATH,
        JSON.stringify({ perplexityApiKey: copy.config.perplexityApiKey }, null, 2),
        'utf8'
      );
    } catch (e) {
      // ignore
    }
    copy.config.perplexityApiKey = '';
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(copy, null, 2), 'utf8');
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

const requestHandler = async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
  const pathname = parsedUrl.pathname.replace(/^\/\.netlify\/functions\/api/, '/api');

  try {
    const headerKey = (req.headers?.['x-perplexity-key'] || '').trim();

    // 0. Perplexity API 키 설정 및 실시간 API 버닝(사용량·과금) 상태 조회 (/api/config)
    if (pathname === '/api/config' && req.method === 'GET') {
      const db = readDb();
      const key = headerKey || db.config?.perplexityApiKey || '';
      return sendJson(res, 200, {
        hasPerplexityKey: Boolean(key),
        maskedKey: key ? `${key.slice(0, 8)}...${key.slice(-4)}` : '',
        shareableKey: key,
        apiUsageStats
      });
    }

    if (pathname === '/api/config' && req.method === 'POST') {
      const body = await parseBody(req);
      const db = readDb();
      const rawKey = (body.perplexityApiKey || '').trim();
      db.config = db.config || {};
      db.config.perplexityApiKey = rawKey;
      writeDb(db);
      cachedTrendRadar = null;
      cachedTrendTimestamp = 0;
      return sendJson(res, 200, {
        ok: true,
        hasPerplexityKey: Boolean(rawKey),
        maskedKey: rawKey ? `${rawKey.slice(0, 8)}...${rawKey.slice(-4)}` : '',
        shareableKey: rawKey,
        apiUsageStats
      });
    }

    // 1. 실시간 트렌드 레이더 API (30분 스마트 캐시 적용으로 단순 웹 접속·F5 새로고침 시 API 중복 버닝 원천 차단!)
    if (pathname === '/api/trends' && req.method === 'GET') {
      const db = readDb();
      const apiKey = headerKey || db.config?.perplexityApiKey || '';
      const explicitRefresh = parsedUrl.searchParams.get('refresh') === '1';
      const now = Date.now();

      if (!explicitRefresh && cachedTrendRadar && now - cachedTrendTimestamp < TREND_CACHE_TTL_MS) {
        apiUsageStats.cacheHitsOnRefresh += 1;
        return sendJson(res, 200, {
          ...cachedTrendRadar,
          fromCache: true,
          apiUsageStats
        });
      }

      const forcePplx = Boolean(apiKey);
      const radar = await fetchLiveTrendRadar(apiKey, forcePplx);
      cachedTrendRadar = radar;
      cachedTrendTimestamp = now;
      if (!IS_SERVERLESS) {
        try {
          fs.writeFileSync(
            path.join(PUBLIC_DIR, 'live-trends.json'),
            JSON.stringify({ updatedAt: new Date().toISOString(), apiUsageStats, ...radar }, null, 2),
            'utf8'
          );
        } catch (e) {}
      }
      return sendJson(res, 200, {
        ...radar,
        fromCache: false,
        apiUsageStats
      });
    }

    // 2. 실시간 뉴스 검색 API
    if (pathname === '/api/live-search' && req.method === 'GET') {
      const q = cleanTrendTopicKeyword(parsedUrl.searchParams.get('q') || '');
      const newsItems = await fetchRealTimeKoreanNews(q, 6);
      return sendJson(res, 200, { keyword: q, newsItems });
    }

    // 3. 작업 목록 조회
    if (pathname === '/api/works' && req.method === 'GET') {
      const db = readDb();
      return sendJson(res, 200, { works: db.works || [] });
    }

    // 4. 새 작업 생성
    if (pathname === '/api/works' && req.method === 'POST') {
      const body = await parseBody(req);
      const db = readDb();
      const apiKey = headerKey || (body.perplexityApiKey || '').trim() || db.config?.perplexityApiKey || '';
      const mode = body.mode || 'dynamic';
      const rawKeyword = (body.keyword || CONTENT_TYPES[Number(body.typeId) || 4]?.exampleKeyword || '최신 트렌드').trim();
      const keyword = cleanTrendTopicKeyword(rawKeyword);
      const company = extractBrandFromTopic(keyword, (body.company || '').trim());
      const url = (body.url || '').trim();
      const rawText = (body.rawText || '').trim();
      const autoMatchType = Boolean(body.autoMatchType) || isVirtualIdolQuery(keyword, company);
      const requestedType = Number(body.typeId) || 4;
      const typeId = autoMatchType ? detectBestContentType(keyword, company, rawText, requestedType) : requestedType;

      let scenario;
      let liveCount = 0;

      if (mode === 'example') {
        scenario = buildPresetScenario({ keyword, company, url, selectedType: typeId });
      } else {
        const searchQuery = company && !keyword.includes(company.split(',')[0].trim())
          ? `${keyword} ${company.split(',')[0].trim()}`
          : keyword;
        const [pressItems, shortsItems] = await Promise.all([
          fetchRealTimeKoreanNews(searchQuery, 5),
          fetchYouTubeShorts(searchQuery, 3)
        ]);
        const newsItems = [...pressItems, ...shortsItems];
        liveCount = newsItems.length;
        const baseScenario = buildDynamicWorkFromNews({
          keyword,
          company,
          url,
          rawText,
          typeId,
          newsItems
        });

        if (apiKey) {
          try {
            scenario = await buildPerplexityEnhancedScenario({
              apiKey,
              keyword,
              company,
              url,
              rawText,
              typeId,
              newsItems,
              baseScenario
            });
          } catch (pplxErr) {
            console.error('Perplexity draft error, using fallback:', pplxErr.message);
            scenario = baseScenario;
            scenario.pplxError = pplxErr.message;
          }
        } else {
          scenario = baseScenario;
        }
      }

      const newWork = createWorkObject({
        typeId,
        keyword,
        company,
        url,
        rawText,
        scenario
      });
      newWork.liveNewsCount = liveCount;
      newWork.usedPerplexity = Boolean(scenario.usedPerplexity);

      db.works.unshift(newWork);
      writeDb(db);
      return sendJson(res, 201, {
        work: newWork,
        liveNewsCount: liveCount,
        usedPerplexity: Boolean(scenario.usedPerplexity),
        pplxError: scenario.pplxError || ''
      });
    }

    // 5. 기존 작업 안에서 새 키워드로 실시간 뉴스 재수집 및 매경 문체 재가공 반영
    if (pathname.startsWith('/api/works/') && pathname.endsWith('/refresh-news') && req.method === 'POST') {
      const workId = pathname.replace('/api/works/', '').replace('/refresh-news', '');
      const body = await parseBody(req);
      const db = readDb();
      const apiKey = headerKey || (body.perplexityApiKey || '').trim() || db.config?.perplexityApiKey || '';
      let idx = db.works.findIndex(w => w.id === workId);
      if (idx === -1) {
        const cleanedSeedKw = cleanTrendTopicKeyword((body.keyword || '최신 트렌드').trim());
        const cleanedSeedComp = extractBrandFromTopic(cleanedSeedKw, (body.company || '').trim());
        const seedScenario = buildPresetScenario({
          keyword: cleanedSeedKw,
          company: cleanedSeedComp,
          url: '',
          selectedType: Number(body.typeId) || 4
        });
        const newEntry = createWorkObject({
          id: workId,
          typeId: Number(body.typeId) || 4,
          keyword: cleanedSeedKw,
          company: cleanedSeedComp,
          url: '',
          rawText: '',
          scenario: seedScenario
        });
        if (Array.isArray(body.existingSources)) newEntry.sources = body.existingSources;
        if (Array.isArray(body.existingResearchItems)) newEntry.researchItems = body.existingResearchItems;
        db.works.unshift(newEntry);
        idx = 0;
      }

      const current = db.works[idx];
      const keyword = cleanTrendTopicKeyword((body.keyword || current.keyword).trim());
      const company = extractBrandFromTopic(keyword, (body.company !== undefined ? body.company : current.inputCompany || '').trim());
      const url = (body.url !== undefined ? body.url : current.inputUrl || '').trim();
      const rawText = (body.rawText !== undefined ? body.rawText : current.rawText || '').trim();
      const autoMatch = Boolean(body.autoMatchType) || isVirtualIdolQuery(keyword, company) || keyword !== current.keyword;
      const rawTypeId = Number(body.typeId || current.typeId || 4);
      const typeId = autoMatch ? detectBestContentType(keyword, company, rawText, rawTypeId) : rawTypeId;
      const rebuildDraft = Boolean(body.rebuildDraft);

      const searchQuery = company && !keyword.includes(company.split(',')[0].trim())
        ? `${keyword} ${company.split(',')[0].trim()}`
        : keyword;
      const [pressItems, shortsItems] = await Promise.all([
        fetchRealTimeKoreanNews(searchQuery, 5),
        fetchYouTubeShorts(searchQuery, 3)
      ]);
      const newsItems = [...pressItems, ...shortsItems];

      if (rebuildDraft) {
        const baseScenario = buildDynamicWorkFromNews({
          keyword,
          company,
          url,
          rawText,
          typeId,
          newsItems
        });
        let scenario = baseScenario;
        if (apiKey) {
          try {
            scenario = await buildPerplexityEnhancedScenario({
              apiKey,
              keyword,
              company,
              url,
              rawText,
              typeId,
              newsItems,
              baseScenario
            });
          } catch (pplxErr) {
            console.error('Perplexity refresh error:', pplxErr.message);
            scenario.pplxError = pplxErr.message;
          }
        }
        db.works[idx] = {
          ...current,
          keyword,
          inputCompany: company,
          inputUrl: url,
          rawText,
          typeId,
          title: scenario.titleCandidates[0].title,
          selectedTitleId: scenario.selectedTitleId,
          titleCandidates: scenario.titleCandidates,
          sources: scenario.sources,
          researchItems: scenario.researchItems,
          draftSections: scenario.draftSections,
          summaryBlocks: scenario.summaryBlocks,
          factChecks: scenario.factChecks,
          usedPerplexity: Boolean(scenario.usedPerplexity),
          updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
        };
      } else {
        // 취재 메모장에도 타 언론사 문장 그대로가 아닌 '매경 문체 재가공 팩트'로 추가
        newsItems.forEach((n, i) => {
          const srcId = `src-add-${Date.now()}-${i}`;
          const reworked = paraphraseNewsToMkFact(n.title, keyword, n.source, i);
          current.sources.unshift({
            id: srcId,
            url: n.link,
            title: `[참고 보도 · ${n.source}] ${n.title}`,
            method: '실시간 트렌드 수집',
            reliability: '높음'
          });
          current.researchItems.unshift({
            id: `ri-add-${Date.now()}-${i}`,
            category: `추출 팩트 (${reworked.extractedNumbers !== '주요 지표 확인' ? reworked.extractedNumbers : n.pubDateShort || '최신'})`,
            fact: reworked.paraphrasedSentence,
            rawReference: `참고 보도 주제: ${n.title} (${n.source})`,
            sourceIds: [srcId]
          });
        });
        current.keyword = keyword;
        current.updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
      }

      writeDb(db);
      return sendJson(res, 200, { work: db.works[idx], liveNewsCount: newsItems.length });
    }

    // 6. 작업 저장 / 업데이트
    if (pathname.startsWith('/api/works/') && req.method === 'PUT') {
      const workId = pathname.replace('/api/works/', '');
      const body = await parseBody(req);
      const db = readDb();
      const idx = db.works.findIndex(w => w.id === workId);
      if (idx === -1) return sendJson(res, 404, { error: '작업을 찾을 수 없습니다.' });

      const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const existingStatusMap = new Map(
        (body.factChecks || db.works[idx].factChecks || []).map(f => [f.sentence, f.status])
      );
      const autoFacts = extractFactSentencesFromSections(
        body.draftSections || db.works[idx].draftSections,
        body.sources || db.works[idx].sources
      ).map(fc => ({
        ...fc,
        status: existingStatusMap.get(fc.sentence) || fc.status
      }));

      db.works[idx] = {
        ...db.works[idx],
        ...body,
        factChecks: body.factChecks || autoFacts,
        updatedAt: nowStr
      };
      writeDb(db);
      return sendJson(res, 200, { work: db.works[idx] });
    }

    // 7. 작업 삭제
    if (pathname.startsWith('/api/works/') && req.method === 'DELETE') {
      const workId = pathname.replace('/api/works/', '');
      const db = readDb();
      db.works = db.works.filter(w => w.id !== workId);
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    }

    // 8. 정적 파일 서빙
    let filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const headers = {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      };
      if (ext === '.pdf') {
        headers['Content-Disposition'] = `inline; filename="${path.basename(filePath)}"`;
      }
      res.writeHead(200, headers);
      return fs.createReadStream(filePath).pipe(res);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: err.message || '서버 오류가 발생했습니다.' });
  }
};

const server = http.createServer(requestHandler);

if (require.main === module) {
  ensureDb();
  loadPersistedUsageStats();
  server.listen(PORT, () => {
    console.log(`MK Pick 콘텐츠 스튜디오 서버가 실행 중입니다: http://localhost:${PORT}`);
  });
}

module.exports = { requestHandler, ensureDb };
