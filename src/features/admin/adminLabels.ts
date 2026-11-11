/**
 * 관리자 화면 공통: 상태·사유·작업 한국어 이름, 날짜 표시, 오류 문구.
 * 만든 날: 2026-11-11 · 마지막 수정: 2026-11-11
 */
import type { ReportStatus, ReportType } from "../reports/mockReports";

/** 신고 종류 한국어 이름 (만든 날: 2026-11-11) */
export const reportTypeLabels: Record<ReportType, string> = {
  closed: "장소 없어짐",
  wrong_location: "위치 틀림",
  wrong_info: "정보 틀림",
  etc: "기타",
};

/** 신고 처리 상태 한국어 이름 (만든 날: 2026-11-11) */
export const reportStatusLabels: Record<ReportStatus, string> = {
  received: "접수",
  reviewing: "확인 중",
  accepted: "반영됨",
  rejected: "반려",
};

/** 포인트 적립 사유 한국어 이름 (만든 날: 2026-11-11) */
export const pointReasonLabels: Record<string, string> = {
  report_accepted: "오류 신고 반영",
  onsite_checkin: "현장 인증",
  attendance: "출석",
};

/** 관리자 작업 기록 종류 한국어 이름 (만든 날: 2026-11-11) */
export const actionLabels: Record<string, string> = {
  report_update: "신고 처리",
  facility_update: "시설 정보 수정",
  checkin_review: "인증 검토",
  sponsor_save: "후원 기업 저장",
  sponsor_budget: "예산 조정",
};

/** 월·일·시·분 표시 (한국 시간) (만든 날: 2026-11-11) */
export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(value));

/** 오류 객체에서 보여줄 문구 꺼내기 (만든 날: 2026-11-11) */
export const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);
