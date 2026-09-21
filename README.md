# 아이랑맵 (irangmap) — 전국 키즈카페 지도

전국 키즈카페를 공공데이터로 시드하고, 연령·보호자 요금·놀이공간 같은 **출처가 붙은 속성**을 얹어 에어비앤비식 "리스트 ↔ 지도"로 보여주는 서비스의 저장소다. 1~3인 팀 전제. 계획 전문은 `~/.claude/plans/harmonic-dazzling-allen.md`, 데이터 스파이크 결과는 [docs/spike-data.md](docs/spike-data.md).

현재 전국 키즈카페 union **2,845곳**(2026-09-19, 3소스 병합 — `docs/spike-data.md`). 핵심 논지: 지도와 장소 목록은 커모디티다(네이버·카카오·애기야가자). 차별점은 ① 합법적 전국 시드 + 폐업 신선도 파이프라인 ② 키즈카페 전용 속성 레이어. 예약 수수료 모델은 하지 않는다(놀이의발견 2024-12 폐업 반면교사).

## 구조

```
apps/web        Next.js 15 App Router. 지도 MVP: MapLibre GL + VWorld 배경지도, 좌 리스트 ↔ 우 지도(뷰포트 동기화·클러스터·필터).
                지금은 public/data/venues.geojson(정적)을 읽고, DB가 붙으면 route handler로 바꾼다.
apps/pipeline   Python 3.12 (uv). 공공데이터 수집·정규화·매칭·분류. alembic이 스키마의 유일한 소유자.
                sources/  datagokr(페이징 클라이언트) · themepark_other · rest_cafes · playground · fire_mu
                normalize(EPSG:5174→WGS84) · geocode(VWorld) · names(rapidfuzz) · resolve(격자+유사도 tier)
                classify(프랜차이즈 사전+규칙) · reports(3소스 union) · loader/runs(DB 적재·run_id)
compose.yaml    postgis/postgis:17-3.5 (localhost:5433)
data/raw/       공공데이터 원본 (gitignored)
docs/           스파이크·설계 노트
```

## 데이터 출처 (시드 → 보강)

| 출처 | 규모 | 역할 |
|---|---|---|
| 행정안전부_문화_테마파크업(기타) — data.go.kr 15155250(API `…/amusement_facilities_other/info`) | 7,241행(영업 2,627), 매일 갱신 | **1차 시드**. 키즈카페·트램폴린파크 외에 캠핑장·오락실·축제도 섞여 있어 판별 단계 필요 |
| 행정안전부_식품_휴게음식점 — 15154921(API `…/rest_cafes/info`) | 647,338행(업태=키즈카페 1,456, 영업 626), 매일 갱신 | 카페형 키즈카페. `업태구분명`은 32개 값 코드 목록 |
| 경기도_휴게음식점(키즈카페) 현황 — 15057362 | 경기도 | 매처 recall 캘리브레이션 |
| 행정안전부_전국어린이놀이시설정보서비스 — 15124519 (API `…/pfc3/getPfctInfo3`) | 85,338건, 키즈카페 후보(놀이제공영업소+식품접객업소) 3,280 | **핵심 시드**: 설치장소 코드로 판별, WGS84 좌표, 실내외·공공/민간·안전검사 수리일 |
| 소방청_다중이용업소 영업장별 고유 일련번호 — 15083979 | 키즈카페업 8행 | 시드 아님. `다중이용업소` 플래그 교차만 |
| 서울 우리동네키움포털 | 서울형 300개소 | 공공 키즈카페 목록·잔여석 |
| 업소 공식 홈페이지·인스타그램 | — | 속성(연령·요금·놀이공간) LLM 추출, 출처 URL 필수 |

## 수집 가드레일 (깨면 안 되는 선)

- 카카오 로컬 API 결과는 **장소 ID만** 저장. 구글 Places는 실시간 fetch만(place_id 제외 저장 금지). 네이버 검색 API는 LLM 입력 금지 조항 때문에 쓰지 않는다.
- `naver_aux`(네이버 플레이스 보조 크롤)와 `umppa`는 킬스위치 기본 꺼짐, 단일 IP, 로그인 없음, ≥5초/건, **프록시·VPN 우회 금지**, 차단되면 중단. `NAVER_AUX_LEVEL=1`은 포인터(URL·홈페이지·인스타 링크)만. 어떤 단계에서도 리뷰·사진·평점·리뷰수·방문자수 저장 금지.
- 서울형 키즈카페 "예약 오픈 알림"은 서울시 협의 전 만들지 않는다.

## 개발환경

요구사항: Python 3.12+, `uv`, Node.js 22.12+, `pnpm` 9.12.1, Docker.

```bash
cp .env.example .env            # DATA_GO_KR_KEY 등 채우기
uv sync --directory apps/pipeline
pnpm install
docker compose up -d postgres
uv run --directory apps/pipeline alembic upgrade head
```

파이프라인 CLI — `ingest`는 `--dry-run`(DB에 쓰지 않고 집계만)과 `--save`(원본 저장)를 지원한다. DB 적재 경로는 마이그레이션 적용 후 열린다.

```bash
pnpm pipeline ingest themepark-other --dry-run --save data/raw/themepark_other.json   # 7,241건, 73콜
pnpm pipeline ingest playground --dry-run --save data/raw/playground.jsonl.gz          # 85,338건, 86콜
pnpm pipeline ingest rest-cafes --dry-run --save data/raw/rest_cafes.jsonl.gz          # 647k건, 6,474콜(--start-page로 재개)
pnpm pipeline ingest fire-mu --dry-run                                                 # 소방청 CSV(플래그용)
pnpm pipeline ingest umppa --dry-run --save data/raw/umppa.json                        # 서울형 키즈카페 이용안내(ENABLE_UMPPA=true, 5초/요청, ~15분)
pnpm pipeline report seeds                                                             # 3소스 union·매칭 tier (DB 불필요)
pnpm pipeline ingest official --dry-run                                               # 프랜차이즈 공식 사이트(channels.json) 수집: robots·Crawl-delay 준수, 3초/호스트
pnpm pipeline extract official --brands 바운스,뽀로로파크                                  # 저장 텍스트 → 속성 (claude -p 헤드리스, API 키 불필요)
pnpm pipeline export geojson --out data/derived/venues.geojson                         # union + umppa attrs + official attrs → GeoJSON
```

`.env`에 필요한 키: `DATA_GO_KR_KEY` + `DATAGOKR_THEMEPARK_URL`/`DATAGOKR_RESTCAFE_URL`/`DATAGOKR_PLAYGROUND_URL`(엔드포인트, `.env.example` 참고) · `VWORLD_KEY`(지오코딩) · `GG_DATA_KEY`(경기데이터드림, 선택). 오너가 더 준비할 것은 [docs/owner-todo.md](docs/owner-todo.md).

지도 MVP 실행 (DB 불필요):

```bash
pnpm data:sync                                  # data/derived/venues.geojson → apps/web/public/data/
echo "NEXT_PUBLIC_VWORLD_KEY=<VWorld 키>" > apps/web/.env.local
pnpm dev:web                                    # http://localhost:3000 (predev가 maplibre 워커를 public/vendor/로 복사)
```

지도 라이브러리 메모: 카카오맵 JS SDK 대신 MapLibre + VWorld 타일(무료, 키 있음)로 시작했다. 리스트·필터·동기화 로직은 지도 라이브러리와 무관하므로 카카오로 바꿔도 `components/MapView.tsx`만 갈아 끼우면 된다. maplibre-gl 6의 모듈 워커는 Next 번들러가 URL을 못 만들어 `setWorkerUrl("/vendor/maplibre-gl-worker.mjs")`로 고정한다.

체감 속도로 볼 때는 **프로덕션 모드**로 본다(dev 모드는 번들 1.7MB·StrictMode 이중 마운트로 지도가 훨씬 무겁다):

```bash
pnpm build:web && pnpm start:web          # http://localhost:3000
```

성능 진단: `http://localhost:3000/?perf=1`로 열면 8초·25초 시점에 `performance.mark` 타임라인(`kc:geojson-fetched` → `kc:list-rendered` → `kc:map-load` → `kc:venues-source-loaded`)을 `/api/perf`로 보내 서버 로그에 남긴다. 2026-09-20 실측(M1 Max, 프로덕션): Safari 0.98초 / Chrome 0.93초에 지도·마커·리스트 완료. 주의: DevTools 프로토콜이 붙은 자동화 브라우저(chrome-devtools MCP 등)에서는 MapLibre 워커 왕복이 수십 배 느려져 12~150초로 측정되므로 성능 판단에 쓰지 않는다.

지도가 배경만 뜨고 마커가 없거나 수십 초 걸리면 두 가지를 먼저 본다: ① `public/vendor/maplibre-gl-worker.mjs`가 있는지(`pnpm vendor`) ② 스타일에 원격 `glyphs`가 남아 있는지(폰트 404가 타일 완료를 막는다 — 클러스터 숫자는 HTML 라벨로 그린다).

전체 검증:

```bash
pnpm lint && pnpm test && pnpm build && docker compose config
```

스키마를 바꿀 때는 `apps/pipeline/src/kidscafe_pipeline/models.py`를 고친 뒤 마이그레이션을 만든다.

```bash
uv run --directory apps/pipeline alembic revision --autogenerate -m "설명"
```

## 속성 레이어 (이용 정보) — 채우는 순서

상세 패널의 이용 연령·보호자 요금·아동 요금·양말·놀이 공간·편의·유의사항·사진은 값마다 **출처 + 확인일**을 달고 채운다.

1. **서울형 키즈카페** — 서울시 우리동네키움포털(`umppa.seoul.go.kr/icare`, robots Allow) 공개 이용안내를 `ingest umppa`로 수집. `export geojson`이 주소를 VWorld로 지오코딩(`data/derived/umppa_geocode_cache.json`)해 300 m 안 이름 유사도(괄호 별칭·구/동 접미 제거, 30 m 안 공공류는 이름 무관)로 union 업소에 붙이고, 없으면 공공 업소로 추가한다(2026-09-20: 140개소 → 병합 71 · 신규 69). 사진은 저장·임베드하지 않고 서울시 원본 링크만 둔다.
2. **프랜차이즈 공식 사이트** — `data/raw/official/channels.json`(브랜드별 공식·매장목록·이용안내 URL, robots 상태, 렌더 방식)에 적힌 페이지만 `ingest official`로 받아 텍스트(+원본 HTML)로 저장하고, `extract official`이 브랜드 공통 값(brand_level)과 매장별 값(stores[])을 뽑는다. **기본 백엔드는 job-crawler와 같은 Azure AI Foundry 리소스**(`llm_azure.py`: `.env`의 `AZURE_OPENAI_API_KEY`·`AZURE_OPENAI_RESOURCE`, v1 surface `https://{resource}.services.ai.azure.com/openai/v1`, `model`=배포명 `modulabs-gpt-5.5`, Responses API + strict json_schema). `--backend claude`면 Claude Code 헤드리스(`extract_claude.py`)로 대체. `export geojson`이 브랜드 공통은 `scope=brand`(상세에 '브랜드 공통 안내' 경고), 매장명 지역 토큰이 맞으면 `scope=store`로 붙인다(`enrich_official.py`). 2026-09-21(Azure 재추출): 10브랜드 58곳 부착(매장별 35·공통 23), 목록만 있는 브랜드는 전화만 보충(30곳).
3. 롱테일 → 사업자 클레임·이용자 제보.
4. 사진 → 사업자·이용자 제공분만.

지도 줌은 휠 1노치 = 정수 1단계(6~17)로 스냅한다(`MapView.tsx`, 중간 단계 렌더를 없애 체감 속도 확보).

## UI 원칙 (2026-09-20 픽토그램 개편)

- 부모가 3초 안에 훑는 **핵심 6칸**(이용 연령·아동 요금·보호자·양말·예약·주차)을 아이콘 타일로 먼저 보이고, 모르면 회색 점선 "미확인". 아이콘은 `lucide-react`, 양말만 자체 SVG(`components/icons.tsx`).
- 리스트 행: 카테고리 아이콘 + 이름 + 주소 + 압축 칩(연령·요금·보호자·양말). 이용 정보가 확인된 곳은 초록 체크, 지도 마커도 초록 링(범례 좌하단). 필터 "정보 있음"으로 그런 곳만 볼 수 있다.
- 긴 안내문(연령 상세·유의사항·할인)은 3줄 접기 + "더보기". 회차는 4개만 보이고 "+N회차".
- 필터는 검색창 옆 **필터 아이콘 한 개**(적용 수 배지)로 모아 팝오버에서 종류(키즈카페·트램폴린)와 조건(이용 정보 있음·공공·실내·교차 확인)을 고르고, 적용된 것만 검색창 아래 작은 칩으로 보인다(`Filters.tsx`). 태그를 늘어놓지 않는다.
- 긴 안내문은 `RichText`가 줄바꿈·글머리·쉼표로 이어진 요금 항목을 줄 단위 목록으로 나누고, 금액·연령·앞머리 라벨(아동:, 보호자:)을 굵게 표시한다.
- 후기는 저장하지 않고 **네이버 블로그·카페 검색 딥링크**로 보낸다(`linkouts`, 인스타그램 검색 링크는 결과가 나쁘어 제외): 쿼리 = 업소명(㈜ 제거) + 주소의 구·시·군/동 + "후기" — 지점 많은 브랜드의 다른 지점 글을 걸러주는 지역 힌트(`regionHint`). 네이버 검색 API는 신규 앱에 열리지 않아(제휴 신청 불가 고지) 2단계는 **카카오(다음) 블로그·카페 검색 API**로 대체: `GET /api/reviews?q=&name=`(카카오 REST 키, 1시간 캐시)가 결과를 `lib/reviews.ts`로 다듬어(업소 토큰 없는 글 제외, 협찬 의심 글 뒤로, 제목 일치 우선) 상세 "후기 미리보기"에 5개까지 표시. 다음 검색이 blog.naver.com 글도 돌려줘 커버리지가 쓸 만하다. 저장하지 않고 링크·제목·요약만 보여준다.
- 값의 압축 규칙은 `lib/facts.ts`(예: 주차 문구에 무료만 있으면 "무료", 유료 문구 섞이면 "일부 무료").

## 지도 배경: 카카오맵 (기본) / VWorld (대체)

`apps/web/.env.local`에 `NEXT_PUBLIC_KAKAO_JS_KEY`가 있으면 `components/KakaoMapView.tsx`(카카오맵 JS SDK: MarkerClusterer, 카테고리 색·초록 링 SVG 마커, hover 링·클릭 팝업 CustomOverlay, idle → 리스트 범위 동기화, 정수 레벨 줌 1~13)를 쓰고, 없으면 `MapView.tsx`(MapLibre + VWorld 래스터)로 대체한다. 카카오 데이터는 저장하지 않고 배경 지도로만 쓴다. 사파리 실측 로딩: 지도 0.7초, 마커 2,911개 배치 1.06초(2026-09-20).

카카오 개발자 콘솔(developers.kakao.com, 앱 "키즈카페" ID 1583385)에서 필요한 설정:

1. 앱 설정 → 플랫폼 → Web → 사이트 도메인에 `http://localhost:3000`(운영 도메인은 생기면 추가). 빠지면 SDK 요청이 401 `domain mismatched`로 거절되고 브라우저에는 `net::ERR_BLOCKED_BY_ORB`로 보인다.
2. 제품 설정 → 카카오맵 → ON.
3. 앱 키 → **JavaScript 키**만 사용(Admin 키는 어디에도 넣지 않는다). 계정의 첫 앱만 무료(2026-07-21 정책).

## 배포 (Vercel) 와 정기 갱신

- **운영 URL: https://irangmap.vercel.app** (Vercel 프로젝트 `irangmap`, 팀 minjae-lees-projects, 계정 plusbeauxjours). 첫 배포 2026-09-21 09:04 KST, CLI `vercel deploy --prod`로 `apps/web`에서 직접 업로드. GitHub `plusbeauxjours/irangmap`이 연결돼 있고 Root Directory는 `apps/web`(`vercel project update irangmap --root-directory apps/web --yes`)이라 `main` 푸시마다 자동 배포된다. 정기 갱신 워크플로의 데이터 커밋도 같은 경로로 재배포된다.

- 웹은 정적 GeoJSON(`apps/web/public/data/venues.geojson`, 커밋 대상)만 읽으므로 DB 없이 Vercel에 바로 올라간다. Vercel 프로젝트 설정: **Root Directory = `apps/web`**, Framework = Next.js, 환경변수 `NEXT_PUBLIC_KAKAO_JS_KEY`, `NEXT_PUBLIC_VWORLD_KEY`. `prebuild`가 MapLibre 워커를 복사하므로 별도 빌드 명령은 필요 없다.
- 배포 후 카카오 개발자 콘솔 → 앱 → 플랫폼 키 → Web 도메인에 `https://<프로젝트>.vercel.app`(과 커스텀 도메인)을 추가해야 지도가 뜬다. VWorld 대체 지도도 키에 도메인이 묶여 있으면 같은 처리.
- `.github/workflows/refresh-data.yml`: 매일 04:00 KST 놀이시설·테마파크·서울형 수집 → GeoJSON 재생성 → 변경 시 커밋(→ Vercel 자동 재배포). 휴게음식점 전량은 매주 일요일. 저장소 시크릿 `DATA_GO_KR_KEY`, `VWORLD_KEY` 필요. 프랜차이즈 추출(`claude -p`)은 로그인 세션이 필요해 로컬에서 수동으로 돌리고 `data/derived/official_attrs*.json`을 커밋한다.
- 공개용 정적 페이지(`apps/web/app/(info)/`): `/about` 소개·데이터 출처·고지, `/terms` 이용약관 초안, `/privacy` 개인정보처리방침(현재 수집 개인정보 없음, 외부 서비스 전송 고지). `/robots.txt`·`/sitemap.xml`은 `app/robots.ts`·`app/sitemap.ts`. 패널 하단 푸터에서 링크. 문의 메일 plusbeauxjours@gmail.com. 약관·방침은 초안이라 공개 전 법률 검토 권장.

## 카카오 로그인 (Auth.js v5)

`apps/web/auth.ts` — Kakao 프로바이더, JWT 세션(DB 없음). env가 있을 때만 켜진다(`authEnabled`): `AUTH_SECRET`(`openssl rand -base64 32`), `AUTH_KAKAO_ID`(카카오 **REST API 키**), `AUTH_KAKAO_SECRET`(카카오 로그인 → 보안 → Client Secret). 로컬은 `apps/web/.env.local`, 운영은 Vercel 환경변수(sensitive). 라우트 `/api/auth/[...nextauth]`, 헤더 우측 `AuthButton`.

카카오 콘솔(앱 "키즈카페" ID 1583385) 설정: 제품 설정 → 카카오 로그인 **ON** → Redirect URI에 `http://localhost:3000/api/auth/callback/kakao`와 `https://irangmap.vercel.app/api/auth/callback/kakao` → 동의항목에서 닉네임·프로필 사진을 필수 동의로(이메일은 비즈 앱 전환이 필요해 지금은 받지 않음) → 보안에서 Client Secret 생성·활성화. 제보·사업자 확인이 붙을 때 DB 어댑터와 사용자 테이블을 더한다.

## 제보·사업자 확인 (Neon Postgres + Drizzle)

- DB: Neon(`DATABASE_URL`, 로컬 `apps/web/.env.local`·Vercel sensitive). 웹이 소유하는 테이블은 `app_` 접두어(`apps/web/lib/schema.ts`): `app_users`(카카오 회원번호), `app_reports`(정보 제보·폐업·오류, pending→approved/rejected), `app_claims`(사업자 확인 요청), `app_venue_overrides`(승인된 값, 사이트가 읽는 유일한 표). 스키마 반영: `pnpm --filter @kidscafe/web db:push`(drizzle-kit, `app_*`만 대상이라 파이프라인 alembic 테이블과 충돌 없음).
- 업소 식별자 `venueKey` = GeoJSON `sources[0]`(예: `playground:1008196`). 재내보내기 때 바뀌는 순번 id는 쓰지 않는다.
- 흐름: 상세의 "정보 제보 · 사업자 확인" → 로그인(카카오) → `POST /api/reports`(하루 20건 제한) 또는 `POST /api/claims` → `/admin`(role=admin인 사용자만)에서 승인/거절 → 승인된 제보는 `app_venue_overrides`에 합쳐지고, 사업자 확인이 승인된 사용자의 제보는 `owner` 출처. 지도는 로드 시 `GET /api/overrides`(60초 캐시)를 받아 `applyOverrides()`로 덮어쓴다(폐업 확인은 목록에서 제외). 우선순위: 사업자 확인 > 이용자 제보(검토 완료) > 공식 사이트·공공 출처.
- 관리자 지정: 한 번 로그인한 뒤 `update app_users set role='admin' where id='<카카오 회원번호>'`(`/api/me`로 확인).
