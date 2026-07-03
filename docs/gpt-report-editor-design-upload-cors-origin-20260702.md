# 전개도 디자인 에디터 업로드 연동을 위한 CORS origin 추가 보고서

작성일: 2026-07-02
작성: Claude (전개도 디자인 에디터 연동 작업과 함께 진행)

## 1. 작업 목적

페르패키지 전개도 디자인 에디터(카페24 파일업로더 standalone 페이지)에서 고객이 완성한 디자인 SVG를 이 앱의 `/api/files/upload`로 업로드해 **업로드 파일 ID(file_id)** 를 발급받을 수 있도록, 업로드 API의 CORS 허용 origin에 에디터 도메인을 추가했습니다.

에디터에서 발급받은 file_id를 고객이 주문 페이지의 "업로드 파일 ID" 입력칸에 붙여넣으면, 기존 Webhook 자동 연결 흐름(`order_id` 추출 → 주문 품목에서 file_id 추출 → `files.order_id` 연결)이 그대로 적용됩니다.

## 2. 수정 파일 목록

- `src/app/api/files/upload/route.ts`
- `docs/gpt-report-editor-design-upload-cors-origin-20260702.md` (이 보고서)

## 3. 주요 변경 내용

`allowedUploadOrigins`에 아래 origin 1개를 추가했습니다.

```txt
https://ecimg.cafe24img.com
```

근거: 전개도 에디터의 실제 공개 URL이 아래와 같아 브라우저 fetch의 Origin이 `https://ecimg.cafe24img.com`으로 전송됩니다.

```txt
https://ecimg.cafe24img.com/pg1853b44513043087/peerl/web/upload/peerl-editor/index.html
```

그 외 로직(HTTP method, OPTIONS preflight 처리, 403 처리, formData 필드, 업로드 저장 흐름)은 변경하지 않았습니다.

## 4. 에디터 쪽에서 보내는 요청 형식 (참고)

에디터는 기존 상품상세 업로드 위젯과 동일한 API 계약을 사용합니다.

- `POST /api/files/upload` (multipart FormData)
- `file`: 완성 디자인 SVG (`peerl-design-{전개도명}-{일시}.svg`, `image/svg+xml`)
- `mall_id`: `peerl`
- `shop_no`: `1`
- `product_no`: 에디터 URL의 `product_no` 파라미터가 있을 때만 전송
- `customer_type`: `peerl-editor` (상품상세 위젯의 `cafe24-product-detail`과 구분)
- `customer_identifier`: 에디터 페이지 URL

`/admin`에서는 `customer_type = peerl-editor`로 에디터 발 업로드를 구분할 수 있습니다.

## 5. DB 변경 여부

없음.

## 6. 추가 SQL 필요 여부

없음.

## 7. 변경하지 않은 기존 기능

- Cafe24 Webhook 자동 연결 로직
- `files.order_id` 덮어쓰기 정책 / `already_linked` / `conflict_order_id` 처리
- Cafe24 Admin API 주문 조회 로직
- 파일 다운로드 signed URL 생성/보안 로직
- Naver Object Storage 저장 로직
- `files.status` 자동 변경 없음 (에디터 업로드도 `uploaded_pending`으로 시작, 검수는 관리자가 수동 진행)
- `/admin` 검색, 다운로드, 상태 변경, 로그 기능
- `public/cafe24/product-upload-widget.js` (변경 없음)

## 8. 보안 기준 유지 여부

- token, API key, signed URL, storage key, Webhook raw payload를 새로 노출하지 않음
- 추가한 origin은 카페24가 운영하는 CDN 도메인(`ecimg.cafe24img.com`) 1개뿐이며, localhost 등 개발용 origin은 추가하지 않음
- 참고(기존 동작): Origin 헤더가 없는 요청(curl 등)은 기존부터 차단 대상이 아니므로, CORS는 브라우저 보호 수단이며 서버측 인증 수단이 아님

주의: `ecimg.cafe24img.com`은 카페24 파일업로더 공용 CDN 도메인이므로, 같은 도메인의 다른 경로 페이지도 origin 조건은 통과할 수 있습니다. 현재 업로드 API는 원래 인증 없이 공개된 엔드포인트이므로 보안 수준은 기존과 동일하지만, 향후 업로드 남용이 확인되면 별도 토큰/서명 방식 검토가 필요합니다.

## 9. Typecheck 결과

```bash
npm run typecheck
```

통과.

## 10. Build 결과

```bash
npm run build
```

통과. 기존과 동일하게 `/api/cafe24/auth/start`의 cookies 사용 관련 dynamic route 안내가 출력됐지만 build는 성공했습니다.

## 11. 커밋 해시

아직 커밋하지 않았습니다.

## 12. Push 여부

아직 push하지 않았습니다. (push 시 Vercel Production 자동 배포 가능성이 있어 사용자 승인 후 진행)

## 13. Vercel 배포 여부

아직 배포하지 않았습니다. **이 변경이 Production에 배포되기 전까지는 에디터에서 업로드가 CORS로 차단됩니다.**

## 14. 운영자가 확인할 테스트 순서

배포 후:

1. 상품상세에서 "전개도 편집하기"로 에디터(ecimg URL) 열기
2. 전개도 선택 후 이미지/텍스트/도형 배치
3. 상단 "저장 후 주문" 또는 검수 탭 "디자인 업로드 (주문 연결)" 클릭
4. 업로드 파일 ID가 발급되고 복사 버튼이 동작하는지 확인
5. `/admin`에서 해당 file_id 검색 → `customer_type = peerl-editor`, status `uploaded_pending` 확인
6. 주문 페이지 "업로드 파일 ID" 입력칸에 붙여넣고 주문 진행
7. Webhook 수신 후 `files.order_id` 자동 연결 확인 (`processed_status = auto_linked`)
8. 기존 상품상세 위젯 업로드가 이전과 동일하게 동작하는지 회귀 확인

## 15. 다음 추천 작업

1. 이 변경 커밋/push 및 Vercel Production 배포 (사용자 승인 필요)
2. 배포 후 에디터 → 업로드 → 주문 연결 end-to-end 실측
3. (선택) 상품상세 snippet의 `rel="noopener"` 정책을 유지한 채 file_id 자동 입력이 필요하면, 위젯에 `postMessage` 수신 로직 추가 검토 — 현재는 고객이 복사/붙여넣기하는 방식
4. (선택) `/admin` 파일 목록에 `customer_type` 필터 추가로 에디터 발 업로드 구분 조회
