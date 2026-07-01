# 재업로드/교체 처리 1단계 보고서

## 1. 작업 목적

재업로드/교체 자동화 전 단계로 `/admin`에서 파일 상태 흐름과 같은 주문번호에 연결된 파일의 최신/이전 구분을 운영자가 더 명확히 볼 수 있게 개선했습니다.

이번 작업은 관리자 화면 표시 개선이 목적이며, 고객 재업로드 링크 생성이나 기존 파일 자동 교체 로직은 구현하지 않았습니다.

## 2. 수정한 파일 목록

```txt
src/app/admin/page.tsx
src/components/AdminFileStatusForm.tsx
docs/gpt-report-reupload-replace-phase1-20260701.md
```

## 3. 주요 변경 내용

### 주문번호 검색 결과 최신/이전 파일 구분

`/admin`의 “주문번호로 업로드 파일 찾기” 결과에서 같은 `order_id`에 연결된 파일을 `created_at desc` 기준으로 표시합니다.

표시 기준:

- 첫 번째 파일: 최신 파일
- 두 번째 이후 파일: 이전 파일
- `need_reupload`: 재업로드 요청
- `replaced`: 새 파일로 교체됨
- `archived`: 보관 처리

각 파일 카드 상단에 최신/이전/상태 흐름 배지를 추가했습니다.

### 상태 변경 흐름 안내

`AdminFileStatusForm`에 운영 안내 문구를 추가했습니다.

```txt
재업로드 요청, 새 파일로 교체됨, 보관 처리는 관리자가 직접 판단해 변경하는 상태입니다.
```

상태 변경 select에는 기존 상태값이 유지됩니다.

```txt
uploaded_pending: 업로드됨 / 확인 전
reviewing: 파일 확인 중
approved: 파일 확인 완료
need_reupload: 재업로드 요청
replaced: 새 파일로 교체됨
archived: 보관 처리
```

## 4. 주문번호 검색 결과 최신/이전 파일 구분 방식

기존 `listFilesByOrderId()`는 Supabase `files` 테이블을 아래 기준으로 조회합니다.

```txt
order_id 정확 일치
created_at desc 정렬
```

이번 작업에서는 이 정렬 결과를 그대로 사용해 화면 표시만 보강했습니다.

```txt
index 0 → 최신 파일
index 1 이상 → 이전 파일
```

단, 파일 상태가 `need_reupload`, `replaced`, `archived`인 경우에는 상태 흐름을 우선 표시해 운영자가 바로 구분할 수 있게 했습니다.

## 5. 변경하지 않은 기존 기능

아래 기능은 변경하지 않았습니다.

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
- 파일 상태 변경 API
- `file_status_change_logs` 저장
- Webhook 로그 필터
- 전체 다운로드 로그/CSV
- 최근 업로드 파일 목록/필터

## 6. 보안 기준 유지 여부

이번 작업은 `/admin` 표시 로직만 수정했습니다.

아래 민감정보는 화면, 로그, API 응답, 보고서에 포함하지 않았습니다.

- access token
- refresh token
- authorization
- bearer token
- client secret
- webhook secret
- Supabase service role key
- Naver Object Storage key
- signed URL 원문
- JWT 원문
- Webhook raw payload 전체

## 7. DB 변경 또는 추가 SQL 필요 여부

DB schema 변경은 없습니다.

이번 작업에서는 새 테이블, 새 컬럼, migration, Supabase SQL 실행이 필요하지 않습니다.

## 8. 검증 결과

실행 명령:

```bash
npm run typecheck
npm run build
```

결과:

```txt
typecheck: 통과
build: 통과
```

## 9. 커밋 상태

보고서 작성 시점에는 아직 push하지 않았습니다.

이번 작업은 push가 곧 Production 배포를 유발할 수 있으므로, 지시서 기준에 따라 push 전 단계에서 멈춰 보고합니다.

## 10. 운영자가 `/admin`에서 확인해야 할 테스트 순서

1. `/admin` 로그인
2. 주문번호 `20260701-0000026`으로 파일 검색
3. 검색 결과가 `created_at` 최신순으로 표시되는지 확인
4. 첫 번째 파일에 `최신 파일` 배지가 표시되는지 확인
5. 두 번째 이후 파일이 있으면 `이전 파일` 배지가 표시되는지 확인
6. 파일 상태를 `재업로드 요청`으로 변경 가능 여부 확인
7. 파일 상태를 `새 파일로 교체됨`으로 변경 가능 여부 확인
8. 파일 상태를 `보관 처리`로 변경 가능 여부 확인
9. 상태 변경 후 `file_status_change_logs`에 이력이 저장되는지 확인
10. 기존 다운로드 버튼이 계속 작동하는지 확인
11. 기존 file_id 검색, 주문번호 수동 연결, 주문번호 연결 이력 섹션이 유지되는지 확인

## 11. 다음 작업 추천

1. 운영에서 주문번호 하나에 파일이 여러 개 연결된 테스트 데이터를 확인
2. 운영자가 실제로 `need_reupload`, `replaced`, `archived` 상태를 수동으로 구분해도 충분한지 확인
3. 이후 단계에서 고객 재업로드 링크, 새 파일 업로드 시 이전 파일 자동 `replaced` 처리 여부를 별도 설계
4. 자동 교체 로직을 만들기 전 `file_order_link_logs`, `file_status_change_logs` 기준으로 감사 추적 정책 확정
