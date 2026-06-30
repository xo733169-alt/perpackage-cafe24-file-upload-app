# GPT 보고서: Cafe24 상품상세 업로드 위젯 CORS 수정

작성일: 2026-06-30

프로젝트: `perpackage-cafe24-file-upload-app`

## 1. 작업 목적

Cafe24 상품상세 테스트 페이지에 삽입한 `product-upload-widget.js`는 정상 로드되고 UI도 표시되었지만, 파일 선택 후 `파일 업로드` 버튼을 누르면 브라우저 화면에 `Failed to fetch`가 표시되었습니다.

원인은 Cafe24 상품상세 도메인에서 Vercel API `POST /api/files/upload`로 요청할 때 CORS preflight 및 응답 헤더가 준비되어 있지 않은 것으로 판단했습니다.

이번 작업은 기능 확장이 아니라, 상품상세 위젯에서 기존 업로드 API를 호출할 수 있도록 CORS 처리만 최소 범위로 추가한 작업입니다.

## 2. 테스트된 상품상세 URL

```txt
https://peerl.cafe24.com/skin-skin17/product/detail.html?product_no=54&cate_no=1&display_group=10
```

## 3. 수정한 파일

```txt
src/app/api/files/upload/route.ts
```

## 4. 수정 내용

`/api/files/upload` route handler에 아래 처리를 추가했습니다.

- `OPTIONS` preflight 요청 처리
- 허용 Origin allowlist 추가
- 허용된 Origin일 때만 `Access-Control-Allow-Origin` 반환
- `Access-Control-Allow-Methods: OPTIONS, POST`
- `Access-Control-Allow-Headers: Content-Type`
- `Access-Control-Max-Age: 86400`
- 성공 응답과 실패 응답 모두 CORS 헤더 포함
- allowlist에 없는 Origin의 POST 요청은 403으로 차단
- Origin이 없는 same-origin 요청은 기존 `/upload-test` 흐름을 유지

## 5. CORS allowlist

초기 허용 Origin은 아래 3개로 제한했습니다.

```txt
https://peerl.cafe24.com
https://www.peerl.cafe24.com
https://perpackage-cafe24-file-upload-app.vercel.app
```

## 6. 유지한 기능

기존 파일 업로드 처리 흐름은 유지했습니다.

- 기존 `uploadFile()` 호출 유지
- Supabase `files` row 생성 흐름 유지
- Naver Object Storage 저장 흐름 유지
- `/upload-test` 기존 동작 유지
- 업로드 성공 시 `file_id`, `original_filename`, `status` 등 반환 유지

## 7. 이번 작업에서 하지 않은 것

아래 기능은 이번 작업 범위에서 제외했습니다.

- ScriptTags API 실제 등록
- Cafe24 주문 연동
- 상품 입력 옵션에 `file_id` 자동 삽입
- Webhook 구현
- presigned URL 업로드
- multipart upload
- 대용량 업로드 구조 변경

## 8. 보안 처리

아래 민감값은 브라우저 응답, 로그, 문서에 노출하지 않았습니다.

```txt
token
secret
service role key
Supabase secret
Naver Object Storage access key
Naver Object Storage secret key
```

`Access-Control-Allow-Origin`은 와일드카드 `*`를 쓰지 않고, 요청 Origin이 allowlist에 있을 때만 해당 Origin을 반환하도록 제한했습니다.

## 9. 검증 결과

아래 명령을 실행했습니다.

```bash
npm run typecheck
npm run build
```

결과:

```txt
npm run typecheck: 통과
npm run build: 통과
```

빌드 결과에서 `/api/files/upload`는 정상 route handler로 포함되었습니다.

참고:
빌드 중 기존 Cafe24 OAuth start route의 cookies 사용 관련 동적 서버 사용 안내 로그가 출력되었지만, build 자체는 성공했습니다.

## 10. Vercel 배포 필요 여부

필요합니다.

현재 수정은 로컬 코드에 반영된 상태이므로, Cafe24 상품상세에서 실제로 `Failed to fetch`가 해결되는지 보려면 아래 절차가 필요합니다.

```txt
1. 변경분 commit
2. GitHub main push
3. Vercel Production 배포 완료 확인
4. Cafe24 상품상세 테스트 페이지 새로고침
5. 파일 업로드 재시도
```

## 11. Cafe24 상품상세 재테스트 방법

배포 후 아래 순서로 확인합니다.

1. Cafe24 상품상세 테스트 URL 접속
2. 브라우저 캐시 새로고침
3. `인쇄파일 업로드` 영역에서 파일 선택
4. `파일 업로드` 버튼 클릭
5. 화면에서 `Failed to fetch`가 사라지는지 확인
6. 업로드 성공 시 `file_id`, `original_filename`, `status` 표시 확인
7. Supabase `files` 테이블 row 생성 확인
8. Naver Object Storage `perpackage-files` 버킷 저장 확인
9. `/admin` 최근 업로드 파일 목록 표시 확인

## 12. 실패 시 추가 확인할 항목

배포 후에도 실패하면 브라우저 DevTools Network에서 아래를 확인해야 합니다.

```txt
OPTIONS /api/files/upload status
POST /api/files/upload status
Access-Control-Allow-Origin 응답 헤더
Access-Control-Allow-Methods 응답 헤더
Access-Control-Allow-Headers 응답 헤더
요청 Origin 값
서버 응답 JSON message
```

특히 Cafe24 테스트 페이지의 실제 Origin이 allowlist와 다른 경우, 해당 Origin을 확인한 뒤 별도 검토가 필요합니다.

## 13. 현재 git 상태 주의

이번 CORS 수정 파일 외에도 이전 작업에서 남아 있던 미커밋 변경 파일이 있습니다.

이번 작업에서 직접 수정한 코드는 아래 파일입니다.

```txt
src/app/api/files/upload/route.ts
```

이번에 새로 작성한 보고서는 아래 파일입니다.

```txt
docs/gpt-report-product-upload-widget-cors-fix-20260630.md
```

커밋할 때는 기존 미커밋 변경분과 이번 CORS 수정분을 분리할지 먼저 결정하는 것이 좋습니다.

## 14. 다음 단계 제안

1. 이번 CORS 수정 파일과 보고서만 별도 커밋
2. GitHub main push
3. Vercel Production 배포 확인
4. Cafe24 상품상세에서 파일 업로드 재테스트
5. 성공 시 다음 단계에서 `file_id`를 Cafe24 주문 또는 입력 옵션과 연결하는 방식 검토

