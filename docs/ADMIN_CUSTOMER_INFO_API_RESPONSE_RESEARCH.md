# Cafe24 주문 API 실제 고객정보 필드 확인 결과

- 작성 기준: 2026-07-06
- 대상 기능: `/admin` 파일 상세 화면의 Cafe24 주문/고객 정보 표시
- 문서 성격: 구현 전 실제 API 응답 필드 확인 문서

## 1. 문서 목적

이 문서는 `/admin` 파일 상세 화면에 Cafe24 주문/고객 정보 섹션을 추가하기 전에, 실제 Cafe24 주문 API 응답에서 어떤 필드를 확인할 수 있는지 정리하기 위한 문서입니다.

이번 작업의 기준은 다음과 같습니다.

- 실제 Cafe24 주문 API 응답에서 고객/주문 정보 필드가 어떤 이름으로 내려오는지 확인한다.
- `/admin` 파일 상세 화면에 표시 가능한 필드와 추가 확인이 필요한 필드를 구분한다.
- 개인정보는 원문이 아니라 마스킹 기준으로만 다룬다.
- raw API 응답 전체는 문서에 포함하지 않는다.
- 1차 구현 가능 범위를 정하는 근거 문서로 사용한다.

## 2. 확인한 주문 정보

| 항목 | 확인 내용 |
|---|---|
| 우선 확인 주문번호 | `20260704-0000014` |
| 품목별 주문번호 참고값 | `20260704-0000014-01` |
| 관련 file_id | `e741ef8c-8389-4b36-b507-e4bdd32e315e` |
| 로컬 작업트리 상태 | 작업 시작 시 clean |
| 로컬 HEAD | `32db63870b35fc8f6d5247d934ec5d9ff0626e48` |
| origin/main | `32db63870b35fc8f6d5247d934ec5d9ff0626e48` |

개인정보 원문은 확인 결과 문서에 기록하지 않았습니다.

## 3. 실제 API 응답 확인 시도 결과

이번 작업에서는 raw 응답을 저장하거나 출력하지 않고, 기존 조회 경로를 통해 필드 존재 여부만 확인하려고 했습니다.

확인 시도 결과는 다음과 같습니다.

| 확인 방법 | 결과 | 비고 |
|---|---|---|
| 로컬 환경변수 확인 | 실패 | 로컬 PowerShell 환경에 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CAFE24_MALL_ID`, `CAFE24_CLIENT_ID`, `CAFE24_CLIENT_SECRET`, `CAFE24_REDIRECT_URI`가 주입되어 있지 않았습니다. |
| 로컬 `.env` 확인 | 실패 | 현재 작업 디렉터리에는 `.env.example`만 있고 실제 Cafe24/Supabase 접속용 `.env` 파일은 없었습니다. |
| 운영 API route 직접 호출 | 실패 | `GET /api/admin/cafe24/orders/lookup?order_id=20260704-0000014`는 관리자 세션 없이 `401`로 차단되었습니다. |
| Cafe24 주문 상세 API 직접 호출 | 미실행 | access token 또는 OAuth refresh에 필요한 환경변수가 없어 직접 호출하지 않았습니다. |
| Cafe24 주문 품목 API 직접 호출 | 미실행 | access token 또는 OAuth refresh에 필요한 환경변수가 없어 직접 호출하지 않았습니다. |

따라서 이번 문서에서는 실제 raw API 응답에서 고객명, 연락처, 이메일, 주소 필드가 존재하는지까지는 확정하지 못했습니다. 아래 필드 표는 현재 코드에서 이미 확인 가능한 응답 구조와, 실제 운영 세션에서 추가 확인해야 할 후보를 분리해 정리한 것입니다.

## 4. 현재 코드 기준으로 확인된 Cafe24 주문 조회 구조

현재 주문 조회 로직의 중심 파일은 `src/lib/cafe24/order-lookup.ts`입니다.

현재 코드에서 호출하는 Cafe24 API 경로는 다음과 같습니다.

| API | 경로 | 현재 용도 |
|---|---|---|
| 주문 상세 API | `/api/v2/admin/orders/{order_id}` | 주문 기본 정보와 응답 구조 확인 |
| 주문 품목 API | `/api/v2/admin/orders/{order_id}/items` | 상품명, 옵션, 추가 입력 옵션, 업로드 파일 ID 확인 |

주문 품목 API 호출 시 `cafe24_installations.shop_no` 값이 있으면 `shop_no` query parameter를 붙입니다.

현재 코드가 주문 객체로 인식하는 경로는 다음과 같습니다.

- `payload.order`
- `payload.orders[0]`

현재 코드가 주문 품목 배열로 인식하는 경로는 다음과 같습니다.

- 주문 상세 응답 내부: `order.items`, `order.order_items`, `order.products`
- 주문 품목 응답 내부: `payload.items`, `payload.order_items`, `payload.products`, `payload.order.items`, `payload.order.order_items`, `payload.order.products`

## 5. 현재 코드에 이미 반영된 필드

아래 필드는 현재 코드가 이미 요약 객체로 정리하고 있습니다.

| 구분 | 현재 코드 필드 | 실제 확인 경로 후보 | 현재 반영 여부 |
|---|---|---|---|
| 주문번호 | `orderId` | `order.order_id`, `order.orderId` | 반영됨 |
| 주문 보조 번호 | `orderNo` | `order.order_no`, `order.orderNo` | 반영됨 |
| 주문일 | `orderedAt` | `order.ordered_date`, `order.order_date`, `order.created_date`, `order.payed_date` | 반영됨 |
| 주문 상태 | `orderStatus` | `order.order_status`, `order.status`, `order.shipping_status`, `order.payment_status` | 반영됨 |
| 상품명 | `productName` | `product_name`, `product_name_default`, `productName`, `productNameDefault`, `item_name`, `itemName`, `product_name_en` | 반영됨 |
| 상품번호 | `productNo` | `product_no`, `productNo` | 반영됨 |
| variant code | `variantCode` | `variant_code`, `variantCode` | 반영됨 |
| 상품 옵션 | `optionText` | `option_value`, `option`, `product_option`, `product_options`, `variant_code` | 반영됨 |
| 추가 입력 옵션 | `additionalOptionText` | `additional_option`, `additional_options`, `input_options`, `custom_fields`, `additional_info` | 반영됨 |
| 업로드 파일 ID | `uploadFileIds` | 주문 품목 문자열 안의 UUID | 반영됨 |
| 업로드 파일 ID 출처 | `uploadFileIdSources` | UUID가 발견된 응답 경로 | 개발/검증용으로 반영됨 |
| 응답 구조 요약 | `responseShape` | top-level keys, item count, item lookup status | 개발/검증용으로 반영됨 |

현재 `/admin` 화면에서는 이 중 주문 조회 테스트 화면과 파일 연결 흐름에 필요한 값만 사용합니다.

## 6. 주문 상세 API에서 추가 확인이 필요한 필드

이번 환경에서는 실제 주문 상세 API 응답을 직접 열람하지 못했기 때문에, 아래 항목은 구현 전에 운영 관리자 세션 또는 안전한 서버 환경에서 추가 확인이 필요합니다.

| 정보 항목 | 실제 확인할 필드명 또는 경로 후보 | 값 존재 여부 | 마스킹 예시 | 1차 표시 추천 여부 | 비고 |
|---|---|---|---|---|---|
| 주문번호 | `order.order_id`, `order.orderId` | 현재 코드 기준 확인됨 | 마스킹 불필요 | 추천 | 이미 `files.order_id`와 연결되는 핵심 값입니다. |
| 주문일 | `order.ordered_date`, `order.order_date`, `order.created_date`, `order.payed_date` | 현재 코드 기준 확인됨 | 마스킹 불필요 | 추천 | 파일 처리 순서 확인에 유용합니다. |
| 주문상태 | `order.order_status`, `order.status` | 현재 코드 기준 일부 확인됨 | 마스킹 불필요 | 추천 | 코드가 첫 번째 후보값을 `orderStatus`로 요약합니다. |
| 주문자명 | `buyer_name`, `member_name`, `billing_name`, `orderer_name` 후보 | 추가 확인 필요 | `김**` | 조건부 추천 | 파일 담당자가 주문자를 식별할 때 유용하지만 표시 범위 결정이 필요합니다. |
| 주문자 이메일 | `buyer_email`, `email`, `orderer_email` 후보 | 추가 확인 필요 | `ab***@do***.com` | 상세 화면 한정 | 기본 목록 노출은 비추천입니다. |
| 주문자 휴대전화 | `buyer_cellphone`, `buyer_mobile`, `orderer_mobile` 후보 | 추가 확인 필요 | `010-****-1234` | 상세 화면 한정 | 마스킹 표시가 기본입니다. |
| 주문자 일반전화 | `buyer_phone`, `orderer_phone` 후보 | 추가 확인 필요 | `02-****-1234` | 선택 | 필요한 경우에만 표시합니다. |
| 수령자명 | `receiver_name`, `recipient_name`, `shipping_name` 후보 | 추가 확인 필요 | `김**` | 상세 화면 한정 | 주문자와 다를 수 있습니다. |
| 수령자 휴대전화 | `receiver_cellphone`, `receiver_mobile`, `shipping_mobile` 후보 | 추가 확인 필요 | `010-****-1234` | 상세 화면 한정 | 마스킹 표시가 기본입니다. |
| 수령자 일반전화 | `receiver_phone`, `shipping_phone` 후보 | 추가 확인 필요 | `02-****-1234` | 선택 | 필요한 경우에만 표시합니다. |
| 배송지 주소 | `shipping_address`, `receiver_address`, `address1`, `address2` 후보 | 추가 확인 필요 | `서울시 중구 ***` | 상세 화면 한정 | 오늘 처리 목록에는 전체 주소를 표시하지 않습니다. |
| Cafe24 회원 ID | `member_id`, `user_id`, `customer_id` 후보 | 추가 확인 필요 | `pe***` | 선택 | 운영상 식별에 필요할 때만 표시합니다. |
| 배송 메시지/주문 요청사항 | `order_memo`, `request_message`, `shipping_message` 후보 | 추가 확인 필요 | 원문 저장/출력 지양 | 1차 제외 권장 | 민감한 고객 요청이 포함될 수 있습니다. |
| 결제상태 | `payment_status`, `pay_status` 후보 | 현재 `orderStatus` 후보에 일부 포함 | 마스킹 불필요 | 선택 | 결제 상세 정보는 1차에서 제외 권장입니다. |
| 배송상태 | `shipping_status`, `delivery_status` 후보 | 현재 `orderStatus` 후보에 일부 포함 | 마스킹 불필요 | 선택 | 파일 검수와 직접 관련성이 낮으면 1차에서 제한합니다. |

## 7. 주문 품목 API에서 추가 확인이 필요한 필드

주문 품목 API는 파일 처리 실무에 더 직접적으로 연결됩니다. 현재 코드가 이미 상당 부분 요약하고 있지만 수량과 품목 단위 상태는 추가 확인이 필요합니다.

| 정보 항목 | 실제 확인할 필드명 또는 경로 후보 | 값 존재 여부 | 1차 표시 추천 여부 | 비고 |
|---|---|---|---|---|
| 상품명 | `product_name`, `product_name_default`, `productName`, `item_name` | 현재 코드 기준 확인됨 | 추천 | 파일이 어떤 상품에 연결되는지 확인하는 핵심 정보입니다. |
| 상품번호 | `product_no`, `productNo` | 현재 코드 기준 확인됨 | 선택 | 운영 확인용 보조값입니다. |
| variant code | `variant_code`, `variantCode` | 현재 코드 기준 확인됨 | 선택 | 옵션 식별 보조값입니다. |
| 수량 | `quantity`, `product_quantity`, `qty`, `order_quantity` 후보 | 추가 확인 필요 | 추천 | B2B 주문 처리에서 중요합니다. |
| 상품 옵션 | `option_value`, `option`, `product_option`, `product_options` | 현재 코드 기준 확인됨 | 추천 | 사이즈/사양 확인에 필요합니다. |
| 추가 입력 옵션 | `additional_option`, `additional_options`, `input_options`, `custom_fields`, `additional_info` | 현재 코드 기준 확인됨 | 추천 | 업로드 파일 ID가 들어가는 영역일 가능성이 큽니다. |
| 업로드 파일 ID | 주문 품목 문자열 안의 UUID | 현재 코드 기준 확인됨 | 추천 | 현재 자동 연결 로직의 핵심입니다. |
| 배송상태, 품목 단위 | `shipping_status`, `delivery_status` 후보 | 추가 확인 필요 | 선택 | 주문 단위 상태와 다를 수 있습니다. |
| 품목 상태 | `item_status`, `order_item_status` 후보 | 추가 확인 필요 | 선택 | 실제 응답 확인 후 결정합니다. |

## 8. 현재 코드 반영 필드와 추가 구현 필요 필드 구분

이미 현재 코드가 요약하는 필드:

- `orderId`
- `orderNo`
- `orderedAt`
- `orderStatus`
- `productName`
- `productNo`
- `variantCode`
- `optionText`
- `additionalOptionText`
- `uploadFileIds`
- `uploadFileIdSources`
- `responseShape`

추가 구현 전에 실제 응답 확인이 필요한 필드:

- 주문자명
- 주문자 이메일
- 주문자 휴대전화
- 주문자 일반전화
- 수령자명
- 수령자 휴대전화
- 수령자 일반전화
- 배송지 주소
- Cafe24 회원 ID
- 수량
- 배송상태
- 품목 상태
- 주문 요청사항 또는 배송 메시지
- 결제상태

## 9. 1차 구현 가능 필드 추천

현재 코드와 보안 기준을 함께 고려하면 1차 구현에서는 다음 정도를 추천합니다.

| 표시 항목 | 추천 여부 | 표시 위치 | 이유 |
|---|---|---|---|
| 주문번호 | 추천 | 파일 상세 | 이미 파일과 연결된 핵심 값입니다. |
| 주문일 | 추천 | 파일 상세 | 처리 순서 확인에 유용합니다. |
| 주문상태 | 추천 | 파일 상세 | 관리자 판단에 도움이 됩니다. |
| 상품명 | 추천 | 파일 상세 | 파일 검수 대상 확인에 직접 필요합니다. |
| 상품 옵션 | 추천 | 파일 상세 | 사양 확인에 필요합니다. |
| 추가 입력 옵션 | 추천 | 파일 상세 | 업로드 파일 ID와 고객 입력값 확인에 필요합니다. |
| 수량 | 추천, 실제 필드 확인 후 | 파일 상세 | 제작 수량 확인에 필요합니다. |
| 주문자명 | 조건부 추천 | 파일 상세 | 주문 식별에 유용하지만 노출 범위 결정이 필요합니다. |
| 주문자 연락처 | 조건부 추천 | 파일 상세 | 마스킹 표시 기준 확정 후 표시합니다. |
| 주문자 이메일 | 조건부 추천 | 파일 상세 | 마스킹 표시 기준 확정 후 표시합니다. |
| 배송지 | 제한 추천 | 파일 상세 | 필요한 경우에만 일부 또는 상세 화면 전용으로 표시합니다. |
| 배송 메시지/주문 요청사항 | 1차 제외 권장 | 표시하지 않음 | 민감 문구 가능성이 있어 별도 검토가 필요합니다. |
| 결제 상세 | 1차 제외 권장 | 표시하지 않음 | 파일 검수와 직접 관련성이 낮습니다. |

## 10. 1차 구현에서 제외할 필드

아래 항목은 1차 구현에서 제외하거나 매우 제한적으로 다루는 것이 좋습니다.

- 결제 상세 정보
- 카드/결제수단 상세
- Cafe24 Admin API raw 응답 전체
- Webhook raw payload
- 고객 요청사항 전체
- 배송 메시지 전체
- 오늘 처리 목록의 전체 주소
- 로그/CSV의 고객 개인정보
- 다운로드 로그의 고객 개인정보

## 11. 마스킹 정책 제안

| 정보 | 권장 표시 방식 |
|---|---|
| 주문자명 | 운영상 필요하면 전체 표시 또는 `김**` 형태 중 선택 |
| 수령자명 | 운영상 필요하면 전체 표시 또는 `김**` 형태 중 선택 |
| 휴대전화 | `010-****-1234` |
| 일반전화 | `02-****-1234` 또는 가운데 자리 마스킹 |
| 이메일 | `ab***@do***.com` |
| 주소 | 상세 주소 일부 마스킹, 오늘 처리 목록에는 전체 주소 미표시 |
| 회원 ID | `pe***` 형태의 일부 마스킹 |

마스킹 정책은 구현 전에 운영자가 실제 업무에 필요한 정보 범위를 결정한 뒤 확정하는 것이 좋습니다. 특히 파일 검수 담당자가 고객에게 직접 연락하지 않는 구조라면 연락처와 이메일은 숨김 또는 마스킹 표시가 기본입니다.

## 12. 1차 구현 대상 파일 후보

| 파일 | 예상 변경 내용 |
|---|---|
| `src/lib/cafe24/order-lookup.ts` | 주문자/수령자/연락처/주소/수량/배송상태 후보 필드를 안전한 요약 객체로 추가 |
| `src/app/admin/page.tsx` | 파일 상세 화면에 `Cafe24 주문/고객 정보` 섹션 추가 |
| `src/app/api/admin/cafe24/orders/lookup/route.ts` | 현재 route 구조 유지, 필요한 경우 응답 타입만 확장 |
| `src/app/globals.css` | 고객정보 카드 UI 스타일이 필요할 때만 최소 수정 |

변경하지 않을 파일 또는 영역:

- `src/app/api/cafe24/webhooks/route.ts`
- `/api/files/download` route
- Supabase schema
- Cafe24 운영 스킨
- Webhook 자동 연결 정책
- `files.order_id` 연결 정책
- 다운로드 로그/CSV 기본 구조

## 13. 1차 구현 제안

1차 구현은 DB 저장 없이, `/admin` 파일 상세 화면에서만 Cafe24 Admin API를 조회해 요약 표시하는 방식이 적합합니다.

권장 방향:

- `files.order_id`가 있는 파일에서만 Cafe24 주문/고객 정보 조회를 시도합니다.
- API 응답 전체가 아니라 필요한 필드만 요약합니다.
- 개인정보는 마스킹 처리한 값만 `/admin` 화면에 표시합니다.
- 주문자/수령자/연락처/이메일/배송지는 파일 상세 화면에서만 표시합니다.
- 오늘 처리 목록, 다운로드 로그, CSV에는 개인정보를 추가하지 않습니다.
- Webhook 로직은 변경하지 않습니다.
- Supabase DB에 고객정보를 새로 저장하지 않습니다.

## 14. 구현 전 최종 확인 체크리스트

- [ ] 운영 관리자 세션이 있는 환경에서 `20260704-0000014` 주문 조회가 되는지 확인
- [ ] 주문 상세 API 응답에서 주문자명 필드 경로 확인
- [ ] 주문 상세 API 응답에서 연락처 필드 경로 확인
- [ ] 주문 상세 API 응답에서 이메일 필드 경로 확인
- [ ] 주문 상세 API 응답에서 배송지 필드 경로 확인
- [ ] 주문 품목 API 응답에서 수량 필드 경로 확인
- [ ] 주문 품목 API 응답에서 품목 단위 배송/상태 필드가 있는지 확인
- [ ] 마스킹 정책 확정
- [ ] `/admin` 파일 상세 화면에만 표시하기로 결정
- [ ] 오늘 처리 목록에는 개인정보를 넣지 않기로 결정
- [ ] DB 저장 없이 API 조회 방식으로 진행하기로 결정
- [ ] 로그/CSV에 고객정보를 넣지 않기로 결정

## 15. 보안 기준

이번 조사 및 다음 구현 단계에서 반드시 지켜야 할 기준입니다.

- raw API 응답 전체를 문서, 화면, 로그에 표시하지 않습니다.
- Cafe24 Admin API 응답 전체를 `/admin` 화면에 그대로 표시하지 않습니다.
- Webhook raw payload 전체를 표시하지 않습니다.
- access token, refresh token, authorization, secret, signature를 표시하지 않습니다.
- storage_path, signed URL, token_hash, raw token을 표시하지 않습니다.
- 고객 전화번호, 이메일, 주소 원문을 문서나 보고서에 기록하지 않습니다.
- 고객정보는 `/admin` 파일 상세 화면 중심으로 최소 표시합니다.
- 오늘 처리 목록에는 전체 주소, 전체 전화번호, 전체 이메일을 표시하지 않습니다.
- 로그/CSV에는 고객정보를 기본 포함하지 않습니다.
- 1차 구현에서는 고객정보를 Supabase DB에 새로 저장하지 않습니다.

## 16. 이번 작업에서 변경하지 않은 것

- 코드 변경 없음
- API 변경 없음
- DB/SQL 변경 없음
- Webhook 로직 변경 없음
- Cafe24 운영 스킨 변경 없음
- `/admin` 실제 화면 변경 없음
- 개인정보 저장 구조 변경 없음
- raw API 응답 파일 저장 없음
- 임시 스크립트 커밋 없음
