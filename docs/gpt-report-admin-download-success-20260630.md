# GPT 보고서: Cafe24 파일 업로드 앱 관리자 다운로드 성공

## 1. 작업 목적

Cafe24 상품상세에서 업로드한 파일이 주문 흐름에 `file_id`로 연결되고, 관리자가 `/admin`에서 해당 `file_id`로 파일 정보를 조회한 뒤 원본 파일명 기준으로 다운로드할 수 있는지 최종 성공 상태를 정리합니다.

이번 보고서는 기능 코드 수정 없이 현재 성공 상태를 기록하기 위한 문서입니다.

## 2. 성공한 전체 흐름

1. 고객이 Cafe24 상품상세에서 파일을 업로드합니다.
2. 파일은 Vercel 앱의 `/api/files/upload`로 전송됩니다.
3. 실제 파일은 Naver Object Storage에 저장됩니다.
4. 파일 메타데이터는 Supabase `files` 테이블에 저장됩니다.
5. 업로드 성공 후 생성된 `file_id`가 Cafe24 추가 입력 옵션 `업로드 파일 ID`에 자동 입력됩니다.
6. 고객이 장바구니와 주문을 진행합니다.
7. 장바구니, 주문완료, 주문내역, Cafe24 관리자 주문상세에 `file_id`가 표시됩니다.
8. 관리자는 Cafe24 관리자 주문상세에서 `업로드 파일 ID` 값을 복사합니다.
9. `/admin`에서 `file_id`를 검색합니다.
10. Supabase `files` row 정보가 표시됩니다.
11. `파일 다운로드` 버튼을 클릭합니다.
12. 서버가 Naver Object Storage signed URL을 생성합니다.
13. 다운로드가 진행되며, 저장 파일명은 `files.original_filename` 기준으로 내려옵니다.

## 3. 확인한 기능

### Cafe24 상품상세 업로드

- 상품상세 업로드 위젯 로드 성공
- 파일 업로드 성공
- Supabase `files` row 생성 확인
- Naver Object Storage 실제 파일 저장 확인

### Cafe24 주문 연결

- 업로드 후 `file_id` 생성 성공
- `file_id`가 Cafe24 추가 입력 옵션 `업로드 파일 ID`에 자동 입력됨
- 장바구니에 `업로드 파일 ID` 표시 확인
- 주문완료 화면에 `업로드 파일 ID` 표시 확인
- 주문내역에 `업로드 파일 ID` 표시 확인
- Cafe24 관리자 주문상세에 `업로드 파일 ID` 표시 확인

### 관리자 조회

- `/admin`에서 `file_id` 검색 가능
- 검색 결과에 파일 메타데이터 표시
- `original_filename`, `mall_id`, `product_no`, `file_size`, `mime_type`, `storage_bucket`, `storage_path`, `status`, `created_at`, `updated_at` 확인 가능

### 관리자 다운로드

- 검색 결과에 `파일 다운로드` 버튼 표시
- `/api/files/download?file_id=<id>` 호출 성공
- 서버에서 Supabase `files` row 조회
- Naver Object Storage signed URL 생성
- 302 redirect 방식으로 다운로드
- 다운로드 파일명이 `original_filename` 기준으로 저장됨
- 확인 예시: `900x600.ai`

## 4. 현재 구조 요약

### 파일 저장

- 저장소: Naver Object Storage
- 내부 저장 경로: `storage_path`
- 내부 저장 파일명: 충돌 방지를 위한 고유 파일명 유지
- 고객 원본 파일명: Supabase `files.original_filename`에 저장

### 다운로드

- public 영구 URL 사용 안 함
- 서버 route handler 경유
- signed URL 유효기간은 짧게 유지
- Content-Disposition에서 `original_filename` 다운로드명 적용

## 5. 보안 기준

아래 값은 화면, API 응답, 로그, 문서에 원문으로 노출하지 않았습니다.

- Naver Object Storage access key
- Naver Object Storage secret key
- Supabase service role key
- Cafe24 access token
- Cafe24 refresh token
- Cafe24 client secret
- Authorization header value
- 실제 환경변수 값

## 6. 남은 한계

1. `/admin` 접근 보호가 아직 운영 수준으로 강하지 않을 수 있습니다.
2. `/api/files/download` route에도 관리자 인증 재검증을 추가하는 것이 필요합니다.
3. Supabase `files.order_id`는 아직 Cafe24 주문번호와 자동 연결되지 않았습니다.
4. 다운로드 이력 로그는 아직 저장하지 않습니다.
5. Cafe24 Webhook 기반 주문 자동 연결은 아직 다음 단계입니다.
6. ScriptTags API를 통한 운영몰 전체 자동 삽입은 아직 하지 않았습니다.
7. 대용량 multipart upload 또는 100MB 이상 업로드는 아직 구현하지 않았습니다.

## 7. 이번 단계에서 하지 않은 것

- 파일 삭제
- Supabase row 삭제
- Cafe24 Webhook 주문 자동 연결
- Cafe24 Admin API 주문 조회
- `files.order_id` 자동 업데이트
- ScriptTags API 실제 등록
- presigned upload
- multipart upload
- 100MB 대용량 업로드
- 사용자 로그인/권한 시스템 전체 구현

## 8. 운영 전 필수 확인

운영 적용 전 아래 항목을 확인해야 합니다.

1. `/admin` 관리자 접근 보호
2. `/api/files/download` 관리자 인증 재검증
3. signed URL 유효기간 정책
4. 다운로드 로그 저장 여부
5. Naver Object Storage bucket 권한
6. Supabase RLS 또는 service role 사용 범위
7. Cafe24 추가 입력 옵션명 유지 여부
8. 모바일 상품상세에서 위젯 UI 깨짐 여부

## 9. 다음 단계 제안

### 1순위: 관리자 보호 강화

다운로드 기능이 생겼으므로 `/admin`과 `/api/files/download` route에 운영 수준의 접근 보호를 먼저 적용하는 것이 좋습니다.

### 2순위: 주문번호 자동 연결

Cafe24 주문상세 또는 Webhook에서 `업로드 파일 ID`를 읽어 Supabase `files.order_id`를 자동으로 업데이트합니다.

### 3순위: 관리자 검색 확장

현재는 `file_id` 검색 중심입니다. 이후에는 아래 검색을 추가할 수 있습니다.

- Cafe24 주문번호
- 상품번호
- 고객명
- 업로드 일자
- 파일 상태

### 4순위: 다운로드 이력 저장

관리자가 언제 어떤 파일을 다운로드했는지 기록하면 운영 안정성이 높아집니다.

### 5순위: 운영 삽입 자동화

테스트 상품 기준 적용이 안정화되면 ScriptTags API 또는 Cafe24 스킨 삽입 방식으로 운영 상품 적용 범위를 넓힐 수 있습니다.

## 10. 현재 결론

Cafe24 상품상세 업로드 위젯에서 시작해 Cafe24 주문정보에 `file_id`를 남기고, 관리자가 `/admin`에서 해당 파일을 찾아 원본 파일명으로 다운로드하는 A 방식 흐름은 성공했습니다.

다음 핵심 과제는 기능 추가보다 관리자 접근 보호와 주문번호 자동 연결입니다.
