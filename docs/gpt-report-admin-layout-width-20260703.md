# /admin 탭 화면 콘텐츠 폭 및 테이블 가독성 개선 보고서

## 1. 작업 목적

`/admin` 화면이 5개 탭 구조로 정리된 뒤, 최근 업로드 파일 테이블이 좁은 콘텐츠 폭 안에 표시되어 상태 변경 영역을 확인하기 어려운 문제가 있었습니다.

이번 작업은 `/admin` 운영 화면의 콘텐츠 폭과 테이블 가독성을 개선하는 작업입니다. 기능 로직, API, DB, Webhook, 다운로드 route는 변경하지 않았습니다.

## 2. 시작 전 git 상태

- 브랜치: `main`
- 시작 전 HEAD: `fcc47f0ebd420b4c28080ba3318fca473fdd0134`
- 시작 전 origin/main: `fcc47f0ebd420b4c28080ba3318fca473fdd0134`
- `git fetch origin` 후 차이: `0 0`
- staged 파일: 없음
- 작업트리: clean

## 3. origin/main과 로컬 HEAD 차이 여부

작업 시작 전 `HEAD`와 `origin/main`은 동일했습니다.

## 4. stash 사용 여부

stash를 새로 만들지 않았습니다.
기존 stash도 `pop` 또는 `apply` 하지 않았습니다.

유지 중인 기존 stash:

- `stash@{0}: pre-download-log-refresh-report-doc-20260703`
- `stash@{1}: pre-storage-path-reapply-unrelated-20260703`

## 5. 수정 파일 목록

- `src/app/admin/page.tsx`
- `src/app/globals.css`
- `docs/gpt-report-admin-layout-width-20260703.md`

## 6. 콘텐츠 폭 개선 내용

`.app-shell`의 최대 폭을 기존 `1120px`에서 `1520px`로 확장했습니다.

변경 전:

```css
width: min(1120px, calc(100% - 32px));
```

변경 후:

```css
width: min(1520px, calc(100% - 32px));
```

큰 화면에서는 `/admin` 콘텐츠가 더 넓게 보이고, 작은 화면에서는 기존처럼 `calc(100% - 32px)` 기준으로 반응형을 유지합니다.

## 7. 테이블 스크롤 정책 개선 내용

- `.table-wrap`의 `max-width: 100%`는 유지했습니다.
- `.table-wrap`에 `overscroll-behavior-inline: contain`을 추가해 테이블 내부 가로 스크롤이 화면 전체 스크롤로 번지는 현상을 줄였습니다.
- 전체 `table` 기본 `min-width`를 `1180px`에서 `1120px`로 낮춰 일반 테이블이 불필요하게 과도한 폭을 요구하지 않게 조정했습니다.
- 넓은 테이블은 여전히 `.table-wrap` 내부에서만 가로 스크롤됩니다.

## 8. 최근 업로드 파일 테이블 개선 내용

최근 업로드 파일 테이블에 전용 class를 추가했습니다.

```tsx
<div className="table-wrap recent-files-table-wrap">
```

전용 CSS로 아래를 조정했습니다.

- 최근 업로드 테이블 전용 `min-width: 1320px`
- 셀 padding을 `10px`로 조정
- 파일명, file_id 컬럼 최소 폭 확보
- 상태, 다운로드 버튼 컬럼은 줄바꿈 없이 표시
- 상태 변경 컬럼은 `190px` 기준으로 정리
- compact 상태 변경 폼은 `180px` 폭으로 고정해 테이블 전체 폭을 과도하게 밀지 않도록 조정

## 9. 탭 구조 유지 여부

유지했습니다.

- `오늘 처리`
- `파일 찾기`
- `재업로드`
- `로그 확인`
- `설정`

`tab=today|files|reupload|logs|settings` query 구조도 변경하지 않았습니다.

## 10. 변경하지 않은 기존 기능

아래 기능은 변경하지 않았습니다.

- Webhook 자동 연결 로직
- Cafe24 Admin API 주문 조회 로직
- files.order_id 연결 정책
- 다운로드 signed URL redirect 로직
- `/api/files/download` route
- `/reupload` 고객 업로드 페이지 로직
- `file_reupload_requests` status 업데이트 로직
- Supabase SQL/DB schema
- 기존 파일 status 자동 replaced 처리
- 새 파일 status 자동 approved 처리
- 파일 삭제 기능
- Naver Object Storage 삭제 기능

## 11. 보안 기준 유지 여부

유지했습니다.

- storage_path 원문을 화면에 새로 표시하지 않았습니다.
- signed URL 원문을 표시하지 않았습니다.
- raw token, token_hash, service role key, Naver key, OAuth token을 노출하지 않았습니다.
- Webhook raw payload 전체를 표시하지 않았습니다.

## 12. typecheck 결과

통과했습니다.

실행:

```powershell
C:\Users\inh78\AppData\Local\OpenAI\Codex\runtimes\cua_node\1b23c930bdf84ed6\bin\npm.cmd run typecheck
```

결과:

```txt
tsc --noEmit
```

오류 없음.

## 13. build 결과

통과했습니다.

실행:

```powershell
C:\Users\inh78\AppData\Local\OpenAI\Codex\runtimes\cua_node\1b23c930bdf84ed6\bin\npm.cmd run build
```

결과:

```txt
Compiled successfully
Generating static pages (14/14)
```

참고: 기존과 동일하게 `/api/cafe24/auth/start`의 cookies 사용 관련 dynamic server usage 메시지가 출력되었지만 build는 성공했습니다.

## 14. 커밋 여부

커밋하지 않았습니다.

## 15. push 여부

push하지 않았습니다.

## 16. Vercel 배포 여부

Vercel Production 배포하지 않았습니다.

## 17. 운영자가 확인할 테스트 순서

1. `/admin?tab=today` 접속
2. 최근 업로드 파일 테이블이 이전보다 넓게 보이는지 확인
3. 상태 변경 영역이 오른쪽에 과도하게 숨어 있지 않은지 확인
4. 테이블이 필요한 경우 `.table-wrap` 내부에서만 가로 스크롤되는지 확인
5. body 전체에 불필요한 가로 스크롤이 생기지 않는지 확인
6. `/admin?tab=files`에서 주문번호 검색/file_id 검색 화면이 깨지지 않는지 확인
7. `/admin?tab=reupload`에서 재업로드 영역이 깨지지 않는지 확인
8. `/admin?tab=logs`에서 Webhook/다운로드/교정확인 로그 테이블이 정상 표시되는지 확인
9. `/admin?tab=settings`에서 설정 카드가 정상 표시되는지 확인
10. storage_path/signed URL/raw token/token_hash 원문이 화면에 보이지 않는지 확인

## 18. 배포 전 멈춘 지점

요청에 따라 typecheck/build 통과 후 커밋/push/Vercel 배포 전 단계에서 멈췄습니다.
