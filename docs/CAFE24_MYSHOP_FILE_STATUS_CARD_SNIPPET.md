# Cafe24 마이쇼핑 파일 상태조회 바로가기 카드 스니펫

- 작성 기준: 2026-07-06
- 대상 화면: Cafe24 고객 마이쇼핑 메인
- 문서 성격: 운영 스킨 적용 전 HTML/CSS 스니펫 문서

## 1. 문서 목적

이 문서는 Cafe24 고객 마이쇼핑 메인에 “업로드 파일 상태 조회” 바로가기 카드를 추가하기 위한 HTML/CSS 스니펫 문서입니다.

목적은 다음과 같습니다.

- 고객이 마이쇼핑 메인에서 `/file-status` 상태조회 페이지를 쉽게 찾게 합니다.
- 고객은 `/file-status`에서 주문번호와 업로드 파일 ID를 직접 입력합니다.
- 마이쇼핑 메인 카드는 보조 진입점이며, 핵심 확인 위치는 주문조회 > 주문상세 화면입니다.
- URL 자동 입력은 하지 않습니다.
- 고객 다운로드 기능은 제공하지 않습니다.

## 2. 권장 삽입 위치

### 권장 위치

- `<div module="myshop_main" class="btn">` 안의 `<ul>` 메뉴 카드 영역
- 주문조회 카드 바로 다음 또는 주문조회 근처
- 고객이 주문 관련 메뉴와 함께 볼 수 있는 위치

예상 구조는 다음과 같습니다.

```html
<div module="myshop_main" class="btn">
  <ul>
    <li><a href="/myshop/order/list.html">주문조회</a></li>

    <!-- 여기에 업로드 파일 상태 조회 카드 삽입 -->

    <li><a href="/member/modify.html">회원정보</a></li>
    <li><a href="/myshop/wish_list.html">관심상품</a></li>
  </ul>
</div>
```

### 피해야 할 위치

- 장바구니
- 상품상세
- 주문/결제 기능 버튼 내부
- `module` 속성을 깨뜨리는 위치
- `onclick` 동작이 있는 기능 버튼 내부
- 기존 주문조회, 회원정보, 배송주소록 링크를 대체하는 위치

## 3. 카드 문구

| 구분 | 문구 |
|---|---|
| 추천 카드명 | 업로드 파일 상태 조회 |
| 보조 문구 | 주문번호와 업로드 파일 ID로 파일 확인 상태를 조회합니다. |
| 주의 문구 | 업로드 파일 ID는 주문상세의 상품 옵션에서 확인할 수 있습니다. |
| 영문 보조 텍스트 | File Status |

고객에게는 주문번호와 업로드 파일 ID가 필요하다는 점을 반드시 안내합니다.

## 4. HTML 스니펫

아래 HTML을 마이쇼핑 메인 카드 영역의 `<ul>` 안에 넣습니다.

기존 `module`, `{$변수}`, `onclick` 코드는 수정하지 않습니다.

```html
<li class="perpackage-myshop-file-status-card">
  <a
    href="https://perpackage-cafe24-file-upload-app.vercel.app/file-status"
    target="_blank"
    rel="noopener noreferrer"
  >
    <i class="xi-file-check-o" aria-hidden="true"></i>
    <span class="perpackage-myshop-file-status-card__title">업로드 파일 상태 조회</span>
    <sub>File Status</sub>
    <span class="perpackage-myshop-file-status-card__desc">
      주문번호와 업로드 파일 ID가 필요합니다.
    </span>
  </a>
</li>
```

아이콘 클래스는 Cafe24 스킨에서 `xi` 계열 아이콘을 사용 중인 경우를 고려한 예시입니다. 아이콘이 표시되지 않아도 링크와 문구는 정상 동작해야 합니다.

## 5. CSS 스니펫

기존 마이쇼핑 카드 스타일을 최대한 활용하고, 새 카드에 필요한 최소 스타일만 추가합니다.

CSS는 같은 페이지에서 한 번만 넣습니다.

```html
<style>
  .perpackage-myshop-file-status-card a {
    border-color: #d8e2f2;
    background: #f8fbff;
  }

  .perpackage-myshop-file-status-card a:hover,
  .perpackage-myshop-file-status-card a:focus {
    border-color: #173b72;
    background: #eef5ff;
  }

  .perpackage-myshop-file-status-card__title {
    display: block;
    color: #173b72;
    font-weight: 700;
  }

  .perpackage-myshop-file-status-card__desc {
    display: block;
    margin-top: 6px;
    color: #475467;
    font-size: 12px;
    line-height: 1.45;
    word-break: keep-all;
  }

  .perpackage-myshop-file-status-card i {
    color: #173b72;
  }

  @media (max-width: 640px) {
    .perpackage-myshop-file-status-card__desc {
      font-size: 11px;
    }
  }
</style>
```

스킨의 기존 카드 CSS가 강하게 적용되어 위 스타일이 반영되지 않을 수 있습니다. 이 경우에도 링크와 문구가 보이면 기능상 문제는 없습니다.

## 6. 삽입 예시

아래 예시는 주문조회 카드 바로 다음에 “업로드 파일 상태 조회” 카드를 넣는 방식입니다.

```html
<ul>
  <li><a href="/myshop/order/list.html">주문조회</a></li>

  <li class="perpackage-myshop-file-status-card">
    <a
      href="https://perpackage-cafe24-file-upload-app.vercel.app/file-status"
      target="_blank"
      rel="noopener noreferrer"
    >
      <i class="xi-file-check-o" aria-hidden="true"></i>
      <span class="perpackage-myshop-file-status-card__title">업로드 파일 상태 조회</span>
      <sub>File Status</sub>
      <span class="perpackage-myshop-file-status-card__desc">
        주문번호와 업로드 파일 ID가 필요합니다.
      </span>
    </a>
  </li>

  <li><a href="/member/modify.html">회원정보</a></li>
  <li><a href="/myshop/addr/list.html">배송 주소록 관리</a></li>
</ul>
```

## 7. 적용 전 체크리스트

- [ ] 마이쇼핑 원본 코드 백업
- [ ] `myshop_main` 메뉴 카드 영역 확인
- [ ] 주문조회 카드 위치 확인
- [ ] 업로드 파일 상태조회 카드를 주문조회 근처에 삽입
- [ ] 기존 `module` 속성 수정하지 않음
- [ ] 기존 `{$변수}` 수정하지 않음
- [ ] 기존 `onclick` 수정하지 않음
- [ ] PC 마이쇼핑 메인 확인
- [ ] 모바일 마이쇼핑 메인 확인
- [ ] 버튼 클릭 시 `/file-status` 새 탭 이동 확인
- [ ] 주문조회/회원정보/배송주소록 기존 기능 확인

## 8. 1차 적용 범위

### 1차 적용

- 마이쇼핑 메인에 파일 상태조회 바로가기 카드 1개 추가
- 주문조회 근처에 배치
- `/file-status` 새 탭 이동
- URL 자동 입력 없음
- 기존 메뉴 숨김 없음

### 1차에서 제외

- 숨김 후보 메뉴 제거
- 좌측 FAQ 메뉴 정리
- 마이쇼핑 전체 리디자인
- URL 자동 입력
- `file_id` 자동 파싱
- 주문조회 기능 구조 변경

## 9. 보안 기준

- URL에 `order_id` 또는 `file_id`를 붙이지 않습니다.
- `file_id` 단독 조회를 유도하지 않습니다.
- 고객 다운로드 버튼을 추가하지 않습니다.
- `storage_path`, signed URL, `token_hash`, raw token을 노출하지 않습니다.
- Webhook raw payload나 Cafe24 Admin API 응답을 노출하지 않습니다.
- 고객은 `/file-status`에서 주문번호와 업로드 파일 ID를 직접 입력합니다.

## 10. 이번 문서 작업에서 변경하지 않은 것

- 앱 코드 변경 없음
- API 변경 없음
- DB/SQL 변경 없음
- Webhook 로직 변경 없음
- Cafe24 운영 스킨 변경 없음
- 실제 마이쇼핑 UI 변경 없음
