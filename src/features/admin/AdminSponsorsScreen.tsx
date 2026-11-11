import { useCallback, useEffect, useState } from "react";
import {
  adjustSponsorBudget, listSponsors, listSponsorTransactions, LOW_BUDGET_RATIO, saveSponsor,
  type Sponsor, type SponsorInput, type SponsorTransaction,
} from "./adminService";
import { errorText, formatDateTime, pointReasonLabels } from "./adminLabels";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
const isLow = (s: Sponsor) => s.active && s.budget > 0 && s.remaining < s.budget * LOW_BUDGET_RATIO;
type Panel = { kind: "new" } | { kind: "edit"; sponsor: Sponsor } | { kind: "adjust"; sponsor: Sponsor } | { kind: "history"; sponsor: Sponsor } | null;

/** ADMIN-07 기업 후원 및 리워드 예산 관리 (가상 시뮬레이션) */
export default function AdminSponsorsScreen() {
  const [sponsors, setSponsors] = useState<Sponsor[] | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setSponsors(await listSponsors());
    } catch (caught) {
      setError(errorText(caught, "후원 기업을 불러오지 못했어요."));
      setSponsors([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const active = (sponsors ?? []).filter((s) => s.active);
  const total = active.reduce((sum, s) => sum + s.budget, 0);
  const paid = active.reduce((sum, s) => sum + s.paid, 0);
  const low = (sponsors ?? []).filter(isLow);
  const done = async () => { setPanel(null); await load(); };

  return (
    <>
      <p className="admin-hint strong">실제 협찬이 아닌 가상 시뮬레이션이에요. 회원에게 포인트가 적립되면 진행 중이고 예산이 남은 기업(종료일이 빠른 순)에서 차감한 것으로 기록해요.</p>
      <div className="admin-summary">
        <div><span>진행 중 총예산</span><strong>{total.toLocaleString()}P</strong></div>
        <div><span>지급</span><strong>{paid.toLocaleString()}P</strong></div>
        <div><span>잔여</span><strong>{(total - paid).toLocaleString()}P</strong></div>
      </div>
      {low.length > 0 && (
        <div className="admin-alert-box static">
          <strong>예산 부족 알림</strong>
          <span>{low.map((s) => `${s.name} (잔여 ${s.remaining}P)`).join(", ")} — 남은 예산이 20% 아래예요.</span>
        </div>
      )}
      {active.length === 0 && sponsors !== null && <p className="admin-hint">진행 중인 후원이 없어 지금 적립되는 포인트는 어느 예산에서도 차감되지 않아요.</p>}
      {error && <p className="admin-error" role="alert">{error}</p>}

      <div className="admin-section-title">
        <strong>후원 기업</strong>
        <button onClick={() => setPanel({ kind: "new" })}>+ 새 기업 등록</button>
      </div>
      {panel?.kind === "new" && <SponsorForm onCancel={() => setPanel(null)} onDone={done} />}
      {sponsors === null && <p className="admin-muted">불러오는 중…</p>}
      {sponsors !== null && sponsors.length === 0 && <p className="admin-muted">등록된 후원 기업이 없어요.</p>}
      <div className="admin-list">
        {sponsors?.map((sponsor) => {
          const rate = sponsor.budget > 0 ? Math.min(100, Math.round((sponsor.paid / sponsor.budget) * 100)) : 0;
          const open = panel && panel.kind !== "new" && panel.sponsor.id === sponsor.id ? panel.kind : null;
          return (
            <article className={`admin-card ${isLow(sponsor) ? "flagged" : ""}`} key={sponsor.id}>
              <div className="admin-card-head">
                <strong>{sponsor.name}</strong>
                <span className={sponsor.active ? "role admin" : "role"}>{sponsor.active ? "진행 중" : sponsor.endsOn < today() ? "종료" : "예정"}</span>
              </div>
              {sponsor.description && <small>{sponsor.description}</small>}
              <small>{sponsor.startsOn} ~ {sponsor.endsOn}</small>
              <div className="admin-budget">
                <div className="bar"><i style={{ width: `${rate}%` }} className={isLow(sponsor) ? "low" : ""} /></div>
                <span>총 {sponsor.budget.toLocaleString()}P · 지급 {sponsor.paid.toLocaleString()}P · 잔여 <b>{sponsor.remaining.toLocaleString()}P</b> · 소진 {rate}%</span>
              </div>
              <div className="admin-actions three">
                <button className="ghost" onClick={() => setPanel(open === "edit" ? null : { kind: "edit", sponsor })}>정보 수정</button>
                <button className="ghost" onClick={() => setPanel(open === "adjust" ? null : { kind: "adjust", sponsor })}>예산 조정</button>
                <button className="ghost" onClick={() => setPanel(open === "history" ? null : { kind: "history", sponsor })}>내역</button>
              </div>
              {open === "edit" && <SponsorForm sponsor={sponsor} onCancel={() => setPanel(null)} onDone={done} />}
              {open === "adjust" && <BudgetForm sponsor={sponsor} onCancel={() => setPanel(null)} onDone={done} />}
              {open === "history" && <SponsorHistory sponsorId={sponsor.id} />}
            </article>
          );
        })}
      </div>
    </>
  );
}

function SponsorForm({ sponsor, onCancel, onDone }: { sponsor?: Sponsor; onCancel: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState<SponsorInput & { budgetText: string }>({
    name: sponsor?.name ?? "", description: sponsor?.description ?? "",
    startsOn: sponsor?.startsOn ?? today(), endsOn: sponsor?.endsOn ?? today(), budgetText: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await saveSponsor(sponsor?.id ?? null, { ...form, initialBudget: Number(form.budgetText || 0) });
      await onDone();
    } catch (caught) {
      setError(errorText(caught, "후원 기업을 저장하지 못했어요."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-panel inset">
      <label className="admin-field"><span>기업명 (가상)</span><input value={form.name} maxLength={40} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 그린라이프" /></label>
      <label className="admin-field"><span>설명</span><input value={form.description} maxLength={300} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="후원 목적" /></label>
      <div className="admin-two">
        <label className="admin-field"><span>시작일</span><input type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} /></label>
        <label className="admin-field"><span>종료일</span><input type="date" value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} /></label>
      </div>
      {!sponsor && <label className="admin-field"><span>첫 후원 예산 (P)</span><input inputMode="numeric" value={form.budgetText} onChange={(e) => setForm({ ...form, budgetText: e.target.value.replace(/\D/g, "") })} placeholder="예: 1000" /></label>}
      {error && <p className="admin-error" role="alert">{error}</p>}
      <div className="admin-actions">
        <button className="ghost" onClick={onCancel} disabled={busy}>취소</button>
        <button className="primary" onClick={() => void submit()} disabled={busy}>{busy ? "저장 중…" : sponsor ? "수정 저장" : "등록"}</button>
      </div>
    </div>
  );
}

function BudgetForm({ sponsor, onCancel, onDone }: { sponsor: Sponsor; onCancel: () => void; onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<"add" | "cut">("add");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const value = Number(amount);
      await adjustSponsorBudget(sponsor.id, mode === "add" ? value : -value, note);
      await onDone();
    } catch (caught) {
      setError(errorText(caught, "예산을 조정하지 못했어요."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-panel inset">
      <div className="admin-segment">
        <button className={mode === "add" ? "active accepted" : ""} onClick={() => setMode("add")}>예산 추가</button>
        <button className={mode === "cut" ? "active rejected" : ""} onClick={() => setMode("cut")}>예산 감액</button>
      </div>
      <label className="admin-field"><span>포인트 (잔여 {sponsor.remaining}P)</span><input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="예: 500" /></label>
      <label className="admin-field"><span>사유</span><input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="예: 2차 후원금 입금 (가상)" /></label>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <div className="admin-actions">
        <button className="ghost" onClick={onCancel} disabled={busy}>취소</button>
        <button className={mode === "add" ? "primary" : "danger"} onClick={() => void submit()} disabled={busy || !amount}>{busy ? "처리 중…" : mode === "add" ? "추가" : "감액"}</button>
      </div>
    </div>
  );
}

function SponsorHistory({ sponsorId }: { sponsorId: string }) {
  const [rows, setRows] = useState<SponsorTransaction[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    listSponsorTransactions(sponsorId).then(setRows).catch((caught) => { setError(errorText(caught, "내역을 불러오지 못했어요.")); setRows([]); });
  }, [sponsorId]);

  if (rows === null) return <p className="admin-muted">불러오는 중…</p>;
  return (
    <div className="admin-compact-list inset">
      {error && <p className="admin-error" role="alert">{error}</p>}
      {rows.length === 0 && !error && <p className="admin-muted">내역이 없어요.</p>}
      {rows.map((row) => (
        <div className="row" key={row.id}>
          <div>
            <strong>{row.kind === "payout" ? `포인트 지급 · ${pointReasonLabels[row.note] ?? row.note}` : row.amount > 0 ? "예산 추가" : "예산 감액"}</strong>
            <small>{formatDateTime(row.createdAt)}{row.kind === "budget" && row.note ? ` · ${row.note}` : ""}</small>
          </div>
          <b className={row.kind === "payout" || row.amount < 0 ? "minus" : "plus"}>{row.kind === "payout" ? `-${row.amount}` : row.amount > 0 ? `+${row.amount}` : row.amount}P</b>
        </div>
      ))}
    </div>
  );
}
