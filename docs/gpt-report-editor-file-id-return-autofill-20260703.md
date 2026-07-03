# 에디터 복귀 링크 기반 업로드 파일 ID 자동 입력 보고서

작성일: 2026-07-03
작성: Claude (전개도 디자인 에디터 연동 작업과 함께 진행)

## 1. 작업 목적

전개도 디자인 에디터에서 업로드를 마친 고객이 업로드 파일 ID를 수동으로 복사/붙여넣기하는 단계를 줄이기 위해, **복귀 링크 방식(방안 C)** 자동 입력을 구현했습니다.

흐름:

1. 상품상세 snippet이 에디터 링크에 `return_url`(현재 상품 페이지 주소) 전달
2. 에디터가 업로드 완료 후 "주문 페이지로 돌아가기 (파일 ID 자동 입력)" 버튼 표시 — `return_url + &perpackage_file_id={file_id}`
3. 고객이 버튼 클릭 → 상품 페이지가 다시 열리며 위젯이 `perpackage_file_id` URL 파라미터를 읽어 Cafe24 "업로드 파일 ID" 입력칸에 자동 입력

`rel="noopener"` 정책은 그대로 유지했습니다(창 간 postMessage 방식은 채택하지 않음).

## 2. 수정 파일 목록

- `public/cafe24/product-upload-widget.js` (이 프로젝트)
- `docs/gpt-report-editor-file-id-return-autofill-20260703.md` (이 보고서)
- (에디터 프로젝트 쪽) `js/editor.js`, `index.html`, `product-detail-button-snippet.html` — 별도 프로젝트에서 수정

## 3. 위젯 변경 내용

`bindForm` 내부에 `applyEditorFileIdFromUrl()` 추가:

- 페이지 로드 시 `perpackage_file_id` URL 파라미터 확인
- 값 형식 검증: `/^[0-9a-zA-Z-]{8,64}$/` (UUID 계열만 허용, 임의 문자열 주입 방지)
- 기존 `findFileIdInput()` → `applyFileIdToCafe24Input()` 재사용으로 입력칸 탐색/입력
- 입력 성공 시 기존 업로드 흐름과 동일하게 readonly 처리 + 변경 감지(watch) + 주문 버튼 클릭 전 검사에 연결 (`currentUpload` 상태로 편입)
- 입력칸이 아직 없으면(상품 옵션 미선택) 1.5초 간격 최대 40회(약 60초) 재시도, 대기 안내 문구 표시
- 최종 실패 시 "직접 붙여넣기" 안내로 fallback
- 고객이 위젯에서 새 파일을 직접 업로드하면(`currentUpload` 생성) URL 파라미터 값은 더 이상 적용하지 않음 (새 업로드 우선)
- `perpackage_file_id` 파라미터가 없으면 아무 동작도 하지 않음 (기존 동작 완전 동일)

snippet 쪽 보완: 복귀 후 상품 페이지 URL에 남은 `perpackage_file_id`가 "전개도 편집하기" 버튼의 `return_url`로 다시 전파되지 않도록 제거 처리.

## 4. 검증 결과

로컬 브라우저 시뮬레이션(위젯 사본 + 가짜 Cafe24 입력칸):

- 파라미터 존재 + 입력칸 존재: 자동 입력 + readonly + 성공 문구 확인
- 파라미터 존재 + 입력칸이 1초 뒤 생성(옵션 늦게 선택 상황): 대기 문구 → 재시도 루프가 1.5초 내 자동 입력 확인
- 파라미터 없음: 입력칸/상태 문구 무변화 (기존 동작 회귀 없음)
- 에디터 쪽: `return_url`이 허용 origin(peerl.cafe24.com, www)일 때만 복귀 버튼 생성, `evil-example.com` 등은 차단되고 복사 버튼 fallback 유지
- `node --check public/cafe24/product-upload-widget.js` 통과

## 5. DB 변경 여부 / 추가 SQL

없음.

## 6. 변경하지 않은 기존 기능

- `/api/files/upload` 업로드 API, CORS 정책
- Cafe24 Webhook 자동 연결/`files.order_id` 정책/Admin API 주문 조회
- 위젯의 파일 1개 제한, file_id readonly/변경 감지, 주문 버튼 차단 로직 (재사용만 함)
- `/admin` 전체 기능

## 7. 보안 기준 유지 여부

- token/API key/signed URL 등 신규 노출 없음
- URL 파라미터 값은 형식 검증 후에만 입력칸에 반영
- 에디터 복귀 링크는 허용 origin 화이트리스트(peerl.cafe24.com, www) 검증
- `rel="noopener"` 정책 유지

## 8. Typecheck / Build

- `npm run typecheck` 통과
- `npm run build` 통과 (기존과 동일한 auth/start dynamic 안내만 출력)

## 9. 커밋 / Push / 배포

- 커밋: 진행 (해시는 커밋 후 기록)
- Push/Vercel Production 배포: **사용자 승인 대기** — 배포 전까지 운영 위젯에는 자동 입력이 없고 기존 동작 그대로임

## 10. 운영자 확인 순서 (배포 + 카페24 반영 후)

1. 상품상세 → 전개도 편집하기 → 에디터에서 디자인 → 저장 후 주문
2. "주문 페이지로 돌아가기 (파일 ID 자동 입력)" 버튼 클릭
3. 상품 페이지에서 "업로드 파일 ID" 입력칸에 값이 자동 입력되고 readonly인지 확인
4. 옵션을 아직 선택하지 않은 경우: 옵션 선택 후 자동 입력되는지 확인
5. 위젯에서 직접 파일 업로드하는 기존 흐름 회귀 확인
6. 주문 진행 → Webhook auto_linked 확인
