# 보고서 감사 스크립트

공통 인자: `--url <보고서 페이지 url>` · `--report-dir <repo>/src/pages/reportYYYYMM` · `--widths 1440,1024,768,390,360` · `--out <dir>` · `--chrome <chrome.exe>`(또는 `CHROME_PATH`).
브라우저는 playwright 가 있으면 쓰고 없으면 puppeteer-core 를 쓴다.
각 스크립트는 마지막 줄에 `{"audit","measured","defects"}` JSON 을 찍는다. measured 0 은 통과가 아니다.

- `run-audits.mjs` — 아래 감사를 한 번에 돌려 audits.json·audits.md 작성, 결함 또는 측정 0건이면 exit 1 — `node run-audits.mjs --url http://localhost:5173/report/YYYY-MM --report-dir ../repo/src/pages/reportYYYYMM --units source-units.json --out audit-out`
- `lib.mjs` — 공통 인자·브라우저 실행·요약 출력(직접 실행하지 않음)
- `source_units.py` — DOCX 의 모든 문단·표 칸·텍스트 상자·각주를 원문 단위로 뽑아 `--units` 입력을 만든다 — `python source_units.py report.docx source-units.json`
- `audit.mjs` (+`audit-collect.mjs`·`audit-compare.mjs`) — 그림 제목·자료·주 불일치, 표 행·병합 불일치, 각주 위치 어긋남, 장별 문구 누락 — `node audit.mjs --url <url> --docx-json docxContent.json --units source-units.json --chapters 14:overview,55:policy-conditions`
- `regression.mjs` — 원문 문구 누락·잘림·중복·횟수 부족, 각주 표시 누락·끊긴 링크, 사이드 메뉴 앵커 누락 — `node regression.mjs --url <url> --units source-units.json --chapters 14:overview,55:policy-conditions --report-dir <dir>`
- `footnote-map.mjs` — 각주 번호 N 팝업 내용이 원문 각주 N 과 다름, 어느 표시에서도 안 열리는 팝업 — `node footnote-map.mjs --url <url> --units source-units.json`
- `reverse-text.mjs` — 화면 글 중 원문에 없는 글(바뀐 글자·이전 보고서 잔재) — `node reverse-text.mjs --url <url> --units source-units.json`
- `axis-title-audit.mjs` — 가로형 y축 제목이 축선과 어긋남·겹침·차트 밖으로 나감(리사이즈) — `node axis-title-audit.mjs --url <url>`
- `axis-title-overlap.mjs` — y축 제목끼리 겹침(폭마다 새로 열어 모바일 첫 진입 기준) — `node axis-title-overlap.mjs --url <url>`
- `bar-gap-audit.mjs` — 막대 사이 간격 없음·겹침, 막대 폭/칸 비율(bar-ratio.json, 원본 그림 비율과 대조) — `node bar-gap-audit.mjs --url <url>`
- `legend-overlap.mjs` — 범례가 축 제목·눈금·라벨과 겹침 — `node legend-overlap.mjs --url <url>`
- `responsive-audit.mjs` (+`responsive-check.mjs`) — 가로 스크롤·화면 밖 요소·글자 잘림·세로로 꺾인 글자·제목줄 겹침·넓은 표/이미지·차트 글자 겹침/잘림·모바일 큰 글자 — `node responsive-audit.mjs --url <url> --fresh 768,375`
- `audit-axis-clip.mjs` — 축 라벨 잘림, linkedTo 미러축 눈금 불일치, 둥근 막대 — `node audit-axis-clip.mjs --url <url>`
- `audit-band-edge.mjs` — 데이터 끝에 닿는 음영이 플롯 끝까지 안 감 — `node audit-band-edge.mjs --url <url>`
- `font-audit.mjs` — 글자 종류별 글꼴(크기·굵기·패밀리·색)이 기존 보고서 다수값과 다름 — `node font-audit.mjs --base-url <기존 url> --url <url>`
- `style-parity-audit.mjs` — 같은 요소 종류의 계산 스타일이 기존 보고서와 다름(간격·구조는 JSON 증거) — `node style-parity-audit.mjs --base-url <기존 url> --url <url>`
- `audit-ticks.mjs` — 눈금 헬퍼가 데이터 날짜 형식과 안 맞아 눈금이 비는 차트 — `node audit-ticks.mjs --report-dir <dir>`
- `scan-axis-tick.mjs` — 축 min/max 와 tickPositions 첫·끝값 불일치, 불균등 간격 — `node scan-axis-tick.mjs --report-dir <dir>`
- `scan-chart-fidelity.mjs` — 컴포넌트가 읽는 데이터 키가 JSON 에 없음, yAxis·min/max 없음 — `node scan-chart-fidelity.mjs --report-dir <dir>`
- `scan-clip.mjs` — 고정 축 범위가 실제 데이터를 잘라 먹음 — `node scan-clip.mjs --report-dir <dir>`
- `scan-dualaxis-zeroline.mjs` — 이중축의 0선 높이가 좌우 다름 — `node scan-dualaxis-zeroline.mjs --report-dir <dir>`
- `scan-orphan-charts.mjs` — 어디서도 참조하지 않는(렌더 안 되는) 차트 컴포넌트 — `node scan-orphan-charts.mjs --report-dir <dir>`
- `notes_audit.py` — 그림 주의 번호 N) 에 대응하는 위첨자 표시가 제목·차트 어디에도 없음 — `python notes_audit.py --report-dir <dir>`
- `scan-source-tables.mjs` — start-report document.json 에서 "표 X-N" 캡션에 렌더 가능한 표 그리드가 없음 — `node scan-source-tables.mjs --document document.json`
