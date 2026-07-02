# Cafe24 상품상세 파일 업로드 위젯 재업로드 file_id 갱신 오류 수정 보고서

## 1. 작업 목적

Cafe24 상품상세 파일 업로드 위젯에서 “다시 업로드하기” 후 새 파일을 업로드했을 때, 위젯 결과 영역에는 새 file_id가 표시되지만 Cafe24 주문 옵션/추가입력 옵션의 “업로드 파일 ID” 입력칸에는 이전 file_id가 남을 수 있는 문제를 수정했습니다.

주문 옵션에 저장되는 file_id는 항상 마지막 업로드 성공 file_id가 되도록 위젯의 재업로드 흐름을 보강했습니다.

## 2. 수정 파일 목록

- `public/cafe24/product-upload-widget.js`
- `docs/gpt-report-cafe24-reupload-file-id-refresh-fix-20260702.md`

## 3. 원인 분석

기존 위젯은 업로드 성공 후 Cafe24 “업로드 파일 ID” 입력칸을 `readonly` 처리하고, 이후 “다시 업로드하기”를 눌렀을 때 위젯 내부 상태는 초기화했지만 Cafe24 입력칸 값과 readonly 상태를 명확하게 비우지 못할 수 있었습니다.

또한 새 업로드 시 입력칸 탐색 로직은 readonly 입력칸을 후보에서 제외할 수 있어, 이전 입력칸을 다시 찾지 못하거나 새 file_id를 덮어쓰지 못하는 상황이 발생할 수 있었습니다.

결과적으로 위젯 결과에는 새 file_id가 표시되더라도 Cafe24 주문 옵션 입력칸에는 이전 file_id가 남을 수 있었습니다.

## 4. 다시 업로드하기 클릭 시 초기화 방식

“다시 업로드하기” 클릭 시 아래 처리를 추가했습니다.

- 기존 업로드 상태를 초기화합니다.
- 기존에 사용한 Cafe24 file_id 입력칸 참조를 유지합니다.
- 해당 입력칸의 `readonly`, `aria-readonly`, `data-perpackage-file-id`를 해제합니다.
- 입력칸 값을 빈 값으로 초기화합니다.
- input/change/blur 이벤트를 dispatch합니다.
- 위젯 결과 영역과 파일 선택 상태를 초기화합니다.

이렇게 해서 새 파일 업로드 전에는 이전 file_id가 Cafe24 입력칸에 남지 않도록 했습니다.

## 5. 새 업로드 성공 후 file_id 갱신 방식

새 파일 업로드 성공 시 기존 입력칸 참조가 있으면 우선 재사용합니다.

처리 순서:

1. 마지막으로 사용한 Cafe24 file_id 입력칸 참조를 우선 사용
2. 없으면 기존 탐색 로직으로 “업로드 파일 ID” 입력칸 탐색
3. 새 file_id를 해당 입력칸에 강제로 입력
4. 내부 기준값을 새 file_id로 갱신
5. 입력칸을 다시 `readonly` 처리
6. 새 file_id 기준으로 변경 감지 로직 유지

기존 file_id와 새 file_id가 다르면 새 file_id가 우선됩니다.

## 6. readonly 입력칸 갱신 방식

`applyFileIdToCafe24Input`에서 값을 입력하기 전에 `releaseFileIdInput`을 호출하도록 수정했습니다.

즉, Cafe24 입력칸이 readonly 상태여도:

1. readonly를 잠시 해제
2. 새 file_id 값 입력
3. input/change/blur 이벤트 dispatch
4. 업로드 성공 처리 후 다시 readonly 적용

이 흐름으로 새 file_id가 기존 값을 확실히 덮어쓰도록 했습니다.

## 7. input/change 이벤트 dispatch 여부

아래 이벤트를 유지 또는 추가 적용했습니다.

- file_id 입력 시:
  - `input`
  - `change`
  - `blur`
- file_id 초기화 시:
  - `input`
  - `change`
  - `blur`

Cafe24 옵션 시스템이 변경된 값을 인식할 수 있도록 이벤트 dispatch를 유지했습니다.

## 8. 구매/장바구니 전 검사 유지 여부

구매/주문/장바구니 성격 버튼 클릭 전 검사 로직은 유지했습니다.

새 업로드 성공 후에는 내부 기준 file_id가 새 값으로 갱신되므로:

- Cafe24 입력칸 값이 최신 file_id와 같으면 통과
- 비어 있거나 최신 file_id와 다르면 경고 표시 및 클릭 차단

## 9. 변경하지 않은 기존 기능

아래 기능은 변경하지 않았습니다.

- 파일 1개 업로드 제한
- ZIP 압축 안내 문구
- 업로드 파일 ID 수정 금지 안내 문구
- `/api/files/upload`
- Naver Object Storage 저장
- Supabase `files` 저장
- Cafe24 Webhook 자동 연결
- Cafe24 Admin API 주문 조회
- `files.order_id` 자동 연결 정책
- `files.status` 자동 변경 정책
- 파일 삭제/교체 삭제 처리

## 10. 보안 기준 유지 여부

- DB 변경 없음
- Supabase SQL 추가 없음
- 고객용 재업로드 링크 생성 없음
- 고객용 교정확인 링크 생성 없음
- 자동 발송 없음
- 파일 삭제 없음
- Naver Object Storage 삭제 없음
- Webhook 자동 연결 로직 변경 없음
- `files.order_id` 덮어쓰기 정책 변경 없음
- token, API key, signed URL, storage key, Webhook raw payload 전체 노출 없음

## 11. node check 결과

실행 명령:

```bash
node --check public/cafe24/product-upload-widget.js
```

결과:

```txt
통과
```

## 12. typecheck 결과

실행 명령:

```bash
npm run typecheck
```

결과:

```txt
통과
```

## 13. build 결과

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

## 14. 커밋 해시

아직 커밋하지 않았습니다.

## 15. Push 여부

아직 push하지 않았습니다.

## 16. Vercel 배포 여부

아직 Vercel Production 배포를 진행하지 않았습니다.

## 17. 운영자가 확인할 테스트 순서

1. Cafe24 상품상세 테스트 상품 접속
2. 첫 번째 파일 업로드
3. Cafe24 “업로드 파일 ID” 입력칸에 첫 번째 file_id가 자동 입력되는지 확인
4. “다시 업로드하기” 클릭
5. Cafe24 “업로드 파일 ID” 입력칸 값이 초기화되는지 확인
6. 두 번째 파일 업로드
7. 위젯 결과 영역에 새 file_id가 표시되는지 확인
8. Cafe24 “업로드 파일 ID” 입력칸도 새 file_id로 바뀌는지 확인
9. 이전 file_id가 입력칸에 남지 않는지 확인
10. 새 file_id 기준으로 경고가 뜨지 않는지 확인
11. 새 file_id를 임의로 수정하거나 비우면 경고가 뜨는지 확인
12. file_id가 변경된 상태에서 구매/장바구니 버튼 클릭 시 차단되는지 확인
13. 새 file_id가 정상 상태일 때 구매/장바구니 진행이 가능한지 확인
14. `/admin`에서 새 file_id 검색이 정상인지 확인

## 18. 배포 전 멈춘 지점

요청에 따라 `node --check`, `typecheck`, `build` 통과 후, 커밋/push/Vercel Production 배포 전 단계에서 멈췄습니다.
