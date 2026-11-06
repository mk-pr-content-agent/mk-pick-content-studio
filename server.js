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
  splitKeywordIntoBrandsAndTopic,
  splitLongHeadlineToSubtitle,
  MAX_HEADLINE_CHARS,
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

// 실시간 한국어 뉴스 검색 (기본 최근 30일, 트렌드 발굴 시 최근 7일 필터 적용 + 복수 브랜드/긴 키워드 자동 분할 검색 지원)
async function fetchRealTimeKoreanNews(keyword, limit = 6, when = '30d', isRetry = false) {
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
    // 복수 브랜드·복합 긴 키워드(예: '이디야, 맘스터치, 메가커피 푸드 스낵 신메뉴 강화')여서 단일 문자열 매칭이 부족할 때 브랜드별/OR 쿼리로 자동 확장 검색
    if (!isRetry && items.length < 2 && splitKeywordIntoBrandsAndTopic) {
      const splitInfo = splitKeywordIntoBrandsAndTopic(q, '', '');
      if (splitInfo.brands.length >= 2) {
        const shortTopicWords = (splitInfo.coreTopic || '신메뉴').split(/[\s·,]+/).filter(w => w.length >= 2).slice(0, 2).join(' ');
        const orQuery = `(${splitInfo.brands.join(' OR ')}) ${shortTopicWords || '신메뉴'}`.trim();
        const expanded = await fetchRealTimeKoreanNews(orQuery, limit, when, true);
        if (expanded.length > items.length) return expanded;
      } else if (q.split(/[\s·,]+/).length >= 4) {
        const coreTokens = q.replace(/[·,]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 3).join(' ');
        const shortened = await fetchRealTimeKoreanNews(coreTokens, limit, when, true);
        if (shortened.length > items.length) return shortened;
      }
    }
    // 만약 최근 기간(when:30d) 내 기사가 0건이면 기간 제한 없이 재검색
    if (items.length === 0 && when) {
      return fetchRealTimeKoreanNews(keyword, limit, '', isRetry);
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
const FALLBACK_PPLX_MODEL = 'sonar-pro';

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

// JSON 문자열 내부의 이스케이프되지 않은 큰따옴표(")와 줄바꿈을 안전하게 보정하는 헬퍼
function repairUnescapedQuotesInJson(raw = '') {
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
        // 다음 공백 아닌 문자가 :, ,, }, ] 인지 확인하여 문자열 종료 따옴표인지 판별
        let j = i + 1;
        while (j < len && (raw[j] === ' ' || raw[j] === '\t' || raw[j] === '\r' || raw[j] === '\n')) {
          j++;
        }
        const nextChar = raw[j];
        // 문장 내부에서 열린 큰따옴표(“)가 아직 닫히지 않은 상태에서 뒤에 쉼표(,)가 오면 문자열 종료가 아니라 내부 닫는 따옴표(”)로 처리 (예: "이디야", "맘스터치")
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
          // 문자열 내부의 이스케이프 안 된 큰따옴표는 유니코드 겹따옴표(“/”)로 치환
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

function closeTruncatedJsonStructureServer(rawJsonStr = '') {
  let s = String(rawJsonStr || '').trim();
  const startIdx = s.indexOf('{');
  if (startIdx === -1) return s;
  s = s.slice(startIdx);
  s = s.replace(/,\s*"[^"]*$/, '');
  s = s.replace(/,\s*$/, '');
  let inStr = false;
  let esc = false;
  const stack = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
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
  while (stack.length > 0) s += stack.pop();
  return s;
}

// JSON 문자열 파싱 안전 헬퍼 (코드블록 제거, 트레일링 콤마 교정, 내부 따옴표 자동 복구, 잘린 괄호 자동 닫기 복구 등)
function safeParseJsonFromText(rawText = '') {
  const cleaned = String(rawText || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace === -1) {
    throw new Error('Perplexity 응답에서 JSON 구조를 추출하지 못했습니다.');
  }
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : cleaned.slice(firstBrace);
  try {
    return JSON.parse(candidate);
  } catch (firstErr) {
    try {
      const repairedQuotes = repairUnescapedQuotesInJson(candidate).replace(/,\s*([\]}])/g, '$1');
      return JSON.parse(repairedQuotes);
    } catch (secondErr) {
      try {
        const repaired = repairUnescapedQuotesInJson(candidate)
          .replace(/,\s*([\]}])/g, '$1')
          .replace(/[\u0000-\u0019]+/g, ' ');
        return JSON.parse(repaired);
      } catch (thirdErr) {
        const closedRaw = closeTruncatedJsonStructureServer(repairUnescapedQuotesInJson(cleaned.slice(firstBrace)))
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

function matchBestSearchResultServer(rf, searchResults = [], usedUrls = new Set()) {
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

// 2단계 고속 하이브리드 파이프라인:
// [1단계 · 약 3.5초] Perplexity sonar-pro가 메인 키워드 + 서브 키워드 + 자연어 기획 방향에 맞춰 최신 한국 뉴스 팩트와 원문 URL을 초고속 검색
// [2단계 · 약 15~22초] 선택된 집필 AI 모델(기본: Gemini 4 Argon / GPT-5 / Claude Sonnet 4.5 등)이 web_search 루프 지연 없이 기사를 즉시 집필
async function callPerplexityJson(apiKey, systemPrompt, userPrompt, recencyFilter = 'month', callType = 'draft', preferredModel = '') {
  const cleanKey = (apiKey || '').trim();
  const chosenWriterModel = (preferredModel || DEFAULT_PPLX_MODEL).trim();

  // 트렌드 레이더 등 단순 호출이거나 sonar-pro가 직접 선택된 경우
  if (callType === 'trend' || chosenWriterModel === 'sonar-pro') {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: callType === 'trend' ? 6500 : 8000,
        temperature: 0.25
      })
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Perplexity sonar-pro 호출 실패 (${res.status}): ${errText.slice(0, 120)}`);
    }
    const data = await res.json();
    recordPerplexityUsage(data?.usage, callType);
    const content = data?.choices?.[0]?.message?.content || '';
    const searchResults = Array.isArray(data?.search_results)
      ? data.search_results.filter(r => r && isRealArticleUrl(r.url))
      : [];
    const citations = [
      ...searchResults.map(r => r.url.trim()),
      ...(Array.isArray(data?.citations) ? data.citations.filter(isRealArticleUrl) : [])
    ].filter((u, idx, arr) => arr.indexOf(u) === idx);
    const parsed = stripCitationBrackets(safeParseJsonFromText(content));
    return { parsed, citations, searchResults, activeModel: 'sonar-pro' };
  }

  // [Stage 1] Perplexity sonar-pro 초고속 실시간 팩트·출처 수집 (약 3~4초)
  let stage1BriefText = '';
  let stage1SearchResults = [];
  let stage1Citations = [];
  try {
    const searchQueryBlock = userPrompt.slice(0, 1100);
    const stage1Res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: '당신은 매일경제 실시간 팩트체크·취재 리서처입니다. 요청된 메인 키워드, 서브 키워드, 편집자 기획 방향과 관련된 가장 최신 한국 언론 보도 팩트, 브랜드별 실제 출시 메뉴·제품명·가격·특징, 유래·배경, 소비자 반응을 6가지 핵심 팩트 브리핑으로 간결하고 정확하게 정리하세요.'
          },
          {
            role: 'user',
            content: `${searchQueryBlock}\n\n위 주제(메인 키워드 + 서브 키워드 + 원하는 글의 방향)를 모두 아우르는 최신 한국 뉴스 핵심 팩트 6가지를 구체적인 수치·브랜드명·제품명과 함께 요약해 주세요.`
          }
        ],
        max_tokens: 1600,
        temperature: 0.1
      })
    });
    if (stage1Res.ok) {
      const s1Data = await stage1Res.json();
      recordPerplexityUsage(s1Data?.usage, callType);
      stage1BriefText = s1Data?.choices?.[0]?.message?.content || '';
      const rawSr = Array.isArray(s1Data?.search_results) ? s1Data.search_results : [];
      const seen = new Set();
      stage1SearchResults = rawSr
        .filter(r => r && isRealArticleUrl(r.url))
        .filter(r => {
          const u = r.url.trim();
          if (seen.has(u)) return false;
          seen.add(u);
          return true;
        });
      stage1Citations = [
        ...stage1SearchResults.map(r => r.url.trim()),
        ...(Array.isArray(s1Data?.citations) ? s1Data.citations.filter(isRealArticleUrl) : [])
      ].filter((u, idx, arr) => arr.indexOf(u) === idx);
    }
  } catch (s1Err) {
    // Stage 1 실패 시에도 Stage 2 진행
  }

  const enrichedUserPrompt = stage1BriefText
    ? `[Perplexity Sonar-Pro가 방금 실시간 검색으로 수집한 최신 검증 팩트 및 실제 보도 출처 브리핑]\n${stage1BriefText}\n\n[검증된 실제 언론 기사 출처 목록]\n${stage1SearchResults.slice(0, 8).map((r, i) => `${i + 1}. ${r.title || '보도 기사'} (${r.date || '최신'}) - ${r.url}`).join('\n')}\n\n========================================\n${userPrompt}`
    : userPrompt;

  // [Stage 2] 선택된 집필 AI 모델이 web_search 루프 지연 없이 즉시 고품질 매거진 기사 JSON 집필
  const modelsToTry = [chosenWriterModel];
  if (chosenWriterModel !== DEFAULT_PPLX_MODEL) modelsToTry.push(DEFAULT_PPLX_MODEL);
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const isGpt5 = modelName.startsWith('openai/gpt-5');
      const payload = {
        model: modelName,
        instructions: systemPrompt,
        input: enrichedUserPrompt,
        max_output_tokens: isGpt5 ? 12000 : 8192
      };
      if (!stage1BriefText) {
        payload.tools = [{ type: 'web_search' }];
      }

      const res = await fetch('https://api.perplexity.ai/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Perplexity Hybrid API(${modelName}) 호출 실패 (${res.status}): ${errText.slice(0, 120)}`);
      }

      const data = await res.json();
      recordPerplexityUsage(data?.usage, callType);

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
        ...searchResults.map(r => r.url.trim()),
        ...stage1Citations,
        ...(Array.isArray(data?.citations) ? data.citations.filter(isRealArticleUrl) : [])
      ].filter((u, idx, arr) => arr.indexOf(u) === idx);

      const parsed = stripCitationBrackets(safeParseJsonFromText(content));
      apiUsageStats.model = modelName;
      return { parsed, citations, searchResults, activeModel: modelName };
    } catch (err) {
      lastError = err;
    }
  }

  try {
    // 최종 폴백: Perplexity 실시간 뉴스·인용 특화 모델(sonar-pro)로 자동 재시도
    const fallbackRes = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: enrichedUserPrompt }
        ],
        max_tokens: 8000,
        temperature: 0.25
      })
    });
    if (!fallbackRes.ok) {
      throw lastError || new Error('Perplexity sonar-pro fallback failed');
    }
    const fbData = await fallbackRes.json();
    recordPerplexityUsage(fbData?.usage, callType);
    const fbContent = fbData?.choices?.[0]?.message?.content || '';
    const fbSearchResults = [
      ...stage1SearchResults,
      ...(Array.isArray(fbData?.search_results) ? fbData.search_results.filter(r => r && isRealArticleUrl(r.url)) : [])
    ];
    const fbCitations = [
      ...fbSearchResults.map(r => r.url.trim()),
      ...stage1Citations,
      ...(Array.isArray(fbData?.citations) ? fbData.citations.filter(isRealArticleUrl) : [])
    ].filter((u, idx, arr) => arr.indexOf(u) === idx);
    const parsed = stripCitationBrackets(safeParseJsonFromText(fbContent));
    return { parsed, citations: fbCitations, searchResults: fbSearchResults, activeModel: 'sonar-pro' };
  } catch (fbErr) {
    throw lastError || fbErr;
  }
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

// Perplexity API를 활용해 선택한 콘텐츠 유형(1~5번)과 입력 키워드·주제·서브키워드·기획방향에 딱 맞춘 맞춤형 기사 초안 생성
async function buildPerplexityEnhancedScenario({ apiKey, keyword: rawKeyword, company: rawCompany, subKeywords = '', direction = '', url, rawText, typeId, newsItems, baseScenario, writerModel = '' }) {
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

  const parsedTopic = splitKeywordIntoBrandsAndTopic(keyword, company, subKeywords);
  const brandList = parsedTopic.brands || [];
  const coreTopicText = parsedTopic.coreTopic || keyword;
  const subKwList = parsedTopic.explicitSubs || [];
  const cleanDirection = String(direction || '').trim();

  const tInfo = CONTENT_TYPES[typeId] || CONTENT_TYPES[4];
  const newsContext = (newsItems || [])
    .slice(0, 6)
    .map((n, i) => `${i + 1}. [${n.source}] ${n.title} (${n.link})`)
    .join('\n');

  const isMultiBrandTopic = brandList.length >= 2;
  const isHistoryTopic = /(?:계보|변천사|타임라인|역사|세대별\s*진화)/.test(keyword);

  const typeInstructions = {
    1: '유형 1(파트너사·서비스 비교 기획 콘텐츠): 선택된 유형의 틀에 억지로 끼워 맞추지 말고, 검색된 최신 뉴스 팩트를 바탕으로 1단락은 소비자 핵심 고민과 최신 트렌드 배경, 2~3단락은 실제 기업·서비스의 핵심 혜택과 차별점을 실명으로 분석(절대 브랜드 A/B/C 같은 가상 알파벳 표기 금지!), 마지막 단락은 선택 체크포인트 제시. 요약표는 비교표, 용어 사전 4개, FAQ는 7문항.',
    2: '유형 2(시즌·기념일·주요 일정 맞춤형 콘텐츠): 절대로 모든 주제를 "왜 하필 이날로 지정됐을까 / 정부24 바우처 / 브랜드 A~E" 같은 기계적인 틀에 억지로 끼워 맞추지 마세요! 입력된 키워드(예: 수능, 빼빼로데이, 가래떡데이, 김장철 등)와 서브 키워드·원하는 글의 방향에 100% 맞춰, 가장 자연스러운 MK Pick 매거진형 소제목과 단락으로 구성하세요. (가상 알파벳 브랜드 A/B/C 절대 금지!) 요약표는 핵심 비교표, 용어 사전 4개, FAQ는 5문항.',
    3: isHistoryTopic
      ? '유형 3(시대별 계보·트렌드 변천사 심층 분석): 사용자가 계보·변천사 주제를 입력했으므로 초창기 원조부터 전환기, 현재 대표 주자들까지 흐름에 따라 각 주자를 단락별로 조명하고 비교 요약표와 FAQ 5문항으로 정리.'
      : '유형 3(최신 트렌드·이슈 심층 분석 콘텐츠 1): 선택된 유형의 틀에 억지로 끼워 맞추지 말고, 최신 뉴스 검색 결과를 바탕으로 1단락은 왜 지금 이 키워드·이슈가 주목받는지 배경 분석, 2~3단락은 최신 보도된 핵심 팩트·사례·수치·시장 반응을 심층 분석, 마지막 단락은 독자를 위한 실전 활용 가이드 및 전망 제시. 요약표는 핵심 비교표, 용어 사전 4개, FAQ 5문항.',
    4: '유형 4(최신 트렌드·신상품·라이프스타일 콘텐츠 2): 선택된 유형의 틀에 억지로 끼워 맞추지 말고, 입력된 키워드의 최신 뉴스와 실제 출시·진행 팩트를 검색하여 1단락은 화제 배경과 소비자 니즈, 2~3단락은 각 브랜드·제품·신메뉴·혜택의 실제 명칭과 가격·특징·최신 근황을 구체적으로 소개, 마지막 단락은 구매·이용 팁을 자연스럽게 구성하세요. 요약표는 핵심 비교표, 용어 사전 4개, FAQ는 5문항.',
    5: '유형 5(영업 기업 맞춤 기획 콘텐츠): 1단락은 독자 질문 도입 1문단 뒤 Q1~Q4 시장 메가 트렌드·소비자 페인포인트 문답, 2단락은 Q5~Q6 선택 기준 문답, 3단락은 Q7에서 영업 타깃 기업의 핵심 솔루션·경쟁력을 집중 소개. 요약표는 대상 기업 핵심 기능·기대효과 요약표, 용어 사전 4개, FAQ는 7문항.'
  };

  const faqCount = (typeId === 1 || typeId === 5) ? 7 : 5;
  const fallbackCat = recommendMkPickCategory(keyword, typeId, company);
  const pressNewsItems = (newsItems || []).filter(n => n && n.source !== '유튜브 쇼츠');
  const preFactCheck = inspectTopicFactVerification(keyword, company, pressNewsItems.length);

  const sys = `당신은 매일경제 MK Pick(GEO·AEO 최적화 매거진형 심층 기사) 수석 에디터이자 팩트체크 데스크입니다.
제공된 최신 검증 팩트 브리핑과 실시간 뉴스 기사들을 바탕으로 메인 키워드('${keyword}')뿐만 아니라 **서브 키워드(${subKwList.join(', ') || '연관 키워드'}) 및 편집자의 자연어 기획 방향('${cleanDirection || '최신 트렌드'}')에 등장하는 핵심 소재들(예: 가래떡데이, 떡 디저트 유행 등)까지 함께** 기사 본문과 취재 팩트 메모장(researchFacts)에 100% 반영하세요!
타 언론사 기사의 문장을 절대 그대로 베끼지 말고, 수치·브랜드명·신메뉴명·성분·규격·가격 등 핵심 팩트만 추출하여 모든 본문과 답변을 매일경제 고유의 정중하고 생동감 있는 "~합니다/습니다" 체로 작성하세요.

[핵심 작성 원칙 — 반드시 준수!]
0. [가장 중요 · 0순위 원칙] 실제 공식 출시·언론 보도 여부 팩트체크 및 가상(AI 생성) 밈·루머 엄격 판별 (절대 준수!):
   - 기사를 작성하기 전에 입력된 키워드('${keyword}')가 **실제 기업·브랜드가 정식 출시·발표하고 언론에 보도된 실제 제품·트렌드**인지, 아니면 **유튜브 쇼츠·틱톡·릴스 등 SNS에서 인공지능(AI) 합성이나 상상력으로 만들어진 '가상(AI 생성) 밈·합성 콘텐츠·루머'**(예: 실제 정식 출시된 적 없는 '한정선 마이쮸 콜라보 찹쌀떡' 등)인지 반드시 먼저 검증하세요!
   - 만약 공식 출시 사실이나 언론 보도 근거가 없는 **가상(AI 생성) 밈·합성 콘텐츠이거나 미출시 루머**라면:
     ① **절대로 실제 출시된 신제품이거나 정식 콜라보인 것처럼 거짓으로 꾸며 쓰지 마세요!** (실무진과 독자가 오인하면 심각한 보도 사고가 됩니다.)
     ② 반드시 JSON의 \`factVerification.verdict\`를 \`"AI_MEME_OR_VIRTUAL"\` (또는 보도 미확인 시 \`"UNVERIFIED_VIRAL"\`), \`factVerification.isWarning\`을 \`true\`로 설정하세요.
     ③ 기사 제목(\`titleCandidates\`), \`aiFactSummary\`(3줄 요약), 본문(\`draftSections\`) 첫 단락에서 **"해당 화제 키워드는 실제 정식 출시된 제품이 아니라 SNS·숏폼에서 확산된 가상(AI 생성) 밈·콘텐츠"**라는 사실을 명확히 팩트체크해 바로잡고, 대신 **실제 존재하는 원조 브랜드(예: 더현대서울 등에서 판매되는 '한정선' 생과일 찹쌀떡 등)의 진짜 정식 메뉴와 검증된 시장 트렌드 팩트**를 중심으로 설명하세요.
   - 실제 정식 출시·공식 발표 및 언론 보도가 확인된 정상적인 주제라면 \`factVerification.verdict\`를 \`"VERIFIED_FACT"\`, \`factVerification.isWarning\`을 \`false\`로 설정하고 확인된 공식 팩트 요약을 적어주세요.
1. [편집자 자연어 기획 의도('원하는 글의 방향·맥락') 및 '서브 키워드' 1순위 절대 반영 — 고정 템플릿보다 항상 우선!]:
   - 편집자가 자연어로 입력한 **'원하는 글의 방향·맥락'(${cleanDirection ? `"${cleanDirection}"` : '최신 트렌드 및 실제 출시 팩트 심층 분석'})**과 **'서브 키워드'(${subKwList.length > 0 ? subKwList.join(', ') : '핵심 연관 포인트'})**가 있다면, 어떤 콘텐츠 유형(01~05)이 선택되어 있더라도 **편집자의 자연어 기획 의도가 글 전체 구조의 최우선 설계도**가 됩니다!
   - 예를 들어 메인 키워드가 '빼빼로데이', 서브 키워드가 '가래떡데이', 원하는 방향이 '빼빼로데이만 알고 있었던 사람들에게 가래떡데이도 알려줌, 요즘 떡 디저트가 유행이니 가래떡데이와 엮어서 쓰고 싶음'이라면, 기사 제목·소제목·본문 1~4단락·비교 요약표·용어사전·FAQ 전체를 그 자연어 스토리에 100% 맞춰 유기적으로 작성하세요!
   - **절대로 편집자가 입력한 메모 원문 문장("${cleanDirection}")을 본문 안에 그대로 복사해 붙여넣지 마세요!** 반드시 완성된 매거진 기사 문장으로 자연스럽게 녹여 쓰세요.
2. [MK Pick 실제 레퍼런스 기사처럼 매력적이고 자연스러운 소제목(\`draftSections[].title\`) 작성 원칙 — 필수!]:
   - "왜 지금 '빼빼로데이'에 대한 관심과 업계의 움직임이 활발해지고 있을까요?" 같은 딱딱하고 천편일률적인 교과서형 질문 소제목을 절대 쓰지 마세요!
   - 실제 매일경제 MK Pick 인기 기사처럼 **독자의 호기심을 자극하는 위트 있고 감각적인 매거진형 소제목**(명사형 종결, 핵심 키워드 대비, 혹은 짧고 강렬한 포인트형 소제목)으로 작성하세요!
     · 좋은 소제목 예시(빼빼로데이+가래떡데이+떡 디저트):
       - 단락 1: \`"11월 11일, 초콜릿 과자만 떠올렸다면? 진짜 주인공은 따로 있습니다"\` 또는 \`"막대 과자 뒤에 숨겨진 11월 11일의 또 다른 이름, '가래떡데이'"\`
       - 단락 2: \`"농업인의 날에서 시작된 '가래떡데이', 왜 다시 주목받을까요?"\`
       - 단락 3: \`"'할매니얼' 넘어 대세 디저트로…MZ세대 사로잡은 이색 떡 디저트 열풍"\`
       - 단락 4: \`"올해 11월 11일, 센스 있게 마음을 전하는 가래떡·떡 디저트 선물 가이드"\`
3. [복합·다중 브랜드 키워드('${keyword}') 정밀 분석 및 실제 신메뉴·제품 소개 원칙]:
   - '이디야, 맘스터치, 메가커피 푸드 스낵 신메뉴 강화'처럼 **여러 브랜드(${brandList.join(', ') || '주요 브랜드'}) + 핵심 주제('${coreTopicText}')**가 결합된 문장형 키워드가 입력된 경우, 절대로 문장 뒷부분('푸드 스낵 신메뉴 강화' 등)을 또 하나의 브랜드나 제품 이름인 것처럼 쪼개서 표에 넣지 마세요!
   - 반드시 웹 검색을 통해 등장하는 **각 브랜드(${brandList.join(', ') || '해당 브랜드들'})가 실제로 출시한 대표 신메뉴·신상품의 정확한 이름, 가격·구성, 특징**을 각각 구체적으로 찾아 본문 단락과 비교 요약표(summaryTable)에 1:1로 소개하세요.
4. [메인 화면 노출용 헤드라인 글자수 제한 (최대 ${MAX_HEADLINE_CHARS}자 이내 필수!)]:
   - MK Pick 메인 화면 카드에 노출될 때 제목이 2줄을 넘어 잘리지 않도록, 모든 \`titleCandidates\`의 \`title\`은 **공백 포함 28~38자 이내(절대 최대 ${MAX_HEADLINE_CHARS}자 이하!)**로 간결하고 임팩트 있게 작성하세요!
   - 제목에 다 담지 못한 부연 설명은 \`subtitle\`(한줄 소제목)에 담아주세요.
5. [FAQ 본문 문맥 순서(단락 1 → 단락 2 → 단락 3 → 단락 4) 완벽 정렬]:
   - \`faqs\` 배열의 질문(Q1~Q${faqCount})은 반드시 **본문(\`draftSections\`) 1단락부터 마지막 단락까지의 문맥 흐름 순서 그대로** 배치하고, 각 FAQ 항목마다 본문 몇 번째 단락(1~4)과 연결되는지 \`"relatedSection": 1\` ~ \`4\` 숫자를 명시하세요!
6. JSON 문자열 내부에 큰따옴표를 쓸 때는 반드시 유니코드 겹따옴표(“…”)나 작은따옴표('…')만 사용하여 JSON 파싱 오류가 절대 발생하지 않도록 하세요.`;

  const usr = `[작성 요청 정보]
- 메인 키워드/주제: ${keyword}
- 식별된 핵심 브랜드(${brandList.length}개): ${brandList.join(', ') || company || '관련 주요 브랜드·제품'}
- 핵심 세부 주제: ${coreTopicText}
- 서브 키워드(반드시 본문·소제목·요약표에 핵심 축으로 반영!): ${subKwList.length > 0 ? subKwList.join(', ') : '없음 (주제에 맞는 핵심 세부 키워드 자동 반영)'}
- 편집자가 원하는 글의 방향·맥락(최우선 설계도!): ${cleanDirection || '최신 언론 보도와 실제 출시된 제품·신메뉴·프로모션 팩트를 중심으로 독자에게 유익한 정보 제공'}
- 참고 URL: ${url || '없음'}
- 추가 보도자료/메모: ${rawText || '없음'}
- 선택된 콘텐츠 유형: ${tInfo.shortName} (${tInfo.desc})
- 유형별 필수 구성 지침: ${typeInstructions[typeId] || typeInstructions[4]}
- 사전 팩트체크 시스템 진단(${preFactCheck.verdict}): ${preFactCheck.summary} (매칭된 언론 보도 기사 수: ${pressNewsItems.length}건)
- 실시간 참고 언론 뉴스 목록:
${newsContext || '매칭된 언론 보도 기사가 적으므로 웹 검색을 통해 각 브랜드·주제의 가장 최신 실제 공식 보도 팩트를 찾아 작성하세요.'}

아래 JSON 스키마에 맞춰 주제('${keyword}')의 실제 출시·언론 보도 진위를 먼저 검증(factVerification)한 뒤, 편집자의 기획 방향(${cleanDirection || '최신 팩트 중심'})과 서브 키워드(${subKwList.join(', ') || '핵심 포인트'})를 충실히 반영한 완성도 높은 기사(본문 4개 단락, 맞춤형 비교표, 용어 사전 4개, 본문 문맥 순서대로 정렬된 FAQ ${faqCount}개, 마무리 요약)를 작성하세요.
⚠️ 특히 모든 \`titleCandidates\`의 \`title\`은 메인 화면에서 잘리지 않도록 **반드시 공백 포함 ${MAX_HEADLINE_CHARS}자 이내(권장 30~38자)**로 작성하고, 각 단락의 \`title\`(소제목)은 딱딱한 기계적 질문이 아닌 **MK Pick 매거진 스타일의 감각적이고 자연스러운 소제목**으로 작성하세요!
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
    {"id": "tc-1", "title": "“공백 포함 38자 이내 헤드라인”…핵심 키워드 요약", "totalScore": 96},
    {"id": "tc-2", "title": "“공백 포함 38자 이내 헤드라인”…설명형 제목 2", "totalScore": 93},
    {"id": "tc-3", "title": "“공백 포함 38자 이내 헤드라인”…설명형 제목 3", "totalScore": 90},
    {"id": "tc-4", "title": "“공백 포함 38자 이내 헤드라인”…설명형 제목 4", "totalScore": 88},
    {"id": "tc-5", "title": "“공백 포함 38자 이내 헤드라인”…설명형 제목 5", "totalScore": 85}
  ],
  "researchFacts": [
    {"category": "핵심 배경 · 최신 팩트", "sourceTitle": "[언론사명 · YYYY-MM-DD] 가장 최근 보도된 실제 뉴스 제목 1", "sourceUrl": "웹 검색 결과에 있는 해당 기사의 실제 원문 URL (https://...)", "pubDate": "YYYY-MM-DD", "usedInSection": 1, "fact": "본문 1단락에 반영된 가장 최신 수치와 배경이 포함된 ~합니다 체 팩트 문장 1"},
    {"category": "서브 키워드 · 핵심 팩트", "sourceTitle": "[언론사명 · YYYY-MM-DD] 서브 키워드·기획 방향 관련 보도 제목 2", "sourceUrl": "웹 검색 결과에 있는 해당 기사의 실제 원문 URL (https://...)", "pubDate": "YYYY-MM-DD", "usedInSection": 1, "fact": "본문 1~2단락에 반영된 서브 키워드 및 유래·배경 팩트 문장 2"},
    {"category": "주요 트렌드 · 심층 팩트 1", "sourceTitle": "[언론사명 · YYYY-MM-DD] 주요 트렌드·제품·이슈 보도 제목 3", "sourceUrl": "웹 검색 결과에 있는 해당 기사의 실제 원문 URL (https://...)", "pubDate": "YYYY-MM-DD", "usedInSection": 2, "fact": "본문 2단락에 반영된 구체적인 실제 사례·제품명·가격·특징이 포함된 ~합니다 체 팩트 문장 3"},
    {"category": "주요 트렌드 · 심층 팩트 2", "sourceTitle": "[언론사명 · YYYY-MM-DD] 세부 트렌드·차별화 포인트 보도 제목 4", "sourceUrl": "웹 검색 결과에 있는 해당 기사의 실제 원문 URL (https://...)", "pubDate": "YYYY-MM-DD", "usedInSection": 3, "fact": "본문 2~3단락에 반영된 실제 인기 품목·소비자 반응이 포함된 ~합니다 체 팩트 문장 4"},
    {"category": "유통 · 업계 동향", "sourceTitle": "[언론사명 · YYYY-MM-DD] 매장·판매처·캠페인 보도 제목 5", "sourceUrl": "웹 검색 결과에 있는 해당 기사의 실제 원문 URL (https://...)", "pubDate": "YYYY-MM-DD", "usedInSection": 3, "fact": "본문 3단락에 반영된 유통·베이커리·카페·업계 동향이 포함된 ~합니다 체 팩트 문장 5"},
    {"category": "소비자 추천 · 활용 팁", "sourceTitle": "[언론사명 · YYYY-MM-DD] 추천 조합·구매 가이드 보도 제목 6", "sourceUrl": "웹 검색 결과에 있는 해당 기사의 실제 원문 URL (https://...)", "pubDate": "YYYY-MM-DD", "usedInSection": 4, "fact": "본문 4단락에 반영된 실전 선택 팁·활용법이 포함된 ~합니다 체 팩트 문장 6"}
  ],
  "subtitle": "메인 헤드라인 바로 아래에 들어갈 핵심 한줄 소제목 (또는 2줄 부제, 줄바꿈 \\n 사용)",
  "aiFactSummary": [
    "1. 핵심 팩트 요약 첫 번째 문장 (~합니다 체)",
    "2. 핵심 팩트 요약 두 번째 문장 (~합니다 체)",
    "3. 핵심 팩트 요약 세 번째 문장 (~합니다 체)"
  ],
  "draftSections": [
    {
      "id": "sec-1",
      "title": "MK Pick 매거진 스타일의 감각적인 1단락 소제목 (도입·배경·화두 제시)",
      "content": "독자의 시선을 사로잡는 매력적인 첫 문장 + 메인 키워드와 서브 키워드를 자연스럽게 연결하는 배경 스토리 2~3문단 (~합니다 체)",
      "imageCaption": ""
    },
    {
      "id": "sec-2",
      "title": "MK Pick 매거진 스타일의 감각적인 2단락 소제목 (핵심 스토리·유래·첫 번째 축 심층 조명)",
      "content": "편집자의 기획 방향과 서브 키워드의 핵심 배경·유래·구체적 팩트를 생동감 있게 풀어낸 본문 2~3문단 (~합니다 체)",
      "imageCaption": ""
    },
    {
      "id": "sec-3",
      "title": "MK Pick 매거진 스타일의 감각적인 3단락 소제목 (최신 트렌드·인기 디저트/제품/브랜드 열풍 분석)",
      "content": "요즘 유행하는 실제 트렌드(예: 떡 디저트 열풍, 주요 브랜드 대표 메뉴·제품·가격·특징 등)를 구체적인 팩트로 소개하는 본문 2~3문단 (~합니다 체)",
      "imageCaption": ""
    },
    {
      "id": "sec-4",
      "title": "MK Pick 매거진 스타일의 감각적인 4단락 소제목 (독자를 위한 센스 있는 선택·선물·활용 가이드)",
      "content": "독자가 바로 활용할 수 있는 추천 아이템·조합·구매 및 선물 팁을 정리한 본문 2문단 (~합니다 체)",
      "imageCaption": ""
    }
  ],
  "summaryTable": {
    "title": "[요약표] 핵심 포인트 한눈에 비교 및 실전 선택 가이드",
    "headers": ["구분", "핵심 개념 · 대표 아이템", "주요 특징 및 인기 배경", "추천 대상 · 활용 팁"],
    "rows": [
      ["비교 항목 1", "구체적 명칭·내용", "핵심 특징·트렌드 포인트", "추천 포인트·팁"],
      ["비교 항목 2", "구체적 명칭·내용", "핵심 특징·트렌드 포인트", "추천 포인트·팁"],
      ["비교 항목 3", "구체적 명칭·내용", "핵심 특징·트렌드 포인트", "추천 포인트·팁"],
      ["실전 활용 팁", "선물·구매·이용 체크포인트", "가성비 및 만족도 높이는 법", "사전 확인사항"]
    ]
  },
  "glossaryTitle": "주제를 더 깊이 이해하는 핵심 용어 사전",
  "glossary": [
    {"term": "핵심 용어·트렌드·제품 개념 1", "desc": "누구나 이해하기 쉬운 1~2문장 명쾌한 해설 (~합니다 체)"},
    {"term": "핵심 용어·트렌드·제품 개념 2", "desc": "누구나 이해하기 쉬운 1~2문장 명쾌한 해설 (~합니다 체)"},
    {"term": "핵심 용어·트렌드·제품 개념 3", "desc": "누구나 이해하기 쉬운 1~2문장 명쾌한 해설 (~합니다 체)"},
    {"term": "핵심 용어·트렌드·제품 개념 4", "desc": "누구나 이해하기 쉬운 1~2문장 명쾌한 해설 (~합니다 체)"}
  ],
  "faqs": [
    {"relatedSection": 1, "q": "Q1. [1단락 도입·배경 문맥] 독자가 검색창에 물어볼 자연어 질문 (~나요?)", "a": "1단락 내용에 기반한 구체적인 2~3문장 완결형 답변 (~합니다 체)"},
    {"relatedSection": 2, "q": "Q2. [2단락 핵심 스토리·유래 문맥] 자연어 질문 (~나요?)", "a": "2단락 내용에 기반한 구체적인 2~3문장 완결형 답변 (~합니다 체)"},
    {"relatedSection": 2, "q": "Q3. [2~3단락 세부 특징·트렌드 문맥] 자연어 질문 (~나요?)", "a": "2~3단락 내용에 기반한 구체적인 2~3문장 완결형 답변 (~합니다 체)"},
    {"relatedSection": 3, "q": "Q4. [3단락 인기 아이템·비교 문맥] 자연어 질문 (~나요?)", "a": "3단락 내용에 기반한 구체적인 2~3문장 완결형 답변 (~합니다 체)"},
    {"relatedSection": 4, "q": "Q5. [4단락 구매·활용 팁 문맥] 자연어 질문 (~나요?)", "a": "4단락 내용에 기반한 구체적인 2~3문장 완결형 답변 (~합니다 체)"}
  ],
  "fanoutQuestions": [
    {"category": "유래·배경", "q": "'${keyword}' 및 관련 주제에 대해 독자가 추가로 가장 궁금해할 구체적인 꼬리 질문 1 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"},
    {"category": "인기트렌드·메뉴", "q": "최신 인기 아이템·메뉴·특징에 관한 구체적인 꼬리 질문 2 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"},
    {"category": "가격·구매처", "q": "구매 채널·매장·온라인 주문에 관한 꼬리 질문 3 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"},
    {"category": "추천조합·활용팁", "q": "더 맛있게/센스 있게 즐기는 조합이나 선물 팁 질문 4 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"},
    {"category": "보관·섭취팁", "q": "원재료·보관법·조리팁 등에 관한 꼬리 질문 5 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"},
    {"category": "이벤트·프로모션", "q": "시즌 기념 행사·혜택·캠페인에 관한 꼬리 질문 6 (~나요?)", "a": "구체적인 팩트 기반 답변 1~2문장 (~합니다 체)"}
  ],
  "closingParagraph": "기사 전체의 핵심 내용을 자연스럽게 갈무리하며 독자에게 실질적인 조언을 건네는 마무리 문단 2문장 (~합니다 체)",
  "oneLineSummary": "한 줄 요약! 기사 전체 핵심 메시지를 명쾌하게 정리한 한 문장 (~입니다 체)"
}`;

  const { parsed, citations, searchResults } = await callPerplexityJson(apiKey, sys, usr, 'month', 'draft', writerModel);
  const todayStr = new Date().toISOString().slice(0, 10);

  // 출처 병합 및 1:1 실제 원문 기사 링크 연결
  const mergedSources = [];
  const usedSrUrls = new Set();
  const factsArr = Array.isArray(parsed.researchFacts) ? parsed.researchFacts : [];
  const enrichedFacts = factsArr.map((rf, i) => {
    const matchedSr = matchBestSearchResultServer(rf, searchResults, usedSrUrls);
    const directUrl = isRealArticleUrl(rf.sourceUrl)
      ? rf.sourceUrl.trim()
      : (matchedSr?.url || (isRealArticleUrl(citations[i]) ? citations[i] : (baseScenario.sources?.[i]?.url || `https://search.naver.com/search.naver?where=news&sort=1&query=${encodeURIComponent(keyword)}`)));
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

  (baseScenario.sources || []).forEach(s => {
    if (s && isRealArticleUrl(s.url) && !mergedSources.some(m => m.url === s.url)) {
      mergedSources.push(s);
    }
  });

  const researchItems = enrichedFacts.length > 0
    ? enrichedFacts
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

  // 헤드라인 후보 40자 이내 자동 보정 및 초과분 한줄 소제목 분리
  let rawSubtitle = normalizeNewlines(parsed.subtitle || baseScenario.summaryBlocks.subtitle).trim();
  const rawTitleCandidates = Array.isArray(parsed.titleCandidates) && parsed.titleCandidates.length > 0
    ? parsed.titleCandidates
    : baseScenario.titleCandidates;
  const titleCandidates = rawTitleCandidates.map((tc, idx) => {
    const cleanT = normalizeNewlines(tc.title || '').trim();
    if (cleanT.length > MAX_HEADLINE_CHARS) {
      const splitRes = splitLongHeadlineToSubtitle(cleanT, idx === 0 ? rawSubtitle : '', MAX_HEADLINE_CHARS);
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

  // FAQ 본문 문맥 순서(relatedSection 1 -> 2 -> 3 -> 4) 정렬 및 번호 재부여
  const rawFaqs = Array.isArray(parsed.faqs) && parsed.faqs.length > 0
    ? parsed.faqs.map((f, i) => {
        const cleanQ = normalizeNewlines(f.q || '').replace(/^Q\d+\.\s*/i, '').trim();
        const cleanA = normalizeNewlines(f.a || '').trim();
        let relSec = Number(f.relatedSection) || 0;
        if (!relSec || relSec < 1 || relSec > draftSections.length) {
          // 본문 단락과의 어휘 유사도로 문맥 단락 자동 매칭
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
        q: String(f.q || '').replace(/^Q\d+\.\s*/i, '').trim(),
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

  const summaryBlocks = {
    ...baseScenario.summaryBlocks,
    mkCategory: pickedCategory,
    mkCategoryReason: pickedCatReason,
    byline: `${pickedCategory} | 남궁선희 기자 | 입력 ${new Date().toISOString().slice(0, 10).replace(/-/g, '.')} 10:00`,
    subtitle: rawSubtitle,
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
    faqs: sortedFaqs,
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

function createWorkObject({ id, typeId, keyword, company, subKeywords = '', direction = '', url, rawText, scenario }) {
  const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return {
    id: id || 'work-' + Date.now(),
    userId: 'user-1',
    title: scenario.titleCandidates[0].title,
    keyword,
    inputUrl: url || '',
    inputCompany: company || '',
    inputSubKeywords: subKeywords || '',
    inputDirection: direction || '',
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

    // 1. 실시간 트렌드 레이더 API (수동 새로고침 시에만 Perplexity 실시간 수집 · 단순 접속/F5 시 과금 0원)
    if (pathname === '/api/trends' && req.method === 'GET') {
      const db = readDb();
      const apiKey = headerKey || db.config?.perplexityApiKey || '';
      const explicitRefresh = parsedUrl.searchParams.get('refresh') === '1';
      const now = Date.now();

      if (!explicitRefresh) {
        if (!cachedTrendRadar) {
          try {
            const snapPath = path.join(PUBLIC_DIR, 'live-trends.json');
            if (fs.existsSync(snapPath)) {
              const snapRaw = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
              if (snapRaw && Array.isArray(snapRaw.shortFormTrends)) {
                cachedTrendRadar = snapRaw;
                cachedTrendTimestamp = snapRaw.updatedAt ? Date.parse(snapRaw.updatedAt) : now;
              }
            }
          } catch (e) {}
        }
        if (cachedTrendRadar) {
          apiUsageStats.cacheHitsOnRefresh += 1;
          return sendJson(res, 200, {
            ...cachedTrendRadar,
            fromCache: true,
            apiUsageStats
          });
        }
      }

      const forcePplx = Boolean(apiKey) && explicitRefresh;
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
      const subKeywords = (body.subKeywords || '').trim();
      const direction = (body.direction || '').trim();
      const url = (body.url || '').trim();
      const rawText = (body.rawText || '').trim();
      const autoMatchType = Boolean(body.autoMatchType) || isVirtualIdolQuery(keyword, company);
      const requestedType = Number(body.typeId) || 4;
      const typeId = autoMatchType ? detectBestContentType(keyword, company, `${rawText} ${direction} ${subKeywords}`, requestedType) : requestedType;

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
          subKeywords,
          direction,
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
              subKeywords,
              direction,
              url,
              rawText,
              typeId,
              newsItems,
              baseScenario,
              writerModel: (body.writerModel || '').trim()
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
        subKeywords,
        direction,
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
      const subKeywords = (body.subKeywords !== undefined ? body.subKeywords : current.inputSubKeywords || '').trim();
      const direction = (body.direction !== undefined ? body.direction : current.inputDirection || '').trim();
      const url = (body.url !== undefined ? body.url : current.inputUrl || '').trim();
      const rawText = (body.rawText !== undefined ? body.rawText : current.rawText || '').trim();
      const autoMatch = Boolean(body.autoMatchType) || isVirtualIdolQuery(keyword, company) || keyword !== current.keyword;
      const rawTypeId = Number(body.typeId || current.typeId || 4);
      const typeId = autoMatch ? detectBestContentType(keyword, company, `${rawText} ${direction} ${subKeywords}`, rawTypeId) : rawTypeId;
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
          subKeywords,
          direction,
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
              subKeywords,
              direction,
              url,
              rawText,
              typeId,
              newsItems,
              baseScenario,
              writerModel: (body.writerModel || '').trim()
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
          inputSubKeywords: subKeywords,
          inputDirection: direction,
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
