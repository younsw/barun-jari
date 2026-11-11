import { useState, type ReactNode } from "react";
import { useAuth } from "../auth";
import { isMockData } from "../auth/supabaseClient";
import { AppIcon } from "../profile/AppShell";
import AdminDashboardScreen from "./AdminDashboardScreen";
import AdminFacilitiesScreen, { AdminFacilityDetail } from "./AdminFacilitiesScreen";
import AdminMembersScreen from "./AdminMembersScreen";
import AdminReportsScreen, { AdminReportDetail } from "./AdminReportsScreen";
import AdminRewardsScreen from "./AdminRewardsScreen";
import AdminSponsorsScreen from "./AdminSponsorsScreen";
import "../profile/profile.css";
import "./admin.css";

export type AdminTab = "home" | "reports" | "rewards" | "members" | "more";
export type AdminPage =
  | { kind: "home" }
  | { kind: "reports" }
  | { kind: "report"; id: string }
  | { kind: "rewards" }
  | { kind: "members" }
  | { kind: "more" }
  | { kind: "facilities" }
  | { kind: "facility"; id: number }
  | { kind: "sponsors" };

export type AdminNavigate = (page: AdminPage) => void;

const titles: Record<AdminPage["kind"], string> = {
  home: "운영 대시보드",
  reports: "신고 관리",
  report: "신고 상세·처리",
  rewards: "리워드 모니터링",
  members: "회원 관리",
  more: "더보기",
  facilities: "흡연시설 정보 관리",
  facility: "시설 정보 수정",
  sponsors: "기업 후원·예산 관리",
};

const tabOf = (page: AdminPage): AdminTab => {
  if (page.kind === "report") return "reports";
  if (page.kind === "facilities" || page.kind === "facility" || page.kind === "sponsors") return "more";
  return page.kind as AdminTab;
};

const navItems: Array<[AdminTab, "map" | "document" | "gift" | "person" | "shield", string]> = [
  ["home", "map", "홈"],
  ["reports", "document", "신고"],
  ["rewards", "gift", "리워드"],
  ["members", "person", "회원"],
  ["more", "shield", "더보기"],
];

/** 관리자 모드 (ADMIN-01 ~ 07). 마이페이지 > 관리자 모드로 전환에서 들어온다. */
export default function AdminApp({ onExit, onFacilitiesChanged }: { onExit: () => void; onFacilitiesChanged: () => void }) {
  const { showAdminTools } = useAuth();
  const [stack, setStack] = useState<AdminPage[]>([{ kind: "home" }]);
  const page = stack[stack.length - 1];

  const navigate: AdminNavigate = (next) => setStack((current) => [...current, next]);
  const goBack = () => setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
  const selectTab = (tab: AdminTab) => setStack([{ kind: tab } as AdminPage]);

  let body: ReactNode;
  if (!showAdminTools) {
    body = <div className="admin-empty"><AppIcon name="shield" size={26} /><strong>관리자만 볼 수 있어요</strong></div>;
  } else if (page.kind === "home") {
    body = <AdminDashboardScreen navigate={navigate} />;
  } else if (page.kind === "reports") {
    body = <AdminReportsScreen navigate={navigate} />;
  } else if (page.kind === "report") {
    body = <AdminReportDetail reportId={page.id} navigate={navigate} />;
  } else if (page.kind === "rewards") {
    body = <AdminRewardsScreen />;
  } else if (page.kind === "members") {
    body = <AdminMembersScreen />;
  } else if (page.kind === "facilities") {
    body = <AdminFacilitiesScreen navigate={navigate} />;
  } else if (page.kind === "facility") {
    body = <AdminFacilityDetail facilityId={page.id} navigate={navigate} onSaved={onFacilitiesChanged} />;
  } else if (page.kind === "sponsors") {
    body = <AdminSponsorsScreen />;
  } else {
    body = (
      <div className="admin-more">
        <button onClick={() => navigate({ kind: "facilities" })}>
          <strong>흡연시설 정보 관리</strong>
          <small>시설명·주소·위치 수정, 위치 오류 신고 연결</small>
        </button>
        <button onClick={() => navigate({ kind: "sponsors" })}>
          <strong>기업 후원·예산 관리</strong>
          <small>가상 후원 기업, 지급·잔여 포인트, 예산 알림</small>
        </button>
      </div>
    );
  }

  return (
    <div className="feature-pair">
      <section className="phone-frame" aria-label="관리자 모드 모바일 화면">
        <div className="admin-screen">
          <header className="admin-header">
            <div>
              {stack.length > 1 && (
                <button className="admin-back" onClick={goBack} aria-label="이전 화면으로 돌아가기"><AppIcon name="back" /></button>
              )}
              <span>
                <small>ADMIN{isMockData ? " · 예시 데이터" : ""}</small>
                <strong>{titles[page.kind]}</strong>
              </span>
            </div>
            <button className="admin-exit" onClick={onExit}>사용자 화면으로</button>
          </header>
          <div className="admin-body">{body}</div>
          <nav className="admin-navigation" aria-label="관리자 메뉴">
            {navItems.map(([tab, icon, label]) => (
              <button key={tab} className={tabOf(page) === tab ? "active" : ""} onClick={() => selectTab(tab)}>
                <AppIcon name={icon} size={18} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </section>
    </div>
  );
}
