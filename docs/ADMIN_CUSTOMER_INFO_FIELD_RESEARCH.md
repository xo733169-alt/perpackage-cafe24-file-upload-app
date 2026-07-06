# Cafe24 주문 API 고객정보 필드 조사 문서

- 작성 기준: 2026-07-06
- 대상 기능: `/admin` 파일 상세 화면의 Cafe24 주문/고객 정보 표시
- 문서 성격: 구현 전 API 응답 필드 조사 문서

## 1. 문서 목적

이 문서는 `/admin` 파일 상세 화면에 고객/주문 정보를 표시하기 위해 현재 Cafe24 주문 API 조회 코드에서 어떤 정보를 가져올 수 있는지 정리합니다.

목적은 다음과 같습니다.

- `/admin` 파일 상세 화면에서 고객/주문 정보를 표시하기 전 Cafe24 주문 API 응답에서 사용할 수 있는 정보를 확인합니다.
- 고객정보를 DB에 저장하기 전에 API 조회만으로 1차 구현이 가능한지 판단합니다.
- 개인정보 노출 범위를 최소화하기 위해 표시 후보와 마스킹 후보를 구분합니다.
- 1차 구현에 필요한 수정 대상 파일과 테스트 기준을 정리합니다.

이번 문서는 코드 구현이 아니라 조사 문서입니다. 코드, API, DB, Webhook 로직, Cafe24 운영 스킨은 변경하지 않았습니다.

## 2. 현재 Cafe24 주문 조회 코드 구조

현재 주문 조회 관련 주요 파일은 다음과 같습니다.

| 파일 | 역할 |
|---|---|
| `src/lib/cafe24/order-lookup.ts` | Cafe24 주문 상세와 주문 품목 API를 호출하고 화면용 요약 객체를 만듭니다. |
| `src/app/api/admin/cafe24/orders/lookup/route.ts` | 관리자 인증 후 주문번호 기준 Cafe24 주문 조회 API를 제공합니다. |
| `src/app/admin/page.tsx` | `/admin` 파일 찾기 탭의 Cafe24 주문 조회 테스트 화면을 렌더링합니다. |
| `src/app/admin/actions.ts` | Cafe24 주문 조회 결과 기반 반자동 주문번호 연결 액션을 처리합니다. |
| `src/app/api/cafe24/webhooks/route.ts` | Webhook 수신 후 동일한 주문 조회 로직으로 업로드 파일 ID를 찾아 자동 연결합니다. |
| `src/lib/cafe24/config.ts` | Cafe24 API base URL, API version, OAuth scope 기본값을 관리합니다. |
| `src/lib/cafe24/token-store.ts` | Cafe24 access token 갱신과 설치 정보를 조회합니다. |

현재 주문 조회 함수는 `fetchCafe24OrderLookup(orderId, mallId?)`입니다.

현재 코드에서 호출하는 Cafe24 API 경로는 다음과 같습니다.

| API | 코드 기준 경로 | 목적 |
|---|---|---|
| 주문 상세 조회 | `/api/v2/admin/orders/{order_id}` | 주문 기본 정보와 응답 구조 확인 |
| 주문 품목 조회 | `/api/v2/admin/orders/{order_id}/items` | 상품명, 옵션, 추가입력 옵션, 업로드 파일 ID 탐색 |

주문 품목 조회 시 `cafe24_installations.shop_no`가 있으면 `shop_no` query parameter를 붙입니다.

현재 OAuth 기본 scope에는 `mall.read_order`가 포함되어 있습니다. 따라서 주문 조회는 현재 OAuth 연결과 scope 상태의 영향을 받습니다.

## 3. 현재 이미 파싱하고 있는 정보

현재 `Cafe24OrderLookupSummary`와 `Cafe24OrderLookupItem`에서 정리하는 정보는 다음과 같습니다.

| 현재 코드 필드명 | 의미 | `/admin` 고객정보 표시와의 관련성 |
|---|---|---|
| `tokenLookupMallId` | 주문 조회에 사용한 mall_id | 설정/디버깅용, 고객정보 표시에는 낮음 |
| `orderId` | Cafe24 주문번호 | 높음. 파일 상세 화면 핵심 표시값 |
| `orderNo` | 주문 번호 또는 내부 주문 번호 후보 | 중간. 실제 의미는 응답 확인 필요 |
| `orderedAt` | 주문일 또는 결제일 후보 | 중간. 파일 처리 우선순위 판단에 도움 |
| `orderStatus` | 주문/배송/결제 상태 후보 중 첫 값 | 높음. 주문 처리 상태 표시 후보 |
| `items` | 주문 품목 요약 목록 | 높음. 상품명/옵션/업로드 파일 ID 표시 후보 |
| `uploadFileIds` | 품목에서 추출한 업로드 파일 ID 목록 | 높음. files row와 주문 연결 핵심 |
| `responseShape` | 응답 구조 요약 | 개발/검증용. 운영 화면 노출은 제한 |
| `productName` | 상품명 | 높음. 파일 검수 담당자에게 유용 |
| `productNo` | Cafe24 상품번호 | 중간. 운영 확인용 |
| `variantCode` | 품목 variant code | 중간. 옵션/품목 식별 보조값 |
| `optionText` | 상품 옵션 요약 | 높음. 사이즈/옵션 확인에 유용 |
| `additionalOptionText` | 추가 입력 옵션 요약 | 높음. 업로드 파일 ID나 고객 입력값 확인에 유용 |
| `uploadFileIdSources` | 업로드 파일 ID를 찾은 응답 경로 | 개발/검증용. 운영 화면 기본 노출은 제한 |

현재 `/admin`의 Cafe24 주문 조회 테스트 화면에서는 위 정보 중 주문 기본값, 업로드 파일 ID, 상품명, 상품번호, variant code, 상품 옵션, 추가 입력 옵션, source, 응답 구조 요약을 표시합니다.

## 4. 현재 코드에서 확인된 파싱 방식

현재 코드의 파싱 기준은 다음과 같습니다.

### 주문 객체 탐색

`src/lib/cafe24/order-lookup.ts`는 응답에서 아래 구조를 우선 확인합니다.

- `payload.order`
- `payload.orders[0]`

즉 Cafe24 주문 상세 API 응답이 단일 `order` 객체 또는 `orders` 배열 형태로 내려올 가능성을 모두 고려합니다.

### 주문 품목 탐색

주문 상세 응답 내부에서는 아래 후보를 품목 목록으로 봅니다.

- `order.items`
- `order.order_items`
- `order.products`

별도 주문 품목 API 응답에서는 아래 후보를 품목 목록으로 봅니다.

- `payload.items`
- `payload.order_items`
- `payload.products`
- `payload.order.items`
- `payload.order.order_items`
- `payload.order.products`

### 상품명 탐색

현재 상품명 후보 필드는 다음과 같습니다.

- `product_name`
- `product_name_default`
- `productName`
- `productNameDefault`
- `item_name`
- `itemName`
- `product_name_en`

### 옵션 탐색

현재 상품 옵션 후보 필드는 다음과 같습니다.

- `option_value`
- `option`
- `product_option`
- `product_options`
- `variant_code`

추가 입력 옵션 후보 필드는 다음과 같습니다.

- `additional_option`
- `additional_options`
- `input_options`
- `custom_fields`
- `additional_info`

### 업로드 파일 ID 탐색

현재 코드는 품목 객체 안의 문자열 전체를 탐색하면서 UUID 형태를 찾습니다. 단, 아래 키워드 주변의 UUID를 업로드 파일 ID로 우선 판단합니다.

- 업로드 파일 ID
- 파일 ID
- `file_id`
- 파일접수번호

민감 키워드가 들어간 key는 문자열 수집에서 제외합니다.

## 5. 추가로 조사해야 할 고객/주문 정보 후보

아래 표는 `/admin` 고객/주문 정보 표시를 위해 조사해야 할 후보입니다. 현재 코드에서 실제로 파싱 중인 필드와 아직 파싱하지 않는 필드를 구분했습니다.

주의: 아래 예상 필드명은 후보입니다. 실제 Cafe24 API 응답에서 필드명이 다를 수 있으므로 구현 전 실제 응답 확인이 필요합니다.

| 정보 항목 | Cafe24 응답에서 확인 가능 여부 | 예상 필드명 또는 후보 경로 | 현재 코드 파싱 여부 | 1차 표시 추천 | 마스킹 필요 | 비고 |
|---|---|---|---|---|---|---|
| 주문번호 | 가능 | `order_id`, `orderId` | 예 | 예 | 아니오 | 이미 핵심값으로 사용 중 |
| 주문 내부번호 | 가능 | `order_no`, `orderNo` | 예 | 선택 | 아니오 | 실제 의미 확인 필요 |
| 주문일 | 가능 | `ordered_date`, `order_date`, `created_date`, `payed_date` | 예 | 예 | 아니오 | 현재 `orderedAt`으로 요약 |
| 주문상태 | 가능 | `order_status`, `status`, `shipping_status`, `payment_status` | 예 | 예 | 아니오 | 현재 첫 번째 값만 표시 |
| 상품명 | 가능 | `product_name`, `product_name_default`, `item_name` 등 | 예 | 예 | 아니오 | 파일 검수에 유용 |
| 상품번호 | 가능 | `product_no`, `productNo` | 예 | 선택 | 아니오 | 운영 확인용 |
| variant code | 가능 | `variant_code`, `variantCode` | 예 | 선택 | 아니오 | 품목 식별 보조값 |
| 상품 옵션 | 가능 | `option`, `option_value`, `product_option`, `product_options` | 예 | 예 | 아니오 | 긴 값은 줄바꿈 필요 |
| 추가 입력 옵션 | 가능 | `additional_option`, `input_options`, `custom_fields` 등 | 예 | 예 | 일부 검토 | 고객 입력값이 섞일 수 있음 |
| 업로드 파일 ID | 가능 | 옵션/추가입력 옵션 내부 UUID | 예 | 예 | 아니오 | source는 개발용 |
| 수량 | 실제 응답 확인 필요 | `quantity`, `product_quantity`, `qty`, `order_quantity` 후보 | 아니오 | 예 | 아니오 | 파일 검수 기준에 유용 |
| 주문자명 | 실제 응답 확인 필요 | `buyer_name`, `member_name`, `billing_name`, `orderer_name` 후보 | 아니오 | 예 | 정책 선택 | 오늘 처리 탭은 짧게 표시 권장 |
| 주문자 이메일 | 실제 응답 확인 필요 | `buyer_email`, `email`, `orderer_email` 후보 | 아니오 | 상세 화면만 | 예 | 전체 이메일 기본 노출은 비추천 |
| 주문자 휴대전화 | 실제 응답 확인 필요 | `buyer_cellphone`, `buyer_mobile`, `orderer_mobile` 후보 | 아니오 | 상세 화면만 | 예 | 마스킹 권장 |
| 주문자 일반전화 | 실제 응답 확인 필요 | `buyer_phone`, `orderer_phone` 후보 | 아니오 | 상세 화면만 | 예 | 필요 시 표시 |
| 수령자명 | 실제 응답 확인 필요 | `receiver_name`, `recipient_name`, `shipping_name` 후보 | 아니오 | 상세 화면만 | 정책 선택 | 주문자와 다를 수 있음 |
| 수령자 휴대전화 | 실제 응답 확인 필요 | `receiver_cellphone`, `receiver_mobile`, `shipping_mobile` 후보 | 아니오 | 상세 화면만 | 예 | 마스킹 권장 |
| 수령자 일반전화 | 실제 응답 확인 필요 | `receiver_phone`, `shipping_phone` 후보 | 아니오 | 상세 화면만 | 예 | 필요 시 표시 |
| 배송지 주소 | 실제 응답 확인 필요 | `shipping_address`, `receiver_address`, `address1`, `address2` 후보 | 아니오 | 상세 화면만 | 예 | 오늘 처리 탭에는 전체 표시 금지 |
| Cafe24 회원 ID | 실제 응답 확인 필요 | `member_id`, `user_id`, `customer_id` 후보 | 아니오 | 선택 | 예 | 내부 식별용으로만 검토 |
| 배송상태 | 실제 응답 확인 필요 | `shipping_status`, `delivery_status` 후보 | 일부 후보만 | 선택 | 아니오 | 현재 `orderStatus` 후보에 포함 |
| 결제상태 | 실제 응답 확인 필요 | `payment_status`, `pay_status` 후보 | 일부 후보만 | 선택 | 아니오 | 상세 결제정보는 제외 권장 |
| 주문 요청사항 | 실제 응답 확인 필요 | `order_memo`, `request_message`, `shipping_message` 후보 | 아니오 | 제한 검토 | 예 | 민감한 문구가 있을 수 있음 |

## 6. 1차 표시 추천 필드

1차 구현에서 `/admin` 파일 상세 화면에 표시할 후보는 다음 정도로 제한하는 것을 권장합니다.

추천 표시:

- 주문번호
- 주문일
- 주문상태
- 상품명
- 상품 옵션
- 추가 입력 옵션
- 수량, 실제 응답에서 안정적으로 확인되는 경우
- 주문자명
- 주문자 연락처, 마스킹 가능할 때
- 주문자 이메일, 마스킹 가능할 때
- 수령자명
- 수령자 연락처, 마스킹 가능할 때
- 배송지, 파일 상세 화면에서만
- 배송상태, 실제 응답에서 안정적으로 확인되는 경우

1차 구현에서 제외하거나 신중하게 처리할 항목:

- 결제 상세 정보
- 카드/결제수단 상세
- 고객 요청사항 전체
- 배송지 전체를 오늘 처리 탭에 표시
- Webhook raw payload
- Cafe24 Admin API 응답 전체
- 로그/CSV에 고객정보 추가

## 7. 개인정보 마스킹 기준 후보

개인정보는 전체 노출보다 마스킹을 기본 검토합니다.

| 항목 | 마스킹 후보 |
|---|---|
| 휴대전화 | 가운데 자리 마스킹 또는 뒷자리만 표시 |
| 일반전화 | 일부 자리 마스킹 |
| 이메일 | 아이디 일부와 도메인 일부 마스킹 |
| 주소 | 오늘 처리 탭 미표시, 상세 화면에서만 표시 |
| 주문자명 | 전체 표시 또는 일부 마스킹 정책 선택 |
| 수령자명 | 전체 표시 또는 일부 마스킹 정책 선택 |
| Cafe24 회원 ID | 일부 마스킹 |

마스킹 정책은 구현 전 운영 기준으로 확정해야 합니다. 특히 디자이너 또는 파일 검수 담당자에게 전체 전화번호, 전체 이메일, 전체 주소가 필요한지 먼저 결정해야 합니다.

## 8. 데이터 저장 여부 판단

1차 구현 기준:

- 고객정보를 Supabase DB에 새로 저장하지 않습니다.
- 파일 상세 화면을 열 때 Cafe24 Admin API로 주문정보를 조회합니다.
- 조회 실패 시 안내 문구를 표시합니다.
- Webhook 로직은 변경하지 않습니다.
- 로그와 CSV에는 고객정보를 추가하지 않습니다.

추후 검토 기준:

- 같은 주문 고객정보를 자주 확인해야 하는 경우 최소 정보만 별도 테이블 저장 검토
- 개인정보 보관 기간과 접근 권한 정책 수립 후 진행
- 개인정보 접근 로그 또는 역할별 권한 분리 검토
- 별도 `order_customer_info` 테이블 설계 검토

## 9. 예상 구현 대상 파일 후보

실제 구현 단계에서 수정될 가능성이 있는 파일은 다음과 같습니다.

| 파일 | 예상 변경 내용 |
|---|---|
| `src/lib/cafe24/order-lookup.ts` | 주문자/수령자/주소/수량/배송상태 후보 필드를 요약 객체에 추가 |
| `src/app/admin/page.tsx` | 파일 상세 화면에 `Cafe24 주문/고객 정보` 섹션 추가 |
| `src/app/api/admin/cafe24/orders/lookup/route.ts` | 현재 구조 유지 가능. 필요 시 응답 타입만 확장 |
| `src/lib/cafe24/config.ts` | scope가 부족한 경우만 확인. 기본적으로 변경 불필요 예상 |
| `src/app/globals.css` | 고객정보 카드 UI 스타일이 필요할 경우만 최소 수정 |

변경하지 않아야 할 파일 또는 영역:

- `src/app/api/cafe24/webhooks/route.ts`
- Webhook 자동 연결 정책
- `files.order_id` 연결 정책
- `/api/files/download` signed URL redirect 로직
- Supabase schema, 1차에서는 변경하지 않음
- Cafe24 운영 스킨

## 10. 오류 및 빈 상태 처리 후보

구현 단계에서 사용할 수 있는 문구 후보입니다.

| 상황 | 문구 후보 |
|---|---|
| 주문번호가 없는 파일 | 주문번호가 연결되지 않아 고객정보를 확인할 수 없습니다. |
| Cafe24 주문 조회 실패 | Cafe24 주문 정보를 불러오지 못했습니다. 설정 탭의 OAuth 상태를 확인해 주세요. |
| OAuth token 만료 | Cafe24 API 연결 상태를 확인한 뒤 다시 시도해 주세요. |
| Cafe24 API 권한 부족 | Cafe24 주문 조회 권한이 부족할 수 있습니다. 앱 권한과 OAuth scope를 확인해 주세요. |
| 응답에는 주문이 있으나 고객정보 없음 | 고객정보 일부가 Cafe24 응답에 포함되지 않았습니다. |
| 네트워크 오류 | 일시적으로 주문 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요. |

오류 문구에는 access token, refresh token, authorization, API 응답 원문을 포함하지 않습니다.

## 11. 보안 기준

아래 기준은 구현 단계에서도 유지해야 합니다.

- Cafe24 Admin API 응답 전체를 화면에 표시하지 않습니다.
- Webhook raw payload 전체를 화면에 표시하지 않습니다.
- access token, refresh token, authorization, secret, signature 노출 금지
- 고객정보는 파일 상세 화면 중심으로 최소 표시합니다.
- 오늘 처리 탭에는 주소 전체를 표시하지 않습니다.
- 로그와 CSV에는 고객정보를 기본 포함하지 않습니다.
- 1차에서는 개인정보를 Supabase DB에 새로 저장하지 않습니다.
- 디자이너가 볼 필요 없는 개인정보는 최소화합니다.
- 전화번호, 이메일, 주소는 마스킹 또는 상세 화면 한정 표시를 우선 검토합니다.

## 12. 1차 구현 제안

조사 결과 기준 1차 구현 방향은 다음과 같습니다.

- `/admin` 파일 상세 화면에 `Cafe24 주문/고객 정보` 섹션을 추가합니다.
- `files.order_id`가 연결된 파일에서만 Cafe24 주문 조회를 시도합니다.
- Cafe24 API 조회 결과를 화면용 요약 객체로 변환해 표시합니다.
- 현재 이미 파싱 중인 상품명, 옵션, 추가 입력 옵션, 주문상태는 우선 활용합니다.
- 주문자명, 연락처, 이메일, 수령자명, 배송지는 실제 응답 필드 확인 후 추가합니다.
- 개인정보는 마스킹 가능한 경우에만 1차 표시합니다.
- DB 저장은 하지 않습니다.
- Webhook 로직은 변경하지 않습니다.
- 로그와 CSV는 변경하지 않습니다.

## 13. 구현 전 확인 필요 항목

- [ ] 실제 Cafe24 주문 상세 API 응답에서 주문자명 필드 확인
- [ ] 실제 Cafe24 주문 상세 API 응답에서 연락처 필드 확인
- [ ] 실제 Cafe24 주문 상세 API 응답에서 이메일 필드 확인
- [ ] 실제 Cafe24 주문 상세 API 응답에서 배송지 필드 확인
- [ ] 실제 Cafe24 주문 품목 API 응답에서 상품명/옵션/수량 필드 확인
- [ ] 배송상태와 결제상태 필드가 어느 응답에 있는지 확인
- [ ] OAuth token 상태 확인
- [ ] Cafe24 앱 scope에 주문 조회 권한이 충분한지 확인
- [ ] 전화번호, 이메일, 주소 마스킹 정책 확정
- [ ] 오늘 처리 탭에 고객정보를 넣을지 여부 결정

## 14. 이번 문서 작업에서 변경하지 않은 것

- 코드 변경 없음
- API 변경 없음
- DB/SQL 변경 없음
- Webhook 로직 변경 없음
- Cafe24 운영 스킨 변경 없음
- 실제 `/admin` 화면 변경 없음
- 개인정보 저장 구조 변경 없음
