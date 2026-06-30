# GPT 보고서: 관리자 다운로드 original_filename 적용

## 1. 작업 목적

관리자가 `/admin`에서 `file_id`로 파일을 찾은 뒤 다운로드할 때, Naver Object Storage에 저장된 고유 파일명 대신 고객이 업로드한 원본 파일명(`files.original_filename`)으로 저장되도록 개선했습니다.

Naver Object Storage 내부 저장 구조는 충돌 방지를 위해 기존 `storage_path` / `stored_filename` 방식을 유지하고, 다운로드 응답 헤더에서만 파일명을 제어하는 방식입니다.

## 2. 현재 상태

- `/admin`에서 `file_id` 검색 가능
- 검색 결과에 `original_filename` 표시
- `파일 다운로드` 클릭 시 `/api/files/download?file_id=<id>` 호출
- 서버에서 Supabase `files` row 조회
- Naver Object Storage signed URL 생성
- 302 redirect로 파일 다운로드
- signed URL은 public 영구 URL이 아니라 짧은 시간만 유효

## 3. 수정한 파일

- `src/app/api/files/download/route.ts`
- `src/lib/storage/naver-object-storage.ts`

## 4. 다운로드 파일명 처리 방식

다운로드 파일명은 아래 우선순위로 결정합니다.

1. `files.original_filename`
2. 값이 없으면 `files.stored_filename`
3. 그래도 없으면 `files.id`

`/api/files/download` route에서 파일 row를 조회한 뒤, 위 기준으로 다운로드 파일명을 결정해 Naver Object Storage signed URL 생성 함수에 전달합니다.

## 5. Content-Disposition 처리

Naver Object Storage signed URL 생성 시 `GetObjectCommand`에 `ResponseContentDisposition`을 추가했습니다.

적용 방식:

```txt
attachment; filename="<ASCII fallback>"; filename*=UTF-8''<encoded original filename>
```

의도:

- 브라우저가 다운로드로 처리하도록 `attachment` 사용
- 한글/공백/특수문자가 포함된 파일명은 `filename*` UTF-8 형식으로 전달
- 구형 또는 일부 환경을 위해 ASCII fallback도 함께 제공

## 6. 한글 파일명 대응

한글 파일명 대응을 위해 아래 처리를 추가했습니다.

- `filename*`에 UTF-8 percent encoding 적용
- `filename` fallback에는 ASCII가 아닌 문자를 `_`로 치환
- 줄바꿈, null 문자 제거
- Windows 파일명에 위험한 문자(`\ / : * ? " < > |`)는 `-`로 치환
- 연속 공백은 한 칸으로 정리

예상 효과:

- `납세증명서.pdf` 같은 한글 파일명도 다운로드 시 원본명에 가깝게 저장 가능
- 저장소 내부 key는 기존 고유 path 유지

## 7. 보안 기준

아래 값은 화면, API 응답, 로그, 문서에 원문으로 노출하지 않았습니다.

- Naver Object Storage access key
- Naver Object Storage secret key
- Supabase service role key
- Cafe24 access token
- Cafe24 refresh token
- Cafe24 client secret
- Authorization header value
- 실제 환경변수 값

이번 작업은 signed URL의 응답 파일명만 조정했으며, public URL 영구 공개는 하지 않았습니다.

## 8. 유지한 기능

- Naver Object Storage `storage_path` 구조 유지
- `stored_filename` 고유 파일명 구조 유지
- `/admin` file_id 검색 유지
- `/api/files/download?file_id=<id>` 다운로드 route 유지
- signed URL 302 redirect 방식 유지
- signed URL 유효기간 5분 유지

## 9. 이번 작업에서 하지 않은 것

- 파일 삭제
- Supabase row 삭제
- 주문 Webhook 구현
- `files.order_id` 자동 연결
- public URL 영구 공개
- 100MB 업로드
- multipart upload
- presigned upload
- 관리자 인증 시스템 신규 구현

## 10. 검증 결과

실행한 명령:

```bash
npm run typecheck
npm run build
```

결과:

- `npm run typecheck` 통과
- `npm run build` 통과
- build 결과에서 `/api/files/download` route 유지 확인

참고:

- build 중 `cafe24_oauth_start_failed Dynamic server usage` 로그가 표시되지만, 기존 `/api/cafe24/auth/start` route의 `cookies` 사용 관련 로그이며 build 실패는 아닙니다.

## 11. Vercel 배포 필요 여부

필요합니다.

현재 변경은 로컬 코드에 반영된 상태이며, GitHub push 및 Vercel Production 배포 후 실제 다운로드 파일명 동작을 운영 URL에서 확인해야 합니다.

## 12. 테스트 방법

1. Vercel Production 배포 후 `/admin` 접속
2. Cafe24 관리자 주문상세의 `업로드 파일 ID` 복사
3. `/admin`에서 `file_id` 검색
4. `파일 다운로드` 클릭
5. 다운로드된 파일명이 `files.original_filename` 기준으로 저장되는지 확인
6. 한글 파일명, 공백 포함 파일명도 함께 확인

## 13. 다음 단계 제안

1. 운영 적용 전 `/admin` 접근 보호 강화
2. `/api/files/download` route에도 관리자 인증 재검증 추가
3. 다운로드 로그 저장
4. Cafe24 주문번호와 `files.order_id` 자동 연결
5. 관리자 화면에서 주문번호/file_id/상품번호 통합 검색으로 확장
