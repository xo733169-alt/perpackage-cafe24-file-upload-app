# GPT 보고서: Cafe24 상품상세 업로드 위젯 실제 업로드 성공

작성일: 2026-06-30

프로젝트: `perpackage-cafe24-file-upload-app`

## 1. 작업 목적

Cafe24 상품상세 페이지에 삽입한 페르패키지 인쇄파일 업로드 위젯이 실제 운영형 테스트 환경에서 정상 작동하는지 확인했습니다.

이번 검증의 핵심은 아래 흐름이 실제로 이어지는지 확인하는 것이었습니다.

```txt
Cafe24 상품상세
→ product-upload-widget.js 로드
→ 인쇄파일 업로드 UI 표시
→ Vercel API로 파일 업로드
→ Supabase files row 생성
→ Naver Object Storage 파일 저장
→ /admin 최근 업로드 목록 표시
```

## 2. 테스트 상품상세 URL

```txt
https://peerl.cafe24.com/skin-skin17/product/detail.html?product_no=54&cate_no=1&display_group=10
```

## 3. 확인된 성공 흐름

아래 항목을 확인했습니다.

```txt
product-upload-widget.js 정상 로드
인쇄파일 업로드 UI 표시 성공
기존 Cafe24 옵션 선택/구매 버튼 화면 유지
파일 선택 후 업로드 버튼 클릭 가능
CORS 오류 해결
업로드 성공 메시지 표시
file_id 표시 확인
Supabase files 테이블 row 생성 확인
Naver Object Storage 실제 파일 저장 확인
/admin 최근 업로드 파일 목록 표시 확인
```

## 4. 저장 확인 결과

Supabase:

```txt
files 테이블에 product_no=54 row 생성 확인
```

Naver Object Storage:

```txt
bucket: perpackage-files
path: cafe24-files/peerl/54/20260630
```

관리자 화면:

```txt
/admin 최근 업로드 파일 목록에 업로드 파일 표시 확인
```

## 5. CORS 수정 효과

이전 테스트에서는 Cafe24 상품상세 도메인에서 Vercel API를 호출할 때 `Failed to fetch`가 표시되었습니다.

`/api/files/upload` route에 allowlist 기반 CORS 처리를 추가한 뒤, Cafe24 상품상세에서 파일 업로드 요청이 정상 처리되었습니다.

현재 허용 Origin:

```txt
https://peerl.cafe24.com
https://www.peerl.cafe24.com
https://perpackage-cafe24-file-upload-app.vercel.app
```

## 6. 확인 화면

이번 테스트에서 확인한 화면/관리 위치는 아래와 같습니다.

```txt
Cafe24 상품상세 테스트 페이지
Vercel Production 정적 JS URL
Supabase files 테이블
Naver Object Storage perpackage-files 버킷
앱 /admin 최근 업로드 파일 목록
```

## 7. 현재 가능한 부분

현재 Phase 기준으로 가능한 기능은 아래와 같습니다.

```txt
Cafe24 상품상세에 업로드 UI 삽입
상품번호 product_no 수집
파일 업로드
Supabase 메타데이터 저장
Naver Object Storage 실제 파일 저장
관리자 화면에서 최근 업로드 파일 확인
```

## 8. 남은 한계

아래 기능은 아직 구현하지 않았습니다.

```txt
ScriptTags API를 통한 자동 삽입
운영몰 전체 상품 자동 적용
Cafe24 주문번호와 파일 자동 연결
Cafe24 상품 입력 옵션에 file_id 자동 삽입
주문 완료 후 파일 매칭
Webhook 기반 주문 연동
대용량 multipart upload
presigned URL 업로드
관리자 파일 다운로드/검수 고도화
고객별 업로드 이력 화면
```

즉, 현재는 “상품상세에서 파일을 업로드하고 관리자에서 확인하는 1차 삽입 테스트”가 성공한 단계입니다.

## 9. 보안 주의사항

이번 테스트와 보고서에는 아래 값을 노출하지 않았습니다.

```txt
Supabase service role key
Naver Object Storage access key
Naver Object Storage secret key
Cafe24 access token
Cafe24 refresh token
client secret
authorization header value
```

브라우저에는 업로드 성공 확인에 필요한 `file_id`, `original_filename`, `status` 수준만 표시하는 방향을 유지해야 합니다.

## 10. 다음 단계 제안

### 1단계: 테스트 상품 기준 안정화

```txt
상품상세 위젯 UI 문구 정리
파일 제한 안내 추가
업로드 실패 메시지 개선
모바일 표시 확인
다른 파일 형식 테스트
```

### 2단계: 주문 연결 설계

```txt
file_id를 Cafe24 주문과 연결하는 방식 결정
상품 입력 옵션에 file_id를 자동 삽입할지 검토
주문서/관리자 주문상세에서 file_id 확인 가능 여부 점검
```

### 3단계: 운영 적용 방식 결정

```txt
ScriptTags API 자동 삽입
특정 상품만 적용
전체 상품 적용
Cafe24 스킨 직접 삽입 방식 유지 여부 결정
```

### 4단계: 관리자 운영 기능 확장

```txt
파일 다운로드
검수 상태
수정 요청
주문번호/상품번호/고객 기준 검색
파일 보관 정책
```

## 11. 최종 판단

Cafe24 상품상세 업로드 위젯은 실제 테스트 상품 기준으로 정상 작동했습니다.

이번 단계에서 확인된 가장 중요한 성과는 아래입니다.

```txt
Cafe24 상품상세에서 선택한 파일이
Vercel API를 거쳐
Supabase 메타데이터와
Naver Object Storage 실제 파일로 저장되고
관리자 화면에서 확인되는 흐름이 연결됨
```

따라서 다음 Phase에서는 “업로드된 파일을 Cafe24 주문과 어떻게 안정적으로 연결할 것인가”를 중심으로 진행하는 것이 적절합니다.

