# GPT 보고용: 페르패키지 Cafe24 파일 업로드 앱 1차 골격 생성 보고

## 1. 작업 목적

페르패키지 Cafe24 쇼핑몰에 설치해서 사용할 내부용 파일 업로드 앱의 1차 개발 골격을 생성했다.

이번 단계는 완성된 파일 업로드 앱이 아니라, Cafe24 앱 개발을 시작하기 위한 안전한 기본 구조를 만드는 작업이다.

## 2. 생성 프로젝트

```txt
perpackage-cafe24-file-upload-app
```

기술 스택:

```txt
Next.js App Router
TypeScript
Vercel 배포 기준
Supabase DB 예정
Naver Object Storage 예정
Cafe24 OAuth/HMAC/Admin API/ScriptTags API 확장 예정
```

## 3. 생성한 주요 파일

```txt
package.json
.gitignore
.env.example
README.md
next.config.mjs
tsconfig.json
next-env.d.ts

src/app/layout.tsx
src/app/globals.css
src/app/page.tsx
src/app/admin/page.tsx
src/app/upload-test/page.tsx

src/app/api/cafe24/auth/start/route.ts
src/app/api/cafe24/auth/callback/route.ts
src/app/api/cafe24/token/refresh/route.ts
src/app/api/files/upload/route.ts

src/components/upload-test-form.tsx

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

supabase/schema.sql
docs/gpt-report-phase1-cafe24-file-upload-app-20260629.md
```

## 4. 구현한 기능

### Cafe24 앱 실행 처리

Cafe24 앱 실행 시 전달될 수 있는 query parameter를 파싱하는 구조를 만들었다.

대상 값:

```txt
auth_config
is_multi_shop
lang
mall_id
nation
shop_no
timestamp
user_id
user_name
user_type
hmac
```

관리 화면에는 안전한 값만 표시한다.

표시 가능:

```txt
mall_id
shop_no
lang
nation
user_id
user_name
user_type
is_multi_shop
```

표시 금지:

```txt
hmac
access_token
refresh_token
client_secret
storage secret
service role key
```

### HMAC 검증

`src/lib/cafe24/hmac.ts`에 앱 실행 HMAC 검증 로직을 구현했다.

검증 기준:

```txt
hmac 제외
parameter 이름 기준 정렬
URLSearchParams 기반 canonical query string 생성
CAFE24_CLIENT_SECRET으로 HMAC-SHA256
Base64 digest 비교
timestamp 2시간 초과 시 거부
```

실패 시 사용자 화면에는 기술 원문을 노출하지 않고 일반 안내만 보여준다.

### OAuth

구현 route:

```txt
/api/cafe24/auth/start
/api/cafe24/auth/callback
/api/cafe24/token/refresh
```

구현 내용:

```txt
OAuth state 생성
state cookie 저장
Cafe24 authorize URL 생성
callback state 검증
authorization code로 token 발급
refresh token으로 access token 갱신
Supabase cafe24_installations 테이블에 token 저장
```

### Supabase

Supabase admin/client 분리:

```txt
src/lib/supabase/admin.ts
src/lib/supabase/client.ts
```

생성 schema:

```txt
supabase/schema.sql
```

테이블:

```txt
cafe24_installations
files
```

### Naver Object Storage

S3-compatible SDK 기반 업로드 초안:

```txt
src/lib/storage/naver-object-storage.ts
```

특징:

```txt
서버에서만 access key/secret key 사용
stored_filename 생성
storage_path 생성
업로드 성공 시 bucket/path 반환
```

### 파일 업로드 API

구현 route:

```txt
/api/files/upload
```

동작:

```txt
multipart formData 파일 수신
10MB 기본 제한
Naver Object Storage 저장
Supabase files 테이블에 메타데이터 저장
file_id, original_filename, file_size, mime_type, status, storage_path 반환
```

### 개발용 테스트 페이지

구현 경로:

```txt
/upload-test
```

표시:

```txt
mall_id
shop_no
product_no
variant_code
customer_type
customer_identifier
파일 선택
업로드 결과
```

### 관리자 기본 화면

구현 경로:

```txt
/admin
```

표시:

```txt
Cafe24 설정 상태
Supabase 설정 상태
Naver Object Storage 설정 상태
OAuth 연결 상태
최근 업로드 파일 목록
```

token 원문과 secret은 표시하지 않는다.

## 5. 환경변수 목록

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

## 6. Supabase schema

파일:

```txt
supabase/schema.sql
```

생성 테이블:

```txt
cafe24_installations
files
```

1차에서는 token 암호화까지 구현하지 않고, token 저장 구조를 분리해 두었다. 운영 전에는 암호화 또는 별도 secret 관리 정책이 필요하다.

## 7. 이번에 구현하지 않은 기능

```txt
Cafe24 상품상세 실제 스크립트 삽입
ScriptTags API 실제 등록
Webhook 실제 수신 처리
주문 데이터 실제 자동 연동
상품 입력 옵션에 file_id 자동 삽입
고객 회원 인증 기반 견적함
운영몰 설치
대용량 100MB 완성 처리
바이러스 검사
파일 미리보기 변환
실제 결제/주문 연결 자동화
multipart upload
presigned URL 직접 업로드
```

## 8. 보안 주의사항

```txt
client_secret은 서버에서만 사용
access_token과 refresh_token은 프론트엔드 노출 금지
Naver Object Storage access key/secret key 프론트엔드 노출 금지
Supabase service role key는 서버에서만 사용
.env.local GitHub 커밋 금지
API 에러 원문 사용자 노출 금지
운영몰에 바로 설치하지 말고 테스트 쇼핑몰에서 먼저 검증
```

## 9. 검증 결과

이번 환경에서는 새 프로젝트 의존성을 설치하지 않았다.

Git 확인:

```txt
git status: 실행 시도했으나 새 프로젝트 폴더가 아직 Git 저장소가 아니어서 실패
git pull origin main: Git 저장소 초기화 전이라 실행 대상 아님
```

실행하지 못한 명령:

```bash
npm install
npm run typecheck
npm run build
```

사유:

```txt
새 프로젝트 생성 단계이며 node_modules가 아직 없음
네트워크 설치가 필요한 상태
```

대신 파일 구조, import 경로, 민감값 노출 여부, 구현 범위는 정적으로 확인했다.

## 10. 다음 작업 제안

1. `perpackage-cafe24-file-upload-app` 폴더에서 의존성 설치
2. `npm run typecheck`
3. `npm run build`
4. Supabase SQL Editor에서 `supabase/schema.sql` 실행
5. Vercel 프로젝트 생성
6. Vercel 환경변수 등록
7. Cafe24 Developers App URL / Redirect URI 등록
8. 테스트 쇼핑몰에서 OAuth 연결 확인
9. `/upload-test`로 작은 파일 업로드 테스트
10. `/admin`에서 최근 파일 목록 확인
