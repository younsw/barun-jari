import { useCallback, useEffect, useState } from "react";
import { useAuth, type Member } from "../auth";

const formatDate = (value: string) => new Date(value).toLocaleDateString("ko-KR");

/** ADMIN-05 회원 관리: 회원 목록, 관리자 지정·해제 (db/migrations/013_admin_roles.sql)
 *  성인 인증은 지금 가입 시 자동 처리된다. 실제 승인은 추후 외부 본인확인 결과로 하고, 관리자는 조회만 한다. */
export default function AdminMembersScreen() {
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
    <>
      <div className="admin-summary">
        <div><span>전체 회원</span><strong>{members === null ? "-" : `${members.length}명`}</strong></div>
        <div><span>관리자</span><strong>{members === null ? "-" : `${adminCount}명`}</strong></div>
        <button onClick={() => void load()}>새로고침</button>
      </div>
      <p className="admin-hint">성인 인증: 지금은 가입하면 자동으로 완료돼요. 실제 승인은 추후 외부 본인확인 업체 결과로 처리하고, 관리자는 결과만 조회해요.</p>
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
            <small>가입 {formatDate(member.joinedAt)} · 포인트 {member.points}P · 성인 인증 완료(가입 시 자동)</small>
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
  );
}
