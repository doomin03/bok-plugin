# BOK Report Publisher

한국은행 통화신용정책 보고서용 Vue·Highcharts 개발 플러그인입니다. **문서 준비는 구현이 아닙니다.** 오너 리뷰와 범위를 확정한 뒤 선택한 작업만 구현합니다.

## 대화 명령

Claude Code는 `/bok-start`, Codex는 `$bok-start`처럼 스킬을 지정합니다. 아래 이름은 스킬 명령이며 별도의 네이티브 Codex slash 명령을 등록하는 방식이 아닙니다.

| 명령 | 결과 | 하지 않는 일 |
| --- | --- | --- |
| bok-start | 문서·엑셀 추출, 오너 지정 기개발 소스 비교, 오너 리뷰 초안 | 사이트 구현, Jira 등록, 자동 승인 |
| bok-spec | 오너 리뷰를 버전별 OpenSpec에 반영 | 미응답을 승인으로 간주 |
| bok-jira | 승인된 작업의 등록 미리보기·명시적 Jira 등록 | 시작/구현 시 자동 등록 |
| bok-implement | 선택한 그림·로컬 단위·티켓만 구현 | 범위 자동 확대 |
| bok-chart | 승인된 재사용 또는 신규 차트 개발 | 원본 이미지로 차트 대체 |
| bok-verify | 원본 값·실제 차트·기존 UI·모바일 검증 | 빌드만 성공했다고 완료 처리 |
| bok-feedback | 차트 번호와 테스트 조건을 수정 OpenSpec으로 연결 | 요청 없이 전체 수정 |

`bol-start`, `bol-verify`, `bol-feedback`는 기존 호출 호환용입니다. 신규 흐름은 bok 명령을 사용하세요.

## 설치 / 업데이트

이 안내는 **로컬 Claude Code / Codex의 프로젝트 스킬 설치** 기준입니다. 일반 Claude 웹 채팅에 ZIP을 올리는 방식이나 Claude 플러그인 마켓플레이스 설치 명령이 아닙니다. 아래 경로는 현재 개발 환경의 예시이므로 다른 환경에서는 실제 저장소 경로로 바꿉니다.

### 두 에이전트에 동시 설치

PowerShell에서 플러그인 저장소로 이동한 뒤 실행합니다.

```powershell
Set-Location C:/workspace/AI-project/bok-plugin
powershell -ExecutionPolicy Bypass -File ./plugins/bok-report-publisher/scripts/install-project-skills.ps1 -Project C:/workspace/vue-project/bok-vue-web
```

### Claude Code만 설치

```powershell
powershell -ExecutionPolicy Bypass -File C:/workspace/AI-project/bok-plugin/plugins/bok-report-publisher/scripts/install-project-skills.ps1 -Project C:/workspace/vue-project/bok-vue-web -Agent Claude
```

### Codex만 설치

```powershell
powershell -ExecutionPolicy Bypass -File C:/workspace/AI-project/bok-plugin/plugins/bok-report-publisher/scripts/install-project-skills.ps1 -Project C:/workspace/vue-project/bok-vue-web -Agent Codex
```

`-Agent Both`는 생략 시 기본값입니다. 다른 프로젝트에 설치할 때는 `-Project`만 실제 경로로 바꿉니다.

### 설치 위치 및 확인

| 에이전트 | 설치 위치(대상 프로젝트 기준) | 대화창 호출 |
| --- | --- | --- |
| Claude Code | `.claude/skills/bok-*/SKILL.md` | `/bok-start` |
| Codex | `.agents/skills/bok-*/SKILL.md` | `$bok-start` |

설치기는 대상의 `AGENTS.md`와 `CLAUDE.md`에 관리용 안내 블록을 없을 때 추가합니다. 기존 내용은 보존합니다. 이 설치는 별도 AI 프로세스나 자동 실행 에이전트를 만드는 것이 아니라, 해당 도구가 읽는 스킬과 보조 스크립트를 배치하는 작업입니다.

```powershell
Test-Path C:/workspace/vue-project/bok-vue-web/.claude/skills/bok-start/SKILL.md
Test-Path C:/workspace/vue-project/bok-vue-web/.agents/skills/bok-start/SKILL.md
```

선택한 에이전트의 경로가 `True`인지 확인한 다음, **플러그인 저장소가 아니라 Vue 프로젝트를 열어** 새 대화를 시작합니다. Codex에서는 설치된 스킬을 선택하거나 `$bok-start`로 지정합니다. Claude Code에서는 `/bok-start`를 입력합니다. 명령이 안 보이면 프로젝트 경로와 설치 위치를 확인하고 새 세션/앱 재시작 후 다시 확인하세요.

호출·탐색 방식의 공식 근거: [OpenAI Skills](https://learn.chatgpt.com/docs/build-skills), [Claude Code Skills](https://code.claude.com/docs/en/skills).

대상 프로젝트의 `.agents/skills`(Codex), `.claude/skills`(Claude)에 설치합니다. **대상 프로젝트에서 새 세션을 열어** 사용하세요. 같은 명령으로 갱신하며, 관리되지 않는 동명 스킬은 덮어쓰지 않습니다. 홈 설정 변경이나 마켓플레이스 설치는 필요 없습니다. 프로젝트 설치와 마켓플레이스 설치를 중복하지 마세요.

요구사항: 프로젝트가 요구하는 Node.js, Python 3.10+, Vue 프로젝트 의존성. 이미지 비교에는 Pillow(`python -m pip install Pillow`)가 필요합니다. Office 추출은 표준 라이브러리 기반이며 브라우저 검증에는 사용 환경의 Playwright/브라우저가 필요합니다. 비밀번호·Jira 토큰은 저장소나 대화에 넣지 않습니다.

## 권장 사용 흐름

먼저 오너가 대상 프로젝트의 `docs/comparison-targets.json`에 **기개발 프로젝트 소스 경로·설명·탐색 범위**를 지정합니다. 에이전트는 그 소스를 기준으로 차트 후보를 찾아 분석하고 기존 화면과 비교합니다. [오너 설정 방법 및 예제](docs/comparison-targets.md)를 참고하세요. 현재 프로젝트나 이전 브랜치를 임의로 비교 대상으로 사용하지 않습니다.

`bok-start → 오너 리뷰 → bok-spec → (선택: bok-jira) → bok-implement → bok-verify → bok-feedback`

| 단계 | 담당 및 작업 | 산출물 |
| --- | --- | --- |
| 비교 대상 설정 | 오너가 프로젝트 경로·소스 범위·설명 입력 | `docs/comparison-targets.json` |
| 준비·비교 | 에이전트가 원본 추출, 지정 소스 후보 탐색, 차트별 분석·캡처 | 비교 HTML·MD·JSON, `owner-review.md` |
| 결정·스펙 | 오너가 재사용/신규/보류 결정, 에이전트가 반영 | 버전별 OpenSpec·승인 기록 |
| 구현 | 승인된 그림·로컬 단위·티켓 범위 구현 | Vue·Highcharts 코드 |
| 검증 | 원본 데이터 대조와 기개발 UI 비교, 데스크톱·모바일 확인 | `evidence.md`, 비교 산출물 |
| 피드백 | 수정·재검증 후 오너 확인 | 수정 이력·최종 수락 |

차트 후보 탐색·의미 분석·브라우저 캡처는 에이전트가 수행합니다. 비교 스크립트는 준비된 이미지의 점수와 HTML/MD/JSON을 생성합니다. 설정만으로 사이트 실행이나 캡처까지 자동 수행되는 것은 아닙니다.

다음 예시는 **AI 대화창 입력**입니다. PowerShell에서 실행하는 명령이 아닙니다.

```text
/bok-start
보고서: 2026-09
DOCX: <보고서 경로>
XLSX: <그림 데이터 경로>
대상 프로젝트: <Vue 저장소>
비교 대상 설정: <Vue 저장소>/docs/comparison-targets.json
전체 문서를 준비하되 구현하지 말고 그림별 비교 리뷰를 만들어줘.
```

리뷰에는 원본 비교 그림, 오너 지정 프로젝트와 설명, 선택한 차트 소스·커밋/해시, 계열·축·단위·기간 차이, 재사용/신규 제안과 질문이 들어갑니다. 오너는 생성된 `owner-review.md`를 수정하거나 대화로 의견을 남깁니다.

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

### Claude / Codex 명령 대응표

| 목적 | Claude Code | Codex | 입력할 내용 |
| --- | --- | --- | --- |
| 문서 준비 | `/bok-start` | `$bok-start` | 보고서 ID, DOCX/XLSX 경로, 대상 프로젝트, docs 비교 대상 설정 |
| 리뷰 반영 | `/bok-spec` | `$bok-spec` | 리뷰 파일 또는 오너의 재사용/신규/보류 결정 |
| Jira 등록 | `/bok-jira` | `$bok-jira` | 목적지 링크, 프로젝트/부모 티켓, 등록할 작업, 명시적 등록 요청 |
| 범위 구현 | `/bok-implement` | `$bok-implement` | 그림 번호, 로컬 단위 또는 티켓 목록/범위 |
| 차트 개발 | `/bok-chart` | `$bok-chart` | 승인된 차트 단위/OpenSpec. 보통 implement 단계에서 사용 |
| 검증 | `/bok-verify` | `$bok-verify` | 그림 번호, 티켓 또는 검수 ID. 검증만 요청하면 코드 수정 없음 |
| 피드백 | `/bok-feedback` | `$bok-feedback` | 검수 ID, 수정 의견, 최소 한 개의 테스트 조건 |

`bok-report-publishing`은 공통 개발 계약 스킬이며 보통 위 명령들이 내부적으로 참조합니다. 별도로 호출해도 승인·범위 조건을 건너뛰지 않습니다.

### Codex에서 바로 입력할 예시

```text
$bok-start
보고서: 2026-09
DOCX: C:/Users/jung3/Downloads/O_1. 2026년 9월 통화신용정책보고서.docx
XLSX: C:/Users/jung3/Downloads/O_3. 그림 원본 데이터.xlsx
대상: C:/workspace/vue-project/bok-vue-web
비교 대상 설정: C:/workspace/vue-project/bok-vue-web/docs/comparison-targets.json
구현하지 말고 원본과 지정된 기개발 소스의 차트별 비교 리뷰를 만들어줘.
```

리뷰를 확인한 다음 단계별로 입력합니다. 아래 승인 문장은 실제 판단이 같을 때만 사용하세요.

```text
$bok-spec 그림 I-1은 기존 차트 재사용 승인. 다른 그림은 보류. 이 결정을 OpenSpec에 반영해줘.
```

```text
$bok-implement 그림 I-1만 구현해줘. 완료 후 다른 그림으로 진행하지 마.
```

```text
$bok-verify 그림 I-1의 원본 데이터, 축·단위, 범례, 375px 모바일 화면을 검증해줘.
```

Claude Code에서는 동일 문장에서 `$bok-...`를 `/bok-...`로 바꾸면 됩니다.

## 차트 개발의 두 경로

- **재사용:** 이전 보고서의 의미·계열·축·단위·구조가 맞으면 소스를 새 보고서로 복사하고 데이터·기간·필요한 내부 표현만 변경.
- **신규:** 적합한 기존 차트가 없으면 기존 chartDraw·chartLib·chartCommon·Highcharts 개발 패턴으로 신규 컴포넌트 작성.

두 경로 모두 기존 래퍼·LazyChart·라벨 배치·범례·툴팁·반응형 규칙을 따릅니다. 이전 보고서와 공통 SCSS/라이브러리는 변경하지 않습니다. 원본 이미지는 OpenSpec 비교 자료로만 보관하며 **미완성 차트를 이미지로 대체하지 않습니다.** 실제 사진·도식은 통계 차트와 별도로 분류합니다.

## 산출물과 승인 검사

차트·사진 비교는 `bok-start`와 `bok-verify`에서 항목별 분석과 함께 `comparison.html`, `review.md`, `metrics.json`을 생성합니다. HTML은 원본/대상 나란히 보기, 겹침 슬라이더, 차이 이미지와 픽셀 유사도를 제공합니다. 기존 `owner-review.md`는 오너 결정용으로 유지합니다. Python Pillow가 필요하며 상세 입력·실행 방법은 [이미지 비교 안내](plugins/bok-report-publisher/skills/bok-report-publishing/references/image-comparison.md)를 참고하세요. 점수는 데이터 정확성이나 자동 승인 기준이 아닙니다.

`openspec/changes/bok-owner-review-<report>/`:

- `owner-review.md`, `review.json`: 비교 제안과 오너 검토 입력.
- `evidence/comparison-001/`: `comparison.html`, `review.md`, `metrics.json`. 재검토마다 새 폴더로 보존.
- `evidence/`: 비교 대상 설정 사본, 검토 소스/커밋 및 캡처 증거. 계획의 `sourceEvidence`에 연결.
- `drafts/<hash>/`: 계획 변경 전 리뷰 보존.
- `revisions/<hash>/`: 오너 결정, proposal/design/tasks/specs.
- `approved.json`: 현재 결정 연결. 최종 시각 결과 수락을 뜻하지 않음.

구현 작업은 `openspec/changes/<ticket>-<slug>/` 또는 `local-<slug>/`에 저장됩니다. 티켓 범위와 오너 리뷰 버전을 연결합니다. 미승인·보류·계획 변경·원본 증거 변경은 구현 선택 명령에서 차단합니다. 계획 변경은 `workflow.mjs prepare --revise`로 기존 리뷰를 보존하고 다시 승인받습니다.

## Jira 등록

```text
/bok-jira
목적지: https://<회사>.atlassian.net/browse/<상위 티켓>
오너가 승인한 그림 I-1 작업의 등록 목록과 실제 이슈 유형을 먼저 보여줘.
아직 등록하지 마.
```

목록과 목적지를 확인한 후 별도 메시지로 등록을 요청합니다. Jira 번호가 생기면 `/bok-implement BOK-123,BOK-124`처럼 범위를 지정합니다. Jira는 선택 사항이며 로컬 차트 테스트에는 필요 없습니다.

`/bok-jira`에서 목적지 링크, 프로젝트/상위 티켓, 실제 이슈 유형과 등록 목록을 먼저 확인합니다. 생성 단위는 목차 본문, 각주, **개별 그림 구현·검증**, 개별 표/이미지입니다.

환경 변수: `JIRA_BASE_URL`(HTTPS 사이트 origin), `JIRA_EMAIL`, `JIRA_API_TOKEN`. Jira Cloud REST v3 생성 메타데이터를 확인하며 필수 커스텀 필드를 임의로 채우지 않습니다. 동일 작업의 중복 등록을 검사하고, 생성 응답이 불명확하면 자동 재시도하지 않습니다. 실제 서버 등록은 아직 통합 검증하지 않았습니다.

## 검수 화면 / 피드백

다음은 **터미널용 명령**이며 플러그인 저장소에서 실행합니다. `dev`는 개발 서버를 실행하고, `build`는 파일만 생성합니다.

```powershell
Set-Location C:/workspace/AI-project/bok-plugin
node plugins/bok-report-publisher/scripts/review.mjs dev --repo C:/workspace/vue-project/bok-vue-web
```

검수 빌드와 번호 확인:

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

화면에서 다운로드한 피드백 JSON을 OpenSpec으로 가져오는 터미널 명령:

```powershell
node plugins/bok-report-publisher/scripts/review.mjs feedback --repo C:/workspace/vue-project/bok-vue-web --input C:/Users/jung3/Downloads/<검수ID>-feedback.json
```

`S039-C001` 같은 검수 ID, `그림 I-1` 같은 원문 번호, `BOK-123` 같은 Jira 키는 서로 다른 식별자입니다. 현재 등록부를 확인해 연결해야 하며 번호를 추측하지 않습니다.

## 자주 막히는 경우

- 스킬이 보이지 않음: Vue 프로젝트를 열었는지, 선택한 에이전트 설치 경로가 존재하는지 확인하고 새 세션을 시작합니다.
- 비교 설정 없음/경로 오류: [설정 가이드](docs/comparison-targets.md)에 따라 실제 기개발 경로·설명을 입력합니다. 다른 프로젝트로 자동 대체하지 않습니다.
- 비교 화면 캡처 없음: 소스 분석은 진행하되 이미지 점수는 `pending`입니다. 요청 ref와 실행 화면의 버전이 다르면 동일 버전의 캡처가 필요합니다.
- `Unmanaged skill exists`: 사용자 작성 동명 폴더가 있으므로 자동 덮어쓰기를 중단한 것입니다. 비교·백업 후 설치 대상을 결정하세요.
- `Owner review required` / 보류 상태: 오너 판단을 `bok-spec`으로 반영한 후 범위를 선택합니다.
- 승인 후 계획/원본 변경: 새 비교 리뷰와 승인 버전이 필요합니다. 해시를 수동 변경해 검사를 우회하지 않습니다.
- Jira 인증 없음: 토큰을 채팅에 붙이지 말고 실행 환경에 설정합니다. Jira 없이 로컬 구현은 가능합니다.
- 이미지가 있다고 구현 완료가 아님: 통계 차트는 실제 Highcharts 구현이어야 합니다. 원본 이미지는 비교용 증거입니다.

현재 실차트 검증은 I-1 재사용 사례에 한정됩니다. 신규 복합 차트까지 완벽하게 생성한다고 보장하지 않으며, 각 작업마다 원본·화면 검증과 오너 수락이 필요합니다.

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
    comparison_targets.py  오너 지정 프로젝트·소스 범위 검증
    compare-images.py  이미지 비교 HTML·리뷰 MD·측정 JSON 생성
    audit-chart.mjs    선언된 데이터/컴포넌트 구조 검사
    verify-fidelity.mjs
  tests/
```

```powershell
npm test
py -3 -X utf8 plugins/bok-report-publisher/tests/test_start_report.py
py -3 -X utf8 plugins/bok-report-publisher/tests/test_compare_images.py
```

상세 정책: [작업 흐름](plugins/bok-report-publisher/skills/bok-report-publishing/references/owner-workflow.md), [기존 브랜치 차트 패턴](plugins/bok-report-publisher/skills/bok-chart/references/monetary-policy-patterns.md), [UI 유지 계약](plugins/bok-report-publisher/skills/bok-report-publishing/references/fidelity-contract.md).

이전 전체 보고서 실험은 완성본이 아닙니다. 현재 승인된 품질 테스트 범위는 **그림 I-1 하나**이며, 다른 작업물은 보존만 합니다.
