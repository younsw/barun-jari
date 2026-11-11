import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReportStatus, ReportType } from "../reports/mockReports";
import { getReportPhotoUrl } from "../reports/reportService";
import type { AdminNavigate } from "./AdminApp";
import { listActions, listReports, updateReport, type AdminAction, type AdminReport } from "./adminService";
import { actionLabels, errorText, formatDateTime, reportStatusLabels, reportTypeLabels } from "./adminLabels";

const statusFilters: Array<ReportStatus | "all"> = ["all", "received", "reviewing", "accepted", "rejected"];

/** ADMIN-02 신고 관리 목록 */
export default function AdminReportsScreen({ navigate }: { navigate: AdminNavigate }) {
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<ReportStatus | "all">("all");
  const [type, setType] = useState<ReportType | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    listReports().then(setReports).catch((caught) => { setError(errorText(caught, "신고 목록을 불러오지 못했어요.")); setReports([]); });
  }, []);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: reports?.length ?? 0 };
    reports?.forEach((r) => { result[r.status] = (result[r.status] ?? 0) + 1; });
    return result;
  }, [reports]);

  const keyword = query.trim().toLowerCase();
  const visible = (reports ?? []).filter((r) => (status === "all" || r.status === status)
    && (type === "all" || r.type === type)
    && (!keyword || `${r.facilityName} ${r.facilityAddress} ${r.nickname ?? ""}`.toLowerCase().includes(keyword)));

  return (
    <>
      <div className="admin-chips" role="tablist" aria-label="처리 상태">
        {statusFilters.map((value) => (
          <button key={value} className={status === value ? "active" : ""} onClick={() => setStatus(value)}>
            {value === "all" ? "전체" : reportStatusLabels[value]} <b>{counts[value] ?? 0}</b>
          </button>
        ))}
      </div>
      <div className="admin-filter-row">
        <select value={type} onChange={(event) => setType(event.target.value as ReportType | "all")} aria-label="신고 유형">
          <option value="all">모든 유형</option>
          {(Object.keys(reportTypeLabels) as ReportType[]).map((value) => <option key={value} value={value}>{reportTypeLabels[value]}</option>)}
        </select>
        <input className="admin-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="장소·주소·닉네임 검색" />
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {reports === null && <p className="admin-muted">불러오는 중…</p>}
      {reports !== null && visible.length === 0 && !error && <p className="admin-muted">조건에 맞는 신고가 없어요.</p>}
      <div className="admin-list">
        {visible.map((report) => (
          <button className="admin-card clickable" key={report.id} onClick={() => navigate({ kind: "report", id: report.id })}>
            <div className="admin-card-head">
              <strong>{report.facilityName}</strong>
              <span className={`admin-status ${report.status}`}>{reportStatusLabels[report.status]}</span>
            </div>
            <small>{reportTypeLabels[report.type]} · {report.nickname ?? "탈퇴 회원"} · {formatDateTime(report.createdAt)}</small>
            <p className="admin-snippet">{report.content}</p>
          </button>
        ))}
      </div>
    </>
  );
}

/** ADMIN-03 신고 상세 및 처리. 상태와 답변은 신고자의 "내 신고 내역"에도 보인다. */
export function AdminReportDetail({ reportId, navigate }: { reportId: string; navigate: AdminNavigate }) {
  const [report, setReport] = useState<AdminReport | null | undefined>(undefined);
  const [history, setHistory] = useState<AdminAction[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ReportStatus>("received");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const found = (await listReports()).find((r) => r.id === reportId) ?? null;
      setReport(found);
      if (found) {
        setStatus(found.status === "received" ? "reviewing" : found.status);
        setReply(found.adminReply ?? "");
        setHistory(await listActions("report", reportId));
        if (found.photoPath) setPhotoUrl(await getReportPhotoUrl(found.photoPath));
      }
    } catch (caught) {
      setError(errorText(caught, "신고를 불러오지 못했어요."));
      setReport(null);
    }
  }, [reportId]);

  useEffect(() => { void load(); }, [load]);

  if (report === undefined) return <p className="admin-muted">불러오는 중…</p>;
  if (report === null) return <p className="admin-error" role="alert">{error || "신고를 찾을 수 없어요."}</p>;

  const locked = report.status === "accepted";
  const save = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await updateReport(report.id, status, reply);
      setNotice(status === "accepted" && report.status !== "accepted"
        ? "반영 처리했어요. 신고자에게 2P가 적립돼요 (하루 10P 한도 안에서)."
        : "처리 결과를 저장했어요. 신고자의 신고 내역에도 바로 보여요.");
      await load();
    } catch (caught) {
      setError(errorText(caught, "신고를 처리하지 못했어요."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="admin-detail-hero">
        <span className={`admin-status ${report.status}`}>{reportStatusLabels[report.status]}</span>
        <strong>{report.facilityName}</strong>
        <small>{report.facilityAddress}</small>
        <button className="admin-link" onClick={() => navigate({ kind: "facility", id: report.facilityId })}>이 시설 정보 보기·수정 →</button>
      </div>
      <dl className="admin-dl">
        <div><dt>신고 유형</dt><dd>{reportTypeLabels[report.type]}</dd></div>
        <div><dt>신고자</dt><dd>{report.nickname ?? "탈퇴 회원"}</dd></div>
        <div><dt>신고 일시</dt><dd>{formatDateTime(report.createdAt)}</dd></div>
        <div><dt>현장 위치</dt><dd>{report.locationVerified ? `인증됨 · ${Math.round(report.distanceM ?? 0)}m` : "인증 안 됨 (시설 좌표 없음)"}</dd></div>
        <div className="block"><dt>신고 내용</dt><dd>{report.content}</dd></div>
      </dl>
      {photoUrl ? <img className="admin-photo" src={photoUrl} alt="신고자가 찍은 현장 사진" /> : <p className="admin-muted">{report.photoPath ? "사진을 불러오지 못했어요." : "첨부 사진 없음"}</p>}

      <div className="admin-section-title"><strong>처리하기</strong>{report.handledAt && <span>마지막 처리 {formatDateTime(report.handledAt)}</span>}</div>
      <div className="admin-panel">
        <div className="admin-segment" role="radiogroup" aria-label="처리 상태">
          {(["reviewing", "accepted", "rejected"] as ReportStatus[]).map((value) => (
            <button key={value} role="radio" aria-checked={status === value} className={status === value ? `active ${value}` : ""}
              onClick={() => setStatus(value)} disabled={locked && value !== "accepted"}>
              {reportStatusLabels[value]}
            </button>
          ))}
        </div>
        <label className="admin-field">
          <span>사용자에게 보낼 답변 {status === "rejected" && <em>(반려 시 필수)</em>}</span>
          <textarea value={reply} maxLength={500} rows={4} onChange={(event) => setReply(event.target.value)}
            placeholder={status === "rejected" ? "예: 현장 확인 결과 기존 위치가 맞아 반영하지 않았어요." : "예: 알려주신 위치로 수정했어요. 감사합니다!"} />
          <small>{reply.length}/500</small>
        </label>
        {locked && <p className="admin-hint">반영됨 상태에서는 포인트가 이미 지급돼 다른 상태로 바꿀 수 없어요. 답변만 고칠 수 있어요.</p>}
        {error && <p className="admin-error" role="alert">{error}</p>}
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        <button className="admin-primary" onClick={() => void save()} disabled={saving}>{saving ? "저장 중…" : "처리 결과 저장"}</button>
      </div>

      <div className="admin-section-title"><strong>처리 이력</strong></div>
      {history.length === 0 ? <p className="admin-muted">아직 처리 이력이 없어요.</p> : (
        <ol className="admin-history">
          {history.map((item) => (
            <li key={item.id}>
              <strong>{actionLabels[item.action] ?? item.action}</strong>
              <span>
                {reportStatusLabels[item.detail.from as ReportStatus] ?? "-"} → {reportStatusLabels[item.detail.to as ReportStatus] ?? "-"}
                {typeof item.detail.reply === "string" && ` · "${item.detail.reply}"`}
              </span>
              <small>{formatDateTime(item.createdAt)}</small>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
