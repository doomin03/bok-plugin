# Vue·브라우저 검증

## 적용 방식과 출처

외부 스킬을 통째로 설치하거나 복제하지 않고 공개된 테스트 방식을 BOK 흐름에 맞춘 자체 `bok-test` 지침과 템플릿으로 작성했다. 아래 외부 스킬의 설치 여부에 의존하지 않는다. 기준 확인일: 2026-09-21.

| 참고 자료 | 적용한 방식 | BOK에서 보완한 점 |
| --- | --- | --- |
| [vuejs-ai/vue-testing-best-practices](https://github.com/vuejs-ai/skills/blob/main/skills/vue-testing-best-practices/SKILL.md) | Vue 동작 중심 테스트, 비동기 처리, Teleport·E2E 검증 | 기존 Options/Composition API 유지, 각주 원문·소스 매핑 대조 |
| [Anthropic webapp-testing](https://github.com/anthropics/skills/blob/main/skills/webapp-testing/SKILL.md) | 실제 화면을 먼저 조사하고 브라우저 동작·캡처·오류 확인 | 준비 조건은 실제 요소/차트 기준, 기존 서버 실행 명령 사용 |
| [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) | 승인된 화면과 스크린샷 회귀 비교 | 문서 이미지 유사도와 별개, 기준 이미지 임의 갱신 금지 |
| [Highcharts responsive](https://www.highcharts.com/docs/chart-concepts/responsive) | 컨테이너 조건에 따른 responsive.rules | 기존 규칙·유틸 유지, 좌우 축 단위와 계열을 크기별 검사 |

위 링크는 출처이며 그 저장소의 명령을 자동 실행하는 지시가 아니다. DOCX 스킬은 추가하지 않았다. 원본 분석은 현재 추출기와 기존 문서 검증 절차를 사용한다. React용 Highcharts 스킬과 디자인 재생성 스킬도 포함하지 않는다.

## 실행 준비

1. 대상 Vue 프로젝트에서 기존 Vitest/Playwright 설정과 package.json을 확인한다. 이미 있으면 그 구조 안에 선택 범위 테스트를 추가한다. 기존 의존성을 임의 업그레이드하지 않는다.
2. Playwright가 없고 테스트 구현이 요청된 경우 대상 프로젝트 정책에 따라 `@playwright/test` 개발 의존성과 사용할 브라우저를 준비한다. 설치/서버/브라우저 실행을 수행하지 못하면 이유와 pending을 기록한다.
3. 플러그인의 `assets/browser-tests/` 또는 설치본 `.agents/skills/bok-report-publishing/assets/browser-tests/`(Claude는 `.claude`)에서 두 템플릿을 새 테스트 폴더에 복사한다. 예: `<repo>/tests/bok/`. 기존 파일을 덮어쓰지 않는다.
4. 대상 사이트를 열어 경로, 각주 트리거/팝업/닫기 선택자, 차트 루트와 준비 선택자를 확인한다. `report-cases.json`을 같은 폴더에 작성한다. 값은 실제 문서와 DOM에서 채운다.

```json
{
  "route": "/report.html",
  "readySelector": "#report-section",
  "notes": [{"id":"note-1","trigger":"#note-trigger-1","panel":"#note-panel","content":"#note-panel .content","close":"#note-panel button.close","text":"문서에서 확인한 각주 전문"}],
  "charts": [{"id":"figure-I-1","selector":"#chart-I-1","readySelector":".highcharts-series path","labels":[{"selector":".highcharts-axis-title","text":"(%)"}]}]
}
```

예시 선택자는 그대로 실행하지 않는다. notes/charts는 실제 선택 범위만 넣는다. 둘 다 빈 배열이면 실패한다. 차트 labels는 축 단위·X축 주요 눈금·범례 등 필요한 것을 여러 개 지정한다. 이 템플릿은 라벨 표시·각주 내용·페이지 넘침과 캡처를 검사하며, **Highcharts 원본 값, 모든 축·표·키보드 접근성까지 자동 보장하지 않는다.** 나머지는 해당 프로젝트 테스트를 추가한다.

```powershell
# 대상 프로젝트 루트, 개발 서버가 준비된 상태
$env:BOK_BASE_URL = 'http://127.0.0.1:5173'
npx playwright test --config tests/bok/playwright.config.mjs
```

기본은 기능 검사와 화면 증거 수집이다. 시각 회귀를 사용할 때만 `BOK_VISUAL_REGRESSION=1`로 설정한다. 승인된 기준 이미지가 없는 상태에서는 검토용 생성 실행을 명시적으로 수행하고 실제 이미지를 확인해야 한다. 기준을 자동 승인하지 않는다. OS·브라우저·폰트·데이터·locale·DPR을 고정하고, 기존 브레이크포인트 ±1px 프로젝트도 추가한다. 임의 허용 오차 확대로 실패를 숨기지 않는다.

생성된 테스트 리포트와 trace는 개발 증거로 관리한다. 해당 작업 OpenSpec의 evidence.md에서 결과를 연결하고 공개 보고서 산출물에 포함하지 않는다. CI에서는 브라우저 설치·서버 기동·재현 가능한 데이터·기준 이미지가 모두 준비된 뒤 동일 명령을 사용한다.
