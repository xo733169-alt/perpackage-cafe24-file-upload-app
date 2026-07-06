# Cafe24 고객정보 필드 실제 확인 시도 결과

- 작성 기준: 2026-07-06
- 대상 기능: `/admin` 파일 상세 화면의 고객정보 2차 표시 검토
- 문서 성격: 실제 응답 필드 확인 시도 결과

## 조사 목적

운영 관리자 세션 또는 안전한 서버 환경에서 실제 Cafe24 주문 응답의 고객정보 필드 존재 여부와 필드 경로를 확인한다.

이번 작업은 조사/문서화 작업이다. `/admin` 화면에 고객정보 표시 기능을 추가하지 않았고, 코드/API/DB/Webhook/다운로드 API/Cafe24 운영 스킨은 수정하지 않았다.

## 조사 기준

- raw API 응답 전체를 저장하지 않는다.
- raw API 응답 전체를 문서에 붙이지 않는다.
- raw API 응답 전체를 console.log로 출력하지 않는다.
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

## 실제 확인 시도 결과

현재 작업 환경에서는 실제 Cafe24 Admin API raw 응답을 열람하지 못했다.

| 확인 방법 | 결과 | 비고 |
|---|---|---|
| git 상태 확인 | clean | 작업 시작 시 `HEAD`와 `origin/main`은 같은 커밋이었다. |
| 기존 주문 조회 코드 확인 | 완료 | `src/lib/cafe24/order-lookup.ts`를 확인했다. |
| 관리자 주문 조회 route 확인 | 완료 | `src/app/api/admin/cafe24/orders/lookup/route.ts`는 관리자 세션을 요구한다. |
| 운영 `/admin` 접속 확인 | 로그인 필요 | Chrome에서 `/admin`은 관리자 로그인 화면으로 표시됐다. |
| 운영 주문 조회 API 직접 호출 | `401` | 관리자 세션 없이 차단됐다. |
| 로컬 환경변수 확인 | 접속 정보 없음 | Cafe24/Supabase 접속에 필요한 환경변수는 현재 PowerShell 세션에 없었다. 값 자체는 출력하지 않았다. |
| raw Cafe24 API 응답 열람 | 미실행 | token 또는 관리자 세션 없이 안전하게 수행할 수 없었다. |
| 임시 스크립트 작성 | 없음 | 임시 확인 스크립트를 만들지 않았다. |

따라서 아래 표의 `실제 필드 경로`는 “현재 환경에서 실제 값까지 확정한 경로”가 아니라, 현재 코드와 기존 조사 문서를 기준으로 한 확인 대상 경로다. 실제 존재 여부는 운영 관리자 세션이 있는 환경에서 추가 확인해야 한다.

## 실제 확인 결과 표

| 항목 | 실제 필드 경로 | 존재 여부 | 값 원문 저장 여부 | 향후 표시 권장 | 비고 |
|---|---|---|---|---|---|
| 주문자명 | `order.buyer_name`, `order.member_name`, `order.billing_name`, `order.orderer_name` 후보 | 미확정 | 저장 안 함 | 마스킹 또는 상세 화면 한정 검토 | 현재 환경에서 실제 응답 확인 불가 |
| 주문자 이메일 | `order.buyer_email`, `order.email`, `order.orderer_email` 후보 | 미확정 | 저장 안 함 | 마스킹 표시 검토 | 전체 이메일 기본 노출 비추천 |
| 주문자 휴대전화 | `order.buyer_cellphone`, `order.buyer_mobile`, `order.orderer_mobile` 후보 | 미확정 | 저장 안 함 | 마스킹 표시 검토 | 가운데 자리 마스킹 권장 |
| 주문자 일반전화 | `order.buyer_phone`, `order.orderer_phone` 후보 | 미확정 | 저장 안 함 | 마스킹 표시 검토 | 필요할 때만 표시 권장 |
| 수령자명 | `order.receiver_name`, `order.recipient_name`, `order.shipping_name` 후보 | 미확정 | 저장 안 함 | 마스킹 또는 상세 화면 한정 검토 | 주문자와 다를 수 있음 |
| 수령자 휴대전화 | `order.receiver_cellphone`, `order.receiver_mobile`, `order.shipping_mobile` 후보 | 미확정 | 저장 안 함 | 마스킹 표시 검토 | 실제 필드명 확인 필요 |
| 수령자 일반전화 | `order.receiver_phone`, `order.shipping_phone` 후보 | 미확정 | 저장 안 함 | 마스킹 표시 검토 | 실제 필드명 확인 필요 |
| 배송지 주소 | `order.shipping_address`, `order.receiver_address`, `order.address1`, `order.address2`, `order.receiver_address1`, `order.receiver_address2` 후보 | 미확정 | 저장 안 함 | 기본 미표시 권장 | 표시하더라도 파일 상세 화면 한정 권장 |
| 배송 메시지 | `order.shipping_message`, `order.request_message`, `order.order_memo` 후보 | 미확정 | 저장 안 함 | 기본 미표시 권장 | 개인정보 포함 가능 |
| Cafe24 회원 ID | `order.member_id`, `order.user_id`, `order.customer_id` 후보 | 미확정 | 저장 안 함 | 필요 시 마스킹 검토 | 내부 식별용으로만 검토 |
| 주문 수량 | `order.quantity`, `order.total_quantity`, `order.order_quantity` 후보 | 미확정 | 개인정보 아님 | 표시 가능 | 주문 단위 수량이 별도 존재하는지 확인 필요 |
| 품목 수량 | `items[*].quantity`, `items[*].product_quantity`, `items[*].qty`, `items[*].order_quantity` 후보 | 미확정 | 개인정보 아님 | 표시 가능 | 제작 수량 확인에 유용 |
| 주문상태 | `order.order_status`, `order.status`, `order.shipping_status`, `order.payment_status` | 코드 기준 확인됨 | 개인정보 아님 | 표시 가능 | 현재 `orderStatus`로 요약 중 |
| 품목 상태 | `items[*].item_status`, `items[*].order_item_status`, `items[*].status` 후보 | 미확정 | 개인정보 아님 | 표시 가능 | 실제 응답 확인 필요 |
| 배송상태 | `order.shipping_status`, `order.delivery_status`, `items[*].shipping_status`, `items[*].delivery_status` 후보 | 일부 코드 후보 확인 | 개인정보 아님 | 표시 가능 | 현재는 주문상태 후보에 일부 포함 |
| 결제상태 | `order.payment_status`, `order.pay_status` 후보 | 일부 코드 후보 확인 | 개인정보 아님 | 제한 검토 | 결제 상세은 제외 |
| 주문 요청사항 | `order.order_memo`, `order.request_message`, `order.customer_message` 후보 | 미확정 | 저장 안 함 | 기본 미표시 권장 | 개인정보 포함 가능 |

## 현재 코드로 실제 확인된 범위

현재 코드가 안전하게 요약하는 필드는 다음과 같다.

- 주문번호: `order.order_id`, `order.orderId`
- 주문 보조 번호: `order.order_no`, `order.orderNo`
- 주문일: `order.ordered_date`, `order.order_date`, `order.created_date`, `order.payed_date`
- 주문상태 후보: `order.order_status`, `order.status`, `order.shipping_status`, `order.payment_status`
- 상품명 후보: `product_name`, `product_name_default`, `productName`, `productNameDefault`, `item_name`, `itemName`, `product_name_en`
- 상품번호 후보: `product_no`, `productNo`
- variant code 후보: `variant_code`, `variantCode`
- 상품 옵션 후보: `option_value`, `option`, `product_option`, `product_options`, `variant_code`
- 추가 입력 옵션 후보: `additional_option`, `additional_options`, `input_options`, `custom_fields`, `additional_info`
- 업로드 파일 ID: 주문 품목 객체 안의 UUID

## 확인 결과 요약

### 실제 확인된 필드

운영 관리자 세션이 없고 로컬 접속 환경변수가 없어 고객정보 필드의 실제 존재 여부는 확정하지 못했다.

코드 기준으로 이미 확인된 범위는 주문/상품/옵션/업로드 파일 ID 요약 필드다.

### 존재하지 않거나 확인되지 않은 필드

아래 항목은 실제 응답 확인이 필요하다.

- 주문자명
- 주문자 이메일
- 주문자 휴대전화
- 주문자 일반전화
- 수령자명
- 수령자 휴대전화
- 수령자 일반전화
- 배송지 주소
- 배송 메시지
- Cafe24 회원 ID
- 주문 수량
- 품목 수량
- 품목 상태
- 배송상태
- 결제상태
- 주문 요청사항

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

### 마스킹 후 표시를 검토할 필드

- 주문자명
- 주문자 이메일
- 주문자 휴대전화
- 주문자 일반전화
- 수령자명
- 수령자 휴대전화
- 수령자 일반전화
- Cafe24 회원 ID

### 기본 미표시 권장 필드

- 배송지 주소 전체
- 배송 메시지 전체
- 주문 요청사항 전체
- 결제 상세 정보
- 카드/결제수단 상세 정보
- Cafe24 Admin API raw 응답 전체
- Webhook raw payload 전체

## 다음 구현 제안

`/admin` 고객정보 2차 표시를 진행하기 전, 먼저 운영 관리자 세션이 있는 환경에서 아래처럼 안전 확인용 route 또는 임시 서버 스크립트를 사용해야 한다.

권장 확인 방식:

1. raw 응답 전체를 저장하지 않는다.
2. 확인 대상 필드 목록만 순회한다.
3. 각 필드에 대해 `present`, `missing`, `type`만 기록한다.
4. 값이 있어도 값 자체, 길이, 일부 문자열을 출력하지 않는다.
5. 확인 후 임시 스크립트는 삭제하고 커밋하지 않는다.

고객정보 2차 표시 추천:

- 주문자명: 파일 상세 화면에서만, 운영 정책에 따라 마스킹 여부 결정
- 수령자명: 파일 상세 화면에서만, 운영 정책에 따라 마스킹 여부 결정
- 연락처: 마스킹 표시
- 이메일: 마스킹 표시
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
- raw API 응답 전체 문서 미기재
- raw API 응답 전체 console.log 없음
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
