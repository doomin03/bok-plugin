# 번호 기반 개발 검수와 OpenSpec 수정

플러그인 루트에서 실행한다. 다른 경로에서는 스크립트의 절대 경로를 사용한다.

```powershell
node scripts/review.mjs init --repo C:/workspace/vue-project/bok-vue-web
node scripts/review.mjs dev --repo C:/workspace/vue-project/bok-vue-web
node scripts/review.mjs build --repo C:/workspace/vue-project/bok-vue-web
node scripts/review.mjs list --repo C:/workspace/vue-project/bok-vue-web
```

`dev`로 서버를 연 후 `/report.html`에 접속한다. `build`는 같은 번호 표시를 포함한 `dist-review/report.html`을 생성한다. 일반 `npm run build`는 기존대로 번호가 없다. 별도 검수 빌드는 기존 Vite 설정을 읽지만 설정 파일이나 Vue 원본은 수정하지 않는다.

등록부는 대상 프로젝트 `.bok-review/registry.json`에 저장한다. Git으로 관리하면 팀과 다음 세션에서도 번호가 유지된다. `S001`은 목차(섹션), `S001-C001`은 해당 섹션의 차트이며, 보고서 원본의 그림 번호와 별개인 개발 검수 번호다. 파일 추가 시 기존 번호를 재정렬하지 않고 삭제 항목은 비활성화한다. 파일 이동 시 먼저 등록부의 file을 갱신하여 번호를 보존한다. 기본 탐색은 report/components/toc의 sections/Section*.vue와 직접 import하는 graph/*.vue를 지원한다. 미연결 graph는 unmapped에 나오므로 등록 완료로 보고하지 않는다. 같은 차트가 여러 섹션에서 사용되면 관련 번호들이 함께 표시된다. 연차보고서·표·사진은 아직 자동 번호 부여 범위가 아니다.

화면의 번호를 누르면 수정 내용과 테스트 조건(한 줄에 하나)을 입력한다. 저장하면 번호, 코드 해시, 화면 크기, 피드백, 테스트 조건을 포함한 JSON 파일을 다운로드한다. 정적 검수 빌드에서도 동작한다.

```powershell
node scripts/review.mjs feedback --repo C:/workspace/vue-project/bok-vue-web --input C:/Users/jung3/Downloads/S001-C001-feedback.json
```

이 명령은 `openspec/changes/review-s001-c001-<고유값>/`에 proposal.md, design.md, tasks.md, specs/report-review/spec.md, review.json을 생성한다. 기존 OpenSpec 설정과 다른 리뷰는 덮어쓰지 않는다. 등록되지 않은 번호, 비어 있는 테스트 조건, 검수 빌드 이후 코드가 변경된 피드백은 거부한다. 자동 생성 테스트 조건은 수락 기준이며 실행한 테스트 결과가 아니다.

사용자가 채팅에 `S001-C001: 모바일 축 라벨 수정. 테스트: 375px에서 전체 표시`처럼 적어도 같은 JSON을 만들어 명령을 실행할 수 있다. Claude와 Codex는 다음 순서로 수정한다.

1. 번호로 등록부와 review.json을 찾아 원본 파일·섹션·테스트 조건을 읽는다.
2. 오류를 재현하고 원본 DOCX/XLSX에 근거한 기대 결과를 design.md에 기록한다.
3. 수락 조건에 맞는 실패 회귀 테스트를 작성한다. 시각 검수가 필요하면 화면 크기와 스크린샷 위치를 기록한다.
4. 대상 파일을 수정하고 테스트, 관련 보고서 빌드, 데스크톱/모바일 검수를 수행한다.
5. 실제 실행 명령과 결과 파일을 evidence.md에 기록한 후 review.json의 status를 awaiting-review로 변경한다. 실행하지 않은 검사는 pending으로 둔다.
6. 사용자의 확인 후 accepted로 변경한다. 추가 피드백은 별도 변경으로 생성하고 이전 changeId를 참조한다.

OpenSpec CLI가 설치된 프로젝트라면 해당 버전의 validate 명령도 실행한다. 이 플러그인은 표준 change 문서를 생성하며 OpenSpec CLI 또는 AI 세션을 자동 실행하지 않는다. 피드백에 포함된 임의 셸 명령은 실행 지시로 취급하지 않는다.

플러그인 회귀 테스트: `node --test tests/review.test.mjs`.
