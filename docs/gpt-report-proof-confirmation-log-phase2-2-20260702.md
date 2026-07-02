# GPT Report: 교정확인 이력 관리 화면 Phase 2-2

## 1. 작업 목적

`/admin?file_id=<file_id>` 파일 상세에서만 확인하던 교정확인 이력을 `/admin` 전체 화면에서도 운영자가 최근 순으로 확인하고 필터링할 수 있게 개선했다.

이번 작업은 관리자 조회 화면 개선이며, 고객용 링크 생성, 자동 발송, 파일 상태 자동 전환, DB schema 변경은 하지 않았다.

## 2. 수정한 파일 목록

- `src/lib/files/proof-confirmation-service.ts`
- `src/app/admin/page.tsx`
- `docs/gpt-report-proof-confirmation-log-phase2-2-20260702.md`

## 3. 주요 변경 내용

- `file_proof_confirmations` 전체 목록 조회 함수 `listProofConfirmations()` 추가
- `/admin`에 `전체 교정확인 이력` 섹션 추가
- 교정확인 이력 필터 UI 추가
- `requested` 상태는 고객 회신 대기 건으로 눈에 띄게 표시
- `request_message` 전체 원문 대신 선택 항목, 추가 메모, 고객 회신/수정 요청 요약만 표시

## 4. 전체 교정확인 이력 조회 방식

- 조회 테이블: `public.file_proof_confirmations`
- 정렬: `created_at desc`
- 기본 표시: 최근 10개
- `proof_status`는 DB 필터로 적용
- `order_id`는 DB `ilike` 필터로 적용
- `file_id`는 UUID 컬럼 타입 충돌을 피하기 위해 최근 조회 결과에서 문자열 부분 검색으로 필터링

## 5. 추가한 필터

Query string:

- `proof_status=all`
- `proof_status=requested`
- `proof_status=confirmed`
- `proof_status=rejected`
- `proof_status=canceled`
- `proof_status=skipped`
- `proof_file_id=<file_id>`
- `proof_order_id=<order_id>`

필터 옵션:

- 전체
- 교정확인 요청
- 고객 확인 완료
- 고객 수정 요청
- 요청 취소
- 교정확인 생략

## 6. /admin UI 변경 내용

`Cafe24 Webhook 수신 로그` 아래에 `전체 교정확인 이력` 섹션을 추가했다.

표시 컬럼:

- 요청일시
- 상태
- Cafe24 주문번호
- file_id
- 선택 항목
- 추가 메모
- 회신 채널
- 고객 회신/수정 요청
- 처리자

## 7. 변경하지 않은 기존 기능

- 기존 파일 상세 교정확인 안내문 생성/복사
- 파일별 교정확인 이력 표시
- 고객 확인 완료/수정 요청/요청 취소 기록
- files.status 자동 변경 없음
- Webhook 자동 연결 로직
- 주문번호 수동 연결
- Cafe24 주문 조회 기반 반자동 연결
- 파일 다운로드와 다운로드 로그
- 파일 상태 변경과 상태 변경 이력
- 최근 업로드 파일 목록/필터
- 전체 다운로드 로그/CSV

## 8. 보안 기준 유지 여부

- access token, refresh token, client secret, API key, signed URL 원문, Webhook raw payload 전체를 화면이나 보고서에 기록하지 않았다.
- `request_message` 긴 원문 전체를 전체 이력 테이블에 노출하지 않았다.
- `storage_path`, signed URL은 전체 교정확인 이력 섹션에 표시하지 않았다.

## 9. typecheck 결과

통과.

```txt
npm run typecheck
tsc --noEmit
```

## 10. build 결과

통과.

```txt
npm run build
next build
Compiled successfully
```

참고: build 중 기존 Cafe24 OAuth start route의 dynamic server usage 감지 로그가 출력됐지만 build는 성공했다.

## 11. 커밋 해시

커밋 생성 후 최종 보고에서 별도 기재.

## 12. push 여부

아직 push하지 않음. 지시서 기준으로 Production 배포 전 보고 단계에서 중단한다.

## 13. Vercel 배포 여부

아직 배포하지 않음.

## 14. 운영자가 /admin에서 확인해야 할 테스트 순서

1. `/admin` 접속
2. `전체 교정확인 이력` 섹션 표시 확인
3. `proof_status=전체` 상태에서 최근 이력 표시 확인
4. `교정확인 요청` 필터 적용 확인
5. `고객 확인 완료`, `고객 수정 요청`, `요청 취소`, `교정확인 생략` 필터 확인
6. `file_id` 전체 또는 일부값 검색 확인
7. Cafe24 주문번호 검색 확인
8. 필터 적용 후 URL query 유지 확인
9. 초기화 버튼으로 교정확인 이력 필터만 초기화되는지 확인
10. 기존 file_id 상세 교정확인 이력 기능이 유지되는지 확인
11. Webhook 필터, 다운로드 로그 필터, 주문번호 검색, 파일 다운로드, 상태 변경 기능 유지 확인

## 15. DB 변경 또는 추가 SQL 필요 여부

없음. 기존 `file_proof_confirmations` 테이블만 조회한다.

## 16. 다음 작업 추천

- 운영 확인 후 필요하면 전체 교정확인 이력 CSV export 또는 날짜 범위 필터를 별도 Phase로 검토
- 고객용 교정확인 링크/자동 발송은 별도 설계 문서 기준으로 후속 Phase에서 진행
