# GPT 보고서: file_id 기준 주문번호 수동 연결 기능

## 1. 작업 목적

`perpackage-cafe24-file-upload-app`의 `/admin` 화면에서 file_id로 찾은 업로드 파일에 Cafe24 주문번호를 수동으로 연결할 수 있게 했습니다.

현재 Cafe24 주문상세에는 `업로드 파일 ID`가 남고, Supabase `files` 테이블에는 파일 row가 저장됩니다. 다만 `files.order_id`는 자동 연결 전까지 `NULL`인 경우가 많기 때문에, 운영자가 Cafe24 관리자 주문상세의 주문번호를 보고 직접 연결할 수 있는 기능이 필요했습니다.

## 2. 추가한 관리자 기능

`/admin` file_id 검색 결과가 있을 때 파일 정보 카드 아래에 `주문번호 연결` 섹션을 추가했습니다.

관리자 사용 흐름:

1. Cafe24 관리자 주문상세에서 `업로드 파일 ID` 복사
2. `/admin`에서 file_id 검색
3. 검색 결과에서 파일 정보 확인
4. Cafe24 주문번호 입력
5. `주문번호 연결` 버튼 클릭
6. Supabase `files.order_id`에 주문번호 저장
7. `/admin?file_id=<id>`로 다시 이동
8. 검색 결과에서 `order_id`가 입력한 주문번호로 표시됨

## 3. 수정한 파일

- `src/app/admin/page.tsx`
- `src/app/admin/actions.ts`
- `src/lib/files/file-service.ts`
- `docs/gpt-report-manual-order-id-link-20260630.md`

## 4. 추가한 함수

### `updateFileOrderId`

파일:

```txt
src/lib/files/file-service.ts
```

역할:

- `fileId` trim 처리
- `orderId` trim 처리
- 빈 값 방어
- Supabase `files.id`와 정확히 일치하는 row 업데이트
- `order_id` 갱신
- `updated_at`을 현재 시각으로 갱신
- 업데이트 대상이 없으면 안전한 오류 반환
- Supabase error 발생 시 민감값 없이 안전한 서버 로그만 남김

### `linkFileOrderIdAction`

파일:

```txt
src/app/admin/actions.ts
```

역할:

- 관리자 세션 확인
- `file_id` 확인
- 주문번호 빈 값 방어
- `updateFileOrderId` 호출
- 성공 후 `/admin?file_id=<id>&order_link=success`로 redirect
- 실패 유형에 따라 안전한 reason code만 query string에 전달

## 5. `/admin` UI 변경 내용

file_id 검색 결과 아래에 새 섹션을 추가했습니다.

섹션 제목:

```txt
주문번호 연결
```

입력 placeholder:

```txt
Cafe24 주문번호를 입력하세요. 예: 20260630-0000029
```

버튼:

```txt
주문번호 연결
```

현재 `order_id`가 있으면 아래처럼 표시합니다.

```txt
현재 연결된 주문번호: 20260630-0000029
```

없으면 아래처럼 표시합니다.

```txt
현재 연결된 주문번호: 미연결
```

## 6. 보안 기준

아래 기준을 유지했습니다.

- `/admin` 인증된 관리자만 주문번호 연결 가능
- 서버 액션에서 관리자 세션 재검증
- Supabase service role key는 브라우저에 노출하지 않음
- Naver Object Storage key/secret 노출 없음
- Cafe24 token/secret 노출 없음
- 실패 메시지는 reason code 기반의 안전한 문구만 표시

## 7. 기존 기능 유지

아래 기존 기능은 유지했습니다.

- `/admin` 로그인
- `/admin` 로그아웃
- `/admin` file_id 검색
- `/admin` 최근 업로드 파일 목록
- `/admin` 최근 다운로드 로그 표시
- `/api/files/download` signed URL redirect
- original_filename 기준 다운로드명
- `/api/files/upload`
- `/upload-test`
- `product-upload-widget.js`

## 8. 이번 작업에서 하지 않은 것

이번 작업에서는 아래 기능을 만들지 않았습니다.

- Cafe24 Admin API 주문 조회
- Cafe24 Webhook 주문 자동 연결
- 주문번호로 파일 검색
- 주문번호별 파일 목록
- 파일 삭제
- 다운로드 로그 CSV export
- 사용자별 관리자 계정 시스템
- ScriptTags API 실제 등록
- 100MB 업로드
- multipart upload

## 9. 테스트 방법

1. `/admin` 로그인
2. file_id 검색
3. 검색 결과에서 `order_id`가 `미연결`인지 확인
4. 주문번호 입력
5. `주문번호 연결` 클릭
6. `/admin?file_id=<id>`로 다시 이동되는지 확인
7. 검색 결과에서 `order_id`가 입력한 주문번호로 표시되는지 확인
8. Supabase `files` 테이블에서 해당 row의 `order_id`가 갱신됐는지 확인
9. 기존 파일 다운로드 버튼이 계속 작동하는지 확인
10. 최근 다운로드 로그 표시가 계속 작동하는지 확인

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

- 주문번호 기반 파일 검색은 아직 없음
- 주문번호별 파일 목록 화면은 아직 없음
- Cafe24 Admin API로 주문번호 유효성 검증은 아직 없음
- Cafe24 Webhook으로 자동 연결하는 기능은 아직 없음
- `files.order_id`가 수동 입력값이므로 운영자가 주문번호를 잘못 입력할 가능성은 남아 있음

## 12. 다음 단계 제안

1. `/admin`에 주문번호로 파일 검색 기능 추가
2. 주문번호별 파일 목록 화면 추가
3. Cafe24 Admin API 주문 조회와 file_id 연결 검증
4. Cafe24 Webhook 수신 시 file_id 또는 주문번호 기준 자동 연결
5. 주문번호 연결/수정 이력 로그 테이블 추가
