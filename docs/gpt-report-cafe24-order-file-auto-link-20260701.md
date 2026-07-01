# Cafe24 주문 조회 기반 파일 자동 연결 기능 보고서

작성일: 2026-07-01

## 1. 작업 목적

Cafe24 Admin API 주문 조회 테스트에서 발견한 업로드 파일 ID를 Supabase `files.id`와 매칭하고, 관리자가 확인 후 버튼을 눌러 `files.order_id`에 Cafe24 주문번호를 연결할 수 있게 했다.

이번 작업은 완전 자동 Webhook 연결이 아니라 `/admin`에서 주문번호를 조회한 뒤 관리자가 직접 승인하는 반자동 연결 기능이다.

## 2. 수정한 파일

- `src/app/admin/actions.ts`
- `src/app/admin/page.tsx`

## 3. 추가한 자동 연결 액션

추가한 서버 액션:

- `linkCafe24LookupFileOrderIdAction`

동작:

- 관리자 인증 확인
- `file_id`, `order_id` 확인
- Supabase `files.id` 기준 파일 조회
- 기존 연결 상태 확인
- 안전 조건을 통과한 경우 기존 `updateFileOrderId`를 재사용해 `files.order_id`와 `updated_at` 갱신
- 처리 후 `/admin?cafe24_order_id=...&cafe24_link=...` 형태로 redirect

## 4. 재사용한 기존 함수

- `getFileById`
- `updateFileOrderId`

기존 수동 주문번호 연결 로직과 같은 업데이트 함수를 사용해서 DB 업데이트 방식이 분산되지 않게 했다.

## 5. 추가한 관리자 UI

`/admin`의 “Cafe24 주문 조회 테스트” 결과 영역에 아래 섹션을 추가했다.

- `Supabase files 매칭 결과`

표시 항목:

- `file_id`
- Supabase files 매칭 여부
- `original_filename`
- 현재 연결된 주문번호
- `status`
- `created_at`

자동 연결이 가능한 경우 버튼 표시:

- `이 주문번호로 파일 자동 연결`

## 6. 안전 처리 방식

아래 기준으로 자동 연결 버튼 표시 여부를 구분했다.

| 상태 | 처리 |
| --- | --- |
| Supabase `files`에 file_id가 있고 `order_id`가 비어 있음 | 자동 연결 버튼 표시 |
| Supabase `files`에 file_id가 있고 `order_id`가 현재 Cafe24 주문번호와 같음 | 이미 연결됨 안내 |
| Supabase `files`에 file_id가 있지만 다른 주문번호가 있음 | 덮어쓰기 금지, 수동 확인 안내 |
| Supabase `files`에 file_id가 없음 | 찾지 못함 안내, 버튼 미표시 |

여러 업로드 파일 ID가 발견되면 각 file_id마다 독립적으로 매칭 결과와 연결 가능 여부를 표시한다.

## 7. 보안 기준

화면, API 응답, 로그에 아래 값이 노출되지 않도록 유지했다.

- Cafe24 access token
- Cafe24 refresh token
- Cafe24 client secret
- authorization header
- Supabase service role key
- Naver Object Storage key
- signed URL 원문

자동 연결은 관리자 인증이 된 `/admin` 서버 액션으로만 실행된다.

## 8. 검증 결과

실행한 명령:

```bash
npm run typecheck
npm run build
```

결과:

- `npm run typecheck`: 통과
- `npm run build`: 통과

빌드 결과에서 `/admin`은 동적 서버 렌더링 경로로 유지됐다.

## 9. 운영 테스트 방법

1. `/admin` 로그인
2. “Cafe24 주문 조회 테스트”에서 `20260701-0000017` 입력
3. Cafe24 주문 조회 실행
4. 업로드 파일 ID `cdd3e86c-a93c-47f1-b118-778cff7d57bf` 표시 확인
5. `Supabase files 매칭 결과` 확인
6. 현재 `order_id`가 미연결이면 `이 주문번호로 파일 자동 연결` 클릭
7. Supabase `files.order_id`가 `20260701-0000017`로 갱신되는지 확인
8. `/admin` 주문번호 검색에서 `20260701-0000017`로 파일이 검색되는지 확인
9. 다시 Cafe24 주문 조회 시 “이미 이 주문번호에 연결되어 있습니다.”가 표시되는지 확인

## 10. 기존 기능 유지 여부

아래 기존 기능은 변경하지 않았다.

- `/admin` 로그인
- Cafe24 주문 조회 테스트
- file_id 검색
- 주문번호 검색
- 주문번호 수동 연결
- 파일 다운로드
- 다운로드 로그 저장
- 전체 다운로드 로그/필터/CSV
- 상태 변경
- 상태 변경 이력
- 최근 업로드 파일 목록/필터
- 고객용 `product-upload-widget.js`

## 11. 커밋/푸시/배포 여부

현재 상태:

- 코드 구현 완료
- 문서 작성 완료
- 커밋 전
- GitHub push 전
- Vercel Production 배포 전

운영 반영 시 권장 커밋 메시지:

```txt
feat: add cafe24 order file auto link
```

커밋 대상 후보:

- `src/app/admin/actions.ts`
- `src/app/admin/page.tsx`
- `docs/gpt-report-cafe24-order-file-auto-link-20260701.md`

주의:

- 현재 작업공간에는 이번 작업과 무관한 기존 변경 파일과 미추적 문서가 남아 있으므로, 커밋 시 위 파일만 선별해서 포함해야 한다.
