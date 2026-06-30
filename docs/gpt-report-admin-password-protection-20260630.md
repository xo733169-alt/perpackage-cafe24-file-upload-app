# GPT 보고서: 관리자 비밀번호 보호 적용

## 1. 작업 목적

Cafe24 파일 업로드 앱에서 `/admin`과 `/api/files/download`를 운영 전에 최소한으로 보호하기 위해 환경변수 기반 관리자 비밀번호와 서명된 세션 쿠키 방식을 추가했습니다.

이번 작업은 사용자 계정 시스템, Supabase Auth, OAuth 로그인을 만들지 않고, 단일 관리자 비밀번호로 접근을 제한하는 1차 운영 안정화입니다.

## 2. 보호 대상

- `/admin`
- `/api/files/download?file_id=<id>`

## 3. 관리자 인증 방식 요약

1. `/admin` 접속 시 `perpackage_admin_session` 쿠키를 확인합니다.
2. 쿠키가 없거나 유효하지 않으면 로그인 화면을 표시합니다.
3. 관리자가 비밀번호를 입력합니다.
4. 입력값이 `ADMIN_ACCESS_PASSWORD`와 일치하면 HMAC 서명된 세션 토큰을 쿠키에 저장합니다.
5. 로그인 후 `/admin`으로 redirect됩니다.
6. `/api/files/download` route도 같은 세션 쿠키를 검증합니다.
7. 세션이 없으면 signed URL을 만들지 않고 401을 반환합니다.

쿠키에는 비밀번호 원문을 저장하지 않습니다.

## 4. 필요한 Vercel 환경변수

Vercel Production 환경변수에 아래 2개를 추가해야 합니다.

```env
ADMIN_ACCESS_PASSWORD=
ADMIN_SESSION_SECRET=
```

설명:

- `ADMIN_ACCESS_PASSWORD`: `/admin` 로그인에 사용할 관리자 비밀번호
- `ADMIN_SESSION_SECRET`: 관리자 세션 쿠키 서명과 검증에 사용할 긴 랜덤 문자열

주의:

- 실제 값은 코드, 문서, GitHub에 커밋하지 않습니다.
- `ADMIN_SESSION_SECRET`은 충분히 긴 랜덤 문자열이어야 합니다.
- 환경변수 추가 후 Vercel Production redeploy가 필요합니다.

## 5. 쿠키 설정

쿠키 이름:

```txt
perpackage_admin_session
```

설정:

- `httpOnly: true`
- `secure: production에서는 true`
- `sameSite: lax`
- `path: /`
- `maxAge: 8시간`

세션 토큰 구조:

- payload: `iat`, `exp`, `nonce`
- signature: `ADMIN_SESSION_SECRET` 기반 HMAC SHA-256
- 비밀번호 원문은 쿠키에 들어가지 않음

## 6. 수정한 파일

- `.env.example`
- `src/app/admin/page.tsx`
- `src/app/admin/actions.ts`
- `src/app/api/files/download/route.ts`
- `src/lib/admin/auth.ts`

## 7. 추가한 파일

- `src/lib/admin/auth.ts`
- `src/app/admin/actions.ts`
- `docs/gpt-report-admin-password-protection-20260630.md`

## 8. 유지한 기능

아래 기존 기능은 유지했습니다.

- `/admin` file_id 검색
- `/admin` 최근 업로드 파일 목록
- Cafe24 OAuth 상태 표시
- Supabase 상태 표시
- Naver Object Storage 상태 표시
- `/api/files/download` signed URL redirect
- `/api/files/upload`
- `/upload-test`
- `product-upload-widget.js`

## 9. 이번 작업에서 하지 않은 것

- 사용자별 계정 시스템
- 이메일 로그인
- OAuth 로그인
- Supabase Auth
- 다운로드 로그 저장
- 주문 Webhook
- Cafe24 Admin API 주문 조회
- `files.order_id` 자동 연결
- 파일 삭제
- public URL 영구 공개
- 100MB 업로드
- multipart upload
- ScriptTags API 실제 등록

## 10. 보안 기준

아래 값은 화면, 로그, API 응답, 문서에 원문으로 노출하지 않았습니다.

- 관리자 비밀번호
- `ADMIN_SESSION_SECRET`
- Supabase service role key
- Naver Object Storage access key
- Naver Object Storage secret key
- Cafe24 access token
- Cafe24 refresh token
- Cafe24 client secret
- Authorization header value

## 11. 검증 결과

실행 대상:

```bash
npm run typecheck
npm run build
```

검증 결과는 최종 작업 보고에 별도 기록합니다.

## 12. Vercel 배포 후 테스트 순서

### /admin 로그인

1. Vercel Production 환경변수에 `ADMIN_ACCESS_PASSWORD`, `ADMIN_SESSION_SECRET`을 추가합니다.
2. Production redeploy를 실행합니다.
3. `/admin`에 접속합니다.
4. 로그인 화면이 표시되는지 확인합니다.
5. 잘못된 비밀번호 입력 시 `비밀번호가 올바르지 않습니다.`가 표시되는지 확인합니다.
6. 올바른 비밀번호 입력 시 `/admin` 관리 화면으로 이동하는지 확인합니다.

### file_id 검색과 다운로드

1. 로그인 후 Cafe24 관리자 주문상세의 `업로드 파일 ID`를 복사합니다.
2. `/admin`에서 `file_id` 검색을 실행합니다.
3. 파일 정보가 표시되는지 확인합니다.
4. `파일 다운로드` 버튼을 클릭합니다.
5. signed URL 기반 다운로드가 정상 동작하는지 확인합니다.
6. 다운로드 파일명이 `original_filename` 기준인지 확인합니다.

### 로그아웃과 다운로드 차단

1. `/admin`에서 `로그아웃` 버튼을 클릭합니다.
2. 로그인 화면으로 돌아오는지 확인합니다.
3. 로그아웃 상태에서 `/api/files/download?file_id=<id>`를 직접 호출합니다.
4. 401 응답이 반환되고 signed URL이 생성되지 않는지 확인합니다.

## 13. 다음 단계 제안

1. 다운로드 로그 저장
2. 관리자 비밀번호 회전 정책 정리
3. `files.order_id` 자동 연결
4. 주문번호/file_id/상품번호 통합 검색
5. 필요 시 Supabase Auth 또는 SSO 기반 관리자 계정으로 확장
