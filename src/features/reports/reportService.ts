import { supabase } from "../auth/supabaseClient";
import { mockReports, type ReportRecord, type ReportType } from "./mockReports";

// Supabase 키가 있으면 reports 테이블, 없으면 브라우저 메모리의 예시 데이터를 쓴다.
// 내 신고만 보이는 것과 성인 인증 회원만 작성하는 것은 DB 권한(RLS)이 막는다.

type ReportRow = Omit<ReportRecord, "id" | "facility_name" | "facility_address"> & {
  id: number;
  smoking_facilities: { name: string; address: string } | null;
};

const SELECT = "id, user_id, facility_id, type, content, status, created_at, smoking_facilities(name, address)";

function toRecord(row: ReportRow): ReportRecord {
  const { smoking_facilities: facility, ...rest } = row;
  return { ...rest, id: String(row.id), facility_name: facility?.name, facility_address: facility?.address };
}

function toKoreanError(message: string): Error {
  if (/row-level security/i.test(message)) return new Error("성인 인증을 마친 회원만 신고할 수 있어요.");
  if (/foreign key/i.test(message)) return new Error("존재하지 않는 장소예요. 장소를 다시 선택해 주세요.");
  return new Error("신고를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
}

let memoryReports = [...mockReports];

export async function createReport(input: { facility_id: number; type: ReportType; content: string }): Promise<ReportRecord> {
  if (!supabase) {
    const report: ReportRecord = { ...input, id: `mock-${Date.now()}`, user_id: "mock", status: "received", created_at: new Date().toISOString() };
    memoryReports = [report, ...memoryReports];
    return report;
  }
  const { data, error } = await supabase.from("reports").insert(input).select(SELECT).single<ReportRow>();
  if (error) throw toKoreanError(error.message);
  return toRecord(data);
}

export async function getMyReports(): Promise<ReportRecord[]> {
  if (!supabase) return [...memoryReports].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const { data, error } = await supabase.from("reports").select(SELECT).order("created_at", { ascending: false }).returns<ReportRow[]>();
  if (error) throw new Error("신고 내역을 불러오지 못했어요.");
  return data.map(toRecord);
}

export async function getReportDetail(reportId: string): Promise<ReportRecord | null> {
  if (!supabase) return memoryReports.find((report) => report.id === reportId) ?? null;
  const { data, error } = await supabase.from("reports").select(SELECT).eq("id", Number(reportId)).maybeSingle<ReportRow>();
  if (error) throw new Error("신고 내용을 불러오지 못했어요.");
  return data ? toRecord(data) : null;
}
