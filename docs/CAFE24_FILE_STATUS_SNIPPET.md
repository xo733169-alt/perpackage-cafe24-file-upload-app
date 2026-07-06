# Cafe24 고객 마이페이지 주문조회 > 주문상세 파일 상태 조회 안내 박스 스니펫

- 작성 기준: 2026-07-06
- 대상 화면: Cafe24 고객 마이페이지 주문조회 > 주문상세 화면
- 문서 성격: 스마트디자인 삽입 전 검토용 HTML/CSS 스니펫

## 1. 문서 목적

이 문서는 Cafe24 고객 마이페이지 주문조회 > 주문상세 화면에서 고객이 업로드 파일 상태 조회 페이지로 이동할 수 있도록 안내 박스를 추가하기 위한 검토용 스니펫입니다.

1차 적용 방향은 다음과 같습니다.

- 고객은 `/file-status`에서 주문번호와 업로드 파일 ID를 직접 입력합니다.
- 주문번호는 상단 주문번호 또는 품목별 주문번호 끝에 `-01`, `-02`가 붙은 값도 사용할 수 있습니다.
- 상품상세와 장바구니는 파일 상태조회 위치로 사용하지 않습니다.
- 상품상세에는 파일 업로드 위젯만 유지하고, 파일 상태조회는 주문 완료 후 고객이 다시 확인하는 마이페이지 주문조회 > 주문상세 쪽에 둡니다.
- URL에 `order_id`나 `file_id`를 자동으로 붙이지 않습니다.
- 파일 다운로드는 상태 조회 화면에서 제공하지 않습니다.
- `file_id` 자동 파싱 JS는 1차에서 사용하지 않습니다.
- 이번 문서는 실제 운영 적용 전 검토용이며, Cafe24 스마트디자인 운영 코드는 수정하지 않습니다.

## 2. 삽입 위치 권장안

### 권장 위치

- Cafe24 고객 마이페이지 주문조회 > 주문상세 화면의 주문 상품 정보 영역 근처
- 업로드 파일 ID가 상품 옵션으로 보이는 영역 아래 또는 주변
- 고객이 주문번호와 `file_id`를 함께 확인할 수 있는 위치

### 피해야 할 위치

- 상품상세 화면: 이 위치는 파일 업로드 위젯만 두는 영역입니다.
- 장바구니 화면: 주문 완료 전 단계라 파일 상태조회 안내 위치로 적합하지 않습니다.
- 결제 금액 영역 안쪽
- 배송 상태 버튼 주변
- 관리자 전용 영역
- 모바일에서 표가 좁아질 수 있는 테이블 내부
- 기존 주문 처리 버튼 바로 옆처럼 고객이 다른 기능으로 오해할 수 있는 위치

## 3. 안내 박스 문구 기준

안내 박스에는 아래 내용을 짧게 포함합니다.

- 업로드한 인쇄용 파일의 확인 상태를 조회할 수 있음
- 조회 시 Cafe24 주문번호와 업로드 파일 ID가 필요함
- 품목별 주문번호 끝에 `-01`, `-02`가 붙어 있어도 조회 가능함
- 상태 조회 화면에서는 파일 다운로드를 제공하지 않음
- 재업로드가 필요한 경우 안내받은 재업로드 링크로 수정 파일을 업로드해야 함

## 4. 버튼 문구 후보

| 후보 | 설명 | 추천 여부 |
|---|---|---|
| 업로드 파일 상태 조회하기 | 고객이 무엇을 하는 버튼인지 가장 명확함 | 1차 추천 |
| 인쇄용 파일 상태 확인 | 짧고 부드럽지만 업로드 맥락이 약함 | 보조 후보 |
| 파일 확인 상태 조회 | 의미는 맞지만 표현이 조금 딱딱함 | 보조 후보 |

1차 추천 버튼 문구는 **업로드 파일 상태 조회하기**입니다.

## 5. 권장 HTML/CSS 스니펫

아래 코드는 Cafe24 스마트디자인 HTML 영역에 붙여넣기 전 검토용 초안입니다.

```html
<div class="perpackage-file-status-box" role="region" aria-label="업로드 파일 상태 조회 안내">
  <div class="perpackage-file-status-box__label">페르패키지 파일 확인 안내</div>
  <h3 class="perpackage-file-status-box__title">업로드 파일 상태를 확인해 주세요</h3>
  <p class="perpackage-file-status-box__text">
    업로드한 인쇄용 파일의 접수 및 확인 상태는 파일 상태 조회 페이지에서 확인할 수 있습니다.
  </p>

  <ul class="perpackage-file-status-box__list">
    <li>Cafe24 주문번호와 업로드 파일 ID를 입력해 주세요.</li>
    <li>품목별 주문번호 끝에 -01, -02가 붙어 있어도 조회할 수 있습니다.</li>
    <li>상태 조회 화면에서는 파일 다운로드를 제공하지 않습니다.</li>
    <li>재업로드가 필요한 경우 안내받은 재업로드 링크로 수정 파일을 업로드해 주세요.</li>
  </ul>

  <a
    class="perpackage-file-status-box__button"
    href="https://perpackage-cafe24-file-upload-app.vercel.app/file-status"
    target="_blank"
    rel="noopener noreferrer"
  >
    업로드 파일 상태 조회하기
  </a>
</div>

<style>
  .perpackage-file-status-box {
    box-sizing: border-box;
    width: 100%;
    margin: 20px 0;
    padding: 20px;
    border: 1px solid #d8e2f2;
    border-radius: 10px;
    background: #f8fbff;
    color: #172033;
    font-family: inherit;
    line-height: 1.6;
  }

  .perpackage-file-status-box *,
  .perpackage-file-status-box *::before,
  .perpackage-file-status-box *::after {
    box-sizing: border-box;
  }

  .perpackage-file-status-box__label {
    display: inline-block;
    margin: 0 0 8px;
    padding: 3px 8px;
    border-radius: 999px;
    background: #e9f1ff;
    color: #1f4f9a;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0;
  }

  .perpackage-file-status-box__title {
    margin: 0 0 8px;
    color: #101828;
    font-size: 18px;
    font-weight: 700;
    line-height: 1.35;
  }

  .perpackage-file-status-box__text {
    margin: 0 0 12px;
    color: #344054;
    font-size: 14px;
  }

  .perpackage-file-status-box__list {
    margin: 0 0 16px;
    padding-left: 18px;
    color: #475467;
    font-size: 13px;
  }

  .perpackage-file-status-box__list li {
    margin: 4px 0;
  }

  .perpackage-file-status-box__button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 0 16px;
    border-radius: 8px;
    background: #173b72;
    color: #ffffff !important;
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    text-align: center;
    text-decoration: none !important;
  }

  .perpackage-file-status-box__button:hover,
  .perpackage-file-status-box__button:focus {
    background: #0f2a52;
    color: #ffffff !important;
    text-decoration: none !important;
  }

  @media (max-width: 640px) {
    .perpackage-file-status-box {
      margin: 16px 0;
      padding: 16px;
      border-radius: 8px;
    }

    .perpackage-file-status-box__title {
      font-size: 16px;
    }

    .perpackage-file-status-box__button {
      width: 100%;
    }
  }
</style>
```

## 6. 더 짧은 문구 버전

Cafe24 고객 마이페이지 주문조회 > 주문상세 화면이 좁거나 안내 문구가 길게 느껴질 경우 아래 문구로 줄일 수 있습니다.

```html
<div class="perpackage-file-status-box" role="region" aria-label="업로드 파일 상태 조회 안내">
  <div class="perpackage-file-status-box__label">페르패키지 파일 확인 안내</div>
  <h3 class="perpackage-file-status-box__title">업로드 파일 상태 조회</h3>
  <p class="perpackage-file-status-box__text">
    Cafe24 주문번호와 업로드 파일 ID로 인쇄용 파일의 확인 상태를 조회할 수 있습니다.
    품목별 주문번호 끝에 -01, -02가 붙어 있어도 조회 가능합니다.
  </p>
  <a
    class="perpackage-file-status-box__button"
    href="https://perpackage-cafe24-file-upload-app.vercel.app/file-status"
    target="_blank"
    rel="noopener noreferrer"
  >
    업로드 파일 상태 조회하기
  </a>
</div>
```

짧은 문구 버전을 사용할 경우에도 5번의 `<style>` 코드는 함께 사용합니다.

## 7. 운영 적용 전 확인할 것

- Cafe24 고객 마이페이지 주문조회 > 주문상세 화면에서 업로드 파일 ID가 고객에게 보이는지 확인합니다.
- 고객이 주문번호와 업로드 파일 ID를 같은 화면에서 찾을 수 있는지 확인합니다.
- 버튼 클릭 시 `/file-status`가 새 창 또는 새 탭으로 열리는지 확인합니다.
- 모바일 주문상세 화면에서 안내 박스가 표 너비를 밀어내지 않는지 확인합니다.
- 기존 주문상세 화면의 결제, 배송, 취소, 교환 버튼과 혼동되지 않는지 확인합니다.
- 상품상세에는 기존 파일 업로드 위젯만 남아 있는지 확인합니다.
- 장바구니에는 파일 상태조회 안내 박스를 넣지 않았는지 확인합니다.
- Cafe24 스킨 CSS 때문에 버튼 색상이나 여백이 깨지지 않는지 확인합니다.

## 8. 보안 기준

- URL에 `order_id`와 `file_id`를 자동으로 붙이지 않습니다.
- 고객 화면에는 다운로드 링크를 제공하지 않습니다.
- `storage_path`, signed URL, `token_hash`, raw token, Webhook raw payload를 넣지 않습니다.
- Admin API 응답 전체나 내부 로그 내용을 안내 박스에 노출하지 않습니다.
- 재업로드 링크는 이 안내 박스에서 자동 표시하지 않습니다.
- 재업로드가 필요한 경우 기존 `/reupload?token=...` 방식으로 별도 안내합니다.

## 9. 이번 문서 작업에서 변경하지 않은 것

- 앱 코드 변경 없음
- API 파일 변경 없음
- DB/SQL 변경 없음
- Webhook 로직 변경 없음
- Cafe24 스마트디자인 운영 코드 변경 없음
- `/file-status` 기능 변경 없음
- `/admin` 기능 변경 없음
- `/reupload` 기능 변경 없음
