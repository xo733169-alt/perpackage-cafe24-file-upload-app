# storage_path 노출 정리 후 typecheck/build 실패 원인 정리 보고서

## 1. 작업 목적

`storage_path` 노출 정리 1단계 변경은 유지하면서, `npm run typecheck`와 `npm run build`가 실패하던 원인을 정리했다.

이번 작업은 빌드/검증 환경 정리 작업이다. Webhook 자동 연결, 다운로드 signed URL redirect, Cafe24 주문 조회, Supabase DB 구조는 변경하지 않았다.

## 2. git status 기준 현재 변경 파일/미추적 파일 요약

작업 시작 시 주요 변경 상태:

- 수정된 파일 다수 존재
  - `README.md`
  - `src/app/admin/actions.ts`
  - `src/app/admin/page.tsx`
  - `src/app/api/cafe24/auth/callback/route.ts`
  - `src/app/api/files/upload/route.ts`
  - `src/components/ProofConfirmationMessagePanel.tsx`
  - `src/components/ReuploadRequestMessagePanel.tsx`
  - `src/components/upload-test-form.tsx`
  - `src/lib/cafe24/oauth.ts`
  - `src/lib/cafe24/token-store.ts`
  - `supabase/schema.sql`
- 미추적 docs 파일 다수 존재
- 미추적 중첩 worktree 폴더 존재
  - `perpackage-cafe24-file-upload-app-widget-stability/`
- 미추적/기존 생성 파일
  - `src/lib/files/proof-confirmation-service.ts`

이번 작업에서 직접 정리한 파일:

- `.gitignore`
- `tsconfig.json`
- `docs/gpt-report-storage-path-build-fix-20260703.md`

기존 `storage_path` 노출 정리 작업 파일은 유지했다.

- `src/app/api/files/upload/route.ts`
- `src/components/upload-test-form.tsx`
- `src/app/admin/page.tsx`
- `docs/gpt-report-storage-path-exposure-cleanup-20260703.md`

## 3. typecheck 실패 원인

최초 실패 원인:

- `npm run typecheck`가 `.next/types/...` 파일을 찾지 못한다고 보고했다.
- 해당 파일들은 Next build 후 생성되는 타입 파일이다.

추가 확인:

- `.next/types` 파일은 build 후 실제로 생성되어 있었다.
- 병렬로 `npm run typecheck`와 `npm run build`를 실행하면, build가 `.next`를 재생성하는 중 typecheck가 `.next/types`를 읽어 충돌할 수 있다.
- 이후 build를 먼저 순차 실행하고, 그 다음 typecheck를 순차 실행하자 통과했다.

정리:

- `.next/types` 관련 오류는 실제 코드 타입 오류가 아니라 build 산출물 생성 타이밍/캐시 상태 문제였다.
- `tsconfig.tsbuildinfo`는 stale incremental cache 가능성이 있어 삭제했고, 이후 build/typecheck 과정에서 다시 생성되었다.
- `tsconfig.tsbuildinfo`는 `.gitignore` 대상이며 커밋 대상이 아니다.

## 4. build 실패 원인

최초 실패 원인:

- `npm run build`가 repo 내부 미추적 중첩 폴더까지 타입 검사했다.
- 문제 폴더:
  - `perpackage-cafe24-file-upload-app-widget-stability/`
- 해당 폴더 안의 `src/app/admin/page.tsx`가 `getProofStatusFilter`를 import했지만, 현재 `proof-confirmation-service`에는 해당 export가 없어 타입 오류가 발생했다.

근본 원인:

- 부모 프로젝트 `tsconfig.json`의 include가 `**/*.ts`, `**/*.tsx`였기 때문에, 부모 repo 안에 있는 중첩 worktree 폴더까지 타입 검사 대상에 포함되었다.

## 5. `perpackage-cafe24-file-upload-app-widget-stability/` 폴더 정체 확인 결과

확인 결과:

- 부모 repo에서 `git ls-files -- perpackage-cafe24-file-upload-app-widget-stability` 결과가 비어 있었다.
- 즉, 부모 repo의 추적 대상 파일은 아니다.
- 폴더 안에는 별도 `package.json`, `.next`, `src`, `supabase` 등이 있다.
- 폴더 안 `.git` 파일은 아래처럼 별도 worktree를 가리킨다.

```txt
gitdir: .../perpackage-cafe24-file-upload-app/.git/worktrees/perpackage-cafe24-file-upload-app-widget-stability
```

판단:

- 현재 운영 앱의 직접 소스가 아니라, 부모 repo 내부에 놓인 별도 worktree/작업 복사본이다.
- 삭제하면 안 되므로 제거하지 않고 부모 프로젝트 검사 대상에서만 제외했다.

## 6. 적용한 정리 방식

삭제하지 않고 제외 방식으로 정리했다.

### `tsconfig.json`

부모 프로젝트 타입 검사 대상에서 중첩 worktree 폴더를 제외했다.

```json
"exclude": ["node_modules", "perpackage-cafe24-file-upload-app-widget-stability"]
```

### `.gitignore`

해당 중첩 worktree 폴더가 부모 repo 미추적 항목으로 계속 보이지 않도록 추가했다.

```gitignore
perpackage-cafe24-file-upload-app-widget-stability/
```

### build cache

`tsconfig.tsbuildinfo`는 stale cache 가능성이 있어 삭제했고, build/typecheck 과정에서 다시 생성되었다.

삭제한 파일은 build cache이며 `.gitignore` 대상이다.

## 7. storage_path 정리 변경 유지 여부

유지했다.

유지된 내용:

- `POST /api/files/upload` 응답에서 `storage_provider`, `storage_path` 제거
- `/upload-test` 응답 타입에서 `storage_provider`, `storage_path` 제거
- `/admin` 파일 상세/주문번호 검색 결과 카드에서 `storage_bucket`, `storage_path` 원문 표시 제거
- `/admin`에는 `내부 저장 정보: 숨김 처리` 또는 `저장 정보 없음` 표시
- 다운로드 기능은 내부적으로 기존 `storage_bucket`, `storage_path`를 계속 사용
- signed URL 원문은 화면에 표시하지 않음

## 8. 수정 파일 목록

이번 build/typecheck 정리 작업에서 수정한 파일:

- `.gitignore`
- `tsconfig.json`
- `docs/gpt-report-storage-path-build-fix-20260703.md`

이전 storage_path 노출 정리 변경으로 유지 중인 파일:

- `src/app/api/files/upload/route.ts`
- `src/components/upload-test-form.tsx`
- `src/app/admin/page.tsx`
- `docs/gpt-report-storage-path-exposure-cleanup-20260703.md`

주의:

- `src/app/admin/page.tsx`에는 이번 storage_path 정리 변경 외에 이전 작업의 교정확인 관련 미커밋 변경도 함께 남아 있다.
- 추후 커밋 시에는 hunk 단위로 선별하거나, 관련 작업 단위별로 커밋 범위를 다시 확인해야 한다.

## 9. 삭제한 파일/폴더 목록과 이유

삭제한 폴더는 없다.

삭제한 파일:

- `tsconfig.tsbuildinfo`

이유:

- TypeScript incremental cache 파일이다.
- `.gitignore` 대상이며 커밋 대상이 아니다.
- stale cache 가능성이 있어 삭제했고, 이후 검증 과정에서 다시 생성되었다.

삭제하지 않은 항목:

- `.next/`
- `node_modules/`
- `perpackage-cafe24-file-upload-app-widget-stability/`

## 10. typecheck 결과

실행 명령:

```bash
npm run typecheck
```

결과:

- 통과

비고:

- PowerShell 기본 PATH에서는 `npm` 명령이 바로 잡히지 않아, Node.js Winget 설치 경로의 `npm.cmd` 전체 경로로 실행했다.
- build와 병렬 실행하지 않고, build 완료 후 순차 실행했을 때 정상 통과했다.

## 11. build 결과

실행 명령:

```bash
npm run build
```

결과:

- 통과

비고:

- Next.js compile, type check, page generation 모두 완료되었다.
- `/admin`은 동적 서버 렌더링으로 표시된다.
- 빌드 출력 마지막에 `cafe24_oauth_start_failed Dynamic server usage... cookies` 메시지가 보였지만, build exit code는 0이었다. 이는 해당 route가 cookies 사용으로 동적 처리된다는 Next.js 메시지이며 이번 작업의 실패 원인은 아니다.

## 12. 커밋 여부

커밋하지 않았다.

## 13. push 여부

push하지 않았다.

## 14. Vercel 배포 여부

Vercel Production 배포하지 않았다.

요청대로 커밋/push/배포 전 보고 단계에서 멈췄다.

## 15. 다음 운영 확인 항목

배포 후 운영에서 확인할 항목:

1. Cafe24 상품상세에서 파일 업로드
2. 업로드 성공 후 file_id 표시
3. Cafe24 추가 입력 옵션 `업로드 파일 ID` 자동 입력
4. `/api/files/upload` 응답에 `storage_path`, `storage_bucket`, signed URL 원문이 없는지 확인
5. `/admin` file_id 검색
6. 파일 상세에서 storage 경로 원문 대신 `내부 저장 정보: 숨김 처리` 표시 확인
7. 주문번호 검색 결과에서도 storage 경로 원문이 보이지 않는지 확인
8. 다운로드 버튼 정상 작동
9. 다운로드 로그 저장 확인

## 16. 다음 커밋 전 주의사항

현재 작업공간에는 unrelated 변경과 미추적 문서가 많다.

다음 커밋 시 포함 후보:

- `.gitignore`
- `tsconfig.json`
- `src/app/api/files/upload/route.ts`
- `src/components/upload-test-form.tsx`
- `docs/gpt-report-storage-path-exposure-cleanup-20260703.md`
- `docs/gpt-report-storage-path-build-fix-20260703.md`

`src/app/admin/page.tsx`는 storage_path 변경 외 기존 교정확인 관련 변경이 섞여 있으므로, 전체 파일을 그대로 add하지 말고 hunk 단위로 확인해야 한다.

