# GPT Report: AGENTS.md 공통 기준문서 생성

## 1. 작업 목적

`perpackage-cafe24-file-upload-app` 프로젝트의 반복 작업 기준을 프로젝트 루트 문서로 정리하기 위해 `AGENTS.md`를 생성했다.

앞으로 Codex 작업 지시 프롬프트에 매번 길게 포함하던 프로젝트 목적, 보안 기준, DB 변경 기준, Git 기준, 배포 기준을 공통 기준문서로 재사용할 수 있게 하는 것이 목적이다.

## 2. 생성한 파일

- `AGENTS.md`

## 3. 보고서 파일

- `docs/gpt-report-agents-md-guidelines-20260702.md`

## 4. 포함한 주요 항목

- 프로젝트 목적
- 핵심 운영 원칙
- 절대 변경 금지 또는 특별 주의 영역
- 보안 기준
- DB 변경 기준
- Git 작업 기준
- 배포 기준
- 검증 기준
- 현재 주요 테이블
- 현재 주요 상태값
- 기능 개발 순서 원칙
- 보고서 작성 기준

## 5. 핵심 운영 기준 요약

- Webhook 자동화는 `files.order_id` 연결까지만 담당한다.
- 파일 검수 상태는 `/admin`에서 관리자가 직접 변경한다.
- Webhook 수신, 고객 확인 완료, 교정확인 완료만으로 `files.status`를 자동 변경하지 않는다.
- 이미 다른 주문번호가 연결된 파일은 자동으로 덮어쓰지 않는다.
- 파일 삭제와 Naver Object Storage 삭제 기능은 별도 지시 전까지 만들지 않는다.

## 6. 보안 기준 반영

아래 값은 화면, 로그, API 응답, 보고서, 문서, 콘솔에 원문 노출하지 않도록 기준을 명시했다.

- access token 계열 값
- refresh token 계열 값
- authorization/bearer/token 계열 값
- client secret, API key, signature, password, cookie
- Supabase service role key
- Naver Object Storage access key/secret key
- signed URL 원문
- Webhook raw payload 전체
- JWT 문자열
- 고객에게 노출되면 안 되는 storage path 원문

## 7. DB 변경 여부

DB 변경 없음.

추가 SQL 없음.

## 8. 코드 변경 여부

코드 변경 없음.

이번 작업은 문서 추가만 수행했다.

## 9. 검증 결과

`npm run typecheck`와 `npm run build`는 실행하지 않았다.

생략 사유:

- 코드, API, UI, DB schema 변경이 없는 문서 전용 작업이다.
- 런타임 동작에 영향을 주는 파일을 수정하지 않았다.

## 10. Git 상태

`AGENTS.md` 생성 작업은 로컬 커밋 완료.

- 커밋 해시: `a83f6ed0a89d0610df1422d43cbc4c597ea4ed43`
- 커밋 메시지: `docs: add project codex guidelines`
- 로컬 브랜치: `agents-md-guidelines`

현재 이 보고서 파일은 새로 추가된 문서이며, 아직 별도 커밋하지 않았다.

## 11. Push 여부

아직 push하지 않음.

이유:

- `origin/main` push가 Vercel Production 자동 배포를 유발할 수 있다.
- 지시서에 Production 배포 유발 금지가 있어 push 전 단계에서 멈췄다.

## 12. Vercel 배포 여부

배포하지 않음.

## 13. 운영자가 확인할 사항

1. `AGENTS.md` 문서 내용이 프로젝트 운영 기준과 맞는지 확인
2. 보안 기준에 누락된 민감정보 항목이 없는지 확인
3. DB 변경 기준과 배포 기준이 현재 운영 방식과 맞는지 확인
4. 문제가 없으면 `AGENTS.md`와 이 보고서 파일만 선별 커밋/push 진행

## 14. 다음 추천 작업

- 사용자 확인 후 `AGENTS.md`와 보고서 파일을 함께 `origin/main`에 push
- push 시 Production 자동 배포가 발생할 수 있으므로 배포 여부를 다시 확인
- 이후 새 Codex 작업 지시에서는 `AGENTS.md`를 프로젝트 공통 기준으로 활용
