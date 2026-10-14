# 원본 그림 특징 추출·대조와 피드백 루프

## 왜 필요한가

DOCX 의 통계 그림은 대부분 WMF/EMF **벡터 파일**이다(2026-09: 153개 중 140개).
눈금 숫자·범례 문구·주석 글자·선 색·점선 여부·음영 위치가 좌표째 저장돼 있다.
이를 PNG 로 바꿔 픽셀 유사도로 비교하면 작은 특징(기준선, 주석, 마커, 눈금 간격)이 점수에 묻힌다.
2026-09 오너 지적 252건 중 약 70%가 이런 시각 특징 누락이었다.

## 단계

1. **추출** — `start-report.py` 가 `figure-features.json` 을 만든다(단독 실행: `python scripts/extract-figure-features.py --source <docx> --out <json>`).
   그림·패널마다 `yAxes`(눈금·안쪽/바깥 눈금, 다중 우축은 축마다), `units`(축 단위), `xLabels`, `xTicks`,
   `legend`(문구·표시 line/bar/line+marker/marker-only·색·점선), `series`, `bars`, `bands`, `referenceLines`,
   `gridLines`, `verticalLines`, `notes`(플롯 안 글자), `markers`, `triangles`, `panelCount` 를 기록한다.
   바이트가 같은 그림은 `duplicate`, 래스터(png/jpg)는 `raster-manual` 로 남는다.
2. **연결** — 시트마다 `charts/<SHEET>.json` 의 `figureLink` 가 세 신호로 그림을 고른다:
   캡션 순서(「그림 Ⅲ-4」 또는 시트 제목이 본문 블록의 그림 수와 1:1), 범례(그림 범례 ⊂ 시트 7행 계열 이름), 데이터 범위(시트 숫자가 y축 안).
   두 신호 이상이 한 그림을 가리키면 `confirmed`, 하나뿐이면 `likely`, 동점이면 `needs-owner`, 후보가 없으면 `none`.
   `confirmed` 외에는 오너 리뷰 질문이다. 추정으로 고르지 않는다(MUST).
3. **계약 채우기** — 연결된 그림의 특징이 `visualContract`(status `draft-from-source-figure`)와 `featureSummary` 로 들어간다.
   축을 못 찾은 그림(EMF·도식)은 `pending-manual` 이며 사람이 그림을 보고 `featureSummary` 를 쓴다.
   `featureSummary` 는 owner-review.md·comparison.html 에서 이미지·유사도보다 먼저 보이고, 승인되면 차트별 OpenSpec 시나리오가 된다.
   특징 없는 차트 단위는 오너 결정(reuse/new)을 받을 수 없다(workflow.mjs 가 거부).
4. **대조** — 구현 후 `node scripts/verify-figure-features.mjs --features <json> --map <figure→차트 id> --url <보고서> --widths 1440,390 --out <dir>`
   (`--chrome <chrome.exe>` 로 브라우저 지정). 결과의 `unmapped`(원본 그림이 구현 차트와 연결 안 됨)와 `no-source`(구현 차트에 원본 그림이 없음)도 검토 목록이다.
   `--map` 은 오너가 확정한 연결을 쓴다. 자동 연결(범례 60%+눈금 40%, 범례 없으면 눈금·x축 라벨)은 후보 찾기용이다.
5. **오너 예외** — 오너가 일부러 원본과 다르게 정한 것(예: X축 「25」 삭제, 원본 오타 「좌측」→「좌축」)은
   `--exceptions` 파일에 `{chart, feature, reason, ticket}` 로 적는다. 결과에 `accepted` 로 남고 숨기지 않는다.

## 현재 정확도와 한계 (2026-10-14 측정, 그대로 보고할 것)

측정: 2026-09 DOCX(그림 153개: 벡터 122·중복 19·래스터 12)와 develop 기준 구현(1440px, 차트 126개)을 대조했다.
- **특징 값**: 연결된 110패널에서 항목 1,235건 중 1,189건(96%) 일치. 범례 표시 246/247, y축 단위 210/213, y축 눈금 216/231.
- **그림↔시트 연결**: 시트 119개 중 confirmed 94·likely 11·needs-owner 8·none 6.
  구현으로 정답을 확인할 수 있는 69시트에서 confirmed 59개는 모두 맞았고 틀리게 확정한 것은 0개다(나머지는 오너 질문으로 남음).
  needs-owner 는 대부분 같은 그림이 개요·본문에 반복된 경우(물가상승률 전망 3곳)다.
- 남은 불일치 46건은 검토 목록이다: 세로로 붙은 다중 패널(한 틀로 읽힘), 빗금 전망 막대, 원본 오타, 오너가 정한 예외, 실제 차이 후보.
  **실패 목록은 합격 판정이 아니라 검토 목록이다(MUST).**
- 못 읽는 것: EMF 그림 7개와 도식(축 없음), 래스터 12개 → `pending-manual`. 툴팁, 데이터 값(원본 셀 대조로 따로), 각주 본문, 모바일 배치,
  보이는 눈금 라벨 숨김(showLastLabel 등), 막대 폭 비율.

## 피드백 루프 (오너 지적 → 재발 방지)

오너 지적 하나를 처리할 때 아래를 모두 한다(MUST).
1. **분류** — 지적을 특징 유형(축·눈금 / X축 라벨 / 범례 / 계열 표시 / 음영 / 기준선 / 플롯 안 글자·화살표 / 패널 / 툴팁 / 각주 / 데이터 / 모바일)으로 트래커에 적는다.
2. **고치기** — 원본 특징·3월 실측·공용 헬퍼를 근거로 고친다.
3. **형제 전수** — 같은 유형의 실패를 `figure-check` 결과와 grep 으로 전 차트에서 찾아 함께 고친다. 잔존 0건을 보고한다.
4. **검사기 보강** — 대조기가 이 지적을 못 잡았다면 `figure-compare.mjs`(또는 추출기)에 규칙을 더하고, `check_figure_features.py` 에 사례를 더한다.
   규칙을 문서의 MUST 로만 남기지 않는다.
5. **예외 기록** — 오너가 원본과 다르게 정한 것이면 예외 파일에 적어, 다음 검사에서 다시 실패로 뜨지 않게 한다.
6. **소급** — 새 규칙은 이미 처리한 같은 유형 항목에도 다시 돌린다.
