import { useCallback, useEffect, useState } from "react";
import { useAuth, type Member } from "../auth";
import { AppIcon, BottomNavigation, ScreenAnnotation, ScreenHeader, type MainTab } from "../profile/AppShell";
import "../profile/profile.css";
import "./admin.css";

const formatDate = (value: string) => new Date(value).toLocaleDateString("ko-KR");

/** 관리자 전용: 회원 목록, 관리자 지정·해제 (db/migrations/013_admin_roles.sql) */
export default function AdminMembersScreen({ onBack, onTab }: { onBack: () => void; onTab: (tab: MainTab) => void }) {
  const { user, showAdminTools, listMembers, setMemberAdmin } = useAuth();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Member | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setMembers(await listMembers());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "회원 목록을 불러오지 못했어요.");
      setMembers([]);
    }
  }, [listMembers]);

  useEffect(() => { if (showAdminTools) void load(); }, [showAdminTools, load]);

  const changeRole = async (member: Member) => {
    setBusyId(member.id);
    setError("");
    try {
      await setMemberAdmin(member.id, !member.isAdmin);
      setConfirming(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "권한을 바꾸지 못했어요.");
    } finally {
      setBusyId(null);
    }
  };

  const keyword = query.trim().toLowerCase();
  const visible = (members ?? []).filter((member) =>
    !keyword || member.nickname.toLowerCase().includes(keyword) || member.email.toLowerCase().includes(keyword));
  const adminCount = (members ?? []).filter((member) => member.isAdmin).length;

  return (
    <div className="feature-pair">
      <section className="phone-frame" aria-label="UI-12 회원 관리 모바일 화면">
        <div className="feature-screen">
          <ScreenHeader title="회원 관리" onBack={onBack} />
          <div className="feature-body">
            {!showAdminTools ? (
              <div className="admin-empty"><AppIcon name="shield" size={26} /><strong>관리자만 볼 수 있어요</strong></div>
            ) : (
              <>
                <div className="admin-summary">
                  <div><span>전체 회원</span><strong>{members === null ? "-" : `${members.length}명`}</strong></div>
                  <div><span>관리자</span><strong>{members === null ? "-" : `${adminCount}명`}</strong></div>
                  <button onClick={() => void load()}>새로고침</button>
                </div>
                <input className="admin-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="닉네임 또는 이메일 검색" />
                {error && <p className="admin-error" role="alert">{error}</p>}
                {members === null && <p className="admin-muted">불러오는 중…</p>}
                {members !== null && visible.length === 0 && !error && <p className="admin-muted">해당하는 회원이 없어요.</p>}
                <div className="admin-list">
                  {visible.map((member) => (
                    <article className="admin-card" key={member.id}>
                      <div className="admin-card-head">
                        <strong>{member.nickname}{member.id === user?.id && <em> (나)</em>}</strong>
                        <span className={member.isAdmin ? "role admin" : "role"}>{member.isAdmin ? "관리자" : "일반 회원"}</span>
                      </div>
                      <small>{member.email}</small>
                      <small>가입 {formatDate(member.joinedAt)} · 포인트 {member.points}P</small>
                      {confirming?.id === member.id ? (
                        <div className="admin-confirm">
                          <p>
                            {member.isAdmin
                              ? `${member.nickname}님을 일반 회원으로 바꿀까요?${member.id === user?.id ? " 나의 관리자 메뉴가 바로 사라져요." : ""}`
                              : `${member.nickname}님을 관리자로 지정할까요? 모든 관리자 권한을 갖게 돼요.`}
                          </p>
                          <div className="admin-actions">
                            <button className="ghost" onClick={() => setConfirming(null)} disabled={busyId !== null}>취소</button>
                            <button className={member.isAdmin ? "danger" : "primary"} onClick={() => void changeRole(member)} disabled={busyId !== null}>
                              {busyId === member.id ? "처리 중…" : member.isAdmin ? "일반 회원으로" : "관리자로 지정"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button className={`admin-role-button ${member.isAdmin ? "demote" : ""}`} onClick={() => setConfirming(member)} disabled={busyId !== null}>
                          {member.isAdmin ? "일반 회원으로 바꾸기" : "관리자로 지정하기"}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
          <BottomNavigation active="profile" onSelect={onTab} />
        </div>
      </section>
      <ScreenAnnotation
        screen="UI-12 회원 관리 (관리자)"
        path="마이페이지 > 관리자 · 회원 관리 (관리자에게만 보임)"
        elements="회원·관리자 수, 검색, 회원 카드(닉네임·이메일·가입일·포인트·구분), 관리자 지정·해제 버튼과 확인"
        data="admin_list_members() → users, auth.users 이메일, point_ledger 합계"
        action="관리자 지정 / 일반 회원으로 변경 (관리자가 0명이 되는 변경은 서버가 거절)"
        link="admin_set_member_role(), UI-10 마이페이지"
      />
    </div>
  );
}
