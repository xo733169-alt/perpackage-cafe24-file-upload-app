# GPT 핸드오프: 페르패키지 Cafe24 파일 업로드 앱 1차 골격

## 프로젝트

```txt
perpackage-cafe24-file-upload-app
```

## 작업 목적

페르패키지 Cafe24 쇼핑몰에 설치해서 사용할 내부용 파일 업로드 앱의 1차 개발 골격을 만들었다.

최종 목표는 Cafe24 상품상세, 주문, 견적, 문의 흐름에서 고객 인쇄파일을 업로드하고, 업로드된 파일을 상품/주문/문의와 연결해 관리하는 것이다.

이번 1차에서는 완성형 업로드 앱이 아니라 Cafe24 앱 개발을 위한 안전한 기반만 만들었다.

## 현재 생성 위치

```txt
C:\Users\inh78\OneDrive\문서\홈페이지 개발\perpackage-cafe24-file-upload-app
```

## 현재 상태 요약

생성 완료:

```txt
Next.js App Router 프로젝트 골격
TypeScript 설정
Cafe24 앱 실행 query parameter 파싱
Cafe24 HMAC 검증
timestamp 2시간 검증
OAuth start/callback route
Access Token / Refresh Token 발급 구조
Refresh Token 기반 Access Token 갱신 구조
Supabase admin/client 연결 구조
Naver Object Storage 업로드 함수 초안
files 테이블 schema 초안
cafe24_installations 테이블 schema 초안
/upload-test 개발용 파일 업로드 테스트 페이지
/admin 기본 관리자 화면
.env.example
README.md
상세 보고서
```

아직 미완료:

```txt
npm install
typecheck
build
Vercel 프로젝트 생성
Supabase schema 실제 적용
Cafe24 Developers 앱 등록
OAuth 실제 테스트
Naver Object Storage 실제 업로드 테스트
Git 저장소 초기화 또는 GitHub push
```

## 주요 파일

```txt
package.json
.env.example
README.md
supabase/schema.sql
docs/gpt-report-phase1-cafe24-file-upload-app-20260629.md

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

src/lib/supabase/admin.ts
src/lib/supabase/client.ts
src/lib/storage/naver-object-storage.ts
src/lib/files/file-service.ts
src/lib/files/types.ts
```

## 환경변수

`.env.example`에 예시 변수명을 정리했다.

```env
NEXT_PUBLIC_APP_URL

CAFE24_MALL_ID
CAFE24_CLIENT_ID
CAFE24_CLIENT_SECRET
CAFE24_REDIRECT_URI
CAFE24_SCOPES
CAFE24_API_VERSION

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

NAVER_ACCESS_KEY
NAVER_SECRET_KEY
NAVER_OBJECT_STORAGE_ENDPOINT
NAVER_OBJECT_STORAGE_BUCKET
NAVER_REGION

UPLOAD_MAX_FILE_SIZE_MB
```

실제 secret 값은 넣지 않았다.

## 구현된 경로

화면:

```txt
/
/upload-test
/admin
```

API:

```txt
/api/cafe24/auth/start
/api/cafe24/auth/callback
/api/cafe24/token/refresh
/api/files/upload
```

## Supabase schema

파일:

```txt
supabase/schema.sql
```

테이블:

```txt
cafe24_installations
files
```

주의:

```txt
1차에서는 token 저장 구조만 분리했다.
운영 전 access_token / refresh_token 암호화 또는 별도 secret 관리 정책이 필요하다.
```

## 구현된 보안 기준

```txt
client_secret은 서버에서만 사용
access_token / refresh_token은 프론트 화면에 표시하지 않음
Naver Object Storage access key / secret key는 서버에서만 사용
Supabase service role key는 서버에서만 사용
.env.local은 .gitignore에 포함
API 에러 원문은 사용자에게 그대로 노출하지 않도록 구성
```

## 이번에 일부러 구현하지 않은 것

```txt
Cafe24 상품상세 실제 스크립트 삽입
ScriptTags API 실제 등록
Webhook 실제 수신 처리
주문 데이터 자동 연동
상품 입력 옵션에 file_id 자동 삽입
고객 회원 인증 기반 견적함
운영몰 설치
대용량 100MB 완성 처리
multipart upload
presigned URL 직접 업로드
바이러스 검사
파일 미리보기 변환
실제 결제/주문 연결 자동화
```

## 검증 상태

현재 새 프로젝트에는 `node_modules`가 없다.

따라서 아래 명령은 아직 실행하지 않았다.

```bash
npm install
npm run typecheck
npm run build
```

Git 상태:

```txt
새 프로젝트 폴더가 아직 Git 저장소가 아니라 git status / git pull origin main 실행 불가
```

## 다음 GPT가 먼저 할 일

1. 프로젝트 폴더로 이동한다.

```bash
cd "C:\Users\inh78\OneDrive\문서\홈페이지 개발\perpackage-cafe24-file-upload-app"
```

2. 의존성을 설치한다.

```bash
npm install
```

3. 타입체크와 빌드를 실행한다.

```bash
npm run typecheck
npm run build
```

4. 에러가 있으면 먼저 수정한다.

5. Supabase SQL Editor에서 아래 파일을 실행한다.

```txt
supabase/schema.sql
```

6. Vercel 새 프로젝트를 만든다.

7. Vercel 환경변수에 `.env.example` 기준 값을 등록한다.

8. Cafe24 Developers에서 App URL과 Redirect URI를 등록한다.

App URL:

```txt
https://배포도메인
```

Redirect URI:

```txt
https://배포도메인/api/cafe24/auth/callback
```

9. `/api/cafe24/auth/start`로 OAuth 연결을 테스트한다.

10. `/upload-test`에서 작은 파일 업로드를 테스트한다.

11. `/admin`에서 OAuth 연결 상태와 최근 파일 목록을 확인한다.

## 다음 Phase 제안

Phase 2:

```txt
Cafe24 Admin API 상품/카테고리/게시판 조회 테스트
Supabase token 저장 안정화
token 암호화 검토
```

Phase 3:

```txt
ScriptTags API로 PRODUCT_DETAIL에 업로드 스크립트 삽입 테스트
상품상세 파일 업로드 UI 표시
Cafe24 상품 입력 옵션과 file_id 연결 테스트
```

Phase 4:

```txt
주문 발생 후 Admin API 또는 Webhook으로 order_id와 file_id 연결
관리자 주문 상세에서 파일 확인 흐름 검증
```

Phase 5:

```txt
Webhook으로 게시판/주문 이벤트 자동 수신
누락 보완을 위한 Admin API 주기 조회
```

Phase 6:

```txt
대용량 업로드 최적화
파일 만료/삭제 정책
다운로드 권한 관리
미리보기 생성
완성 파일 저장 정책
```

## 참고 보고서

상세 작업 보고서:

```txt
docs/gpt-report-phase1-cafe24-file-upload-app-20260629.md
```

