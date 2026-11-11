import { useCallback, useEffect, useMemo, useState } from "react";
import { listCheckins, listPointActivity, reviewCheckin, type AdminCheckin, type CheckinReview, type PointActivity } from "./adminService";
import { errorText, formatDateTime, pointReasonLabels } from "./adminLabels";

type View = "review" | "members" | "history";
const reviewLabels: Record<CheckinReview, string> = { none: "검토 전", normal: "정상", suspicious: "의심" };

/** ADMIN-04 리워드 모니터링. 포인트 회수·이용 제한은 추후 협의 — 지금은 확인과 검토 기록만 한다. */
export default function AdminRewardsScreen() {
  const [view, setView] = useState<View>("review");
  const [checkins, setCheckins] = useState<AdminCheckin[] | null>(null);
  const [points, setPoints] = useState<PointActivity[] | null>(null);
  const [onlyFlagged, setOnlyFlagged] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [c, p] = await Promise.all([listCheckins(), listPointActivity(7)]);
      setCheckins(c);
      setPoints(p);
    } catch (caught) {
      setError(errorText(caught, "리워드 정보를 불러오지 못했어요."));
      setCheckins([]);
      setPoints([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const perMember = useMemo(() => {
    const map = new Map<string, { nickname: string; total: number; count: number; checkins: number; flagged: number }>();
    points?.forEach((p) => {
      const row = map.get(p.userId) ?? { nickname: p.nickname ?? "탈퇴 회원", total: 0, count: 0, checkins: 0, flagged: 0 };
      row.total += p.amount;
      row.count += 1;
      map.set(p.userId, row);
    });
    checkins?.forEach((c) => {
      const row = map.get(c.userId);
      if (!row) return;
      row.checkins += 1;
      if (c.flagged) row.flagged += 1;
    });
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [points, checkins]);

  const flaggedOpen = (checkins ?? []).filter((c) => c.flagged && c.reviewStatus === "none").length;
  const visibleCheckins = (checkins ?? []).filter((c) => !onlyFlagged || c.flagged);
  const weekTotal = (points ?? []).reduce((sum, p) => sum + p.amount, 0);

  return (
    <>
      <div className="admin-summary">
        <div><span>최근 7일 지급</span><strong>{points === null ? "-" : `${weekTotal}P`}</strong></div>
        <div><span>검토 필요</span><strong className={flaggedOpen ? "warn" : ""}>{checkins === null ? "-" : `${flaggedOpen}건`}</strong></div>
        <button onClick={() => void load()}>새로고침</button>
      </div>
      <p className="admin-hint">의심 기준: 같은 회원이 10분 안에 다시 인증 · 같은 장소를 최근 7일 중 3일 이상 인증. 포인트 회수·이용 제한은 추후 정책을 정한 뒤 붙여요.</p>
      <div className="admin-chips">
        <button className={view === "review" ? "active" : ""} onClick={() => setView("review")}>인증 검토</button>
        <button className={view === "members" ? "active" : ""} onClick={() => setView("members")}>회원별 적립</button>
        <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>적립 내역</button>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}

      {view === "review" && (
        <>
          <label className="admin-check">
            <input type="checkbox" checked={onlyFlagged} onChange={(event) => setOnlyFlagged(event.target.checked)} /> 의심 인증만 보기
          </label>
          {checkins !== null && visibleCheckins.length === 0 && <p className="admin-muted">{onlyFlagged ? "의심되는 인증이 없어요." : "인증 기록이 없어요."}</p>}
          <div className="admin-list">
            {visibleCheckins.map((checkin) => <CheckinCard key={checkin.id} checkin={checkin} onSaved={load} />)}
          </div>
        </>
      )}

      {view === "members" && (
        <div className="admin-list">
          {points !== null && perMember.length === 0 && <p className="admin-muted">최근 7일 적립이 없어요.</p>}
          {perMember.map(([userId, row]) => (
            <article className="admin-card" key={userId}>
              <div className="admin-card-head">
                <strong>{row.nickname}</strong>
                <span className="role admin">{row.total}P</span>
              </div>
              <small>적립 {row.count}회 · 현장 인증 {row.checkins}회{row.flagged > 0 && ` · 의심 ${row.flagged}건`}</small>
            </article>
          ))}
        </div>
      )}

      {view === "history" && (
        <div className="admin-compact-list">
          {points !== null && points.length === 0 && <p className="admin-muted">최근 7일 적립이 없어요.</p>}
          {points?.map((p) => (
            <div className="row" key={p.id}>
              <div>
                <strong>{p.nickname ?? "탈퇴 회원"} · {pointReasonLabels[p.reason] ?? p.reason}</strong>
                <small>{formatDateTime(p.createdAt)}{p.sponsorName ? ` · ${p.sponsorName} 예산` : " · 후원 대기"}</small>
              </div>
              <b className="plus">+{p.amount}P</b>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function CheckinCard({ checkin, onSaved }: { checkin: AdminCheckin; onSaved: () => Promise<void> }) {
  const [note, setNote] = useState(checkin.reviewNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (status: CheckinReview) => {
    setBusy(true);
    setError("");
    try {
      await reviewCheckin(checkin.id, status, note);
      await onSaved();
    } catch (caught) {
      setError(errorText(caught, "검토 결과를 저장하지 못했어요."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`admin-card ${checkin.flagged && checkin.reviewStatus === "none" ? "flagged" : ""}`}>
      <div className="admin-card-head">
        <strong>{checkin.nickname ?? "탈퇴 회원"}</strong>
        <span className={`review ${checkin.reviewStatus}`}>{reviewLabels[checkin.reviewStatus]}</span>
      </div>
      <small>{checkin.facilityName}</small>
      <small>{formatDateTime(checkin.createdAt)} · 거리 {Math.round(checkin.distanceM ?? 0)}m · GPS 오차 {Math.round(checkin.accuracyM ?? 0)}m · +{checkin.pointsAwarded}P</small>
      {checkin.flagged && (
        <div className="admin-tags">
          {checkin.quickRepeat && <span>10분 안 재인증</span>}
          {checkin.samePlaceDays >= 3 && <span>같은 장소 7일 중 {checkin.samePlaceDays}일</span>}
        </div>
      )}
      <input className="admin-search compact" value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} placeholder="검토 메모 (선택)" />
      {error && <p className="admin-error" role="alert">{error}</p>}
      <div className="admin-actions three">
        <button className="ghost" onClick={() => void save("normal")} disabled={busy}>정상</button>
        <button className="danger" onClick={() => void save("suspicious")} disabled={busy}>의심</button>
        <button className="ghost" onClick={() => void save("none")} disabled={busy || checkin.reviewStatus === "none"}>검토 취소</button>
      </div>
      {checkin.reviewedAt && <small>검토 {formatDateTime(checkin.reviewedAt)}{checkin.reviewNote && ` · ${checkin.reviewNote}`}</small>}
    </article>
  );
}
