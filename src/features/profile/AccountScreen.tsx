import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { getMyReports } from "../reports/reportService";
import { getMyPoints, getPointHistory, type PointSummary } from "../rewards/rewardService";
import { BottomNavigation, ScreenAnnotation, ScreenHeader, type MainTab } from "./AppShell";
import "./profile.css";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(value));

type Activity = { reports: number; acceptedReports: number; checkins: number };

/** UI-11 계정 정보: 마이페이지 > 계정 정보 */
export default function AccountScreen({ onBack, onTab }: { onBack: () => void; onTab: (tab: MainTab) => void }) {
  const { user, isAdmin, viewAsUser, updateNickname, updatePassword } = useAuth();
  const [points, setPoints] = useState<PointSummary | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);

  const [editingNickname, setEditingNickname] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [nicknameError, setNicknameError] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordCheck, setPasswordCheck] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    getMyPoints().then(setPoints).catch(() => setPoints(null));
    Promise.all([getMyReports(), getPointHistory()])
      .then(([reports, history]) => setActivity({
        reports: reports.length,
        acceptedReports: reports.filter((report) => report.status === "accepted").length,
        checkins: history.filter((row) => row.reason === "onsite_checkin").length,
      }))
      .catch(() => setActivity(null));
  }, []);

  const saveNickname = async () => {
    setSavingNickname(true);
    setNicknameError("");
    try {
      await updateNickname(nickname);
      setEditingNickname(false);
    } catch (caught) {
      setNicknameError(caught instanceof Error ? caught.message : "닉네임을 바꾸지 못했어요.");
    } finally {
      setSavingNickname(false);
    }
  };

  const savePassword = async () => {
    if (password !== passwordCheck) {
      setPasswordMessage({ ok: false, text: "두 비밀번호가 서로 달라요." });
      return;
    }
    setSavingPassword(true);
    setPasswordMessage(null);
    try {
      await updatePassword(password);
      setPassword("");
      setPasswordCheck("");
      setPasswordOpen(false);
      setPasswordMessage({ ok: true, text: "비밀번호를 바꿨어요. 다음 로그인부터 새 비밀번호를 쓰세요." });
    } catch (caught) {
      setPasswordMessage({ ok: false, text: caught instanceof Error ? caught.message : "비밀번호를 바꾸지 못했어요." });
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <div className="feature-pair">
      <section className="phone-frame" aria-label="UI-11 계정 정보 모바일 화면">
        <div className="feature-screen">
          <ScreenHeader title="계정 정보" onBack={onBack} />
          <div className="feature-body">
            <h2 className="account-section-title">기본 정보</h2>
            <dl className="account-list">
              <div>
                <dt>닉네임</dt>
                <dd>
                  {editingNickname ? (
                    <span className="account-inline-edit">
                      <input value={nickname} maxLength={12} onChange={(event) => setNickname(event.target.value)} aria-label="새 닉네임" />
                      <button onClick={() => void saveNickname()} disabled={savingNickname || nickname.trim() === user.nickname}>{savingNickname ? "저장 중" : "저장"}</button>
                      <button className="ghost" onClick={() => { setEditingNickname(false); setNickname(user.nickname); setNicknameError(""); }}>취소</button>
                    </span>
                  ) : (
                    <>
                      {user.nickname}
                      <button className="account-link" onClick={() => { setNickname(user.nickname); setEditingNickname(true); }}>변경</button>
                    </>
                  )}
                </dd>
              </div>
              {nicknameError && <p className="inline-error">{nicknameError}</p>}
              <div><dt>이메일</dt><dd>{user.email}</dd></div>
              <div><dt>로그인 방식</dt><dd>이메일 · 비밀번호</dd></div>
              <div><dt>가입일</dt><dd>{formatDate(user.createdAt)}</dd></div>
              <div><dt>회원 구분</dt><dd>{isAdmin ? `관리자${viewAsUser ? " (사용자 화면으로 보는 중)" : ""}` : "일반 회원"}</dd></div>
              <div><dt>성인 인증</dt><dd>완료 <small>가입 시 자동 확인</small></dd></div>
            </dl>

            <h2 className="account-section-title">포인트·활동</h2>
            <dl className="account-list">
              <div><dt>보유 포인트</dt><dd>{points ? `${points.balance}P` : "-"}</dd></div>
              <div><dt>오늘 적립</dt><dd>{points ? `${points.todayEarned}P / 하루 ${points.dailyLimit}P` : "-"}</dd></div>
              <div><dt>현장 인증</dt><dd>{activity ? `${activity.checkins}회` : "-"}</dd></div>
              <div><dt>오류 신고</dt><dd>{activity ? `${activity.reports}건 (반영 ${activity.acceptedReports}건)` : "-"}</dd></div>
            </dl>

            <h2 className="account-section-title">보안</h2>
            {passwordMessage && <p className={passwordMessage.ok ? "account-ok" : "inline-error"} role="status">{passwordMessage.text}</p>}
            {passwordOpen ? (
              <div className="account-password">
                <label><span>새 비밀번호 (8자 이상)</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
                <label><span>새 비밀번호 확인</span><input type="password" autoComplete="new-password" value={passwordCheck} onChange={(event) => setPasswordCheck(event.target.value)} /></label>
                <div className="account-actions">
                  <button onClick={() => { setPasswordOpen(false); setPassword(""); setPasswordCheck(""); setPasswordMessage(null); }} disabled={savingPassword}>취소</button>
                  <button className="primary" onClick={() => void savePassword()} disabled={savingPassword || password.length < 8}>{savingPassword ? "저장 중…" : "비밀번호 변경"}</button>
                </div>
              </div>
            ) : (
              <button className="account-wide" onClick={() => { setPasswordOpen(true); setPasswordMessage(null); }}>비밀번호 변경</button>
            )}
            <p className="account-note">이메일은 바꿀 수 없어요. 탈퇴는 마이페이지 아래 "회원 탈퇴"에서 할 수 있어요.</p>
          </div>
          <BottomNavigation active="profile" onSelect={onTab} />
        </div>
      </section>
      <ScreenAnnotation
        screen="UI-11 계정 정보"
        path="마이페이지 > 계정 정보"
        elements="닉네임(변경), 이메일, 로그인 방식, 가입일, 회원 구분, 성인 인증, 포인트·활동 요약, 비밀번호 변경"
        data="users.nickname·is_admin·created_at, auth 이메일, get_my_point_summary(), reports·point_ledger(내 것)"
        action="닉네임 변경, 비밀번호 변경"
        link="useAuth().updateNickname / updatePassword, UI-10 마이페이지"
      />
    </div>
  );
}
