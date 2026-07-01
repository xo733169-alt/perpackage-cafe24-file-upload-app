# perpackage-cafe24-file-upload-app 고객용 상품상세 업로드 위젯 UX 개선 보고서

## 1. 작업 목적

Cafe24 상품상세에 삽입되는 고객용 파일 업로드 위젯(`product-upload-widget.js`)의 안내 문구, 체크리스트, 업로드 상태 메시지, 성공 결과 표시 방식을 개선했습니다.

이번 작업은 `/admin` 기능 개선이 아니라, 고객이 Cafe24 상품상세에서 직접 보는 업로드 위젯 UX 개선 작업입니다.

## 2. 수정한 파일

```txt
public/cafe24/product-upload-widget.js
```

## 3. 변경한 고객용 위젯 UI

### 상단 안내 문구 추가

위젯 상단에 아래 안내 문구를 추가했습니다.

```txt
인쇄용 파일을 업로드해 주세요.
AI, PDF, EPS, ZIP 파일 업로드를 권장합니다.
폰트는 아웃라인 처리 후 업로드해 주세요.
```

실제 업로드 API가 확장자를 강제 제한하는 구조가 아니므로, “지원”이 아니라 “권장” 표현을 사용했습니다.

### 업로드 전 체크리스트 추가

고객이 업로드 전 확인할 수 있도록 안내형 체크리스트를 추가했습니다.

```txt
폰트 아웃라인 처리
이미지 링크 포함 또는 포함 저장
칼선/도무송 선 포함
최종 인쇄 파일 확인
여러 파일은 ZIP으로 압축
```

이번 단계에서는 체크박스를 필수 입력으로 막지 않고, 안내형 리스트로만 표시합니다.

### 파일 선택 영역 문구 개선

파일 선택 영역 주변에 아래 문구를 추가했습니다.

```txt
파일을 선택한 뒤 업로드 버튼을 눌러주세요.
파일명에는 업체명 또는 상품명을 포함해 주시면 확인이 더 쉽습니다.
```

### 업로드 진행 상태 메시지 개선

업로드 중:

```txt
파일을 업로드하는 중입니다. 잠시만 기다려 주세요.
```

업로드 성공:

```txt
파일 업로드가 완료되었습니다.
주문 시 업로드 파일 ID가 함께 전달됩니다.
```

업로드 실패:

```txt
파일 업로드에 실패했습니다. 파일 용량이 너무 크거나 네트워크가 불안정할 수 있습니다. 다시 시도해 주세요.
```

### file_id 표시 방식 개선

업로드 성공 후 `file_id`는 고객 화면에서 과하게 강조하지 않고, 내부 추적용 보조 정보로 작게 표시되도록 변경했습니다.

예:

```txt
업로드 파일 ID: ecf26351...
```

## 4. 기존 file_id 자동 입력 유지 여부

기존 Cafe24 추가 입력 옵션 자동 입력 흐름은 유지했습니다.

유지된 핵심 흐름:

```txt
파일 선택
→ /api/files/upload 호출
→ Naver Object Storage 저장
→ Supabase files row 저장
→ file_id 생성
→ Cafe24 추가 입력 옵션 “업로드 파일 ID”에 전체 file_id 자동 입력
→ input/change/blur 이벤트 dispatch
```

즉, 고객 화면에서 file_id는 작게 표시하지만, Cafe24 주문 연결용 입력칸에는 기존처럼 전체 file_id가 들어갑니다.

## 5. 모바일 대응

위젯 CSS를 아래 방향으로 정리했습니다.

```txt
흰색 배경
남색 포인트
얇은 테두리
둥근 모서리
작은 화면에서 세로 배치
버튼/파일 input 가로 overflow 방지
```

모바일 기준:

- 체크리스트는 1열로 전환
- 파일 선택 input과 업로드 버튼은 세로 배치
- 버튼은 전체 폭 사용 가능
- file_id는 줄바꿈 가능한 작은 텍스트로 표시

## 6. 스타일 기준

외부 라이브러리는 추가하지 않았습니다.

위젯 class prefix는 기존처럼 `ppu-`와 root id `app-perpackage-product-upload` 범위 안에서만 적용되도록 유지했습니다.

기존 Cafe24 상품상세 CSS와 충돌하지 않도록 위젯 내부 selector만 사용했습니다.

## 7. 보안 기준

위젯에는 아래 민감정보를 노출하지 않았습니다.

```txt
Supabase service role key
Naver Object Storage access key
Naver Object Storage secret key
Cafe24 OAuth token
signed URL 원문
내부 API secret
```

검사 결과, `product-upload-widget.js`에는 위 민감값 원문이 포함되어 있지 않습니다.

## 8. 기존 기능 유지 여부

아래 기능은 유지됩니다.

```txt
파일 선택
파일 업로드 API 호출
Naver Object Storage 업로드
Supabase files 저장
file_id 생성
Cafe24 추가 입력 옵션 “업로드 파일 ID” 자동 입력
장바구니/주문/관리자 주문상세에 file_id 유지
CORS 처리
/admin 기능 전체
```

## 9. 검증 결과

아래 명령을 실행했습니다.

```bash
node --check public/cafe24/product-upload-widget.js
npm run typecheck
npm run build
```

결과:

```txt
node --check: 통과
typecheck: 통과
build: 통과
```

빌드 결과:

```txt
Next.js build 성공
/admin dynamic route 유지
/api/files/upload 유지
/api/admin/download-logs/export 유지
```

참고:

- 현재 PowerShell 세션에서는 `npm` alias가 직접 잡히지 않아 설치된 `npm.cmd` 절대 경로로 실행했습니다.
- 빌드 중 기존 Cafe24 OAuth route의 cookies 사용 관련 dynamic server usage 로그가 표시되었지만, 빌드는 성공했습니다.

## 10. 테스트 방법

운영 또는 테스트 상품상세에서 아래를 확인합니다.

1. Cafe24 상품상세 접속
2. `인쇄용 파일 업로드` 위젯이 보이는지 확인
3. 상단 안내 문구가 표시되는지 확인
4. 업로드 전 체크리스트가 표시되는지 확인
5. 파일 선택이 되는지 확인
6. 옵션 선택 전 업로드 버튼 클릭 시 옵션 선택 안내가 나오는지 확인
7. 옵션 선택 후 파일 업로드 클릭
8. 업로드 중 메시지 확인
9. 업로드 성공 메시지 확인
10. 업로드 파일 ID가 작게 표시되는지 확인
11. Cafe24 추가 입력 옵션 “업로드 파일 ID”에 전체 file_id가 자동 입력되는지 확인
12. 장바구니로 이동해 file_id가 유지되는지 확인
13. 주문완료/주문내역/Cafe24 관리자 주문상세에 file_id가 유지되는지 확인
14. 모바일 화면에서 위젯이 깨지지 않는지 확인
15. `/admin` 기능이 영향을 받지 않는지 확인

## 11. 주의할 점

현재 파일에는 이전 단계에서 작성된 깨진 한글 문자열 함수가 앞쪽에 남아 있고, 이번 작업에서는 같은 함수명을 뒤쪽에 다시 선언해 최종 선언이 사용되도록 처리했습니다.

동작 검증(`node --check`, `typecheck`, `build`)은 통과했지만, 다음 리팩터링 때는 이전 깨진 문자열 블록을 제거해 파일을 정리하는 것을 권장합니다.

이번 작업에서는 기능 안정성을 우선해 기존 자동 입력/업로드 구조를 크게 재작성하지 않았습니다.

## 12. 커밋/푸시/배포 상태

현재 이 보고서 작성 시점 기준:

```txt
커밋: 아직 안 함
push: 아직 안 함
Vercel Production 배포: 아직 안 됨
```

권장 커밋 메시지:

```txt
feat: improve product upload widget ux
```
