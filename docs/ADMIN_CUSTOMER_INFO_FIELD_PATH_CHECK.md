# Cafe24 고객정보 필드 경로 확인 문서

- 작성 기준: 2026-07-06
- 대상 기능: `/admin` 파일 상세 화면의 고객정보 2차 표시 검토
- 문서 성격: 조사/문서화

## 조사 목적

`/admin` 파일 상세 화면에 고객정보를 추가로 표시할지 판단하기 위해 Cafe24 Admin API 응답에서 고객정보 관련 필드 경로를 확인한다.

이번 문서는 실제 화면 표시 기능을 구현하지 않는다. 코드, API, DB, Webhook, 다운로드 API, Cafe24 운영 스킨은 수정하지 않는다.

## 조사 기준

- raw API 응답 전체를 저장하지 않는다.
- raw API 응답 전체를 문서에 붙이지 않는다.
- 고객 개인정보 원문을 문서에 적지 않는다.
- token, secret, authorization, signature, signed URL, storage_path는 출력하지 않는다.
- 필드 경로와 존재 여부 중심으로 정리한다.
- 향후 표시 시 마스킹 필요 여부를 함께 정리한다.

## 테스트 주문

| 항목 | 값 |
|---|---|
| 주문번호 | `20260704-0000014` |
| 품목별 주문번호 | `20260704-0000014-01` |
| file_id | `e741ef8c-8389-4b36-b507-e4bdd32e315e` |

## 조사 방법

이번 조사에서는 고객 개인정보 원문을 확인하거나 출력하지 않고 아래 범위만 확인했다.

| 확인 방법 | 결과 | 비고 |
|---|---|---|
| 현재 git 상태 확인 | clean | `HEAD`와 `origin/main`은 같은 커밋이었다. |
| 현재 주문 조회 코드 확인 | 완료 | `src/lib/cafe24/order-lookup.ts` 기준으로 확인했다. |
| 관리자 주문 조회 route 확인 | 완료 | `src/app/api/admin/cafe24/orders/lookup/route.ts`는 관리자 세션이 필요하다. |
| 로컬 환경변수 존재 여부 확인 | 접속 정보 없음 | 필요한 환경변수 값은 현재 PowerShell 세션에 주입되어 있지 않았다. 값 자체는 출력하지 않았다. |
| 로컬 `.env` 확인 | 실제 접속 파일 없음 | `.env.example`만 확인했다. |
| 운영 API route 직접 호출 | 401 | 관리자 세션 없이 차단되는 것을 확인했다. |
| raw Cafe24 API 응답 열람 | 미실행 | 개인정보 원문과 token 노출을 피하기 위해 현재 환경에서는 직접 열람하지 않았다. |

따라서 이 문서는 실제 고객 개인정보 값을 확인한 문서가 아니다. 현재 코드가 안정적으로 파싱하는 필드와, 운영 관리자 세션에서 추가 확인해야 할 고객정보 후보를 분리해 정리한다.

## 현재 코드 기준 주문 조회 구조

현재 주문 조회 중심 함수는 `fetchCafe24OrderLookup(orderId, mallId?)`이다.

| 파일 | 역할 |
|---|---|
| `src/lib/cafe24/order-lookup.ts` | Cafe24 주문 상세/품목 API를 호출하고 화면용 요약 객체를 만든다. |
| `src/app/api/admin/cafe24/orders/lookup/route.ts` | 관리자 세션 확인 후 주문번호 기준 Cafe24 주문 조회를 제공한다. |
| `src/app/admin/page.tsx` | `/admin` 파일 상세 화면과 주문 조회 테스트 화면에서 요약 정보를 표시한다. |

현재 코드가 호출하는 Cafe24 API 경로는 다음과 같다.

| API | 경로 | 현재 용도 |
|---|---|---|
| 주문 상세 조회 | `/api/v2/admin/orders/{order_id}` | 주문 기본 정보와 응답 구조 확인 |
| 주문 품목 조회 | `/api/v2/admin/orders/{order_id}/items` | 상품명, 옵션, 추가 입력 옵션, 업로드 파일 ID 확인 |

주문 품목 조회 시 `cafe24_installations.shop_no`가 있으면 `shop_no` query parameter를 붙인다.

## 현재 코드가 인식하는 응답 경로

### 주문 객체 경로

현재 코드는 주문 상세 응답에서 아래 경로를 주문 객체로 인식한다.

- `payload.order`
- `payload.orders[0]`

### 주문 품목 배열 경로

주문 상세 응답 내부:

- `order.items`
- `order.order_items`
- `order.products`

주문 품목 API 응답 내부:

- `payload.items`
- `payload.order_items`
- `payload.products`
- `payload.order.items`
- `payload.order.order_items`
- `payload.order.products`

## 확인 결과 표

| 항목 | 필드 경로 후보 | 존재 여부 | 원문 저장 여부 | 향후 표시 권장 | 비고 |
|---|---|---|---|---|---|
| 주문자명 | `order.buyer_name`, `order.member_name`, `order.billing_name`, `order.orderer_name` 후보 | 추가 확인 필요 | 저장 안 함 | 마스킹 또는 상세 화면 한정 검토 | 현재 코드에서 파싱하지 않는다. |
| 주문자 이메일 | `order.buyer_email`, `order.email`, `order.orderer_email` 후보 | 추가 확인 필요 | 저장 안 함 | 마스킹 표시 검토 | 전체 이메일 기본 노출은 비추천. |
| 주문자 휴대전화 | `order.buyer_cellphone`, `order.buyer_mobile`, `order.orderer_mobile` 후보 | 추가 확인 필요 | 저장 안 함 | 마스킹 표시 검토 | `010-****-1234` 형태 검토. |
| 주문자 일반전화 | `order.buyer_phone`, `order.orderer_phone` 후보 | 추가 확인 필요 | 저장 안 함 | 마스킹 표시 검토 | 필요할 때만 표시 권장. |
| 수령자명 | `order.receiver_name`, `order.recipient_name`, `order.shipping_name` 후보 | 추가 확인 필요 | 저장 안 함 | 마스킹 또는 상세 화면 한정 검토 | 주문자와 다를 수 있다. |
| 수령자 연락처 | `order.receiver_cellphone`, `order.receiver_mobile`, `order.receiver_phone`, `order.shipping_mobile`, `order.shipping_phone` 후보 | 추가 확인 필요 | 저장 안 함 | 마스킹 표시 검토 | 휴대전화/일반전화 분리 여부는 실제 응답 확인 필요. |
| 배송지 주소 | `order.shipping_address`, `order.receiver_address`, `order.address1`, `order.address2`, `order.receiver_address1`, `order.receiver_address2` 후보 | 추가 확인 필요 | 저장 안 함 | 기본 미표시 권장 | 표시하더라도 파일 상세 화면 한정, 목록/CSV 제외 권장. |
| 배송 메시지 | `order.shipping_message`, `order.request_message`, `order.order_memo` 후보 | 추가 확인 필요 | 저장 안 함 | 기본 미표시 권장 | 개인정보나 민감 요청이 포함될 수 있다. |
| Cafe24 회원 ID | `order.member_id`, `order.user_id`, `order.customer_id` 후보 | 추가 확인 필요 | 저장 안 함 | 필요 시 검토 | 내부 식별용으로만 검토. |
| 주문 수량 | `order.quantity`, `order.total_quantity`, `order.order_quantity` 후보 | 추가 확인 필요 | 개인정보 아님 | 표시 가능 | 주문 단위 수량 필드 존재 여부 확인 필요. |
| 품목 수량 | `items[*].quantity`, `items[*].product_quantity`, `items[*].qty`, `items[*].order_quantity` 후보 | 추가 확인 필요 | 개인정보 아님 | 표시 가능 | 제작 수량 확인에 유용하다. |
| 주문상태 | `order.order_status`, `order.status`, `order.shipping_status`, `order.payment_status` | 현재 코드 기준 확인됨 | 개인정보 아님 | 표시 가능 | 현재 `orderStatus`로 요약한다. |
| 품목 상태 | `items[*].item_status`, `items[*].order_item_status`, `items[*].status` 후보 | 추가 확인 필요 | 개인정보 아님 | 표시 가능 | 실제 응답 확인 후 결정. |
| 배송상태 | `order.shipping_status`, `order.delivery_status`, `items[*].shipping_status`, `items[*].delivery_status` 후보 | 일부 후보 현재 코드에서 사용 | 개인정보 아님 | 표시 가능 | 현재는 `orderStatus` 후보에 포함된다. |
| 결제상태 | `order.payment_status`, `order.pay_status` 후보 | 일부 후보 현재 코드에서 사용 | 개인정보 아님 | 제한 검토 | 결제 상세 정보는 제외 권장. |
| 주문 요청사항 | `order.order_memo`, `order.request_message`, `order.customer_message` 후보 | 추가 확인 필요 | 저장 안 함 | 기본 미표시 권장 | 개인정보 포함 가능성이 있다. |

## 현재 코드에서 이미 확인된 표시 가능 필드

현재 `Cafe24OrderLookupSummary`가 요약하는 필드다.

| 표시 항목 | 요약 필드 | 경로 후보 | 권장 |
|---|---|---|---|
| Cafe24 주문번호 | `orderId` | `order.order_id`, `order.orderId` | 표시 가능 |
| 주문 보조 번호 | `orderNo` | `order.order_no`, `order.orderNo` | 선택 표시 |
| 주문일 | `orderedAt` | `order.ordered_date`, `order.order_date`, `order.created_date`, `order.payed_date` | 표시 가능 |
| 주문상태 | `orderStatus` | `order.order_status`, `order.status`, `order.shipping_status`, `order.payment_status` | 표시 가능 |
| 상품명 | `items[*].productName` | `product_name`, `product_name_default`, `productName`, `productNameDefault`, `item_name`, `itemName`, `product_name_en` | 표시 가능 |
| 상품번호 | `items[*].productNo` | `product_no`, `productNo` | 선택 표시 |
| variant code | `items[*].variantCode` | `variant_code`, `variantCode` | 선택 표시 |
| 상품 옵션 | `items[*].optionText` | `option_value`, `option`, `product_option`, `product_options`, `variant_code` | 표시 가능 |
| 추가 입력 옵션 | `items[*].additionalOptionText` | `additional_option`, `additional_options`, `input_options`, `custom_fields`, `additional_info` | 표시 가능, 내용 검토 필요 |
| 업로드 파일 ID | `items[*].uploadFileIds` | 품목 객체 안의 UUID | 표시 가능 |
| 응답 구조 요약 | `responseShape` | top-level keys, item count, lookup status | 개발/검증용 |

## 1차 결론

### 바로 표시해도 비교적 안전한 필드

- 주문번호
- 주문 보조 번호
- 주문일
- 주문상태
- 상품명
- 상품번호
- variant code
- 상품 옵션
- 추가 입력 옵션
- 업로드 파일 ID
- 품목 수량, 실제 응답 경로 확인 후
- 배송상태, 실제 응답 경로 확인 후
- 품목 상태, 실제 응답 경로 확인 후

### 마스킹 후 표시를 검토할 필드

- 주문자명
- 주문자 이메일
- 주문자 휴대전화
- 주문자 일반전화
- 수령자명
- 수령자 휴대전화
- 수령자 일반전화
- Cafe24 회원 ID

### 기본 미표시를 권장하는 필드

- 배송지 주소 전체
- 배송 메시지 전체
- 주문 요청사항 전체
- 결제 상세 정보
- 카드/결제수단 상세 정보
- Cafe24 Admin API raw 응답 전체
- Webhook raw payload 전체

### 추가 확인이 필요한 필드

- 주문자/수령자 개인정보의 실제 Cafe24 응답 경로
- 주문 단위 수량과 품목 단위 수량의 실제 필드명
- 품목 상태와 배송상태가 주문 상세 응답에 있는지, 품목 API 응답에 있는지
- 결제상태가 단순 상태값인지 결제 상세 정보와 함께 내려오는지
- 주문 요청사항/배송 메시지 필드가 개인정보를 포함하는지

## 다음 구현 제안

`/admin` 고객정보 2차 표시를 진행한다면 아래 순서를 권장한다.

1. 운영 관리자 세션이 있는 상태에서 주문 조회 route를 통해 테스트 주문을 조회한다.
2. raw 응답 전체를 저장하지 않고, 고객정보 필드의 존재 여부와 경로만 확인한다.
3. `src/lib/cafe24/order-lookup.ts`에서 화면용 요약 객체에 필요한 필드만 추가한다.
4. 개인정보는 DB에 저장하지 않고 `/admin` 파일 상세 화면에서 조회 결과로만 표시한다.
5. 전화번호, 이메일, 회원 ID는 마스킹된 값만 표시한다.
6. 배송지 주소와 주문 요청사항은 1차에서 기본 미표시로 둔다.
7. 오늘 처리 목록, 로그, CSV에는 고객정보를 추가하지 않는다.

추천 표시 필드:

- 주문자명: 파일 상세 화면에서만, 운영 정책에 따라 전체 또는 일부 마스킹
- 주문자 연락처: 마스킹 표시
- 수령자명: 파일 상세 화면에서만, 운영 정책에 따라 전체 또는 일부 마스킹
- 품목 수량: 실제 응답 경로 확인 후 표시
- 배송상태/품목상태: 실제 응답 경로 확인 후 표시

표시하지 말아야 할 필드:

- 결제 상세
- 카드/결제수단 상세
- 배송지 주소 전체
- 배송 메시지 전체
- 주문 요청사항 전체
- raw API 응답 전체
- Webhook raw payload 전체

## 보안 확인

- raw API 응답 전체 저장 안 함
- 고객 개인정보 원문 문서 미기재
- access token / refresh token 미출력
- authorization / secret / signature 미출력
- 고객 전화번호 / 이메일 / 주소 원문 미기재
- storage_path / signed URL 미기재
- token_hash / raw token 미기재
- 임시 로그 또는 임시 스크립트 커밋 없음

## 테스트 결과

- 코드 수정 여부: 없음
- `npm run typecheck`: 문서만 작성하여 실행하지 않음
- `npm run build`: 문서만 작성하여 실행하지 않음

## 이번 작업에서 변경하지 않은 것

- 앱 기능 코드
- API route
- Supabase DB/SQL
- Webhook 수신/자동 연결 로직
- 다운로드 API
- `/file-status`
- `/reupload`
- Cafe24 운영 스킨
