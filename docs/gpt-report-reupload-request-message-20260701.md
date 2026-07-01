# 재업로드 요청 안내문 생성 및 복사 기능 보고서

## 1. 작업 목적

관리자가 `/admin?file_id=<file_id>` 파일 상세 화면에서 고객에게 전달할 재업로드 요청 안내문을 바로 생성하고 복사할 수 있도록 관리자 보조 기능을 추가했습니다.

이번 작업은 관리자 편의 기능입니다.
고객용 재업로드 링크 생성, 이메일/카카오톡 자동 발송, 파일 자동 교체, 파일 삭제, Webhook 자동 연결 정책 변경은 포함하지 않았습니다.

## 2. 수정한 파일 목록

```txt
src/app/admin/page.tsx
src/components/ReuploadRequestMessagePanel.tsx
docs/gpt-report-reupload-request-message-20260701.md
```

## 3. 주요 변경 내용

`/admin?file_id=<file_id>` 검색 결과 영역에 아래 섹션을 추가했습니다.

```txt
재업로드 요청 안내문
```

표시 위치:

```txt
파일 상태 변경 영역 아래
상태 변경 이력 위
```

표시 조건:

```txt
파일 정보가 조회된 경우 항상 표시
status = need_reupload이면 재업로드 요청 상태 배지 표시
```

## 4. 안내문 생성 방식

새 클라이언트 컴포넌트:

```txt
src/components/ReuploadRequestMessagePanel.tsx
```

안내문에 자동 반영되는 값:

- 주문번호: `files.order_id`, 없으면 `미연결`
- 파일명: `files.original_filename`
- 업로드 파일 ID: `files.id`
- 재업로드 요청 사유: 관리자가 화면에서 입력한 값

기본 안내문:

```txt
안녕하세요. 페르패키지입니다.

업로드해주신 인쇄 파일 확인 중 추가 확인이 필요한 부분이 있어 연락드립니다.

주문번호: {order_id 또는 미연결}
파일명: {original_filename}
업로드 파일 ID: {file_id}

확인 필요 사항: {관리자 입력 사유}

번거로우시겠지만 수정된 인쇄 파일을 다시 업로드해 주시면 확인 후 제작 진행 도와드리겠습니다.

수정 파일 업로드 후 다시 말씀 주시면 빠르게 확인하겠습니다.

감사합니다.
```

사유 입력값이 없으면 `확인 필요 사항` 줄은 안내문에 포함하지 않습니다.

## 5. 복사 기능 구현 방식

`navigator.clipboard.writeText()`를 사용해 안내문 전체를 클립보드에 복사합니다.

동작:

- 성공 시: `복사되었습니다.`
- 실패 시: `복사에 실패했습니다. 안내문을 직접 선택해 복사해 주세요.`

브라우저 클립보드 API가 제한되는 상황을 대비해 안내문은 읽기 전용 textarea로 표시하여 직접 선택/복사할 수 있게 했습니다.

## 6. 변경하지 않은 기존 기능

아래 기능은 변경하지 않았습니다.

- Cafe24 상품상세 파일 업로드
- Naver Object Storage 저장
- Supabase `files` 저장
- Cafe24 주문 옵션에 `file_id` 입력
- Cafe24 Webhook 수신 API
- Webhook 기반 `files.order_id` 자동 연결
- `already_linked` 처리
- `conflict_order_id` 처리
- Cafe24 주문 조회 테스트
- Cafe24 주문 조회 기반 반자동 연결
- 주문번호 수동 연결
- `file_order_link_logs` 저장
- 파일 다운로드
- 다운로드 로그 저장
- 파일 상태 변경
- `file_status_change_logs` 저장
- 주문번호 연결 이력 표시
- Webhook 로그 필터
- 최근 업로드 파일 목록
- 전체 다운로드 로그/CSV

## 7. 보안 기준 유지 여부

안내문에는 아래 정보만 포함합니다.

- 주문번호
- 파일명
- 업로드 파일 ID
- 관리자가 입력한 재업로드 요청 사유

아래 민감정보는 화면, 로그, DB, API 응답, 보고서에 포함하지 않았습니다.

- access token
- refresh token
- authorization
- bearer token
- client secret
- webhook secret
- Supabase service role key
- Naver Object Storage access key
- Naver Object Storage secret key
- signed URL 원문
- JWT 원문
- Webhook raw payload 전체
- storage path

## 8. DB 변경 또는 추가 SQL 필요 여부

DB 변경은 없습니다.

재업로드 요청 사유는 이번 단계에서 DB에 저장하지 않습니다.
브라우저 화면에서 안내문 생성용으로만 사용합니다.

## 9. 검증 결과

작업 완료 후 아래 명령을 실행했습니다.

```bash
npm run typecheck
npm run build
```

결과:

```txt
typecheck: 통과
build: 통과
```

## 10. 커밋/Push/Vercel 배포 상태

보고서 작성 시점 기준:

```txt
commit: 로컬 커밋 완료. 최종 커밋 해시는 채팅 최종 보고 기준으로 확인
push: 하지 않음
Vercel 배포: 하지 않음
```

지시서 기준으로 push가 Production 자동 배포를 유발할 수 있으므로 push 전 단계에서 멈춰야 합니다.

## 11. 운영자가 `/admin`에서 확인해야 할 테스트 순서

1. `/admin` 로그인
2. file_id 검색
3. 파일 상세 영역에 `재업로드 요청 안내문` 섹션 표시 확인
4. 주문번호, 파일명, 업로드 파일 ID가 안내문에 반영되는지 확인
5. 재업로드 요청 사유 입력
6. 입력한 사유가 `확인 필요 사항`으로 안내문에 반영되는지 확인
7. `안내문 복사` 버튼 클릭
8. `복사되었습니다.` 피드백 확인
9. textarea 직접 선택/복사가 가능한지 확인
10. 파일 상태 변경 기능 유지 확인
11. 상태 변경 이력 유지 확인
12. 주문번호 연결 이력 유지 확인
13. 파일 다운로드 버튼 유지 확인
14. Webhook 로그 필터 유지 확인

## 12. 다음 작업 추천

1. 운영자가 실제 고객 응대 문구로 충분한지 확인
2. 자주 쓰는 재업로드 사유 프리셋 추가 여부 검토
3. 고객용 재업로드 링크 생성은 별도 단계로 설계
4. 자동 이메일/카카오톡 발송은 별도 보안/운영 정책 확정 후 진행
5. 새 파일 업로드 시 기존 파일을 자동 `replaced` 처리할지 별도 설계
