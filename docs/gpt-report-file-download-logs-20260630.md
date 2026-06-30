# GPT 보고서: 관리자 파일 다운로드 로그 저장 기능

## 1. 작업 목적

운영 중 관리자가 어떤 파일을 언제 다운로드했는지 확인할 수 있도록 Supabase에 다운로드 로그를 저장하는 기능을 추가했습니다.

기존 관리자 다운로드 기능은 signed URL 기반으로 안전하게 파일을 내려받을 수 있었지만, 다운로드 이력은 남지 않았습니다. 이번 작업에서는 `/api/files/download` route에서 성공/실패 로그를 남기고, `/admin` file_id 검색 결과 아래에서 해당 파일의 최근 다운로드 로그를 확인할 수 있게 했습니다.

## 2. 추가/수정한 파일

- `supabase/schema.sql`
- `src/app/api/files/download/route.ts`
- `src/app/admin/page.tsx`
- `src/lib/files/download-log-service.ts`
- `docs/gpt-report-file-download-logs-20260630.md`

## 3. 추가한 DB 테이블

테이블명:

```txt
file_download_logs
```

용도:

- 관리자 다운로드 성공/실패 이력 저장
- 파일별 최근 다운로드 내역 조회
- 운영 중 파일 접근 이력 추적

## 4. Supabase에서 실행해야 할 SQL

Supabase SQL Editor에서 아래 SQL을 실행해야 합니다.

```sql
create table if not exists public.file_download_logs (
  id uuid primary key default gen_random_uuid(),
  file_id text,
  original_filename text,
  storage_bucket text,
  storage_path text,
  downloaded_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  result text not null,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists file_download_logs_file_id_idx
  on public.file_download_logs (file_id);

create index if not exists file_download_logs_downloaded_at_idx
  on public.file_download_logs (downloaded_at desc);
```

기존 `files` 테이블은 변경하지 않았습니다.

## 5. 다운로드 로그 저장 방식

`/api/files/download?file_id=<id>` route에서 아래 흐름으로 동작합니다.

1. 관리자 세션 쿠키 검증
2. `file_id` 검증
3. Supabase `files` row 조회
4. storage provider, bucket, path 검증
5. Naver Object Storage signed URL 생성
6. signed URL 생성 성공 시 `result = success` 로그 저장
7. storage 정보 오류 또는 signed URL 생성 실패 시 `result = failed` 로그 저장
8. 정상 다운로드는 기존처럼 302 redirect 유지

로그 저장 실패가 다운로드 자체를 막지 않도록 best-effort 방식으로 처리했습니다. 예를 들어 Production 배포 직후 아직 `file_download_logs` 테이블이 생성되지 않은 상태라도 다운로드 기능은 최대한 유지되고, 서버 로그에는 안전한 요약만 남습니다.

## 6. 저장하는 로그 필드

- `file_id`
- `original_filename`
- `storage_bucket`
- `storage_path`
- `downloaded_at`
- `ip_address`
- `user_agent`
- `result`
- `error_message`
- `created_at`

저장하지 않는 값:

- signed URL 원문
- Naver Object Storage access key
- Naver Object Storage secret key
- Supabase service role key
- Cafe24 token
- 관리자 비밀번호
- 관리자 세션 secret

## 7. `/admin` UI 변경 내용

`/admin`에서 `file_id` 검색 시 파일 정보 카드 아래에 `최근 다운로드 로그` 영역을 추가했습니다.

표시 항목:

- `downloaded_at`
- `result`
- `ip_address`
- `user_agent`
- `error_message`

처음에는 해당 `file_id` 기준 최근 5개 로그만 표시합니다.

`user_agent`는 화면에서 과도하게 길어지지 않도록 일부만 표시합니다.

## 8. 보안 기준

아래 보안 기준을 유지했습니다.

- `/api/files/download`는 관리자 세션 쿠키가 있어야 동작
- 인증 실패 시 401 반환
- 인증 실패 시 signed URL 생성 안 함
- signed URL 원문을 DB에 저장하지 않음
- secret/token/key 원문을 DB, 화면, 로그에 저장하지 않음
- 실패 로그에는 민감값 없이 안전한 error summary만 저장

## 9. 이번 작업에서 하지 않은 것

- 사용자별 관리자 계정 시스템
- 파일 삭제
- 주문 Webhook
- Cafe24 Admin API 주문 조회
- `files.order_id` 자동 연결
- ScriptTags API 실제 등록
- 100MB 업로드
- multipart upload
- 다운로드 로그 상세 페이지
- 다운로드 로그 CSV export

## 10. 검증 명령

실행한 명령:

```bash
npm run typecheck
npm run build
```

결과:

- `npm run typecheck`: 통과
- `npm run build`: 통과

빌드 결과에서 `/admin`, `/api/files/download`는 동적 route로 정상 포함되었습니다.

## 11. 사용자 테스트 순서

1. Supabase SQL Editor에서 `file_download_logs` 테이블 생성 SQL을 실행합니다.
2. Vercel Production에 최신 배포가 반영되었는지 확인합니다.
3. `/admin`에 로그인합니다.
4. Cafe24 관리자 주문상세에서 `업로드 파일 ID`를 복사합니다.
5. `/admin`에서 `file_id`를 검색합니다.
6. 파일 정보가 표시되는지 확인합니다.
7. `파일 다운로드` 버튼을 클릭합니다.
8. 파일 다운로드가 성공하는지 확인합니다.
9. 같은 `file_id`로 다시 검색합니다.
10. `최근 다운로드 로그`에 `success` 로그가 표시되는지 확인합니다.
11. 로그아웃 상태에서 `/api/files/download?file_id=<id>` 직접 접근 시 401이 반환되는지 확인합니다.

## 12. 다음 단계 제안

1. 다운로드 로그 전체 목록 페이지 추가
2. file_id, 주문번호, 다운로드 일자 기준 필터 추가
3. 실패 로그만 모아보는 운영 점검 화면 추가
4. 다운로드 로그 CSV export 추가
5. `files.order_id` 자동 연결 후 주문번호 기준 다운로드 이력 조회
