# Cafe24 Webhook 민감정보 마스킹 보강 보고서

작성일: 2026-07-01

## 1. 작업 목적

Cafe24 Webhook 수신 로그를 `cafe24_webhook_events`에 저장할 때 `headers_summary`와 payload 내부에 인증/토큰/서명 관련 문자열이 남을 가능성을 줄이기 위해 마스킹 기준을 강화했다.

이번 작업은 Webhook 자동 연결 로직 자체를 변경하지 않고, 저장 전 sanitizing 범위만 보강했다.

## 2. 수정한 파일

- `src/lib/cafe24/webhook-events.ts`

## 3. 마스킹 기준

아래 문자열이 header key, header value, payload key, payload string value에 포함되면 값을 `[masked]`로 저장하도록 보강했다.

- `authorization`
- `bearer`
- `token`
- `access_token`
- `refresh_token`
- `client_secret`
- `secret`
- `signature`
- `password`
- `cookie`
- `x-api-key`
- `api-key`
- `api_key`
- `x-vercel-oidc-token`
- `x-vercel-sc-headers`
- `x-vercel-proxy-signature`
- `x-vercel-proxy-signature-ts`
- `forwarded`

추가로 JWT 형태로 보이는 문자열도 `[masked]` 처리한다.

## 4. 적용 방식

### headers_summary

`summarizeHeaders()`에서 아래 조건 중 하나라도 해당하면 header 값을 `[masked]`로 저장한다.

- header key가 민감 패턴과 일치
- header value가 민감 문자열을 포함
- header value가 JWT 형태와 일치

### payload

`sanitizeJsonValue()`에서 아래 조건 중 하나라도 해당하면 `[masked]`로 저장한다.

- payload key가 민감 패턴과 일치
- string value가 민감 문자열을 포함
- string value가 JWT 형태와 일치

`/admin` 화면은 기존처럼 payload raw 전체가 아니라 요약 정보만 표시하는 구조를 유지한다.

## 5. 기존 로그 정리용 SQL

아래 SQL은 이미 저장된 `cafe24_webhook_events.headers_summary` 안의 민감 가능 값을 정리하기 위한 제안이다.

자동 실행하지 않았다. Supabase SQL Editor에서 실행 전 백업 또는 샘플 row 확인을 권장한다.

```sql
-- 1) 알려진 민감 header key가 있는 경우 해당 값 마스킹
update public.cafe24_webhook_events
set headers_summary = coalesce(headers_summary, '{}'::jsonb)
  || jsonb_build_object('authorization', '[masked]')
  || jsonb_build_object('cookie', '[masked]')
  || jsonb_build_object('x-api-key', '[masked]')
  || jsonb_build_object('x-vercel-oidc-token', '[masked]')
  || jsonb_build_object('x-vercel-sc-headers', '[masked]')
  || jsonb_build_object('x-vercel-proxy-signature', '[masked]')
  || jsonb_build_object('x-vercel-proxy-signature-ts', '[masked]')
  || jsonb_build_object('forwarded', '[masked]')
where headers_summary ?| array[
  'authorization',
  'cookie',
  'x-api-key',
  'x-vercel-oidc-token',
  'x-vercel-sc-headers',
  'x-vercel-proxy-signature',
  'x-vercel-proxy-signature-ts',
  'forwarded'
];

-- 2) key 또는 value에 민감 문자열/JWT 형태가 남아 있는 경우 값만 마스킹
update public.cafe24_webhook_events
set headers_summary = (
  select jsonb_object_agg(
    key,
    case
      when lower(key) ~ '(authorization|bearer|token|access_token|refresh_token|client_secret|secret|signature|password|cookie|x-api-key|api-key|api_key|x-vercel-oidc-token|x-vercel-sc-headers|x-vercel-proxy-signature|x-vercel-proxy-signature-ts|forwarded)'
        or lower(value #>> '{}') ~ '(authorization|bearer|token|access_token|refresh_token|client_secret|secret|signature|password|cookie|x-api-key|api-key|api_key|x-vercel-oidc-token|x-vercel-sc-headers|x-vercel-proxy-signature|x-vercel-proxy-signature-ts|forwarded)'
        or (value #>> '{}') ~ '[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'
      then to_jsonb('[masked]'::text)
      else value
    end
  )
  from jsonb_each(headers_summary)
)
where headers_summary is not null;
```

## 6. 테스트 결과

- `npm run typecheck`: 통과
- `npm run build`: 통과

운영 Webhook POST 및 Supabase row 직접 확인은 이번 로컬 작업에서는 실행하지 않았다. 배포 후 아래 기준으로 확인하면 된다.

1. 테스트 Webhook POST
2. `cafe24_webhook_events.headers_summary` 확인
3. `x-vercel-sc-headers`, `authorization`, `bearer`, `token`, `signature` 관련 값이 `[masked]` 처리되는지 확인
4. `processed_status`가 `auto_linked` 또는 `already_linked`로 기존처럼 처리되는지 확인

## 7. 커밋/푸시/배포 여부

- 커밋: 아직 안 함
- 푸시: 아직 안 함
- Vercel Production 배포: 아직 안 함

