import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { isMockData } from "../auth/supabaseClient";
import { getMyPoints } from "../rewards/rewardService";
import {
  AppIcon,
  BottomNavigation,
  ScreenAnnotation,
  ScreenHeader,
  type MainTab,
} from "./AppShell";
import "./profile.css";

// 앱 전체가 RequireLogin 안에 있으므로 이 화면은 항상 로그인한 회원이 본다.
// 관리자에게만 관리자 메뉴와 "사용자 화면으로 보기" 스위치가 보인다.
export default function ProfileScreen({ onTab, onOpenAdmin, onOpenAccount }: { onTab: (tab: MainTab) => void; onOpenAdmin: () => void; onOpenAccount: () => void }) {
  const { user, isAdmin, viewAsUser, setViewAsUser, showAdminTools, signOut, deleteAccount } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawConfirm, setWithdrawConfirm] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");

  const withdraw = async () => {
    setWithdrawing(true);
    setWithdrawError("");
    try {
      await deleteAccount();
    } catch (caught) {
      setWithdrawError(caught instanceof Error ? caught.message : "탈퇴하지 못했어요.");
      setWithdrawing(false);
    }
  };
  useEffect(() => {
    getMyPoints().then((points) => setBalance(points.balance)).catch(() => setBalance(null));
  }, []);

  return (
    <div className="feature-pair">
      <section className="phone-frame" aria-label="UI-10 마이페이지 모바일 화면">
        <div className="feature-screen">
          <ScreenHeader title="마이페이지" />
          <div className="feature-body">
            <div className="profile-card">
              <span className="profile-avatar">
                <AppIcon name="person" size={25} />
              </span>
              <div>
                <small>{user?.email}</small>
                <strong>{user?.nickname}</strong>
              </div>
            </div>
            <div className="profile-stats">
              <button disabled>
                <span>회원 구분</span>
                <strong>{showAdminTools ? "관리자" : "일반 회원"}</strong>
              </button>
              <button onClick={() => onTab("rewards")}>
                <span>현재 포인트</span>
                <strong>{balance === null ? "-" : `${balance} P`}</strong>
              </button>
            </div>
            <div className="profile-menu">
              <button onClick={() => onTab("reports")}>
                <AppIcon name="document" />
                <span>
                  <strong>내 신고 내역</strong>
                  <small>제출한 시설 정보 신고 확인</small>
                </span>
                <b>›</b>
              </button>
              <button onClick={() => onTab("rewards")}>
                <AppIcon name="gift" />
                <span>
                  <strong>내 리워드</strong>
                  <small>포인트와 적립 내역 확인</small>
                </span>
                <b>›</b>
              </button>
              {showAdminTools && (
                <button onClick={onOpenAdmin}>
                  <AppIcon name="shield" />
                  <span>
                    <strong>관리자 모드로 전환</strong>
                    <small>대시보드, 신고·리워드·회원·시설·후원 예산 관리</small>
                  </span>
                  <b>›</b>
                </button>
              )}
              <button onClick={onOpenAccount}>
                <AppIcon name="person" />
                <span>
                  <strong>계정 정보</strong>
                  <small>{user?.createdAt ? `가입일 · ${new Date(user.createdAt).toLocaleDateString("ko-KR")}` : "가입 정보 확인"}</small>
                </span>
                <b>›</b>
              </button>
            </div>
            {/* 관리자만: 켜면 관리자 메뉴를 숨기고 일반 회원과 같은 화면으로 본다 (권한은 그대로) */}
            {isAdmin && (
              <label className="view-as-user">
                <span>
                  <strong>사용자 화면으로 보기</strong>
                  <small>{viewAsUser ? "관리자 메뉴가 숨겨져 있어요. 끄면 다시 보여요." : "켜면 일반 회원과 같은 화면만 보여요."}</small>
                </span>
                <input type="checkbox" role="switch" checked={viewAsUser} onChange={(event) => setViewAsUser(event.target.checked)} />
              </label>
            )}
            <div className="service-guide">
              <strong>서비스 이용 안내</strong>
              <p>
                {isMockData
                  ? "Supabase 키가 없어 예시 데이터로 동작 중입니다. "
                  : "공공데이터(서울 중랑구 흡연시설 현황)를 기반으로 합니다. "}
                방문 전 현장 정보를 다시 확인해 주세요.
              </p>
            </div>
            {/* 계정 버튼: 로그아웃과 회원 탈퇴를 같은 크기로 나란히 둔다 */}
            <div className="account-actions">
              <button onClick={() => void signOut()} disabled={withdrawing}>로그아웃</button>
              <button className="withdraw" onClick={() => setWithdrawOpen(true)} disabled={withdrawOpen}>회원 탈퇴</button>
            </div>
            {withdrawOpen && (
              <div className="withdraw-panel" role="dialog" aria-label="회원 탈퇴 확인">
                <strong>정말 탈퇴할까요?</strong>
                <p>
                  포인트{balance !== null ? ` ${balance}P` : ""}, 신고 내역, 현장 인증 기록, 첨부 사진이 모두 지워지고 되돌릴 수 없어요.
                  같은 이메일로 다시 가입할 수는 있어요.
                </p>
                <label>
                  <span>확인을 위해 <b>탈퇴</b>를 입력해 주세요</span>
                  <input value={withdrawConfirm} onChange={(e) => setWithdrawConfirm(e.target.value)} placeholder="탈퇴" />
                </label>
                {withdrawError && <p className="inline-error">{withdrawError}</p>}
                <div>
                  <button onClick={() => { setWithdrawOpen(false); setWithdrawConfirm(""); setWithdrawError(""); }} disabled={withdrawing}>취소</button>
                  <button className="danger" onClick={() => void withdraw()} disabled={withdrawConfirm.trim() !== "탈퇴" || withdrawing}>
                    {withdrawing ? "탈퇴 중…" : "탈퇴하기"}
                  </button>
                </div>
              </div>
            )}
          </div>
          <BottomNavigation active="profile" onSelect={onTab} />
        </div>
      </section>
      <ScreenAnnotation
        screen="UI-10 마이페이지"
        path="하단 마이페이지"
        elements="닉네임, 회원 구분, 포인트, 신고·리워드·계정 메뉴, (관리자) 회원 관리·사용자 화면으로 보기, 로그아웃·회원 탈퇴"
        data="users.nickname, is_admin, created_at 및 get_my_point_summary()"
        action="내 신고 내역·리워드 이동, (관리자) 회원 관리·사용자 화면 전환, 로그아웃, 회원 탈퇴"
        link="useAuth(), getMyPoints(), delete_my_account(), UI-07·09"
      />
    </div>
  );
}
