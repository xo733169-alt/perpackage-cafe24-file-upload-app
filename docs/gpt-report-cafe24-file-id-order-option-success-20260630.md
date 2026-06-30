# GPT 보고서: Cafe24 A 방식 file_id 주문 연결 테스트 성공

작성일: 2026-06-30

프로젝트: `perpackage-cafe24-file-upload-app`

## 1. 작업 목적

Cafe24 상품상세 업로드 위젯에서 업로드된 파일의 `file_id`가 Cafe24 주문 데이터에 남는지 확인했습니다.

이번 테스트의 핵심은 “A 방식” 주문 연결입니다.

```txt
A 방식:
업로드 성공 후 생성된 file_id를
Cafe24 상품 추가 입력 옵션 "업로드 파일 ID"에 자동 입력하고,
그 값이 장바구니, 주문내역, Cafe24 관리자 주문상세까지 전달되는지 확인하는 방식
```

## 2. 최종 확인 상태

아래 흐름이 성공했습니다.

```txt
Cafe24 상품상세 파일 업로드 성공
업로드 후 file_id 자동 입력 성공
장바구니에 업로드 파일 ID 표시 성공
주문내역에 업로드 파일 ID 표시 성공
Cafe24 관리자 주문상세에 업로드 파일 ID 표시 성공
Supabase files 테이블에서 같은 file_id row 확인
Naver Object Storage에 실제 파일 저장 확인
```

## 3. 성공 흐름

실제 확인된 연결 흐름은 아래와 같습니다.

```txt
1. 고객이 Cafe24 상품상세에서 상품 옵션 선택
2. 상품 옵션 선택 후 "업로드 파일 ID" 추가 입력 옵션 칸 생성
3. 고객이 인쇄파일 업로드 위젯에서 파일 선택
4. 위젯이 업로드 전 "업로드 파일 ID" 입력칸 존재 여부 확인
5. /api/files/upload로 파일 업로드
6. Supabase files 테이블에 메타데이터 저장
7. Naver Object Storage에 실제 파일 저장
8. API 응답에서 file_id 반환
9. 위젯이 Cafe24 "업로드 파일 ID" 입력칸에 file_id 자동 입력
10. input/change/blur 이벤트 발생
11. 장바구니에 업로드 파일 ID 표시
12. 주문내역에 업로드 파일 ID 표시
13. Cafe24 관리자 주문상세에 업로드 파일 ID 표시
14. Supabase files 테이블에서 같은 file_id row 확인
```

## 4. 확인 화면

이번 테스트에서 확인한 화면과 저장 위치는 아래입니다.

```txt
Cafe24 상품상세
Cafe24 장바구니
Cafe24 주문내역
Cafe24 관리자 주문상세
Supabase files 테이블
Naver Object Storage perpackage-files 버킷
perpackage-cafe24-file-upload-app /admin 최근 업로드 파일 목록
```

## 5. 현재 Supabase 상태

Supabase `files` 테이블에서 같은 `file_id` row가 확인되었습니다.

다만 현재 단계에서는 아래 상태입니다.

```txt
files.order_id = NULL
```

즉, 현재 성공한 것은 Cafe24 주문 화면과 관리자 주문상세 안에 `file_id`가 남는 구조입니다.

Supabase `files.order_id`에 Cafe24 주문번호를 자동 연결하는 기능은 아직 구현하지 않았고, 다음 Phase에서 진행할 예정입니다.

## 6. 현재 구현된 연결 방식

현재 연결 방식은 아래와 같습니다.

```txt
Cafe24 주문 데이터 안의 "업로드 파일 ID"
→ Supabase files.id
→ Naver Object Storage 저장 파일
```

현재는 Cafe24 주문번호가 Supabase row에 자동 저장되지는 않습니다.

운영자가 Cafe24 관리자 주문상세에서 `업로드 파일 ID`를 확인하면, 해당 값을 기준으로 Supabase `files.id` row와 실제 저장 파일을 찾을 수 있습니다.

## 7. 위젯 보완 사항

현재 위젯에는 아래 안정화가 반영되어 있습니다.

```txt
업로드 전 "업로드 파일 ID" 입력칸 선확인
입력칸이 없으면 업로드 요청 차단
상품 옵션 선택 안내 표시
업로드 성공 후 file_id 자동 입력
input/change/blur 이벤트 dispatch
자동 입력 실패 시 "업로드 파일 ID 다시 입력하기" 버튼 표시
업로드 성공 후 "다시 업로드하기" 버튼 표시
다시 업로드 성공 시 새 file_id로 입력칸 값 교체
```

이 구조 덕분에 상품 옵션 선택 전 파일을 업로드해서 주문 연결이 끊기는 위험을 줄였습니다.

## 8. 업로드 파일 ID 옵션 운영 방향

`업로드 파일 ID`는 고객이 직접 작성하는 값이 아니라, 위젯이 자동 입력하는 주문 연결용 내부 값입니다.

따라서 Cafe24 추가 입력 옵션은 필수보다 선택값으로 운영하는 방향이 적절합니다.

추천 설정:

```txt
추가 입력 옵션명: 업로드 파일 ID
필수 여부: 선택
입력 방식: 텍스트 입력
장바구니/주문내역/관리자 주문상세 표시: 표시
```

단, 선택값으로 바꾸더라도 상품 옵션 선택 후 입력칸 자체는 DOM에 생성되어야 합니다.

## 9. 이번 단계에서 성공한 것

이번 Phase에서 성공한 항목은 아래입니다.

```txt
상품상세 위젯 삽입
파일 업로드
Supabase files row 생성
Naver Object Storage 저장
file_id 생성
Cafe24 추가 입력 옵션 자동 입력
장바구니 file_id 표시
주문내역 file_id 표시
Cafe24 관리자 주문상세 file_id 표시
Supabase files.id와 Cafe24 주문상세 file_id 수동 매칭 가능
```

## 10. 아직 남은 한계

아래 기능은 아직 구현하지 않았습니다.

```txt
Supabase files.order_id 자동 업데이트
Cafe24 주문번호와 file_id 자동 연결
Cafe24 주문 API/Webhook에서 추가 입력 옵션 값 자동 수집
관리자 화면에서 주문번호 기준 files row 자동 조회
관리자 파일 다운로드/검수 고도화
ScriptTags API 실제 등록
전체 상품 자동 적용
Naver Object Storage 파일 삭제
Supabase row 삭제
presigned URL
multipart upload
100MB 업로드
```

## 11. 다음 Phase 제안

다음 Phase는 “Cafe24 주문번호와 Supabase files row 자동 연결”입니다.

추천 흐름:

```txt
1. Cafe24 주문 API 또는 Webhook에서 주문 상세 조회
2. 주문 상품 옵션/추가 입력 옵션에서 "업로드 파일 ID" 값 추출
3. 추출한 file_id로 Supabase files row 조회
4. files.order_id에 Cafe24 주문번호 저장
5. files.mall_id, product_no, order_id, file_id를 관리자 화면에서 함께 표시
6. 관리자 다운로드/검수 흐름으로 연결
```

## 12. 다음 Phase에서 확인할 것

다음 작업 전 아래를 확인해야 합니다.

```txt
Cafe24 주문 API 응답에 "업로드 파일 ID" 추가 입력 옵션 값이 포함되는지
주문내역/관리자 화면에 보이는 값과 API 응답 path가 일치하는지
Webhook payload만으로 file_id를 얻을 수 있는지
Webhook payload에 없다면 주문 상세 API 재조회가 필요한지
Supabase files.order_id 업데이트 API를 어디에 둘지
주문번호가 변경/취소/재주문될 때 파일 연결 정책을 어떻게 둘지
```

## 13. 보안 주의사항

이번 보고서에는 아래 민감값을 포함하지 않았습니다.

```txt
Supabase service role key
Naver Object Storage access key
Naver Object Storage secret key
Cafe24 access token
Cafe24 refresh token
client secret
authorization header value
```

브라우저에는 주문 연결에 필요한 `file_id`, 원본 파일명, 업로드 상태 정도만 표시하는 방향을 유지합니다.

## 14. 최종 판단

Cafe24 A 방식 주문 연결 테스트는 성공했습니다.

현재 상태를 한 줄로 정리하면 아래와 같습니다.

```txt
Cafe24 주문 데이터 안에 file_id를 남기는 데 성공했고,
그 file_id로 Supabase files row와 Naver Object Storage 파일을 추적할 수 있습니다.
```

다만 Supabase `files.order_id`는 아직 `NULL`이므로, 다음 Phase에서는 Cafe24 주문번호를 Supabase 파일 row에 자동 연결하는 작업이 필요합니다.

