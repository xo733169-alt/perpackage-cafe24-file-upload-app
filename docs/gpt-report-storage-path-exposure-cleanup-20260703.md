# storage_path 노출 정리 1단계 보고서

## 1. 작업 목적

고객-facing 업로드 API 응답과 `/admin` 일반 운영 화면에서 내부 저장 경로인 `storage_path` 원문이 불필요하게 노출되는 부분을 줄였다.

이번 작업은 보안/표시 정리 1단계이며, DB 변경, Supabase SQL 추가, Webhook 자동 연결 로직 변경, 다운로드 signed URL 생성/redirect 로직 변경은 하지 않았다.

## 2. 수정 파일 목록

- `src/app/api/files/upload/route.ts`
- `src/components/upload-test-form.tsx`
- `src/app/admin/page.tsx`
- `docs/gpt-report-storage-path-exposure-cleanup-20260703.md`

주의: 작업 전부터 `src/app/admin/page.tsx` 등 여러 파일에 기존 미커밋 변경이 남아 있었다. 이번 작업에서는 그중 `storage_path` 표시 정리와 직접 관련된 부분만 수정했다.

## 3. 고객-facing 응답에서 제거한 항목

`POST /api/files/upload` 성공 응답의 `file` 객체에서 아래 내부 저장 정보를 제거했다.

- `storage_provider`
- `storage_path`

응답에는 고객 위젯과 테스트 화면에 필요한 최소 정보만 남겼다.

- `id`
- `original_filename`
- `file_size`
- `mime_type`
- `status`
- `created_at`

`storage_bucket`, signed URL, token, API key, secret, service role key, Naver Object Storage key는 응답에 추가하지 않았다.

## 4. /admin 표시 정리 내용

`/admin` 파일 상세 화면과 주문번호 검색 결과 카드에서 `storage_bucket`, `storage_path` 원문 표시를 제거했다.

대신 내부 저장 메타데이터가 있는 경우 아래처럼 표시한다.

- `내부 저장 정보: 숨김 처리`

저장 메타데이터가 부족한 경우에는 아래처럼 표시한다.

- `내부 저장 정보: 저장 정보 없음`

관리자 다운로드 가능 여부 판단에는 기존처럼 `storage_bucket`, `storage_path`를 내부적으로 사용한다. 화면에 원문을 그대로 표시하지 않도록만 정리했다.

## 5. 위젯 영향 여부

`public/cafe24/product-upload-widget.js`를 확인한 결과, 고객용 상품상세 위젯은 업로드 성공 후 아래 값만 사용한다.

- `id` 또는 `json.id`
- `original_filename`
- `status`

위젯은 `storage_path`, `storage_bucket`, `storage_provider`에 의존하지 않는다. 따라서 업로드 API 응답에서 `storage_path`를 제거해도 file_id 자동 입력 흐름에는 영향이 없다.

## 6. 다운로드 기능 유지 여부

다운로드 기능은 변경하지 않았다.

유지한 기능:

- `/api/files/download?file_id=...`
- 관리자 세션 검증
- Supabase `files` row 조회
- Naver Object Storage signed URL 생성
- 302 redirect
- 다운로드 로그 저장
- 다운로드 버튼 표시

signed URL 원문은 화면에 표시하지 않는다.

## 7. 변경하지 않은 기존 기능

아래 기능은 변경하지 않았다.

- 파일 업로드 저장 로직
- Naver Object Storage 업로드 로직
- Supabase `files` 저장 로직
- file_id 생성
- Cafe24 주문 옵션 file_id 자동 입력
- Webhook 자동 연결
- Cafe24 Admin API 주문 조회
- 주문번호 검색
- file_id 검색
- 파일 상태 변경
- 상태 변경 이력
- 다운로드 로그
- 교정확인 이력
- 재업로드 안내문
- 교정확인 안내문

## 8. 보안 기준 유지 여부

AGENTS.md의 민감정보 노출 금지 기준을 기준으로 정리했다.

이번 변경 후 고객-facing 업로드 응답에는 아래 값을 포함하지 않는다.

- `storage_path`
- `storage_bucket`
- signed URL 원문
- token
- API key
- secret
- service role key
- Naver Object Storage key

`/admin` 화면에서도 `storage_path` 원문은 기본 표시하지 않도록 바꿨다.

## 9. typecheck 결과

실행 명령:

```bash
npm run typecheck
```

결과: 실패

원인:

- 현재 PowerShell 기본 PATH에서는 `npm`이 바로 잡히지 않아, Node.js Winget 설치 경로의 `npm.cmd`로 재실행했다.
- 재실행 후 `tsc --noEmit`이 `.next/types/...` 파일 누락으로 실패했다.
- 이는 현재 `.next/types` 생성 상태와 관련된 기존 프로젝트 상태 문제로 보이며, 이번 `storage_path` 응답/표시 정리 변경과 직접 관련된 타입 오류는 확인되지 않았다.

## 10. build 결과

실행 명령:

```bash
npm run build
```

결과: 실패

원인:

- Next.js production build의 컴파일 단계는 성공했다.
- 타입 검증 단계에서 repo 내부 미추적 중첩 프로젝트 `perpackage-cafe24-file-upload-app-widget-stability/src/app/admin/page.tsx`가 함께 검사되며 실패했다.
- 오류 내용은 해당 중첩 프로젝트가 `getProofStatusFilter`를 import하지만 현재 `proof-confirmation-service`에서 해당 export를 찾지 못한다는 내용이다.
- `perpackage-cafe24-file-upload-app-widget-stability/`는 이번 작업 대상이 아니므로 임의로 수정하거나 삭제하지 않았다.

## 11. 커밋 해시

없음.

이번 단계에서는 커밋하지 않았다.

## 12. push 여부

push하지 않았다.

## 13. Vercel 배포 여부

Vercel 배포하지 않았다.

## 14. 운영자가 확인할 테스트 순서

배포 후 운영 화면에서 아래 순서로 확인한다.

1. Cafe24 상품상세에서 파일 1개 업로드
2. 업로드 성공 메시지와 file_id 표시 확인
3. Cafe24 추가 입력 옵션 `업로드 파일 ID`에 file_id 자동 입력 확인
4. 브라우저 개발자 도구 Network에서 `/api/files/upload` 응답 확인
5. 응답에 `storage_path`, `storage_bucket`, signed URL 원문이 없는지 확인
6. `/admin` 로그인
7. file_id 검색
8. 파일 상세에서 `storage_path` 원문 대신 `내부 저장 정보: 숨김 처리` 표시 확인
9. 주문번호 검색
10. 주문번호 검색 결과 카드에서도 storage 경로 원문이 보이지 않는지 확인
11. 다운로드 버튼 클릭
12. 파일 다운로드 정상 여부 확인
13. 다운로드 로그 저장 여부 확인

## 15. 배포 전 멈춘 지점

요청에 따라 Production 배포 전 단계에서 멈췄다.

또한 `npm run typecheck`, `npm run build`가 현재 작업과 무관한 기존 프로젝트 상태 때문에 통과하지 않아, 이 상태에서는 커밋/push/배포 전에 기존 미추적 중첩 프로젝트 또는 `.next/types` 상태 정리가 필요하다.

