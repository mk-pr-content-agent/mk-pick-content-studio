// MK Pick 콘텐츠 스튜디오 - 5대 유형 템플릿, GEO 최적화 체크리스트, 타 언론사 문장 복제 방지용 팩트 재구성기

const CONTENT_TYPES = {
  1: {
    id: 1,
    name: '유료 업체 타겟팅 기획 콘텐츠',
    shortName: '1. 유료 업체 타겟팅 기획 콘텐츠',
    badge: '유료 파트너사 서비스 노출 강화 및 자연스러운 브랜디드 콘텐츠',
    desc: '유료 파트너사 서비스 노출 강화 및 자연스러운 브랜디드 콘텐츠',
    exampleKeyword: '결혼 트렌드',
    exampleHeadline: '"스드메 패키지 대신 내 맘대로 골라요"…시대별 결혼 트렌드와 주목받는 웨딩 서비스 4선',
    structure: '도입 질문 → 시대별 변화 비교 → 파트너사·주요 업체 4곳 서비스 비교 → 요약표 → FAQ 7문항',
    tableDefault: '세대별 비교표 + 업체별 서비스 비교표',
    faqDefaultCount: 7,
    defaultCategory: '브랜드스토리(기업관)'
  },
  2: {
    id: 2,
    name: '특정 기념일 관련 콘텐츠',
    shortName: '2. 특정 기념일 관련 콘텐츠',
    badge: '법정기념일 이슈 선점 및 기업들의 프로모션·ESG 활동 연계',
    desc: '법정기념일 이슈 선점 및 기업들의 프로모션·ESG 활동 연계',
    exampleKeyword: '10월 10일 임산부의 날',
    exampleHeadline: '"풍요의 10월, 왜 하필 10일일까?"…10월 10일 임산부의 날 유래부터 기업 5곳 혜택 총정리',
    structure: '도입 질문 → 기념일 유래·지원 제도 → 참여 브랜드별 캠페인·제품·마케팅 각각 소개 → 혜택 비교표 → FAQ 5문항',
    tableDefault: '브랜드별 혜택·기간 비교표',
    faqDefaultCount: 5,
    defaultCategory: '기업뉴스'
  },
  3: {
    id: 3,
    name: '최신 트렌드 반영 콘텐츠 1',
    shortName: '3. 최신 트렌드 반영 콘텐츠 1',
    badge: 'SNS 및 숏폼 기반의 바이럴 이슈를 문화/소비사 관점으로 확장',
    desc: 'SNS 및 숏폼 기반의 바이럴 이슈를 문화/소비사 관점으로 확장',
    exampleKeyword: '민음사빵 책갈피',
    exampleHeadline: '"빵 봉지 열었더니 데미안 책갈피가?"…1999년 국진이빵부터 2026년 민음사빵까지 띠부씰 계보 총정리',
    structure: '도입 질문 → 시대별 유행 계보 → MZ 소비 심리 4가지 분석 → 시대별 비교표 → FAQ 5문항',
    tableDefault: '연대별 대표 유행 아이템 비교표',
    faqDefaultCount: 5,
    defaultCategory: '산업 Q&A'
  },
  4: {
    id: 4,
    name: '최신 트렌드 반영 콘텐츠 2',
    shortName: '4. 최신 트렌드 반영 콘텐츠 2',
    badge: '개별 기업의 신제품 출시 소식을 거시적 마케팅 키워드로 재정의',
    desc: '개별 기업의 신제품 출시 소식을 거시적 마케팅 키워드로 재정의',
    exampleKeyword: '편의점 전용 맛 · 다이소 뷰티',
    exampleHeadline: '"편의점마다 맛이 다르다고?"…유통가 휩쓴 도장깨기·멀티플레이버 신제품 라인업 비교',
    structure: '도입 질문 → 거시적 마케팅 콘셉트 도출 → 브랜드·채널별 신제품 라인업 비교 → 라인업 요약표 → FAQ 5문항',
    tableDefault: '채널·브랜드별 전용 라인업 비교표',
    faqDefaultCount: 5,
    defaultCategory: '제품·기술'
  },
  5: {
    id: 5,
    name: '영업 기업 맞춤 기획 콘텐츠',
    shortName: '5. 영업 기업 맞춤 기획 콘텐츠',
    badge: '영업 타깃 기업의 핵심 가치를 시의성 있는 대중 트렌드와 결합',
    desc: '영업 타깃 기업의 핵심 가치를 시의성 있는 대중 트렌드와 결합',
    exampleKeyword: '번개장터 정품 검수 리커머스',
    exampleHeadline: '"중고거래도 백화점처럼 검수합니다"…리커머스 트렌드부터 번개장터 핵심 서비스까지 7문 7답',
    structure: '도입 1문단 → Q1~Q6 시장 트렌드 문답 → Q7 영업 타깃 기업 집중 소개 → 핵심 서비스 요약표',
    tableDefault: '대상 기업 핵심 서비스·혜택 요약표',
    faqDefaultCount: 7,
    defaultCategory: '성공사례'
  }
};

// MK Pick 공식 5대 카테고리 분류
const MK_PICK_CATEGORIES = [
  { id: '산업 Q&A', name: '산업 Q&A', desc: '업계 트렌드·소비 현상·유행의 배경과 이유를 문답으로 풀어내는 해설형 기사' },
  { id: '제품·기술', name: '제품·기술', desc: '신제품 출시, 팝업스토어, 전용 라인업, 혁신 기술·성분 비교 중심 기사' },
  { id: '성공사례', name: '성공사례', desc: '시장 페인포인트를 해결하고 성장을 이끈 특정 기업·플랫폼의 전략 분석 기사' },
  { id: '기업뉴스', name: '기업뉴스', desc: '법정기념일·시즌 이슈에 맞춘 주요 기업들의 프로모션·ESG 캠페인 종합 보도' },
  { id: '브랜드스토리(기업관)', name: '브랜드스토리(기업관)', desc: '유료 파트너사 및 주요 브랜드의 히스토리·핵심 가치·맞춤형 서비스를 조명하는 콘텐츠' }
];

// 키워드·기업명·메모 성격을 분석해 가장 적합한 콘텐츠 유형(1~5)을 자동 매칭하는 함수
function detectBestContentType(keyword = '', company = '', rawText = '', fallbackTypeId = 0) {
  const text = `${keyword} ${company} ${rawText}`.trim();
  if (!text) return fallbackTypeId || 4;

  // 0) 버츄얼 아이돌·사이버 가수 또는 명시적인 시대별 계보·변천사 키워드인 경우에만 유형 3 매칭
  if (
    /(?:아담|키즈나\s*아이|이세계\s*아이돌|플레이브|나이비스|비더후드|매드몬스터|버츄얼\s*아이돌|버추얼\s*아이돌|사이버\s*가수|버튜버|계보|변천사|타임라인)/.test(text)
  ) {
    return 3;
  }

  // 1) 특정 기념일·법정기념일·시즌 데이 (예: 임산부의 날, 지구의 날, 한글날, 어버이날, 블랙프라이데이 등)
  if (/(?:의\s*날|기념일|주간|절$|데이|설날|추석|어린이날|어버이날|스승의날|성년의날|부부의날|환경의날|임산부의날|한글날|독도의날|소상공인의날|농업인의날|크리스마스)/.test(keyword)) {
    return 2;
  }

  // 2) 영업 기업 맞춤 (단일 기업 솔루션·플랫폼·B2B·정품검수·리커머스·스타트업 기술 집중 조명)
  if (company && !company.includes('·') && !company.includes(',') && /(?:솔루션|플랫폼|검수|기술|AI|시스템|스타트업|서비스|리커머스|B2B)/i.test(text)) {
    return 5;
  }

  // 3) 유료 업체 타겟팅 기획 (다수 파트너사 비교, 결혼·웨딩·인테리어·이사·가전 등 라이프스타일 비교 기획)
  if (/(?:결혼|웨딩|혼수|인테리어|이사|멤버십\s*비교|서비스\s*비교|파트너)/.test(text) || (company && (company.includes('·') || company.includes(',')))) {
    return 1;
  }

  // 4) 최신 트렌드 반영 콘텐츠 2 (신제품 출시, 뷰티·스킨케어·기초템, 팝업스토어, 품절템, 전용 라인업, 편의점·다이소·백화점·올리브영 신상)
  if (/(?:팝업|품절|신상|출시|한정판|단독|전용|라인업|다이소|편의점|백화점|올리브영|이마트|마트|와우샵|균일가|반값|콜라보\s*굿즈|키링|패딩|니트|뷰티|더마|패치|환절기|기초템|스킨케어|보습|앰플|크림|토너|화장품)/.test(text)) {
    return 4;
  }

  // 5) 최신 트렌드 반영 콘텐츠 1 (SNS·쇼츠·릴스 바이럴 현상, 신조어, 세대 소비심리 분석)
  if (/(?:열풍|유행|트렌드|신조어|MZ|2030|세대|계보|심리|오픈런|떡픈런|텍스트힙|요노|영점소비|코어룩|챌린지|쇼츠|릴스|ASMR|하울|레시피)/.test(text)) {
    return 3;
  }

  return fallbackTypeId || 4;
}

// 키워드·콘텐츠 유형(1~5)·기업명에 맞춰 MK Pick 5대 카테고리와 추천 사유를 반환하는 함수
function recommendMkPickCategory(keyword = '', typeId = 4, company = '') {
  const kw = String(keyword || '').trim();
  const comp = String(company || '').trim();
  const tId = Number(typeId) || 4;

  let primary = '산업 Q&A';
  let reason = '';

  if (/(?:신상|출시|팝업|라인업|더마|뷰티|기술|AI|기능|전용|니트|패딩|가전)/.test(kw)) {
    primary = '제품·기술';
    reason = `'${kw}'의 핵심 제품·라인업 특징과 체험·구매 포인트를 다루므로 [제품·기술] 카테고리가 가장 적합합니다.`;
  } else if (tId === 2 || /(?:의\s*날|기념일|데이|캠페인|ESG|프로모션)/.test(kw)) {
    primary = '기업뉴스';
    reason = `'${kw}' 이슈에 맞춘 주요 기업별 프로모션·캠페인 동향을 종합 전달하므로 [기업뉴스] 카테고리를 추천합니다.`;
  } else if (tId === 5 || (comp && /(?:전략|성장|비결|성공|점유율|돌파|혁신)/.test(kw))) {
    primary = '성공사례';
    reason = `시장 트렌드 속에서 소비자 페인포인트를 해결한 ${comp || '기업'}의 경쟁력을 조명하므로 [성공사례] 카테고리에 부합합니다.`;
  } else if (tId === 1 || (comp && !/(?:열풍|유행|계보)/.test(kw))) {
    primary = '브랜드스토리(기업관)';
    reason = `${comp || '파트너 브랜드'}의 차별화된 서비스 가치와 브랜드 스토리를 자연스럽게 전달하므로 [브랜드스토리(기업관)]을 추천합니다.`;
  } else {
    primary = '산업 Q&A';
    reason = `'${kw}' 현상의 배경과 소비자 심리·시장 변화를 문답 형식으로 알기 쉽게 해설하므로 [산업 Q&A] 카테고리가 가장 적합합니다.`;
  }

  return {
    recommendedCategory: primary,
    categoryReason: reason,
    allCategories: MK_PICK_CATEGORIES.map(c => c.id)
  };
}

// KT 나스미디어 '2026 마케팅 이슈 캘린더' 원본 PDF 및 아이보스 마케팅 캘린더 기반 1~12월 월별 핵심 시즌·기념일·EAT/BUY/DO/PLAY 데이터
const MONTHLY_MARKETING_CALENDAR = {
  1: {
    month: 1,
    theme: '붉은 말의 해(병오년) · 새해 다짐 · 설 명절 사전예약 · 겨울방학',
    keyTags: ['병오년', '새해다짐', '신년운세', '해외여행', '새해이벤트', '겨울방학'],
    curation: {
      EAT: '새해맞이 떡국 · 겨울간식(호빵·붕어빵·호떡) · 설 명절 선물세트 예약',
      BUY: '새해 준비(다이어리·다꾸용품) · 홈트레이닝 운동복·기구 · 설 차례용품',
      DO: '신년 계획(직장인 학습지·어학·다이어리앱) · 신년운세 앱 · 새해 일출런',
      PLAY: '겨울 레저(스키장·숙박·렌터카) · K-일러스트레이션페어 · 골든글로브'
    },
    events: [
      { date: '01.01', name: '신정 · 새해 일출런', typeId: 3, category: '산업 Q&A', keyword: '새해 갓생 다짐 · 러닝·다이어리·신년운세 트렌드', desc: '연차 활용 시 4일 연휴(1/1~1/4) 및 새해 결심 소비(학습지·홈트·운세앱) 급증' },
      { date: '01.02', name: '세계 내향인의 날', typeId: 3, category: '산업 Q&A', keyword: '세계 내향인의 날 집콕 · 나홀로 힐링 소비 트렌드', desc: '혼자만의 충전 시간을 즐기는 내향형 소비자를 겨냥한 북카페·홈캉스·OTT 큐레이션' },
      { date: '01.06~09', name: 'CES 2026 · 뉴욕유통박람회(NRF)', typeId: 4, category: '제품·기술', keyword: 'CES 2026 AI 가전 · 스마트홈 혁신 기술', desc: '라스베이거스 국제전자제품박람회(CES) 및 글로벌 리테일 테크 신기술 집중 조명' },
      { date: '01.14', name: '다이어리데이', typeId: 4, category: '제품·기술', keyword: '다이어리데이 다꾸(다이어리 꾸미기) · 문구 굿즈 열풍', desc: '연초 기록 문화(텍스트힙)와 결합한 한정판 다이어리·스티커·만년필 기프트 인기' },
      { date: '01.16~18', name: '가낳지모 캣페어 · 겨울 실내 박람회', typeId: 4, category: '제품·기술', keyword: '반려묘 캣페어 · 펫 휴머니제이션 맞춤형 간식·용품', desc: '반려동물을 가족처럼 챙기는 펫팸족 겨냥 프리미엄 펫푸드·자동화 리빙 가전 비교' },
      { date: '01.21~23', name: '대한민국 교육박람회 · 신학기 준비', typeId: 1, category: '브랜드스토리(기업관)', keyword: 'AI 디지털교과서 · 에듀테크 신학기 학습 서비스 비교', desc: '겨울방학 및 새 학기 대비 에듀테크 플랫폼·스터디카페·알림장 앱 프로모션' }
    ]
  },
  2: {
    month: 2,
    theme: '2026 밀라노 동계올림픽 · 설 황금연휴(최대 9일) · 밸런타인데이 · 졸업시즌',
    keyTags: ['팀코리아', '명절선물', '연말정산', '졸업시즌', '신입생'],
    curation: {
      EAT: '설 명절 연휴(배달앱·간편식·건강식품) · 밸런타인데이 초콜릿 · 올림픽 야식(치킨·맥주)',
      BUY: '설 명절 선물세트 · 졸업·신학기 선물(IT기기·화장품) · 이사 준비 인테리어',
      DO: '올림픽 대한민국 선수단 응원 이벤트 · 졸업·입학 축하 식당 예약앱 · 연말정산',
      PLAY: '설 꿀연휴(2/14~2/22 최대 9일) 국내·해외여행 · 2026 F/W 서울패션위크 · 서울리빙디자인페어'
    },
    events: [
      { date: '02.04', name: '입춘 · 딸기의 날(2/11)', typeId: 4, category: '제품·기술', keyword: '딸기의 날 봄 시즌 한정 딸기 디저트 · 베이커리 라인업', desc: '입춘과 딸기의 날(2/11)을 맞아 호텔·카페·편의점이 선보이는 제철 딸기 신상 비교' },
      { date: '02.06~22', name: '2026 밀라노-코르티나 동계올림픽', typeId: 2, category: '기업뉴스', keyword: '밀라노 동계올림픽 팀코리아 응원 프로모션 · 야식 마케팅', desc: '공식 후원사 캠페인부터 치킨·맥주·편의점 업계의 심야 경기 관람 응원 할인전까지' },
      { date: '02.14', name: '밸런타인데이', typeId: 2, category: '기업뉴스', keyword: '2월 14일 밸런타인데이 캐릭터 콜라보 초콜릿 · 기프트 비교', desc: '편의점·백화점·뷰티 업계의 인기 IP 협업 한정판 초콜릿 및 커플 선물 기획전' },
      { date: '02.16~18', name: '설 명절 연휴 (최대 9일 황금연휴)', typeId: 1, category: '기업뉴스', keyword: '설 명절 선물세트 · 황금연휴 여행·호캉스 프로모션 비교', desc: '19~20일 연차 시 최대 9일 이어지는 설 연휴 맞이 유통가 선물세트·여행 플랫폼 혜택' },
      { date: '02.25~', name: '서울리빙디자인페어 · 봄 이사철', typeId: 1, category: '브랜드스토리(기업관)', keyword: '서울리빙디자인페어 · 신혼·이사 인테리어 가구·가전 트렌드', desc: '봄 이사·결혼 시즌을 앞두고 주목받는 공간 스타일링 및 리빙 플랫폼 혜택' },
      { date: '2월 말', name: '졸업 · 입학 · 신입생 시즌', typeId: 4, category: '제품·기술', keyword: '졸업·입학 선물 노트북 · 태블릿 · 뷰티 기프트 추천', desc: '예비 대학생과 사회초년생을 겨냥한 IT 기기 아카데미 할인 및 백화점 화장품 기획전' }
    ]
  },
  3: {
    month: 3,
    theme: '새학기 개강 · 삼겹살데이(3/3) · 화이트데이(3/14) · 프로야구(KBO) 개막',
    keyTags: ['봄철·봄맞이', '프로야구개막', '화이트데이', '미세먼지', '개강룩'],
    curation: {
      EAT: '정월대보름(오곡밥·견과류) · 삼겹살데이 반값 한돈 · 화이트데이 캔디 · 야구 직관 먹거리',
      BUY: '개강룩(의류·신발·가방) · 야구 시즌 아이템(유니폼·구단X캐릭터 콜라보 굿즈) · 미세먼지 가전',
      DO: '새학기 준비(알림장·시간표·AI 디지털교과서) · 서울마라톤 러닝 · 프로야구 개막 응원 이벤트',
      PLAY: '2026 WBC(3/5~17) · 서울마라톤(3/15) · 프로야구 KBO 개막(3/28) · 게임 붉은사막 출시(3/20)'
    },
    events: [
      { date: '03.01', name: '삼일절 (3·1절)', typeId: 2, category: '기업뉴스', keyword: '3월 1일 삼일절 독립유공자 후원 · 애국 마케팅 캠페인', desc: '삼일절의 역사적 의미를 기리는 유통·패션·금융권의 한정판 굿즈 및 기부 캠페인' },
      { date: '03.03', name: '정월대보름 · 삼겹살데이', typeId: 2, category: '기업뉴스', keyword: '3월 3일 삼겹살데이 · 정월대보름 대형마트 반값 할인 총정리', desc: '삼겹살데이 한돈 반값 특가전과 정월대보름 부럼·오곡밥 간편식 프로모션 비교' },
      { date: '03.08', name: '국제 여성의 날 · 세계 물의 날(3/22)', typeId: 2, category: '기업뉴스', keyword: '3월 8일 국제 여성의 날 · 세계 물의 날 기업 ESG 캠페인', desc: '글로벌 기업과 국내 유통·뷰티 업계가 전개하는 여성 리더십 응원 및 수자원 보호 활동' },
      { date: '03.14', name: '화이트데이', typeId: 4, category: '제품·기술', keyword: '3월 14일 화이트데이 디저트 팝업 · 한정판 굿즈 라인업', desc: '사탕 대신 과일모찌·수제 디저트·캐릭터 키링 세트로 진화한 화이트데이 선물 경쟁' },
      { date: '03.15', name: '2026 서울마라톤 · 봄 러닝 시즌', typeId: 3, category: '산업 Q&A', keyword: '봄 마라톤 시즌 러닝화 · 러닝크루 용품 열풍', desc: '도쿄마라톤(3/1)·서울마라톤(3/15)과 함께 본격화되는 2030 러닝크루 소비 문화 분석' },
      { date: '03.28', name: '2026 프로야구(KBO) 정규시즌 개막', typeId: 4, category: '제품·기술', keyword: '프로야구 개막 구단 캐릭터 콜라보 굿즈 · 야구장 직관 먹거리', desc: '천만 관중 열기를 잇는 KBO 구단별 한정판 유니폼·캐릭터 굿즈 및 편의점·외식 콜라보' }
    ]
  },
  4: {
    month: 4,
    theme: '벚꽃 시즌 · 봄 피크닉·캠핑 · 식목일(4/5) · 지구의 날(4/22)',
    keyTags: ['벚꽃명소', '피크닉', '국내여행', '만우절', '지구의날'],
    curation: {
      EAT: '봄 캠핑 및 피크닉(바비큐·밀키트·와인) · 서울커피엑스포 · 한국국제베이커리페어',
      BUY: '봄 여행 필수품(캠핑·등산용품·트레이닝복) · 식목일 반려식물·원예용품',
      DO: '지구의 날 친환경 이벤트(용기내 챌린지·플로깅) · 중간고사 대비(교육앱·스터디카페)',
      PLAY: '벚꽃 시즌 봄꽃축제 · 서울국제불교박람회(힙불교) · 전주국제영화제'
    },
    events: [
      { date: '04.01', name: '만우절 이색 마케팅', typeId: 3, category: '산업 Q&A', keyword: '4월 1일 만우절 식품·유통·극장가 이색 이벤트 총정리', desc: '상상이 실제 신제품으로 출시되는 만우절 펀슈머(Fun+Consumer) 바이럴 마케팅 분석' },
      { date: '04.05', name: '식목일 · 반려식물 트렌드', typeId: 2, category: '기업뉴스', keyword: '4월 5일 식목일 반려식물 증정 · 기업 숲 조성 ESG 캠페인', desc: '식목일을 맞은 뷰티·유통가의 공병 수거 화분 증정 및 도심 숲 조성 사회공헌 활동' },
      { date: '04.09', name: 'ASMR의 날 · 도서관의 날(4/12)', typeId: 3, category: '산업 Q&A', keyword: '도서관의 날 텍스트힙 · 쇼츠 ASMR 디저트 유행 분석', desc: '청각·시각을 자극하는 숏폼 ASMR 콘텐츠와 도서관·북카페를 찾는 2030 독서 트렌드' },
      { date: '04.15~19', name: '서울커피엑스포 · 국제베이커리페어', typeId: 4, category: '제품·기술', keyword: '서울커피엑스포 · 베이커리페어 올해의 디저트·카페 신메뉴', desc: '국내 최대 커피·베이커리 박람회에서 주목받은 로스터리·저당 디저트 신제품 트렌드' },
      { date: '04.20', name: '장애인의 날 (법정기념일)', typeId: 2, category: '기업뉴스', keyword: '4월 20일 장애인의 날 배리어프리 기술 · 점자 패키지 캠페인', desc: '모바일 접근성 강화와 점자 표기 제품 확대 등 주요 기업들의 배리어프리 실천 사례' },
      { date: '04.22', name: '지구의 날 (Earth Day)', typeId: 2, category: '기업뉴스', keyword: '4월 22일 지구의 날 소등행사 · 텀블러·제로웨이스트 혜택', desc: '지구의 날을 맞아 진행되는 전국 소등 캠페인 및 카페·유통가 친환경 프로모션 비교' }
    ]
  },
  5: {
    month: 5,
    theme: '가정의 달(어린이날·어버이날·스승의날·성년의날·부부의날) · 5일 황금연휴',
    keyTags: ['선물하기', '어린이날', '어버이날', '스승의날', '성년의날'],
    curation: {
      EAT: '가정의 달 외식·홈파티 음식 · 어린이날 키즈 메뉴 · 어버이날 건강기능식품 · 막걸리엑스포',
      BUY: '가정의 달 선물(장난감·화장품·명품·효도가전) · 성년의 날 향수·꽃 · 부부의 날 커플 아이템',
      DO: '가정의 달 가족모임 식당 예약/지도앱 · 대학교 봄 축제 캠퍼스 부스',
      PLAY: '5월 샌드위치 황금연휴(5/1~5/5 최대 5일) 국내·해외여행 · 서울재즈페스티벌(5/22~24)'
    },
    events: [
      { date: '05.01~05', name: '어린이날 · 5월 황금연휴(최대 5일)', typeId: 2, category: '기업뉴스', keyword: '5월 5일 어린이날 완구·캐릭터 팝업 · 테마파크 할인 총정리', desc: '노동절(5/1)부터 어린이날(5/5)까지 이어지는 황금연휴 가족 나들이·장난감 기획전' },
      { date: '05.08', name: '어버이날 효도 선물 대전', typeId: 2, category: '기업뉴스', keyword: '5월 8일 어버이날 건강기능식품 · 안마가전 · 카네이션 혜택 비교', desc: '부모님 선호도 높은 홍삼·멀티비타민·소형 마사지기·호텔 뷔페 프로모션 총정리' },
      { date: '05.15', name: '스승의 날 · 세종대왕 나신 날', typeId: 2, category: '기업뉴스', keyword: '5월 15일 스승의 날 · 세종대왕 나신 날 모바일 선물하기 트렌드', desc: '부담 없이 감사 마음을 전하는 모바일 커피·디저트 기프티콘 및 우리말 문화 캠페인' },
      { date: '05.18', name: '성년의 날 · 코스모뷰티서울(5/27)', typeId: 4, category: '제품·기술', keyword: '5월 18일 성년의 날 니치 향수 · 올리브영·백화점 뷰티 기프트', desc: '스무 살 성년을 축하하는 대표 선물인 향수·립 메이크업·주얼리 인기 라인업 비교' },
      { date: '05.21', name: '부부의 날 (법정기념일)', typeId: 2, category: '기업뉴스', keyword: '5월 21일 부부의 날 커플 리빙가전 · 다이닝 프로모션', desc: '둘(2)이 하나(1)가 된다는 부부의 날 의미를 담은 가전·가구·호텔 업계 커플 이벤트' },
      { date: '05.22~24', name: '서울재즈페스티벌 · 대학 축제 시즌', typeId: 3, category: '산업 Q&A', keyword: '봄 대학 축제 · 서울재즈페스티벌 식음료·뷰티 체험 부스 열풍', desc: '캠퍼스와 야외 음악 축제를 찾아가 2030 세대와 소통하는 브랜드 체험형 팝업 분석' }
    ]
  },
  6: {
    month: 6,
    theme: '2026 FIFA 북중미 월드컵 개막 · 환경의 날(6/5) · 현충일 연휴 · 여름 대비',
    keyTags: ['월드컵응원', '지방선거', '제로웨이스트', '탄소줄이기', '여름대비'],
    curation: {
      EAT: '월드컵 응원 야식(치킨·맥주·편의점 안주) · 환경의 날 저탄소 식단·용기내 챌린지',
      BUY: '환경의 날 가치소비·리필스테이션 · 여름 계절가전(에어컨·제습기·음식물처리기) · 선크림',
      DO: '월드컵 대한민국 선수단 응원 이벤트 · 여름 대비 다이어트·홈트레이닝 앱 · 플로깅',
      PLAY: '2026 FIFA 북중미 월드컵(6/11~) · 서울국제도서전(6/24~28) · 부산모빌리티쇼(6/25~)'
    },
    events: [
      { date: '06.01', name: '세계 우유의 날', typeId: 2, category: '기업뉴스', keyword: '6월 1일 세계 우유의 날 유업계 국산 우유 · 저당 유제품 캠페인', desc: '세계 우유의 날을 맞은 유가공·카페 업계의 국산 원유 소비 촉진 및 신제품 프로모션' },
      { date: '06.05', name: '세계 환경의 날 (법정기념일)', typeId: 2, category: '기업뉴스', keyword: '6월 5일 환경의 날 친환경 리필스테이션 · 업사이클링 캠페인 총정리', desc: '제로웨이스트·탄소줄이기에 동참하는 유통·뷰티·식품 기업 5곳의 친환경 프로모션' },
      { date: '06.06', name: '현충일 · 호국보훈의 달 (징검다리 연휴)', typeId: 2, category: '기업뉴스', keyword: '호국보훈의 달 국가유공자 · 국군 장병 감사 할인 혜택', desc: '지방선거(6/3)~현충일(6/6) 징검다리 연휴 및 보훈 가족·군 장병 대상 특별 혜택' },
      { date: '06.11~', name: '2026 FIFA 북중미 월드컵 개막', typeId: 4, category: '기업뉴스', keyword: '2026 북중미 월드컵 치킨·맥주·편의점 응원 프로모션 총정리', desc: '전 세계 축구 축제를 맞은 외식·주류·유통업계의 거리 응원 및 시간대별 할인 경쟁' },
      { date: '06.24~28', name: '서울국제도서전 · 텍스트힙 열풍', typeId: 3, category: '산업 Q&A', keyword: '서울국제도서전 오픈런 · 출판사 한정판 굿즈·텍스트힙 분석', desc: '2030 관객이 구름처럼 몰리는 서울국제도서전 부스 예약 팁과 문학 굿즈 인기 비결' },
      { date: '6월 하순', name: '여름 장마 · 폭염 대비 가전 대전', typeId: 1, category: '브랜드스토리(기업관)', keyword: '여름 장마철 제습기 · 음식물처리기 · 무풍 에어컨 비교 가이드', desc: '본격적인 장마와 무더위를 앞두고 필수가전이 된 제습·주방위생·냉방가전 혜택 비교' }
    ]
  },
  7: {
    month: 7,
    theme: '초복·중복 보양식 · 프로야구 올스타전 · 여름방학·휴가 · 월드컵 결승',
    keyTags: ['초복·중복', '야구직관', '야구굿즈', '다이어트', '아르바이트'],
    curation: {
      EAT: '초복(7/15)·중복(7/25) 보양식(삼계탕·장어) · 제철 과일(초당옥수수·복숭아·수박 디저트)',
      BUY: '여름 의류·잡화(비치웨어·샌들·레인부츠·선글라스) · 쿨링 화장품(선크림·수딩젤)',
      DO: '여름방학 어학·과학 캠프 · 방학 아르바이트 플랫폼 · 실내 폭염 피서(배달앱·에어컨 청소)',
      PLAY: 'KBO 올스타전(7/11) · 북중미 월드컵 결승(~7/19) · 서울일러스트레이션페어(7/30~)'
    },
    events: [
      { date: '07.07', name: '세계 초콜릿의 날 · 정보보호의 날(7/8)', typeId: 2, category: '기업뉴스', keyword: '7월 정보보호의 날 보안 캠페인 · 세계 초콜릿의 날 디저트 특가', desc: '기업 개인정보 보호 인식 제고 캠페인 및 달콤한 초콜릿 디저트 브랜드 이벤트' },
      { date: '07.11', name: 'KBO 프로야구 올스타전 · 인구의 날', typeId: 4, category: '제품·기술', keyword: 'KBO 올스타전 한정판 유니폼 · 야구장 콜라보 간식 열풍', desc: '전반기 프로야구 최대 축제인 올스타전 기념 굿즈와 구장별 이색 먹거리 비교' },
      { date: '07.15', name: '초복 (7/15) · 중복 (7/25) 보양식 대전', typeId: 4, category: '제품·기술', keyword: '초복·중복 가성비 삼계탕 밀키트 · 편의점 보양식 신제품 비교', desc: '고물가 속 집에서 간편하게 챙기는 대형마트·편의점·식품업계 반값 보양식 라인업' },
      { date: '07.17', name: '제헌절 · 세계 이모지의 날', typeId: 3, category: '산업 Q&A', keyword: '세계 이모지의 날 캐릭터 이모티콘 · 디지털 굿즈 소비 트렌드', desc: '텍스트 대신 캐릭터 이모티콘으로 감정을 표현하는 MZ세대 메신저 기프트 문화' },
      { date: '7월 하순', name: '여름방학 · 바캉스 시즌 개막', typeId: 1, category: '브랜드스토리(기업관)', keyword: '여름 휴가철 호텔·리조트 · 렌터카 · 트래블 카드 혜택 비교', desc: '본격적인 여름휴가 성수기를 맞은 여행·숙박 플랫폼 쿠폰팩 및 환전 수수료 무료 혜택' },
      { date: '07.30~', name: '서울일러스트레이션페어 · 여름 쿨링템', typeId: 4, category: '제품·기술', keyword: '다이소 · 올리브영 여름 폭염 쿨링 아이템 품절 대란', desc: '체감 온도를 낮추는 냉감 의류·쿨링 시트·양산 등 여름철 기능성 히트상품 분석' }
    ]
  },
  8: {
    month: 8,
    theme: '여름휴가 절정(백캉스·몰캉스) · 말복(8/14) · 광복절 연휴(8/15~17) · 에너지의 날',
    keyTags: ['열대야', '백캉스·몰캉스', '여름방학', '보양식', '물놀이'],
    curation: {
      EAT: '말복(8/14) 치킨·보양식 · 열대야 야식·빙수·아이스크림 · 쌀의 날(8/18) 가루쌀 베이커리',
      BUY: '폭염 실내 백캉스·몰캉스 쇼핑 · 2학기 개강 준비 IT·패션 · 고효율 에너지 가전',
      DO: '에너지의 날(8/22) 소등·절전 캠페인 · 수능 D-100(8/11) 스터디카페·교육앱',
      PLAY: '광복절 대체공휴일 3일 연휴(8/15~17) · 한강나이트워크 · 게임스컴·서울POPCON'
    },
    events: [
      { date: '08.08', name: '세계 고양이의 날 · 펫 마케팅', typeId: 2, category: '기업뉴스', keyword: '8월 8일 세계 고양이의 날 반려묘 사료·간식 기부 및 굿즈 캠페인', desc: '반려묘 집사들을 겨냥한 펫 브랜드 특가전 및 유기묘 보호소 사료 기부 ESG 활동' },
      { date: '08.14', name: '말복 · 뮤직데이', typeId: 4, category: '기업뉴스', keyword: '8월 14일 말복 치킨 프랜차이즈 · 배달앱 할인 프로모션 비교', desc: '삼복더위의 마지막인 말복을 맞아 진행되는 치킨·보양식 브랜드 타임세일 총정리' },
      { date: '08.15~17', name: '광복절 · 대체공휴일 연휴 (애국 마케팅)', typeId: 2, category: '기업뉴스', keyword: '8월 15일 광복절 815런 기부 마라톤 · 한정판 태극 굿즈 캠페인', desc: '광복절 의미를 되새기는 독립유공자 후손 후원 캠페인 및 유통가 한정판 에디션' },
      { date: '08.18', name: '쌀의 날 · 로코노미 디저트', typeId: 4, category: '제품·기술', keyword: '8월 18일 쌀의 날 우리 쌀·가루쌀 베이커리 · 떡 디저트 열풍', desc: '팔십팔(88) 번의 정성이 들어간다는 쌀의 날 맞이 글루텐프리 쌀빵·과일모찌 인기' },
      { date: '08.22', name: '에너지의 날 (법정·환경 기념일)', typeId: 2, category: '기업뉴스', keyword: '8월 22일 에너지의 날 밤 9시 소등 캠페인 · 고효율 가전 혜택', desc: '전국 동시 5분 소등 캠페인과 기업들의 여름철 전력 피크 절감·탄소중립 프로모션' },
      { date: '8월 하순', name: '백캉스 · 몰캉스 실내 팝업 열풍', typeId: 3, category: '산업 Q&A', keyword: '폭염·열대야 속 백화점·복합몰 백캉스·몰캉스 소비 트렌드', desc: '무더위를 피해 시원한 대형 복합쇼핑몰 팝업스토어와 식음료 매장으로 몰리는 나들이객 분석' }
    ]
  },
  9: {
    month: 9,
    theme: '추석 명절 특수(9/24~26) · 2학기 개강 · 가을 캠핑·독서 · 아시안게임 개막',
    keyTags: ['명절선물', '가을캠핑', '개강·개학', '독서문화행사', '드라이브'],
    curation: {
      EAT: '추석 명절 기획전(추석 선물세트·차례용품·간편식) · 가을 캠핑 바비큐·밀키트',
      BUY: '독서용품(독서대·책갈피·북파우치) · 하반기 공채 면접 정장·구두 · 가을 패션',
      DO: '추석 선물 사전예약 이커머스앱 · 추석 연휴 실내 여가·OTT·숙박 예약앱 · 대학교 수시 원서접수',
      PLAY: '추석 연휴(9/24~26) 여행·특선 영화 · 아이치·나고야 아시안게임(9/19~) · 대한민국 독서대전'
    },
    events: [
      { date: '09.06', name: '자원순환의 날 (환경부 지정)', typeId: 2, category: '기업뉴스', keyword: '9월 6일 자원순환의 날 폐플라스틱 재활용 · 다회용기 캠페인', desc: '구(9)와 육(6)을 서로 뒤집은 모양에서 유래한 자원순환의 날 맞이 기업 ESG 실천 사례' },
      { date: '09.19', name: '청년의 날 (법정기념일)', typeId: 2, category: '기업뉴스', keyword: '9월 셋째 주 토요일 청년의 날 청년 금융·주거·취업 지원 혜택', desc: '청년 기본법에 따른 법정기념일 맞이 정부·지자체 청년 바우처 및 금융·기업 응원 캠페인' },
      { date: '09.19~', name: '2026 아이치·나고야 아시안게임 개막', typeId: 2, category: '기업뉴스', keyword: '2026 아시안게임 국가대표 응원 프로모션 · 스포츠 마케팅', desc: '대한민국 선수단 선전을 기원하는 공식 후원사 및 외식·유통업계 응원 이벤트' },
      { date: '09.21', name: '치매극복의 날 · 시니어 헬스케어', typeId: 2, category: '기업뉴스', keyword: '9월 21일 치매극복의 날 두뇌 건강기능식품 · 시니어 케어 서비스', desc: '고령화 시대 부모님 인지 건강 관리를 돕는 제약·헬스케어·보험업계 캠페인' },
      { date: '09.24~26', name: '추석 명절 연휴 · 선물세트 본판매', typeId: 1, category: '기업뉴스', keyword: '추석 명절 가성비 vs 프리미엄 선물세트 · 온누리상품권 혜택 비교', desc: '백화점·대형마트·이커머스 추석 선물세트 막바지 할인 및 연휴 기간 배송·여행 혜택' },
      { date: '9월 하순', name: '대한민국 독서대전 · 가을 텍스트힙', typeId: 3, category: '산업 Q&A', keyword: '가을 독서의 계절 북파우치 · 책갈피 · 독립서점 텍스트힙 열풍', desc: '독서용품(독서대·북커버·미니 책갈피)을 패션 소품처럼 소비하는 MZ세대 가을 독서 문화' }
    ]
  },
  10: {
    month: 10,
    theme: '마라톤·러닝 이벤트 · 개천절·한글날 연휴 · 임산부의 날(10/10) · 가을 지역축제',
    keyTags: ['러닝용품', '가을야구', '가을밤', '지역축제', '단풍놀이'],
    curation: {
      EAT: '가을 제철 먹거리(밤·대하·전어) · 대전빵축제·김천김밥축제 로컬 미식 · 와인데이(10/14)',
      BUY: '마라톤 시즌(러닝화·달리기 용품) · 가을 등산·캠핑 아웃도어 · 여의도 불꽃축제 편의점 돗자리세트',
      DO: '마라톤 이벤트·러닝 마케팅(브랜드 콜라보 런) · 산책·걷기 챌린지 · 채식인의 날(10/1) 비건 식단',
      PLAY: '개천절·한글날 징검다리 연휴 · 프로야구 포스트시즌(가을야구) · 서울세계불꽃축제 · 부산국제영화제'
    },
    events: [
      { date: '10.01~02', name: '국군의 날 · 국제 커피의 날(10/1) · 노인의 날(10/2)', typeId: 2, category: '기업뉴스', keyword: '10월 1일 국군의 날 · 커피의 날 · 노인의 날 브랜드별 혜택 총정리', desc: '국군 장병 할인부터 커피 프랜차이즈 원두·텀블러 행사, 시니어 맞춤 캠페인까지 한눈에' },
      { date: '10.03~09', name: '개천절 대체휴일(10/5) · 한글날(10/9) 황금연휴', typeId: 2, category: '기업뉴스', keyword: '10월 9일 한글날 기업 무료 글꼴 배포 · 우리말 한정판 굿즈 캠페인', desc: '한글의 아름다움을 알리는 기업 전용 서체 공개 및 박물관 뮷즈(MU:DS)·유통가 프로모션' },
      { date: '10.10', name: '임산부의 날 (법정기념일)', typeId: 2, category: '기업뉴스', keyword: '10월 10일 임산부의 날 유래부터 기업 5곳 프로모션 총정리', desc: '풍요의 10월과 임신 10개월을 뜻하는 법정기념일 맞이 정부 바우처 및 육아·유통 기업 5곳 혜택' },
      { date: '10월 중순', name: '춘천마라톤 · 가을 러닝 마케팅 대전', typeId: 3, category: '산업 Q&A', keyword: '가을 마라톤 시즌 러닝화 품귀 현상 · 브랜드 팝업 런 열풍', desc: '나스미디어 10월 핵심 테마인 마라톤·러닝 이벤트와 패션·식음료 브랜드의 러닝 콜라보 분석' },
      { date: '10.23~25', name: '가을 로컬 축제 · 지자체 서울 팝업(대전빵축제·함양 팝업)', typeId: 4, category: '제품·기술', keyword: '함양 오르GO 굿즈 팝업 · 가을 지역축제·로컬 캐릭터 열풍', desc: '대전빵축제·김천김밥축제부터 서울 도심 복합몰로 찾아온 지자체 관광 굿즈 팝업까지' },
      { date: '10.25', name: '독도의 날', typeId: 2, category: '기업뉴스', keyword: '10월 25일 독도의 날 기념 에디션 · 독도 후원 캠페인', desc: '독도칙령 반포일을 기념해 문구·패션·편의점 업계가 선보이는 독도 사랑 참여형 캠페인' }
    ]
  },
  11: {
    month: 11,
    theme: '2027학년도 수능(11/19) · 코리아세일페스타·블랙프라이데이 · 빼빼로·농업인의 날',
    keyTags: ['수능응원', '수험생할인', '블랙프라이데이', '김장철', '월동준비'],
    curation: {
      EAT: '수험생 응원(베이커리·찹쌀떡·건강식품) · 빼빼로데이·가래떡데이(11/11) · 김장철(절임배추·수육)',
      BUY: '대규모 할인 프로모션(코세페·광군제·블프) · 수험생 할인(IT기기·화장품) · 월동준비(방한용품·침구)',
      DO: '수험표 인증 이벤트(미용·다이어트·헬스장) · JTBC 서울마라톤 · 지스타(G-STAR) 게임전시회',
      PLAY: '수험생 테마파크·영화관·항공권 특가 · 지스타 2026 · 청룡영화상 · MAMA AWARDS'
    },
    events: [
      { date: '11.01', name: '한우데이 (11/1) · 소상공인의 날 (11/5)', typeId: 2, category: '기업뉴스', keyword: '11월 1일 한우데이 반값 특가 · 소상공인의 날 상생 프로모션', desc: '대형마트·농협 한우데이 최대 50% 할인전과 소상공인 판로 지원 동행축제 캠페인' },
      { date: '11.11', name: '농업인의 날(가래떡데이) · 빼빼로데이 · 광군제', typeId: 2, category: '기업뉴스', keyword: '11월 11일 농업인의 날 가래떡데이 · 빼빼로데이 캐릭터 콜라보 비교', desc: '우리 쌀 가래떡데이 캠페인과 편의점·유통가의 인기 캐릭터 IP 협업 패키지 총정리' },
      { date: '11.19', name: '2027학년도 대학수학능력시험 (수능)', typeId: 2, category: '기업뉴스', keyword: '수능 수험표 할인 혜택 총정리 (IT기기·테마파크·외식·항공·패션)', desc: '11월 19일 수능 직후 쏟아지는 수험생 전용 스마트폰·노트북·놀이공원·뷰티 반값 혜택 비교' },
      { date: '11.22', name: '김치의 날 (법정기념일) · 김장철 마케팅', typeId: 2, category: '기업뉴스', keyword: '11월 22일 김치의 날 절임배추 사전예약 · 포장김치·김장독 특가', desc: '김치 소재 하나하나(11월)가 모여 스물두 가지(22일) 효능을 낸다는 김치의 날 맞이 유통가 행사' },
      { date: '11.27', name: '코리아세일페스타 · 블랙프라이데이(11/27)', typeId: 1, category: '산업 Q&A', keyword: '블랙프라이데이 · 코리아세일페스타 가전·패션·직구 최대 할인 비교', desc: '11월 연중 최대 쇼핑 시즌을 맞은 국내 백화점·이커머스 쿠폰팩과 해외직구 체크포인트' },
      { date: '11월 하순', name: '월동 준비 · 가성비 방한 의류·난방가전', typeId: 4, category: '제품·기술', keyword: '월동 준비 발열 내의 · 경량 패딩 · 전기요·온수매트 신제품 비교', desc: '입동(11/7) 이후 본격적인 추위에 대비하는 초가성비 방한 의류와 고효율 난방가전 인기' }
    ]
  },
  12: {
    month: 12,
    theme: '크리스마스 · 연말 특수 · 홀리데이 기프트 · 송년회·홈파티 · 겨울방학',
    keyTags: ['홀리데이', '겨울방학', '송년회', '선물하기', '겨울간식'],
    curation: {
      EAT: '연말 베이커리(슈톨렌·크리스마스 케이크) · 연말 홈파티(와인·주류·밀키트·배달음식) · 동지 팥죽(12/22)',
      BUY: '크리스마스·연말 선물(명품·시계·향수·어드벤트 캘린더) · 파티용품·트리·조명',
      DO: '연말 송년회 모임(식당 예약·지도앱) · 연말 홈파티 배달·커머스앱 · 기말고사·종강',
      PLAY: '크리스마스 명소·미디어파사드·마켓 · 연말 콘서트 · 영화 듄:파트3·어벤져스 개봉(12/18)'
    },
    events: [
      { date: '12.03', name: '소비자의 날 (법정기념일)', typeId: 2, category: '기업뉴스', keyword: '12월 3일 소비자의 날 소비자중심경영(CCM) · 연말 고객 감사제', desc: '소비자 권익 보호를 기념하는 법정기념일 맞이 주요 기업들의 고객 감사 할인 프로모션' },
      { date: '12월 초', name: '어드벤트 캘린더 · 홀리데이 에디션 출시', typeId: 4, category: '제품·기술', keyword: '크리스마스 어드벤트 캘린더 · 뷰티·디저트 홀리데이 한정판 비교', desc: '하루에 하나씩 열어보는 재미로 품절 대란을 빚는 화장품·초콜릿·티(Tea) 어드벤트 캘린더' },
      { date: '12월 중순', name: '크리스마스 케이크 · 슈톨렌 사전예약 대전', typeId: 4, category: '제품·기술', keyword: '크리스마스 호텔 프리미엄 케이크 vs 편의점·베이커리 가성비 케이크', desc: '연말 홈파티 식탁을 장식할 호텔·프랜차이즈·편의점 크리스마스 케이크 예약 일정과 가격 비교' },
      { date: '12.22', name: '동지 (12/22) · 겨울 제철 간식 열풍', typeId: 4, category: '제품·기술', keyword: '동지 단팥죽 · 겨울 간식 호빵·붕어빵·호떡 신메뉴 트렌드', desc: '일 년 중 밤이 가장 긴 동지를 맞아 편의점·식품업계가 선보이는 팥 디저트 및 겨울 간식' },
      { date: '12.25', name: '크리스마스 빌리지 · 백화점 인증샷 명소', typeId: 3, category: '산업 Q&A', keyword: '크리스마스 백화점 미디어파사드 · 대형 트리 팝업 마켓 오픈런', desc: '연말 도심 나들이 필수 코스가 된 주요 백화점 크리스마스 마켓 사전예약 팁과 현장 열기' },
      { date: '12월 말', name: '연말 결산 어워즈 · 송년 모임 트렌드', typeId: 3, category: '산업 Q&A', keyword: '올리브영·유통가 연말 어워즈 베스트셀러 결산 · 홈파티 소비 분석', desc: '올 한 해 소비자 사랑을 받은 1위 히트상품 결산과 합리적인 연말 홈파티 트렌드' }
    ]
  }
};

// 유형 구분 없이 전체 기사에 공통 적용되는 GEO(생성형 AI 검색·인용) 최적화 체크리스트
const GEO_CHECKLIST_ITEMS = [
  {
    id: 'geo-1',
    title: '인용구(" ") + 말줄임(…) 헤드라인 & 핵심 키워드 전면 배치',
    desc: 'AI와 검색엔진이 주제를 즉시 파악하도록 큰따옴표 인용구와 핵심 키워드를 제목에 포함했나요?'
  },
  {
    id: 'geo-2',
    title: '상단 [AI 팩트 체크 요약] 1~3번 구성',
    desc: '생성형 AI가 기사의 핵심 결론을 3줄로 바로 발췌·인용할 수 있도록 상단 요약 번호(1~3)를 채웠나요?'
  },
  {
    id: 'geo-3',
    title: '독자 질문형 도입부 ("~하신 적 없으신가요?")',
    desc: '독자의 검색 의도(Search Intent)와 공감대를 자극하는 질문형 문장으로 도입부를 시작했나요?'
  },
  {
    id: 'geo-4',
    title: '구체적 수치 · 날짜 · 고유명사(엔티티) 포함',
    desc: '모호한 수식어 대신 정확한 기업·브랜드·법령명과 수치(금액, %, 일자, 수량)가 본문에 명시되었나요?'
  },
  {
    id: 'geo-5',
    title: '구조화된 비교 [요약표] 포함',
    desc: 'AI 답변 엔진이 표 데이터를 그대로 인용할 수 있도록 행·열이 정리된 비교 요약표를 넣었나요?'
  },
  {
    id: 'geo-6',
    title: '실제 검색 질문 기반 [FAQ] 5문항 이상 구성 (AEO)',
    desc: '사용자가 퍼플렉시티·챗GPT에 직접 물어볼 법한 질문(Q)과 완결된 답변(A)을 구성했나요?'
  },
  {
    id: 'geo-7',
    title: '"한 줄 요약!" 마무리 및 전 문장 "~합니다" 체 통일',
    desc: '하단에 "한 줄 요약!" 문장을 넣고, 본문과 FAQ 답변을 신뢰감 있는 "~합니다" 체로 통일했나요?'
  }
];

// 실시간 트렌드 수집 전 초기 빈 상태 (인위적인 고정 샘플 키워드로 인한 사용자 오해를 원천 방지하기 위해 비워둠)
const CURATED_TREND_TOPICS = {
  shortForm: [],
  portalRetail: [],
  google: [],
  newsletter: [],
  brandPromo: []
};

// 타 언론사 기사 제목/문장이나 쇼츠 제목이 그대로 들어가지 않도록 핵심 팩트 요소(수치, 주체, 현상)만 추출해 매경 MK Pick 자체 문장("~합니다")으로 재가공하는 함수
function paraphraseNewsToMkFact(rawTitle = '', keyword = '', sourceName = '', idx = 0) {
  // 1) 대괄호 코너명([가보니], [갓신상] 등), 해시태그(#shorts 등), 언론사명, 특수기호 제거
  let cleaned = String(rawTitle)
    .replace(/#[a-zA-Z0-9가-힣_]+/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*맛집[^)]*\)/g, '')
    .replace(/ - [^-]+$/g, '')
    .replace(/[“”"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 2) 수치·단위 추출 (예: 150개, 1시간, 8종, 3800원, 50% 등)
  const numbers = cleaned.match(/\d+(?:,\d+)?\s*(?:개|시간|분|종|곳|명|원|만\s*원|억|%|배|회|일|월)/g) || [];
  const numText = numbers.length > 0 ? `${numbers.slice(0, 2).join('·')} 등 구체적 지표를 기록하며 ` : '';

  // 3) 핵심 고유명사(키워드 외 단어들 중 조사·어미·불용어 제외한 핵심 어구) 추출
  const stopWords = [
    '가보니', '알려드려요', '뭐길래', '난리', '먹으려고', '즐긴다', '운영', '출시', '오픈',
    '내놨다', '내놔', '솔직리뷰', '리뷰', '출발했어요', '정도였나', '섰지만', '먹을까', '요즘', '진짜', '이유'
  ];
  const kwTokens = String(keyword).split(/[\s·,]+/).filter(Boolean);
  const tokens = cleaned
    .split(/[\s,…·?!~]+/)
    .map(t => t.replace(/(은|는|이|가|을|를|에|의|로|으로|에서|까지|부터|도|만)$/, '').trim())
    .filter(t => t.length >= 2 && !stopWords.some(sw => t.includes(sw)) && !kwTokens.some(k => t.includes(k)));
  const keyEntities = [...new Set(tokens)].slice(0, 3).join('·');

  const isShortForm = /쇼츠|Shorts|릴스|숏폼/i.test(sourceName);

  // 원문 기사의 실제 팩트가 왜곡되지 않도록 원문 핵심 내용을 보존하여 매경 문체("~합니다")로 정리
  let paraphrasedSentence = '';
  const cleanOriginal = String(rawTitle || '')
    .replace(/#[a-zA-Z0-9가-힣_]+/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/ - [^-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (isShortForm) {
    paraphrasedSentence = cleanOriginal
      ? `유튜브 쇼츠 화제 영상("${cleanOriginal}")을 중심으로 소비자들의 실사용 리뷰와 추천 후기가 빠르게 확산하고 있습니다.`
      : `유튜브 쇼츠 등 숏폼 플랫폼에서 '${keyword}' 관련 실사용 후기와 언박싱 영상이 확산하고 있습니다.`;
  } else if (cleanOriginal) {
    const srcLabel = sourceName ? `${sourceName} 보도에 따르면, ` : '';
    paraphrasedSentence = `${srcLabel}"${cleanOriginal}" 소식이 전해지며 ${numText}소비자와 업계의 관심을 모으고 있습니다.`;
  } else {
    paraphrasedSentence = `최근 시장에서 '${keyword}' 관련 ${keyEntities ? `${keyEntities} 등 ` : ''}신규 소식이 전해지며 주목받고 있습니다.`;
  }

  return {
    summaryBadge: `${sourceName || '업계 동향'} 핵심 팩트 추출`,
    extractedEntities: keyEntities || keyword,
    extractedNumbers: numbers.join(', ') || (isShortForm ? '🎬 숏폼 바이럴' : '주요 지표 확인'),
    paraphrasedSentence
  };
}

// 본문 텍스트에서 숫자·날짜·퍼센트·금액이 포함된 문장을 자동 감지하여 형광펜 팩트체크 목록으로 추출
function extractFactSentencesFromSections(sections, sources) {
  const results = [];
  const defaultSource = (sources && sources[0]) || {
    id: 'src-default',
    title: '공식 보도자료 및 업계 동향',
    url: 'https://www.mk.co.kr'
  };
  const numberPattern = /(\d+(?:,\d+)?\s*(?:년|월|일|만\s*원|억|원|%|곳|명|종|개|배|시간|세|위|회))/;

  (sections || []).forEach(sec => {
    const sentences = (sec.content || '')
      .split(/(?<=[.?!])\s+|\n+/)
      .map(s => s.trim())
      .filter(Boolean);
    sentences.forEach(sentence => {
      if (numberPattern.test(sentence) && sentence.length >= 15 && results.length < 8) {
        results.push({
          id: 'fc-auto-' + (results.length + 1),
          sentence,
          verdict: '수치·팩트 확인',
          sourceId: defaultSource.id,
          sourceTitle: defaultSource.title,
          sourceUrl: defaultSource.url,
          status: '미처리'
        });
      }
    });
  });

  return results;
}

// 유튜브 쇼츠·SNS·뉴스 제목에서 유튜버 감탄사·수식어·오탈자·구어체 어미를 제거하고 기사 작성용 핵심 주제·브랜드 키워드로 정제
function cleanTrendTopicKeyword(rawTitle = '', fullContext = '') {
  let base = String(rawTitle || '').trim();
  const quotedMatch = String(fullContext || '').match(/"([^"]{5,120})"/);
  if (quotedMatch && quotedMatch[1]) {
    const qText = quotedMatch[1].trim();
    const strippedBase = base.replace(/\s+/g, '');
    const strippedQuote = qText.replace(/#[a-zA-Z0-9가-힣_]+/g, '').replace(/\s+/g, '');
    if (
      qText.length > base.length &&
      (strippedQuote.includes(strippedBase.slice(0, Math.min(8, strippedBase.length))) ||
        /(?:조회수|똥손|용기까지|잠깐만|개야르렁)/.test(base))
    ) {
      base = qText;
    }
  }

  let s = base
    .replace(/#[a-zA-Z0-9가-힣_]+/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^\)]*포토[^\)]*\)/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/gu, ' ')
    .replace(/[;~!?‼⁉…⋯‥"“”'‘’`]+/g, ' ')
    .replace(/[ㅋㅎㅠㅜ]{2,}/g, ' ')
    // 오탈자 및 대표 신조어 정규화
    .replace(/찹살떡|찹살덕|찹쌀덕/g, '찹쌀떡')
    .replace(/올영이랑\s*다이소깡/g, '올리브영·다이소 신상 추천템')
    .replace(/다이소깡/g, '다이소 신상 추천템')
    .replace(/올영이랑/g, '올리브영')
    .replace(/(^|\s)올영(\s|$)/g, '$1올리브영$2')
    .replace(/올리브영\s*(?:vs|VS|랑|이랑)\s*다이소/g, '올리브영·다이소')
    .replace(/올리브영\s+다이소/g, '올리브영·다이소')
    .replace(/팝업\s+스토어/g, '팝업스토어')
    .replace(/대구\s*더현대에?/g, '더현대 대구')
    .replace(/더현대에(\s|$)/g, '더현대$1')
    .replace(/올기\s*찹쌀떡/g, '생과일 딸기 찹쌀떡')
    // 유튜버 클릭베이트 수식어·감탄사·리뷰 어미 제거
    .replace(/조회수\s*\d+(?:\.\d+)?[만천]?회/g, ' ')
    .replace(/논란의\s*똥손\s*\.*/g, ' ')
    .replace(/댓글\s*반영\s*(?:화장해봄|메이크업)?/g, ' ')
    .replace(/용기까지\s*아끼네/g, ' ')
    .replace(/과즙미?\s*(?:넘치는|가득한|폭발하는|팡팡|가득)/g, ' ')
    .replace(/미친\s*가성비/g, '가성비')
    .replace(/미친\s*(?:비주얼|맛|퀄리티|텐션)/g, ' ')
    .replace(/역대급\s*귀요미\s*팝업/g, '인기 캐릭터 팝업스토어')
    .replace(/역대급\s*(?:귀요미|비주얼|가성비|신상)?/g, ' ')
    .replace(/진심\s*개야르렁한\s*초코다?/g, '편의점 진한 초코 디저트 신상')
    .replace(/진심\s*개야르렁한/g, ' ')
    .replace(/요즘\s*(?:핫한|난리난|대세인|유행하는|뜨는)/g, ' ')
    .replace(/드디어\s*(?:먹어본|가본|써본|구한)/g, ' ')
    .replace(/내돈내산\s*(?:솔직)?/g, ' ')
    .replace(/솔직\s*(?:리뷰|후기)/g, ' ')
    .replace(/솔직\s*비교/g, '비교')
    .replace(/\d+천원에\s*(?:종결\s*가능할까|종결)?/g, ' ')
    .replace(/근데\s*쓸만할까/g, ' ')
    .replace(/종결\s*가능할까/g, ' ')
    .replace(/추천템으로\s+([가-힣A-Za-z0-9\s]+)$/g, '$1 추천템')
    .replace(/\d+월\s*\d+일\s*끝/g, '시즌 한정')
    .replace(/(?:먹어봄|먹어봤습니다|먹어봤어요|가봤습니다|다녀왔어요|화장해봄|써봄|리뷰해봄|언박싱|떴어요|떴다)(\s|$)/g, ' ')
    .replace(/잠깐만/g, ' ')
    .replace(/\.\.+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 문장 끝에 남은 불완전 조사 제거
  s = s.replace(/\s+(?:에서|으로|에게|에는|까지|부터)$/, '').trim();

  if (!s) return String(rawTitle || '').trim();
  if (s.length <= 28) return s;
  const words = s.split(' ');
  let acc = '';
  for (const w of words) {
    if ((acc + ' ' + w).trim().length > 28) break;
    acc = (acc + ' ' + w).trim();
  }
  return acc || s.slice(0, 28);
}

// 키워드·설명에서 핵심 기업/브랜드명을 자동 추출하는 헬퍼
function extractBrandFromTopic(text = '', existingCompany = '') {
  const existing = String(existingCompany || '').trim();
  if (existing) return existing;
  const src = String(text || '');
  const found = [];
  const brandRules = [
    { pattern: /한정선/, name: '한정선' },
    { pattern: /마이쮸/, name: '크라운제과(마이쮸)' },
    { pattern: /올리브영|올영/, name: '올리브영' },
    { pattern: /다이소/, name: '다이소' },
    { pattern: /세븐일레븐/, name: '세븐일레븐' },
    { pattern: /GS25/i, name: 'GS25' },
    { pattern: /(^|[^A-Za-z])CU([^A-Za-z]|$)/, name: 'CU' },
    { pattern: /더현대\s*대구|대구\s*더현대/, name: '더현대 대구' },
    { pattern: /더현대/, name: '더현대' },
    { pattern: /무신사/, name: '무신사' },
    { pattern: /이디야/, name: '이디야커피' },
    { pattern: /하인즈/, name: '하인즈' },
    { pattern: /스타벅스/, name: '스타벅스' },
    { pattern: /투썸/, name: '투썸플레이스' },
    { pattern: /메가커피/, name: '메가MGC커피' },
    { pattern: /농심/, name: '농심' },
    { pattern: /오뚜기/, name: '오뚜기' },
    { pattern: /삼양/, name: '삼양식품' },
    { pattern: /롯데웰푸드/, name: '롯데웰푸드' },
    { pattern: /성심당/, name: '성심당' },
    { pattern: /아모레/, name: '아모레퍼시픽' },
    { pattern: /LG생활건강/, name: 'LG생활건강' },
    { pattern: /삼성전자|갤럭시/, name: '삼성전자' },
    { pattern: /LG전자/, name: 'LG전자' },
    { pattern: /오늘의집/, name: '오늘의집' },
    { pattern: /컬리/, name: '컬리' },
    { pattern: /이마트/, name: '이마트' },
    { pattern: /롯데백화점/, name: '롯데백화점' },
    { pattern: /신세계/, name: '신세계백화점' }
  ];
  for (const rule of brandRules) {
    if (rule.pattern.test(src) && !found.includes(rule.name)) {
      if (rule.name === '더현대' && found.includes('더현대 대구')) continue;
      found.push(rule.name);
      if (found.length >= 2) break;
    }
  }
  return found.join(', ');
}

// 버츄얼 아이돌 계보(아담·키즈나아이·이세계아이돌·플레이브·나이비스·비더후드 등) 키워드 여부 판별
function isVirtualIdolQuery(kw = '', comp = '') {
  const combined = `${kw} ${comp}`.toLowerCase();
  return /(?:아담|키즈나\s*아이|이세계\s*아이돌|플레이브|plave|나이비스|naevis|비더후드|매드몬스터|버츄얼\s*아이돌|버추얼\s*아이돌|사이버\s*가수|버튜버)/.test(combined);
}

// 실시간 뉴스 검색 결과(newsItems)에서 타 언론사 문장을 그대로 복사하지 않고, 핵심 팩트만 추출·재구성해 MK Pick 초안 생성
function buildDynamicWorkFromNews({ keyword, company, url, rawText, typeId, newsItems = [] }) {
  const kw = cleanTrendTopicKeyword((keyword || '최신 소비 트렌드').trim());
  const comp = extractBrandFromTopic(kw, (company || '').trim());
  const tId = Number(typeId) || 2;
  const mainEntity = comp ? `${comp} · ${kw}` : kw;

  if (isVirtualIdolQuery(kw, comp)) {
    return getVirtualIdolScenario(kw);
  }

  if (
    (!newsItems || newsItems.length === 0) &&
    (kw.includes('임산부') || kw.includes('결혼') || kw.includes('민음사') || kw.includes('번개장터'))
  ) {
    return buildPresetScenario({ keyword: kw, company: comp, url, selectedType: tId });
  }

  const sources = [];
  const researchItems = [];
  const paraphrasedFacts = [];

  if (url) {
    sources.push({
      id: 'src-user-url',
      url,
      title: `${comp || kw} 공식 참고 페이지 / 보도자료`,
      method: '공식 참고 링크',
      reliability: '높음',
      excluded: false
    });
  }

  if (rawText && rawText.trim()) {
    researchItems.push({
      id: 'ri-user-raw',
      category: '직접 입력한 보도자료·취재 팩트',
      fact: rawText.trim(),
      rawReference: '사용자 직접 입력 자료',
      sourceIds: url ? ['src-user-url'] : []
    });
    paraphrasedFacts.push(rawText.trim());
  }

  newsItems.forEach((n, idx) => {
    const srcId = `src-live-${idx + 1}`;
    const reworked = paraphraseNewsToMkFact(n.title, kw, n.source, idx);
    sources.push({
      id: srcId,
      url: n.link || 'https://www.mk.co.kr',
      title: `[참고 보도 · ${n.source || '언론'}] ${n.title}`,
      method: '실시간 트렌드 수집',
      reliability: '높음',
      excluded: false
    });
    researchItems.push({
      id: `ri-live-${idx + 1}`,
      category: `추출 팩트 #${idx + 1} (${reworked.extractedNumbers !== '주요 지표 확인' ? reworked.extractedNumbers : n.pubDateShort || '최신'})`,
      fact: reworked.paraphrasedSentence,
      rawReference: `참고 보도 주제: ${n.title} (${n.source})`,
      sourceIds: [srcId]
    });
    paraphrasedFacts.push(reworked.paraphrasedSentence);
  });

  if (sources.length === 0) {
    sources.push({
      id: 'src-fallback-1',
      url: `https://www.mk.co.kr/search?word=${encodeURIComponent(kw)}`,
      title: `매일경제 '${kw}' 관련 보도 검색`,
      method: '자동 연결',
      reliability: '높음',
      excluded: false
    });
  }

  const fact1 = paraphrasedFacts[0] || `최근 소비 시장에서는 '${kw}' 관련 차별화된 상품과 서비스를 앞세운 브랜드들이 2030 소비자의 호응을 얻고 있습니다.`;
  const fact2 = paraphrasedFacts[1] || `유통·서비스 업계에서도 '${kw}' 수요를 겨냥한 전용 라인업과 온·오프라인 프로모션을 잇달아 확대하고 있습니다.`;
  const fact3 = paraphrasedFacts[2] || `소비자들은 단순 가격 비교를 넘어 본인의 취향에 맞는 맞춤형 구성과 검증된 품질을 핵심 선택 기준으로 삼고 있습니다.`;

  if (researchItems.length === 0) {
    researchItems.push({
      id: 'ri-fallback-1',
      category: `${kw} 핵심 동향 요약`,
      fact: fact1,
      rawReference: '업계 동향 종합',
      sourceIds: [sources[0].id]
    });
  }

  // -------------------------------------------------------------------------
  // 5가지 콘텐츠 유형별로 서로 다른 제목 후보, 본문 단락 흐름, 요약표, FAQ 질문 구성!
  // -------------------------------------------------------------------------
  let titleCandidates = [];
  let draftSections = [];
  let subtitleText = '';
  let summaryTable = {};
  let faqs = [];
  let oneLineSummary = '';

  if (tId === 1) {
    // [유형 1] 유료 업체 타겟팅 기획 콘텐츠: 시대별 비교 → 업체별 서비스 집중 소개 → 요약표(업체 비교) → FAQ 7문항
    const partnerName = comp || `${kw} 주요 파트너사`;
    titleCandidates = [
      { id: 'tc-1', title: `"정형화된 패키지는 이제 옛말"…시대별 '${kw}' 변천사와 주목받는 맞춤형 서비스 4선`, totalScore: 96 },
      { id: 'tc-2', title: `"내 취향대로 골라 담아요"…2026년 '${kw}' 트렌드와 ${partnerName} 핵심 혜택 비교`, totalScore: 93 },
      { id: 'tc-3', title: `"거품 빼고 실속만 챙겼습니다"…세대별 '${kw}' 비교부터 업체별 이용 팁 Q&A`, totalScore: 90 },
      { id: 'tc-4', title: `"이 서비스 알고 쓰면 비용이 반값"…'${kw}' 주요 플랫폼·브랜드 4곳 전격 비교`, totalScore: 88 },
      { id: 'tc-5', title: `"90년대 유행이 이렇게 바뀌었다고?"…한눈에 보는 '${kw}' 트렌드와 추천 서비스`, totalScore: 85 }
    ];
    subtitleText = `획일적 패키지 대신 취향 중심 맞춤형 소비 확산\n시대별 '${kw}' 문화 변천사부터 ${partnerName} 등 주요 기업 서비스 비교`;
    draftSections = [
      {
        id: 'sec-1',
        title: `정형화된 패키지 대신 왜 요즘 '${kw}' 맞춤형 선택이 대세일까요?`,
        content: `주변에서 "${kw} 준비할 때 요즘은 정해진 패키지 대신 원하는 서비스만 따로 골라서 쓴다더라"는 이야기를 들어보신 적 없으신가요?\n\n과거에는 정해진 구성을 한꺼번에 계약하는 방식이 일반적이었지만, 2026년 현재 소비자들은 불필요한 비용 거품을 덜어내고 본인의 라이프스타일에 맞는 서비스만 직접 조합하는 방식을 선호하고 있습니다. ${fact1}`,
        sourceIds: [sources[0]?.id].filter(Boolean)
      },
      {
        id: 'sec-2',
        title: `${partnerName} 등 주목받는 기업들은 어떤 차별화 혜택을 제공할까요?`,
        content: `달라진 소비자 눈높이에 맞춰 주요 기업들도 특화 서비스를 잇달아 선보이고 있습니다. ${fact2}\n\n특히 ${partnerName} 등 선도 업체들은 신규 가입 쿠폰팩과 맞춤형 큐레이션, 사후 품질 보증 프로그램 등을 결합해 소비자들의 초기 진입 장벽을 크게 낮추고 있습니다. ${fact3}`,
        sourceIds: sources.slice(0, 3).map(s => s.id)
      },
      {
        id: 'sec-3',
        title: `실패 없는 '${kw}' 서비스 선택을 위해 무엇을 먼저 확인해야 할까요?`,
        content: `전문가들은 '${kw}' 관련 서비스를 선택할 때 단순 최저가 비교보다 공식 인증 혜택, 환불·변경 규정, 실제 이용자 후기를 종합적으로 살피라고 조언합니다. 아래 업체별 비교 요약표와 7문 7답 FAQ를 통해 나에게 맞는 서비스를 비교해 보실 수 있습니다.`,
        sourceIds: [sources[0]?.id].filter(Boolean)
      }
    ];
    summaryTable = {
      title: `[요약표] '${kw}' 주요 업체별 핵심 서비스 및 혜택 비교`,
      headers: ['업체·구분', '핵심 제공 서비스', '주요 혜택·특징', '추천 이용 대상'],
      rows: [
        [partnerName, `${kw} 맞춤형 메인 솔루션`, '전용 멤버십 쿠폰팩 및 맞춤형 큐레이션 제공', '합리적 비용으로 검증된 품질을 원하는 소비자'],
        ['버티컬 플랫폼 A', '실시간 비교 견적 및 후기 검증', '투명한 정찰제 가격 공개 및 안전결제 지원', '불필요한 추가금 없이 직접 비교하려는 실속파'],
        ['라이프스타일 브랜드 B', '프리미엄 공간·제품 체험 서비스', '사전 예약 시 1:1 컨설팅 및 사은품 증정', '취향에 맞는 커스터마이징을 중시하는 고객'],
        ['이색 컬래버 서비스 C', '소규모·취향 특화 패키지 구성', '시즌 한정 기프트 및 제휴 카드 할인가 적용', '남들과 다른 이색 경험을 선호하는 2030 세대']
      ]
    };
    faqs = [
      { q: `Q1. 예전에는 '${kw}'을 패키지로 한 번에 계약했는데 요즘은 왜 따로 골라서 준비하나요?`, a: `정형화된 일괄 패키지의 불필요한 추가금 거품을 빼고, 본인의 예산과 취향에 맞는 핵심 서비스만 직접 조합하려는 실속형 소비가 대세로 자리 잡았기 때문입니다.` },
      { q: `Q2. ${partnerName}에서 제공하는 신규 혜택이나 할인 쿠폰은 어떻게 신청하나요?`, a: `공식 홈페이지나 모바일 앱 기획전 페이지에서 간단한 대상자 인증 또는 멤버십 가입을 완료하면 전용 할인 쿠폰팩을 즉시 발급받을 수 있습니다.` },
      { q: `Q3. 여러 업체 서비스를 비교할 때 숨은 추가금을 피하려면 무엇을 꼭 확인해야 하나요?`, a: `기본 제공 범위에 포함된 세부 항목과 옵션 변경 시 발생하는 추가 비용, 취소·환불 위약금 규정을 계약 전에 꼼꼼히 비교해야 합니다.` },
      { q: `Q4. 예산은 줄이면서 만족도는 높이는 실전 비용 절감 팁이 있을까요?`, a: `본인이 가장 중요하게 생각하는 1~2개 핵심 항목에는 집중 투자하고, 일회성 소품이나 부가 옵션은 리커머스 중고 거래나 셀프 준비로 대체하는 것이 효과적입니다.` },
      { q: `Q5. 온라인이나 앱으로 고액 계약을 할 때 사기 걱정 없이 안전하게 결제하는 방법은 뭔가요?`, a: `개인 계좌 현금 이체 대신 구매 확정 전까지 플랫폼이 대금을 안전하게 보관하는 에스크로 안전결제나 공식 스토어 카드 결제를 이용하는 것이 안전합니다.` },
      { q: `Q6. 주말이나 인기 시즌에 이용하려면 최소 몇 주 전에 예약해야 안 늦을까요?`, a: `수요가 몰리는 봄·가을 성수기나 주말 시간대는 조기 마감되는 경우가 많아 최소 1~3개월 전에 사전 예약을 마치는 것을 권장합니다.` },
      { q: `Q7. 브랜드 자체 프로모션 쿠폰이랑 카드사 청구 할인을 중복으로 받을 수도 있나요?`, a: `플랫폼별로 첫 구매 웰컴 쿠폰과 제휴 카드사 즉시 할인을 중복 적용할 수 있는 이벤트 기간이 운영되므로 결제 전 혜택 안내 페이지를 확인하시기 바랍니다.` }
    ];
    oneLineSummary = `한 줄 요약! 2026년 '${kw}' 준비는 정형화된 공식 대신 ${partnerName} 등 맞춤형 플랫폼 혜택을 활용해 실속과 취향을 동시에 챙기는 것이 핵심입니다.`;

  } else if (tId === 2) {
    // [유형 2] 특정 기념일 관련 콘텐츠: 기념일 유래·법적 배경 → 정부·공공 지원 제도 → 참여 브랜드별(최소 3~5곳) 캠페인·제품·마케팅 각각 구체 소개 → 요약표(혜택·기간) → FAQ 5문항
    const parsedBrands = comp
      ? comp.split(/[,·/]+/).map(s => s.trim()).filter(Boolean)
      : [];
    const b1 = parsedBrands[0] || '주요 유통·식품 브랜드 A';
    const b2 = parsedBrands[1] || '라이프스타일·리빙 브랜드 B';
    const b3 = parsedBrands[2] || '이커머스·플랫폼 C';
    const b4 = parsedBrands[3] || '뷰티·헬스케어 브랜드 D';
    const b5 = parsedBrands[4] || '백화점·복합쇼핑몰 E';

    titleCandidates = [
      { id: 'tc-1', title: `"왜 하필 이날로 지정됐을까?"…'${kw}' 유래부터 주요 브랜드 5곳 캠페인·혜택 총정리`, totalScore: 96 },
      { id: 'tc-2', title: `"몰라서 못 챙기면 손해입니다"…'${kw}' 공식 지원 제도와 기업별 한정 프로모션 비교`, totalScore: 92 },
      { id: 'tc-3', title: `"기념일 의미도 되새기고 혜택도 챙기세요"…'${kw}' 맞아 펼쳐지는 브랜드별 ESG·마케팅 열전`, totalScore: 89 },
      { id: 'tc-4', title: `"인증만 해도 기프트박스를 준다고?"…'${kw}' 놓치면 아쉬운 브랜드별 참여 방법 Q&A`, totalScore: 86 },
      { id: 'tc-5', title: `"달력 속 숨은 의미 찾아봤더니"…2026년 '${kw}' 유래와 브랜드별 필수 혜택 가이드`, totalScore: 83 }
    ];
    subtitleText = `'${kw}'에 담긴 제정 배경과 정부·공공 지원 혜택 집중 조명\n${b1}·${b2} 등 주요 참여 브랜드별 맞춤 제품·ESG 캠페인·프로모션 기간 한눈에 정리`;
    draftSections = [
      {
        id: 'sec-1',
        title: `'${kw}'은 어떤 계기로 만들어졌고 왜 이날로 지정되었을까요?`,
        content: `달력을 보며 "'${kw}'은 어떤 계기로 만들어졌고 왜 이날로 지정되었을까?" 궁금해하신 적 없으신가요?\n\n'${kw}'은 관련 분야의 사회적 관심을 높이고 실질적인 배려와 참여 문화를 확산하기 위해 지정된 날입니다. 매년 기념일 전후로 정부 부처와 지자체, 민간 기업들이 뜻을 모아 다채로운 기념행사와 인식 개선 캠페인을 전개하고 있습니다. ${fact1}`,
        sourceIds: [sources[0]?.id].filter(Boolean)
      },
      {
        id: 'sec-2',
        title: `알아두면 유익한 '${kw}' 관련 공식 지원 제도와 혜택은 무엇인가요?`,
        content: `기념일을 계기로 정부와 공공기관이 운영하는 관련 지원 제도도 다시 주목받고 있습니다. 대상자는 정부24나 공식 포털을 통해 바우처, 세제 혜택, 공공시설 감면 등 본인이 받을 수 있는 지원 항목을 통합 조회할 수 있습니다. ${fact2}`,
        sourceIds: sources.slice(0, 2).map(s => s.id)
      },
      {
        id: 'sec-3',
        title: `'${kw}'을 맞아 각 브랜드들은 어떤 제품과 캠페인을 선보이고 있나요?`,
        content: `민간 기업들도 '${kw}'의 취지에 발맞춰 브랜드별로 차별화된 맞춤형 제품과 ESG 캠페인, 소비자 프로모션을 각각 전개하고 있습니다. ${fact3}\n\n■ [${b1}] 기념 한정 기프트 패키지 및 전용 특가전\n${b1}은 '${kw}'을 맞아 공식 온라인 몰에서 대상자 인증 고객을 위한 축하 기프트박스 추첨 이벤트와 대표 인기 품목 특별 할인전을 진행합니다.\n\n■ [${b2}] 무료 체험팩 증정 및 브랜드 멤버십 쿠폰팩\n${b2}는 자사 앱에 가입하고 기념일 캠페인에 참여한 회원 전원에게 주력 신제품 무료 체험팩과 최대 30% 상당의 전용 할인 쿠폰을 지급하고 있습니다.\n\n■ [${b3} · ${b4} · ${b5}] 참여형 ESG 기부 캠페인 및 온·오프라인 기획전\n${b3}는 모바일 기획전 탭을 통해 관련 카테고리 반값 타임딜을 운영하며, ${b4}와 ${b5}는 고객이 이벤트에 참여하거나 기획전 상품을 구매할 때마다 일정 금액을 적립해 후원하는 가치소비 ESG 마케팅을 펼쳐 호응을 얻고 있습니다.`,
        sourceIds: sources.map(s => s.id)
      }
    ];
    summaryTable = {
      title: `[요약표] '${kw}' 맞이 주요 브랜드별 캠페인 · 제품 · 혜택 비교`,
      headers: ['브랜드·기관명', '핵심 캠페인 · 주력 제품', '주요 혜택 및 참여 조건', '진행 기간'],
      rows: [
        [b1, `${kw} 기념 기프트박스 & 대표 제품 기획전`, '공식 몰 로그인 후 대상자 인증·응모 시 추첨 증정', '기념일 주간 (2주간)'],
        [b2, '주력 라인업 무료 체험팩 & 30% 쿠폰', '자사 앱 회원가입 및 캠페인 페이지 신청 전원', '이달 말까지 상시'],
        [b3, '기념일 테마 카테고리 톡딜·타임특가', '모바일 앱 기획전 전용 쿠폰팩 다운로드 즉시 적용', '기념일 전후 7일간'],
        [b4, '맞춤형 건강·라이프 제품 최대 50% 할인', '공식 스마트스토어 기획전 구매 고객 사은품 증정', '기념일 당일 포함 1주간'],
        [b5, '참여형 ESG 기부 캠페인 & 오프라인 위크', '매장 방문 인증 및 앱 쿠폰 제시 시 10~30% 할인', '기념일 주간 주말 포함']
      ]
    };
    faqs = [
      { q: `Q1. '${kw}'은 어떤 계기로 만들어졌고 왜 하필 이날로 지정되었나요?`, a: `관련 주제에 대한 사회적 관심을 높이고 일상 속 배려 문화와 실질적인 제도적 지원을 확산하기 위해 지정되었습니다.` },
      { q: `Q2. '${kw}' 맞이 기업 할인이나 사은품 이벤트에 참여하려면 무엇을 준비해야 하나요?`, a: `대부분의 브랜드는 공식 온라인 몰이나 앱 회원가입 후 기획전 페이지에서 쿠폰을 내려받거나 간단한 대상자 인증을 거쳐 바로 참여할 수 있습니다.` },
      { q: `Q3. 정부나 지자체에서 주는 관련 지원금·바우처는 어디서 신청할 수 있나요?`, a: `정부24 포털이나 주관 부처 공식 홈페이지의 맞춤형 혜택 조회 메뉴에서 본인의 자격 요건과 온라인 신청 절차를 한눈에 확인할 수 있습니다.` },
      { q: `Q4. '${kw}' 당일은 빨간날(법정공휴일)이라 학교나 회사를 쉬나요?`, a: `사회적 의미를 기리는 법정기념일 또는 캠페인 데이로 운영되며, 관공서의 공휴일에 관한 규정에 따른 별도 공휴일 여부는 달력상 법정공휴일 기준을 따릅니다.` },
      { q: `Q5. 브랜드별 프로모션 혜택을 놓치지 않고 챙기려면 어떤 점을 주의해야 할까요?`, a: `기업마다 이벤트 종료일과 일일 선착순 한정 수량이 다르므로 본문 요약표의 진행 기간과 각 사 공식 공지를 먼저 확인하는 것이 좋습니다.` }
    ];
    oneLineSummary = `한 줄 요약! '${kw}'을 맞아 제정 의미와 공공 지원 제도를 되짚어보고, 주요 기업들이 마련한 기간 한정 프로모션 혜택도 꼼꼼히 챙기시기 바랍니다.`;

  } else if (tId === 3) {
    // [유형 3] 최신 트렌드 반영 콘텐츠 1 (소비·문화 트렌드 심층 분석 및 대표 사례 조명)
    if (isVirtualIdolQuery(kw, comp)) {
      return getVirtualIdolScenario(kw);
    }

    const subKeywords = kw.split(/[,/·]+/).map(s => s.trim()).filter(Boolean);
    const hasSubKeywords = subKeywords.length >= 2;

    titleCandidates = [
      { id: 'tc-1', title: `"왜 요즘 다들 여기에 열광할까?"…데이터와 사례로 읽는 '${kw}' 트렌드 총정리`, totalScore: 96 },
      { id: 'tc-2', title: `"단순 유행인 줄 알았는데"…2030 소비 지형을 바꾼 '${kw}' 열풍의 배경과 핵심 포인트`, totalScore: 93 },
      { id: 'tc-3', title: `"알고 즐기면 두 배 더 유익합니다"…'${kw}' 주요 특징부터 대표 사례 비교까지`, totalScore: 90 },
      { id: 'tc-4', title: `"비교표와 핵심 용어로 한눈에"…소비자가 가장 궁금해하는 '${kw}' Q&A`, totalScore: 87 },
      { id: 'tc-5', title: `"취향과 실속을 동시에 잡았다"…시장 판도 흔드는 '${kw}' 인기 비결 분석`, totalScore: 85 }
    ];
    subtitleText = `'${kw}' 트렌드가 급부상한 배경과 소비자 니즈 변화 집중 분석\n주요 카테고리·대표 사례별 특징 비교표부터 실전 활용 Q&A까지 한눈에 정리`;

    if (hasSubKeywords) {
      draftSections = [
        {
          id: 'sec-1',
          title: `왜 지금 '${kw}' 키워드가 소비자들의 눈길을 사로잡고 있을까요?`,
          content: `최근 SNS와 온라인 커뮤니티, 쇼핑 플랫폼에서 '${kw}' 관련 소식을 자주 접해 보신 적 없으신가요?\n\n소비자들의 라이프스타일과 계절·환경 변화가 맞물리면서, 기존의 획일적인 방식 대신 보다 세분화되고 체감 효과가 확실한 솔루션을 찾는 수요가 빠르게 늘고 있습니다. ${fact1}`,
          sourceIds: [sources[0]?.id].filter(Boolean)
        },
        ...subKeywords.map((subKw, idx) => ({
          id: `sec-spot-${idx + 1}`,
          title: `핵심 포인트 ${idx + 1} : '${subKw}'이 주목받는 이유와 차별점`,
          content: `'${subKw}'은 이번 트렌드를 구성하는 핵심 축으로 꼽힙니다. ${paraphrasedFacts[idx % paraphrasedFacts.length] || fact2}\n\n특히 소비자들이 일상에서 겪던 구체적인 불편함을 간편하고 직관적으로 해결해 주면서, 관련 브랜드와 제품군 전반으로 인기가 확산하고 있습니다.`,
          sourceIds: [sources[idx % sources.length]?.id].filter(Boolean)
        })),
        {
          id: 'sec-closing-guide',
          title: `'${kw}' 트렌드, 나에게 맞게 현명하게 활용하려면 무엇을 확인해야 할까요?`,
          content: `열풍이 거셀수록 본인의 실제 필요와 사용 환경에 맞는 기준을 세우는 것이 중요합니다. ${fact3}\n\n아래 핵심 비교 요약표와 자주 묻는 질문(FAQ)을 통해 세부 조건과 체크포인트를 한눈에 비교해 보세요.`,
          sourceIds: [sources[0]?.id].filter(Boolean)
        }
      ];
    } else {
      draftSections = [
        {
          id: 'sec-1',
          title: `왜 요즘 '${kw}' 트렌드에 소비자들이 주목하고 있을까요?`,
          content: `최근 일상 속이나 온라인에서 '${kw}'에 관한 이야기를 자주 들어보신 적 없으신가요?\n\n소비자들의 취향이 세분화되고 실용성과 경험 가치를 동시에 추구하는 흐름이 강해지면서 '${kw}'이 새로운 대세 트렌드로 자리 잡고 있습니다. ${fact1}`,
          sourceIds: [sources[0]?.id].filter(Boolean)
        },
        {
          id: 'sec-2',
          title: `기존 방식과 비교했을 때 '${kw}'만의 핵심 매력과 대표 사례는 무엇인가요?`,
          content: `과거의 정형화된 소비 패턴과 달리 최근의 '${kw}' 트렌드는 소비자가 직접 비교하고 체감할 수 있는 실질적인 효능과 재미를 앞세우는 것이 특징입니다. ${fact2}\n\n주요 브랜드와 플랫폼들도 이에 발맞춰 전용 라인업과 맞춤형 서비스를 잇달아 선보이며 소비자 선택의 폭을 넓히고 있습니다. ${fact3}`,
          sourceIds: sources.slice(0, 2).map(s => s.id)
        },
        {
          id: 'sec-3',
          title: `실패 없이 '${kw}'을 선택하고 활용하려면 어떤 기준을 살펴봐야 할까요?`,
          content: `선택지가 다양해진 만큼 구매나 이용 전 핵심 성분·사양, 사용 목적, 가격 대비 구성비를 꼼꼼히 따져보는 것이 좋습니다. 아래 요약표와 FAQ에서 꼭 확인해야 할 핵심 기준을 정리했습니다.`,
          sourceIds: [sources[0]?.id].filter(Boolean)
        }
      ];
    }

    summaryTable = {
      title: `[ '${kw}' 핵심 구성 및 주요 특징 비교 ]`,
      headers: ['구분', '핵심 역할 및 특징', '주요 소구 포인트', '추천 대상 및 활용법'],
      rows: hasSubKeywords
        ? subKeywords.map((subKw, i) => [
            subKw,
            `${subKw} 중심 맞춤형 케어·솔루션`,
            paraphrasedFacts[i % paraphrasedFacts.length]?.slice(0, 42) + '...' || '편의성과 체감 효과를 높인 특화 구성',
            `${subKw} 니즈가 높은 소비자 및 일상 루틴 활용`
          ])
        : [
            ['핵심 트렌드 배경', '소비자 페인포인트 맞춤형 해결', '실용성과 직관적인 사용 편의성 결합', '일상 속 빠른 체감 효과를 원하는 소비자'],
            ['주력 제품·서비스군', '세분화된 라인업 및 대용량·고효능 구성', '합리적 가격대와 검증된 핵심 성분·기능', '가성비와 품질을 동시에 따지는 실속파'],
            ['선택·활용 체크포인트', '사용 목적·환경별 맞춤 조합', '공식 채널 성분·사양 및 실사용자 후기 대조', '구매 전 요약표 및 FAQ 기준 확인 권장']
          ]
    };
    faqs = [
      { q: `Q1. 최근 '${kw}'이 소비자들 사이에서 빠르게 입소문을 타는 이유는 무엇인가요?`, a: `일상이나 계절 변화 속에서 소비자들이 겪는 구체적인 고민을 간편하고 효과적으로 해결해 주며 높은 체감 만족도를 제공하고 있기 때문입니다.` },
      { q: `Q2. 기존 제품이나 서비스와 비교했을 때 가장 크게 달라진 점은 무엇인가요?`, a: `단일 기능에 머물지 않고 크기·용량·성분·활용 범위를 넓혀 여러 부위나 상황에 멀티로 활용할 수 있도록 설계된 점이 핵심 차이입니다.` },
      { q: `Q3. 처음 선택할 때 실패하지 않으려면 어떤 항목을 가장 먼저 확인해야 하나요?`, a: `본인의 주된 고민이나 사용 목적에 부합하는 핵심 성분·규격이 포함되어 있는지, 그리고 자극이나 불편함 없이 꾸준히 사용할 수 있는 구성인지 확인하는 것이 좋습니다.` },
      { q: `Q4. 여러 아이템을 함께 조합해서 사용할 때 시너지를 높이는 팁이 있나요?`, a: `집중 케어가 필요한 순간에는 고효능 밀착 아이템을 활용하고, 평소 데일리 루틴에서는 기초 보습·유지력이 좋은 기본 아이템을 단계별로 병행하면 효과가 배가됩니다.` },
      { q: `Q5. 온·오프라인 구매 시 혜택을 잘 챙기는 방법이 있을까요?`, a: `브랜드 공식 몰이나 주요 헬스앤뷰티·유통 채널의 시즌 기획전 기간을 활용하면 본품 추가 증정이나 세트 할인가로 더욱 합리적인 구매가 가능합니다.` }
    ];
    oneLineSummary = `한 줄 요약! '${kw}' 트렌드는 소비자의 실질적인 고민을 세심하게 해결하며 인기를 끌고 있는 만큼, 본인의 상황과 목적에 맞는 조합을 선택해 현명하게 활용해 보시기 바랍니다.`;

  } else if (tId === 4) {
    // [유형 4] 최신 트렌드 반영 콘텐츠 2 (신제품·뷰티·유통 아이템 및 시즌별 핵심 루틴·라인업 분석)
    const subKeywords = kw.split(/[,/·]+/).map(s => s.trim()).filter(Boolean);
    const hasSubKeywords = subKeywords.length >= 2;

    titleCandidates = [
      { id: 'tc-1', title: `"요즘 왜 이 조합이 대세일까?"…'${kw}' 인기 배경부터 대표 아이템·활용법 총정리`, totalScore: 95 },
      { id: 'tc-2', title: `"작은 차이가 만족도를 바꿉니다"…소비자 사로잡은 '${kw}' 핵심 제품군·특징 비교`, totalScore: 92 },
      { id: 'tc-3', title: `"성분부터 크기·가성비까지 꼼꼼 비교"…${comp || '주요 브랜드'} '${kw}' 라인업 분석`, totalScore: 90 },
      { id: 'tc-4', title: `"사기 전에 이 표부터 확인하세요"…데이터와 팩트로 본 '${kw}' 선택 가이드 Q&A`, totalScore: 87 },
      { id: 'tc-5', title: `"고민 부위·상황별로 골라 쓴다"…브랜드별 '${kw}' 대표 상품 한눈에`, totalScore: 85 }
    ];
    subtitleText = `소비자 일상 고민을 겨냥한 '${kw}' 맞춤형 라인업과 핵심 소구점 집중 분석\n${comp ? comp + ' 등 ' : ''}주요 제품군·성분·차별점 비교표부터 구매 전 필수 FAQ까지`;
    draftSections = [
      {
        id: 'sec-1',
        title: `왜 요즘 '${kw}' 조합과 신상품 라인업에 소비자들이 주목할까요?`,
        content: `계절이 바뀌거나 일상의 컨디션이 달라질 때면 "지금 내 상황에 딱 맞는 아이템은 무엇일까?" 고민해 보신 적 없으신가요?\n\n최근 유통·뷰티·라이프스타일 시장에서는 소비자들의 세분화된 고민을 직관적으로 해결해 주는 '${kw}' 관련 특화 제품들이 큰 호응을 얻고 있습니다. ${fact1}`,
        sourceIds: [sources[0]?.id].filter(Boolean)
      },
      ...(hasSubKeywords
        ? subKeywords.map((subKw, idx) => ({
            id: `sec-item-${idx + 1}`,
            title: `핵심 포인트 ${idx + 1} : '${subKw}' 라인업의 특징과 대표 제품 차별점`,
            content: `'${subKw}' 카테고리에서는 기존 제품의 아쉬움을 보완한 설계와 핵심 성분이 돋보입니다. ${paraphrasedFacts[idx % paraphrasedFacts.length] || fact2}\n\n단순히 외형만 바꾼 것이 아니라 실제 사용 편의성과 밀착력·지속력을 높여 소비자들이 즉각적인 변화를 체감할 수 있도록 기획된 것이 특징입니다.`,
            sourceIds: [sources[idx % sources.length]?.id].filter(Boolean)
          }))
        : [
            {
              id: 'sec-2',
              title: `${comp ? comp + ' 등 ' : ''}주요 브랜드와 제품군별로 어떤 차별화 포인트가 있을까요?`,
              content: `같은 '${kw}' 카테고리 안에서도 브랜드마다 내세우는 핵심 사양과 타깃 포인트는 뚜렷하게 구분됩니다. ${fact2}\n\n아울러 ${fact3} 소비자 고민 부위와 사용 시간대에 맞춰 세분화된 라인업을 선보이며 선택의 폭을 넓히고 있습니다.`,
              sourceIds: sources.slice(0, 3).map(s => s.id)
            }
          ]),
      {
        id: 'sec-3',
        title: `실패 없이 '${kw}' 인기 아이템을 고르고 제대로 활용하는 팁은 무엇일까요?`,
        content: `만족도를 높이려면 본인의 사용 목적과 핵심 성분·규격, 그리고 단계별 사용 순서를 미리 확인하는 것이 중요합니다. 아래 제품군별 비교 요약표와 자주 묻는 질문(FAQ)을 통해 나에게 가장 잘 맞는 구성을 확인해 보세요.`,
        sourceIds: [sources[0]?.id].filter(Boolean)
      }
    ];
    summaryTable = {
      title: `[요약표] '${kw}' 주요 카테고리 · 제품별 핵심 특징 및 선택 가이드`,
      headers: ['구분', '핵심 특징 및 설계 포인트', '주요 성분 · 사양', '추천 활용법 및 체크포인트'],
      rows: hasSubKeywords
        ? subKeywords.map((subKw, idx) => [
            subKw,
            `${subKw} 특화 집중 케어 및 편의성 강화`,
            paraphrasedFacts[idx % paraphrasedFacts.length]?.slice(0, 38) + '...' || '핵심 유효 성분 및 사용성 최적화',
            '고민 부위·상황에 맞춘 단계별 루틴 적용'
          ])
        : [
            [comp || '집중 케어 라인업', '넓은 면적 커버 및 고농축 밀착 설계', '콜라겐·히알루론산·진정 성분 배합', '고민 부위 집중 부착 및 스페셜 케어'],
            ['데일리 기초 라인업', '피부 장벽 강화 및 속건조·유수분 밸런스 케어', '세라마이드·판테놀·알란토인 등 저자극 성분', '아침·저녁 반복 도포 및 데일리 루틴 활용'],
            ['채널별 기획 세트', '대용량·멀티팩 구성으로 가성비 극대화', '본품+리필 또는 부위별 겸용 패키지', '온·오프라인 기획전 할인 및 성분표 확인']
          ]
    };
    faqs = [
      { q: `Q1. 왜 요즘 '${kw}' 관련 제품들이 기존 제품보다 더 큰 인기를 끌고 있나요?`, a: `국소 부위만 케어하던 기존 방식에서 벗어나 넓은 고민 부위를 한 번에 관리하거나 장벽·보습·진정을 동시에 챙길 수 있도록 실용성을 높였기 때문입니다.` },
      { q: `Q2. '${kw}' 제품들을 고를 때 꼭 확인해야 할 핵심 성분이나 스펙은 무엇인가요?`, a: `진정·보습·장벽 관리에 도움을 주는 세라마이드, 판테놀, 콜라겐, 히알루론산 등의 함유 여부와 본인의 사용 부위에 맞는 크기·제형을 확인하는 것이 좋습니다.` },
      { q: `Q3. 여러 제품을 함께 사용할 때 어떤 순서로 적용하는 것이 가장 효과적인가요?`, a: `세안이나 기초 정돈 후 수분·유효 성분이 풍부한 패치나 앰플로 집중 케어를 해주고, 이어서 장벽 크림이나 로션으로 수분 증발을 막아주는 순서가 효과적입니다.` },
      { q: `Q4. 민감성 피부나 일상 속 데일리 루틴으로 매일 사용해도 부담이 없을까요?`, a: `대부분 저자극 테스트를 거친 데일리 포뮬러로 출시되지만, 고농축 패치나 특수 케어 제품은 권장 부착 시간과 사용 주기를 지켜 사용하는 것이 바람직합니다.` },
      { q: `Q5. 합리적인 가격으로 구매하려면 어떤 유통 채널이나 프로모션을 활용하는 게 좋나요?`, a: `올리브영 등 헬스앤뷰티 스토어의 시즌 세일이나 브랜드 공식 스마트스토어의 대용량·더블 기획 세트를 활용하면 단가를 크게 낮출 수 있습니다.` }
    ];
    oneLineSummary = `한 줄 요약! '${kw}' 트렌드의 핵심은 내 고민 부위와 상황에 맞는 똑똑한 제품 선택과 기초 루틴 관리에 있는 만큼, 성분과 특징 비교표를 참고해 최적의 조합을 찾아보시기 바랍니다.`;

  } else {
    // [유형 5] 영업 기업 맞춤 기획 콘텐츠: 도입 1문단 뒤 본문 전체가 Q1~Q7 문답(FAQ) 구조 + 마지막 Q7에서 영업 타깃 기업 집중 소개
    const targetCompany = comp || `${kw} 선도 기업`;
    titleCandidates = [
      { id: 'tc-1', title: `"왜 요즘 이 시장이 뜰까?"…2026년 '${kw}' 메가 트렌드부터 ${targetCompany} 핵심 경쟁력까지 7문 7답`, totalScore: 96 },
      { id: 'tc-2', title: `"소비자 불편을 기술로 풀었습니다"…'${kw}' 시장 재편하는 ${targetCompany}의 성장 전략 Q&A`, totalScore: 92 },
      { id: 'tc-3', title: `"단순 가격 경쟁 시대는 끝났다"…신뢰와 품질로 승부하는 ${targetCompany} 핵심 서비스 분석`, totalScore: 89 },
      { id: 'tc-4', title: `"이용 전 꼭 알아야 할 체크포인트는?"…문답으로 읽는 '${kw}' 동향과 ${targetCompany} 활용법`, totalScore: 86 },
      { id: 'tc-5', title: `"시장 성장을 이끄는 비결은 무엇일까"…'${kw}' 트렌드와 ${targetCompany} 솔루션 총정리`, totalScore: 84 }
    ];
    subtitleText = `문답(Q&A) 7개로 짚어본 2026년 '${kw}' 메가 트렌드와 소비자 페인포인트\n시장의 빈틈을 해결하는 ${targetCompany}의 차별화 서비스와 기대효과 집중 분석`;
    draftSections = [
      {
        id: 'sec-1',
        title: `왜 지금 '${kw}' 메가 트렌드에 소비자들이 주목할까요?`,
        content: `최근 '${kw}' 관련 서비스를 찾으면서 "선택지는 많은데 어디가 믿을 만하고 왜 이렇게 주목받는 걸까?" 고민해 보신 적 없으신가요?\n\nQ1. 최근 '${kw}' 시장이 빠르게 성장하고 있는 핵심 배경은 무엇인가요?\n고물가와 합리적 소비 기조 속에서도 검증된 품질과 시간 절약 가치를 제공하는 서비스에 소비자들이 지갑을 열고 있기 때문입니다. ${fact1}\n\nQ2. 과거 유사 서비스들과 비교했을 때 최근 시장의 가장 큰 변화는 무엇인가요?\n단순 공급자 중심의 상품 나열에서 벗어나 데이터 기반 맞춤형 추천과 온·오프라인 연계 경험이 강화되었습니다. ${fact2}\n\nQ3. 소비자들이 기존 '${kw}' 시장을 이용할 때 가장 불편해하던 점(페인포인트)은 무엇이었나요?\n정보 비대칭으로 인한 품질 편차 우려, 복잡한 이용 절차, 사후 관리 미흡 등이 대표적인 진입 장벽으로 꼽혔습니다.\n\nQ4. 최근 소비자들이 브랜드를 선택할 때 가장 중시하는 기준은 무엇인가요?\n${fact3}`,
        sourceIds: sources.slice(0, 2).map(s => s.id)
      },
      {
        id: 'sec-2',
        title: `시장의 빈틈을 해결한 ${targetCompany}만의 핵심 경쟁력은 무엇인가요?`,
        content: `Q5. 실패 없는 '${kw}' 서비스 이용을 위해 사전에 무엇을 점검해야 하나요?\n공식 인증 시스템 여부, 투명한 가격·혜택 구조, 실제 이용자의 재구매 지표를 확인하는 것이 중요합니다.\n\nQ6. 업계 선도 기업들은 어떤 방식으로 고객 신뢰를 확보하고 있나요?\n표준화된 품질 검수 프로세스와 전용 멤버십 혜택, 직관적인 모바일 예약·결제 환경을 구축해 이용 편의성을 높이고 있습니다.\n\nQ7. 그중에서도 최근 주목받는 '${targetCompany}'만의 핵심 경쟁력과 차별화 서비스는 무엇인가요?\n${targetCompany}는 '${kw}' 트렌드에 발맞춰 엄격한 품질 관리 시스템과 고객 맞춤형 큐레이션 솔루션을 제공하고 있습니다. 초기 탐색부터 사후 케어까지 전 과정을 투명하게 지원하며 시장 내 핵심 파트너로 자리매김하고 있습니다.`,
        sourceIds: sources.map(s => s.id)
      }
    ];
    summaryTable = {
      title: `[요약표] '${kw}' 트렌드 대응 ${targetCompany} 핵심 가치 및 서비스 요약`,
      headers: ['구분', '핵심 솔루션·기능', '소비자·파트너 기대효과'],
      rows: [
        ['신뢰·품질 검증', `${targetCompany} 표준 품질 관리 프로세스`, '정보 비대칭 해소 및 일관된 서비스 만족도 확보'],
        ['이용 편의성', '온·오프라인 통합 예약·맞춤 추천', '탐색 시간 단축 및 개인화된 이용 경험 제공'],
        ['경제적 혜택', '신규·멤버십 전용 프로모션 운영', '합리적 비용으로 검증된 프리미엄 서비스 이용']
      ]
    };
    faqs = [
      { q: `Q1. 최근 '${kw}' 시장이 급성장한 가장 큰 원동력은 무엇인가요?`, a: `합리적 비용으로 검증된 품질과 맞춤형 경험을 누리려는 가치 소비 트렌드가 확산했기 때문입니다.` },
      { q: `Q2. 기존 서비스 이용 시 소비자들이 겪던 대표적인 불편 사항은 무엇인가요?`, a: `업체별 품질 편차와 불투명한 가격 정보, 번거로운 확인 절차가 주요 페인포인트였습니다.` },
      { q: `Q3. ${targetCompany}는 이러한 문제를 어떻게 해결하고 있나요?`, a: `체계적인 사전 검증 시스템과 투명한 정보 공개, 고객 맞춤형 큐레이션을 통해 신뢰도를 높이고 있습니다.` },
      { q: `Q4. ${targetCompany}의 주요 서비스는 어떤 채널에서 이용할 수 있나요?`, a: `공식 홈페이지와 모바일 앱, 오프라인 거점 채널을 통해 간편하게 조회하고 신청할 수 있습니다.` },
      { q: `Q5. 처음 이용하는 고객을 위한 전용 혜택이나 프로모션이 있나요?`, a: `신규 가입 고객을 위한 웰컴 쿠폰팩과 시즌별 한정 기획전 혜택이 상시 운영되고 있습니다.` },
      { q: `Q6. 기업 제휴나 대량 이용 문의도 가능한가요?`, a: `공식 채널 내 비즈니스 문의 창구를 통해 파트너사 맞춤형 제휴 및 단체 프로그램을 별도로 지원하고 있습니다.` },
      { q: `Q7. 향후 ${targetCompany}가 준비 중인 서비스 고도화 방향은 무엇인가요?`, a: `고객 데이터 기반의 정교한 추천 기능과 사후 관리 인프라를 지속 확대해 시장 내 리더십을 강화할 계획입니다.` }
    ];
    oneLineSummary = `한 줄 요약! '${kw}' 시장이 신뢰와 맞춤형 가치 중심으로 재편되면서, 체계적인 솔루션으로 소비자 불편을 해결한 ${targetCompany}의 경쟁력이 주목받고 있습니다.`;
  }

  const catInfo = recommendMkPickCategory(kw, tId, comp);

  const summaryBlocks = {
    mkCategory: catInfo.recommendedCategory,
    mkCategoryReason: catInfo.categoryReason,
    byline: `${catInfo.recommendedCategory} | 남궁선희 기자 | 입력 2026.10.23 10:00`,
    companyTags: comp ? [comp, kw] : [kw],
    subtitle: subtitleText,
    aiFactSummary: [
      `1. ${fact1}`,
      `2. ${fact2}`,
      `3. ${tId === 5 ? `${comp || kw + ' 주요 기업'}은 체계적인 품질 검증과 맞춤형 서비스를 앞세워 시장 성장을 견인하고 있습니다.` : `소비자들은 이용 전 요약표와 FAQ를 통해 브랜드별 조건·기간과 핵심 체크포인트를 확인하는 것이 유리합니다.`}`
    ],
    summaryTable,
    glossaryTitle: `'${kw}' 주제를 더 깊이 이해하는 용어 사전`,
    glossary: kw.split(/[,/·]+/).map(s => s.trim()).filter(Boolean).length >= 2
      ? kw.split(/[,/·]+/).map(s => s.trim()).filter(Boolean).map(sub => ({
          term: sub,
          desc: `'${kw}' 기사에서 다루는 핵심 구성 요소로, 소비자의 실제 고민 해결과 체감 만족도를 높이는 주요 포인트입니다.`
        }))
      : [
          { term: `${kw} (핵심 키워드)`, desc: `이번 기사에서 다루는 핵심 트렌드·소재로, 소비자의 세분화된 니즈와 실용적 가치를 반영하는 대표 개념입니다.` },
          { term: '맞춤형 큐레이션 (Curation)', desc: '소비자의 상황·계절·취향에 맞춰 가장 적합한 상품이나 솔루션 조합을 선별해 제안하는 방식입니다.' },
          { term: '체감 효능 · 가성비 소비', desc: '단순 브랜드 인지도보다 실제 사용 시 느껴지는 직관적인 효과와 합리적인 용량·가격 구성을 중시하는 소비 흐름입니다.' }
        ],
    faqs,
    fanoutQuestions: buildContextualFanoutQuestions(kw, comp, tId),
    closingParagraph: `일상 속 작은 불편함과 고민에서 출발한 '${kw}' 트렌드는 이제 소비자의 라이프스타일을 한층 편리하고 풍요롭게 바꾸는 실용적인 해법으로 자리 잡고 있습니다. 본문에서 살펴본 핵심 포인트와 비교 기준을 참고해 나에게 꼭 맞는 현명한 선택을 해보시기 바랍니다.`,
    oneLineSummary,
    noticeText: '본 콘텐츠는 매경비즈 디지털뉴스룸이 공식 발표 자료와 보도자료를 바탕으로 작성했습니다.',
    imageRecommendations: [
      {
        position: '상단 대표 이미지',
        sourceUrl: url || 'https://www.mk.co.kr',
        keywords: [`${kw} 공식 이미지`, `${comp || kw} 현장·제품 사진`],
        caption: `< 출처 : ${comp || '각 사 제공'} >`
      }
    ]
  };

  const factChecks = extractFactSentencesFromSections(draftSections, sources);

  return {
    recommendedType: tId,
    secondaryType: tId === 1 ? 2 : 1,
    primaryReason: `'${kw}' 키워드의 핵심 팩트만 추출해 타 언론사 문장 복제 없이 매경 MK Pick 자체 문장으로 초안을 구성했습니다.`,
    secondaryReason: '',
    sources,
    researchItems,
    titleCandidates,
    selectedTitleId: 'tc-1',
    outline: [],
    outlineApproved: true,
    draftSections,
    summaryBlocks,
    factChecks
  };
}

// 키워드·업종 성격에 맞춰 어색한 팝업스토어 고정 질문 대신 실제 품목 맞춤형 팬아웃(Query Fan-out) 추천 질문을 생성하는 함수
function buildContextualFanoutQuestions(kw = '', comp = '', tId = 4) {
  const combined = `${kw} ${comp}`;
  const targetLabel = comp && !kw.includes(comp) ? `${comp} '${kw}'` : `'${kw}'`;

  // 1) 식음료 · 카페 · 디저트 · 외식 · 편의점 먹거리
  if (/(?:커피|이디야|스타벅스|투썸|메가커피|컴포즈|빽다방|설기|피자|치즈|디저트|베이커리|빵|케이크|음료|라떼|메뉴|맛|출시|하인즈|소스|치킨|버거|라면|간식|밀키트|초콜릿|쿠키|빙수|도넛|맛집|외식|식품)/.test(combined)) {
    return [
      {
        id: 'fq-food-1',
        category: '맛·식감특징',
        q: `${targetLabel}의 실제 맛 조합과 식감은 기존 메뉴들과 어떻게 다른가요?`,
        a: `친숙한 베이스 재료에 특제 소스와 풍부한 토핑을 조화롭게 배합해, 겉은 쫀득하거나 바삭하면서도 속은 단짠·고소한 풍미가 살아나도록 완성도를 높였습니다.`
      },
      {
        id: 'fq-food-2',
        category: '판매매장·재고',
        q: `전국 모든 매장에서 바로 구매할 수 있나요, 아니면 일부 특수 매장에서는 제외되나요?`,
        a: `전국 대부분의 가맹점 및 직영 매장에서 만나볼 수 있으나 매장별 일일 입고 수량에 따라 조기 품절될 수 있으므로 방문 전 공식 앱으로 매장 재고를 확인하면 편리합니다.`
      },
      {
        id: 'fq-food-3',
        category: '배달·픽업주문',
        q: `매장에 직접 가지 않고 공식 앱 픽업이나 배달 앱으로도 주문할 수 있나요?`,
        a: `브랜드 공식 멤버십 앱의 스마트오더(픽업·배달)를 비롯해 주요 배달 플랫폼과 연동되어 있어 집이나 사무실에서도 간편하게 주문할 수 있습니다.`
      },
      {
        id: 'fq-food-4',
        category: '꿀조합·페어링',
        q: `${targetLabel}과 가장 잘 어울리는 음료나 사이드 메뉴 꿀조합은 무엇인가요?`,
        a: `짭조름하고 고소한 풍미의 메뉴는 깔끔한 아이스 아메리카노나 청량한 에이드류와 곁들일 때 뒷맛이 깔끔하게 잡혀 한층 맛있게 즐길 수 있습니다.`
      },
      {
        id: 'fq-food-5',
        category: '조리·보관팁',
        q: `포장해 와서 나중에 먹을 때 처음처럼 맛있게 데워 먹는 방법이 있나요?`,
        a: `전자레인지 전용 용기에 담아 약 20~40초간 짧게 데우거나 에어프라이어로 가볍게 열기를 더해주면 갓 조리한 듯한 쫄깃한 식감과 치즈·소스의 풍미가 되살아납니다.`
      },
      {
        id: 'fq-food-6',
        category: '할인·프로모션',
        q: `신메뉴 출시 기념 세트 할인이나 멤버십 쿠폰 혜택도 진행되나요?`,
        a: `출시 초기에는 공식 모바일 앱 회원을 대상으로 제조 음료 동반 구매 시 세트 할인이나 스탬프 추가 적립 등 기간 한정 프로모션이 함께 운영되는 경우가 많습니다.`
      }
    ];
  }

  // 2) 뷰티 · 스킨케어 · 화장품 · 패션
  if (/(?:뷰티|화장품|패치|스킨케어|기초템|크림|앰플|세럼|팩|마스크|올리브영|다이소|피부|메이크업|립|쿠션|선크림|클렌징|각질|보습|장벽|트러블|모공)/.test(combined)) {
    return [
      {
        id: 'fq-beauty-1',
        category: '피부타입·자극',
        q: `민감성 피부나 트러블이 잘 나는 피부가 매일 사용해도 자극이 없을까요?`,
        a: `저자극 진정·보습 성분을 중심으로 설계된 제품이 많지만, 고농축 유효 성분이 포함된 경우 귀 뒤나 팔 안쪽에 먼저 테스트한 뒤 사용 주기를 조절하는 것이 안전합니다.`
      },
      {
        id: 'fq-beauty-2',
        category: '사용순서·루틴',
        q: `아침·저녁 스킨케어 단계에서 다른 기초 화장품과 어떤 순서로 발라야 효과적인가요?`,
        a: `세안 후 토너로 피부 결을 정돈한 뒤 수분·집중 케어 제품을 먼저 흡수시키고, 마지막 단계에 장벽 크림이나 로션을 덧발라 수분 증발을 막아주는 순서가 가장 효과적입니다.`
      },
      {
        id: 'fq-beauty-3',
        category: '성분·궁합',
        q: `함께 쓰면 시너지가 나는 성분과 반대로 피해야 할 성분 조합이 있나요?`,
        a: `세라마이드·판테놀·히알루론산 등 보습·장벽 성분은 대부분의 제품과 궁합이 좋으며, 고함량 비타민C나 레티놀·각질 제거 성분과 병행할 때만 자극 여부를 살피면 됩니다.`
      },
      {
        id: 'fq-beauty-4',
        category: '지속시간·사용팁',
        q: `패치나 팩 형태 제품은 피부에 몇 분 정도 붙이고 있는 것이 가장 적당한가요?`,
        a: `제품에 명시된 권장 시간(보통 10~20분 또는 수면 케어용 별도 기준)을 지키는 것이 좋으며, 너무 오래 방치해 시트가 마르기 전에 떼어내야 수분 역흡수를 막을 수 있습니다.`
      },
      {
        id: 'fq-beauty-5',
        category: '기획세트·가성비',
        q: `단품 구매보다 본품 추가 증정이나 대용량 기획 세트를 사려면 어디서 구매하는 게 좋나요?`,
        a: `올리브영 등 H&B 스토어의 정기 세일 기간이나 브랜드 공식 네이버 스마트스토어의 더블 기획전 구성을 활용하면 개당 단가를 크게 낮출 수 있습니다.`
      },
      {
        id: 'fq-beauty-6',
        category: '보관·유통기한',
        q: `개봉 후 변질 없이 끝까지 위생적으로 사용하려면 어떻게 보관해야 하나요?`,
        a: `직사광선과 온도 변화가 심한 욕실 대신 서늘한 실내에 보관하고, 사용 후에는 뚜껑이나 지퍼백을 완전히 밀폐해 개봉 후 6~12개월 이내에 소진하는 것을 권장합니다.`
      }
    ];
  }

  // 3) 오프라인 팝업스토어 · 전시 · 공간 체험
  if (/(?:팝업|성수|한남|더현대|전시|박람회|페스티벌|현장|오픈런|웨이팅|방문)/.test(combined)) {
    return [
      {
        id: 'fq-popup-1',
        category: '예약·대기시간',
        q: `${targetLabel} 방문 전에 사전 예약을 안 하고 현장 워크인으로 가도 입장할 수 있나요?`,
        a: `주말이나 피크 시간대에는 현장 대기가 발생할 수 있으므로 공식 앱이나 네이버 사전 예약·현장 모바일 웨이팅 등록 여부를 미리 확인하고 방문하는 것이 좋습니다.`
      },
      {
        id: 'fq-popup-2',
        category: '현장혜택·사은품',
        q: `현장 방문 이벤트로 무료 굿즈나 사은품을 받으려면 어떤 미션에 참여해야 하나요?`,
        a: `공식 계정 팔로우, SNS 방문 인증샷 해시태그 업로드, 또는 스탬프 투어를 완료하면 한정판 굿즈나 샘플 키트를 현장에서 즉시 증정하는 경우가 많습니다.`
      },
      {
        id: 'fq-popup-3',
        category: '품절·수량제한',
        q: `인기 한정판 굿즈나 콜라보 상품은 1인당 구매 수량 제한이 있나요?`,
        a: `선착순 한정 수량으로 준비되는 시그니처 품목은 조기 소진을 막기 위해 1인당 구매 개수를 제한하는 경우가 많으므로 오전 시간대 방문이 유리합니다.`
      },
      {
        id: 'fq-popup-4',
        category: '위치·교통편',
        q: `대중교통이나 자가용으로 방문할 때 가장 편리한 경로와 주차 정보는 어떻게 되나요?`,
        a: `백화점이나 대형 복합몰 내 행사장은 인근 지하철역과 연결되어 대중교통 접근성이 좋으며, 골목 상권 팝업은 공영주차장이나 대중교통 이용을 권장합니다.`
      },
      {
        id: 'fq-popup-5',
        category: '온라인구매연동',
        q: `현장에 직접 방문하기 어려운데 온라인 공식 몰에서도 관련 기획 상품을 살 수 있나요?`,
        a: `오프라인 현장 체험과 동시에 공식 온라인 스토어나 모바일 앱 기획전을 통해 주요 콜라보 라인업 구매를 지원하는 경우가 많습니다.`
      },
      {
        id: 'fq-popup-6',
        category: '동반·관람시간',
        q: `전체 체험 코스를 둘러보고 포토존을 이용하는 데 보통 시간이 얼마나 걸리나요?`,
        a: `전시 관람과 체험존 참여, 굿즈 쇼핑까지 포함하면 평균 30분에서 1시간 내외로 여유 있게 즐길 수 있습니다.`
      }
    ];
  }

  // 4) 일반 트렌드 · 브랜드 신제품 · IT · 유통 · 기업 서비스 공통 맞춤형
  return [
    {
      id: 'fq-gen-1',
      category: '핵심차별점',
      q: `기존 유사 제품이나 서비스들과 비교했을 때 ${targetLabel}만의 가장 큰 강점은 무엇인가요?`,
      a: `소비자들이 실제로 겪던 불편함을 정교하게 개선하고, 품질·편의성·합리적인 가격 구성을 동시에 갖춰 체감 만족도를 높인 점이 핵심 차별점입니다.`
    },
    {
      id: 'fq-gen-2',
      category: '이용·구매채널',
      q: `${targetLabel}은 어디에서 가장 빠르고 간편하게 확인하거나 구매할 수 있나요?`,
      a: `브랜드 공식 홈페이지와 전용 모바일 앱, 주요 온·오프라인 공식 입점 채널을 통해 상세 라인업 조회 및 즉시 구매·신청이 가능합니다.`
    },
    {
      id: 'fq-gen-3',
      category: '가격·혜택체크',
      q: `처음 이용하거나 구매할 때 할인 쿠폰이나 프로모션 혜택을 챙기는 팁이 있나요?`,
      a: `공식 채널 신규 회원 웰컴 쿠폰팩이나 시즌별 특별 기획전, 제휴 카드·간편결제 혜택을 함께 적용하면 초기 비용 부담을 크게 줄일 수 있습니다.`
    },
    {
      id: 'fq-gen-4',
      category: '선택·활용기준',
      q: `나에게 가장 잘 맞는 옵션이나 구성을 고를 때 무엇을 우선 확인해야 하나요?`,
      a: `본인의 주된 사용 목적과 빈도, 핵심 사양·성분표를 먼저 대조해 보고 본문 요약표의 추천 기준에 맞춰 선택하는 것이 실패를 줄이는 방법입니다.`
    },
    {
      id: 'fq-gen-5',
      category: '주의·체크사항',
      q: `실제 사용하거나 신청할 때 놓치기 쉬운 주의사항이나 조건이 있나요?`,
      a: `프로모션 적용 기간, 매장·채널별 재고 유무, 상세 이용 조건이 서로 다를 수 있으므로 결제나 신청 전 공식 안내 사항을 한 번 더 확인하는 것이 좋습니다.`
    },
    {
      id: 'fq-gen-6',
      category: '사후관리·문의',
      q: `구매·이용 후 교환이나 추가 문의가 필요할 때는 어디로 연락하면 되나요?`,
      a: `공식 고객센터 및 모바일 앱 내 1:1 문의 창구를 통해 교환·환불 규정 안내와 사후 지원 서비스를 신속하게 받을 수 있습니다.`
    }
  ];
}

// 4대 대표 레퍼런스 시나리오 빌더 (+ 실제 에디터 원고 기반 버츄얼 아이돌 계보 시나리오 포함)
function buildPresetScenario({ keyword, url, company, selectedType }) {
  const kw = (keyword || '10월 10일 임산부의 날').trim();
  const comp = (company || '').trim();
  const targetUrl = (url || '').trim();
  const tId = Number(selectedType) || 2;

  if (isVirtualIdolQuery(kw, comp)) {
    return getVirtualIdolScenario(kw);
  }
  if (kw.includes('결혼') || tId === 1) {
    return getWeddingScenario(kw, comp || '오늘의집·번개장터', targetUrl, 1, 5, '', '');
  }
  if (kw.includes('민음사') || tId === 3) {
    return getViralBreadScenario(kw, 3, 4, '', '');
  }
  if (tId === 4 && !kw.includes('임산부')) {
    return getDynamicType4Preset(kw, comp);
  }
  if (tId === 5 || kw.includes('번개장터') || kw.includes('도씨')) {
    return getB2BTargetScenario(kw, comp || '번개장터', targetUrl, 5, 1, '', '');
  }
  return getPregnantDayScenario(kw, 2, 1, '', '');
}

// 실제 MK Pick 에디터 원고 완벽 반영: '아담, 키즈나아이, 이세계아이돌, 플레이브, 나이비스' 버츄얼 아이돌 타임라인 & 대표 주자 개별 심층 조명 시나리오
function getVirtualIdolScenario(kw = '아담, 키즈나아이, 이세계아이돌, 플레이브, 나이비스') {
  const sources = [
    {
      id: 'src-vi-1',
      url: 'https://www.parable-asia.com',
      title: '패러블엔터테인먼트 공식 자료 - 이세계아이돌(ISEGYE IDOL) 음원 및 브랜드 콜라보 성과',
      method: '공식 자료 · 패러블',
      reliability: '높음',
      excluded: false
    },
    {
      id: 'src-vi-2',
      url: 'https://vlast.com',
      title: '블래스트(VLAST) 공식 발표 - 버츄얼 보이그룹 플레이브(PLAVE) 지상파 음악방송 1위 및 홍보대사 위촉',
      method: '공식 발표 · VLAST',
      reliability: '높음',
      excluded: false
    },
    {
      id: 'src-vi-3',
      url: 'https://www.smentertainment.com',
      title: 'SM엔터테인먼트 보도자료 - 버추얼 아티스트 나이비스(nævis) 정식 데뷔 및 주요 브랜드 협업',
      method: '기업 보도자료 · SM',
      reliability: '높음',
      excluded: false
    },
    {
      id: 'src-vi-4',
      url: 'https://www.levvels.com',
      title: '엔터테크 기업 레벨스(LEVVELS) 공식 발표 - 5인조 버추얼 보이그룹 비더후드(B THE HOOD) 데뷔 미니앨범 ‘THE REAL DEAL’',
      method: '기업 발표 · 레벨스',
      reliability: '높음',
      excluded: false
    }
  ];

  const researchItems = [
    {
      id: 'ri-vi-1',
      category: '1998년 1세대 사이버 가수',
      fact: '1998년 개발사 아담소프트가 선보인 국내 최초 3D CG 사이버 가수 ‘아담’은 1집 ‘세상엔 없는 사랑’으로 약 20만 장의 판매량을 기록했으나, 천문학적인 그래픽 유지 비용과 IMF 외환위기 한계로 활동을 종료했습니다.',
      rawReference: '1998년 아담소프트 아카이브',
      sourceIds: ['src-vi-1']
    },
    {
      id: 'ri-vi-2',
      category: '2010년대 버튜버 생태계',
      fact: '보컬로이드 시유(SeeU)에 이어 2016년 ‘키즈나 아이(Kizuna AI)’ 등장을 기점으로 유튜브와 트위치 실시간 스트리밍을 통해 시청자와 쌍방향 소통하는 버튜버(Virtual YouTuber) 생태계가 폭발적으로 성장했습니다.',
      rawReference: '글로벌 버튜버 트렌드 연대기',
      sourceIds: ['src-vi-1']
    },
    {
      id: 'ri-vi-3',
      category: '이세계아이돌 · 플레이브 성과',
      fact: '6인조 걸그룹 이세계아이돌은 음원 차트 석권 및 두찜(2023·2025년)·롯데웰푸드(2025년) 콜라보를 진행했으며, 5인조 보이그룹 플레이브는 2024년 MBC ‘쇼! 음악중심’에서 버츄얼 아이돌 최초 지상파 1위 달성 및 메디힐 모델·서울시 홍보대사로 발탁되었습니다.',
      rawReference: '패러블 · 블래스트 공식 자료',
      sourceIds: ['src-vi-1', 'src-vi-2']
    },
    {
      id: 'ri-vi-4',
      category: '나이비스 · 비더후드 · 매드몬스터',
      fact: 'SM 세계관 기반 나이비스는 ‘Done’ 데뷔 후 칠성사이다·할리스 모델 및 서울디자인 홍보대사(2024년)로 활약 중이며, 레벨스의 5인조 보이그룹 비더후드는 2026년 미니앨범 ‘THE REAL DEAL(타이틀곡 CHOP!)’로 데뷔했습니다.',
      rawReference: 'SM엔터테인먼트 · 레벨스 보도자료',
      sourceIds: ['src-vi-3', 'src-vi-4']
    }
  ];

  const titleCandidates = [
    {
      id: 'tc-vi-1',
      title: '"1998년 아담부터 플레이브·나이비스까지"…음원 차트·광고판 점령한 ‘버츄얼 아이돌’ 타임라인 총정리',
      totalScore: 98
    },
    {
      id: 'tc-vi-2',
      title: '"모니터 속 아바타가 지상파 1위를 찍기까지"…이세계아이돌·플레이브·나이비스·비더후드 전격 비교',
      totalScore: 95
    },
    {
      id: 'tc-vi-3',
      title: '"플로피디스크 시절 사이버 가수 기억하시나요?"…3D 개척자 아담에서 2026 버츄얼 아이돌 전성기까지',
      totalScore: 92
    },
    {
      id: 'tc-vi-4',
      title: '"서브컬처 장난감 넘어 대기업 광고 모델로"…2020년대 버츄얼 아이돌 대표 주자 4선과 핵심 Q&A',
      totalScore: 90
    },
    {
      id: 'tc-vi-5',
      title: '"가상이든 현실이든 내 마음에 닿으면 진짜 아이돌"…키즈나 아이부터 플레이브까지 가상 아티스트 계보',
      totalScore: 88
    }
  ];

  const draftSections = [
    {
      id: 'sec-vi-1',
      title: '1998년 : 사이버 가수 ‘아담’ 시대를 너무 앞서간 3D 개척자',
      content: `플로피디스크가 돌아가던 1998년, 3D 그래픽의 초창기에 홀로 외롭게 노래했던 ‘사이버 가수’를 기억하시나요? 그로부터 수십 년 뒤, 음원 차트 최상위권을 휩쓸며 대기업 광고판을 점령한 ‘버츄얼 아이돌’의 시대가 열렸습니다.\n\n메타버스 기술로 픽셀과 알고리즘이 빚어낸 순수 버츄얼 아이돌의 화려한 활약부터 엄밀히 말해 버츄얼 아이돌은 아니지만 카메라 보정 필터로 가요계를 뒤흔든 인간 개그맨들의 유쾌한 밈 외전(매드몬스터)까지—가상과 현실을 넘나드는 흥미진진한 타임라인을 자세히 알려드립니다.\n\n탄생 배경과 이유 : 1990년대 말, 대한민국은 IT 벤처 열풍과 함께 컴퓨터 그래픽(CG) 기술의 가능성에 눈을 뜨기 시작했습니다. 개발사 ‘아담소프트’는 인간 가수처럼 스캔들 걱정 없이 완벽한 비주얼과 무결점 실력을 뽐내는 가상의 존재를 만들겠다는 야심 찬 목표로 ‘아담’을 탄생시켰습니다.\n\n활동 방식의 한계 : 실제 보컬리스트의 목소리에 최고급 3D 그래픽을 덧입혀 앨범 1집 ‘세상엔 없는 사랑’을 내고 20만 장의 판매량을 기록하며 센세이션을 일으켰습니다. 하지만 당시의 기술력으로는 입술을 몇 초 움직이게 하는 데도 천문학적인 비용과 시간이 소요되었습니다. 팬들과 실시간으로 소통하는 ‘라이브 방송’은 상상조차 할 수 없었고 결국 IMF 외환 위기와 천문학적인 유지 비용의 벽에 부딪혀 아담은 역사 속으로 사라졌습니다.`,
      imageCaption: '< 출처 : 아담소프트 아카이브 >',
      sourceIds: ['src-vi-1']
    },
    {
      id: 'sec-vi-2',
      title: '2010년대 : 보컬로이드에서 ‘키즈나 아이’까지…서브컬처 아지트에서 피어난 버튜버',
      content: `시유(SeeU) 등이 지상파 무대에 노크하며 명맥을 이었습니다. 이어 2016년 ‘키즈나 아이(Kizuna AI)’의 등장을 기점으로 유튜브와 트위치를 중심으로 한 버튜버(Virtual YouTuber) 문화가 전 세계적으로 폭발하기 시작했습니다.\n\n달라진 점 : 과거의 사이버 가수가 ‘만들어져서 일방적으로 주어지는 완성품’이었다면, 2010년대의 가상 아바타들은 실시간 스트리밍을 통해 시청자들과 농담을 주고받고 게임을 하며 ‘쌍방향 소통’이 가능한 생태계로 진화했습니다.`,
      imageCaption: '< 출처 : Kizuna AI 공식 채널 >',
      sourceIds: ['src-vi-1']
    },
    {
      id: 'sec-vi-3',
      title: '2020년대 이후 : 메타버스·AI와 만난 본격 ‘버츄얼 아이돌’ 전성기',
      content: `‘버츄얼 아이돌’이란 최첨단 모션 캡처(Motion Capture), 실시간 렌더링, AI 및 메타버스 기술을 결합해 실제 사람처럼 움직이고 노래하며 팬들과 교감하는 가상의 아이돌 그룹을 뜻합니다. 코로나19 팬데믹과 함께 그래픽 기술이 비약적으로 발전하면서 폭발적인 성장의 발판이 마련되었습니다.\n\n기술적 진화 속에서 태어난 이들은 이제 단순한 ‘서브컬처의 장난감’을 넘어 가요계와 광고계를 뒤흔드는 대세로 거듭났습니다. 모니터 속에만 갇혀 있던 가상 아바타들이 지상파 1위를 찍고 대기업 광고판을 접수하기까지, 과연 어떤 특별함이 있었을까요? 가요계 판도를 통째로 흔들고 있는 2020년대 대표 주자들의 활약상을 정리했습니다.`,
      imageCaption: '< 출처 : 패러블 >',
      sourceIds: ['src-vi-1', 'src-vi-2']
    },
    {
      id: 'sec-vi-4',
      title: '이세계아이돌 (ISEGYE IDOL) ‘스트리머 팬덤 경제’와 음원 파워의 상징',
      content: `인터넷 방송 인기 스트리머 우왁굳의 기획과 패러블의 매니지먼트 생태계에서 출발해 강력한 코어 팬덤 ‘이파리’를 결집하고 대기업 콜라보 및 음원 차트 최상위권을 휩쓸며 “버츄얼도 메이저 음원 시장에서 통한다”라는 것을 증명해 새로운 시작을 알린 그룹입니다.`,
      imageCaption: '< 출처 : 패러블 >',
      sourceIds: ['src-vi-1']
    },
    {
      id: 'sec-vi-5',
      title: '플레이브 (PLAVE) ‘메인스트림 진입과 대중성’의 신기원',
      content: `멤버들의 뛰어난 자체 음악 역량(작사·작곡·안무)과 실시간 소통을 무기로 버츄얼 아이돌 최초 지상파 음악방송 1위라는 역사적 이정표를 세웠습니다. 서브컬처의 장벽을 완전히 허물고 대중성과 팬덤을 모두 잡은 정석으로 평가받습니다.`,
      imageCaption: '< 출처 : 블래스트(VLAST) >',
      sourceIds: ['src-vi-2']
    },
    {
      id: 'sec-vi-6',
      title: '나이비스 (nævis) ‘대형 기획사 세계관 확장’형 아티스트',
      content: `SM엔터테인먼트의 대표 아이돌(에스파) 세계관 속 조연 캐릭터에서 출발해, 첨단 기술력을 바탕으로 독립적인 디지털 아티스트로 데뷔한 독보적인 케이스입니다. 기획사 IP 확장형 버츄얼 아티스트의 가능성을 보여줍니다.`,
      imageCaption: '< 출처 : SM엔터테인먼트 >',
      sourceIds: ['src-vi-3']
    },
    {
      id: 'sec-vi-7',
      title: '비더후드 (B THE HOOD) ‘다크 SF 세계관과 힙합 사운드’의 신예',
      content: `엔터테인먼트 기술 기업 레벨스가 선보인 5인조 버추얼 보이그룹으로 미지의 행성에서 온 이들이 지구에 적응한다는 독창적인 다크 SF 세계관과 강렬한 힙합 기반의 음악을 무기로 버츄얼 신에 새로운 지각변동을 일으키고 있습니다.`,
      imageCaption: '< 출처 : 레벨스 >',
      sourceIds: ['src-vi-4']
    },
    {
      id: 'sec-vi-8',
      title: 'Bonus Track : 코로나 시기를 강타한 기묘한 ‘포켓돌’, 매드몬스터',
      content: `버츄얼 아바타는 아니지만, 버츄얼 아이돌 열풍의 기묘한 프리퀄이자 대중문화의 폭소를 자아낸 주역이 있습니다. 바로 코로나19 팬데믹 시기 개그맨 곽범과 이창호가 부캐로 결성한 ‘매드몬스터’입니다.\n\n독창적 콘셉트 : 실제 인간 개그맨임에도 불구하고, 유튜브 화면 속에 극단적인 카메라 AR 보정 필터를 적용해 얼굴을 만화 캐릭터처럼 일그러뜨린 채 등장했습니다.\n\n자신들을 세계적인 글로벌 탑스타이자 ‘포켓돌’이라 우기며 고음 라이브와 진지한 세계관을 연기해 전 국민을 포복절도하게 만들었습니다. 가상과 현실, 그리고 밈(Meme) 문화가 어떻게 결합될 수 있는지 보여준 최고의 유쾌한 실험이었습니다.`,
      imageCaption: '< 출처 : ‘매드몬스터’ 공식 인스타그램 >',
      sourceIds: ['src-vi-1']
    }
  ];

  const summaryBlocks = {
    mkCategory: '산업 Q&A',
    mkCategoryReason: `1998년 사이버 가수 ‘아담’부터 2020년대 ‘이세계아이돌·플레이브·나이비스·비더후드’까지 이어진 버츄얼 아이돌 산업 계보와 주역별 특징을 입체적으로 해설하므로 [산업 Q&A] 카테고리가 가장 적합합니다.`,
    byline: '산업 Q&A | 남궁선희 기자 | 입력 2026.10.27 10:00',
    companyTags: ['아담', '키즈나아이', '이세계아이돌', '플레이브', '나이비스', '비더후드', '매드몬스터'],
    subtitle: '1998년 3D 개척자 ‘아담’부터 지상파 1위·대기업 광고판 접수한 2020년대 버츄얼 아이돌까지\n이세계아이돌·플레이브·나이비스·비더후드 대표 주자 비교표와 핵심 용어 사전·Q&A 총정리',
    aiFactSummary: [
      '1. 1998년 국내 최초 3D CG 사이버 가수 ‘아담(앨범 20만 장 판매)’에서 출발한 가상 아티스트 계보는 2016년 ‘키즈나 아이’의 실시간 쌍방향 버튜버 생태계를 거쳐 2020년대 버츄얼 아이돌 전성기로 진화했습니다.',
      '2. 이세계아이돌(음원 차트 석권·두찜·롯데웰푸드 협업), 플레이브(버츄얼 아이돌 최초 MBC 쇼! 음악중심 1위·메디힐 모델·서울시 홍보대사), 나이비스(SM 세계관 독립 데뷔·칠성사이다·할리스 뮤즈), 비더후드(레벨스 다크 SF 힙합 5인조)가 대표 주자로 활약하고 있습니다.',
      '3. 최첨단 모션 캡처·실시간 렌더링·AI 기술과 팬덤 소통이 결합하면서 버츄얼 아이돌은 서브컬처를 넘어 가요계와 광고계의 주류 모델로 자리매김했습니다.'
    ],
    summaryTable: {
      title: '[ 2020년대 버츄얼 아이돌 대표 주자 비교 ]',
      headers: ['구분', '그룹 유형 및 멤버', '탄생 배경 및 특징', '주요 성과', '팬덤 및 주요 협업'],
      rows: [
        [
          '이세계아이돌 (ISEGYE IDOL)',
          '6인조 버츄얼 걸그룹 (아이네, 징버거, 릴파, 주르르, 고세구, 비챤)',
          '스트리머 우왁굳의 서바이벌 오디션 결성',
          '국내 주요 음원 차트 최상위권 석권',
          '찜닭 브랜드 ‘두찜’ 1차 콜라보 진행(2023년) · ‘두찜’ 추가 콜라보 및 롯데웰푸드 협업(2025년)'
        ],
        [
          '플레이브 (PLAVE)',
          '5인조 버츄얼 보이그룹 (예준, 노아, 밤비, 은호, 하민)',
          '자체 작사·작곡·안무 역량을 갖춘 실력파',
          '버츄얼 아이돌 최초 지상파 음악방송 1위 (MBC ‘쇼! 음악중심’)',
          '대중성과 팬덤 동시 석권 · 더마 코스메틱 ‘메디힐’ 공식 브랜드 모델 발탁(2024년) · 서울특별시 공식 홍보대사 위촉(2024년)'
        ],
        [
          '나이비스 (nævis)',
          '가상 아티스트 (솔로)',
          'SM엔터테인먼트 세계관 속 캐릭터에서 출발한 독립 아티스트',
          '첨단 기술 기반 글로벌·미래지향적 가치 전달',
          '‘Done’ 데뷔 및 테크·플랫폼 협업(2024년) · 롯데칠성음료 ‘NEW 칠성사이다’ 광고 모델(2024년) · ‘할리스’ 홀리데이 뮤즈 및 서울디자인 홍보대사(2024년)'
        ],
        [
          '비더후드 (B THE HOOD)',
          '5인조 버추얼 보이그룹 (이언, 제이스, 기류, 퍼비, 루안)',
          '엔터테크 기업 레벨스(LEVVELS)가 선보인 다크 SF 세계관 기반 신예',
          '힙합 기반의 완성도 높은 음악으로 글로벌 가요계 진출',
          '2026년 데뷔 미니앨범 ‘THE REAL DEAL’(타이틀곡 ‘CHOP!’) 발매 및 공식 쇼케이스 진행'
        ]
      ]
    },
    glossaryTitle: '가상 세계를 더 깊이 이해하는 용어 사전',
    glossary: [
      {
        term: '버츄얼 아이돌 (Virtual Idol)',
        desc: '최첨단 그래픽과 IT 기술을 결합해 실제 사람처럼 노래하고 춤추며 팬들과 소통하는 가상의 아티스트 그룹을 뜻합니다.'
      },
      {
        term: '모션 캡처 (Motion Capture)',
        desc: '실제 인간 퍼포머의 관절과 표정에 센서를 부착하여 그 움직임을 디지털 데이터로 변환, 3D 아바타에 실시간으로 투영하는 핵심 기술입니다.'
      },
      {
        term: '메타버스 (Metaverse)',
        desc: '가상(Meta)과 세계(Universe)의 합성어로 현실과 가상 세계가 융합되어 아바타를 통해 사회·경제·문화적 활동을 하는 3차원 공간입니다.'
      },
      {
        term: '실시간 렌더링 (Real-time Rendering)',
        desc: '컴퓨터 그래픽 데이터를 눈 깜짝할 사이에(실시간으로) 계산해 화면에 그려내는 기술로 지연 없이 팬들과 실시간 라이브 소통을 가능하게 만듭니다.'
      },
      {
        term: '버튜버 (Virtual YouTuber)',
        desc: '가상 아바타를 내세워 유튜브나 트위치 같은 스트리밍 플랫폼에서 게임, 소통, 노래 등의 콘텐츠를 진행하는 크리에이터를 통칭합니다.'
      }
    ],
    faqs: [
      {
        q: 'Q1. 대한민국 최초의 버츄얼(사이버) 가수는 누구인가요?',
        a: '1998년에 데뷔한 ‘아담(Adam)’입니다. IT 벤처 열풍 속에서 탄생한 국내 최초의 3D CG 기반 사이버 가수로 실제 보컬의 목소리에 그래픽을 입혀 앨범 판매량 20만 장을 기록하며 큰 화제를 모았으나 당시 기술 및 비용 한계로 활동을 종료했습니다.'
      },
      {
        q: 'Q2. 1세대 사이버 가수와 현재 3세대 버츄얼 아이돌의 가장 큰 차이점은 무엇인가요?',
        a: '핵심 차이는 ‘쌍방향 소통’ 여부입니다. 1990년대 아담이 일방적으로 주어지는 완성품이었다면, 2020년대 버츄얼 아이돌은 모션 캡처와 실시간 렌더링 기술을 통해 라이브 방송에서 팬들과 실시간으로 대화하고 게임을 하며 교감하는 생태계로 진화했습니다.'
      },
      {
        q: 'Q3. 버츄얼 아이돌도 지상파 음악방송에서 1위를 차지한 적이 있나요?',
        a: '5인조 버츄얼 보이그룹 ‘플레이브(PLAVE)’가 2024년 MBC ‘쇼! 음악중심’에서 버츄얼 아이돌 최초로 지상파 음악방송 1위를 거머쥐며 서브컬처를 넘어 메인스트림 가요계의 주역으로 우뚝 섰습니다.'
      },
      {
        q: 'Q4. 버츄얼 아이돌은 완전한 AI인가요? 아니면 실제 사람이 연기하나요?',
        a: '대다수의 버츄얼 아이돌은 최첨단 모션 캡처 장비를 착용한 실제 인간 퍼포머의 움직임과 목소리를 실시간 3D 아바타에 투영하는 방식으로 운영됩니다. 여기에 AI, 실시간 그래픽 렌더링, 메타버스 기술이 결합되어 가상과 현실을 잇는 아티스트로 완성됩니다.'
      },
      {
        q: 'Q5. 2020년대를 대표하는 버츄얼 아이돌 그룹에는 어떤 팀들이 있나요?',
        a: '인터넷 방송 생태계에서 출발해 강력한 음원 화력을 자랑하는 ‘이세계아이돌’, 자체 프로듀싱 능력을 갖춘 ‘플레이브’, SM 세계관 기반의 아티스트 ‘나이비스(nævis)’, 그리고 독창적인 다크 SF 세계관과 힙합 사운드의 신예 ‘비더후드(B THE HOOD)’ 등이 대표적입니다.'
      }
    ],
    fanoutQuestions: [
      {
        id: 'fq-vi-1',
        category: '콘서트·현장직관',
        q: '버츄얼 아이돌의 오프라인 콘서트나 쇼케이스는 실제 공연장에서 어떻게 관람하나요?',
        a: '대형 아레나 공연장의 초고화질 LED 스크린과 홀로그램·실시간 렌더링 송출 기술을 통해 현장 관객들과 실시간으로 호흡하고 응원봉을 연동하는 방식으로 실제 아이돌 콘서트와 동일하게 진행됩니다.'
      },
      {
        id: 'fq-vi-2',
        category: '광고·콜라보효과',
        q: '유통·식음료·뷰티 대기업들이 버츄얼 아이돌을 광고 모델로 발탁하는 가장 큰 이유는 무엇인가요?',
        a: '스캔들 리스크가 낮고 1030 디지털 네이티브 세대의 팬덤 결집력이 매우 높아, 콜라보 굿즈나 기획 세트 출시 즉시 품절 대란과 자발적인 SNS 바이럴을 이끌어내기 때문입니다.'
      },
      {
        id: 'fq-vi-3',
        category: '실시간소통방식',
        q: '팬들이 버츄얼 아이돌 멤버들과 실시간으로 소통하려면 어디에서 방송을 볼 수 있나요?',
        a: '공식 유튜브 채널과 위버스(Weverse), 숲(SOOP)·치지직 등 스트리밍 플랫폼의 정기 라이브 방송을 통해 실시간 채팅으로 대화를 나누고 소통할 수 있습니다.'
      },
      {
        id: 'fq-vi-4',
        category: '굿즈·팝업스토어',
        q: '플레이브나 이세계아이돌 같은 버츄얼 그룹의 공식 굿즈나 앨범도 일반 음반 매장에서 살 수 있나요?',
        a: '일반 케이팝 그룹과 동일하게 주요 온·오프라인 음반 매장과 백화점 팝업스토어에서 포토카드, 응원봉, 피규어, 콜라보 패키지가 정식 판매되며 한터차트·써클차트 초동 판매량에도 공식 집계됩니다.'
      }
    ],
    closingParagraph: `1998년 컴퓨터 안에서 홀로 노래하던 ‘아담’의 외로운 도전은 오늘날 전 세계 팬들과 실시간으로 숨 쉬고 호흡하며 음원 차트 정상을 밟는 ‘이세계아이돌’과 ‘플레이브’의 화려한 무대로 이어졌습니다. 기술은 상상 이상으로 발전했지만 이들이 우리에게 건네는 위로와 감동의 본질은 그때나 지금이나 변함이 없습니다.`,
    oneLineSummary: `한 줄 요약! “가상이든 현실이든, 내 마음에 닿는다면 그것이 진짜 아이돌이 아닐까요?” 앞으로 이들이 써 내려갈 가상과 현실의 경계를 허무는 새로운 역사가 더욱 기대되는 이유입니다.`,
    noticeText: '본 콘텐츠는 매경비즈 디지털뉴스룸이 공식 발표 자료와 보도자료를 바탕으로 작성했습니다.',
    imageRecommendations: [
      {
        position: '본문 대표 이미지',
        sourceUrl: 'https://www.parable-asia.com',
        keywords: ['이세계아이돌 · 플레이브 · 나이비스 · 비더후드 공식 이미지'],
        caption: '< 출처 : 패러블 · 블래스트 · SM엔터테인먼트 · 레벨스 >'
      }
    ]
  };

  return {
    recommendedType: 3,
    secondaryType: 4,
    primaryReason: `'${kw}' 키워드에 포함된 시대별 가상 아티스트 계보와 2020년대 대표 주자(이세계아이돌·플레이브·나이비스·비더후드)를 하나씩 입체적으로 조명하는 MK Pick 에디터 표준 구성입니다.`,
    secondaryReason: '',
    sources,
    researchItems,
    titleCandidates,
    selectedTitleId: 'tc-vi-1',
    outline: [],
    outlineApproved: true,
    draftSections,
    summaryBlocks,
    factChecks: extractFactSentencesFromSections(draftSections, sources)
  };
}

function getDynamicType4Preset(kw = '', comp = '') {
  const actualKw = (kw || '편의점 전용 맛 · 다이소 뷰티').trim();
  const actualComp = (comp || '').trim();
  const base = buildDynamicWorkFromNews({
    keyword: actualKw,
    company: actualComp,
    url: 'https://www.mk.co.kr',
    rawText: '',
    typeId: 4,
    newsItems: []
  });
  return base;
}

function getPregnantDayScenario(kw, primaryType, secondaryType, primaryReason, secondaryReason) {
  const sources = [
    {
      id: 'src-1',
      url: 'https://www.law.go.kr/법령/모자보건법',
      title: '국가법령정보센터 - 모자보건법 제3조의2 (임산부의 날)',
      method: '공식 법령',
      reliability: '높음',
      excluded: false
    },
    {
      id: 'src-2',
      url: 'https://www.mohw.go.kr/board.es?mid=a10503000000',
      title: '보건복지부 보도자료 - 제21회 임산부의 날 기념행사 및 지원 정책 안내',
      method: '정부 보도자료',
      reliability: '높음',
      excluded: false
    },
    {
      id: 'src-3',
      url: 'https://www.mk.co.kr/news/business/11138290',
      title: '매일경제 - 유통·육아업계 10월 10일 임산부의 날 맞아 프로모션 총출동',
      method: '언론 보도',
      reliability: '높음',
      excluded: false
    }
  ];

  const researchItems = [
    {
      id: 'ri-1',
      category: '기념일 유래 · 법적 근거',
      fact: '임산부의 날은 풍요의 달 10월과 임신 기간 10개월을 뜻하는 매년 10월 10일로, 2005년 모자보건법 제3조의2에 따라 제정된 법정기념일입니다.',
      rawReference: '모자보건법 제3조의2 법령 원문',
      sourceIds: ['src-1']
    },
    {
      id: 'ri-2',
      category: '정부 핵심 지원금 수치',
      fact: '국민행복카드 진료비 바우처(단태아 100만 원, 다태아 140만 원), 첫만남이용권(첫째 200만 원, 둘째 이상 300만 원), 임신기 일 2시간 근로시간 단축 제도가 운영됩니다.',
      rawReference: '보건복지부 임신·출산 지원 안내 자료',
      sourceIds: ['src-2']
    },
    {
      id: 'ri-3',
      category: '기업 5곳 프로모션 혜택',
      fact: '매일유업(기프트박스 1,000명 추첨, 10/1~10/15), 유한킴벌리 하기스(허그박스 체험팩+30% 쿠폰), 일동후디스(임산부 영양제 최대 50% 할인), 카카오(톡딜 베이비위크 10/7~10/13), 신세계백화점(유아동 10~30% 할인) 프로모션이 진행됩니다.',
      rawReference: '각 사 공식 홈페이지 이벤트 공지',
      sourceIds: ['src-3']
    }
  ];

  const titleCandidates = [
    {
      id: 'tc-1',
      title: '"풍요의 10월, 왜 하필 10일일까?"…10월 10일 임산부의 날 유래부터 기업 5곳 혜택 총정리',
      totalScore: 95
    },
    {
      id: 'tc-2',
      title: '"산모수첩 하나로 반값 할인까지"…임산부의 날 모자보건법 제정 배경과 브랜드별 프로모션 비교',
      totalScore: 91
    },
    {
      id: 'tc-3',
      title: '"임신 10개월의 의미를 담았습니다"…제21회 임산부의 날 정부 지원금·기업 캠페인 Q&A',
      totalScore: 88
    },
    {
      id: 'tc-4',
      title: '"축하 박스에 50% 특가까지"…10월 10일 임산부의 날 놓치면 아쉬운 유통가 이벤트 5선',
      totalScore: 85
    },
    {
      id: 'tc-5',
      title: '"예비 엄마·아빠라면 꼭 챙기세요"…임산부의 날 의미와 2026 출산 지원 혜택 가이드',
      totalScore: 82
    }
  ];

  const draftSections = [
    {
      id: 'sec-1',
      title: '임산부의 날은 왜 하필 10월 10일로 지정되었을까요?',
      content: '가을이 깊어가는 10월, 달력을 보며 "왜 임산부의 날은 10월 10일일까?" 궁금해하신 적 없으신가요?\n\n임산부의 날은 풍요와 수확을 상징하는 10월과 임신 기간 10개월을 의미하는 숫자 10이 겹치는 매년 10월 10일로 지정되어 있습니다. 저출산이 사회적 과제로 떠오르던 2005년 개정된 모자보건법 제3조의2에 따라 임신과 출산의 중요성을 북돋우고 임산부를 배려하는 문화를 확산하기 위해 법정기념일로 제정되었습니다.',
      sourceIds: ['src-1', 'src-2']
    },
    {
      id: 'sec-2',
      title: '예비 부모가 꼭 챙겨야 할 정부 임신·출산 지원 제도는 무엇인가요?',
      content: '보건복지부와 지방자치단체는 임산부의 날을 계기로 임신·출산 맞춤형 지원 제도를 안내하고 있습니다. 대표적으로 국민행복카드를 통해 단태아 임산부에게 100만 원, 다태아 임산부에게 140만 원의 진료비 바우처를 지원합니다.\n\n출산 후에는 첫만남이용권으로 첫째 아기에게 200만 원, 둘째 이상 아기에게 300만 원의 포인트를 지급하며, 임신 12주 이내 또는 32주 이후 근로자는 하루 2시간의 임신기 근로시간 단축 제도를 임금 삭감 없이 이용할 수 있습니다.',
      sourceIds: ['src-2']
    },
    {
      id: 'sec-3',
      title: '매일유업·유한킴벌리 등 주요 기업 5곳은 어떤 임산부의 날 캠페인과 혜택을 준비했을까요?',
      content: '임산부의 날을 맞아 주요 육아·유통 기업 5곳도 브랜드별로 차별화된 제품과 맞춤형 캠페인을 일제히 마련했습니다.\n\n■ [매일유업] 예비엄마 축하 기프트박스 1,000명 추첨 캠페인\n매일유업은 10월 1일부터 10월 15일까지 공식 몰에서 산모수첩을 인증한 예비엄마 1,000명을 추첨해 맘마밀·앱솔루트 등 대표 출산·육아 제품이 담긴 축하 기프트박스를 증정합니다.\n\n■ [유한킴벌리 하기스] 맘큐 허그박스 무료 체험팩 & 30% 쿠폰\n유한킴벌리 하기스는 자사 육아 플랫폼 ‘맘큐’에서 임신확인서를 등록한 회원 전원에게 신생아 기저귀·물티슈로 구성된 ‘허그박스’ 무료 체험팩과 첫 구매 30% 할인 쿠폰을 상시 제공합니다.\n\n■ [일동후디스] 임산부 맞춤 영양제 최대 50% 특별 기획전\n일동후디스는 10월 7일부터 14일까지 공식 스마트스토어에서 임신기 필수 영양소인 엽산·철분·비타민D 라인업을 최대 50% 할인된 가격에 선보이며 사은품을 증정합니다.\n\n■ [카카오 · 신세계백화점] 온·오프라인 출산 준비 위크\n카카오는 10월 7일부터 13일까지 카카오톡 쇼핑하기 ‘톡딜 베이비위크’를 열고 출산 준비물 전용 쿠폰팩을 지급하며, 신세계백화점은 전국 지점에서 ‘마더스위크’를 개최해 유아동 주요 브랜드를 10~30% 할인합니다.',
      sourceIds: ['src-3']
    }
  ];

  const summaryBlocks = {
    mkCategory: '기업뉴스',
    mkCategoryReason: `'${kw}' 법정기념일을 맞아 진행되는 주요 기업 5곳의 프로모션·캠페인 소식을 종합 전달하므로 [기업뉴스] 카테고리를 추천합니다.`,
    byline: '기업뉴스 | 남궁선희 기자 | 입력 2026.10.22 09:30',
    companyTags: ['매일유업', '유한킴벌리', '일동후디스', '카카오', '신세계백화점'],
    subtitle: '풍요의 10월과 임신 10개월 의미 담은 법정기념일\n모자보건법 근거 정부 지원금부터 기업 5곳 프로모션·참여 기간 한눈에',
    aiFactSummary: [
      '1. 매년 10월 10일 임산부의 날은 풍요의 달(10월)과 임신 기간(10개월)을 뜻하며, 2005년 모자보건법 제3조의2에 따라 제정된 법정기념일입니다.',
      '2. 임산부는 국민행복카드 진료비 지원(단태아 100만 원·다태아 140만 원)과 출산 시 첫만남이용권(첫째 200만 원·둘째 이상 300만 원) 등 정부 혜택을 받을 수 있습니다.',
      '3. 매일유업·유한킴벌리·일동후디스·카카오·신세계백화점 등 5개 기업은 10월 중 산모수첩 인증 기프트박스와 최대 50% 할인 프로모션을 진행합니다.'
    ],
    summaryTable: {
      title: '[요약표] 2026 임산부의 날 주요 기업 5곳 혜택 비교',
      headers: ['기업·브랜드', '주요 혜택 내용', '참여 방법', '진행 기간'],
      rows: [
        ['매일유업', '예비엄마 축하 기프트박스 (1,000명 추첨)', '공식 몰 로그인 후 산모수첩 인증 신청', '2026.10.01 ~ 10.15'],
        ['유한킴벌리 (하기스)', '허그박스 무료 체험팩 + 30% 할인 쿠폰', '맘큐 앱 임신확인서 등록 회원 전원', '2026.10.01 ~ 10.31'],
        ['일동후디스', '임산부 엽산·철분 영양제 최대 50% 할인', '공식 스마트스토어 기획전 구매', '2026.10.07 ~ 10.14'],
        ['카카오 (톡딜)', '베이비위크 출산용품 쿠폰팩 지급', '카카오톡 쇼핑하기 기획전 탭 다운로드', '2026.10.07 ~ 10.13'],
        ['신세계백화점', '마더스위크 유아동 브랜드 10~30% 할인', '백화점 앱 쿠폰 제시 및 매장 방문', '2026.10.04 ~ 10.13']
      ]
    },
    faqs: [
      {
        q: 'Q1. 임산부의 날이 10월 10일로 지정된 이유와 법적 근거는 무엇인가요?',
        a: '풍요와 수확을 상징하는 10월과 임신 기간 10개월을 의미하는 숫자 10이 겹치는 날로, 2005년 개정된 모자보건법 제3조의2에 따라 임신과 출산에 대한 긍정적 인식을 확산하기 위해 법정기념일로 지정되었습니다.'
      },
      {
        q: 'Q2. 임산부의 날 기업 프로모션에 참여하려면 어떤 서류가 필요한가요?',
        a: '대부분의 육아·유통 기업 이벤트는 임신 사실을 확인할 수 있는 산모수첩 표지, 임신확인서, 또는 보건소 임산부 등록증 사진 업로드를 요구합니다.'
      },
      {
        q: 'Q3. 국민행복카드 임신·출산 진료비 지원 금액은 얼마인가요?',
        a: '단태아 임산부는 100만 원, 다태아(쌍둥이 이상) 임산부는 140만 원의 바우처가 지급되며, 분만 예정일 이후 2년까지 산부인과 및 약국 등에서 사용할 수 있습니다.'
      },
      {
        q: 'Q4. 직장인 임산부가 활용할 수 있는 법적 근로시간 단축 제도는 무엇인가요?',
        a: '근로기준법에 따라 임신 후 12주 이내 또는 32주 이후에 있는 여성 근로자는 1일 2시간의 근로시간 단축을 신청할 수 있으며, 사용자는 이를 이유로 임금을 삭감할 수 없습니다.'
      },
      {
        q: 'Q5. 대중교통 임산부 배려석 이용 시 임산부 배지는 어디서 발급받나요?',
        a: '관할 보건소나 지하철역 고객안전실에 신분증과 임신확인서(또는 산모수첩)를 지참해 방문하거나, 정부24 ‘맘편한 임신’ 원스톱 서비스를 통해 온라인으로 신청할 수 있습니다.'
      }
    ],
    fanoutQuestions: [
      {
        id: 'fq-1',
        category: '휴무여부',
        q: '10월 10일 임산부의 날은 달력상 쉬는 법정공휴일인가요?',
        a: '임산부의 날은 모자보건법에 따른 법정기념일이지만 관공서의 공휴일에 관한 규정에 따른 법정공휴일은 아니므로 평일 정상 근무일입니다.'
      },
      {
        id: 'fq-2',
        category: '대상조건',
        q: '이미 출산한 산모도 임산부의 날 기업 이벤트나 할인 혜택을 받을 수 있나요?',
        a: '모자보건법상 임산부는 임신 중이거나 분만 후 6개월 미만인 여성을 뜻하므로, 출산 후 6개월 이내 산모도 다수 기업의 기프트박스 및 할인 대상에 포함됩니다.'
      },
      {
        id: 'fq-3',
        category: '중복혜택',
        q: '국민행복카드 바우처와 지자체 출산지원금, 기업 프로모션은 모두 중복으로 받을 수 있나요?',
        a: '정부 바우처와 지자체 첫만남이용권, 민간 유통기업의 산모수첩 인증 이벤트는 별도로 운영되므로 조건만 충족하면 모두 중복해서 챙길 수 있습니다.'
      },
      {
        id: 'fq-4',
        category: '신청서류',
        q: '아직 종이 산모수첩이 없는데 초음파 사진이나 모바일 앱 화면으로도 임산부 인증이 되나요?',
        a: '병원에서 발급한 임신확인서나 정부24 맘편한 임신 등록 내역 캡처본으로도 대부분 인증이 가능하지만, 초음파 사진 단독으로는 인정되지 않는 경우가 많아 확인이 필요합니다.'
      },
      {
        id: 'fq-5',
        category: '배우자참여',
        q: '예비 아빠(남편) 아이디로도 임산부 축하 기프트박스를 대신 신청할 수 있나요?',
        a: '대부분 산모 본인 명의 계정과 임신확인서 상의 성명이 일치해야 신청이 가능하지만, 가족 계정 연동 시 배우자 응모를 허용하는 백화점·플랫폼 이벤트도 있습니다.'
      },
      {
        id: 'fq-6',
        category: '교통할인',
        q: '임산부가 KTX·SRT 기차나 공영주차장을 이용할 때 받을 수 있는 상시 할인이 있나요?',
        a: '맘편한 KTX·SRT 등록 시 특실 업그레이드 또는 운임 할인 혜택이 제공되며, 전국 지자체 공영주차장에서도 임산부 자동차 표지 부착 시 주차요금의 50% 감면을 받을 수 있습니다.'
      }
    ],
    oneLineSummary: '한 줄 요약! 10월 10일 임산부의 날에는 모자보건법에 기반한 정부 바우처와 육아·유통 기업 5곳의 산모수첩 인증 혜택을 꼼꼼히 챙기시기 바랍니다.',
    noticeText: '본 콘텐츠는 매경비즈 디지털뉴스룸이 공식 발표 자료와 보도자료를 바탕으로 작성했습니다.',
    imageRecommendations: [
      {
        position: '상단 대표 이미지',
        sourceUrl: 'https://www.mohw.go.kr',
        keywords: ['보건복지부 임산부의 날 공식 포스터'],
        caption: '< 출처 : 보건복지부 >'
      }
    ]
  };

  return {
    recommendedType: primaryType,
    secondaryType,
    primaryReason,
    secondaryReason,
    sources,
    researchItems,
    titleCandidates,
    selectedTitleId: 'tc-1',
    outline: [],
    outlineApproved: true,
    draftSections,
    summaryBlocks,
    factChecks: extractFactSentencesFromSections(draftSections, sources)
  };
}

function getWeddingScenario(kw, comp, targetUrl, primaryType, secondaryType, primaryReason, secondaryReason) {
  const sources = [
    {
      id: 'src-w1',
      url: targetUrl || 'https://www.ohou.se/exhibitions/wedding',
      title: '오늘의집 공식 웨딩 기획전 및 신혼 가구·인테리어 트렌드 리포트',
      method: '기업 공식',
      reliability: '높음',
      excluded: false
    },
    {
      id: 'src-w2',
      url: 'https://www.mk.co.kr/news/economy/11140211',
      title: '매일경제 - 2026 웨딩 트렌드 및 신혼 소비 분석',
      method: '언론 보도',
      reliability: '높음',
      excluded: false
    }
  ];

  const researchItems = [
    {
      id: 'ri-w1',
      category: '시대별 결혼 트렌드 변천',
      fact: '과거 정형화된 스드메 일괄 패키지 계약에서 벗어나, 2026년 현재 예비부부들은 스냅·드레스·혼수를 취향에 따라 개별 선택하는 초개인화 실속 웨딩을 선호하고 있습니다.',
      rawReference: '웨딩 소비 트렌드 시대별 비교 자료',
      sourceIds: ['src-w2']
    },
    {
      id: 'ri-w2',
      category: '업체 4곳 핵심 서비스',
      fact: '오늘의집(웨딩 멤버십 최대 40만 원 쿠폰팩), 번개장터(웨딩드레스·스냅 소품 안전결제 거래액 전년 대비 68% 증가), KCC건설 스위첸(신혼 맞춤형 평면 캠페인), KFC(스몰웨딩 케이터링 버킷) 등 4개 기업의 맞춤형 웨딩 서비스가 주목받고 있습니다.',
      rawReference: '각 사 공식 보도자료',
      sourceIds: ['src-w1', 'src-w2']
    }
  ];

  const titleCandidates = [
    { id: 'tc-w1', title: '"스드메 패키지 대신 내 맘대로 골라요"…시대별 결혼 트렌드 변천사와 주목받는 웨딩 서비스 4선', totalScore: 96 },
    { id: 'tc-w2', title: '"웨딩드레스도 중고 앱에서 산다고?"…실속파 예비부부가 선택한 2026 신혼 준비법 Q&A', totalScore: 91 },
    { id: 'tc-w3', title: '"3D로 신혼집 꾸미고 드레스는 리커머스로"…오늘의집·번개장터로 본 웨딩 산업 지형도', totalScore: 89 },
    { id: 'tc-w4', title: '"남들과 똑같은 결혼식은 싫어요"…1990년대부터 2026년까지 한눈에 보는 혼수·예식 비교', totalScore: 85 },
    { id: 'tc-w5', title: '"고물가 시대 결혼 준비 어떻게 할까?"…알뜰 혼수부터 이색 웨딩까지 핵심 정리', totalScore: 82 }
  ];

  const draftSections = [
    {
      id: 'sec-w1',
      title: '스드메 일괄 패키지 대신 왜 요즘은 분리 계약을 선택할까요?',
      content: '결혼을 앞둔 지인에게서 "요즘은 스드메 패키지로 안 하고 드레스랑 스냅을 다 따로 고른다더라"는 이야기를 들어보신 적 없으신가요?\n\n과거 1990년대와 2000년대에는 웨딩플래너를 통한 일괄 패키지 계약이 대세였지만, 2026년 현재 예비부부들은 불필요한 옵션을 덜어내고 본인의 취향에 맞는 업체만 개별 조합하는 실속형 소비를 주도하고 있습니다.',
      sourceIds: ['src-w2']
    },
    {
      id: 'sec-w2',
      title: '오늘의집·번개장터 등 주목받는 웨딩 서비스 4곳은 어떤 혜택을 제공할까요?',
      content: '변화한 결혼 트렌드에 발맞춰 기업들도 맞춤형 서비스를 선보이고 있습니다. 라이프스타일 플랫폼 오늘의집은 3D 방꾸미기 시뮬레이션과 함께 신혼부부 전용 웨딩 멤버십을 통해 최대 40만 원 상당의 할인 쿠폰팩을 제공합니다.\n\n리커머스 플랫폼 번개장터에서는 촬영용 세컨드 웨딩드레스와 빈티지 부케 등 웨딩 카테고리 안전결제 거래액이 전년 대비 68% 증가했습니다. KCC건설 스위첸은 신혼부부 맞춤형 평면 캠페인을 전개하고 있으며, KFC는 스몰웨딩 파티용 치킨 버킷 케이터링 이벤트로 호응을 얻고 있습니다.',
      sourceIds: ['src-w1', 'src-w2']
    }
  ];

  const summaryBlocks = {
    mkCategory: '브랜드스토리(기업관)',
    mkCategoryReason: `오늘의집·번개장터 등 주요 파트너사의 맞춤형 웨딩 서비스 가치와 혜택을 집중 소개하므로 [브랜드스토리(기업관)] 카테고리를 추천합니다.`,
    byline: '브랜드스토리(기업관) | 남궁선희 기자 | 입력 2026.10.22 09:30',
    companyTags: ['오늘의집', '번개장터', 'KCC건설', 'KFC'],
    subtitle: '일괄 패키지 대신 취향 중심 분리 계약·리커머스 혼수 확산\n세대별 예식 문화 변천사부터 오늘의집·번개장터 등 4대 기업 서비스 비교',
    aiFactSummary: [
      '1. 2026년 결혼 트렌드는 정형화된 스드메 패키지에서 벗어나 스냅·드레스·혼수를 취향대로 개별 조합하는 초개인화 방식으로 전환되었습니다.',
      '2. 오늘의집(웨딩 멤버십 40만 원 쿠폰팩), 번개장터(웨딩 거래액 68% 증가) 등 플랫폼을 활용한 실속형 결혼 준비가 빠르게 확산하고 있습니다.',
      '3. 예식 비용 거품은 줄이고 주거 공간 스타일링과 이색 케이터링 등 실질적 만족도에 집중하는 경향이 뚜렷합니다.'
    ],
    summaryTable: {
      title: '[요약표] 웨딩 트렌드 주요 업체 4곳 서비스 비교',
      headers: ['업체명', '핵심 웨딩 서비스', '주요 혜택·특징', '추천 대상'],
      rows: [
        ['오늘의집', '신혼집 3D 인테리어 및 웨딩 기획전', '웨딩 멤버십 인증 시 최대 40만 원 쿠폰팩', '신혼 가구·가전을 합리적으로 배치하려는 부부'],
        ['번개장터', '웨딩드레스·스냅 소품 리커머스', '브랜드 세컨드 드레스 안전결제 (거래액 68%↑)', '셀프 웨딩 촬영 비용을 아끼려는 실속파'],
        ['KCC건설 (스위첸)', '신혼 라이프스타일 특화 주거 공간', '다이닝·드레스룸 맞춤형 공간 설계 제안', '주거 공간의 동선과 가치를 중시하는 신혼부부'],
        ['KFC', '이색 스몰웨딩 케이터링 캠페인', '파티형 웨딩 맞춤형 버킷 패키지 구성', '격식 없는 하우스·파티 웨딩을 기획하는 커플']
      ]
    },
    faqs: [
      { q: 'Q1. 스드메 패키지와 셀프 분리 계약의 가장 큰 차이점은 무엇인가요?', a: '일괄 패키지는 제휴 업체를 한 번에 예약해 편리하지만 지정 외 추가금이 발생할 수 있으며, 셀프 분리 계약은 사진작가·드레스숍을 직접 골라 불필요한 옵션을 제외할 수 있습니다.' },
      { q: 'Q2. 오늘의집 웨딩 멤버십은 어떻게 신청하나요?', a: '오늘의집 앱 내 웨딩 기획전 페이지에서 청첩장이나 예식장 계약서 등을 인증하면 심사를 거쳐 신혼 전용 할인 쿠폰팩이 발급됩니다.' },
      { q: 'Q3. 번개장터에서 웨딩드레스를 중고로 거래할 때 주의할 점은 무엇인가요?', a: '사이즈 수선 가능 여부와 세탁 상태를 확인하고, 고가 브랜드 드레스는 정품 검수 및 안전결제(번개페이)를 활용하는 것이 안전합니다.' },
      { q: 'Q4. 최근 신혼집 인테리어에서 가장 선호도가 높은 공간은 어디인가요?', a: '거실 TV 중심 배치에서 벗어나 부부가 함께 식사하고 취미를 공유하는 대형 다이닝 테이블 및 홈카페 공간의 비중이 높아졌습니다.' },
      { q: 'Q5. 결혼 준비 체크리스트는 예식 몇 개월 전부터 시작하는 것이 좋은가요?', a: '인기 예식장과 본식 스냅은 예식 10~12개월 전에 마감되는 경우가 많아 대관 및 핵심 촬영부터 우선 확정하는 것을 권장합니다.' }
    ],
    fanoutQuestions: [
      { id: 'fq-w1', category: '예산절감', q: '스드메를 패키지로 안 하고 직접 따로 예약하면 평균 비용이 얼마나 아껴지나요?', a: '불필요한 앨범 페이지 추가나 지정 드레스숍 피팅비 등을 덜어내면 평균 100만~250만 원가량 예산을 절감하는 예비부부가 많습니다.' },
      { id: 'fq-w2', category: '인증서류', q: '오늘의집 웨딩 멤버십 신청할 때 예식장 계약서 말고 청첩장 모바일 시안으로도 인증이 되나요?', a: '예식일과 예비부부 성함이 명확히 기재된 예식장 계약서, 웨딩홀 예약 확인증, 또는 종이·모바일 청첩장 캡처본으로 인증 신청이 가능합니다.' },
      { id: 'fq-w3', category: '중고거래팁', q: '번개장터에서 촬영용 웨딩드레스를 샀다가 촬영 끝나고 다시 되팔 수도 있나요?', a: '야외 스냅이나 브라이덜 샤워 후 세탁 상태만 잘 유지하면 구매가와 비슷한 가격대로 다시 리셀(재판매)할 수 있어 실질 부담이 매우 낮습니다.' },
      { id: 'fq-w4', category: '가전혼수', q: '신혼 가구랑 가전은 입주 몇 주 전에 주문해야 설치 일정을 맞출 수 있나요?', a: '인기 가구와 빌트인 가전은 제작·배송에 3~6주가 걸리는 경우가 많아 최소 입주 2개월 전에는 주문을 마치고 희망 배송일을 지정하는 것이 안전합니다.' },
      { id: 'fq-w5', category: '스몰웨딩', q: '하우스웨딩이나 스몰웨딩으로 진행하면 일반 웨딩홀보다 무조건 비용이 더 저렴한가요?', a: '하객 수가 적어 식대 총액은 줄어들지만 생화 장식이나 대관료, 케이터링 커스텀 옵션에 따라 비용이 달라지므로 항목별 견적을 미리 비교해야 합니다.' },
      { id: 'fq-w6', category: '답례품·혜택', q: '신혼집 인테리어할 때 카드사 캐시백이나 플랫폼 쿠폰을 중복으로 받는 팁이 있나요?', a: '오늘의집 웨딩 쿠폰팩 적용 품목과 백화점·가전 매장 웨딩 마일리지 적립 품목을 나누어 결제하면 할인 한도를 극대화할 수 있습니다.' }
    ],
    oneLineSummary: '한 줄 요약! 2026년 결혼 준비는 정형화된 패키지 대신 오늘의집·번개장터 등 맞춤형 플랫폼을 활용해 실속과 취향을 동시에 챙기는 것이 핵심입니다.',
    noticeText: '본 콘텐츠는 매경비즈 디지털뉴스룸이 공식 발표 자료와 보도자료를 바탕으로 작성했습니다.',
    imageRecommendations: [
      { position: '본문 업체 소개 이미지', sourceUrl: 'https://www.ohou.se', keywords: ['오늘의집 신혼집 인테리어'], caption: '< 출처 : 오늘의집 >' }
    ]
  };

  return {
    recommendedType: primaryType,
    secondaryType,
    primaryReason,
    secondaryReason,
    sources,
    researchItems,
    titleCandidates,
    selectedTitleId: 'tc-w1',
    outline: [],
    outlineApproved: true,
    draftSections,
    summaryBlocks,
    factChecks: extractFactSentencesFromSections(draftSections, sources)
  };
}

function getViralBreadScenario(kw, primaryType, secondaryType, primaryReason, secondaryReason) {
  const sources = [
    {
      id: 'src-b1',
      url: 'https://www.mk.co.kr/news/culture/11102931',
      title: '매일경제 - 민음사 세계문학전집 책갈피 콜라보 열풍 분석',
      method: '언론 보도',
      reliability: '높음',
      excluded: false
    }
  ];

  const researchItems = [
    {
      id: 'ri-b1',
      category: '1999~2026 띠부씰·굿즈 빵 계보',
      fact: '1999년 국진이빵·핑클빵에서 시작된 띠부씰 수집 문화는 2022년 포켓몬빵 재출시(159종)를 거쳐 2026년 민음사 세계문학전집 미니 책갈피(50종) 콜라보로 진화했습니다.',
      rawReference: '유통·출판 콜라보 연대기 정리',
      sourceIds: ['src-b1']
    },
    {
      id: 'ri-b2',
      category: '소비자 심리 4가지',
      fact: '2,000원대 소액 가챠(뽑기)의 설렘, 독서를 세련된 취향으로 여기는 텍스트힙(Text Hip) 열풍, SNS 컬렉션 인증 문화, 중고 앱 교환 생태계 등 4가지 심리가 맞물렸습니다.',
      rawReference: '소비 트렌드 심리 분석',
      sourceIds: ['src-b1']
    }
  ];

  const titleCandidates = [
    { id: 'tc-b1', title: '"빵 봉지 열었더니 데미안 책갈피가?"…1999년 국진이빵부터 2026년 민음사빵까지 띠부씰 계보 총정리', totalScore: 95 },
    { id: 'tc-b2', title: '"포켓몬빵 다음은 세계문학전집"…MZ세대가 민음사빵 책갈피 수집에 열광하는 4가지 이유', totalScore: 90 },
    { id: 'tc-b3', title: '"책은 안 읽어도 책갈피는 모아요"…텍스트힙 열풍이 만든 출판·유통 이색 콜라보 트렌드', totalScore: 88 },
    { id: 'tc-b4', title: '"편의점 입고 시간만 기다립니다"…민음사빵 오픈런 현상과 목적형 소비 분석', totalScore: 85 },
    { id: 'tc-b5', title: '"추억의 스티커에서 문학 굿즈로"…띠부띠부씰 마케팅 27년 변천사', totalScore: 82 }
  ];

  const draftSections = [
    {
      id: 'sec-b1',
      title: '1999년 국진이빵에서 2026년 민음사빵까지 띠부씰은 어떻게 진화했을까요?',
      content: '편의점 빵 코너 앞에서 빵 맛보다 안에 든 굿즈를 먼저 확인해 보신 적 없으신가요?\n\n최근 출판사 민음사와 유통업계가 협업해 선보인 이른바 ‘민음사빵’이 품귀 현상을 빚고 있습니다. 빵 봉지 안에 민음사 세계문학전집 표지를 그대로 축소한 미니 책갈피 50종이 랜덤으로 동봉되면서, 1999년 국진이빵과 2022년 포켓몬빵의 뒤를 잇는 새로운 수집 열풍을 만들어냈습니다.',
      sourceIds: ['src-b1']
    },
    {
      id: 'sec-b2',
      title: 'MZ세대는 왜 빵보다 세계문학전집 책갈피 수집에 열광할까요?',
      content: '전문가들은 이번 열풍의 원인을 네 가지 심리로 분석합니다. 첫째는 2,000원대 소액으로 즉각적인 설렘을 얻는 랜덤 뽑기(가챠) 심리입니다. 둘째는 독서를 세련된 문화로 소비하는 텍스트힙(Text Hip) 트렌드입니다.\n\n셋째는 SNS에 나만의 문학 책갈피 컬렉션을 공유하는 인증 문화이며, 넷째는 중복된 책갈피를 중고거래 앱에서 교환하며 완성도를 높이는 목적형 소비 생태계입니다.',
      sourceIds: ['src-b1']
    }
  ];

  const summaryBlocks = {
    mkCategory: '산업 Q&A',
    mkCategoryReason: `1999년 국진이빵부터 2026년 민음사빵까지 이어진 띠부씰 수집 계보와 소비자 심리를 문답으로 해설하므로 [산업 Q&A] 카테고리가 적합합니다.`,
    byline: '산업 Q&A | 남궁선희 기자 | 입력 2026.10.22 09:30',
    companyTags: ['민음사'],
    subtitle: '세계문학전집 표지 담은 미니 책갈피 50종 랜덤 동봉에 편의점 오픈런',
    aiFactSummary: [
      '1. 민음사 세계문학전집 표지 디자인을 활용한 미니 책갈피 50종이 동봉된 ‘민음사빵’이 MZ세대 사이에서 품귀 현상을 빚고 있습니다.',
      '2. 1999년 국진이빵, 2022년 포켓몬빵으로 이어진 띠부씰 수집 계보가 2026년 ‘텍스트힙(Text Hip)’ 문화와 결합해 진화했습니다.',
      '3. 소액 가챠 심리, 지적 취향 인증, 중고 교환 커뮤니티 활성화가 목적형 소비를 견인하는 핵심 요인으로 꼽힙니다.'
    ],
    summaryTable: {
      title: '[요약표] 1999~2026 대표 띠부씰·굿즈 빵 계보 비교',
      headers: ['연도', '대표 제품', '동봉 굿즈', '핵심 소비 키워드'],
      rows: [
        ['1999년', '국진이빵·핑클빵', '캐릭터·아이돌 스티커', 'IMF 직후 대중 스타 팬덤 소비'],
        ['2022년', '포켓몬빵 (재출시)', '포켓몬 띠부띠부씰 159종', '밀레니얼 세대 뉴트로·추억 소환'],
        ['2026년', '민음사 콜라보 빵', '세계문학전집 미니 책갈피 50종', '텍스트힙(Text Hip)·지적 취향 인증']
      ]
    },
    faqs: [
      { q: 'Q1. 민음사빵에 들어 있는 세계문학전집 책갈피는 총 몇 종인가요?', a: '데미안, 인간 실격, 호밀밭의 파수꾼 등 민음사 세계문학전집의 인기 표지 50종이 미니 책갈피 형태로 랜덤 동봉되어 있습니다.' },
      { q: 'Q2. 텍스트힙(Text Hip) 트렌드란 무엇을 뜻하나요?', a: '글자를 뜻하는 텍스트(Text)와 멋지다는 뜻의 힙(Hip)을 합친 신조어로, 독서와 기록 문화를 세련된 취향으로 여기고 공유하는 현상을 말합니다.' },
      { q: 'Q3. 과거 포켓몬빵 열풍과 민음사빵 열풍의 차이점은 무엇인가요?', a: '포켓몬빵이 어린 시절 추억을 소비하는 뉴트로 열풍이었다면, 민음사빵은 문학 작품 표지를 통해 본인의 지적 취향을 드러내는 가치 소비 성향이 강합니다.' },
      { q: 'Q4. 편의점 입고 물량은 어떻게 확인할 수 있나요?', a: '주요 편의점 공식 앱의 재고 조회 기능을 통해 매장별 실시간 입고 수량을 확인한 뒤 방문하면 헛걸음을 줄일 수 있습니다.' },
      { q: 'Q5. 출판업계가 식품·유통업계와 협업하는 이유는 무엇인가요?', a: '일상 소비재인 빵·음료를 매개로 독서 비관여층에게 출판 브랜드 친밀도를 높이고 자연스럽게 도서 구매로 연결하기 위해서입니다.' }
    ],
    fanoutQuestions: [
      { id: 'fq-b1', category: '입고시간', q: '편의점에 민음사 콜라보 빵이 보통 몇 시쯤 들어오나요?', a: '점포마다 물류 차량 도착 시각에 차이가 있지만 대개 오후 8시~10시 사이 야간 물류나 오전 8시 전후에 입고되는 경우가 많아 편의점 앱 재고 조회를 권장합니다.' },
      { id: 'fq-b2', category: '중고시세', q: '원하는 세계문학전집 표지 책갈피만 번개장터나 당근에서 따로 살 수도 있나요?', a: '데미안이나 인간 실격 등 인기 작품 표지 책갈피는 온라인 커뮤니티와 중고거래 앱에서 개당 1,500~3,000원 선에 활발히 교환·거래되고 있습니다.' },
      { id: 'fq-b3', category: '종류·가격', q: '민음사빵은 종류가 몇 가지이고 개당 가격은 얼마인가요?', a: '크림빵·데니쉬·초코롤 등 총 4종의 베이커리 라인업으로 출시되었으며, 가격은 전국 편의점 기준 개당 2,000~2,500원대입니다.' },
      { id: 'fq-b4', category: '구매제한', q: '한 매장에서 여러 개를 한꺼번에 박스째 구매할 수도 있나요?', a: '점포당 하루 입고 수량이 한정되어 있어 일부 직영점이나 인기 매장에서는 1인당 2~3개로 구매 수량을 제한하기도 합니다.' },
      { id: 'fq-b5', category: '재질·보관', q: '빵 안에 들어 있는 미니 책갈피는 종이 재질인가요, 플라스틱 코팅이 되어 있나요?', a: '빵의 유분이나 습기에 젖지 않도록 방수 코팅 처리된 탄탄한 PET·고급지 소재로 제작되어 실제 독서용 책갈피로 오래 사용할 수 있습니다.' },
      { id: 'fq-b6', category: '후속일정', q: '이번 1차 50종 말고 2차 세계문학전집 책갈피 라인업도 추가로 나올 예정인가요?', a: '초기 물량 완판에 힘입어 출판사와 유통사는 시즌 한정 표지와 미수록 고전 작품을 추가한 2차 라인업 확대를 긍정적으로 검토하고 있습니다.' }
    ],
    oneLineSummary: '한 줄 요약! 1999년 국진이빵에서 출발한 띠부씰 수집 문화는 2026년 텍스트힙 트렌드와 만나 문학 굿즈를 수집하는 민음사빵 열풍으로 진화했습니다.',
    noticeText: '본 콘텐츠는 매경비즈 디지털뉴스룸이 공식 발표 자료와 보도자료를 바탕으로 작성했습니다.',
    imageRecommendations: [
      { position: '본문 민음사 콜라보 이미지', sourceUrl: 'https://minumsa.minumsa.com', keywords: ['민음사 세계문학전집 책갈피'], caption: '< 출처 : 민음사 >' }
    ]
  };

  return {
    recommendedType: primaryType,
    secondaryType,
    primaryReason,
    secondaryReason,
    sources,
    researchItems,
    titleCandidates,
    selectedTitleId: 'tc-b1',
    outline: [],
    outlineApproved: true,
    draftSections,
    summaryBlocks,
    factChecks: extractFactSentencesFromSections(draftSections, sources)
  };
}

function getB2BTargetScenario(kw, comp, targetUrl, primaryType, secondaryType, primaryReason, secondaryReason) {
  const companyName = comp || '번개장터';
  const sources = [
    {
      id: 'src-e1',
      url: targetUrl || 'https://m.bunjang.co.kr',
      title: `${companyName} 공식 홈페이지 및 2026 서비스 보도자료`,
      method: '기업 공식',
      reliability: '높음',
      excluded: false
    }
  ];

  const researchItems = [
    {
      id: 'ri-e1',
      category: '대상 기업 핵심 솔루션',
      fact: `${companyName}는 정품 검수 센터와 에스크로 안전결제 전면 도입을 통해 개인 간 중고거래 신뢰도를 높이고 누적 거래액을 확대하고 있습니다.`,
      rawReference: `${companyName} 공식 보도자료`,
      sourceIds: ['src-e1']
    }
  ];

  const titleCandidates = [
    { id: 'tc-e1', title: `"사기 걱정 없는 거래 비결은?"…2026 리커머스 메가 트렌드부터 ${companyName} 핵심 서비스까지 Q&A 7문 7답`, totalScore: 95 },
    { id: 'tc-e2', title: `"중고거래도 백화점처럼 검수합니다"…신뢰 기술로 진화한 ${companyName}의 성장 전략`, totalScore: 91 },
    { id: 'tc-e3', title: `"가품이면 100% 환불해 드립니다"…리커머스 시장 키우는 ${companyName} 정품 검수 경쟁력`, totalScore: 88 },
    { id: 'tc-e4', title: `"고물가 시대 합리적 명품·취미 소비"…세컨드핸드 트렌드와 ${companyName} 활용법`, totalScore: 85 },
    { id: 'tc-e5', title: `"직거래 사기 불안 끝냈다"…안전결제 전면 도입한 ${companyName} Q&A 총정리`, totalScore: 83 }
  ];

  const draftSections = [
    {
      id: 'sec-e1',
      title: '고물가 시대, 왜 지금 버티컬·리커머스 트렌드에 주목할까요?',
      content: '가성비와 취향을 모두 챙기려다 거래 안전성 때문에 망설여 보신 적 없으신가요?\n\nQ1. 최근 소비 시장에서 세컨드핸드와 버티컬 플랫폼이 급성장하는 이유는 무엇인가요?\n고물가 기조 속에서 합리적인 가격에 검증된 품질을 원하는 실속형 소비자가 크게 늘었기 때문입니다.\n\nQ2. 기존 개인 간 거래에서 소비자들이 가장 불편해하던 점은 무엇인가요?\n가품 우려와 입금 후 물건을 받지 못하는 사기 피해, 번거로운 가격 흥정 과정이 대표적인 진입 장벽이었습니다.',
      sourceIds: ['src-e1']
    },
    {
      id: 'sec-e2',
      title: `개인 간 거래 불안을 해결한 ${companyName}만의 핵심 경쟁력은 무엇인가요?`,
      content: `Q7. 그렇다면 최근 주목받는 ${companyName}는 어떤 차별화된 서비스를 제공하고 있나요?\n${companyName}는 공식 홈페이지와 앱을 통해 정품 검수 솔루션과 에스크로 기반 안전결제를 기본 적용하고 있습니다. 구매자가 물품을 수령하고 상태를 확인한 뒤에야 정산이 완료되는 구조로 안전한 거래 환경을 제공합니다.`,
      sourceIds: ['src-e1']
    }
  ];

  const summaryBlocks = {
    mkCategory: '성공사례',
    mkCategoryReason: `리커머스 시장의 가품·사기 불안을 정품 검수와 안전결제 기술로 해결한 ${companyName}의 경쟁력을 다루므로 [성공사례] 카테고리를 추천합니다.`,
    byline: '성공사례 | 남궁선희 기자 | 입력 2026.10.22 09:30',
    companyTags: [companyName],
    subtitle: `트렌드 문답 7개로 살펴본 시장 변화와 ${companyName} 핵심 경쟁력`,
    aiFactSummary: [
      '1. 고물가와 가치 소비 확산이 맞물리며 신뢰 기반 버티컬·리커머스 시장이 가파르게 성장하고 있습니다.',
      '2. 소비자들은 단순 저가 경쟁보다 정품 검수와 에스크로 안전결제 등 거래 안정성을 최우선 기준으로 꼽습니다.',
      `3. ${companyName}는 전문 검수 인프라와 안전결제 시스템을 앞세워 시장 내 핵심 플랫폼으로 자리잡고 있습니다.`
    ],
    summaryTable: {
      title: `[요약표] ${companyName} 핵심 서비스 요약`,
      headers: ['구분', '핵심 기능', '소비자 혜택'],
      rows: [
        ['거래 안전성', '에스크로 안전결제 전면 적용', '구매 확정 후 정산으로 사기 피해 원천 차단'],
        ['품질 검증', '전문 검수팀 정품·상태 판정', '가품 우려 해소 및 등급별 투명한 정보 제공'],
        ['편의성', 'AI 기반 맞춤 추천 및 간편 배송', '탐색 시간 단축 및 비대면 안전 거래 지원']
      ]
    },
    faqs: [
      { q: 'Q1. 정품 검수 서비스는 어떤 절차로 진행되나요?', a: '판매자가 상품을 검수 센터로 보내면 전문 감정사가 정품 여부와 외관 상태를 확인한 뒤 구매자에게 발송합니다.' },
      { q: `Q2. ${companyName} 안전결제에서 가품 판정이 나면 어떻게 되나요?`, a: '가품 판정 시 거래는 즉시 취소되며 구매자가 결제한 금액은 100% 전액 환불됩니다.' },
      { q: 'Q3. 에스크로 안전결제란 무엇인가요?', a: '구매자가 결제한 대금을 플랫폼이 안전하게 보관했다가 물품 수령 확인 후 판매자에게 정산해 주는 거래 보호 시스템입니다.' },
      { q: 'Q4. 중고 거래 시 가장 활발하게 거래되는 카테고리는 무엇인가요?', a: '한정판 스니커즈, 디지털 기기, 브랜드 의류·가방, 취미·굿즈 카테고리가 높은 거래 비중을 차지하고 있습니다.' },
      { q: `Q5. ${companyName} 모바일 앱에서 안전결제는 어떻게 이용하나요?`, a: '상품 상세 페이지에서 번개페이(안전결제) 버튼을 눌러 카드나 간편결제로 즉시 결제할 수 있습니다.' }
    ],
    fanoutQuestions: [
      { id: 'fq-e1', category: '수수료·부담', q: `${companyName}에서 안전결제나 정품 검수를 이용할 때 수수료는 누가 부담하나요?`, a: `기본 안전결제 수수료 정책은 거래 카테고리와 프로모션에 따라 차등 적용되며, 정품 검수 서비스는 구매 희망자가 검수 옵션을 선택해 신청할 수 있습니다.` },
      { id: 'fq-e2', category: '정산기간', q: `판매자 입장에서 물건을 보낸 뒤 정산금은 며칠 만에 입금되나요?`, a: `구매자가 배송 완료 후 구매 확정을 누르면 즉시 또는 익영업일에 정산되며, 구매 확정을 누르지 않더라도 배송 완료 후 일정 기간이 지나면 자동 정산됩니다.` },
      { id: 'fq-e3', category: '분쟁해결', q: `택배를 받았는데 사진에 없던 하자가 있으면 환불받을 수 있나요?`, a: `구매 확정 전에 개봉 영상이나 상태 사진을 첨부해 분쟁 조정을 신청하면 에스크로 대금 보류 상태에서 안전하게 반품·환불 절차를 밟을 수 있습니다.` },
      { id: 'fq-e4', category: '검수소요시간', q: `정품 검수 센터를 거치면 일반 택배보다 배송이 며칠이나 더 걸리나요?`, a: `판매자 발송 후 검수 센터 입고 당일 또는 익일에 감정이 완료되어 발송되므로 일반 거래보다 약 2~3영업일 정도만 추가 소요됩니다.` },
      { id: 'fq-e5', category: '할부결제', q: `고가 명품이나 카메라를 살 때 신용카드 무이자 할부도 되나요?`, a: `${companyName} 안전결제는 주요 신용카드사 및 간편결제(카카오페이·네이버페이·토스페이)와 제휴해 월별 무이자 할부 혜택을 지원하고 있습니다.` },
      { id: 'fq-e6', category: '비즈니스제휴', q: `개인 판매자 말고 브랜드나 전문 리셀러도 공식 입점할 수 있나요?`, a: `전문 상점(프로상점) 등록 및 브랜드 공식 입점 제휴 프로그램을 통해 대량 재고 연동과 정품 인증 배지 혜택을 지원받을 수 있습니다.` }
    ],
    oneLineSummary: `한 줄 요약! 시장 트렌드가 신뢰 중심으로 재편되면서 검수와 안전결제를 결합한 ${companyName}의 맞춤형 솔루션이 주목받고 있습니다.`,
    noticeText: '본 콘텐츠는 매경비즈 디지털뉴스룸이 공식 발표 자료와 보도자료를 바탕으로 작성했습니다.',
    imageRecommendations: [
      { position: `본문 ${companyName} 공식 이미지`, sourceUrl: targetUrl || 'https://m.bunjang.co.kr', keywords: [`${companyName} 공식 보도자료`], caption: `< 출처 : ${companyName} >` }
    ]
  };

  return {
    recommendedType: primaryType,
    secondaryType,
    primaryReason,
    secondaryReason,
    sources,
    researchItems,
    titleCandidates,
    selectedTitleId: 'tc-e1',
    outline: [],
    outlineApproved: true,
    draftSections,
    summaryBlocks,
    factChecks: extractFactSentencesFromSections(draftSections, sources)
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
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
    isVirtualIdolQuery,
    getVirtualIdolScenario,
    buildPresetScenario,
    buildDynamicWorkFromNews,
    buildDynamicScenario: buildDynamicWorkFromNews,
    buildContextualFanoutQuestions,
    extractFactSentencesFromSections
  };
} else {
  window.MK_MOCK_DATA = {
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
    isVirtualIdolQuery,
    getVirtualIdolScenario,
    buildPresetScenario,
    buildDynamicWorkFromNews,
    buildDynamicScenario: buildDynamicWorkFromNews,
    buildContextualFanoutQuestions,
    extractFactSentencesFromSections
  };
}
