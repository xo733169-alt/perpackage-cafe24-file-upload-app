# 고객용 재업로드 링크 재접속 상태 오류 수정 보고서

## 1. 작업 목적

고객이 `/reupload?token=...` 링크에서 재업로드를 완료한 뒤 같은 링크로 다시 접속했을 때, 업로드 폼이 다시 표시되지 않고 “이미 재업로드가 완료된 링크입니다.” 안내가 표시되도록 수정했습니다.

## 2. 시작 전 git 상태

- 브랜치: `main`
- 시작 전 로컬 HEAD: `ed8959fe46b8916169fa3bc0a62f119ac57c6975`
- 시작 전 origin/main: `5326133a9e2edb7d65176c8fb3fae718cb589988`
- 시작 전 작업트리: clean
- staged 파일: 없음

## 3. origin/main 최신 반영 방식

작업 전 `git fetch origin` 후 `git merge --ff-only origin/main` 방식으로 최신 main을 반영했습니다.

## 4. origin/main 최신 커밋 5326133 유지 여부

유지했습니다.

- 최신 반영 후 HEAD: `5326133a9e2edb7d65176c8fb3fae718cb589988`
- 최신 커밋 메시지: `feat: auto-fill upload file id from editor return link`
- 해당 커밋의 위젯 변경은 되돌리지 않았습니다.

## 5. stash 유지 여부

유지했습니다. `stash pop/apply`는 실행하지 않았습니다.

- `stash@{0}: On main: pre-download-log-refresh-report-doc-20260703`
- `stash@{1}: On main: pre-storage-path-reapply-unrelated-20260703`

## 6. 수정 파일 목록

- `src/app/reupload/page.tsx`
- `src/lib/files/reupload-request-service.ts`

## 7. 원인 판단

DB update 자체는 정상적으로 완료되는 상태로 판단했습니다. 문제는 재접속 시 `/reupload` 페이지가 최신 DB 상태를 반드시 다시 읽도록 보장되지 않은 점과, 상태 판정에서 `new_file_id` 존재만으로 이미 사용된 링크로 보지 않았던 점이 함께 원인이 될 수 있었습니다.

## 8. DB update 문제였는지, 화면 캐시/상태 판정 문제였는지

DB update 문제보다는 화면 캐시/동적 렌더링 보장 부족과 상태 판정 조건 부족 문제로 정리했습니다.

## 9. 적용한 수정 내용

- `/reupload` 페이지에 `export const dynamic = "force-dynamic"` 추가
- `/reupload` 페이지에 `export const revalidate = 0` 추가
- 이미 사용된 링크 안내 문구를 “이미 재업로드가 완료된 링크입니다.”로 정리
- 재업로드 요청 상태 판정에서 `new_file_id`가 있으면 이미 사용된 링크로 처리
- 재업로드 완료 update 조건에 `new_file_id is null` 조건 추가

## 10. 이미 사용된 링크 판정 조건

아래 조건 중 하나라도 해당하면 업로드 폼을 표시하지 않고 이미 사용된 링크로 처리합니다.

- `new_file_id`가 있음
- `used_at`이 있음
- `status = uploaded`
- `status = reviewing`
- `status = completed`

## 11. 업로드 API 중복 업로드 차단 여부

보강했습니다. 업로드 완료 처리 시 아래 조건을 만족하는 row만 업데이트합니다.

- `id`가 현재 요청과 일치
- `status = requested`
- `new_file_id is null`
- `used_at is null`

따라서 화면이 오래된 상태를 보여주더라도, 이미 완료된 요청은 서버 update 단계에서 중복 완료되지 않습니다.

## 12. 변경하지 않은 기존 기능

- 기존 파일 status 자동 `replaced` 처리 없음
- 새 파일 status 자동 `approved` 처리 없음
- 기존 파일 삭제 없음
- Naver Object Storage 기존 파일 삭제 없음
- Webhook 자동 연결 로직 변경 없음
- Cafe24 주문 조회 로직 변경 없음
- 다운로드 signed URL redirect 로직 변경 없음
- Supabase SQL 실행 없음
- DB schema 변경 없음
- 자동 이메일/카카오/채널톡 발송 없음

## 13. 보안 기준 유지 여부

유지했습니다.

- raw token DB 저장 없음
- raw token 로그 출력 추가 없음
- token_hash API 응답 추가 없음
- storage_path 고객 화면/API 응답 노출 없음
- signed URL 원문 표시 없음
- Supabase service role key, Naver key, OAuth token 노출 없음

## 14. typecheck 결과

통과했습니다.

```txt
npm.cmd run typecheck
tsc --noEmit
exit code 0
```

## 15. build 결과

통과했습니다.

```txt
npm.cmd run build
next build
exit code 0
```

참고: build 출력 끝에 기존 Cafe24 OAuth start route의 dynamic server usage 로그가 표시되었지만, build 자체는 exit code 0으로 성공했습니다.

## 16. 커밋 여부

아직 커밋하지 않았습니다.

## 17. push 여부

push하지 않았습니다.

## 18. Vercel 배포 여부

Vercel Production 배포하지 않았습니다.

## 19. 운영자가 확인할 테스트 순서

1. `/admin`에서 테스트용 재업로드 요청 링크를 생성합니다.
2. `/reupload?token=...` 링크에 접속합니다.
3. 유효한 requested 상태에서 업로드 폼이 표시되는지 확인합니다.
4. 파일 1개를 업로드합니다.
5. 업로드 완료 메시지가 표시되는지 확인합니다.
6. Supabase `file_reupload_requests`에서 `status = uploaded`, `new_file_id` 있음, `used_at` 있음 상태를 확인합니다.
7. 같은 `/reupload?token=...` 링크를 새로고침하거나 다시 접속합니다.
8. “이미 재업로드가 완료된 링크입니다.” 안내가 표시되고 업로드 폼이 보이지 않는지 확인합니다.
9. `/admin` 재업로드 요청 이력에 새 파일 ID가 표시되는지 확인합니다.

## 20. 배포 전 멈춘 지점

요청대로 typecheck/build 검증과 보고서 작성까지 완료했고, 커밋/push/Vercel 배포 전 단계에서 멈췄습니다.
