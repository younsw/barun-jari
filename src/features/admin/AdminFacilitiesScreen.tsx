/**
 * ADMIN-05 흡연시설 관리: 시설 검색·목록, 시설 상세에서 이름·주소·업종·좌표 수정과 관련 신고·수정 기록.
 * 만든 날: 2026-11-11 · 마지막 수정: 2026-11-11
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminNavigate } from "./AdminApp";
import { listActions, listFacilities, listReports, updateFacility, type AdminAction, type AdminFacility, type AdminReport, type FacilityInput } from "./adminService";
import { errorText, formatDateTime, reportStatusLabels, reportTypeLabels } from "./adminLabels";

/** 목록에 한 번에 보여줄 시설 수 (만든 날: 2026-11-11) */
const PAGE_SIZE = 30;
/** 아직 처리 안 된 신고인지 (접수·확인 중) (만든 날: 2026-11-11) */
const isOpen = (r: AdminReport) => r.status === "received" || r.status === "reviewing";

/** ADMIN-06 흡연시설 정보 관리: 목록 */
export default function AdminFacilitiesScreen({ navigate }: { navigate: AdminNavigate }) {
  const [facilities, setFacilities] = useState<AdminFacility[] | null>(null);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "reported" | "noCoords">("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([listFacilities(), listReports()])
      .then(([f, r]) => { setFacilities(f); setReports(r); })
      .catch((caught) => { setError(errorText(caught, "흡연시설 목록을 불러오지 못했어요.")); setFacilities([]); });
  }, []);

  const openReports = useMemo(() => {
    const map = new Map<number, number>();
    reports.filter(isOpen).forEach((r) => map.set(r.facilityId, (map.get(r.facilityId) ?? 0) + 1));
    return map;
  }, [reports]);

  const keyword = query.trim().toLowerCase();
  const visible = (facilities ?? []).filter((f) => (!keyword || `${f.name} ${f.address} ${f.district}`.toLowerCase().includes(keyword))
    && (filter === "all" || (filter === "reported" ? openReports.has(f.id) : f.latitude === null)))
    .sort((a, b) => (openReports.get(b.id) ?? 0) - (openReports.get(a.id) ?? 0));

  return (
    <>
      <div className="admin-summary">
        <div><span>전체 시설</span><strong>{facilities === null ? "-" : `${facilities.length}곳`}</strong></div>
        <div><span>미처리 신고 있는 곳</span><strong className={openReports.size ? "warn" : ""}>{openReports.size}곳</strong></div>
      </div>
      <div className="admin-chips">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>전체</button>
        <button className={filter === "reported" ? "active" : ""} onClick={() => setFilter("reported")}>신고 있음</button>
        <button className={filter === "noCoords" ? "active" : ""} onClick={() => setFilter("noCoords")}>좌표 없음</button>
      </div>
      <input className="admin-search" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(PAGE_SIZE); }} placeholder="시설명·주소·구 검색" />
      {error && <p className="admin-error" role="alert">{error}</p>}
      {facilities === null && <p className="admin-muted">불러오는 중…</p>}
      {facilities !== null && visible.length === 0 && !error && <p className="admin-muted">해당하는 시설이 없어요.</p>}
      <div className="admin-list">
        {visible.slice(0, limit).map((facility) => (
          <button className="admin-card clickable" key={facility.id} onClick={() => navigate({ kind: "facility", id: facility.id })}>
            <div className="admin-card-head">
              <strong>{facility.name}</strong>
              {openReports.has(facility.id) && <span className="admin-status received">신고 {openReports.get(facility.id)}</span>}
            </div>
            <small>{facility.address}</small>
            <small>{facility.category} · 부스 {facility.roomCount}개 · {facility.latitude === null ? "좌표 없음" : `${facility.latitude.toFixed(5)}, ${facility.longitude?.toFixed(5)}`}</small>
          </button>
        ))}
      </div>
      {visible.length > limit && <button className="admin-more-button" onClick={() => setLimit((n) => n + PAGE_SIZE)}>더 보기 ({visible.length - limit}곳 남음)</button>}
    </>
  );
}

/** 시설 → 수정 폼 입력값 (만든 날: 2026-11-11) */
const toForm = (f: AdminFacility) => ({
  name: f.name, address: f.address, category: f.category, roomCount: String(f.roomCount),
  latitude: f.latitude === null ? "" : String(f.latitude), longitude: f.longitude === null ? "" : String(f.longitude),
});

/** ADMIN-06 흡연시설 정보 수정 + 연결된 신고 + 변경 이력 */
export function AdminFacilityDetail({ facilityId, navigate, onSaved }: { facilityId: number; navigate: AdminNavigate; onSaved: () => void }) {
  const [facility, setFacility] = useState<AdminFacility | null | undefined>(undefined);
  const [form, setForm] = useState<ReturnType<typeof toForm> | null>(null);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [history, setHistory] = useState<AdminAction[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [all, allReports, actions] = await Promise.all([listFacilities(), listReports(), listActions("facility", String(facilityId))]);
      const found = all.find((f) => f.id === facilityId) ?? null;
      setFacility(found);
      if (found) setForm(toForm(found));
      setReports(allReports.filter((r) => r.facilityId === facilityId));
      setHistory(actions);
    } catch (caught) {
      setError(errorText(caught, "시설 정보를 불러오지 못했어요."));
      setFacility(null);
    }
  }, [facilityId]);
  useEffect(() => { void load(); }, [load]);

  if (facility === undefined || (facility && !form)) return <p className="admin-muted">불러오는 중…</p>;
  if (facility === null || !form) return <p className="admin-error" role="alert">{error || "시설을 찾을 수 없어요."}</p>;

  const parsed = (): FacilityInput => ({
    name: form.name, address: form.address, category: form.category, roomCount: Number(form.roomCount),
    latitude: form.latitude.trim() === "" ? null : Number(form.latitude), longitude: form.longitude.trim() === "" ? null : Number(form.longitude),
  });
  const changed = JSON.stringify(form) !== JSON.stringify(toForm(facility));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await updateFacility(facilityId, parsed());
      setConfirming(false);
      setNotice("저장했어요. 사용자 지도와 목록에도 바로 반영돼요.");
      onSaved();
      await load();
    } catch (caught) {
      setError(errorText(caught, "시설 정보를 저장하지 못했어요."));
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form, label: string, props: Record<string, string> = {}) => (
    <label className="admin-field">
      <span>{label}</span>
      <input value={form[key]} onChange={(event) => { setForm({ ...form, [key]: event.target.value }); setConfirming(false); setNotice(""); }} {...props} />
    </label>
  );

  const locationReports = reports.filter((r) => r.type === "wrong_location" || r.type === "closed");

  return (
    <>
      <div className="admin-detail-hero">
        <span className="admin-status">#{facility.id} · {facility.district}</span>
        <strong>{facility.name}</strong>
        <small>{facility.address}</small>
      </div>
      <div className="admin-panel">
        {field("name", "시설명")}
        {field("address", "주소")}
        <div className="admin-two">
          {field("category", "업종")}
          {field("roomCount", "부스 수", { inputMode: "numeric" })}
        </div>
        <div className="admin-two">
          {field("latitude", "위도", { inputMode: "decimal", placeholder: "예: 37.60123" })}
          {field("longitude", "경도", { inputMode: "decimal", placeholder: "예: 127.08123" })}
        </div>
        {form.latitude && form.longitude && (
          <a className="admin-link" href={`https://map.kakao.com/link/map/${encodeURIComponent(form.name)},${form.latitude},${form.longitude}`} target="_blank" rel="noreferrer">카카오맵에서 위치 확인 →</a>
        )}
        {error && <p className="admin-error" role="alert">{error}</p>}
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        {confirming ? (
          <div className="admin-confirm">
            <p>사용자 화면의 지도·목록·현장 인증 기준 위치가 바뀌어요. 저장할까요?</p>
            <div className="admin-actions">
              <button className="ghost" onClick={() => setConfirming(false)} disabled={saving}>취소</button>
              <button className="primary" onClick={() => void save()} disabled={saving}>{saving ? "저장 중…" : "저장"}</button>
            </div>
          </div>
        ) : (
          <button className="admin-primary" onClick={() => setConfirming(true)} disabled={!changed}>변경 내용 저장</button>
        )}
      </div>

      <div className="admin-section-title"><strong>이 시설의 신고</strong><span>위치·폐쇄 {locationReports.length}건 / 전체 {reports.length}건</span></div>
      {reports.length === 0 ? <p className="admin-muted">들어온 신고가 없어요.</p> : (
        <div className="admin-compact-list">
          {reports.map((report) => (
            <button key={report.id} onClick={() => navigate({ kind: "report", id: report.id })}>
              <div>
                <strong>{reportTypeLabels[report.type]} · {report.content}</strong>
                <small>{report.nickname ?? "탈퇴 회원"} · {formatDateTime(report.createdAt)}</small>
              </div>
              <span className={`admin-status ${report.status}`}>{reportStatusLabels[report.status]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="admin-section-title"><strong>변경 이력</strong></div>
      {history.length === 0 ? <p className="admin-muted">관리자가 수정한 이력이 없어요.</p> : (
        <ol className="admin-history">
          {history.map((item) => {
            const before = (item.detail.before ?? {}) as Record<string, unknown>;
            const after = (item.detail.after ?? {}) as Record<string, unknown>;
            const diffs = Object.keys(after).filter((key) => String(before[key] ?? "") !== String(after[key] ?? ""));
            return (
              <li key={item.id}>
                <strong>시설 정보 수정</strong>
                <span>{diffs.length ? diffs.map((key) => `${key}: ${before[key] ?? "-"} → ${after[key] ?? "-"}`).join(" / ") : "변경 없음"}</span>
                <small>{formatDateTime(item.createdAt)}</small>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
