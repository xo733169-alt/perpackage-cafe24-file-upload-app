# 고객용 재업로드 링크 Phase 5 관리자 처리 편의 개선 보고서

## 1. 작업 목적

고객이 재업로드한 새 파일을 `/admin` 파일 상세 화면에서 관리자가 더 쉽게 확인하고 처리할 수 있도록 재업로드 요청 이력 UI를 개선했습니다.

## 2. 시작 전 git 상태

- 브랜치: `main`
- 시작 전 HEAD: `26980b08d74913bc6494b58d061ccefa9385e889`
- 시작 전 origin/main: `26980b08d74913bc6494b58d061ccefa9385e889`
- `git fetch origin` 후 `HEAD...origin/main`: `0 0`
- 작업 시작 전 worktree: clean
- staged 파일: 없음

## 3. origin/main과 로컬 HEAD 차이 여부

차이 없었습니다. origin/main이 로컬보다 앞서 있지 않은 것을 확인한 뒤 작업했습니다.

## 4. stash 사용 여부

stash는 사용하지 않았고, 기존 stash도 건드리지 않았습니다.

- `stash@{0}: On main: pre-download-log-refresh-report-doc-20260703`
- `stash@{1}: On main: pre-storage-path-reapply-unrelated-20260703`

## 5. 수정 파일 목록

- `src/app/admin/page.tsx`
- `src/components/ReuploadLinkCreatePanel.tsx`
- `src/lib/files/reupload-request-service.ts`
- `docs/gpt-report-reupload-admin-followup-20260703.md`

## 6. 재업로드 요청 이력 개선 내용

- 재업로드 요청 이력 상태를 한글 배지로 표시했습니다.
- 표시 상태:
  - `requested`: 재업로드 요청
  - `uploaded`: 재업로드 완료
  - `reviewing`: 확인 중
  - `completed`: 처리 완료
  - `expired`: 만료됨
  - `canceled`: 취소됨
  - `failed`: 실패
- 이력 표에 요청일시, 상태, 사유, 만료일시, 사용일시, 새 파일 ID, 새 파일 처리, 생성자를 표시합니다.

## 7. 새 파일 ID 복사/상세 보기/다운로드 버튼 구현 여부

구현했습니다. `new_file_id`가 있는 재업로드 이력에는 아래 버튼이 표시됩니다.

- 새 파일 ID 복사
- 새 파일 상세 보기: `/admin?file_id=<new_file_id>`
- 새 파일 다운로드: `/api/files/download?file_id=<new_file_id>`

다운로드는 기존 다운로드 route를 그대로 사용합니다.

## 8. 기존 파일과 새 파일 관계 표시 방식

원본 파일 상세 화면에서 `uploaded` 상태이고 `new_file_id`가 있는 재업로드 요청이 있으면 안내문을 표시합니다.

안내 내용:

- 재업로드 요청을 통해 새 파일이 등록됨
- 새 파일은 별도 파일로 저장됨
- 기존 파일은 자동 삭제/자동 교체되지 않음
- 새 파일 확인 후 관리자가 직접 새 파일 상태를 변경해야 함
- 기존 파일 교체 처리는 관리자가 직접 기존 파일 상태를 “새 파일로 교체됨”으로 변경해야 함

## 9. 새 파일 상세 화면에서 원본 파일 정보 표시 여부

구현했습니다.

`file_reupload_requests.new_file_id` 기준으로 재업로드 요청을 조회하는 함수를 추가했고, 새 파일 상세 화면에서 아래 정보를 표시합니다.

- 이 파일이 재업로드 링크로 등록된 파일이라는 안내
- 원본 파일 ID
- 주문번호
- 사유
- 원본 파일 상세 보기 버튼

## 10. 자동으로 변경하지 않은 항목

- 기존 파일 status를 자동 `replaced`로 변경하지 않음
- 새 파일 status를 자동 `approved`로 변경하지 않음
- 기존 파일 삭제 없음
- Naver Object Storage 기존 파일 삭제 없음
- 새 파일을 기존 파일에 덮어쓰기 없음
- 자동 이메일/카카오/채널톡 발송 없음

## 11. 변경하지 않은 기존 기능

- `/reupload` 고객 업로드 페이지
- `POST /api/reupload/upload`
- `file_reupload_requests` status 업데이트 로직
- Naver Object Storage 업로드 로직
- Supabase `files` 저장 로직
- Webhook 자동 연결 로직
- Cafe24 주문 조회 로직
- 다운로드 signed URL redirect 로직
- 다운로드 로그 자동 갱신 기능
- 파일 상태 변경 기능
- 교정확인 안내문/이력 기능
- 기존 재업로드 링크 생성 기능

## 12. 보안 기준 유지 여부

유지했습니다.

- `storage_path` 원문 화면 표시 없음
- signed URL 원문 화면 표시 없음
- raw token 화면/API/로그 표시 추가 없음
- token_hash 화면/API 표시 추가 없음
- service role key, Naver key, OAuth token 표시 없음
- Webhook raw payload 전체 표시 없음

## 13. typecheck 결과

통과했습니다.

```txt
npm.cmd run typecheck
tsc --noEmit
exit code 0
```

## 14. build 결과

통과했습니다.

```txt
npm.cmd run build
next build
exit code 0
```

참고: build 출력 끝에 기존 Cafe24 OAuth start route의 dynamic server usage 로그가 표시되었지만, build 자체는 exit code 0으로 성공했습니다.

## 15. 커밋 여부

아직 커밋하지 않았습니다.

## 16. push 여부

push하지 않았습니다.

## 17. Vercel 배포 여부

Vercel Production 배포하지 않았습니다.

## 18. 운영자가 확인할 테스트 순서

1. `/admin`에서 원본 file_id로 파일 상세를 검색합니다.
2. 재업로드 요청 이력 섹션을 확인합니다.
3. `uploaded` 상태가 “재업로드 완료” 한글 배지로 표시되는지 확인합니다.
4. `new_file_id`가 있는 이력에 새 파일 ID 복사 버튼이 보이는지 확인합니다.
5. “새 파일 상세 보기” 버튼이 `/admin?file_id=<new_file_id>`로 이동하는지 확인합니다.
6. “새 파일 다운로드” 버튼으로 파일 다운로드가 되는지 확인합니다.
7. 원본 파일 상세에서 기존 파일/새 파일 관계 안내문이 보이는지 확인합니다.
8. 새 파일 상세 화면에서 원본 파일 ID와 원본 파일 상세 보기 버튼이 보이는지 확인합니다.
9. 기존 파일 상태가 자동으로 `replaced` 처리되지 않았는지 확인합니다.
10. 새 파일 상태가 자동으로 `approved` 처리되지 않았는지 확인합니다.

## 19. 배포 전 멈춘 지점

요청대로 typecheck/build 검증과 보고서 작성까지 완료했고, 커밋/push/Vercel 배포 전 단계에서 멈췄습니다.
