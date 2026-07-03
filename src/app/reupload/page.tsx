import { ReuploadCustomerUploadForm } from "@/components/ReuploadCustomerUploadForm";
import {
  lookupReuploadRequestByRawToken,
  type ReuploadRequestLookupResult
} from "@/lib/files/reupload-request-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReuploadPageProps = {
  searchParams?: {
    token?: string | string[];
  };
};

function getToken(searchParams?: ReuploadPageProps["searchParams"]) {
  const token = searchParams?.token;
  return Array.isArray(token) ? token[0] : token;
}

function formatEmpty(value: string | null | undefined, fallback = "미연결") {
  return value?.trim() || fallback;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(date);
}

function getUnavailableMessage(result: Exclude<ReuploadRequestLookupResult, { state: "valid" }>) {
  switch (result.state) {
    case "missing_token":
      return {
        title: "재업로드 링크가 없습니다.",
        body: "전달받은 재업로드 링크를 다시 확인해 주세요."
      };
    case "invalid":
      return {
        title: "유효하지 않은 재업로드 링크입니다.",
        body: "링크가 잘못되었거나 더 이상 사용할 수 없습니다. 담당자에게 다시 문의해 주세요."
      };
    case "expired":
      return {
        title: "재업로드 링크가 만료되었습니다.",
        body: "새 재업로드 링크가 필요합니다. 담당자에게 다시 요청해 주세요."
      };
    case "used":
      return {
        title: "이미 재업로드가 완료된 링크입니다.",
        body: "수정 파일이 이미 접수되었습니다. 추가 재업로드가 필요하면 담당자에게 문의해 주세요."
      };
    case "canceled":
      return {
        title: "취소된 재업로드 요청입니다.",
        body: "현재 링크로는 파일을 업로드할 수 없습니다."
      };
    case "failed":
      return {
        title: "재업로드 요청을 처리할 수 없습니다.",
        body: "처리 중 오류가 기록된 요청입니다. 담당자에게 문의해 주세요."
      };
    default:
      return {
        title: "재업로드 링크를 확인할 수 없습니다.",
        body: "담당자에게 다시 문의해 주세요."
      };
  }
}

export default async function ReuploadPage({ searchParams }: ReuploadPageProps) {
  const token = getToken(searchParams);
  const lookup = await lookupReuploadRequestByRawToken(token);

  if (lookup.state !== "valid") {
    const message = getUnavailableMessage(lookup);

    return (
      <main className="grid">
        <section className="hero">
          <p className="eyebrow">PERPACKAGE FILE REUPLOAD</p>
          <h1>{message.title}</h1>
          <p className="lead">{message.body}</p>
        </section>
        <section className="panel panel-pad">
          <h2>안내</h2>
          <p className="lead">
            재업로드 링크는 요청별로 발급되며, 만료되었거나 이미 사용된 링크는 다시 사용할 수 없습니다.
          </p>
          {lookup.request ? (
            <div className="grid grid-2" style={{ marginTop: 16 }}>
              <div className="card">
                <span>주문번호</span>
                <strong>{formatEmpty(lookup.request.order_id)}</strong>
              </div>
              <div className="card">
                <span>만료일시</span>
                <strong>{formatDateTime(lookup.request.expires_at)}</strong>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="grid">
      <section className="hero">
        <p className="eyebrow">PERPACKAGE FILE REUPLOAD</p>
        <h1>수정 인쇄 파일을 업로드해 주세요.</h1>
        <p className="lead">
          요청된 수정 파일을 1개만 업로드해 주세요. 여러 파일을 전달해야 하는 경우 하나의 ZIP 파일로 압축해 업로드해 주세요.
        </p>
      </section>

      <section className="panel panel-pad">
        <h2>재업로드 요청 정보</h2>
        <div className="grid grid-3">
          <div className="card">
            <span>주문번호</span>
            <strong>{formatEmpty(lookup.request.order_id)}</strong>
          </div>
          <div className="card">
            <span>기존 파일명</span>
            <strong>{lookup.originalFile.original_filename}</strong>
          </div>
          <div className="card">
            <span>만료일시</span>
            <strong>{formatDateTime(lookup.request.expires_at)}</strong>
          </div>
        </div>
        <div className="notice" style={{ marginTop: 16 }}>
          <strong>재업로드 요청 사유</strong>
          <p style={{ marginBottom: 0, marginTop: 8 }}>
            {lookup.request.reason?.trim() || "담당자가 안내한 수정 사항을 반영해 파일을 다시 업로드해 주세요."}
          </p>
        </div>
        {lookup.request.customer_message?.trim() ? (
          <div className="notice" style={{ marginTop: 12 }}>
            <strong>추가 안내</strong>
            <p style={{ marginBottom: 0, marginTop: 8 }}>{lookup.request.customer_message}</p>
          </div>
        ) : null}
      </section>

      <section className="panel panel-pad">
        <h2>수정 파일 업로드</h2>
        <p className="lead">
          AI, PDF, EPS, ZIP, JPG, PNG, PSD 파일을 업로드할 수 있습니다. 실행 파일이나 웹 문서 형식은 업로드할 수 없습니다.
        </p>
        <div style={{ marginTop: 18 }}>
          <ReuploadCustomerUploadForm token={token ?? ""} />
        </div>
      </section>
    </main>
  );
}
