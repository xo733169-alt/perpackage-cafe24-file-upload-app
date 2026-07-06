# Cafe24 주문상세 파일 상태 조회 안내 박스 삽입 코드 가이드

- 작성 기준: 2026-07-06
- 대상 화면: Cafe24 고객 마이페이지 주문조회 > 주문상세 화면
- 대상 템플릿 기준: `Myshop_OrderHistoryDetailBasic`
- 문서 성격: Cafe24 운영 스킨 적용 전 위치 표시용 코드 가이드

## 1. 문서 목적

이 문서는 Cafe24 고객 마이페이지 주문조회 > 주문상세 화면에서 파일 상태 조회 안내 박스를 넣을 정확한 위치를 표시하기 위한 적용용 코드 가이드입니다.

이번 문서는 검토와 복사용 가이드이며, 실제 Cafe24 운영 스킨 파일은 직접 수정하지 않습니다.

## 2. 삽입 기준 위치

`Myshop_OrderHistoryDetailBasic` 안의 각 `ec-base-prdInfo` 블록에서 아래 위치에 넣습니다.

삽입 위치:

```html
<p class="option {$option_display|display}">{$option_str}</p>
<ul class="option" module="Myshop_optionSet">...</ul>

<!-- 여기에 파일 상태 조회 안내 박스 삽입 -->

<div class="prdFoot" title="주문처리상태">
```

즉, 상품 옵션 정보가 끝난 바로 아래이며, 주문처리상태 영역인 `prdFoot` 바로 위입니다.

## 3. 절대 수정하지 말아야 할 것

아래 항목은 그대로 둡니다.

- `module` 속성
- `{$변수}` 형태의 Cafe24 템플릿 변수
- `onclick` 속성
- 주문취소 버튼
- 구매확정 버튼
- 교환/반품/취소 관련 버튼
- 기존 주문처리상태 영역
- 기존 상품 옵션 출력 구조

이번 작업에서 추가하는 것은 안내 박스 HTML과 공통 style뿐입니다.

## 4. 적용 전 찾을 코드 위치

Cafe24 스마트디자인에서 `Myshop_OrderHistoryDetailBasic` 영역 안의 상품 반복 블록을 찾습니다.

아래와 비슷한 구조를 찾습니다. 실제 운영 스킨에서는 중간 코드가 더 길 수 있습니다.

```html
<div module="Myshop_OrderHistoryDetailBasic">
  <!-- 기존 주문상세 코드 -->

  <div class="ec-base-prdInfo">
    <!-- 기존 상품 이미지, 상품명, 가격, 수량 등 -->

    <p class="option {$option_display|display}">{$option_str}</p>
    <ul class="option" module="Myshop_optionSet">
      <!-- 기존 옵션 출력 코드 -->
    </ul>

    <div class="prdFoot" title="주문처리상태">
      <!-- 기존 주문처리상태, 주문취소, 구매확정 등 버튼 영역 -->
    </div>
  </div>
</div>
```

## 5. 삽입 후 구조 예시

아래 예시는 위치를 보여주기 위한 형태입니다.

`module`, `{$변수}`, `onclick`, 주문취소/구매확정 버튼 코드는 그대로 두고, 표시된 안내 박스만 추가합니다.

```html
<div module="Myshop_OrderHistoryDetailBasic">
  <!-- 기존 주문상세 코드 -->

  <div class="ec-base-prdInfo">
    <!-- 기존 상품 이미지, 상품명, 가격, 수량 등 -->

    <p class="option {$option_display|display}">{$option_str}</p>
    <ul class="option" module="Myshop_optionSet">
      <!-- 기존 옵션 출력 코드 -->
    </ul>

    <!-- 파일 상태 조회 안내 박스 시작 -->
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
    <!-- 파일 상태 조회 안내 박스 끝 -->

    <div class="prdFoot" title="주문처리상태">
      <!-- 기존 주문처리상태, 주문취소, 구매확정 등 버튼 영역 -->
    </div>
  </div>
</div>
```

## 6. 실제 삽입할 짧은 문구 버전 스니펫

아래 HTML만 `p.option`과 `ul.option` 바로 아래, `prdFoot` 바로 위에 넣습니다.

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

## 7. 공통 style

아래 style은 같은 주문상세 템플릿 하단 또는 해당 화면에서 한 번만 로드되는 공통 CSS 위치에 넣습니다.

같은 style을 상품마다 반복해서 여러 번 넣지 않습니다.

```html
<style>
  .perpackage-file-status-box {
    box-sizing: border-box;
    width: 100%;
    margin: 14px 0 16px;
    padding: 16px;
    border: 1px solid #d8e2f2;
    border-radius: 8px;
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
    margin: 0 0 6px;
    padding: 3px 8px;
    border-radius: 999px;
    background: #e9f1ff;
    color: #1f4f9a;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0;
  }

  .perpackage-file-status-box__title {
    margin: 0 0 6px;
    color: #101828;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.35;
  }

  .perpackage-file-status-box__text {
    margin: 0 0 12px;
    color: #344054;
    font-size: 13px;
  }

  .perpackage-file-status-box__button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 38px;
    padding: 0 14px;
    border-radius: 8px;
    background: #173b72;
    color: #ffffff !important;
    font-size: 13px;
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
      margin: 12px 0 14px;
      padding: 14px;
    }

    .perpackage-file-status-box__button {
      width: 100%;
    }
  }
</style>
```

## 8. 적용 후 확인할 것

- [ ] 안내 박스가 각 `ec-base-prdInfo` 블록의 옵션 영역 아래에 보인다.
- [ ] 안내 박스가 `prdFoot` 주문처리상태 영역 위에 보인다.
- [ ] 기존 `module` 속성이 바뀌지 않았다.
- [ ] 기존 `{$변수}` 값이 바뀌지 않았다.
- [ ] 기존 `onclick` 코드가 바뀌지 않았다.
- [ ] 주문취소, 구매확정, 교환, 반품 버튼이 그대로 동작한다.
- [ ] 버튼 클릭 시 `/file-status` 페이지가 새 창 또는 새 탭으로 열린다.
- [ ] 안내 박스에 고객 다운로드 버튼이 없다.
- [ ] 안내 박스에 `storage_path`, signed URL, token, Webhook raw payload가 노출되지 않는다.
- [ ] 모바일 주문상세 화면에서 안내 박스가 화면 밖으로 밀리지 않는다.

## 9. 이번 문서 작업에서 변경하지 않은 것

- Cafe24 운영 스킨 직접 수정 없음
- 앱 코드 변경 없음
- API 파일 변경 없음
- DB/SQL 변경 없음
- Webhook 로직 변경 없음
- `/file-status` 기능 변경 없음
- `/admin` 기능 변경 없음
