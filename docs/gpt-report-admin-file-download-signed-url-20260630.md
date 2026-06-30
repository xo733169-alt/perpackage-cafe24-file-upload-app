# GPT 보고서: 관리자 file_id 기반 파일 다운로드 기능 추가

## 1. 작업 목적

Cafe24 관리자 주문상세에 남는 `업로드 파일 ID`를 `/admin`에서 검색한 뒤, Naver Object Storage 콘솔에 직접 들어가지 않고도 관리자가 파일을 내려받을 수 있도록 서버 경유 다운로드 기능을 추가했습니다.

## 2. 구현 방식

다운로드는 영구 public URL을 노출하지 않고, 서버 route handler가 Supabase `files` row를 조회한 뒤 Naver Object Storage용 짧은 유효기간의 signed URL을 생성해 redirect하는 방식으로 구현했습니다.

흐름:

1. `/admin?file_id=<id>`에서 파일 정보를 조회
2. 검색 결과 카드에 `파일 다운로드` 버튼 표시
3. 버튼 클릭 시 `/api/files/download?file_id=<id>` 호출
4. 서버에서 Supabase `files.id` 기준 row 조회
5. `storage_provider`, `storage_bucket`, `storage_path` 검증
6. Naver Object Storage signed URL 생성
7. 302 redirect로 파일 다운로드

## 3. 수정한 파일

- `src/app/admin/page.tsx`
- `src/lib/storage/naver-object-storage.ts`
- `src/app/api/files/download/route.ts`
- `package.json`
- `package-lock.json`

## 4. 추가한 route

```txt
GET /api/files/download?file_id=<id>
```

응답 정책:

- `file_id` 없음: 400
- 해당 file row 없음: 404
- 지원하지 않는 storage provider: 400
- storage metadata 누락: 409
- signed URL 생성 실패: 500
- 정상: Naver Object Storage signed URL로 302 redirect

## 5. 추가한 함수

`src/lib/storage/naver-object-storage.ts`

```ts
createSignedDownloadUrl(input: {
  bucket: string;
  key: string;
  expiresInSeconds?: number;
}): Promise<string>
```

기존 Naver Object Storage S3-compatible client 설정을 재사용합니다.

## 6. signed URL 유효기간

현재 유효기간은 300초, 즉 5분입니다.

```ts
const DOWNLOAD_EXPIRES_IN_SECONDS = 300;
```

## 7. /admin UI 변경

`file_id` 검색 결과가 있을 때 아래 다운로드 영역을 추가했습니다.

- 안내 문구: `다운로드 링크는 짧은 시간 동안만 유효합니다.`
- 버튼명: `파일 다운로드`
- 버튼 링크: `/api/files/download?file_id=<id>`
- 새 탭에서 열리도록 처리

기존 표시 정보는 유지했습니다.

- `file_id`
- `original_filename`
- `mall_id`
- `shop_no`
- `product_no`
- `variant_code`
- `customer_type`
- `file_size`
- `mime_type`
- `storage_provider`
- `storage_bucket`
- `storage_path`
- `status`
- `order_id`
- `inquiry_id`
- `created_at`
- `updated_at`

## 8. 보안상 주의사항

아래 값은 화면, API 응답, 로그에 원문으로 노출하지 않았습니다.

- Supabase service role key
- Naver Object Storage access key
- Naver Object Storage secret key
- Cafe24 access token
- Cafe24 refresh token
- Cafe24 client secret
- Authorization header value
- 실제 환경변수 값

이번 단계에서 `/admin` 접근 보호를 새로 구현하지는 않았습니다. 다만 다운로드 기능이 생겼으므로 운영 적용 전에는 `/admin`과 `/api/files/download` 접근 보호를 반드시 강화해야 합니다.

권장 다음 조치:

- 관리자 비밀번호 또는 세션 기반 보호
- 다운로드 route에서도 동일한 관리자 인증 재검증
- Vercel 보호 설정 또는 사내 접근 제한 검토
- 다운로드 로그 기록

## 9. 이번 작업에서 만들지 않은 기능

- 파일 삭제
- Supabase row 삭제
- 주문 Webhook 구현
- Cafe24 Admin API 주문 조회
- `files.order_id` 자동 업데이트
- ScriptTags API 실제 등록
- presigned upload
- multipart upload
- 100MB 대용량 업로드
- 사용자 로그인/권한 시스템 전체 구현

## 10. 검증 명령

실행 대상:

```bash
npm run typecheck
npm run build
```

검증 결과는 최종 작업 보고에 별도 기록합니다.

## 11. 사용자 테스트 순서

1. Cafe24 관리자 주문상세에서 `업로드 파일 ID` 값을 복사합니다.
2. 아래 URL에 접속합니다.

```txt
https://perpackage-cafe24-file-upload-app.vercel.app/admin
```

3. `파일 ID로 업로드 파일 찾기` 입력창에 `file_id`를 붙여넣습니다.
4. `파일 찾기`를 클릭합니다.
5. 파일 정보가 표시되는지 확인합니다.
6. `파일 다운로드` 버튼을 클릭합니다.
7. 새 탭에서 다운로드가 시작되는지 확인합니다.

## 12. 다음 단계 제안

1. `/admin` 관리자 인증 강화
2. `/api/files/download` route에 관리자 인증 재검증 추가
3. Cafe24 주문 Webhook 또는 주문 조회 API로 `files.order_id` 자동 연결
4. 관리자 다운로드 이력 저장
5. 주문번호, file_id, product_no 기준 통합 검색 UI 확장
