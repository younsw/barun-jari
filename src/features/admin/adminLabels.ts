import type { ReportStatus, ReportType } from "../reports/mockReports";

export const reportTypeLabels: Record<ReportType, string> = {
  closed: "장소 없어짐",
  wrong_location: "위치 틀림",
  wrong_info: "정보 틀림",
  etc: "기타",
};

export const reportStatusLabels: Record<ReportStatus, string> = {
  received: "접수",
  reviewing: "확인 중",
  accepted: "반영됨",
  rejected: "반려",
};

export const pointReasonLabels: Record<string, string> = {
  report_accepted: "오류 신고 반영",
  onsite_checkin: "현장 인증",
  attendance: "출석",
};

export const actionLabels: Record<string, string> = {
  report_update: "신고 처리",
  facility_update: "시설 정보 수정",
  checkin_review: "인증 검토",
  sponsor_save: "후원 기업 저장",
  sponsor_budget: "예산 조정",
};

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(value));

export const formatDay = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(value));

export const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);
