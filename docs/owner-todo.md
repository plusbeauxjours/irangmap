# 오너가 준비할 것 — 2026-09-20 전달용

2026-09-19 밤 기준. 위에 있을수록 먼저 필요하다. ✅ = 이미 확보.

## 지금 필요 (다음 작업을 막는 것)

1. **카카오 개발자 계정 + JavaScript 키** — (2026-09-20 갱신) 지도 MVP는 VWorld 타일로 먼저 띄웠으므로 **당장은 불필요**. 카카오맵 룩앤필(POI·길찾기 연동)이 필요하다고 판단될 때만.
   - 카카오맵 API는 개발자 계정의 **첫 번째 활성화 앱만 무료**(2026-07-21 정책) → 이 서비스 **전용 계정**을 새로 만들 것.
   - developers.kakao.com → 내 애플리케이션 → 앱 만들기 → 플랫폼(Web)에 `http://localhost:3000` 등록 → "JavaScript 키" 복사.
   - 같은 앱의 "REST API 키"도 함께 (Phase 2 카카오 장소 ID 링크아웃용, 지금은 선택).
2. **Docker 데몬 실행** — Postgres/PostGIS 띄우고 `alembic upgrade head` → 원본을 DB에 실적재하는 단계에 필요. `docker compose up -d postgres`만 되면 나머지는 자동.
3. **Mac 깨워두기(오늘 밤)** — 휴게음식점 647k pull 워커 3개가 백그라운드(nohup)로 돌고 있다(약 23:30 종료 예상). 잠자기 모드면 멈춘다. 멈춰도 `--start-page`로 이어받을 수 있으니 치명적이진 않음.

## 있으면 좋음 (없어도 진행 가능)

4. **경기데이터드림 키즈카페 API 요청주소** — 데이터셋 페이지(키즈카페 현황) 제목 아래 탭 **[OpenAPI]** → 요청주소 `https://openapi.gg.go.kr/<서비스명>?...`. `<서비스명>` 문자열만 있으면 됨. 용도: 우리 업태 매처 recall 검증. (업태구분명이 코드 목록으로 확인돼 중요도 낮아짐)
5. **어린이놀이시설 안전검사 조회서비스 활용신청** — data.go.kr에서 `sfty4/getSftyInsp4` 오퍼레이션을 가진 서비스(전국어린이놀이시설 안전검사정보). 자동승인. 용도: 상세 페이지 "안전검사 이력".

## 결정이 필요한 것

6. **네이버 플레이스 보조 크롤(`naver_aux`) 최종 결정** — `map.naver.com/robots.txt`가 `User-agent: * Disallow: /` + "AI 학습·RAG 봇 접근 엄격 금지"를 명시함을 확인했다. 현재 기본 꺼짐(L1). 켜려면 robots Disallow를 알고 켜는 결정이어야 한다. 권고: **끄고 시작**, 공식 홈페이지·인스타 발견은 프랜차이즈 사전 + 카카오 장소 ID(허용 범위)로.
7. **서울시(서울형 키즈카페) 연락 여부** — `umppa.seoul.go.kr/icare/`는 robots 허용. 잔여석 표시까지는 무방하나, "예약 오픈 알림"은 협의 전 금지(계획). 협의를 시도할지 결정.

## 나중 (Phase 2 이후)

8. **Anthropic API 키** — 공식 채널(홈페이지·인스타 요금표 이미지) LLM 추출용. Phase 2a 시작 시.
9. **골든셋 라벨링 시간 35~50시간** — 200곳 연령·보호자요금 수작업 라벨(Phase 2b). 본인이 하거나 아르바이트.
10. **도메인·호스팅 결정** — Vercel(웹) + Postgres 호스팅(Neon/Supabase) 등. Phase 1 배포 시.

## 이미 확보 ✅

- data.go.kr 인증키(테마파크업(기타)·휴게음식점·어린이놀이시설 3개 서비스 동작 확인) · 경기데이터드림 키 · VWorld 키 — 전부 `kidscafe/.env`(gitignored).
- 원본: `data/raw/themepark_other.json`(7,241) · `data/raw/playground.jsonl.gz`(85,338) · `data/raw/rest_cafes.part*.jsonl.gz`(수집 중).
- 파생: `data/derived/venues.geojson`(union 2,747, 최종 집계 후 재생성).

## 다음 세션 첫 명령

```bash
cd ~/Desktop/3_plejours/kidscafe
pnpm pipeline report seeds            # 휴게음식점 전량 반영된 최종 union
pnpm pipeline export geojson --out data/derived/venues.geojson
```
