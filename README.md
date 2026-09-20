# BOK Report Publisher

한국은행 통화신용정책 보고서용 Vue·Highcharts 개발 플러그인입니다. **문서 준비는 구현이 아닙니다.** 오너 리뷰와 범위를 확정한 뒤 선택한 작업만 구현합니다.

## 대화 명령

Claude Code는 `/bok-start`, Codex는 `$bok-start`처럼 스킬을 지정합니다. 아래 이름은 스킬 명령이며 별도의 네이티브 Codex slash 명령을 등록하는 방식이 아닙니다.

| 명령 | 결과 | 하지 않는 일 |
| --- | --- | --- |
| bok-start | 문서·엑셀 추출, 이전 보고서 비교, 오너 리뷰 초안 | 사이트 구현, Jira 등록, 자동 승인 |
| bok-spec | 오너 리뷰를 버전별 OpenSpec에 반영 | 미응답을 승인으로 간주 |
| bok-jira | 승인된 작업의 등록 미리보기·명시적 Jira 등록 | 시작/구현 시 자동 등록 |
| bok-implement | 선택한 그림·로컬 단위·티켓만 구현 | 범위 자동 확대 |
| bok-chart | 승인된 재사용 또는 신규 차트 개발 | 원본 이미지로 차트 대체 |
| bok-verify | 원본 값·실제 차트·기존 UI·모바일 검증 | 빌드만 성공했다고 완료 처리 |
| bok-feedback | 차트 번호와 테스트 조건을 수정 OpenSpec으로 연결 | 요청 없이 전체 수정 |

`bol-start`, `bol-verify`, `bol-feedback`는 기존 호출 호환용입니다. 신규 흐름은 bok 명령을 사용하세요.

## 설치 / 업데이트

이 저장소를 받은 뒤 PowerShell에서 실행합니다.

```powershell
powershell -ExecutionPolicy Bypass -File ./plugins/bok-report-publisher/scripts/install-project-skills.ps1 -Project C:/workspace/vue-project/bok-vue-web
```

대상 프로젝트의 `.agents/skills`(Codex), `.claude/skills`(Claude)에 설치합니다. **대상 프로젝트에서 새 세션을 열어** 사용하세요. 같은 명령으로 갱신하며, 관리되지 않는 동명 스킬은 덮어쓰지 않습니다. 홈 설정 변경이나 마켓플레이스 설치는 필요 없습니다. 프로젝트 설치와 마켓플레이스 설치를 중복하지 마세요.

요구사항: 프로젝트가 요구하는 Node.js, Python 3.10+, Vue 프로젝트 의존성. Office 추출은 표준 라이브러리 기반이며 브라우저 검증에는 사용 환경의 Playwright/브라우저가 필요합니다. 비밀번호·Jira 토큰은 저장소나 대화에 넣지 않습니다.

## 권장 사용 흐름

```text
/bok-start
보고서: 2026-09
DOCX: <보고서 경로>
XLSX: <그림 데이터 경로>
대상 프로젝트: <Vue 저장소>
이전 보고서 브랜치: feature
전체 문서를 준비하되 구현하지 말고 그림별 비교 리뷰를 만들어줘.
```

리뷰에는 원본 비교 그림, 이전 분기 브랜치/커밋/차트 소스, 계열·축·단위·기간 차이, 재사용/신규 제안과 질문이 들어갑니다. 오너는 생성된 `owner-review.md`를 수정하거나 대화로 의견을 남깁니다.

```text
/bok-spec
그림 I-1은 제안한 기존 차트를 재사용 승인.
그림 I-2는 계열 구성이 다르므로 신규 생성.
그림 I-3은 단위를 확인할 때까지 보류.
이 리뷰를 OpenSpec에 반영해줘.
```

```text
/bok-implement 그림 I-1
/bok-implement BOK-123,BOK-124
/bok-implement BOK-104~BOK-123
```

Codex에서는 각 첫 명령의 `/`를 `$`로 바꿉니다. 역순 범위는 정규화 목록 확인 후 진행하며, 범위 안의 무관한 티켓은 제외합니다. Jira 없는 테스트도 로컬 단위로 가능하고 가짜 티켓은 만들지 않습니다.

## 차트 개발의 두 경로

- **재사용:** 이전 보고서의 의미·계열·축·단위·구조가 맞으면 소스를 새 보고서로 복사하고 데이터·기간·필요한 내부 표현만 변경.
- **신규:** 적합한 기존 차트가 없으면 기존 chartDraw·chartLib·chartCommon·Highcharts 개발 패턴으로 신규 컴포넌트 작성.

두 경로 모두 기존 래퍼·LazyChart·라벨 배치·범례·툴팁·반응형 규칙을 따릅니다. 이전 보고서와 공통 SCSS/라이브러리는 변경하지 않습니다. 원본 이미지는 OpenSpec 비교 자료로만 보관하며 **미완성 차트를 이미지로 대체하지 않습니다.** 실제 사진·도식은 통계 차트와 별도로 분류합니다.

## 산출물과 승인 검사

`openspec/changes/bok-owner-review-<report>/`:

- `owner-review.md`, `review.json`: 비교 제안과 오너 검토 입력.
- `drafts/<hash>/`: 계획 변경 전 리뷰 보존.
- `revisions/<hash>/`: 오너 결정, proposal/design/tasks/specs.
- `approved.json`: 현재 결정 연결. 최종 시각 결과 수락을 뜻하지 않음.

구현 작업은 `openspec/changes/<ticket>-<slug>/` 또는 `local-<slug>/`에 저장됩니다. 티켓 범위와 오너 리뷰 버전을 연결합니다. 미승인·보류·계획 변경·원본 증거 변경은 구현 선택 명령에서 차단합니다. 계획 변경은 `workflow.mjs prepare --revise`로 기존 리뷰를 보존하고 다시 승인받습니다.

## Jira 등록

`/bok-jira`에서 목적지 링크, 프로젝트/상위 티켓, 실제 이슈 유형과 등록 목록을 먼저 확인합니다. 생성 단위는 목차 본문, 각주, **개별 그림 구현·검증**, 개별 표/이미지입니다.

환경 변수: `JIRA_BASE_URL`(HTTPS 사이트 origin), `JIRA_EMAIL`, `JIRA_API_TOKEN`. Jira Cloud REST v3 생성 메타데이터를 확인하며 필수 커스텀 필드를 임의로 채우지 않습니다. 동일 작업의 중복 등록을 검사하고, 생성 응답이 불명확하면 자동 재시도하지 않습니다. 실제 서버 등록은 아직 통합 검증하지 않았습니다.

## 검수 화면 / 피드백

```powershell
node plugins/bok-report-publisher/scripts/review.mjs build --repo C:/workspace/vue-project/bok-vue-web
node plugins/bok-report-publisher/scripts/review.mjs list --repo C:/workspace/vue-project/bok-vue-web
```

검수 빌드는 `dist-review`에 생성됩니다. 화면의 섹션·차트 ID는 원문 그림 번호와 별개이며 `.bok-review/registry.json`으로 유지됩니다. 일반 생산 빌드에는 검수 버튼이 없습니다.

```text
/bok-feedback <화면의 차트 ID>
피드백: 모바일 우측 축 라벨 확인
테스트: 375px에서 단위·눈금이 잘리지 않고 기존 범례 위치 유지
```

검증은 원본 셀 대조, 실제 렌더링 값·축 검사, 데스크톱/모바일 비교, 공통 파일 무변경을 분리합니다. 오너의 결과 수락 전에는 awaiting-review입니다.

## 구조 / 테스트

```text
plugins/bok-report-publisher/
  .codex-plugin/plugin.json
  skills/
    bok-start/ bok-spec/ bok-jira/ bok-implement/
    bok-chart/ bok-verify/ bok-feedback/
    bok-report-publishing/references/
  scripts/
    start-report.py    원본 추출
    workflow.mjs       리뷰·스펙 버전·구현 승인 검사
    tickets.mjs        Jira와 범위 선택
    review.mjs         개발 번호·피드백
    audit-chart.mjs    선언된 데이터/컴포넌트 구조 검사
    verify-fidelity.mjs
  tests/
```

```powershell
npm test
py -3 -X utf8 plugins/bok-report-publisher/tests/test_start_report.py
```

상세 정책: [작업 흐름](plugins/bok-report-publisher/skills/bok-report-publishing/references/owner-workflow.md), [기존 브랜치 차트 패턴](plugins/bok-report-publisher/skills/bok-chart/references/monetary-policy-patterns.md), [UI 유지 계약](plugins/bok-report-publisher/skills/bok-report-publishing/references/fidelity-contract.md).

이전 전체 보고서 실험은 완성본이 아닙니다. 현재 승인된 품질 테스트 범위는 **그림 I-1 하나**이며, 다른 작업물은 보존만 합니다.
