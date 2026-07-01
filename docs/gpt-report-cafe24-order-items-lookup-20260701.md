# GPT 보고서: Cafe24 주문 품목 API 조회 보강

## 1. 작업 목적

`perpackage-cafe24-file-upload-app`의 `/admin` Cafe24 주문 조회 테스트 기능에서 주문 기본 정보는 조회되지만, 상품/옵션 정보와 `업로드 파일 ID`가 표시되지 않는 문제가 있었습니다.

운영 테스트 결과:

```txt
주문번호: 20260701-0000017
order_id: 20260701-0000017
주문일: 2026-07-01T09:58:04+09:00
주문 상태: F
top-level keys: order
order object: 있음
orders array: 없음
```

문제:

```txt
업로드 파일 ID 발견 수: 0
상품/옵션 요약: Cafe24 API 응답에서 상품 item 목록을 찾지 못했습니다.
```

Cafe24 관리자 주문상세에는 아래 file_id가 상품 옵션에 표시되어 있었습니다.

```txt
cdd3e86c-a93c-47f1-b118-778cff7d57bf
```

따라서 주문 기본 상세 API만으로는 주문 품목 정보가 내려오지 않을 가능성이 높다고 보고, Cafe24 주문 품목 API를 추가 조회하도록 보강했습니다.

## 2. 수정한 파일

```txt
src/lib/cafe24/order-lookup.ts
src/app/admin/page.tsx
```

## 3. 추가한 Cafe24 API 호출 endpoint

기존 유지:

```txt
GET /api/v2/admin/orders/{order_id}
```

추가:

```txt
GET /api/v2/admin/orders/{order_id}/items
```

실제 호출 형태:

```txt
https://{mallId}.cafe24api.com/api/v2/admin/orders/{order_id}/items
```

`cafe24_installations.shop_no`가 있으면 아래 query를 함께 붙입니다.

```txt
shop_no={shop_no}
```

## 4. 조회 흐름

변경 후 흐름:

```txt
1. /admin에서 Cafe24 주문번호 입력
2. 기존 주문 상세 API 조회
3. 추가로 주문 품목 API 조회
4. 주문 품목 응답에서 item 배열 탐색
5. 상품명, 상품번호, variant_code, 상품 옵션, 추가 입력 옵션 요약
6. 업로드 파일 ID 후보 추출
7. /admin 화면에 요약 표시
```

중요:

이번 작업에서는 조회와 표시만 합니다.

```txt
files.order_id 자동 업데이트 안 함
주문 자동 연결 안 함
Webhook 자동 연결 안 함
```

## 5. 주문 품목 응답 구조 요약 추가

`/admin`의 `Cafe24 주문 조회 테스트` 결과 영역에 아래 요약을 추가했습니다.

```txt
order detail top-level keys
order item response top-level keys
order object
orders array
order detail item count
order item array
order item count
item lookup status
item lookup error
```

이를 통해 운영 화면에서 아래를 바로 확인할 수 있습니다.

```txt
주문 상세 응답에 item이 있는지
주문 품목 API 응답에 item이 있는지
주문 품목 API 호출이 성공했는지
실패했다면 안전한 에러 메시지가 무엇인지
```

## 6. 상품/옵션 요약 표시 보강

상품/옵션 요약 테이블에 아래 컬럼을 표시합니다.

```txt
상품명
상품번호
variant_code
상품 옵션
추가 입력 옵션
업로드 파일 ID
source
```

주문 품목 API 응답에 item 배열이 있으면 해당 응답을 우선 사용합니다.

fallback:

```txt
order item response items 있음 → 주문 품목 응답 우선 사용
order item response items 없음 → 기존 주문 상세 내부 items/order_items/products 후보 사용
```

## 7. 업로드 파일 ID 추출 로직 보강

탐색 대상 key:

```txt
option
options
option_value
additional_option
additional_options
input_options
product_option
product_options
variants
custom_fields
additional_info
```

탐색 문자열:

```txt
업로드 파일 ID
파일 ID
file_id
파일접수번호
```

UUID 형식 문자열도 함께 탐색합니다.

예상 확인 대상:

```txt
cdd3e86c-a93c-47f1-b118-778cff7d57bf
```

표시 방식:

```txt
업로드 파일 ID
source path
```

source path 예시:

```txt
orderItemResponse.items[0].additional_options[0].value
orderItemResponse.items[0].input_options.upload_file_id
orderItemResponse.items[0].option_value
```

실제 source path는 운영 응답 구조에 따라 다릅니다.

## 8. 민감정보 비노출 처리

원본 Cafe24 API raw payload 전체는 화면에 표시하지 않습니다.

문자열 탐색에서도 아래 key는 제외합니다.

```txt
token
secret
authorization
password
client_secret
access_token
refresh_token
signature
```

아래 값은 화면/API 응답/로그에 원문으로 노출하지 않는 기준입니다.

```txt
Cafe24 access token
Cafe24 refresh token
Cafe24 client secret
authorization header value
Supabase service role key
Naver Object Storage key
signed URL 원문
```

## 9. 기존 기능 유지

아래 기존 기능은 변경하지 않았습니다.

```txt
/admin 로그인
Cafe24 주문 조회 테스트 UI
file_id 검색
주문번호 검색
주문번호 수동 연결
파일 다운로드
다운로드 로그 저장
전체 다운로드 로그/필터/CSV
상태 변경
상태 변경 이력
최근 업로드 파일 목록/필터
고객용 product-upload-widget.js
```

## 10. 검증 결과

실행한 명령:

```bash
npm run build
npm run typecheck
```

결과:

```txt
npm run build: 통과
npm run typecheck: 통과
```

참고:

`next build` 중 기존과 동일하게 `/api/cafe24/auth/start`의 `cookies` 사용 관련 dynamic server usage 메시지가 표시되지만, 빌드는 성공합니다.

## 11. 운영 테스트 방법

1. `/admin` 로그인
2. `Cafe24 주문 조회 테스트` 섹션 이동
3. 주문번호 입력

```txt
20260701-0000017
```

4. `Cafe24 주문 조회` 클릭
5. 주문 기본 정보 표시 확인
6. 응답 구조 요약 확인

확인할 항목:

```txt
item lookup status: success
order item array: 있음
order item count: 1 이상
```

7. 상품/옵션 요약에서 아래 file_id 표시 확인

```txt
cdd3e86c-a93c-47f1-b118-778cff7d57bf
```

8. source path 표시 확인
9. token/secret 원문이 화면에 노출되지 않는지 확인
10. 기존 file_id 검색, 주문번호 검색, 수동 연결, 다운로드, 상태 변경 기능 확인

## 12. 테스트 결과

현재 상태:

```txt
로컬 build/typecheck 검증 완료
운영 주문번호 실제 조회는 아직 배포 전이라 미확인
```

운영 반영 후 위 테스트 절차로 확인해야 합니다.

## 13. 커밋/푸시/배포 여부

현재 상태:

```txt
커밋: 아직 안 함
푸시: 아직 안 함
Vercel Production 배포: 아직 안 함
```

운영 반영 시 이번 작업 관련 파일만 별도 커밋하는 것을 권장합니다.

커밋 대상 후보:

```txt
src/lib/cafe24/order-lookup.ts
src/app/admin/page.tsx
docs/gpt-report-cafe24-order-items-lookup-20260701.md
```

권장 커밋 메시지:

```txt
feat: add cafe24 order item lookup
```

## 14. 다음 단계 제안

1. 이번 변경분 커밋/push
2. Vercel Production 배포 확인
3. `/admin`에서 `20260701-0000017` 실제 조회
4. `cdd3e86c-a93c-47f1-b118-778cff7d57bf` 추출 여부 확인
5. source path 확인
6. 확인된 path를 기준으로 추출 로직을 더 정확히 보정
7. 다음 Phase에서 `file_id` 기준 `files.order_id` 자동 연결 구현 검토
