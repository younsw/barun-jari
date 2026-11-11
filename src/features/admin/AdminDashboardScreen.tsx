import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import type { AdminNavigate } from "./AdminApp";
import { getDashboard, type AdminDashboard } from "./adminService";
import { errorText, formatDateTime, reportStatusLabels, reportTypeLabels } from "./adminLabels";

/** ADMIN-01 운영 대시보드 */
export default function AdminDashboardScreen({ navigate }: { navigate: AdminNavigate }) {
  const { listMembers } = useAuth();
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const members = await listMembers();
        const dashboard = await getDashboard({ total: members.length, admins: members.filter((m) => m.isAdmin).length });
        if (alive) setData(dashboard);
      } catch (caught) {
        if (alive) setError(errorText(caught, "운영 현황을 불러오지 못했어요."));
      }
    })();
    return () => { alive = false; };
  }, [listMembers]);

  const value = (n: number | undefined, unit: string) => (n === undefined ? "-" : `${n.toLocaleString()}${unit}`);

  return (
    <>
      <div className="admin-intro">
        <span>운영 현황</span>
        <h1>확인이 필요한 항목을<br />한눈에 살펴보세요</h1>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <div className="admin-metrics">
        <button onClick={() => navigate({ kind: "members" })}>
          <span>전체 회원</span><strong>{value(data?.totalUsers, "명")}</strong>
          <small>관리자 {value(data?.adminUsers, "명")}</small>
        </button>
        <button className={data && data.unresolvedReports > 0 ? "attention" : ""} onClick={() => navigate({ kind: "reports" })}>
          <span>미처리 신고</span><strong>{value(data?.unresolvedReports, "건")}</strong>
          <small>오늘 접수 {value(data?.todayReports, "건")}</small>
        </button>
        <button onClick={() => navigate({ kind: "rewards" })}>
          <span>오늘 지급 포인트</span><strong>{value(data?.todayPoints, "P")}</strong>
          <small>오늘 현장 인증 {value(data?.todayCheckins, "건")}</small>
        </button>
        <button className={data && data.suspiciousCheckins > 0 ? "attention" : ""} onClick={() => navigate({ kind: "rewards" })}>
          <span>검토 필요 인증</span><strong>{value(data?.suspiciousCheckins, "건")}</strong>
          <small>반복·단시간 인증</small>
        </button>
      </div>

      {data && data.lowBudgetSponsors > 0 && (
        <button className="admin-alert-box" onClick={() => navigate({ kind: "sponsors" })}>
          <strong>후원 예산 부족 {data.lowBudgetSponsors}곳</strong>
          <span>남은 예산이 20% 아래인 가상 후원 기업이 있어요. 눌러서 확인</span>
        </button>
      )}

      {data && data.sponsorNeededPoints > 0 && (
        <button className="admin-alert-box" onClick={() => navigate({ kind: "sponsors" })}>
          <strong>후원 필요 {data.sponsorNeededPoints.toLocaleString()}P</strong>
          <span>예산이 모자라도 포인트는 먼저 지급했어요. 이만큼 후원 예산을 채워야 해요. 눌러서 확인</span>
        </button>
      )}

      <div className="admin-section-title"><strong>바로가기</strong></div>
      <div className="admin-quick">
        <button onClick={() => navigate({ kind: "reports" })}>신고 관리</button>
        <button onClick={() => navigate({ kind: "rewards" })}>리워드 검토</button>
        <button onClick={() => navigate({ kind: "members" })}>회원 관리</button>
        <button onClick={() => navigate({ kind: "facilities" })}>시설 관리</button>
        <button className="wide" onClick={() => navigate({ kind: "sponsors" })}>기업 후원·예산 관리 <em>가상</em></button>
      </div>

      <div className="admin-section-title">
        <strong>최근 신고</strong>
        <button onClick={() => navigate({ kind: "reports" })}>전체 보기</button>
      </div>
      {data && data.recentReports.length === 0 && <p className="admin-muted">아직 들어온 신고가 없어요.</p>}
      <div className="admin-compact-list">
        {data?.recentReports.map((report) => (
          <button key={report.id} onClick={() => navigate({ kind: "report", id: report.id })}>
            <div>
              <strong>{report.facilityName}</strong>
              <small>{reportTypeLabels[report.type]} · {report.nickname ?? "탈퇴 회원"} · {formatDateTime(report.createdAt)}</small>
            </div>
            <span className={`admin-status ${report.status}`}>{reportStatusLabels[report.status]}</span>
          </button>
        ))}
      </div>
    </>
  );
}
