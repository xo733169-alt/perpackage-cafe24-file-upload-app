# GPT 보고서: 주문번호 기준 업로드 파일 검색 기능

## 1. 작업 목적

`perpackage-cafe24-file-upload-app`의 `/admin` 화면에 Cafe24 주문번호 기준 업로드 파일 검색 기능을 추가했습니다.

기존에는 file_id를 알아야 파일을 찾을 수 있었지만, 실무에서는 Cafe24 관리자 주문상세에서 주문번호를 기준으로 파일을 찾는 경우가 많습니다. 이번 작업에서는 Supabase `files.order_id`에 수동 연결된 주문번호를 기준으로 업로드 파일 목록을 조회할 수 있게 했습니다.

## 2. 추가한 주문번호 검색 기능

추가된 관리자 흐름:

1. Cafe24 관리자에서 주문번호 복사
2. `/admin` 접속
3. `주문번호로 업로드 파일 찾기` 입력창에 주문번호 입력
4. `주문번호로 파일 찾기` 클릭
5. `/admin?order_id=<주문번호>`로 조회
6. Supabase `files` 테이블에서 `order_id`가 정확히 일치하는 파일 목록 조회
7. 연결된 파일 목록 표시
8. 각 파일별 다운로드 버튼 제공

## 3. 수정한 파일

- `src/app/admin/page.tsx`
- `src/lib/files/file-service.ts`
- `docs/gpt-report-order-id-file-lookup-20260630.md`

## 4. 추가한 함수

### `listFilesByOrderId(orderId: string)`

파일:

```txt
src/lib/files/file-service.ts
```

역할:

- `orderId` trim 처리
- 빈 값이면 빈 배열 반환
- Supabase `files.order_id` 정확 일치 조회
- `created_at desc` 정렬
- Supabase 오류 발생 시 민감값 없이 안전한 서버 로그 기록
- 호출부에는 안전한 오류 메시지 반환

## 5. `/admin` UI 변경 내용

새 섹션:

```txt
주문번호로 업로드 파일 찾기
```

설명:

```txt
Cafe24 주문번호를 입력하면 해당 주문번호에 연결된 업로드 파일 목록을 확인할 수 있습니다.
```

입력 placeholder:

```txt
Cafe24 주문번호를 입력하세요. 예: 20260630-0000029
```

버튼:

```txt
주문번호로 파일 찾기
```

검색 결과 표시:

- `original_filename`
- `file_id`
- `product_no`
- `file_size`
- `mime_type`
- `status`
- `storage_bucket`
- `storage_path`
- `created_at`
- `updated_at`
- 파일 다운로드 버튼

결과가 없을 때 표시:

```txt
해당 주문번호에 연결된 업로드 파일이 없습니다.
```

빈 주문번호 검색 시 표시:

```txt
주문번호를 입력해 주세요.
```

## 6. 보안 기준

아래 기준을 유지했습니다.

- `/admin` 인증된 관리자만 검색 화면 접근 가능
- 다운로드 버튼은 기존 `/api/files/download?file_id=<id>` route 사용
- 다운로드 route는 기존처럼 관리자 인증 확인
- Supabase service role key는 브라우저에 노출하지 않음
- Naver Object Storage key/secret 노출 없음
- Cafe24 token/secret 노출 없음
- signed URL 원문 노출 없음

## 7. 유지한 기존 기능

아래 기능은 유지했습니다.

- `/admin` 로그인
- `/admin` 로그아웃
- 기존 file_id 검색
- 기존 주문번호 수동 연결
- 기존 파일 다운로드 버튼
- 기존 다운로드 로그 표시
- 최근 업로드 파일 목록
- `/api/files/download` 인증 보호
- original_filename 기준 다운로드명

## 8. 이번 작업에서 하지 않은 것

이번 작업에서는 아래 기능을 만들지 않았습니다.

- Cafe24 Admin API 주문 조회
- Cafe24 Webhook 주문 자동 연결
- 주문번호 자동 유효성 검증
- 파일 삭제
- 다운로드 로그 CSV export
- 사용자별 관리자 계정 시스템
- ScriptTags API 실제 등록
- 100MB 업로드
- multipart upload

## 9. 테스트 방법

1. `/admin` 로그인
2. 주문번호 검색창에 `20260630-0000029` 입력
3. `주문번호로 파일 찾기` 클릭
4. 해당 `order_id`에 연결된 파일 목록 표시 확인
5. 목록의 파일 다운로드 버튼 클릭
6. 파일 다운로드 정상 작동 확인
7. Supabase `file_download_logs`에 다운로드 로그가 남는지 확인
8. 없는 주문번호 입력 시 `해당 주문번호에 연결된 업로드 파일이 없습니다.` 메시지 확인
9. 기존 file_id 검색 기능이 계속 작동하는지 확인
10. 기존 주문번호 수동 연결 기능이 계속 작동하는지 확인

## 10. 검증 결과

실행한 명령:

```bash
npm run typecheck
npm run build
```

결과:

- `npm run typecheck`: 통과
- `npm run build`: 통과

## 11. 남은 한계

- Cafe24 Admin API로 주문번호 유효성 검증은 아직 없음
- Cafe24 Webhook 기반 자동 연결은 아직 없음
- 주문번호 검색 결과에 다운로드 로그를 파일별로 직접 펼쳐 보여주지는 않음
- 주문번호별 파일 상태 변경 기능은 아직 없음
- 주문번호별 CSV export는 아직 없음

## 12. 다음 단계 제안

1. 주문번호 검색 결과에서 파일별 다운로드 로그 요약 표시
2. 주문번호별 파일 목록 전용 페이지 추가
3. Cafe24 Admin API로 주문번호 유효성 확인
4. 주문번호 연결/수정 이력 로그 추가
5. Cafe24 Webhook 수신 시 `files.order_id` 자동 연결
6. 주문번호 기준 운영용 다운로드 로그 CSV export 추가
