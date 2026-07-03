# storage_path 노출 정리 커밋 준비 보고서

## 1. 작업 목적

고객-facing 업로드 응답과 `/admin` 일반 운영 화면에서 내부 저장 경로인 `storage_path`, `storage_bucket`, `storage_provider`가 불필요하게 노출되는 부분을 정리한 변경만 선별해 커밋 준비했다.

이번 커밋은 보안/표시 정리와 typecheck/build 환경 정리만 포함한다.

## 2. 최종 staged 파일 목록

커밋 직전 아래 파일만 staged 대상으로 선별한다.

- `.gitignore`
- `tsconfig.json`
- `src/app/api/files/upload/route.ts`
- `src/components/upload-test-form.tsx`
- `src/app/admin/page.tsx`
- `docs/gpt-report-storage-path-exposure-cleanup-20260703.md`
- `docs/gpt-report-storage-path-build-fix-20260703.md`
- `docs/gpt-report-storage-path-commit-ready-20260703.md`

## 3. 커밋에 포함한 변경 내용

- 업로드 API 응답에서 고객 화면에 필요 없는 내부 저장 정보 제거
  - `storage_provider` 제거
  - `storage_path` 제거
  - 응답에는 `id`, `original_filename`, `file_size`, `mime_type`, `status`, `created_at` 중심으로 유지
- 업로드 테스트 폼의 응답 타입을 변경된 업로드 API 응답에 맞게 정리
- `/admin` 화면에서 `storage_bucket`, `storage_path` 원문 표시 제거
  - 기본 화면에는 `내부 저장 정보: 숨김 처리` 또는 `저장 정보 없음`으로 표시
  - 다운로드 가능 여부 판단에는 기존 저장 정보 사용 유지
- 중첩 worktree/복사본이 typecheck/build 대상에 포함되지 않도록 제외
  - `.gitignore`에 `perpackage-cafe24-file-upload-app-widget-stability/` 추가
  - `tsconfig.json` exclude에 동일 폴더 추가

## 4. 커밋에서 제외한 변경 내용

- 이번 작업과 무관한 README 변경
- Cafe24 OAuth 관련 변경
- Webhook 관련 변경
- 교정확인 관련 미커밋 변경
- 재업로드 링크 Phase 3 관련 변경
- `supabase/schema.sql`의 무관 변경
- `.next`, `node_modules`, `tsconfig.tsbuildinfo`, build 산출물
- `perpackage-cafe24-file-upload-app-widget-stability/` 중첩 worktree/복사본
- 기타 미추적 docs 파일

## 5. `src/app/admin/page.tsx` hunk 선별 여부

`src/app/admin/page.tsx`에는 storage_path 정리와 무관한 교정확인 관련 변경이 섞여 있어 전체 파일을 `git add` 하지 않는다.

staged 대상은 아래 hunk로 제한한다.

- `getInternalStorageDisplay(file)` helper 추가
- 주문번호 검색 결과 카드에서 `storage_bucket`, `storage_path` 원문 표시 제거
- file_id 상세 카드에서 `storage_bucket`, `storage_path` 원문 표시 제거

교정확인 이력, proof action, proof confirmation import/action/UI 관련 변경은 이번 커밋에서 제외한다.

## 6. typecheck 결과

통과.

```bash
npm run typecheck
```

결과:

```txt
tsc --noEmit
```

## 7. build 결과

통과.

```bash
npm run build
```

결과:

```txt
Compiled successfully
Linting and checking validity of types ...
Generating static pages (11/11)
```

참고: 빌드 중 `/api/cafe24/auth/start`의 `cookies` 사용으로 인한 dynamic server usage 메시지가 표시되었지만, `next build`는 exit code 0으로 완료되었다.

## 8. 커밋 해시

커밋 생성 후 최종 응답에서 정확한 커밋 해시를 보고한다.

## 9. push 여부

이번 요청 범위에서는 push하지 않는다.

## 10. Vercel 배포 여부

이번 요청 범위에서는 Vercel Production 배포를 진행하지 않는다.

## 11. 다음 운영 확인 항목

1. Cafe24 상품상세에서 파일 1개 업로드가 정상인지 확인
2. 업로드 후 고객 위젯에 file_id가 정상 표시되는지 확인
3. Cafe24 추가 입력 옵션 `업로드 파일 ID`에 file_id가 자동 입력되는지 확인
4. `/admin`에서 file_id 검색이 정상인지 확인
5. `/admin`에서 주문번호 검색이 정상인지 확인
6. 파일 다운로드 버튼이 기존처럼 작동하는지 확인
7. 고객-facing 응답과 `/admin` 일반 화면에 `storage_path` 원문이 표시되지 않는지 확인
