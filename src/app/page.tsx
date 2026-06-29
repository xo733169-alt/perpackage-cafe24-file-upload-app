import { getCafe24Config, getCafe24ConfigStatus } from "@/lib/cafe24/config";
import { getSafeLaunchContext, validateCafe24Launch } from "@/lib/cafe24/hmac";

type HomePageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function toURLSearchParams(input: Record<string, string | string[] | undefined> = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
      continue;
    }

    if (value !== undefined) params.set(key, value);
  }

  return params;
}

export default function HomePage({ searchParams }: HomePageProps) {
  const urlParams = toURLSearchParams(searchParams);
  const config = getCafe24Config();
  const status = getCafe24ConfigStatus();
  const hasLaunchQuery = Boolean(urlParams.get("mall_id") || urlParams.get("hmac"));
  const launch = hasLaunchQuery
    ? validateCafe24Launch({ searchParams: urlParams, clientSecret: config.clientSecret })
    : { ok: false, reason: "missing_hmac" as const, context: getSafeLaunchContext({}) };

  return (
    <main className="grid" style={{ gap: 22 }}>
      <section className="hero">
        <p className="eyebrow">PHASE 1</p>
        <h1>Cafe24 앱 실행, OAuth, 파일 업로드 기반 골격</h1>
        <p className="lead">
          이 앱은 페르패키지 내부용 Cafe24 파일 업로드 앱의 1차 개발 골격입니다.
          아직 상품상세 스크립트 삽입, Webhook 자동 연결, 주문 데이터 자동 연동은 구현하지 않았습니다.
        </p>
        <div className="nav">
          <a className="button" href="/api/cafe24/auth/start">OAuth 연결 시작</a>
          <a className="button secondary" href="/upload-test">업로드 테스트</a>
        </div>
      </section>

      <section className="grid grid-2">
        <div className="panel panel-pad">
          <h2>Cafe24 앱 실행 상태</h2>
          {hasLaunchQuery ? (
            <div className="grid">
              <p className="notice">
                {launch.ok
                  ? "앱 실행 HMAC 검증이 통과했습니다."
                  : "앱 실행 정보를 확인할 수 없습니다. 관리자에게 문의해 주세요."}
              </p>
              <div className="grid grid-2">
                <div className="card"><span>mall_id</span><strong>{launch.context.mallId ?? "-"}</strong></div>
                <div className="card"><span>shop_no</span><strong>{launch.context.shopNo ?? "-"}</strong></div>
                <div className="card"><span>lang</span><strong>{launch.context.lang ?? "-"}</strong></div>
                <div className="card"><span>nation</span><strong>{launch.context.nation ?? "-"}</strong></div>
                <div className="card"><span>user_id</span><strong>{launch.context.userId ?? "-"}</strong></div>
                <div className="card"><span>user_type</span><strong>{launch.context.userType ?? "-"}</strong></div>
              </div>
            </div>
          ) : (
            <p className="lead">Cafe24 앱 실행 query parameter가 없는 개발 확인 화면입니다.</p>
          )}
        </div>

        <div className="panel panel-pad">
          <h2>환경 설정 상태</h2>
          <ul className="list">
            <li>Cafe24 설정: {status.ok ? "준비됨" : `누락 - ${status.missing.join(", ")}`}</li>
            <li>초기 scope: {status.scopes.join(", ")}</li>
            <li>API version: {status.apiVersion}</li>
            <li>client_secret, token, storage key는 화면에 표시하지 않습니다.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
