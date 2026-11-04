import { useEffect, useState } from "react";
import { isMockData } from "../auth/supabaseClient";
import {
  AppIcon,
  BottomNavigation,
  ScreenAnnotation,
  ScreenHeader,
  type MainTab,
} from "../profile/AppShell";
import {
  type ReportRecord,
  type ReportStatus,
  type ReportType,
} from "./mockReports";
import {
  createReport,
  getMyReports,
  getReportDetail,
  getReportPhotoUrl,
} from "./reportService";
import { CameraCapture, type CapturedPhoto } from "./CameraCapture";
import "./reports.css";

export type FacilitySummary = {
  id: number;
  name: string;
  address: string;
};

const typeLabels: Record<ReportType, string> = {
  closed: "장소 없어짐",
  wrong_location: "위치 틀림",
  wrong_info: "정보 틀림",
  etc: "기타",
};

const statusLabels: Record<ReportStatus, string> = {
  received: "접수",
  reviewing: "확인 중",
  accepted: "반영됨",
  rejected: "반려",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

export function ReportCreateScreen({
  facilities,
  initialFacilityId,
  onBack,
  onComplete,
}: {
  facilities: FacilitySummary[];
  initialFacilityId: number;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [facilityId, setFacilityId] = useState(initialFacilityId);
  const [type, setType] = useState<ReportType>("wrong_info");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const facility = facilities.find((item) => item.id === facilityId) ?? facilities[0];

  const submit = async () => {
    if (!facility) {
      setError("신고할 장소를 선택해 주세요.");
      return;
    }
    if (!content.trim()) {
      setError("수정이 필요한 내용을 입력해 주세요.");
      return;
    }
    setPending(true);
    try {
      await createReport({ facility_id: facility.id, type, content: content.trim(), photo: photo?.blob });
      onComplete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "신고를 저장하지 못했어요.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="feature-pair">
      <section className="phone-frame" aria-label="UI-06 오류 신고 작성 모바일 화면">
        <div className="feature-screen">
          <ScreenHeader title="정보 수정 요청" onBack={onBack} />
          <div className="feature-body">
            <div className="demo-notice">
              {isMockData
                ? "Supabase 키가 없어 신고는 브라우저 메모리에만 저장됩니다. "
                : "신고가 반영되면 3P가 적립돼요 (하루 최대 10P). "}
              사진은 앱 카메라로 현장에서 찍은 것만 첨부할 수 있어요.
            </div>
            <label className="form-label" htmlFor="report-facility">
              신고할 장소
            </label>
            <select
              className="form-select"
              id="report-facility"
              value={facilityId}
              onChange={(event) => setFacilityId(Number(event.target.value))}
            >
              {facilities.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {facility && <div className="selected-facility">
              <strong>{facility.name}</strong>
              <span>{facility.address}</span>
              {isMockData && <small>장소명과 주소는 예시 데이터입니다.</small>}
            </div>}
            <span className="form-label">신고 유형</span>
            <div className="report-types">
              {(Object.keys(typeLabels) as ReportType[]).map((value) => (
                <button
                  className={type === value ? "active" : ""}
                  key={value}
                  onClick={() => setType(value)}
                >
                  {typeLabels[value]}
                </button>
              ))}
            </div>
            <label className="form-label" htmlFor="report-content">
              상세 내용
            </label>
            <textarea
              className="form-textarea"
              id="report-content"
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                if (event.target.value.trim()) setError("");
              }}
              placeholder="잘못된 장소 정보나 위치를 자세히 알려 주세요."
            />
            {error && <p className="inline-error">{error}</p>}
            {/* 갤러리 업로드 금지: 파일 선택(input type=file)을 두지 않고 앱 내 카메라만 연다 */}
            <button className="photo-upload photo-camera-button" onClick={() => setCameraOpen(true)}>
              {photo ? (
                <img src={photo.url} alt="촬영한 현장 사진" />
              ) : (
                <>
                  <AppIcon name="upload" size={22} />
                  <strong>현장 사진 촬영 (선택)</strong>
                  <span>앱 카메라로만 찍을 수 있어요 · 갤러리 사진 불가</span>
                </>
              )}
            </button>
            {photo && (
              <div className="photo-actions">
                <button onClick={() => setCameraOpen(true)}>다시 찍기</button>
                <button onClick={() => setPhoto(null)}>사진 빼기</button>
              </div>
            )}
            <button className="primary-action report-submit" onClick={submit} disabled={pending}>
              {pending ? "제출 중…" : "신고 제출하기"}
            </button>
          </div>
          {cameraOpen && (
            <CameraCapture
              onClose={() => setCameraOpen(false)}
              onCapture={(captured) => {
                if (photo) URL.revokeObjectURL(photo.url);
                setPhoto(captured);
                setCameraOpen(false);
              }}
            />
          )}
        </div>
      </section>
      <ScreenAnnotation
        screen="UI-06 오류 신고 작성"
        path="UI-02 정보 수정 요청"
        elements="시설 선택, 신고 유형, 상세 내용, 앱 내 카메라 촬영(갤러리 불가), 제출"
        data="reports.user_id, facility_id, type, content, status, photo_path, created_at / Storage report-photos"
        action="시설·유형 선택, 내용 입력, 현장 사진 촬영·다시 찍기, 제출"
        link="createReport(), UI-07 내 신고 목록"
      />
    </div>
  );
}

export function ReportListScreen({
  facilities,
  onOpenDetail,
  onTab,
}: {
  facilities: FacilitySummary[];
  onOpenDetail: (id: string) => void;
  onTab: (tab: MainTab) => void;
}) {
  const [filter, setFilter] = useState<"all" | ReportStatus>("all");
  const [allReports, setAllReports] = useState<ReportRecord[] | null>(null);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    getMyReports()
      .then(setAllReports)
      .catch((caught: Error) => setLoadError(caught.message));
  }, []);
  const reports = (allReports ?? []).filter(
    (report) => filter === "all" || report.status === filter,
  );
  const filters: Array<["all" | ReportStatus, string]> = [
    ["all", "전체"],
    ["received", "접수"],
    ["reviewing", "확인 중"],
    ["accepted", "반영됨"],
    ["rejected", "반려"],
  ];

  return (
    <div className="feature-pair">
      <section className="phone-frame" aria-label="UI-07 내 신고 목록 모바일 화면">
        <div className="feature-screen">
          <ScreenHeader title="내 신고 내역" />
          <div className="feature-body">
            <div className="status-filters">
              {filters.map(([value, label]) => (
                <button
                  className={filter === value ? "active" : ""}
                  key={value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {loadError ? (
              <div className="empty-panel">
                <AppIcon name="document" size={28} />
                <strong>{loadError}</strong>
              </div>
            ) : allReports === null ? (
              <div className="empty-panel"><p>신고 내역을 불러오는 중…</p></div>
            ) : reports.length ? (
              <div className="report-list">
                {reports.map((report) => {
                  const facility = facilities.find(
                    (item) => item.id === report.facility_id,
                  );
                  return (
                    <button
                      className="report-card"
                      key={report.id}
                      onClick={() => onOpenDetail(report.id)}
                    >
                      <div>
                        <span className={`status-badge ${report.status}`}>
                          {statusLabels[report.status]}
                        </span>
                        <small>{formatDate(report.created_at)}</small>
                      </div>
                      <strong>{report.facility_name ?? facility?.name ?? "알 수 없는 시설"}</strong>
                      <p>{typeLabels[report.type]}</p>
                      <span className="detail-link">신고 상세보기</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="empty-panel">
                <AppIcon name="document" size={28} />
                <strong>해당 상태의 신고가 없어요</strong>
                <p>다른 상태 필터를 선택해 확인해 보세요.</p>
              </div>
            )}
          </div>
          <BottomNavigation active="reports" onSelect={onTab} />
        </div>
      </section>
      <ScreenAnnotation
        screen="UI-07 내 신고 목록"
        path="하단 신고 내역, UI-06 제출 완료"
        elements="상태 필터, 신고 카드, 상태 배지, 빈 화면"
        data="reports 중 로그인한 회원의 신고 (RLS로 내 신고만 조회)"
        action="상태 필터, 신고 상세보기, 하단 메뉴 이동"
        link="getMyReports(), UI-08 신고 상세"
      />
    </div>
  );
}

export function ReportDetailScreen({
  reportId,
  facilities,
  onBack,
}: {
  reportId: string;
  facilities: FacilitySummary[];
  onBack: () => void;
}) {
  const [report, setReport] = useState<ReportRecord | null | undefined>(undefined);
  useEffect(() => {
    getReportDetail(reportId).then(setReport).catch(() => setReport(null));
  }, [reportId]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (report?.photo_path) getReportPhotoUrl(report.photo_path).then(setPhotoUrl);
  }, [report?.photo_path]);
  const facility = facilities.find((item) => item.id === report?.facility_id);
  const facilityName = report?.facility_name ?? facility?.name ?? "알 수 없는 시설";
  const facilityAddress = report?.facility_address ?? facility?.address ?? "";

  return (
    <div className="feature-pair">
      <section className="phone-frame" aria-label="UI-08 신고 상세 모바일 화면">
        <div className="feature-screen">
          <ScreenHeader title="신고 상세" onBack={onBack} />
          <div className="feature-body">
            {report === undefined ? (
              <div className="empty-panel"><p>신고 내용을 불러오는 중…</p></div>
            ) : !report ? (
              <div className="empty-panel">
                <AppIcon name="document" size={28} />
                <strong>신고 내역을 찾을 수 없어요</strong>
                <button className="text-action" onClick={onBack}>
                  목록으로 돌아가기
                </button>
              </div>
            ) : (
              <>
                <div className="report-detail-hero">
                  <span className={`status-badge ${report.status}`}>
                    {statusLabels[report.status]}
                  </span>
                  <h1>{facilityName}</h1>
                  <p>{facilityAddress}</p>
                  {isMockData && <small>장소명과 주소는 예시 데이터입니다.</small>}
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>신고 유형</dt>
                    <dd>{typeLabels[report.type]}</dd>
                  </div>
                  <div>
                    <dt>신고 날짜</dt>
                    <dd>{formatDate(report.created_at)}</dd>
                  </div>
                  <div className="detail-content-row">
                    <dt>신고 내용</dt>
                    <dd>{report.content}</dd>
                  </div>
                </dl>
                {photoUrl ? (
                  <img className="report-photo" src={photoUrl} alt="신고에 첨부한 현장 사진" />
                ) : (
                <div className="photo-empty">
                  <AppIcon name="upload" size={20} />
                  <span>{report.photo_path ? "사진을 불러오는 중…" : "첨부한 현장 사진 없음"}</span>
                </div>
                )}
                <div className="demo-notice">
                  관리자 답변이나 처리 사유는 제공된 DB 필드에 없어 표시하지
                  않습니다.
                </div>
                <button className="secondary-action" onClick={onBack}>
                  목록으로 돌아가기
                </button>
              </>
            )}
          </div>
        </div>
      </section>
      <ScreenAnnotation
        screen="UI-08 신고 상세"
        path="UI-07 신고 상세보기"
        elements="시설 정보, 유형, 내용, 날짜, 상태, 첨부 영역"
        data="reports 단건과 smoking_facilities 표시 정보"
        action="내용 확인, 목록으로 돌아가기"
        link="getReportDetail(), UI-07 내 신고 목록"
      />
    </div>
  );
}
