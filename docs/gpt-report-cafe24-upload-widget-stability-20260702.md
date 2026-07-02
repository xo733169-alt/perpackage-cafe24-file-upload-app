# Cafe24 상품상세 파일 업로드 위젯 안정화 1단계 보고서

## 1. 작업 목적

Cafe24 상품상세 파일 업로드 위젯에서 고객이 여러 파일을 선택하거나, 업로드 후 자동 입력된 업로드 파일 ID를 임의로 수정해 주문 자동 연결이 실패하는 상황을 줄이기 위해 고객용 위젯을 안정화했습니다.

이번 작업은 프론트 위젯 안정화 작업이며 DB 변경, Supabase SQL 추가, Webhook 자동 연결 로직 변경은 없습니다.

## 2. 수정 파일 목록

- `public/cafe24/product-upload-widget.js`
- `docs/gpt-report-cafe24-upload-widget-stability-20260702.md`

## 3. 파일 1개 제한 구현 방식

`public/cafe24/product-upload-widget.js`에서 아래 처리를 추가했습니다.

- 파일 input의 `multiple` 속성을 제거합니다.
- JS submit 단계에서 `fileInput.files.length`를 검사합니다.
- 선택 파일 수가 2개 이상이면 업로드 요청을 보내지 않습니다.
- 여러 파일 선택 시 파일 input 값을 초기화하고 안내 메시지를 표시합니다.

표시 문구:

```txt
파일은 1개만 업로드 가능합니다. 여러 파일을 전달해야 하는 경우 AI, PDF, 이미지, 칼선 파일 등을 하나의 ZIP 파일로 압축해 업로드해 주세요.
```

## 4. ZIP 압축 안내 문구 추가 위치

Cafe24 상품상세 업로드 위젯의 상단 안내 영역에 상시 안내 문구를 추가했습니다.

추가 문구:

```txt
인쇄용 파일은 1개만 업로드할 수 있습니다.
여러 파일을 전달해야 하는 경우 AI, PDF, 이미지, 칼선 파일 등을 하나의 ZIP 파일로 압축해 업로드해 주세요.
업로드 완료 후 생성되는 업로드 파일 ID는 파일 확인을 위한 값입니다. 주문 과정에서 해당 값을 수정하지 말아 주세요.
```

CSS는 기존 `#app-perpackage-product-upload` 내부 네임스페이스로만 적용되도록 유지했습니다.

## 5. file_id 수정 방지 또는 변경 감지 방식

업로드 성공 후 Cafe24 추가 입력 옵션에 `file_id`를 입력하는 기존 흐름은 유지했습니다.

추가 안정화:

- `file_id` 입력 성공 시 해당 Cafe24 입력칸을 `readonly`로 설정합니다.
- `readonly`는 주문 데이터 제출을 막지 않기 위해 사용했습니다.
- `disabled`는 주문 데이터에서 빠질 수 있어 사용하지 않았습니다.
- 원래 생성된 `file_id`를 입력칸의 `data-perpackage-file-id`에 저장합니다.
- input/change/blur 이벤트에서 값이 비어 있거나 원래 값과 달라졌는지 감지합니다.
- 값이 변경되면 위젯 상태 영역과 결과 영역에 경고를 표시합니다.

경고 문구:

```txt
업로드 파일 ID가 변경되었거나 비어 있습니다.
파일 확인 및 주문 연결을 위해 업로드 완료 후 생성된 업로드 파일 ID는 수정하지 말아 주세요.
다시 파일을 업로드하거나 새로고침 후 다시 진행해 주세요.
```

## 6. 주문 전 차단 가능 여부

Cafe24 주문 버튼 구조를 완전히 통제하지 않고, best-effort 방식의 주문 버튼 클릭 전 검사를 추가했습니다.

동작:

- 업로드가 완료된 상태에서 구매/주문/장바구니 성격의 버튼 또는 링크를 클릭하면 `file_id` 입력값을 검사합니다.
- 입력값이 비어 있거나 원래 생성된 `file_id`와 다르면 클릭을 막고 경고를 표시합니다.

주의:

- Cafe24 스킨과 버튼 구조가 다양할 수 있어 모든 주문 동작을 100% 차단한다고 확정하지는 않습니다.
- 현재 단계에서는 변경 감지와 주문 버튼 클릭 전 best-effort 차단을 적용했습니다.
- 운영 테스트 후 특정 Cafe24 버튼 구조가 추가로 확인되면 selector 보강이 필요할 수 있습니다.

## 7. 변경하지 않은 기존 기능

아래 기능은 변경하지 않았습니다.

- `/api/files/upload` 업로드 API
- Naver Object Storage 저장
- Supabase `files` 저장
- file_id 생성
- Cafe24 주문 옵션/추가입력 옵션에 file_id 자동 입력
- Cafe24 Webhook 자동 연결 로직
- Cafe24 Admin API 주문 조회 로직
- `files.order_id` 자동 연결 정책
- `files.status` 자동 변경 정책
- `/admin` file_id 검색
- `/admin` 주문번호 검색
- 다운로드/상태 변경/로그 기능

## 8. 보안 기준 유지 여부

- DB 변경 없음
- Supabase SQL 추가 없음
- 고객용 재업로드 링크 생성 없음
- 고객용 교정확인 링크 생성 없음
- 자동 발송 없음
- 파일 삭제 없음
- Naver Object Storage 삭제 없음
- Webhook 자동 연결 로직 변경 없음
- `files.order_id` 덮어쓰기 정책 변경 없음
- token, API key, signed URL, storage key, Webhook raw payload 전체를 새로 노출하지 않음

## 9. Typecheck 결과

실행 명령:

```bash
npm run typecheck
```

결과:

```txt
통과
```

## 10. Build 결과

실행 명령:

```bash
npm run build
```

결과:

```txt
통과
```

참고:

기존과 동일하게 `/api/cafe24/auth/start` route의 cookies 사용 관련 dynamic route 안내가 출력됐지만, build 자체는 성공했습니다.

추가 확인:

```bash
node --check public/cafe24/product-upload-widget.js
```

결과:

```txt
통과
```

## 11. 커밋 해시

아직 커밋하지 않았습니다.

## 12. Push 여부

아직 push하지 않았습니다.

## 13. Vercel 배포 여부

아직 Vercel Production 배포를 진행하지 않았습니다.

## 14. 운영자가 확인할 테스트 순서

1. Cafe24 상품상세 테스트 상품 접속
2. 업로드 위젯에 1개 파일 업로드 안내 문구가 표시되는지 확인
3. 여러 파일은 ZIP으로 압축하라는 안내 문구 확인
4. 파일 1개 선택 후 업로드 정상 동작 확인
5. 업로드 완료 후 file_id 생성 확인
6. Cafe24 추가 입력 옵션 “업로드 파일 ID”에 전체 file_id가 자동 입력되는지 확인
7. 입력칸이 readonly 처리되는지 확인
8. 개발자 도구 등으로 입력값을 비우거나 변경했을 때 경고가 표시되는지 확인
9. file_id가 변경된 상태에서 구매/장바구니 버튼 클릭 시 경고가 표시되고 진행이 차단되는지 확인
10. 다시 업로드하기 버튼으로 새 파일 업로드가 가능한지 확인
11. 새 업로드 성공 시 새 file_id가 Cafe24 입력칸에 반영되는지 확인
12. `/admin` file_id 검색이 기존처럼 작동하는지 확인
13. Webhook/Admin API 자동 연결 관련 기능이 기존처럼 유지되는지 확인

## 15. 배포 전 멈춘 지점

요청에 따라 `typecheck`와 `build` 통과 후, 커밋/push/Vercel Production 배포 전 단계에서 멈췄습니다.
