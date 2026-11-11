import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RequireLogin, useAuth } from "./features/auth";
import { isMockData } from "./features/auth/supabaseClient";
import KakaoMap from "./features/places/KakaoMap";
import NearbyMap from "./features/places/NearbyMap";
import { buildDirectionsUrl, buildSearchUrl, getCurrentPosition, getGpsFix, hasKakaoMapKey, searchLocation, type LatLng, type SearchedArea } from "./features/places/kakaoSdk";
import { distanceMeters, formatDistance, getFacilities, placeCoords, type Place } from "./features/places/placeService";
import {
  ReportCreateScreen,
  ReportDetailScreen,
  ReportListScreen,
} from "./features/reports/ReportScreens";
import RewardsScreen from "./features/rewards/RewardsScreen";
import CheckinScreen from "./features/checkin/CheckinScreen";
import { CHECKIN_POINTS, CHECKIN_RADIUS_M, findNearest } from "./features/checkin/checkinService";
import "./features/checkin/checkin.css";
import ProfileScreen from "./features/profile/ProfileScreen";
import AccountScreen from "./features/profile/AccountScreen";
import AdminApp from "./features/admin/AdminApp";
import {
  BottomNavigation,
  type MainTab,
} from "./features/profile/AppShell";
import "./features/profile/appShell.css";

type PreviewState = "default" | "empty" | "denied";

type AppScreen =
  | "list"
  | "detail"
  | "checkin"
  | "reportCreate"
  | "reportList"
  | "reportDetail"
  | "rewards"
  | "profile"
  | "admin"
  | "account";

/** 화면 표시용: 장소 + 현재 위치에서의 거리 */
type PlaceView = Place & { meters: number | null };

function Icon({ name, size = 20 }: { name: "search" | "location" | "refresh" | "pin" | "chevron" | "info" | "map" | "expand" | "close"; size?: number }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    refresh: <><path d="M20 6v5h-5" /><path d="M18.2 15a7 7 0 1 1-.2-6l2 2" /></>,
    pin: <><path d="M18 9c0 4-6 9-6 9s-6-5-6-9a6 6 0 1 1 12 0Z" /><circle cx="12" cy="9" r="2" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15m6-12v15" /></>,
    expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

// 첫 화면 지도: 키가 있으면 내 위치 중심 카카오 지도, 없거나 실패하면 기존 목업
function MapPreview({ userLocation, focus, places, onSelect }: { userLocation: LatLng | null; focus: SearchedArea | null; places: PlaceView[]; onSelect: (id: number) => void }) {
  const [mapAvailable, setMapAvailable] = useState(hasKakaoMapKey);
  const [fullscreen, setFullscreen] = useState(false);
  // 전체 화면일 때 Esc로 닫고, 뒤 화면이 스크롤되지 않게 막는다
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setFullscreen(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);
  const nearby = useMemo(() => places.flatMap((place) => {
    const coords = placeCoords(place);
    return coords ? [{ id: place.id, name: place.name, coords }] : [];
  }), [places]);
  if (mapAvailable) {
    return <div className={`map-preview live ${fullscreen ? "fullscreen" : ""}`}>
      <NearbyMap userLocation={userLocation} focus={focus} places={nearby} onSelect={(id) => { setFullscreen(false); onSelect(id); }} onUnavailable={() => setMapAvailable(false)} />
      <button className="map-fullscreen-toggle" onClick={() => setFullscreen(!fullscreen)} aria-label={fullscreen ? "전체 화면 닫기" : "지도 전체 화면으로 보기"}>
        <Icon name={fullscreen ? "close" : "expand"} size={fullscreen ? 20 : 17} />
      </button>
      {!userLocation && !focus && <span className="map-hint">위치 권한을 허용하면 내 위치 중심으로 보여드려요</span>}
    </div>;
  }
  return <div className="map-preview" aria-label="목업 지도 미리보기">
    <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" />
    <span className="map-name name-one">예시로</span><span className="map-name name-two">중앙광장</span>
    <span className="mock-label">MAP MOCKUP</span>
    <span className="user-dot" title="현재 위치" />
    <span className="preview-pin pin-one"><Icon name="pin" size={17} /></span>
    <span className="preview-pin pin-two"><Icon name="pin" size={17} /></span>
    <span className="preview-pin pin-three"><Icon name="pin" size={17} /></span>
  </div>;
}

function EmptyState({ message = "검색 결과가 없습니다" }: { message?: string }) {
  return <div className="empty-state">
    <span><Icon name="search" size={25} /></span>
    <strong>{message}</strong>
    <p>다른 지역명이나 장소명으로 검색해 보세요.</p>
  </div>;
}

function ListAnnotation({ state, onState }: { state: PreviewState; onState: (state: PreviewState) => void }) {
  const notes = [
    ["화면 ID·화면명", "UI-01 흡연구역 목록"],
    ["진입 경로", "서비스 첫 화면 (로그인 후)"],
    ["구성 요소", "검색창, 위치 버튼, 업종 필터, 지도 미리보기, 장소 카드"],
    ["표시 데이터", "smoking_facilities.name, address, category, latitude, longitude 및 계산된 거리"],
    ["사용자 동작", "검색, 필터 선택, 현재 위치 확인, 상세 이동"],
    ["연계 기능", "FR-01, FR-02 (임시 번호)"],
  ];
  return <aside className="annotation">
    <div className="annotation-kicker">DEVELOPER NOTE</div>
    <div className="annotation-title">화면 정의</div>
    <div className="annotation-list">{notes.map(([title, body], index) =>
      <div className="annotation-row" key={title}><span>{index + 1}</span><div><strong>{title}</strong><p>{body}</p></div></div>
    )}</div>
    <div className="state-preview">
      <strong>상태 미리보기</strong>
      <div>{([["default", "기본"], ["empty", "결과 없음"], ["denied", "위치 권한 없음"]] as const).map(([value, label]) =>
        <button className={state === value ? "active" : ""} key={value} onClick={() => onState(value)}>{label}</button>
      )}</div>
    </div>
    <p className="annotation-foot">{isMockData ? "Supabase 키가 없어 예시 장소 5곳을 보여줍니다." : "Supabase smoking_facilities 테이블의 실제 데이터입니다."}</p>
  </aside>;
}

function DetailAnnotation() {
  const notes = [
    ["화면 ID·화면명", "UI-02 흡연구역 상세"],
    ["진입 경로", "UI-01 장소 카드 선택"],
    ["구성 요소", "장소명, 주소, 업종, 카카오 지도, 길찾기, 오류 신고"],
    ["표시 데이터", "smoking_facilities.name, address, category, room_count, latitude, longitude 및 계산된 거리"],
    ["사용자 동작", "뒤로가기, 카카오맵 길찾기, 오류 신고"],
    ["연계 기능", "FR-02, FR-03 (임시 번호), UI-06 오류 신고"],
  ];
  return <aside className="annotation">
    <div className="annotation-kicker">DEVELOPER NOTE</div>
    <div className="annotation-title">UI-02 화면 정의</div>
    <div className="annotation-list">{notes.map(([title, body], index) =>
      <div className="annotation-row" key={title}><span>{index + 1}</span><div><strong>{title}</strong><p>{body}</p></div></div>
    )}</div>
    <p className="annotation-foot">지도는 VITE_KAKAO_MAP_JS_KEY가 있을 때 카카오 지도로 바뀝니다. 좌표가 없는 장소는 카카오맵 주소 검색으로 연결합니다.</p>
  </aside>;
}

function DetailScreen({ place, userLocation, onBack, onReport, onCheckin }: { place: PlaceView; userLocation: LatLng | null; onBack: () => void; onReport: () => void; onCheckin: () => void }) {
  const [message, setMessage] = useState("");
  const [mapAvailable, setMapAvailable] = useState(hasKakaoMapKey);
  const [routing, setRouting] = useState(false);
  const coords = placeCoords(place);
  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2400);
  };

  // 현재 위치를 얻으면 도보 길찾기, 못 얻으면 목적지만 넘겨 카카오맵에서 출발지를 고르게 합니다.
  // 좌표가 아직 없는 장소는 주소 검색으로 엽니다.
  const openDirections = async () => {
    const routeWindow = window.open("", "_blank");  // 팝업 차단을 피하려고 클릭 즉시 창을 엽니다
    let url = buildSearchUrl(place.address);
    let origin: LatLng | null = null;
    if (coords) {
      setRouting(true);
      origin = userLocation ?? await getCurrentPosition();
      setRouting(false);
      url = buildDirectionsUrl(place.name, coords, origin, "walk");
    }
    if (routeWindow) routeWindow.location.href = url;
    else window.location.href = url;
    if (!coords) showMessage("좌표 준비 중인 장소라 카카오맵 주소 검색으로 열었어요.");
    else if (!origin) showMessage("현재 위치를 몰라 카카오맵에서 출발지를 선택해 주세요.");
  };

  return <section className="phone-frame detail-frame" aria-label="UI-02 흡연구역 상세 모바일 화면">
    <div className="detail-screen">
      <header className="detail-header">
        <button onClick={onBack} aria-label="UI-01 목록으로 돌아가기"><Icon name="chevron" size={22} /></button>
        <strong>흡연구역 상세</strong><span />
      </header>
      <div className="detail-body">
        <div className="detail-intro">
          <span className="type-badge">{place.category}</span>
          <div className="detail-title">{place.name}</div>
          {isMockData && <p className="example-flag">장소명과 주소는 실제 정보가 아닌 예시 데이터입니다.</p>}
        </div>

        <div className="detail-meta">
          <div><span><Icon name="location" size={18} /></span><div><small>주소</small><strong>{place.address}</strong></div></div>
          <div><span><Icon name="map" size={18} /></span><div><small>현재 위치에서</small><strong>{formatDistance(place.meters)}</strong></div></div>
        </div>

        <div className="detail-map">
          {coords && mapAvailable
            ? <KakaoMap center={coords} onUnavailable={() => setMapAvailable(false)} />
            : <>
              <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" />
              <span className="mock-label">{coords ? "KAKAO MAP 키 설정 전 · MOCKUP" : "좌표 준비 중 · MOCKUP"}</span>
              <span className="detail-map-pin"><Icon name="pin" size={23} /></span>
            </>}
          <div className="coordinate"><strong>장소 좌표</strong><span>{coords ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` : "주소→좌표 변환 전"}</span></div>
        </div>

        <button className="checkin-button" onClick={onCheckin} disabled={!coords}>
          <Icon name="location" size={19} />{coords ? "현장 인증하기" : "좌표 준비 중이라 인증할 수 없어요"}{coords && <small>위치 + 사진 · {CHECKIN_POINTS}P</small>}
        </button>

        <button className="route-button" onClick={openDirections} disabled={routing}>
          <Icon name="map" size={19} />{routing ? "현재 위치 확인 중…" : coords ? "카카오맵 길찾기" : "카카오맵에서 주소 검색"}<span>{coords ? "도보 · 카카오맵에서 열림" : "좌표 준비 중"}</span>
        </button>

        <div className="info-card">
          <div><span>업종</span><strong>{place.category}</strong></div>
          <div><span>정보 출처</span><strong>{isMockData ? "예시 데이터" : "서울 중랑구 흡연시설 현황 (2026-02-12)"}</strong></div>
        </div>

        <button className="report-button" onClick={onReport}>
          <Icon name="info" size={19} />오류 신고<small>장소 정보·위치가 잘못되었나요?</small>
        </button>
      </div>
      {message && <div className="toast">{message}</div>}
    </div>
  </section>;
}

/** 로그인 전에는 로그인·회원가입 화면만 보여준다 (src/features/auth/RequireLogin.tsx) */
function LoginGate({ children }: { children: ReactNode }) {
  const { loading, isLoggedIn, passwordRecovery } = useAuth();
  if (loading || !isLoggedIn || passwordRecovery) {
    return <main className="prototype-stage"><div className="prototype-pair"><RequireLogin>{null}</RequireLogin></div></main>;
  }
  return <>{children}</>;
}

export default function App() {
  return <LoginGate><MainApp /></LoginGate>;
}

function MainApp() {
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [query, setQuery] = useState("");
  // 검색어로 찾은 위치: 지도를 그곳으로 옮기고 목록을 그 위치에서 가까운 순으로 보여준다
  const [searchArea, setSearchArea] = useState<(SearchedArea & { query: string }) | null>(null);
  const [searchMessage, setSearchMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState("전체");
  const [previewState, setPreviewState] = useState<PreviewState>("default");
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null);
  const [screenStack, setScreenStack] = useState<AppScreen[]>(["list"]);
  const [selectedReportId, setSelectedReportId] = useState("");
  // 하단 "인증하기": 현재 위치로 가장 가까운 흡연구역을 찾는 중이거나, 못 찾았을 때 안내
  const [finding, setFinding] = useState<null | { message: string; nearestId?: number; done?: boolean }>(null);
  const activeScreen = screenStack[screenStack.length - 1] ?? "list";

  useEffect(() => {
    getFacilities().then(setPlaces).catch((caught: Error) => setLoadError(caught.message));
  }, []);

  const refreshLocation = async () => {
    if (previewState === "denied") return;
    setRefreshing(true);
    setUserLocation(await getCurrentPosition());
    setRefreshing(false);
  };
  useEffect(() => { void refreshLocation(); }, []);

  const located = previewState !== "denied" ? userLocation : null;
  const placeViews = useMemo<PlaceView[]>(() => (places ?? []).map((place) => {
    const coords = placeCoords(place);
    return { ...place, meters: coords && located ? distanceMeters(located, coords) : null };
  }), [places, located]);

  // 업종 필터: 많은 순서대로
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    placeViews.forEach((place) => counts.set(place.category, (counts.get(place.category) ?? 0) + 1));
    return ["전체", ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([category]) => category)];
  }, [placeViews]);

  const filtered = useMemo(() => {
    if (previewState === "empty") return [];
    const byCategory = placeViews.filter((place) => filter === "전체" || place.category === filter);
    if (searchArea) {
      // 검색한 위치 기준: 이름이 달라도 그 근처 시설을 가까운 순으로
      const fromArea = (place: PlaceView) => {
        const coords = placeCoords(place);
        return coords ? distanceMeters(searchArea, coords) : Infinity;
      };
      return [...byCategory].sort((a, b) => fromArea(a) - fromArea(b));
    }
    const keyword = query.trim().toLowerCase();
    return byCategory
      .filter((place) => !keyword || `${place.name} ${place.address}`.toLowerCase().includes(keyword))
      .sort((a, b) => (a.meters ?? Infinity) - (b.meters ?? Infinity));
  }, [placeViews, filter, previewState, query, searchArea]);

  const runLocationSearch = async () => {
    const keyword = query.trim();
    if (!keyword) return;
    if (!hasKakaoMapKey) {
      setSearchMessage("지도 키가 없어 이름·주소로만 걸러 보여드려요.");
      return;
    }
    setSearching(true);
    setSearchMessage("");
    try {
      const area = await searchLocation(keyword);
      if (area) {
        setSearchArea({ ...area, query: keyword });
      } else {
        setSearchArea(null);
        setSearchMessage(`'${keyword}' 위치를 찾지 못해 이름·주소로 걸러 보여드려요.`);
      }
    } catch {
      setSearchArea(null);
      setSearchMessage("위치 검색을 하지 못했어요. 이름·주소로 걸러 보여드려요.");
    } finally {
      setSearching(false);
    }
  };

  const changeQuery = (value: string) => {
    setQuery(value);
    setSearchMessage("");
    if (searchArea && value.trim() !== searchArea.query) setSearchArea(null);
  };

  const selectedPlace = placeViews.find((place) => place.id === selectedPlaceId) ?? null;
  const hasDistance = filtered.some((place) => place.meters !== null);

  const navigate = (screen: AppScreen) => {
    setScreenStack((stack) => [...stack, screen]);
  };

  const goBack = () => {
    setScreenStack((stack) => (stack.length > 1 ? stack.slice(0, -1) : ["list"]));
  };

  const selectTab = (tab: MainTab) => {
    if (tab === "checkin") {
      void findNearbyForCheckin();
      return;
    }
    const screens: Record<Exclude<MainTab, "checkin">, AppScreen> = {
      map: "list",
      reports: "reportList",
      rewards: "rewards",
      profile: "profile",
    };
    setScreenStack([screens[tab]]);
  };

  const openDetail = (place: PlaceView) => {
    setSelectedPlaceId(place.id);
    navigate("detail");
    setNotice(`${place.name} 선택됨 · UI-02에 반영`);
    window.setTimeout(() => setNotice(""), 1800);
    window.setTimeout(() => document.getElementById("ui-02")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const facilities = (places ?? []).map(({ id, name, address }) => ({ id, name, address }));

  // 인증하기: GPS로 현재 위치를 받아 인증 반경(30m) 안의 가장 가까운 흡연구역 상세 화면을 띄운다
  const findNearbyForCheckin = async () => {
    setScreenStack(["list"]);
    setFinding({ message: "현재 위치로 가까운 흡연구역을 찾는 중…" });
    try {
      const fix = await getGpsFix();
      setUserLocation(fix);
      if (previewState === "denied") setPreviewState("default");
      const nearest = findNearest(places ?? [], fix);
      if (!nearest) {
        setFinding({ message: "위치 정보가 있는 흡연구역이 없어요.", done: true });
      } else if (nearest.distance > CHECKIN_RADIUS_M) {
        setFinding({
          message: `${CHECKIN_RADIUS_M}m 안에 등록된 흡연구역이 없어요. 가장 가까운 곳은 ${nearest.place.name}(${formatDistance(nearest.distance)})이에요.`,
          nearestId: nearest.place.id,
          done: true,
        });
      } else {
        setFinding(null);
        setSelectedPlaceId(nearest.place.id);
        setScreenStack(["list", "detail"]);
        window.setTimeout(() => document.getElementById("ui-02")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
      }
    } catch (caught) {
      setFinding({ message: caught instanceof Error ? caught.message : "현재 위치를 확인하지 못했어요.", done: true });
    }
  };

  if (activeScreen === "checkin" && selectedPlace) {
    return <main className="prototype-stage"><CheckinScreen place={selectedPlace} onBack={goBack} onRewards={() => setScreenStack(["rewards"])} onDone={() => setScreenStack(["list"])} /></main>;
  }

  if (activeScreen === "reportCreate") {
    return <main className="prototype-stage"><ReportCreateScreen facilities={facilities} initialFacilityId={selectedPlace?.id ?? facilities[0]?.id ?? 0} onBack={goBack} onComplete={() => setScreenStack(["reportList"])} /></main>;
  }

  if (activeScreen === "reportList") {
    return <main className="prototype-stage"><ReportListScreen facilities={facilities} onOpenDetail={(id) => {
      setSelectedReportId(id);
      navigate("reportDetail");
    }} onTab={selectTab} /></main>;
  }

  if (activeScreen === "reportDetail") {
    return <main className="prototype-stage"><ReportDetailScreen reportId={selectedReportId} facilities={facilities} onBack={goBack} /></main>;
  }

  if (activeScreen === "rewards") {
    return <main className="prototype-stage"><RewardsScreen onTab={selectTab} /></main>;
  }

  if (activeScreen === "profile") {
    return <main className="prototype-stage"><ProfileScreen onTab={selectTab} onOpenAdmin={() => navigate("admin")} onOpenAccount={() => navigate("account")} /></main>;
  }

  if (activeScreen === "account") {
    return <main className="prototype-stage"><AccountScreen onBack={goBack} onTab={selectTab} /></main>;
  }

  if (activeScreen === "admin") {
    return <main className="prototype-stage"><AdminApp onExit={goBack} onFacilitiesChanged={() => { getFacilities().then(setPlaces).catch(() => undefined); }} /></main>;
  }

  return <main className="prototype-stage">
    <div className={`prototype-pair ${activeScreen !== "list" ? "mobile-hidden" : ""}`} id="ui-01">
    <section className="phone-frame" aria-label="UI-01 흡연구역 목록 모바일 화면">
      <div className="phone-content with-bottom-navigation">
        <header className="service-header">
          <div className="brand"><span className="brand-mark"><Icon name="location" size={18} /></span>바른자리</div>
          <div className="hero-title">내 주변 흡연구역 찾기</div>
          <p>가까운 지정 구역을 확인하고 바른자리를 이용하세요.</p>
        </header>

        <div className="location-card">
          <span className="location-icon"><Icon name="location" size={19} /></span>
          <div><small>현재 위치</small><strong>{located ? "현재 위치 확인됨" : refreshing ? "위치 확인 중…" : "위치를 확인할 수 없어요"}</strong></div>
          <button className={refreshing ? "spin" : ""} onClick={() => void refreshLocation()} aria-label="현재 위치 새로고침"><Icon name="refresh" size={19} /></button>
        </div>

        {(previewState === "denied" || (!located && !refreshing)) && <div className="permission-state">
          <Icon name="info" size={19} /><div><strong>위치 권한이 필요합니다</strong><p>브라우저 설정에서 위치 권한을 허용하면 가까운 순으로 확인할 수 있어요.</p></div>
          <button onClick={() => { setPreviewState("default"); void refreshLocation(); }}>다시 시도</button>
        </div>}

        <form className="search-field" role="search" onSubmit={(event) => { event.preventDefault(); void runLocationSearch(); }}>
          <Icon name="search" size={20} />
          <input value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="지역명 또는 장소명을 검색하세요" enterKeyHint="search" aria-label="지역명 또는 장소명 검색" />
          {query && <button type="button" onClick={() => changeQuery("")} aria-label="검색어 지우기">×</button>}
          <button type="submit" className="search-go" disabled={!query.trim() || searching}>{searching ? "찾는 중" : "지도 이동"}</button>
        </form>
        {searchArea && <div className="search-area">
          <span><b>{searchArea.label}</b> 주변을 보여드려요</span>
          <button onClick={() => changeQuery("")}>검색 해제</button>
        </div>}
        {searchMessage && <p className="search-message">{searchMessage}</p>}

        <div className="filters">{categories.slice(0, 4).map((item) =>
          <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>
        )}</div>

        <MapPreview userLocation={located} focus={searchArea} places={filtered} onSelect={(id) => {
          const place = filtered.find((item) => item.id === id);
          if (place) openDetail(place);
        }} />

        <div className="list-heading"><div><strong>주변 흡연시설</strong><span>{filtered.length}곳</span></div><small>{searchArea ? "검색 위치에서 가까운 순" : hasDistance ? "가까운 순" : "좌표 준비 중"}</small></div>
        <div className="place-list">
          {loadError ? <EmptyState message={loadError} />
            : places === null ? <EmptyState message="흡연시설을 불러오는 중…" />
            : filtered.length ? filtered.map((place) =>
            <button className="place-card" key={place.id} onClick={() => openDetail(place)}>
              <span className="card-pin"><Icon name="pin" size={19} /></span>
              <span className="place-copy"><strong>{place.name}</strong><span>{place.address}</span><small><b>{formatDistance(place.meters)}</b><i />{place.category}</small></span>
              <Icon name="chevron" size={18} />
            </button>
          ) : <EmptyState />}
        </div>
        <div className="data-note"><Icon name="info" size={14} />{isMockData ? "화면의 모든 장소와 주소는 예시 데이터입니다." : "서울 중랑구 흡연시설 현황(2026-02-12) 공공데이터 기준입니다."}</div>
      </div>
      <BottomNavigation active={finding ? "checkin" : "map"} onSelect={selectTab} />
      {notice && <div className="toast">{notice}</div>}
      {finding && <div className="checkin-finding" role="status">
        <strong>{finding.done ? "현장 인증" : "가까운 흡연구역 찾는 중"}</strong>
        <p>{finding.message}</p>
        {finding.nearestId !== undefined && <button onClick={() => {
          const id = finding.nearestId!;
          setFinding(null);
          setSelectedPlaceId(id);
          setScreenStack(["list", "detail"]);
        }}>가장 가까운 곳 보기</button>}
        {finding.done && <button onClick={() => setFinding(null)}>닫기</button>}
      </div>}
    </section>
    <ListAnnotation state={previewState} onState={setPreviewState} />
    </div>
    {selectedPlace && <div className={`prototype-pair ${activeScreen !== "detail" ? "mobile-hidden" : ""}`} id="ui-02">
      <DetailScreen place={selectedPlace} userLocation={located} onReport={() => navigate("reportCreate")} onCheckin={() => navigate("checkin")} onBack={() => {
        goBack();
        window.setTimeout(() => document.getElementById("ui-01")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
      }} />
      <DetailAnnotation />
    </div>}
  </main>;
}
