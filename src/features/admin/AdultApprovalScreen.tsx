import { useCallback, useEffect, useState } from "react";
import { useAuth, type PendingAdultRequest } from "../auth";
import { AppIcon, BottomNavigation, ScreenAnnotation, ScreenHeader, type MainTab } from "../profile/AppShell";
import "../profile/profile.css";
import "./admin.css";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "-";
}

/** 관리자 전용: 성인 인증 승인 대기 목록에서 승인·반려 */
export default function AdultApprovalScreen({ onBack, onTab }: { onBack: () => void; onTab: (tab: MainTab) => void }) {
  const { isAdmin, listPendingAdultRequests, reviewAdultRequest } = useAuth();
  const [requests, setRequests] = useState<PendingAdultRequest[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setRequests(await listPendingAdultRequests());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "목록을 불러오지 못했어요.");
      setRequests([]);
    }
  }, [listPendingAdultRequests]);

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  const review = async (userId: string, approve: boolean) => {
    setBusyId(userId);
    setError("");
    try {
      await reviewAdultRequest(userId, approve, approve ? undefined : reason);
      setRejectingId(null);
      setReason("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "처리하지 못했어요.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="feature-pair">
      <section className="phone-frame" aria-label="UI-12 성인 인증 승인 모바일 화면">
        <div className="feature-screen">
          <ScreenHeader title="성인 인증 승인" onBack={onBack} />
          <div className="feature-body">
            {!isAdmin ? (
              <div className="empty-panel"><AppIcon name="shield" size={26} /><strong>관리자만 볼 수 있어요</strong></div>
            ) : (
              <>
                <div className="admin-summary">
                  <span>승인 대기</span>
                  <strong>{requests === null ? "-" : `${requests.length}건`}</strong>
                  <button onClick={() => void load()}>새로고침</button>
                </div>
                {error && <p className="admin-error" role="alert">{error}</p>}
                {requests === null && <p className="admin-muted">불러오는 중…</p>}
                {requests?.length === 0 && !error && (
                  <div className="empty-panel"><AppIcon name="check" size={26} /><strong>대기 중인 요청이 없어요</strong></div>
                )}
                <div className="admin-list">
                  {requests?.map((request) => (
                    <article className="admin-card" key={request.userId}>
                      <div className="admin-card-head">
                        <strong>{request.nickname}</strong>
                        <span>{request.declaredBirthYear ? `${request.declaredBirthYear}년생 (본인 신고)` : "출생연도 없음"}</span>
                      </div>
                      <small>{request.email}</small>
                      <small>요청 {formatDate(request.requestedAt)} · 가입 {formatDate(request.joinedAt)}</small>
                      {rejectingId === request.userId ? (
                        <div className="admin-reject">
                          <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} placeholder="반려 사유 (회원에게 보여요)" />
                          <div className="admin-actions">
                            <button className="ghost" onClick={() => { setRejectingId(null); setReason(""); }} disabled={busyId !== null}>취소</button>
                            <button className="danger" onClick={() => void review(request.userId, false)} disabled={busyId !== null}>반려 확정</button>
                          </div>
                        </div>
                      ) : (
                        <div className="admin-actions">
                          <button className="ghost" onClick={() => { setRejectingId(request.userId); setReason(""); }} disabled={busyId !== null}>반려</button>
                          <button className="primary" onClick={() => void review(request.userId, true)} disabled={busyId !== null}>{busyId === request.userId ? "처리 중…" : "승인"}</button>
                        </div>
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
        screen="UI-12 성인 인증 승인 (관리자)"
        path="마이페이지 > 성인 인증 승인 (users.is_admin 회원만 보임)"
        elements="승인 대기 건수, 요청 카드(닉네임·이메일·신고 출생연도·요청일), 승인·반려 버튼, 반려 사유 입력"
        data="list_pending_adult_verifications() → users.adult_status = 'pending'"
        action="승인 시 is_adult_verified = true, 반려 시 사유 저장. 처리 후 신고 출생연도는 삭제"
        link="review_adult_verification(), RequireAdult 승인 대기 화면"
      />
    </div>
  );
}
