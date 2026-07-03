# 고객용 재업로드 링크 Phase 4 - /reupload 고객 업로드 페이지 1차 구현 보고서

## 1. 작업 목적

고객이 `/reupload?token=<raw_token>` 링크로 접속해 수정 인쇄 파일 1개를 업로드할 수 있도록 1차 고객용 재업로드 페이지와 업로드 API를 구현했다.

이번 단계는 고객 업로드 접수까지가 목적이며, 기존 파일 상태 자동 교체, 기존 파일 삭제, 자동 발송, Webhook/Cafe24 주문 조회 로직 변경은 하지 않았다.

## 2. 시작 전 git 상태

- 브랜치: `main`
- 로컬 HEAD: `a7dd8609119c16134f8083123d9923e0595c1f64`
- origin/main: `a7dd8609119c16134f8083123d9923e0595c1f64`
- staged 파일: 없음
- 작업 전 미커밋/미추적 파일: 없음
- 기존 stash:
  - `stash@{0}: On main: pre-download-log-refresh-report-doc-20260703`
  - `stash@{1}: On main: pre-storage-path-reapply-unrelated-20260703`

## 3. origin/main과 로컬 HEAD 차이 여부

작업 시작 전 `git ls-remote origin main` 기준 origin/main은 로컬 HEAD와 동일했다.

## 4. stash 사용 여부

이번 작업에서는 새 stash를 사용하지 않았다. 기존 stash도 pop/apply 하지 않고 그대로 유지했다.

## 5. 수정 파일 목록

- `src/lib/files/reupload-request-service.ts`
- `src/app/reupload/page.tsx`
- `src/app/api/reupload/upload/route.ts`
- `src/components/ReuploadCustomerUploadForm.tsx`
- `docs/gpt-report-reupload-customer-page-20260703.md`

## 6. 추가한 고객 페이지 경로

- `GET /reupload?token=<raw_token>`

상태별로 아래 화면을 표시한다.

- token 없음: 재업로드 링크 없음 안내
- 잘못된 token: 유효하지 않은 링크 안내
- 만료됨: 만료 안내
- 이미 사용됨: 이미 사용된 링크 안내
- 취소됨: 취소된 요청 안내
- 실패 상태: 처리 불가 안내
- 유효한 `requested` 상태: 재업로드 요청 정보와 파일 업로드 폼 표시

## 7. 추가한 API 또는 server action

- `POST /api/reupload/upload`

multipart formData로 `token`, `file`을 받는다. 관리자 세션이 아닌 재업로드 token 검증을 기준으로 고객 업로드를 허용한다.

## 8. token 검증 방식

- raw token은 DB에 저장하지 않는다.
- 고객 요청에서 받은 raw token은 서버에서 SHA-256 hash로 변환한다.
- 변환한 hash를 `file_reupload_requests.token_hash`와 비교한다.
- 조회 select에는 `token_hash`를 포함하지 않는다.
- API 응답에 `token_hash`를 포함하지 않는다.
- raw token을 console.log 또는 보고서에 남기지 않는다.

## 9. 상태별 화면 처리

`lookupReuploadRequestByRawToken`에서 요청 상태를 판정한다.

- `requested` + `used_at` 없음 + 만료 전: 업로드 가능
- `uploaded`, `reviewing`, `completed` 또는 `used_at` 있음: 이미 사용됨
- `expired` 또는 만료일 초과: 만료됨
- `canceled`: 취소됨
- `failed`: 처리 불가
- token 없음/불일치/original file 없음: 유효하지 않은 링크

## 10. 파일 업로드 제한

클라이언트와 서버 양쪽에서 1개 파일 업로드를 기준으로 처리한다.

허용 확장자:

- `ai`
- `pdf`
- `eps`
- `zip`
- `jpg`
- `jpeg`
- `png`
- `psd`

차단 확장자:

- `exe`
- `bat`
- `cmd`
- `sh`
- `js`
- `msi`
- `dll`
- `php`
- `html`
- `htm`

여러 파일은 하나의 ZIP 파일로 압축해 업로드하라는 안내를 표시한다.

## 11. 새 files row 생성 방식

새 고객 재업로드 파일은 Naver Object Storage에 저장하고 `files` 테이블에 새 row로 저장한다.

저장 기준:

- `original_filename`: 새 업로드 파일명
- `storage_provider`: `naver-object-storage`
- `storage_bucket`: 내부 저장용
- `storage_path`: 내부 저장용
- `customer_type`: `cafe24-reupload`
- `order_id`: 재업로드 요청의 기존 주문번호 유지
- `status`: `uploaded_pending`
- `mall_id`, `shop_no`, `product_no`, `variant_code`, `inquiry_id`: 기존 원본 파일에서 가능한 값 복사

고객 화면/API 응답에는 `storage_bucket`, `storage_path`, signed URL을 반환하지 않는다.

## 12. file_reupload_requests 업데이트 방식

업로드 성공 후 해당 요청 row를 아래처럼 갱신한다.

- `new_file_id`: 새 files row ID
- `status`: `uploaded`
- `used_at`: 현재 시각
- `updated_at`: 현재 시각
- `upload_attempt_count`: 기존 값 + 1
- `last_error_message`: null
- `customer_ip`: 요청 IP 요약
- `customer_user_agent`: 요청 user-agent

업로드 실패 시에는 가능한 경우 `upload_attempt_count`와 `last_error_message`를 갱신한다.

## 13. /admin 이력 표시 연동 여부

기존 `/admin` 파일 상세의 재업로드 요청 이력은 `new_file_id`를 표시하는 구조라서, 이번 고객 업로드 성공 후 `new_file_id`가 갱신되면 관리자 화면에서도 새 파일 ID를 확인할 수 있다.

## 14. 변경하지 않은 기존 기능

- 기존 파일 status 자동 `replaced` 변경 없음
- 새 파일 status 자동 `approved` 변경 없음
- 기존 파일 삭제 없음
- Naver Object Storage 기존 파일 삭제 없음
- 자동 이메일/카카오/채널톡 발송 없음
- Webhook 자동 연결 로직 변경 없음
- Cafe24 주문 조회 로직 변경 없음
- 다운로드 signed URL redirect 로직 변경 없음
- Supabase SQL 실행 없음
- DB schema 변경 없음

## 15. 보안 기준 유지 여부

유지했다.

- raw token DB 저장 없음
- `token_hash` API 응답 없음
- `storage_path` 고객 화면/API 응답 노출 없음
- `storage_bucket` 고객 화면/API 응답 노출 없음
- signed URL 원문 노출 없음
- Supabase service role key, Naver key, OAuth token 노출 없음

## 16. typecheck 결과

명령:

```bash
npm.cmd run typecheck
```

결과: 통과

## 17. build 결과

명령:

```bash
npm.cmd run build
```

결과: 통과

참고: build 중 기존 Cafe24 OAuth start route의 dynamic server usage 메시지가 출력되었지만 exit code는 0이었다.

## 18. 커밋 여부

아직 커밋하지 않았다.

## 19. push 여부

push하지 않았다.

## 20. Vercel 배포 여부

Vercel Production 배포하지 않았다.

## 21. 운영자가 확인할 테스트 순서

1. `/admin`에서 file_id 상세 화면을 연다.
2. 재업로드 링크를 생성한다.
3. 생성된 `/reupload?token=...` 링크로 접속한다.
4. 주문번호, 기존 파일명, 재업로드 사유, 만료일시가 표시되는지 확인한다.
5. 허용 확장자 파일 1개를 업로드한다.
6. 재업로드 완료 메시지가 표시되는지 확인한다.
7. Supabase `files` 테이블에 새 row가 생성되었는지 확인한다.
8. 새 row의 `customer_type`이 `cafe24-reupload`인지 확인한다.
9. 새 row의 `order_id`가 기존 요청 주문번호와 같은지 확인한다.
10. Supabase `file_reupload_requests`의 `new_file_id`, `status`, `used_at`, `upload_attempt_count`가 갱신되었는지 확인한다.
11. 같은 링크로 다시 접속하면 이미 사용된 링크 안내가 표시되는지 확인한다.
12. 위험 확장자 파일 업로드가 차단되는지 확인한다.
13. `/admin` 재업로드 요청 이력에서 새 파일 ID가 표시되는지 확인한다.

## 22. 배포 전 멈춘 지점

요청에 따라 typecheck/build 통과 후 커밋, push, Vercel Production 배포 전 단계에서 멈췄다.
