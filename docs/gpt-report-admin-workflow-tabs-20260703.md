# /admin 화면 업무 흐름 기준 탭 구조 정리 보고서

## 1. 작업 목적

`/admin` 화면에 기능이 길게 나열되어 있어 운영자가 원하는 업무 위치를 찾기 어려운 문제를 줄이기 위해, 기존 기능은 유지하면서 업무 흐름 기준 5개 탭 구조로 화면을 재배치했습니다.

이번 작업은 UI 구조 정리 작업이며, DB 변경, Supabase SQL 추가, API 로직 변경, Webhook 자동 연결 로직 변경, 다운로드 signed URL redirect 로직 변경은 하지 않았습니다.

## 2. 시작 전 git 상태

- 브랜치: `main`
- 로컬 HEAD: `269f75cc04993d49a6dff4c1b85fa4b1f8fa3db0`
- origin/main: `269f75cc04993d49a6dff4c1b85fa4b1f8fa3db0`
- staged 파일: 없음
- 작업트리: clean
- 기존 stash는 확인만 했고 건드리지 않았습니다.

## 3. origin/main과 로컬 HEAD 차이 여부

작업 시작 전 로컬 HEAD와 origin/main은 동일했습니다.

## 4. stash 사용 여부

stash를 새로 만들지 않았습니다.
기존 stash도 `pop` 또는 `apply` 하지 않았습니다.

## 5. 수정 파일 목록

- `src/app/admin/page.tsx`
- `src/app/globals.css`
- `src/components/ReuploadLinkCreatePanel.tsx`
- `docs/gpt-report-admin-workflow-tabs-20260703.md`

## 6. 추가한 5개 탭 구조

`/admin` 상단에 업무 흐름 탭을 추가했습니다.

- `tab=today`: 오늘 처리
- `tab=files`: 파일 찾기
- `tab=reupload`: 재업로드
- `tab=logs`: 로그 확인
- `tab=settings`: 설정

잘못된 `tab` 값이 들어오면 기본값은 `today`로 처리합니다.

## 7. 각 탭에 배치한 기능

### 오늘 처리

- 오늘 처리 안내 카드
- 확인 전 파일 바로 보기 링크
- 재업로드 완료 파일 확인 링크
- Webhook 확인 필요 로그 링크
- 최근 업로드 파일 목록
- 최근 업로드 파일 상태/주문번호 필터
- 최근 업로드 목록에서 다운로드/상태 변경

### 파일 찾기

- Cafe24 주문 조회 테스트
- 주문번호로 업로드 파일 찾기
- file_id로 업로드 파일 찾기
- 파일 상세 정보
- 주문번호 수동 연결
- 주문번호 연결 이력
- 파일 상태 변경
- 재업로드 안내문/링크 생성 영역
- 교정확인 안내문/이력
- 상태 변경 이력
- 파일 다운로드
- 파일별 다운로드 로그

### 재업로드

- 재업로드 처리 전용 file_id 검색
- 재업로드 요청 안내문
- 재업로드 링크 생성
- 재업로드 요청 이력
- 새 파일 ID 복사/상세 보기/다운로드 버튼
- 기존 파일과 새 파일 관계 안내

### 로그 확인

- Cafe24 Webhook 수신 로그
- Webhook processed_status 필터
- 전체 교정확인 이력
- 교정확인 필터
- 교정확인 CSV 다운로드
- 전체 다운로드 로그
- 다운로드 로그 필터
- 다운로드 로그 CSV 다운로드
- 다운로드 로그 새로고침 버튼

### 설정

- Cafe24 configured 상태
- Supabase configured 상태
- Naver Object Storage configured 상태
- OAuth connection status
- access token expires
- refresh token expires
- scope 목록

## 8. 기존 query와 tab query 처리 방식

- `AdminPreservedQuery`에 `tab`을 추가했습니다.
- 탭 버튼은 기존 query를 최대한 유지하면서 `tab`만 변경합니다.
- 필터 폼 submit 시 현재 탭이 유지되도록 hidden input을 추가했습니다.
- 예시:
  - `/admin?tab=today`
  - `/admin?tab=files&file_id=<file_id>`
  - `/admin?tab=logs&webhook_status=failed`
  - `/admin?tab=logs&proof_status=confirmed`

## 9. 가로 스크롤 개선 내용

- 탭 버튼은 작은 pill 형태로 줄바꿈 가능하게 배치했습니다.
- `.grid > *`, `.panel`, `.card`에 `min-width: 0`을 적용해 전체 화면이 옆으로 밀리는 문제를 줄였습니다.
- `.table-wrap`에 `max-width: 100%`를 적용해 넓은 테이블이 개별 스크롤 박스 안에서만 움직이도록 보강했습니다.

## 10. 변경하지 않은 기존 기능

아래 기능 로직은 변경하지 않았습니다.

- Webhook 자동 연결 로직
- Cafe24 Admin API 주문 조회 로직
- files.order_id 연결 정책
- 다운로드 signed URL redirect 로직
- `/api/files/download` route
- `/reupload` 고객 업로드 페이지 로직
- `file_reupload_requests` status 업데이트 로직
- Supabase DB schema
- 기존 파일 status 자동 replaced 처리
- 새 파일 status 자동 approved 처리
- 파일 삭제 기능
- Naver Object Storage 삭제 기능

## 11. 보안 기준 유지 여부

유지했습니다.

- storage_path 원문을 화면에 새로 표시하지 않았습니다.
- signed URL 원문을 화면에 표시하지 않았습니다.
- raw token, token_hash, service role key, Naver key, OAuth token을 화면/API/로그에 노출하지 않았습니다.
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

참고: 현재 셸 PATH에서는 `npm.cmd`가 바로 인식되지 않아 Codex 런타임의 `npm.cmd` 절대 경로로 동일 스크립트를 실행했습니다.

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

참고: `/api/cafe24/auth/start`의 cookies 사용으로 인한 Next.js dynamic server usage 메시지가 출력되었지만, build는 성공 종료했습니다.

## 14. 커밋 여부

커밋하지 않았습니다.

## 15. push 여부

push하지 않았습니다.

## 16. Vercel 배포 여부

Vercel Production 배포하지 않았습니다.

## 17. 운영자가 확인할 테스트 순서

1. `/admin` 접속
2. 상단에 5개 탭이 보이는지 확인
3. `오늘 처리` 탭에서 최근 업로드 파일 목록이 보이는지 확인
4. `파일 찾기` 탭에서 Cafe24 주문 조회, 주문번호 검색, file_id 검색이 되는지 확인
5. `파일 찾기` 탭에서 파일 상세, 다운로드, 상태 변경, 주문번호 연결 이력이 보이는지 확인
6. `재업로드` 탭에서 file_id 검색 후 재업로드 안내문/링크 생성/이력이 보이는지 확인
7. 재업로드 이력의 새 파일 상세 보기 버튼이 `/admin?tab=files&file_id=...`로 이동하는지 확인
8. `로그 확인` 탭에서 Webhook 로그, 다운로드 로그, 교정확인 이력이 보이는지 확인
9. Webhook/다운로드/교정확인 필터와 CSV 버튼이 유지되는지 확인
10. `설정` 탭에서 configured 상태와 OAuth 상태가 보이는지 확인
11. storage_path, signed URL, raw token, token_hash가 화면에 노출되지 않는지 확인

## 18. 배포 전 멈춘 지점

요청에 따라 typecheck/build 통과 후 커밋/push/Vercel 배포 전 단계에서 멈췄습니다.
