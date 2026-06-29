# 페르패키지 Cafe24 파일 업로드 앱

페르패키지 Cafe24 쇼핑몰에 설치해서 사용할 내부용 파일 업로드 앱의 1차 개발 골격입니다.

최종 목표는 Cafe24 상품상세, 주문, 견적, 문의 흐름에서 고객이 인쇄파일을 업로드하고, 업로드된 파일을 상품/주문/문의와 연결해 관리하는 것입니다.

## 1차 범위

이번 1차 작업에서 만든 것:

- Next.js App Router 기반 프로젝트 구조
- Cafe24 앱 실행 query parameter 파싱
- Cafe24 앱 실행 HMAC 검증
- timestamp 2시간 검증
- OAuth 인증 요청 URL 생성
- OAuth callback 처리
- Access Token / Refresh Token 발급 처리
- Refresh Token 기반 Access Token 갱신 함수
- Supabase 연결 구조
- `files` 테이블 schema 초안
- `cafe24_installations` 테이블 schema 초안
- Naver Object Storage 업로드 함수 초안
- 개발용 `/upload-test` 파일 업로드 테스트 페이지
- `/admin` 기본 관리자 상태 화면
- `.env.example`

## 아직 구현하지 않은 것

이번 1차에서 일부러 만들지 않은 것:

- Cafe24 상품상세 실제 스크립트 삽입
- ScriptTags API 실제 등록
- Webhook 실제 수신 처리
- 주문 데이터 실제 자동 연동
- 상품 입력 옵션에 `file_id` 자동 삽입
- 고객 회원 인증 기반 견적함
- 운영몰 설치
- 대용량 100MB 완성 처리
- 바이러스 검사
- 파일 미리보기 변환
- 실제 결제/주문 연결 자동화
- multipart upload
- presigned URL 직접 업로드

## 프로젝트 구조

```txt
src/app/page.tsx
src/app/admin/page.tsx
src/app/upload-test/page.tsx

src/app/api/cafe24/auth/start/route.ts
src/app/api/cafe24/auth/callback/route.ts
src/app/api/cafe24/token/refresh/route.ts

src/app/api/files/upload/route.ts

src/lib/cafe24/config.ts
src/lib/cafe24/hmac.ts
src/lib/cafe24/oauth.ts
src/lib/cafe24/token-store.ts
src/lib/cafe24/types.ts

src/lib/supabase/client.ts
src/lib/supabase/admin.ts

src/lib/storage/naver-object-storage.ts
src/lib/files/file-service.ts
src/lib/files/types.ts

supabase/schema.sql
```

## 환경변수

`.env.example`을 기준으로 `.env.local`을 만듭니다.

필수:

```env
NEXT_PUBLIC_APP_URL=

CAFE24_MALL_ID=
CAFE24_CLIENT_ID=
CAFE24_CLIENT_SECRET=
CAFE24_REDIRECT_URI=
CAFE24_SCOPES=
CAFE24_API_VERSION=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NAVER_ACCESS_KEY=
NAVER_SECRET_KEY=
NAVER_OBJECT_STORAGE_ENDPOINT=
NAVER_OBJECT_STORAGE_BUCKET=
NAVER_REGION=
UPLOAD_MAX_FILE_SIZE_MB=
```

주의:

- `CAFE24_CLIENT_SECRET`은 서버에서만 사용합니다.
- `access_token`, `refresh_token`은 프론트엔드에 노출하지 않습니다.
- Naver Object Storage access key/secret key는 서버에서만 사용합니다.
- Supabase service role key는 서버에서만 사용합니다.
- `.env.local`은 GitHub에 커밋하지 않습니다.

## Supabase 테이블 생성

Supabase SQL Editor에서 아래 파일 내용을 실행합니다.

```txt
supabase/schema.sql
```

생성 테이블:

```txt
cafe24_installations
files
```

1차 schema는 token 저장 구조를 분리해두었지만 실제 암호화는 아직 적용하지 않았습니다. 운영 전에는 token 암호화 또는 별도 secret 관리 정책을 적용해야 합니다.

## Cafe24 Developers 설정

Cafe24 Developers에서 앱을 만들고 아래 값을 등록합니다.

App URL:

```txt
https://your-vercel-domain.vercel.app
```

Redirect URI:

```txt
https://your-vercel-domain.vercel.app/api/cafe24/auth/callback
```

초기 scope:

```txt
mall.read_application
mall.read_product
mall.read_category
mall.read_community
```

## OAuth 테스트

1. `.env.local`에 Cafe24 환경변수를 입력합니다.
2. Supabase schema를 적용합니다.
3. 개발 서버를 실행합니다.

```bash
npm run dev
```

4. 아래 경로로 이동합니다.

```txt
/api/cafe24/auth/start
```

5. Cafe24 OAuth 동의 후 `/admin?oauth=connected`로 돌아오면 연결 상태를 확인합니다.

## 파일 업로드 테스트

개발용 테스트 페이지:

```txt
/upload-test
```

동작:

1. 파일 선택
2. `/api/files/upload`로 전송
3. Naver Object Storage에 저장
4. Supabase `files` 테이블에 메타데이터 저장
5. 업로드 결과 표시

표시 값:

- file_id
- original_filename
- file_size
- mime_type
- status
- storage_path

표시하지 않는 값:

- access_token
- refresh_token
- Naver Object Storage secret
- Supabase service role key

## 관리자 화면

기본 관리자 화면:

```txt
/admin
```

표시:

- Cafe24 설정 상태
- Supabase 설정 상태
- Naver Object Storage 설정 상태
- OAuth 연결 상태
- 최근 업로드 파일 목록

token 원문과 secret 값은 표시하지 않습니다.

## 보안 주의사항

반드시 지켜야 할 사항:

1. `client_secret`은 서버에서만 사용합니다.
2. access token과 refresh token은 프론트엔드에 노출하지 않습니다.
3. Naver Object Storage access key/secret key는 프론트엔드에 노출하지 않습니다.
4. Supabase service role key는 서버에서만 사용합니다.
5. `.env.local`은 GitHub에 커밋하지 않습니다.
6. API 에러 원문을 사용자에게 그대로 노출하지 않습니다.
7. 운영몰에 바로 설치하지 않고 테스트 쇼핑몰에서 먼저 검증합니다.

## 다음 Phase 계획

Phase 2:

- Cafe24 Admin API로 상품/카테고리/게시판 조회 테스트
- Supabase token 저장 안정화
- token 암호화 검토

Phase 3:

- ScriptTags API로 PRODUCT_DETAIL에 업로드 스크립트 삽입 테스트
- 상품상세 파일 업로드 UI 표시
- Cafe24 상품 입력 옵션과 `file_id` 연결 테스트

Phase 4:

- 주문 발생 후 Admin API 또는 Webhook으로 `order_id`와 `file_id` 연결
- 관리자 주문 상세에서 파일 확인 흐름 검증

Phase 5:

- Webhook으로 게시판/주문 이벤트 자동 수신
- 누락 보완을 위한 Admin API 주기 조회

Phase 6:

- 대용량 업로드 최적화
- 파일 만료/삭제 정책
- 다운로드 권한 관리
- 미리보기 생성
- 완성 파일 저장 정책

