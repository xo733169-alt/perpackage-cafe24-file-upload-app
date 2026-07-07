# Cafe24 상품상세 업로드 UX selector 확정 조사

작성 기준: 2026-07-07  
대상: Cafe24 상품상세 파일 업로드 위젯  
문서 성격: UX 구현 전 DOM selector 조사 문서

## 1. 조사 목적

상품상세 파일 업로드 UX를 개선하기 전에 실제 Cafe24 상품상세 DOM 기준으로 아래 selector 후보를 정리한다.

- 업로드 파일 ID 입력칸 selector
- 구매하기 버튼 selector
- 장바구니 버튼 selector
- 모바일 구매/장바구니 버튼 selector

이번 문서는 조사/설계 문서다. 실제 UX 구현, Cafe24 운영 스킨 수정, Webhook, DB/SQL, 다운로드 API, `/admin`, `/file-status`, `/reupload` 로직 변경은 하지 않았다.

## 2. 시작 전 Git 상태

- 브랜치: `main`
- 시작 전 작업트리: clean
- staged 파일: 없음
- 미추적 파일: 없음
- 로컬 HEAD: `0dbc1bcfac055108adf125ebe509b459ae26c7a9`
- origin/main: `0dbc1bcfac055108adf125ebe509b459ae26c7a9`
- origin/main이 로컬보다 앞서 있지 않음

## 3. 확인한 파일과 문서

- `public/cafe24/product-upload-widget.js`
- `docs/gpt-report-cafe24-file-id-order-option-success-20260630.md`
- `docs/gpt-report-cafe24-upload-widget-stability-20260702.md`
- `docs/gpt-report-cafe24-reupload-file-id-refresh-fix-20260702.md`
- `docs/gpt-report-product-detail-upload-widget-plan-20260630.md`
- `README.md`

실제 Cafe24 상품상세 HTML도 아래 URL 기준으로 정적 HTML을 확인했다.

- `https://peerl.cafe24.com/skin-skin17/product/detail.html?product_no=54&cate_no=1&display_group=10`

단, 옵션 선택 후 동적으로 생성되는 DOM과 모바일 sticky 버튼은 정적 HTML만으로 최종 확정할 수 없다. 구현 전 운영 브라우저 DevTools 또는 캡처로 추가 확인이 필요하다.

## 4. 현재 위젯 구조 요약

현재 상품상세 업로드 위젯 파일은 다음이다.

- `public/cafe24/product-upload-widget.js`

현재 위젯은 파일 업로드 후 반환된 `file_id`를 Cafe24 추가 입력 옵션인 “업로드 파일 ID” 입력칸에 자동 입력한다.

현재 동작 흐름:

1. 고객이 상품 옵션을 선택한다.
2. Cafe24가 추가 입력 옵션 입력칸을 DOM에 만든다.
3. 위젯이 “업로드 파일 ID” 입력칸을 찾는다.
4. 파일 업로드 성공 후 `file_id`를 해당 입력칸에 넣는다.
5. `input`, `change`, `blur` 이벤트를 발생시켜 Cafe24 주문 옵션 값으로 반영되게 한다.
6. 다시 업로드하면 최신 `file_id`로 값을 갱신한다.

현재 위젯은 옵션 선택 완료 자체를 직접 판정하지 않는다. 대신 “업로드 파일 ID” 입력칸이 DOM에 존재하는지를 기준으로 업로드 가능 여부를 판단한다.

## 5. 실제 Cafe24 HTML에서 확인된 설정

현재 확인한 상품상세 HTML에는 아래 설정이 들어 있다.

```html
window.PERPACKAGE_PRODUCT_UPLOAD_CONFIG = {
  appOrigin: "https://perpackage-cafe24-file-upload-app.vercel.app",
  mallId: "peerl",
  shopNo: "1",
  targetSelector: ".xans-product-detail .infoArea",
  fileIdInputSelector: "input[placeholder*='업로드 파일 ID'], textarea[placeholder*='업로드 파일 ID']"
};
```

현재 운영 HTML 기준으로 `fileIdInputSelector`는 이미 CONFIG에 들어가 있다.

## 6. 업로드 파일 ID 입력칸 selector 조사

### 현재 탐지 방식

현재 위젯은 아래 순서로 입력칸을 찾는다.

1. `CONFIG.fileIdInputSelector`
2. input/textarea/select 속성 기반 탐색
3. label, th, dt, strong, span 등 주변 텍스트 기반 탐색

탐색 키워드는 다음 계열을 포함한다.

- `업로드 파일 ID`
- `업로드파일ID`
- `file_id`
- `file id`
- `fileid`

### CONFIG 지원 여부

지원한다.

현재 코드에는 `CONFIG.fileIdInputSelector`를 먼저 사용하는 경로가 있고, 실제 Cafe24 HTML에도 아래 값이 들어 있다.

```js
fileIdInputSelector: "input[placeholder*='업로드 파일 ID'], textarea[placeholder*='업로드 파일 ID']"
```

### selector 고정 가능 여부

현재 확인한 상품상세 HTML 기준으로는 고정 가능성이 높다.

1차 추천 selector:

```css
input[placeholder*='업로드 파일 ID'], textarea[placeholder*='업로드 파일 ID']
```

다만 Cafe24 추가 입력 옵션 DOM은 옵션 선택 후 동적으로 생성될 수 있으므로, 구현 시에는 이 selector만 단독으로 믿기보다 현재 fallback을 유지하는 편이 안전하다.

### 현재 fallback 탐색 방식

속성 기반으로 다음 계열을 확인한다.

- `name`
- `id`
- `placeholder`
- `title`
- `aria-label`
- `data-*`

텍스트 기반으로 다음 주변 요소를 확인한다.

- `label`
- `th`
- `dt`
- `strong`
- `span`
- 인접 행/목록 구조의 텍스트

### readonly 및 이벤트 처리

현재 위젯은 `file_id` 입력 시 다음 처리를 한다.

- readonly 상태가 있으면 값을 넣기 위해 일시적으로 해제
- `value`에 최신 `file_id` 입력
- `data-perpackage-file-id` 설정
- `input`, `change`, `blur` 이벤트 발생
- 업로드 완료 후 고객이 임의 수정하지 않도록 readonly 처리
- 다시 업로드 시 기존 값을 최신 `file_id`로 갱신

### fallback 유지 필요 여부

유지 필요.

이유:

- Cafe24 스킨/상품/옵션 구성에 따라 추가 입력 옵션 input의 실제 속성이 달라질 수 있다.
- placeholder가 사라지거나 label만 남는 경우가 있을 수 있다.
- 옵션 선택 전에는 입력칸이 아직 DOM에 없을 수 있다.
- 모바일/PC DOM 생성 시점이 다를 수 있다.

### 위험도

낮음에서 중간.

현재 운영 HTML에 CONFIG selector가 이미 들어가 있고 fallback도 충분하지만, 옵션 선택 후 실제 생성되는 input의 최종 DOM은 브라우저에서 한 번 더 확인해야 한다.

### 추가 확인이 필요한 Cafe24 화면

운영 브라우저에서 아래 상태를 확인해야 한다.

- 옵션 선택 전: `input[placeholder*='업로드 파일 ID']`가 없는지
- 옵션 선택 후: 해당 selector로 input이 잡히는지
- 여러 옵션 조합에서도 동일한 input이 잡히는지
- 모바일 상품상세에서도 동일하게 잡히는지
- 다시 업로드 후 기존 input 값이 최신 `file_id`로 갱신되는지

## 7. 구매하기 버튼 selector 조사

### 현재 탐지 방식

현재 위젯은 구매하기 버튼 전용 CONFIG를 쓰지 않는다.

대신 전역 click capture 단계에서 클릭 대상과 주변 요소를 보고 아래 키워드/속성을 휴리스틱으로 판정한다.

- 텍스트: `구매`, `주문`, `buy`, `order`
- href/onclick/class/id/name 속성
- `product_submit` 계열 onclick

### 실제 Cafe24 HTML에서 확인된 구매하기 구조

정적 HTML에서 구매하기 버튼은 아래 구조로 확인되었다.

```html
<a href="#none" onclick="product_submit(1, '/skin-skin17/exec/front/order/basket/', this)">
  <span id="btnBuy" class="-btn -block -xl mColor">구매하기</span>
</a>
```

### CONFIG 고정 후보

구매하기 버튼 차단/허용 로직을 구현한다면 가장 명확한 후보는 아래다.

```css
a[onclick*="product_submit(1,"]
```

보조 후보:

```css
#btnBuy
```

다만 실제 click handler는 `#btnBuy` span이 아니라 부모 `a`에 붙어 있다. 따라서 차단 로직은 `#btnBuy`만 막기보다 부모 `a[onclick*="product_submit(1,"]`를 기준으로 잡는 것이 더 안전하다.

### 추천 방식

향후 CONFIG를 추가한다면 아래처럼 분리하는 편이 좋다.

```js
buyButtonSelector: "a[onclick*='product_submit(1,']"
```

### 위험도

중간.

`product_submit(1, ...)` 구조는 현재 스킨에서는 명확하지만, Cafe24 스킨 수정 또는 모바일 전용 버튼 복제 구조에서는 다른 버튼이 추가될 수 있다.

## 8. 장바구니 버튼 selector 조사

### 현재 탐지 방식

현재 위젯은 장바구니 버튼 전용 CONFIG를 쓰지 않는다.

구매하기와 동일하게 텍스트/속성 기반 휴리스틱으로 `장바구니`, `basket`, `cart` 계열 액션을 감지한다.

### 실제 Cafe24 HTML에서 확인된 장바구니 구조

정적 HTML에서 상품 구매 영역의 장바구니 버튼은 아래 구조로 확인되었다.

```html
<a href="#none" class=" -btn -block -xl -white" onclick="product_submit(2, '/skin-skin17/exec/front/order/basket/', this)">
  <i class="xi-cart-o"></i>
</a>
```

### CONFIG 고정 후보

장바구니 버튼 차단/허용 로직을 구현한다면 가장 명확한 후보는 아래다.

```css
a[onclick*="product_submit(2,"]
```

보조 후보:

```css
a[onclick*="/exec/front/order/basket/"][onclick*="product_submit(2,"]
```

### 추천 방식

향후 CONFIG를 추가한다면 아래처럼 분리하는 편이 좋다.

```js
cartButtonSelector: "a[onclick*='product_submit(2,']"
```

### 주의점

페이지 안에는 상품 구매 영역의 장바구니 버튼 외에도 헤더 장바구니 링크가 있다.

예:

```html
<a href="/skin-skin17/order/basket.html">장바구니</a>
```

따라서 단순히 `a[href*='basket']`로 잡으면 헤더 장바구니 이동 링크까지 포함될 수 있다. 업로드 완료 전 구매 진행 차단 목적이라면 `product_submit(2, ...)` 기반 selector가 더 안전하다.

### 위험도

중간.

현재 상품상세 본문 장바구니 버튼은 명확하지만, 모바일 sticky 영역이나 스킨 변경 시 버튼이 복제될 수 있다.

## 9. 모바일 구매/장바구니 버튼 selector 조사

### 현재 확인 결과

정적 HTML만으로 모바일 전용 구매/장바구니 버튼 selector는 최종 확정하지 못했다.

현재 확인된 PC 구매 영역 selector:

```css
a[onclick*="product_submit(1,"]
a[onclick*="product_submit(2,"]
```

이 selector가 모바일에서도 동일하게 적용되는지 확인이 필요하다.

### 모바일에서 확인해야 할 가능성

Cafe24 스킨에 따라 모바일에서는 아래 구조가 추가될 수 있다.

- 하단 sticky 구매 버튼
- 옵션 선택 레이어 안의 구매 버튼
- PC 버튼을 CSS로 재배치한 동일 DOM
- 별도 mobile action 영역에 복제된 버튼

### 모바일 CONFIG 후보

모바일에서도 `product_submit` onclick을 그대로 사용한다면 아래 selector를 공통으로 사용할 수 있다.

```css
a[onclick*="product_submit(1,"], a[onclick*="product_submit(2,"]
```

모바일 전용 selector를 별도로 둔다면 아래처럼 둘 수 있다.

```js
mobileOrderActionSelector: "a[onclick*='product_submit(1,'], a[onclick*='product_submit(2,']"
```

### 추가 확인이 필요한 Cafe24 화면

모바일 viewport에서 아래를 확인해야 한다.

- 옵션 선택 전 구매/장바구니 버튼 DOM
- 옵션 선택 후 구매/장바구니 버튼 DOM
- 하단 sticky 버튼이 별도 DOM인지
- 클릭 대상이 `a`인지, `span`인지, `button`인지
- 실제 onclick에 `product_submit(1, ...)`, `product_submit(2, ...)`가 유지되는지

### 위험도

중간에서 높음.

모바일 버튼은 스킨마다 구조가 달라질 가능성이 크므로 실제 모바일 화면 DevTools 확인 전까지는 확정 selector로 보기 어렵다.

## 10. CONFIG 제안안

향후 UX 구현 시 CONFIG는 아래처럼 명시적으로 확장하는 방식을 권장한다.

```js
window.PERPACKAGE_PRODUCT_UPLOAD_CONFIG = {
  appOrigin: "https://perpackage-cafe24-file-upload-app.vercel.app",
  mallId: "peerl",
  shopNo: "1",
  targetSelector: ".xans-product-detail .infoArea",
  fileIdInputSelector: "input[placeholder*='업로드 파일 ID'], textarea[placeholder*='업로드 파일 ID']",
  buyButtonSelector: "a[onclick*='product_submit(1,']",
  cartButtonSelector: "a[onclick*='product_submit(2,']",
  mobileOrderActionSelector: "a[onclick*='product_submit(1,'], a[onclick*='product_submit(2,']"
};
```

단, 실제 구현 전에 모바일 DOM 확인 후 `mobileOrderActionSelector`를 유지할지, PC와 같은 selector로 통합할지 결정해야 한다.

## 11. 옵션 선택 완료 감지 기준 제안

현재 상황에서는 옵션 선택 완료를 직접 판정하기보다 아래 기준을 우선 권장한다.

```txt
업로드 파일 ID 입력칸이 DOM에 존재하면 업로드 가능 상태로 본다.
```

이 방식이 안전한 이유:

- 현재 주문에 필요한 `file_id`를 넣을 실제 대상 input 존재 여부를 직접 확인할 수 있다.
- Cafe24 옵션 DOM 구조 전체를 해석하지 않아도 된다.
- 필수 옵션이 여러 개인 상품에서도 최종적으로 추가 입력 옵션 input이 생겼는지로 판단할 수 있다.
- 구현 복잡도가 낮고 기존 위젯 구조와 맞다.

주의점:

- 상품 옵션 없이 바로 구매 가능한 상품이 있다면 추가 입력 옵션 input 생성 시점이 다를 수 있다.
- 추가 입력 옵션명이 바뀌면 selector와 fallback 키워드도 함께 수정해야 한다.
- Cafe24 스킨이 placeholder 없이 label만 노출하는 구조로 바뀌면 fallback 의존도가 높아진다.

## 12. 구매하기/장바구니 차단 기준 제안

업로드 완료 전 구매하기/장바구니를 막는 로직은 아래 기준이 안전하다.

차단 조건:

- 업로드 파일 ID 입력칸이 아직 없음
- 파일이 선택되었지만 업로드 완료 전임
- 업로드가 실패했거나 `file_id` 입력이 완료되지 않음
- 입력칸의 현재 값이 마지막 업로드 성공 `file_id`와 다름

허용 조건:

- 업로드 파일 ID 입력칸이 존재함
- 업로드 성공 후 최신 `file_id`가 입력칸에 반영됨
- 입력칸 값과 마지막 성공 `file_id`가 일치함

구매하기 클릭 순간에 처음 업로드하는 방식은 권장하지 않는다.

이유:

- Cafe24 기본 구매 이벤트와 비동기 업로드 타이밍이 충돌할 수 있다.
- 업로드 실패 시 구매 진행을 안정적으로 되돌리기 어렵다.
- 모바일 브라우저에서 파일 선택/업로드 권한 흐름이 예측하기 어렵다.
- 주문 옵션에 `file_id`가 반영되기 전에 주문이 진행될 위험이 있다.

## 13. 구현 전 사용자에게 필요한 추가 확인 자료

UX 구현 전에 아래 자료를 사용자에게 요청하는 것이 좋다.

### PC 화면

- 옵션 선택 전 상품상세 HTML 또는 DevTools 캡처
- 옵션 선택 후 “업로드 파일 ID” 입력칸이 보이는 상태의 DevTools 캡처
- 구매하기 버튼 요소 캡처
- 장바구니 버튼 요소 캡처

### 모바일 화면

- 옵션 선택 전 모바일 상품상세 버튼 영역 캡처
- 옵션 선택 후 모바일 구매/장바구니 버튼 영역 DevTools 캡처
- 하단 sticky 버튼이 있다면 해당 요소 캡처
- 모바일에서 “업로드 파일 ID” 입력칸이 생성된 상태 캡처

### 확인할 속성

각 요소에서 아래 값을 확인하면 좋다.

- tag name
- id
- class
- name
- placeholder
- onclick
- href
- 버튼 텍스트
- 부모 요소 class

## 14. selector 확정 요약

| 대상 | 추천 selector | 확정도 | 비고 |
|---|---|---:|---|
| 업로드 파일 ID 입력칸 | `input[placeholder*='업로드 파일 ID'], textarea[placeholder*='업로드 파일 ID']` | 높음 | 운영 HTML의 CONFIG에 이미 존재. fallback 유지 권장 |
| 구매하기 버튼 | `a[onclick*='product_submit(1,']` | 중간-높음 | 현재 HTML에서 확인. 부모 `a` 기준 권장 |
| 장바구니 버튼 | `a[onclick*='product_submit(2,']` | 중간-높음 | 헤더 장바구니 링크와 구분 가능 |
| 모바일 구매/장바구니 | `a[onclick*='product_submit(1,'], a[onclick*='product_submit(2,']` | 중간 | 모바일 전용 DOM 확인 필요 |

## 15. 변경하지 않은 항목

이번 작업에서는 아래 항목을 변경하지 않았다.

- Cafe24 운영 스킨
- `public/cafe24/product-upload-widget.js` 로직
- Webhook 수신/자동 연결 로직
- Supabase DB/SQL/migration
- 다운로드 API
- `/admin`
- `/file-status`
- `/reupload`
- Naver Object Storage 로직
- Cafe24 주문 조회 로직

## 16. 다음 구현 시 권장 순서

1. 모바일/PC DevTools로 selector 최종 확인
2. CONFIG에 구매/장바구니 selector 추가
3. 업로드 영역을 “업로드 파일 ID 입력칸 존재 여부” 기준으로 표시/비활성화
4. 파일 선택 또는 드래그앤드롭 시 자동 업로드
5. 업로드 중/실패/완료 상태 UI 추가
6. 구매하기/장바구니 클릭 capture 단계에서 업로드 완료 여부 검증
7. `node --check public/cafe24/product-upload-widget.js` 실행
8. Cafe24 테스트 상품에서 PC/모바일 수동 확인

## 17. 배포 전 멈춘 지점

이번 작업은 selector 조사 문서 작성까지만 진행했다.

UX 구현, 커밋, push, Vercel 배포는 진행하지 않았다.
