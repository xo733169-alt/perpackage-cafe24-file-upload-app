# GPT 보고서: Cafe24 Admin API 주문 조회 테스트 기능 추가

## 1. 작업 목적

`perpackage-cafe24-file-upload-app`의 `/admin` 화면에서 Cafe24 주문번호를 입력해 Cafe24 Admin API 주문 상세 응답을 직접 확인할 수 있는 테스트 기능을 추가했습니다.

이번 작업의 목적은 자동 주문 연결을 바로 구현하는 것이 아니라, Cafe24 주문 상세 API 응답 안에 상품 옵션과 `업로드 파일 ID` 값이 포함되는지 먼저 확인하는 것입니다.

테스트 기준 주문번호:

```txt
20260701-0000017
```

Cafe24 관리자 주문상세에서 확인된 file_id:

```txt
cdd3e86c-a93c-47f1-b118-778cff7d57bf
```

## 2. 수정/추가한 파일

수정:

```txt
src/app/admin/page.tsx
src/lib/cafe24/config.ts
```

추가:

```txt
src/lib/cafe24/order-lookup.ts
src/app/api/admin/cafe24/orders/lookup/route.ts
```

## 3. 추가한 API route

```txt
GET /api/admin/cafe24/orders/lookup?order_id=20260701-0000017
```

동작:

1. 관리자 세션 쿠키 검증
2. `order_id` 필수값 검증
3. 기존 Cafe24 OAuth token 저장 구조에서 유효한 access token 조회
4. token이 만료됐거나 만료 임박이면 기존 refresh 로직 사용
5. Cafe24 Admin API 주문 상세 조회
6. 필요한 정보만 안전하게 요약해서 반환

인증되지 않은 요청은 아래처럼 차단합니다.

```txt
401 Unauthorized
```

## 4. Cafe24 API 호출 방식

사용 endpoint:

```txt
https://{mallId}.cafe24api.com/api/v2/admin/orders/{order_id}
```

사용 함수:

```txt
getValidCafe24AccessToken()
fetchCafe24OrderLookup()
summarizeCafe24OrderLookup()
```

기존 OAuth token 저장 구조를 재사용합니다.

```txt
cafe24_installations
```

기본 Cafe24 scope에는 주문 조회를 위해 아래 권한을 추가했습니다.

```txt
mall.read_order
```

주의:

Vercel 환경변수 `CAFE24_SCOPES`를 별도로 지정해 두었다면, 해당 값에도 `mall.read_order`가 포함되어야 합니다. 이미 발급된 OAuth token에 주문 읽기 권한이 없다면 Cafe24 OAuth 재연결이 필요할 수 있습니다.

## 5. /admin UI 변경

`/admin`의 OAuth connection status 아래에 새 섹션을 추가했습니다.

섹션명:

```txt
Cafe24 주문 조회 테스트
```

입력:

```txt
Cafe24 주문번호
```

버튼:

```txt
Cafe24 주문 조회
```

query string:

```txt
cafe24_order_id
```

기존 Supabase 파일 검색용 `order_id`와 충돌하지 않도록 분리했습니다.

## 6. 화면에 표시하는 주문 정보

조회 성공 시 `/admin` 화면에 아래 정보를 표시합니다.

```txt
tokenLookupMallId
order_id
order_no
주문일
주문 상태
업로드 파일 ID 발견 수
업로드 파일 ID 목록
상품명
상품번호
variant_code
상품 옵션
업로드 파일 ID source path
응답 구조 요약
```

응답 구조 요약에는 아래 정보만 표시합니다.

```txt
top-level keys
order object 존재 여부
orders array 존재 여부
item count
```

원본 raw payload 전체는 화면에 표시하지 않습니다.

## 7. 업로드 파일 ID 추출 방식

`src/lib/cafe24/order-lookup.ts`에서 Cafe24 주문 상세 응답을 안전하게 요약합니다.

확인 대상:

```txt
order.items
order.order_items
order.products
```

상품명 후보:

```txt
product_name
product_name_default
productName
productNameDefault
item_name
itemName
product_name_en
```

상품 옵션 후보:

```txt
option_value
option
options
product_option
product_options
variant_code
additional_options
input_options
```

file_id 추출 기준:

```txt
UUID 형식 문자열
업로드 파일 ID
파일 ID
file_id
파일접수번호
```

민감한 key는 문자열 탐색 대상에서 제외합니다.

## 8. 민감정보 비노출 처리

아래 값은 API 응답, 화면, 로그에 원문으로 노출하지 않는 방향으로 처리했습니다.

```txt
access token
refresh token
client secret
authorization header value
signature
password
secret
Supabase service role key
Naver Object Storage key
signed URL 원문
```

`order-lookup.ts` 내부 문자열 탐색에서도 아래 패턴의 key는 제외합니다.

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

## 9. 자동 연결 여부

이번 작업에서는 자동 연결을 구현하지 않았습니다.

하지 않은 작업:

```txt
Supabase files.order_id 자동 업데이트
Cafe24 Webhook 주문 자동 연결
주문 상세 응답 기반 file_id 자동 매칭
주문번호 유효성 기반 저장
```

이번 작업은 Cafe24 API 응답에서 `업로드 파일 ID`를 읽을 수 있는지 확인하는 테스트 기능까지만 포함합니다.

## 10. 기존 기능 유지 여부

아래 기존 기능은 유지됩니다.

```txt
/admin 로그인
file_id 검색
주문번호 기준 파일 검색
주문번호 수동 연결
파일 다운로드
다운로드 로그 저장
전체 다운로드 로그 조회/필터/CSV export
파일 상태 한글 표시
파일 상태 변경
상태 변경 로그 저장
상태 변경 이력 표시
최근 업로드 파일 목록/필터/상태 변경
Cafe24 상품상세 product-upload-widget.js
file_id 자동 입력
```

## 11. 검증 결과

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

빌드 출력에서 새 route가 포함된 것을 확인했습니다.

```txt
/api/admin/cafe24/orders/lookup
```

참고:

`next build` 중 기존과 동일하게 `/api/cafe24/auth/start`의 `cookies` 사용 관련 dynamic server usage 메시지가 표시되지만, 빌드는 성공합니다.

## 12. 운영 테스트 방법

1. `/admin` 접속
2. 관리자 비밀번호로 로그인
3. `Cafe24 주문 조회 테스트` 섹션 확인
4. 주문번호 입력

```txt
20260701-0000017
```

5. `Cafe24 주문 조회` 버튼 클릭
6. 주문 정보 표시 확인
7. 상품/옵션 요약에 아래 file_id가 표시되는지 확인

```txt
cdd3e86c-a93c-47f1-b118-778cff7d57bf
```

8. 화면에 token/secret 값이 노출되지 않는지 확인
9. 기존 file_id 검색, 주문번호 검색, 수동 연결, 다운로드, 상태 변경 기능이 유지되는지 확인

## 13. 남은 확인 항목

1. 실제 운영 Cafe24 OAuth token에 `mall.read_order` 권한이 포함되어 있는지 확인
2. 권한이 부족하면 Cafe24 Developers scope와 Vercel `CAFE24_SCOPES`에 `mall.read_order` 추가 후 OAuth 재연결
3. 주문 상세 응답에서 `업로드 파일 ID`가 실제로 어떤 path에 들어오는지 운영 화면에서 확인
4. 확인 후 다음 단계에서 `files.order_id` 자동 연결 기능 설계

## 14. 커밋/푸시/배포 여부

현재 상태:

```txt
커밋: 아직 안 함
푸시: 아직 안 함
Vercel Production 배포: 아직 안 함
```

운영 반영 시 이번 작업 관련 파일만 별도 커밋하는 것을 권장합니다.

커밋 대상 후보:

```txt
src/app/admin/page.tsx
src/lib/cafe24/config.ts
src/lib/cafe24/order-lookup.ts
src/app/api/admin/cafe24/orders/lookup/route.ts
docs/gpt-report-cafe24-admin-order-lookup-test-20260701.md
```

권장 커밋 메시지:

```txt
feat: add cafe24 admin order lookup test
```

## 15. 다음 단계 제안

1. 운영에서 `20260701-0000017` 주문 조회 테스트
2. API 응답에서 `업로드 파일 ID` source path 확인
3. 확인된 source path 기준으로 file_id 추출 로직 보강
4. `file_id`가 Supabase `files.id`와 일치하면 `files.order_id` 자동 연결 기능 추가
5. 이후 Cafe24 Webhook 또는 주문 조회 기반 자동 연결로 확장
