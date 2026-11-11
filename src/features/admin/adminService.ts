import { supabase } from "../auth/supabaseClient";
import { getFacilities, updateMockPlace } from "../places/placeService";
import type { ReportStatus, ReportType } from "../reports/mockReports";
import { mockReportStore } from "../reports/reportService";
import { mockPoints } from "../rewards/mockPoints";

// 관리자 화면 데이터 (db/migrations/014_admin_mode.sql)
// Supabase 키가 있으면 admin_* 서버 함수를 부르고, 함수 안에서 관리자인지 다시 확인한다.
// 키가 없으면(예시 모드) 브라우저 메모리의 예시 데이터로 같은 흐름을 보여 준다.

export type AdminRecentReport = { id: string; type: ReportType; status: ReportStatus; createdAt: string; facilityName: string; nickname: string | null };

export type AdminDashboard = {
  totalUsers: number;
  adminUsers: number;
  todayReports: number;
  unresolvedReports: number;
  todayPoints: number;
  todayCheckins: number;
  suspiciousCheckins: number;
  lowBudgetSponsors: number;
  /** 후원 대기 + 적자: 앞으로 후원받아 메워야 할 포인트 */
  sponsorNeededPoints: number;
  recentReports: AdminRecentReport[];
};

export type AdminReport = {
  id: string;
  userId: string | null;
  nickname: string | null;
  facilityId: number;
  facilityName: string;
  facilityAddress: string;
  type: ReportType;
  content: string;
  status: ReportStatus;
  photoPath: string | null;
  distanceM: number | null;
  locationVerified: boolean;
  adminReply: string | null;
  handledAt: string | null;
  createdAt: string;
};

export type AdminAction = { id: string; action: string; detail: Record<string, unknown>; createdAt: string };

export type PointActivity = { id: string; userId: string; nickname: string | null; amount: number; reason: string; refId: string | null; createdAt: string; sponsorName: string | null };

export type CheckinReview = "none" | "normal" | "suspicious";
export type AdminCheckin = {
  id: string;
  userId: string;
  nickname: string | null;
  facilityId: number;
  facilityName: string;
  photoPath: string | null;
  distanceM: number | null;
  accuracyM: number | null;
  pointsAwarded: number;
  createdAt: string;
  quickRepeat: boolean;
  samePlaceDays: number;
  flagged: boolean;
  reviewStatus: CheckinReview;
  reviewNote: string | null;
  reviewedAt: string | null;
};

export type AdminFacility = { id: number; district: string; name: string; address: string; category: string; roomCount: number; latitude: number | null; longitude: number | null };
export type FacilityInput = Omit<AdminFacility, "id" | "district">;

export type Sponsor = { id: string; name: string; description: string; startsOn: string; endsOn: string; active: boolean; budget: number; paid: number; remaining: number; createdAt: string };
export type SponsorInput = { name: string; description: string; startsOn: string; endsOn: string; initialBudget?: number };
export type SponsorShortfall = { waitingPoints: number; waitingCount: number; deficitPoints: number };
/** 어느 기업에도 배정되지 않은 지급분(후원 대기)을 볼 때 쓰는 id */
export const WAITING_SPONSOR_ID = "waiting";
export type SponsorTransaction = { id: string; sponsorId: string | null; kind: "budget" | "payout"; amount: number; note: string; createdAt: string };

/** 잔여 예산이 전체의 20% 아래면 부족 알림 */
export const LOW_BUDGET_RATIO = 0.2;

function toAdminError(message: string, fallback: string): Error {
  const admin = message.match(/admin: (.+)/);
  if (admin) return new Error(admin[1]);
  if (/permission denied|row-level security/i.test(message)) return new Error("관리자만 할 수 있어요. 다시 로그인해 주세요.");
  return new Error(fallback);
}

async function rpc<T>(name: string, args: Record<string, unknown> | undefined, fallback: string): Promise<T> {
  if (!supabase) throw new Error(fallback);
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw toAdminError(error.message, fallback);
  return data as T;
}

const koreanDate = (value: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(value));
const daysBetween = (a: string, b: string) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);

// ── 예시 모드 데이터 ──────────────────────────────────────────────
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const mock = {
  nextId: 100,
  actions: [] as (AdminAction & { targetType: string; targetId: string })[],
  checkins: [
    { id: "c5", userId: "mock-u2", nickname: "빠른손", facilityId: 2, facilityName: "예시 데이터 · 1번 출구 흡연부스", photoPath: null, distanceM: 8, accuracyM: 12, pointsAwarded: 1, createdAt: hoursAgo(0.5) },
    { id: "c4", userId: "mock-u2", nickname: "빠른손", facilityId: 3, facilityName: "예시 데이터 · 공원 입구 흡연구역", photoPath: null, distanceM: 15, accuracyM: 20, pointsAwarded: 1, createdAt: hoursAgo(0.6) },
    { id: "c3", userId: "mock-u3", nickname: "단골", facilityId: 1, facilityName: "예시 데이터 · 중앙광장 흡연구역", photoPath: null, distanceM: 5, accuracyM: 9, pointsAwarded: 1, createdAt: hoursAgo(2) },
    { id: "c2", userId: "mock-u3", nickname: "단골", facilityId: 1, facilityName: "예시 데이터 · 중앙광장 흡연구역", photoPath: null, distanceM: 6, accuracyM: 11, pointsAwarded: 1, createdAt: hoursAgo(26) },
    { id: "c1", userId: "mock-u3", nickname: "단골", facilityId: 1, facilityName: "예시 데이터 · 중앙광장 흡연구역", photoPath: null, distanceM: 4, accuracyM: 8, pointsAwarded: 1, createdAt: hoursAgo(50) },
  ].map((c) => ({ ...c, reviewStatus: "none" as CheckinReview, reviewNote: null as string | null, reviewedAt: null as string | null })),
  sponsors: [
    { id: "s1", name: "예시 · 그린라이프", description: "흡연구역 정보 개선 캠페인 (가상)", startsOn: koreanDate(hoursAgo(24 * 30)), endsOn: koreanDate(hoursAgo(-24 * 60)), createdAt: hoursAgo(24 * 30) },
    { id: "s2", name: "예시 · 클린스트리트", description: "현장 인증 리워드 지원 (가상)", startsOn: koreanDate(hoursAgo(24 * 10)), endsOn: koreanDate(hoursAgo(-24 * 20)), createdAt: hoursAgo(24 * 10) },
  ],
  transactions: [
    { id: "t1", sponsorId: "s1", kind: "budget" as const, amount: 500, note: "첫 후원 예산", createdAt: hoursAgo(24 * 30) },
    { id: "t2", sponsorId: "s2", kind: "budget" as const, amount: 100, note: "첫 후원 예산", createdAt: hoursAgo(24 * 10) },
    { id: "t3", sponsorId: "s2", kind: "payout" as const, amount: 85, note: "onsite_checkin", createdAt: hoursAgo(24) },
    { id: "t4", sponsorId: "s1", kind: "payout" as const, amount: 6, note: "report_accepted", createdAt: hoursAgo(5) },
    { id: "t5", sponsorId: null, kind: "payout" as const, amount: 3, note: "onsite_checkin", createdAt: hoursAgo(24 * 40) },
  ] as SponsorTransaction[],
  facilityRooms: new Map<number, number>(),
};

function logMock(action: string, targetType: string, targetId: string, detail: Record<string, unknown>) {
  mock.actions.unshift({ id: String(mock.nextId++), action, targetType, targetId, detail, createdAt: new Date().toISOString() });
}

function mockCheckins(): AdminCheckin[] {
  const sorted = [...mock.checkins].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return sorted.map((c, index) => {
    const prev = sorted.slice(0, index).reverse().find((p) => p.userId === c.userId);
    const quickRepeat = !!prev && new Date(c.createdAt).getTime() - new Date(prev.createdAt).getTime() < 10 * 60_000;
    const days = new Set(sorted.filter((p) => p.userId === c.userId && p.facilityId === c.facilityId
      && daysBetween(koreanDate(c.createdAt), koreanDate(p.createdAt)) >= 0 && daysBetween(koreanDate(c.createdAt), koreanDate(p.createdAt)) <= 6)
      .map((p) => koreanDate(p.createdAt)));
    return { ...c, quickRepeat, samePlaceDays: days.size, flagged: quickRepeat || days.size >= 3 };
  }).reverse();
}

function mockSponsors(): Sponsor[] {
  const today = koreanDate(new Date());
  return mock.sponsors.map((s) => {
    const rows = mock.transactions.filter((t) => t.sponsorId === s.id);
    const budget = rows.filter((t) => t.kind === "budget").reduce((sum, t) => sum + t.amount, 0);
    const paid = rows.filter((t) => t.kind === "payout").reduce((sum, t) => sum + t.amount, 0);
    return { ...s, active: s.startsOn <= today && today <= s.endsOn, budget, paid, remaining: budget - paid };
  }).sort((a, b) => Number(b.active) - Number(a.active) || a.endsOn.localeCompare(b.endsOn));
}

/** 예시 모드: DB 트리거(015)와 같은 규칙. 예산이 넉넉한 진행 중 기업 → 없으면 진행 중 기업(마이너스) → 없으면 후원 대기 */
function chargeMockSponsor(amount: number, reason: string) {
  const sponsors = mockSponsors().filter((s) => s.active).sort((a, b) => a.endsOn.localeCompare(b.endsOn));
  const sponsor = sponsors.find((s) => s.remaining >= amount) ?? sponsors[0] ?? null;
  mock.transactions.unshift({ id: `t${mock.nextId++}`, sponsorId: sponsor?.id ?? null, kind: "payout", amount, note: reason, createdAt: new Date().toISOString() });
}

/** 예시 모드: 예산이 들어오면 후원 대기분을 오래된 것부터 남은 예산 안에서 옮긴다 */
function settleMockWaiting(sponsorId: string) {
  let remaining = mockSponsors().find((s) => s.id === sponsorId)?.remaining ?? 0;
  const waiting = mock.transactions.filter((t) => t.sponsorId === null && t.kind === "payout").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const row of waiting) {
    if (remaining < row.amount) break;
    row.sponsorId = sponsorId;
    remaining -= row.amount;
  }
}

function mockShortfall(): SponsorShortfall {
  const waiting = mock.transactions.filter((t) => t.sponsorId === null && t.kind === "payout");
  return {
    waitingPoints: waiting.reduce((sum, t) => sum + t.amount, 0),
    waitingCount: waiting.length,
    deficitPoints: mockSponsors().filter((s) => s.remaining < 0).reduce((sum, s) => sum - s.remaining, 0),
  };
}

async function mockFacilities(): Promise<AdminFacility[]> {
  return (await getFacilities()).map((p) => ({ ...p, district: "예시", roomCount: mock.facilityRooms.get(p.id) ?? 1 }));
}

function mockReports(facilities: AdminFacility[]): AdminReport[] {
  return mockReportStore.list().map((r) => {
    const facility = facilities.find((f) => f.id === r.facility_id);
    return {
      id: r.id, userId: r.user_id, nickname: r.user_id === "mock" ? "나 (예시)" : null, facilityId: r.facility_id,
      facilityName: facility?.name ?? `장소 #${r.facility_id}`, facilityAddress: facility?.address ?? "",
      type: r.type, content: r.content, status: r.status, photoPath: r.photo_path ?? null, distanceM: r.distance_m ?? null,
      locationVerified: !!r.location_verified, adminReply: r.admin_reply ?? null, handledAt: r.handled_at ?? null, createdAt: r.created_at,
    };
  });
}

// ── ADMIN-01 대시보드 ────────────────────────────────────────────
type DashboardRow = {
  total_users: number; admin_users: number; today_reports: number; unresolved_reports: number; today_points: number;
  today_checkins: number; suspicious_checkins: number; low_budget_sponsors: number; sponsor_needed_points?: number;
  recent_reports: { id: number; type: ReportType; status: ReportStatus; created_at: string; facility_name: string; nickname: string | null }[];
};

export async function getDashboard(memberCounts: { total: number; admins: number }): Promise<AdminDashboard> {
  if (!supabase) {
    const today = koreanDate(new Date());
    const reports = mockReports(await mockFacilities());
    return {
      totalUsers: memberCounts.total,
      adminUsers: memberCounts.admins,
      todayReports: reports.filter((r) => koreanDate(r.createdAt) === today).length,
      unresolvedReports: reports.filter((r) => r.status === "received" || r.status === "reviewing").length,
      todayPoints: mockPoints.filter((p) => koreanDate(p.created_at) === today).reduce((sum, p) => sum + p.amount, 0)
        + mock.checkins.filter((c) => koreanDate(c.createdAt) === today).reduce((sum, c) => sum + c.pointsAwarded, 0),
      todayCheckins: mock.checkins.filter((c) => koreanDate(c.createdAt) === today).length,
      suspiciousCheckins: mockCheckins().filter((c) => c.flagged && c.reviewStatus === "none").length,
      lowBudgetSponsors: mockSponsors().filter((s) => s.active && s.budget > 0 && s.remaining < s.budget * LOW_BUDGET_RATIO).length,
      sponsorNeededPoints: mockShortfall().waitingPoints + mockShortfall().deficitPoints,
      recentReports: reports.slice(0, 5).map((r) => ({ id: r.id, type: r.type, status: r.status, createdAt: r.createdAt, facilityName: r.facilityName, nickname: r.nickname })),
    };
  }
  const row = await rpc<DashboardRow>("admin_dashboard", undefined, "운영 현황을 불러오지 못했어요.");
  return {
    totalUsers: row.total_users, adminUsers: row.admin_users, todayReports: row.today_reports, unresolvedReports: row.unresolved_reports,
    todayPoints: row.today_points, todayCheckins: row.today_checkins, suspiciousCheckins: row.suspicious_checkins, lowBudgetSponsors: row.low_budget_sponsors,
    sponsorNeededPoints: row.sponsor_needed_points ?? 0,
    recentReports: row.recent_reports.map((r) => ({ id: String(r.id), type: r.type, status: r.status, createdAt: r.created_at, facilityName: r.facility_name, nickname: r.nickname })),
  };
}

// ── ADMIN-02/03 신고 ────────────────────────────────────────────
type ReportRow = {
  id: number; user_id: string | null; nickname: string | null; facility_id: number; facility_name: string; facility_address: string;
  type: ReportType; content: string; status: ReportStatus; photo_path: string | null; distance_m: number | null; location_verified: boolean;
  admin_reply: string | null; handled_at: string | null; created_at: string;
};

export async function listReports(): Promise<AdminReport[]> {
  if (!supabase) return mockReports(await mockFacilities());
  const rows = await rpc<ReportRow[]>("admin_list_reports", undefined, "신고 목록을 불러오지 못했어요.");
  return rows.map((r) => ({
    id: String(r.id), userId: r.user_id, nickname: r.nickname, facilityId: r.facility_id, facilityName: r.facility_name, facilityAddress: r.facility_address,
    type: r.type, content: r.content, status: r.status, photoPath: r.photo_path, distanceM: r.distance_m, locationVerified: r.location_verified,
    adminReply: r.admin_reply, handledAt: r.handled_at, createdAt: r.created_at,
  }));
}

export async function updateReport(reportId: string, status: ReportStatus, reply: string): Promise<void> {
  const trimmed = reply.trim().slice(0, 500);
  if (!supabase) {
    const before = mockReportStore.list().find((r) => r.id === reportId);
    if (!before) throw new Error("신고를 찾을 수 없어요.");
    if (before.status === "accepted" && status !== "accepted") throw new Error("이미 반영돼 포인트가 지급된 신고는 상태를 되돌릴 수 없어요.");
    if (status === "rejected" && !trimmed) throw new Error("반려할 때는 사용자에게 안내할 답변을 적어 주세요.");
    mockReportStore.update(reportId, status, trimmed || null);
    if (before.status !== "accepted" && status === "accepted") chargeMockSponsor(2, "report_accepted");
    logMock("report_update", "report", reportId, { from: before.status, to: status, reply: trimmed || null });
    return;
  }
  await rpc<null>("admin_update_report", { p_report_id: Number(reportId), p_status: status, p_reply: trimmed }, "신고를 처리하지 못했어요.");
}

/** 처리 이력 / 변경 이력 (admin_actions) */
export async function listActions(targetType: "report" | "facility" | "checkin" | "sponsor", targetId: string): Promise<AdminAction[]> {
  if (!supabase) return mock.actions.filter((a) => a.targetType === targetType && a.targetId === targetId);
  const { data, error } = await supabase
    .from("admin_actions")
    .select("id, action, detail, created_at")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<{ id: number; action: string; detail: Record<string, unknown>; created_at: string }[]>();
  if (error) throw toAdminError(error.message, "처리 이력을 불러오지 못했어요.");
  return data.map((a) => ({ id: String(a.id), action: a.action, detail: a.detail, createdAt: a.created_at }));
}

// ── ADMIN-04 리워드 모니터링 ─────────────────────────────────────
type PointRow = { id: number; user_id: string; nickname: string | null; amount: number; reason: string; ref_id: string | null; created_at: string; sponsor_name: string | null };

export async function listPointActivity(days = 7): Promise<PointActivity[]> {
  if (!supabase) {
    const since = Date.now() - days * 86_400_000;
    const fromCheckins = mock.checkins.map((c) => ({ id: `pc-${c.id}`, userId: c.userId, nickname: c.nickname, amount: c.pointsAwarded, reason: "onsite_checkin", refId: `checkin:${c.id}`, createdAt: c.createdAt, sponsorName: "예시 · 클린스트리트" }));
    const fromLedger = mockPoints.map((p) => ({ id: p.id, userId: p.user_id, nickname: "나 (예시)", amount: p.amount, reason: p.reason, refId: p.ref_id, createdAt: p.created_at, sponsorName: "예시 · 그린라이프" }));
    return [...fromCheckins, ...fromLedger].filter((p) => new Date(p.createdAt).getTime() >= since).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const rows = await rpc<PointRow[]>("admin_list_point_activity", { p_days: days }, "적립 내역을 불러오지 못했어요.");
  return rows.map((p) => ({ id: String(p.id), userId: p.user_id, nickname: p.nickname, amount: p.amount, reason: p.reason, refId: p.ref_id, createdAt: p.created_at, sponsorName: p.sponsor_name }));
}

type CheckinRow = {
  id: number; user_id: string; nickname: string | null; facility_id: number; facility_name: string; photo_path: string | null;
  distance_m: number | null; location_accuracy_m: number | null; points_awarded: number; created_at: string;
  quick_repeat: boolean; same_place_days: number; flagged: boolean; review_status: CheckinReview; review_note: string | null; reviewed_at: string | null;
};

export async function listCheckins(): Promise<AdminCheckin[]> {
  if (!supabase) return mockCheckins();
  const rows = await rpc<CheckinRow[]>("admin_list_checkins", undefined, "현장 인증 기록을 불러오지 못했어요.");
  return rows.map((c) => ({
    id: String(c.id), userId: c.user_id, nickname: c.nickname, facilityId: c.facility_id, facilityName: c.facility_name, photoPath: c.photo_path,
    distanceM: c.distance_m, accuracyM: c.location_accuracy_m, pointsAwarded: c.points_awarded, createdAt: c.created_at,
    quickRepeat: c.quick_repeat, samePlaceDays: c.same_place_days, flagged: c.flagged, reviewStatus: c.review_status, reviewNote: c.review_note, reviewedAt: c.reviewed_at,
  }));
}

export async function reviewCheckin(checkinId: string, status: CheckinReview, note: string): Promise<void> {
  const trimmed = note.trim().slice(0, 300);
  if (!supabase) {
    mock.checkins = mock.checkins.map((c) => c.id === checkinId ? { ...c, reviewStatus: status, reviewNote: trimmed || null, reviewedAt: status === "none" ? null : new Date().toISOString() } : c);
    logMock("checkin_review", "checkin", checkinId, { status, note: trimmed || null });
    return;
  }
  await rpc<null>("admin_review_checkin", { p_checkin_id: Number(checkinId), p_status: status, p_note: trimmed }, "검토 결과를 저장하지 못했어요.");
}

// ── ADMIN-06 흡연시설 ───────────────────────────────────────────
type FacilityRow = { id: number; district: string; name: string; address: string; category: string; room_count: number; latitude: number | null; longitude: number | null };

export async function listFacilities(): Promise<AdminFacility[]> {
  if (!supabase) return mockFacilities();
  const { data, error } = await supabase
    .from("smoking_facilities")
    .select("id, district, name, address, category, room_count, latitude, longitude")
    .order("id")
    .returns<FacilityRow[]>();
  if (error) throw new Error("흡연시설 목록을 불러오지 못했어요.");
  return data.map((f) => ({ id: f.id, district: f.district, name: f.name, address: f.address, category: f.category, roomCount: f.room_count, latitude: f.latitude, longitude: f.longitude }));
}

export async function updateFacility(facilityId: number, input: FacilityInput): Promise<void> {
  const { name, address, category, roomCount, latitude, longitude } = input;
  if (!name.trim() || !address.trim() || !category.trim()) throw new Error("시설명, 주소, 업종을 모두 입력해 주세요.");
  if (!Number.isInteger(roomCount) || roomCount < 1) throw new Error("부스 수는 1 이상이어야 해요.");
  if ((latitude === null) !== (longitude === null)
    || (latitude !== null && (latitude < 33 || latitude > 39)) || (longitude !== null && (longitude < 124 || longitude > 132))) {
    throw new Error("위도·경도를 확인해 주세요 (한국 범위, 둘 다 입력하거나 둘 다 비우기).");
  }
  if (!supabase) {
    const before = (await mockFacilities()).find((f) => f.id === facilityId);
    if (!before) throw new Error("시설을 찾을 수 없어요.");
    updateMockPlace({ id: facilityId, name: name.trim(), address: address.trim(), category: category.trim(), latitude, longitude });
    mock.facilityRooms.set(facilityId, roomCount);
    logMock("facility_update", "facility", String(facilityId), { before: { name: before.name, address: before.address, category: before.category, room_count: before.roomCount, latitude: before.latitude, longitude: before.longitude }, after: { name, address, category, room_count: roomCount, latitude, longitude } });
    return;
  }
  await rpc<null>("admin_update_facility", {
    p_facility_id: facilityId, p_name: name, p_address: address, p_category: category, p_room_count: roomCount, p_latitude: latitude, p_longitude: longitude,
  }, "시설 정보를 저장하지 못했어요.");
}

// ── ADMIN-07 가상 후원 예산 ──────────────────────────────────────
type SponsorRow = { id: number; name: string; description: string; starts_on: string; ends_on: string; active: boolean; budget: number; paid: number; remaining: number; created_at: string };

export async function listSponsors(): Promise<Sponsor[]> {
  if (!supabase) return mockSponsors();
  const rows = await rpc<SponsorRow[]>("admin_list_sponsors", undefined, "후원 기업을 불러오지 못했어요.");
  return rows.map((s) => ({ id: String(s.id), name: s.name, description: s.description, startsOn: s.starts_on, endsOn: s.ends_on, active: s.active, budget: s.budget, paid: s.paid, remaining: s.remaining, createdAt: s.created_at }));
}

export async function saveSponsor(sponsorId: string | null, input: SponsorInput): Promise<void> {
  if (!input.name.trim() || !input.startsOn || !input.endsOn) throw new Error("기업명과 후원 기간을 입력해 주세요.");
  if (input.endsOn < input.startsOn) throw new Error("종료일이 시작일보다 빠를 수 없어요.");
  const budget = Math.max(0, Math.floor(input.initialBudget ?? 0));
  if (!supabase) {
    if (sponsorId) {
      mock.sponsors = mock.sponsors.map((s) => s.id === sponsorId ? { ...s, name: input.name.trim(), description: input.description.trim(), startsOn: input.startsOn, endsOn: input.endsOn } : s);
    } else {
      sponsorId = `s${mock.nextId++}`;
      mock.sponsors.push({ id: sponsorId, name: input.name.trim(), description: input.description.trim(), startsOn: input.startsOn, endsOn: input.endsOn, createdAt: new Date().toISOString() });
      if (budget > 0) {
        mock.transactions.unshift({ id: `t${mock.nextId++}`, sponsorId, kind: "budget", amount: budget, note: "첫 후원 예산", createdAt: new Date().toISOString() });
        settleMockWaiting(sponsorId);
      }
    }
    logMock("sponsor_save", "sponsor", sponsorId, { name: input.name.trim(), starts_on: input.startsOn, ends_on: input.endsOn });
    return;
  }
  await rpc<number>("admin_save_sponsor", {
    p_sponsor_id: sponsorId ? Number(sponsorId) : null, p_name: input.name, p_description: input.description,
    p_starts_on: input.startsOn, p_ends_on: input.endsOn, p_initial_budget: budget,
  }, "후원 기업을 저장하지 못했어요.");
}

export async function adjustSponsorBudget(sponsorId: string, amount: number, note: string): Promise<void> {
  if (!Number.isInteger(amount) || amount === 0) throw new Error("조정할 포인트를 정수로 입력해 주세요.");
  if (!supabase) {
    const sponsor = mockSponsors().find((s) => s.id === sponsorId);
    if (!sponsor) throw new Error("후원 기업을 찾을 수 없어요.");
    if (amount < 0 && sponsor.remaining + amount < 0) throw new Error(`남은 예산(${sponsor.remaining}P)보다 많이 줄일 수 없어요.`);
    mock.transactions.unshift({ id: `t${mock.nextId++}`, sponsorId, kind: "budget", amount, note: note.trim(), createdAt: new Date().toISOString() });
    if (amount > 0) settleMockWaiting(sponsorId);
    logMock("sponsor_budget", "sponsor", sponsorId, { amount, note });
    return;
  }
  await rpc<null>("admin_adjust_sponsor_budget", { p_sponsor_id: Number(sponsorId), p_amount: amount, p_note: note }, "예산을 조정하지 못했어요.");
}

export async function getSponsorShortfall(): Promise<SponsorShortfall> {
  if (!supabase) return mockShortfall();
  const row = await rpc<{ waiting_points: number; waiting_count: number; deficit_points: number }>("admin_sponsor_shortfall", undefined, "후원 필요 포인트를 불러오지 못했어요.");
  return { waitingPoints: row.waiting_points, waitingCount: row.waiting_count, deficitPoints: row.deficit_points };
}

/** sponsorId = WAITING_SPONSOR_ID 이면 후원 대기(배정 안 된 지급분) 내역 */
export async function listSponsorTransactions(sponsorId: string): Promise<SponsorTransaction[]> {
  const waiting = sponsorId === WAITING_SPONSOR_ID;
  if (!supabase) {
    return mock.transactions.filter((t) => (waiting ? t.sponsorId === null : t.sponsorId === sponsorId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  let request = supabase
    .from("sponsor_transactions")
    .select("id, sponsor_id, kind, amount, note, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  request = waiting ? request.is("sponsor_id", null) : request.eq("sponsor_id", Number(sponsorId));
  const { data, error } = await request.returns<{ id: number; sponsor_id: number | null; kind: "budget" | "payout"; amount: number; note: string; created_at: string }[]>();
  if (error) throw toAdminError(error.message, "지급·조정 내역을 불러오지 못했어요.");
  return data.map((t) => ({ id: String(t.id), sponsorId: t.sponsor_id === null ? null : String(t.sponsor_id), kind: t.kind, amount: t.amount, note: t.note, createdAt: t.created_at }));
}
