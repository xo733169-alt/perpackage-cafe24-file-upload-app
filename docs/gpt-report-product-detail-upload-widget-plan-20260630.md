# GPT 보고서: Cafe24 상품상세 업로드 UI 테스트 삽입 준비

작성일: 2026-06-30  
프로젝트: `perpackage-cafe24-file-upload-app`

## 1. 작업 목적

Phase 1 연결 검증이 완료된 상태에서, 다음 단계로 Cafe24 상품상세 페이지에 파일 업로드 UI를 테스트 삽입하기 위한 정적 프론트 스크립트 초안을 준비했다.

이번 작업은 운영몰 전체 적용이 아니라 테스트 상품 1개 기준으로 삽입 방식을 검토하기 위한 준비 작업이다.

## 2. 생성한 파일

```txt
public/cafe24/product-upload-widget.js
docs/gpt-report-product-detail-upload-widget-plan-20260630.md
```

## 3. 수정하지 않은 기능

이번 작업에서는 아래 기능을 구현하지 않았다.

```txt
ScriptTags API 실제 등록
주문 연동
상품 입력 옵션 file_id 자동 삽입
Webhook 구현
100MB 업로드
presigned URL 업로드
multipart upload
Cafe24 장바구니/구매 버튼 오버라이드
Cafe24 기본 상품 옵션 오버라이드
```

## 4. 삽입 UI 구조

위젯 wrapper:

```html
<section id="app-perpackage-product-upload" aria-label="Perpackage print file upload">
  <h3>인쇄파일 업로드</h3>
  <p>AI, PDF, ZIP, DXF 파일 업로드를 권장합니다...</p>
  <form>
    <input name="file" type="file" required>
    <button type="submit">파일 업로드</button>
    <p role="status"></p>
    <div hidden></div>
  </form>
</section>
```

업로드 성공 시 화면에 표시하는 값:

```txt
file_id
original_filename
status
```

## 5. CSS/JS 네임스페이스

CSS/JS는 아래 wrapper 내부에만 적용되도록 작성했다.

```txt
#app-perpackage-product-upload
```

내부 class prefix:

```txt
ppu-
```

예:

```txt
ppu-title
ppu-desc
ppu-form
ppu-file
ppu-button
ppu-status
ppu-result
```

스타일은 JS가 `<style id="app-perpackage-product-upload-style">`로 한 번만 주입한다.

## 6. JS 실행 방식

스크립트는 IIFE로 실행된다.

```js
(function () {
  "use strict";
  ...
})();
```

`window.onload`는 사용하지 않았다.

DOM 준비 방식:

```txt
document.readyState === "loading"이면 DOMContentLoaded once listener 사용
이미 DOM이 준비되어 있으면 즉시 renderWidget() 실행
```

## 7. 중복 삽입 방지

아래 wrapper가 이미 있으면 스크립트가 바로 종료된다.

```txt
app-perpackage-product-upload
```

스타일도 아래 id가 있으면 중복 주입하지 않는다.

```txt
app-perpackage-product-upload-style
```

## 8. 업로드 endpoint

기존 endpoint를 그대로 사용한다.

```txt
POST /api/files/upload
```

정적 스크립트가 다른 도메인에서 실행될 수 있으므로, API origin은 `document.currentScript.src` 기준으로 자동 계산한다.

예:

```txt
https://perpackage-cafe24-file-upload-app.vercel.app/cafe24/product-upload-widget.js
```

위 경로로 script를 불러오면 업로드 endpoint는 아래로 계산된다.

```txt
https://perpackage-cafe24-file-upload-app.vercel.app/api/files/upload
```

## 9. FormData 전송 필드

스크립트가 전송하는 FormData:

```txt
file
mall_id
shop_no
product_no
customer_type
customer_identifier
```

기본값:

```txt
mall_id: peerl
shop_no: 1
customer_type: cafe24-product-detail
customer_identifier: 현재 상품상세 URL
```

## 10. product_no 가져오는 방식

우선 안전한 fallback 방식으로 작성했다.

탐색 순서:

1. `window.PERPACKAGE_PRODUCT_UPLOAD_CONFIG.productNo`
2. `input[name="product_no"]`
3. `input[name="product_no[]"]`
4. `input#product_no`
5. `[data-product-no]`
6. `[data-product_no]`
7. `window.iProductNo`
8. `window.product_no`
9. `window.productNo`
10. `window.CAFE24.PRODUCT_NO`
11. URL path `/product/.../{number}` 패턴
12. 찾지 못하면 빈 값

product_no를 못 찾아도 업로드 자체는 시도할 수 있게 했다.

## 11. Cafe24 상품상세에 붙일 때 필요한 위치

테스트 상품 1개에서 우선 아래 중 하나에 삽입하는 방식이 안전하다.

권장 위치:

```txt
상품상세 스킨의 상품 옵션/구매 버튼 영역 근처
```

가능한 target 후보:

```txt
.xans-product-detail .infoArea
.xans-product-detail
#prdDetail
#contents
form[action*="basket"]
form
```

기본 스크립트는 위 후보 중 먼저 발견되는 영역 안에 wrapper를 append한다.

특정 위치에 넣고 싶으면 아래처럼 config를 먼저 선언한다.

```html
<script>
  window.PERPACKAGE_PRODUCT_UPLOAD_CONFIG = {
    appOrigin: "https://perpackage-cafe24-file-upload-app.vercel.app",
    mallId: "peerl",
    shopNo: "1",
    targetSelector: ".xans-product-detail .infoArea"
  };
</script>
<script src="https://perpackage-cafe24-file-upload-app.vercel.app/cafe24/product-upload-widget.js"></script>
```

## 12. 테스트 방법

### 로컬/배포 파일 확인

배포 후 아래 URL이 열리는지 확인한다.

```txt
https://perpackage-cafe24-file-upload-app.vercel.app/cafe24/product-upload-widget.js
```

### Cafe24 테스트 상품 1개에 임시 삽입

Cafe24 상품상세 스킨 또는 테스트 상품 설명 영역에 아래 코드를 임시 삽입한다.

```html
<script>
  window.PERPACKAGE_PRODUCT_UPLOAD_CONFIG = {
    appOrigin: "https://perpackage-cafe24-file-upload-app.vercel.app",
    mallId: "peerl",
    shopNo: "1",
    targetSelector: ".xans-product-detail .infoArea"
  };
</script>
<script src="https://perpackage-cafe24-file-upload-app.vercel.app/cafe24/product-upload-widget.js"></script>
```

확인 항목:

1. 상품상세에 `인쇄파일 업로드` UI가 보이는지
2. 중복 새로고침/재실행 시 wrapper가 중복 삽입되지 않는지
3. Cafe24 상품 옵션 선택이 그대로 동작하는지
4. 장바구니/구매 버튼 동작이 그대로 유지되는지
5. 파일 선택 후 업로드 시도 시 `/api/files/upload`로 요청되는지
6. 성공 시 `file_id`, `original_filename`, `status`가 보이는지
7. Supabase `files` 테이블에 row가 생성되는지
8. Naver Object Storage에 파일이 저장되는지
9. `/admin` 최근 업로드 파일 목록에 표시되는지

## 13. 주의할 점

Cafe24 상품상세 도메인에서 Vercel API로 직접 `fetch`할 경우 브라우저 CORS 정책 영향을 받을 수 있다.

이번 작업에서는 기존 `/api/files/upload` endpoint 자체를 수정하지 않았으므로, 실제 Cafe24 상품상세에서 업로드 요청이 CORS로 막히면 다음 단계에서 `/api/files/upload`에 허용 origin을 명시하는 방식으로 보완해야 한다.

단, CORS 보완 시에도 token, secret, service role key는 절대 브라우저로 노출하면 안 된다.

## 14. 다음 단계 제안

1. GitHub push 및 Vercel Production 배포
2. `/cafe24/product-upload-widget.js` 정적 파일 접근 확인
3. Cafe24 테스트 상품 1개에 snippet 임시 삽입
4. UI 표시 및 기존 옵션/구매 버튼 영향 없음 확인
5. 업로드 요청 CORS 여부 확인
6. 필요 시 `/api/files/upload` CORS allowlist 추가
7. 업로드 성공 후 Supabase/Naver/admin 표시까지 왕복 확인
8. 안정화 후 ScriptTags API 등록 설계
9. 이후 상품 입력 옵션 `file_id` 자동 삽입 또는 주문 연동 설계

## 15. GPT에게 전달할 핵심 요약

Cafe24 상품상세 테스트 삽입용 정적 JS 초안을 `public/cafe24/product-upload-widget.js`로 만들었다.  
위젯은 `#app-perpackage-product-upload` wrapper와 `ppu-` class namespace를 사용하며, IIFE와 `DOMContentLoaded` 방식으로 실행된다.  
중복 삽입 방지, product_no fallback 탐색, 기존 `/api/files/upload` FormData 업로드, 성공 결과 표시를 포함한다.  
이번 작업에서는 ScriptTags API 등록, 주문 연동, file_id 자동 삽입, Webhook, multipart/presigned upload는 구현하지 않았다.
