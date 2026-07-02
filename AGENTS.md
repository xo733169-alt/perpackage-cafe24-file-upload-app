# PerPackage Cafe24 File Upload App - Codex 작업 기준

## 1. 프로젝트 목적

이 프로젝트는 페르패키지 Cafe24 상품상세 파일 업로드 앱이다.

- Cafe24 상품상세에서 고객이 인쇄용 파일을 업로드한다.
- 파일은 Naver Object Storage에 저장한다.
- 파일 메타데이터는 Supabase `files` 테이블에 저장한다.
- 업로드 성공 시 생성된 `file_id`를 Cafe24 주문 옵션/추가입력 옵션에 저장한다.
- Cafe24 Webhook과 Admin API로 주문번호와 파일을 연결한다.
- `/admin`에서 내부 운영자가 파일 검색, 다운로드, 상태 변경, 로그 확인을 수행한다.

## 2. 핵심 운영 원칙

- Webhook 자동화는 `files.order_id` 연결까지만 담당한다.
- 파일 검수 상태는 사람이 `/admin`에서 직접 변경한다.
- Webhook이 들어왔다고 파일 상태를 자동으로 `approved`로 바꾸면 안 된다.
- 고객 확인 완료나 교정확인 완료가 되어도 `files.status`를 자동 변경하지 않는다.
- 다른 주문번호가 이미 연결된 파일은 자동으로 덮어쓰지 않는다.
- 자동화가 실패해도 수동 연결과 반자동 연결로 복구할 수 있어야 한다.
- 파일 삭제와 Naver Object Storage 삭제 기능은 별도 지시 전까지 만들지 않는다.

## 3. 절대 변경 금지 또는 특별 주의 영역

명시적인 지시 없이는 아래 영역을 변경하지 않는다.

- Cafe24 Webhook 자동 연결 로직
- `files.order_id` 덮어쓰기 정책
- `already_linked` 처리
- `conflict_order_id` 처리
- Cafe24 Admin API 주문 조회 로직
- 파일 다운로드 signed URL 생성/보안 로직
- Naver Object Storage 삭제 관련 로직
- Supabase service role key 사용 방식
- Cafe24 OAuth token 저장/갱신 방식
- 기존 `/admin` 검색, 다운로드, 상태 변경, 로그 기능

## 4. 보안 기준

아래 민감정보는 화면, 로그, API 응답, 보고서, 문서, 콘솔에 원문 노출하지 않는다.

- `access_token`
- `refresh_token`
- `authorization`
- `bearer`
- `token`
- `client_secret`
- `secret`
- `signature`
- `password`
- `cookie`
- `x-api-key`
- `api-key`
- `api_key`
- Supabase service role key
- Naver Object Storage access key
- Naver Object Storage secret key
- signed URL 원문
- Webhook raw payload 전체
- JWT 문자열
- storage path 원문이 고객에게 노출되는 상황

추가 기준:

- `/admin`에는 raw payload 전체를 표시하지 않는다.
- 고객 안내문에는 signed URL, storage path, token, API key를 넣지 않는다.
- 고객 회신 메모에는 개인정보를 최소한으로 요약해 저장한다.

## 5. DB 변경 기준

- DB 테이블/컬럼 추가가 있는 작업은 Production 배포 전에 반드시 멈춰 보고한다.
- Supabase SQL은 운영 DB에 자동 실행하지 않는다.
- 보고서에 SQL을 제공하고, 사용자가 SQL Editor에서 실행한 뒤 다음 단계로 진행한다.
- `drop table`, `delete from`, `truncate`, `drop column`, `alter column type` 같은 위험 SQL은 별도 확인 없이 실행하지 않는다.
- `create table if not exists`, `create index if not exists` 방식을 기본으로 검토한다.
- foreign key를 만들 때는 참조 컬럼 타입을 반드시 확인한다.
- 예: `files.id`가 uuid이면 관련 `file_id`도 uuid여야 한다.
- DB 변경이 없는 UI/문구 작업은 추가 SQL이 없어야 한다.

## 6. Git 작업 기준

- 작업공간에는 unrelated 변경 파일이나 미추적 docs가 남아 있을 수 있다.
- 항상 이번 작업 관련 파일만 `git add` 한다.
- 무관한 파일은 커밋하지 않는다.
- 커밋 전 `git diff`와 `git status`를 확인한다.
- 보고서 파일도 이번 작업 관련일 때만 커밋한다.
- 커밋 메시지는 작업 내용을 명확히 표현한다.

## 7. 배포 기준

- DB 변경이 있는 작업은 SQL 적용 전 push/Production 배포하지 않는다.
- DB 변경이 없는 작업도 기본적으로 typecheck/build 후 보고한다.
- 사용자가 "배포 진행"을 승인한 뒤 push/배포한다.
- push가 Vercel Production 자동 배포를 유발할 수 있으므로 push 전 보고 기준을 따른다.
- 배포 후 Vercel `READY` 상태와 커밋 해시를 보고한다.

## 8. 검증 기준

작업 후 가능한 경우 아래를 확인한다.

- `npm run typecheck`
- `npm run build`
- 기존 `/admin` 접속 가능 여부
- 기존 파일 검색 기능 유지
- 주문번호 검색 기능 유지
- 파일 다운로드 기능 유지
- 상태 변경 기능 유지
- Webhook 로그 필터 유지
- 새 기능이 기존 상태/주문번호 연결 정책을 깨지 않는지

문서만 추가하는 작업은 typecheck/build를 생략할 수 있다. 생략 시 보고에 사유를 남긴다.

## 9. 현재 주요 테이블

- `files`: 업로드 파일 메타데이터, 주문번호 연결, 파일 상태를 저장한다.
- `file_download_logs`: 관리자 파일 다운로드 이력을 저장한다.
- `file_status_change_logs`: 파일 상태 변경 이력을 저장한다.
- `file_order_link_logs`: 주문번호 수동/자동/반자동 연결 이력을 저장한다.
- `file_proof_confirmations`: 교정확인 요청, 고객 확인 완료, 수정 요청, 취소 이력을 저장한다.
- `cafe24_webhook_events`: Cafe24 Webhook 수신 payload 요약과 처리 상태를 저장한다.
- `cafe24_tokens`: Cafe24 OAuth token 저장 구조에 사용될 수 있는 토큰 테이블이다.
- `cafe24_installations`: Cafe24 앱 설치, mall_id, shop_no, OAuth 연결 상태를 저장한다.

## 10. 현재 주요 상태값

### `files.status`

- `uploaded_pending`: 업로드됨 / 확인 전
- `reviewing`: 파일 확인 중
- `approved`: 파일 확인 완료
- `need_reupload`: 재업로드 요청
- `replaced`: 새 파일로 교체됨
- `archived`: 보관 처리

주의: 파일 상태는 자동으로 바꾸지 말고 관리자가 직접 변경한다.

### `cafe24_webhook_events.processed_status`

- `received`: 수신됨
- `auto_linked`: 자동 연결 완료
- `already_linked`: 이미 연결됨
- `no_order_id`: 주문번호 없음
- `no_file_id`: 업로드 파일 ID 없음
- `file_not_found`: 업로드 파일 없음
- `conflict_order_id`: 다른 주문번호 연결됨
- `failed`: 처리 실패

### `file_proof_confirmations.proof_status`

- `requested`: 교정확인 요청
- `confirmed`: 고객 확인 완료
- `rejected`: 고객 수정 요청
- `canceled`: 요청 취소
- `skipped`: 교정확인 생략

## 11. 기능 개발 순서 원칙

앞으로 기능은 아래 순서를 따른다.

1. 설계 문서
2. DB 필요 여부 판단
3. DB 변경이 있으면 SQL 작성 후 사용자 확인
4. 백엔드 저장/조회 로직
5. `/admin` UI
6. typecheck/build
7. 보고서 작성
8. 사용자 확인 후 push/배포
9. 운영 화면 검수

## 12. 보고서 작성 기준

작업 완료 보고에는 아래를 포함한다.

- 작업 목적
- 수정 파일 목록
- 주요 변경 내용
- DB 변경 여부
- 추가 SQL 필요 여부
- 변경하지 않은 기존 기능
- 보안 기준 유지 여부
- typecheck 결과
- build 결과
- 커밋 해시
- push 여부
- Vercel 배포 여부
- 운영자가 확인할 화면
- 다음 추천 작업

