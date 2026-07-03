# 고객용 재업로드 링크 Phase 3 - 관리자 재업로드 요청 생성 기능 보고서

## 1. 작업 목적

`/admin?file_id=<file_id>` 파일 상세 화면에서 관리자가 고객용 재업로드 요청 record를 생성하고, 고객에게 전달할 재업로드 링크와 안내문을 복사할 수 있게 했습니다.

이번 단계에서는 고객용 `/reupload` 페이지, 고객 업로드 API, 파일 실제 교체 처리, 파일 삭제, 자동 발송 기능은 구현하지 않았습니다.

## 2. 시작 전 git 상태

- 브랜치: `main`
- 로컬 HEAD: `48118924ab9d219b4b6f325ef6f8851a40ba9ec0`
- origin/main: `48118924ab9d219b4b6f325ef6f8851a40ba9ec0`
- staged 파일: 없음
- 작업 전 worktree: clean
- stash 유지:
  - `stash@{0}: On main: pre-download-log-refresh-report-doc-20260703`
  - `stash@{1}: On main: pre-storage-path-reapply-unrelated-20260703`

## 3. origin/main과 로컬 HEAD 차이 여부

작업 시작 시 로컬 HEAD와 `origin/main`은 동일했습니다.

## 4. stash 사용 여부

이번 작업에서는 stash를 새로 만들지 않았고, 기존 stash도 `pop/apply` 하지 않았습니다.

## 5. 수정 파일 목록

- `src/app/admin/page.tsx`
- `src/app/api/admin/reupload-requests/route.ts`
- `src/components/ReuploadLinkCreatePanel.tsx`
- `src/lib/files/reupload-request-service.ts`
- `docs/gpt-report-reupload-request-admin-create-20260703.md`

## 6. 추가한 관리자 UI 위치

`/admin`의 file_id 검색 상세 결과에서 기존 `재업로드 요청 안내문` 아래에 `재업로드 링크 생성` 섹션을 추가했습니다.

섹션에는 아래 항목을 포함했습니다.

- 기존 파일명, file_id, 주문번호 요약
- 재업로드 요청 사유 입력
- 고객 안내 추가 문구 입력
- 재업로드 링크 생성 버튼
- 생성 후 링크 복사 버튼
- 생성 후 안내문 복사 버튼
- 재업로드 요청 이력 표

## 7. 추가한 API 또는 server action

관리자 인증이 필요한 API route를 추가했습니다.

```txt
POST /api/admin/reupload-requests
```

역할:

- 관리자 세션 쿠키 검증
- JSON body 파싱
- `original_file_id` 검사
- `reason` 검사
- 기존 files row 조회
- raw token 생성
- `token_hash` 생성
- `file_reupload_requests` insert
- 생성 직후 `reupload_url`과 고객 안내문 반환

## 8. token 생성 방식

`crypto.randomBytes(32).toString("base64url")`로 충분히 긴 랜덤 raw token을 생성합니다.

## 9. token_hash 저장 방식

raw token을 `sha256`으로 hash 처리해 hex 문자열로 변환한 뒤 `file_reupload_requests.token_hash`에 저장합니다.

## 10. raw token 미저장 확인

raw token은 DB에 저장하지 않습니다.

DB insert payload에는 `token_hash`만 포함됩니다. API 응답에도 `token_hash`는 포함하지 않고, raw token이 포함된 `reupload_url`만 생성 직후 반환합니다.

서버 로그와 보고서에는 raw token 원문을 기록하지 않았습니다.

## 11. file_reupload_requests insert 구조

저장 기준:

- `original_file_id`: 현재 상세 화면의 file_id
- `new_file_id`: `null`
- `order_id`: 기존 파일의 `order_id` 또는 `null`
- `token_hash`: raw token의 SHA-256 hash
- `reason`: 관리자 입력 사유
- `customer_message`: 관리자 추가 안내 문구
- `status`: `requested`
- `expires_at`: 생성 시점 기준 7일 뒤
- `used_at`: `null`
- `created_by`: `admin`
- `customer_ip`: `null`
- `customer_user_agent`: `null`
- `upload_attempt_count`: `0`
- `last_error_message`: `null`

조회 시에는 `token_hash`를 select하지 않습니다.

## 12. 재업로드 안내문 생성 방식

API에서 생성된 `reupload_url`과 기존 파일 정보를 기준으로 고객 안내문을 생성합니다.

포함 항목:

- 주문번호 또는 미연결
- 기존 파일명
- 재업로드 요청 사유
- 재업로드 링크
- 1개 파일 업로드 안내
- 여러 파일은 ZIP 압축 안내
- 관리자 추가 안내 문구

## 13. 재업로드 요청 이력 표시 방식

`file_reupload_requests.original_file_id = 현재 file_id` 기준으로 최신순 최근 10개를 조회합니다.

화면 표시 항목:

- 요청일시
- 상태
- 사유
- 만료일시
- 사용일시
- 새 파일 ID
- 생성자

이미 유효한 `requested` 요청이 있으면 “기존 유효 요청이 있습니다” 안내를 표시하되, 이번 단계에서는 새 요청 생성을 허용했습니다.

## 14. 변경하지 않은 기존 기능

- 고객용 `/reupload` 페이지 구현 없음
- 고객 업로드 API 구현 없음
- 파일 실제 교체 처리 없음
- 기존 파일 status 자동 변경 없음
- 새 파일 업로드 처리 없음
- 파일 삭제 없음
- Naver Object Storage 삭제 없음
- Webhook 자동 연결 로직 변경 없음
- Cafe24 Admin API 주문 조회 로직 변경 없음
- 기존 `files.order_id` 자동 연결 정책 변경 없음
- 자동 이메일/카카오/채널톡 발송 없음
- Supabase SQL 실행 없음
- DB schema 변경 없음
- 다운로드 signed URL redirect 로직 변경 없음
- storage_path 원문 재노출 없음
- 기존 재업로드 요청 안내문 복사 기능 유지
- 파일 상태 변경 기능 유지
- 교정확인 안내문/이력 기능 유지
- 파일 다운로드 및 다운로드 로그 자동 갱신 기능 유지

## 15. 보안 기준 유지 여부

유지했습니다.

- raw token DB 저장 없음
- raw token 서버 로그 출력 없음
- `token_hash`만 DB 저장
- API 응답에 `token_hash` 미포함
- signed URL 원문 화면 표시 없음
- storage_path 원문 화면 표시 없음
- service role key, Naver key, OAuth token 노출 없음
- Webhook raw payload 전체 표시 없음

## 16. typecheck 결과

통과했습니다.

실행 기록:

```txt
npm.cmd run typecheck
```

참고:

- 현재 PowerShell에서는 `npm.ps1` 실행 정책 때문에 `npm run typecheck`가 차단되어 `npm.cmd run typecheck`로 실행했습니다.
- Next `.next/types` 생성 전 병렬 실행한 첫 typecheck는 `.next/types` 누락으로 실패했으나, `npm.cmd run build` 후 재실행한 typecheck는 통과했습니다.

## 17. build 결과

통과했습니다.

실행 기록:

```txt
npm.cmd run build
```

빌드 결과:

- `Compiled successfully`
- `/api/admin/reupload-requests` route 생성 확인
- 기존 `cafe24_oauth_start_failed Dynamic server usage` 메시지는 cookies 사용으로 인한 기존 동적 route 안내이며 build exit code는 0입니다.

## 18. 커밋 여부

아직 커밋하지 않았습니다.

## 19. push 여부

push하지 않았습니다.

## 20. Vercel 배포 여부

Vercel Production 배포하지 않았습니다.

## 21. 운영자가 확인할 테스트 순서

1. `/admin` 로그인
2. file_id로 파일 상세 검색
3. `재업로드 링크 생성` 섹션 표시 확인
4. 재업로드 요청 사유 입력
5. 고객 안내 추가 문구가 있으면 입력
6. `재업로드 링크 생성` 클릭
7. 생성된 링크 표시 확인
8. 생성된 안내문에 주문번호, 기존 파일명, 사유, 링크가 포함되는지 확인
9. 링크 복사 버튼 동작 확인
10. 안내문 복사 버튼 동작 확인
11. Supabase `file_reupload_requests`에 `requested` row 생성 확인
12. DB에는 raw token이 없고 `token_hash`만 저장되는지 확인
13. `expires_at`이 생성 시점 기준 7일 뒤인지 확인
14. 같은 file_id 상세 화면의 재업로드 요청 이력에 새 row가 표시되는지 확인
15. 기존 재업로드 안내문 복사 기능 유지 확인
16. 기존 상태 변경 기능 유지 확인
17. 기존 교정확인 기능 유지 확인
18. 기존 다운로드 기능 유지 확인
19. 다운로드 로그 자동 갱신 기능 유지 확인
20. storage_path와 signed URL 원문이 화면에 노출되지 않는지 확인

## 22. 배포 전 멈춘 지점

요청에 따라 커밋/push/Vercel 배포 전 보고 단계에서 멈춥니다.
