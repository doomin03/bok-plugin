# 오너가 지정하는 기개발 프로젝트 비교

비교 대상은 오너가 지정한 **기개발 프로젝트 소스**입니다. 원본 보고서 그림과 해당 소스가 실제로 렌더링한 차트를 비교합니다. 소스 구조·데이터·계열·축·단위·기간 분석과 이미지 비교를 함께 수행합니다.

대상 Vue 프로젝트의 `<repo>/docs/comparison-targets.json`에 [예제](comparison-targets.example.json)를 복사하고 실제 경로와 설명으로 수정하세요. 보고서마다 대상이 다르면 `<repo>/docs/<report>/comparison-targets.json`을 사용합니다. 보고서별 파일이 있으면 공통 파일보다 우선합니다. 명시적으로 지정한 설정 파일은 가장 우선합니다. 예제 경로는 자동 선택되지 않습니다.

오너 입력 항목:

| 항목 | 의미 |
| --- | --- |
| `id` | 비교 대상 식별자. 여러 프로젝트 등록 가능 |
| `projectPath` | 기개발 프로젝트 경로. 절대 경로 또는 설정 JSON 기준 상대 경로 |
| `description` | 어떤 기존 화면/차트인지, 무엇을 참고해야 하는지 설명 |
| `sourcePaths` | 비교할 기존 소스 파일 또는 폴더 목록. 프로젝트 기준 상대 경로 |
| `ref` | 선택: 비교할 Git 브랜치·태그·커밋. 생략하면 현재 소스 상태를 검토 |
| `previewUrl` | 선택: 해당 프로젝트 화면 확인 주소 |

오너는 위 경로와 설명만 지정하면 됩니다. 개별 차트 매핑, 캡처, 유사성 분석은 에이전트가 수행합니다. `previewUrl`만으로 스크린샷이 자동 생성되지는 않습니다. 에이전트가 실제 브라우저에서 해당 소스의 화면을 확인하고 캡처합니다. 화면 실행이 불가능하면 소스 분석은 계속하고 이미지 비교는 `pending`으로 남깁니다.

에이전트는 설정된 범위에서 후보를 탐색하고 정확한 컴포넌트·데이터 파일, Git 커밋과 작업 트리 변경 여부를 기록합니다. 설정되지 않은 프로젝트를 임의로 후보에 넣지 않습니다. `ref`를 지정하면 해당 ref의 소스를 읽고 캡처도 그 버전인지 확인합니다. 기존 프로젝트를 수정하거나 브랜치를 전환하지 않습니다.

비교용 입력 JSON의 각 항목에 `targetId`(위 id), `targetSource`(찾은 소스의 프로젝트 기준 상대 경로)를 기록하고 다음 명령으로 생성합니다:

```powershell
python <plugin>/scripts/compare-images.py --targets <repo>/docs/comparison-targets.json --input <change>/evidence/comparison-input.json --out <change>/evidence/comparison-001
```

설정 누락·경로 오류는 임의 대상 비교로 대체하지 않고 구체적으로 보고합니다. 설정 사본과 실제 확인한 소스·커밋·캡처 조건은 OpenSpec evidence에 보관하고 `unit-plan.json`의 `sourceEvidence`에 연결합니다. 대상이나 소스가 바뀌면 기존 리뷰를 보존하고 재비교합니다. 자세한 산출물은 [이미지 비교 지침](../plugins/bok-report-publisher/skills/bok-report-publishing/references/image-comparison.md)을 참고하세요.
