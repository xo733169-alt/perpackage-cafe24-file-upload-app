# 교정확인 이력 저장 Phase 2-1 작업 보고서

## 1. 작업 목적

`/admin?file_id=<file_id>` 파일 상세 화면에서 교정확인 요청과 고객 회신 상태를 내부 이력으로 저장할 수 있도록 Phase 2-1 기능을 구현했다.

이번 작업은 고객용 링크, 자동 발송, 고객 직접 입력 화면이 아니라 관리자가 수동으로 기록하는 내부 이력 기능이다.

## 2. 수정한 파일 목록

- `src/lib/files/proof-confirmation-service.ts`
- `src/app/admin/actions.ts`
- `src/app/admin/page.tsx`
- `src/components/ProofConfirmationMessagePanel.tsx`
- `supabase/schema.sql`
- `docs/gpt-report-proof-confirmation-log-phase2-1-20260702.md`

## 3. 추가할 DB 테이블/컬럼/인덱스

추가 테이블:

- `public.file_proof_confirmations`

주요 컬럼:

- `id`
- `file_id`
- `order_id`
- `proof_status`
- `request_message`
- `selected_items`
- `extra_memo`
- `customer_response`
- `reject_reason`
- `requested_by`
- `requested_at`
- `confirmed_by`
- `confirmed_at`
- `response_channel`
- `created_at`
- `updated_at`

인덱스:

- `file_proof_confirmations_file_id_idx`
- `file_proof_confirmations_order_id_idx`
- `file_proof_confirmations_status_idx`
- `file_proof_confirmations_created_at_idx`

## 4. Supabase SQL Editor에서 실행할 SQL

아래 SQL은 아직 운영 DB에 자동 실행하지 않았다. 사용자가 Supabase SQL Editor에서 직접 실행한 뒤 Production 배포를 진행해야 한다.

```sql
create table if not exists public.file_proof_confirmations (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  order_id text,
  proof_status text not null,
  request_message text,
  selected_items jsonb,
  extra_memo text,
  customer_response text,
  reject_reason text,
  requested_by text,
  requested_at timestamptz,
  confirmed_by text,
  confirmed_at timestamptz,
  response_channel text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint file_proof_confirmations_status_check
    check (proof_status in ('requested', 'confirmed', 'rejected', 'canceled', 'skipped'))
);

create index if not exists file_proof_confirmations_file_id_idx
on public.file_proof_confirmations (file_id);

create index if not exists file_proof_confirmations_order_id_idx
on public.file_proof_confirmations (order_id);

create index if not exists file_proof_confirmations_status_idx
on public.file_proof_confirmations (proof_status);

create index if not exists file_proof_confirmations_created_at_idx
on public.file_proof_confirmations (created_at desc);
```

## 5. 주요 변경 내용

### 서비스 함수

`src/lib/files/proof-confirmation-service.ts`를 추가했다.

추가 함수:

- `createProofConfirmationRequest`
  - 교정확인 요청 이력 저장
  - `proof_status = requested`
  - 안내문, 선택 항목, 추가 메모 저장
- `listProofConfirmationsByFileId`
  - `file_id` 기준 최근 교정확인 이력 조회
  - `created_at desc` 정렬
- `updateProofConfirmationStatus`
  - requested 이력을 `confirmed`, `rejected`, `canceled`로 변경
  - 고객 회신, 수정 요청 사유, 회신 채널 저장
- `getProofStatusLabel`
  - 상태값을 한글 라벨로 변환

### Server Action

`src/app/admin/actions.ts`에 아래 액션을 추가했다.

- `createProofConfirmationRequestAction`
- `updateProofConfirmationStatusAction`

두 액션 모두 관리자 인증을 확인한다.

## 6. /admin UI 변경 내용

### 교정확인 안내문 영역

기존 기능 유지:

- 프리셋 선택/해제
- 여러 항목 동시 선택
- 추가 확인 메모 입력
- 안내문 복사

추가 기능:

- `교정확인 요청 저장` 버튼 추가
- 생성된 안내문, 선택 항목, 추가 메모를 `file_proof_confirmations`에 저장
- 안내문 복사와 요청 저장은 별개 동작으로 유지
- “고객에게 안내문을 전달한 뒤 이력을 저장하세요.” 안내 문구 추가

### 교정확인 이력 영역

파일 상세 화면에 `교정확인 이력` 영역을 추가했다.

표시 항목:

- 요청일시
- 상태
- 선택 항목
- 추가 메모
- 회신 채널
- 고객 회신/수정 요청
- 처리자
- 기록 액션

requested 이력에서 가능한 수동 기록:

- 고객 확인 완료 기록
- 고객 수정 요청 기록
- 요청 취소

## 7. 변경하지 않은 기존 기능

아래 기능은 변경하지 않았다.

- Cafe24 상품상세 파일 업로드
- Naver Object Storage 저장
- Supabase `files` 저장
- Cafe24 주문 옵션 `file_id` 입력
- Cafe24 Webhook 수신 API
- Webhook 기반 `files.order_id` 자동 연결
- `already_linked` 처리
- `conflict_order_id` 처리
- Cafe24 주문 조회 테스트
- Cafe24 주문 조회 기반 반자동 연결
- 주문번호 수동 연결
- `file_order_link_logs` 저장
- 파일 다운로드
- 다운로드 로그 저장
- 파일 상태 변경
- `file_status_change_logs` 저장
- 주문번호 연결 이력 표시
- Webhook 로그 필터
- 최근 업로드 파일 목록
- 전체 다운로드 로그/CSV
- 재업로드 요청 안내문 생성/복사 기능
- 재업로드 요청 사유 프리셋 버튼
- 교정확인 안내문 생성/복사 기능
- 교정확인 프리셋 다중 선택

## 8. 보안 기준 유지 여부

아래 민감정보는 화면, DB, 로그, API 응답, 보고 파일에 원문으로 저장하거나 표시하지 않았다.

- access token
- refresh token
- authorization
- bearer
- token
- client secret
- secret
- signature
- password
- cookie
- x-api-key
- Supabase service role key
- Naver Object Storage access key
- Naver Object Storage secret key
- signed URL 원문
- Webhook raw payload 전체

`file_proof_confirmations`에는 signed URL, storage path, token, API key, OAuth token, 원본 파일 다운로드 링크를 저장하지 않는다.

고객 회신 메모에는 개인정보가 들어갈 수 있으므로 운영자는 필요한 요약만 입력해야 한다.

## 9. 검증 결과

- `npm run build`: 통과
- `npm run typecheck`: 통과

참고:

- 첫 `npm run typecheck`는 `.next/types` 생성 전 상태라 실패했다.
- 이후 `npm run build`로 Next 타입 파일이 생성된 뒤 `npm run typecheck`를 다시 실행해 통과했다.

## 10. 커밋 해시

- 로컬 커밋 생성 완료. 최종 커밋 해시는 작업 완료 보고를 기준으로 확인한다.
- DB 테이블 추가 작업이 포함되어 있어 push/Production 배포 전 멈춘 상태

## 11. push 여부

- push 하지 않음

## 12. Vercel 배포 여부

- Vercel Production 배포하지 않음

## 13. SQL 적용 후 운영자가 확인해야 할 테스트 순서

1. Supabase SQL Editor에서 `file_proof_confirmations` 테이블 생성 SQL 실행
2. `/admin` 로그인
3. `file_id`로 파일 상세 검색
4. 기존 교정확인 안내문 생성/복사 기능이 유지되는지 확인
5. 교정확인 프리셋과 추가 메모를 입력
6. `교정확인 요청 저장` 클릭
7. Supabase `file_proof_confirmations`에 `requested` 이력이 생성되는지 확인
8. `/admin?file_id=<file_id>`에서 교정확인 이력 목록이 표시되는지 확인
9. 고객 확인 완료 기록
10. `proof_status = confirmed`로 바뀌는지 확인
11. 다른 requested 이력에서 고객 수정 요청 기록
12. `proof_status = rejected`로 바뀌는지 확인
13. 다른 requested 이력에서 요청 취소
14. `proof_status = canceled`로 바뀌는지 확인
15. 고객 확인 완료 시 `files.status`가 자동 `approved`로 바뀌지 않는지 확인
16. 고객 수정 요청 시 `files.status`가 자동 `need_reupload`로 바뀌지 않는지 확인
17. 파일 상태 변경, 다운로드, 주문번호 연결 이력, 재업로드 안내문 기능이 계속 작동하는지 확인

## 14. 다음 작업 추천

사용자가 Supabase SQL Editor에서 테이블 생성 SQL을 실행한 뒤, 아래 순서로 진행하는 것을 추천한다.

1. 이번 작업 관련 파일만 선별 커밋
2. GitHub `origin/main` push
3. Vercel Production 배포 확인
4. 운영 DB에서 교정확인 요청 저장/이력 표시 테스트
5. 정상 확인 후 Phase 2-2로 교정확인 상태 필터와 주문번호 기준 교정확인 이력 검색 검토

이번 단계에서는 고객용 링크, 자동 발송, 고객 직접 입력 화면, 파일 상태 자동 전환은 제외한다.
