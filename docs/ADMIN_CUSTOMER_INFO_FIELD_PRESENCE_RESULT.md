# Cafe24 고객정보 필드 존재 여부 확인 결과

작성 기준: 2026-07-06
대상 route: `/api/admin/cafe24/orders/customer-field-check`
테스트 주문번호: `20260704-0000014`
문서 성격: 관리자 화면 고객정보 표시 가능성 검토용 확인 결과

## 조사 목적

`/admin` 파일 상세 화면에서 Cafe24 주문 정보를 보강하기 전에, 실제 Cafe24 주문 API 응답에서 어떤 필드 경로가 존재하는지 안전하게 확인했다.

이번 확인은 관리자 로그인 상태에서만 접근 가능한 임시 route로 진행했다. 임시 route는 고객정보 값을 반환하지 않고, 각 후보 필드에 대해 `field`, `status`, `type`만 반환하도록 제한했다.

## 보안 기준

- Cafe24 Admin API raw 응답 전체는 저장하지 않았다.
- 고객 개인정보 원문은 문서에 기록하지 않았다.
- 응답에는 `field`, `status`, `type`만 있었다.
- 고객 이름, 전화번호, 이메일, 주소, 배송 메시지, 주문 요청사항 원문은 기록하지 않았다.
- access token, refresh token, authorization, secret, signature, signed URL, storage_path는 기록하지 않았다.

## 확인된 present 필드

| 항목 | 실제 필드 경로 | 상태 | 타입 | 값 원문 저장 여부 | 향후 표시 권장 |
|---|---|---|---|---|---|
| 주문자명 후보 | `order.billing_name` | present | string | 저장 안 함 | 마스킹 또는 상세 화면 한정 |
| 회원 식별정보 후보 | `order.member_id` | present | string | 저장 안 함 | 마스킹 또는 내부 확인용 |
| 품목 수량 | `orderItemResponse.items[*].quantity` | present | number | 개인정보 아님 | 표시 가능 |
| 품목 상태 | `orderItemResponse.items[*].order_status` | present | string | 개인정보 아님 | 표시 가능 |

## missing 필드 요약

| 구분 | missing 확인 필드 |
|---|---|
| 주문자명 후보 | `order.buyer_name`, `order.member_name`, `order.orderer_name` |
| 주문자 이메일 후보 | `order.buyer_email`, `order.email`, `order.orderer_email` |
| 주문자 연락처 후보 | `order.buyer_cellphone`, `order.buyer_mobile`, `order.orderer_mobile`, `order.buyer_phone`, `order.orderer_phone` |
| 수령자명 후보 | `order.receiver_name`, `order.recipient_name`, `order.shipping_name` |
| 수령자 연락처 후보 | `order.receiver_cellphone`, `order.receiver_mobile`, `order.receiver_phone`, `order.shipping_mobile`, `order.shipping_phone` |
| 배송지 주소 후보 | `order.shipping_address`, `order.receiver_address`, `order.address1`, `order.address2`, `order.receiver_address1`, `order.receiver_address2` |
| 요청/메시지 후보 | `order.shipping_message`, `order.request_message`, `order.order_memo`, `order.customer_message` |
| 고객 식별 후보 | `order.user_id`, `order.customer_id` |
| 주문 수량 후보 | `order.quantity`, `order.total_quantity`, `order.order_quantity` |
| 주문/배송/결제 상태 후보 | `order.order_status`, `order.status`, `order.shipping_status`, `order.delivery_status`, `order.payment_status`, `order.pay_status` |
| 품목 수량 후보 | `order.items[*]` 관련 수량 후보 대부분, `orderItemResponse.items[*].product_quantity`, `orderItemResponse.items[*].qty`, `orderItemResponse.items[*].order_quantity` |
| 품목 상태 후보 | `order.items[*]` 관련 상태 후보 대부분, `orderItemResponse.items[*].item_status`, `orderItemResponse.items[*].order_item_status`, `orderItemResponse.items[*].status`, `orderItemResponse.items[*].shipping_status`, `orderItemResponse.items[*].delivery_status` |

## 향후 표시 권장 기준

### 바로 표시 가능

- `orderItemResponse.items[*].quantity`
- `orderItemResponse.items[*].order_status`

위 필드는 확인 결과 개인정보가 아닌 품목 단위 운영 정보로 볼 수 있으므로, `/admin` 파일 상세 화면에 표시할 수 있다.

### 마스킹 후 표시 검토

- `order.billing_name`
- `order.member_id`

`order.billing_name`은 이름으로 보일 수 있으므로 표시하더라도 마스킹하거나 파일 상세 화면처럼 필요한 관리자 화면에 한정하는 것이 좋다.

`order.member_id`는 회원 식별정보이므로 전체 노출보다 마스킹 또는 내부 확인용 표시를 우선 검토한다.

### 기본 미표시 유지

- 배송지 주소 전체
- 배송 메시지 전체
- 주문 요청사항 전체
- 결제 상세
- Cafe24 Admin API raw 응답 전체

위 항목은 운영자가 파일 처리에 꼭 필요한 경우가 아니라면 기본 화면에 노출하지 않는 것이 안전하다.

## 결론

현재 확인된 안전한 1차 표시 후보는 품목 수량과 품목 상태다. 고객 식별 가능성이 있는 `order.billing_name`, `order.member_id`는 바로 전체 노출하지 말고, 마스킹 또는 상세 화면 한정 표시로 별도 구현 검토가 필요하다.

임시 확인 route는 확인 직후 제거 대상이며, 최종 운영 코드에는 남기지 않는다.
