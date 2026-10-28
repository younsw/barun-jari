import { useMemo, useState } from "react";
import KakaoMap from "./features/places/KakaoMap";
import { buildDirectionsUrl, getCurrentPosition, hasKakaoMapKey } from "./features/places/kakaoMap";

type AreaType = "흡연구역" | "흡연부스";
type PreviewState = "default" | "empty" | "denied";

type Place = {
  id: number;
  name: string;
  address: string;
  distance: string;
  type: AreaType;
  latitude: number;
  longitude: number;
};

const places: Place[] = [
  { id: 1, name: "예시 데이터 · 중앙광장 흡연구역", address: "예시 데이터 · 중앙광장 인근", distance: "180m", type: "흡연구역", latitude: 37.0, longitude: 127.0 },
  { id: 2, name: "예시 데이터 · 1번 출구 흡연부스", address: "예시 데이터 · 1번 출구 앞", distance: "320m", type: "흡연부스", latitude: 37.01, longitude: 127.01 },
  { id: 3, name: "예시 데이터 · 공원 입구 흡연구역", address: "예시 데이터 · 시민공원 동문", distance: "540m", type: "흡연구역", latitude: 37.02, longitude: 127.02 },
  { id: 4, name: "예시 데이터 · 복합센터 흡연부스", address: "예시 데이터 · 복합센터 후문", distance: "780m", type: "흡연부스", latitude: 37.03, longitude: 127.03 },
  { id: 5, name: "예시 데이터 · 업무지구 흡연구역", address: "예시 데이터 · 업무지구 보행로", distance: "1.1km", type: "흡연구역", latitude: 37.04, longitude: 127.04 },
];

function Icon({ name, size = 20 }: { name: "search" | "location" | "refresh" | "pin" | "chevron" | "info" | "map"; size?: number }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    refresh: <><path d="M20 6v5h-5" /><path d="M18.2 15a7 7 0 1 1-.2-6l2 2" /></>,
    pin: <><path d="M18 9c0 4-6 9-6 9s-6-5-6-9a6 6 0 1 1 12 0Z" /><circle cx="12" cy="9" r="2" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15m6-12v15" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function MapPreview() {
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

function EmptyState() {
  return <div className="empty-state">
    <span><Icon name="search" size={25} /></span>
    <strong>검색 결과가 없습니다</strong>
    <p>다른 지역명이나 장소명으로 검색해 보세요.</p>
  </div>;
}

function ListAnnotation({ state, onState }: { state: PreviewState; onState: (state: PreviewState) => void }) {
  const notes = [
    ["화면 ID·화면명", "UI-01 흡연구역 목록"],
    ["진입 경로", "서비스 첫 화면"],
    ["구성 요소", "검색창, 위치 버튼, 필터, 지도 미리보기, 장소 카드"],
    ["표시 데이터", "smoking_areas.name, address, area_type, latitude, longitude 및 계산된 거리"],
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
    <p className="annotation-foot">DB 필드는 Supabase 최종 테이블 설계에 따라 변경 가능합니다.</p>
  </aside>;
}

function DetailAnnotation() {
  const notes = [
    ["화면 ID·화면명", "UI-02 흡연구역 상세"],
    ["진입 경로", "UI-01 장소 카드 선택"],
    ["구성 요소", "장소명, 주소, 유형, 지도, 길찾기, 이용 인증, 오류 신고"],
    ["표시 데이터", "smoking_areas.name, address, area_type, latitude, longitude, updated_at 및 계산된 거리"],
    ["사용자 동작", "뒤로가기, 길찾기, 인증 이동, 오류 신고"],
    ["연계 기능", "FR-02, FR-03 (임시 번호)"],
  ];
  return <aside className="annotation">
    <div className="annotation-kicker">DEVELOPER NOTE</div>
    <div className="annotation-title">UI-02 화면 정의</div>
    <div className="annotation-list">{notes.map(([title, body], index) =>
      <div className="annotation-row" key={title}><span>{index + 1}</span><div><strong>{title}</strong><p>{body}</p></div></div>
    )}</div>
    <p className="annotation-foot">외부 지도·길찾기와 인증 기능은 후속 연동을 고려한 목업 상태입니다. DB 필드는 실제 Supabase 구조에 맞게 변경할 수 있습니다.</p>
  </aside>;
}

function DetailScreen({ place, onBack }: { place: Place; onBack: () => void }) {
  const [message, setMessage] = useState("");
  const [mapAvailable, setMapAvailable] = useState(hasKakaoMapKey);
  const [routing, setRouting] = useState(false);
  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2400);
  };

  // 현재 위치를 얻으면 도보 길찾기, 못 얻으면 목적지만 넘겨 카카오맵에서 출발지를 고르게 합니다.
  const openDirections = async () => {
    const routeWindow = window.open("", "_blank");  // 팝업 차단을 피하려고 클릭 즉시 창을 엽니다
    setRouting(true);
    const origin = await getCurrentPosition();
    setRouting(false);
    const url = buildDirectionsUrl(place.name, place, origin, "walk");
    if (routeWindow) routeWindow.location.href = url;
    else window.location.href = url;
    if (!origin) showMessage("현재 위치를 몰라 카카오맵에서 출발지를 선택해 주세요.");
  };

  return <section className="phone-frame detail-frame" aria-label="UI-02 흡연구역 상세 모바일 화면">
    <div className="detail-screen">
      <header className="detail-header">
        <button onClick={onBack} aria-label="UI-01 목록으로 돌아가기"><Icon name="chevron" size={22} /></button>
        <strong>흡연구역 상세</strong><span />
      </header>
      <div className="detail-body">
        <div className="detail-intro">
          <span className="type-badge">{place.type}</span>
          <div className="detail-title">{place.name}</div>
          <p className="example-flag">장소명과 주소는 실제 정보가 아닌 예시 데이터입니다.</p>
        </div>

        <div className="detail-meta">
          <div><span><Icon name="location" size={18} /></span><div><small>주소</small><strong>{place.address}</strong></div></div>
          <div><span><Icon name="map" size={18} /></span><div><small>현재 위치에서</small><strong>{place.distance}</strong></div></div>
        </div>

        <div className="detail-map">
          {mapAvailable
            ? <KakaoMap center={place} onUnavailable={() => setMapAvailable(false)} />
            : <>
              <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" />
              <span className="mock-label">KAKAO MAP 키 설정 전 · MOCKUP</span>
              <span className="detail-map-pin"><Icon name="pin" size={23} /></span>
            </>}
          <div className="coordinate"><strong>장소 좌표</strong><span>{place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}</span></div>
        </div>

        <button className="route-button" onClick={openDirections} disabled={routing}>
          <Icon name="map" size={19} />{routing ? "현재 위치 확인 중…" : "카카오맵 길찾기"}<span>도보 · 카카오맵에서 열림</span>
        </button>

        <div className="info-card">
          <div><span>장소 유형</span><strong>{place.type}</strong></div>
          <div><span>정보 기준일</span><strong>예시 값 없음 · 미표시 처리</strong></div>
        </div>

        <button className="report-button" onClick={() => showMessage("위치 오류 신고 기능은 준비 중입니다.")}>
          <Icon name="info" size={17} />장소 정보나 위치가 잘못되었나요?<span>오류 신고</span>
        </button>
      </div>
      <div className="detail-bottom">
        <button onClick={() => showMessage("GPS 및 현장 사진 인증 화면으로 연결될 예정입니다.")}>
          이용 인증하기<small>GPS · 현장 사진 인증 예정</small>
        </button>
      </div>
      {message && <div className="toast">{message}</div>}
    </div>
  </section>;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"전체" | AreaType>("전체");
  const [previewState, setPreviewState] = useState<PreviewState>("default");
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<Place>(places[0]);
  const [activeScreen, setActiveScreen] = useState<"list" | "detail">("list");

  const filtered = useMemo(() => {
    if (previewState === "empty") return [];
    return places.filter((place) => {
      const matchesType = filter === "전체" || place.type === filter;
      const keyword = query.trim().toLowerCase();
      return matchesType && (!keyword || `${place.name} ${place.address}`.toLowerCase().includes(keyword));
    });
  }, [filter, previewState, query]);

  const refreshLocation = () => {
    if (previewState === "denied") return;
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 700);
  };

  const openDetail = (place: Place) => {
    setSelectedPlace(place);
    setActiveScreen("detail");
    setNotice(`${place.name} 선택됨 · UI-02에 반영`);
    window.setTimeout(() => setNotice(""), 1800);
    window.setTimeout(() => document.getElementById("ui-02")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  return <main className="prototype-stage">
    <div className={`prototype-pair ${activeScreen !== "list" ? "mobile-hidden" : ""}`} id="ui-01">
    <section className="phone-frame" aria-label="UI-01 흡연구역 목록 모바일 화면">
      <div className="phone-content">
        <header className="service-header">
          <div className="brand"><span className="brand-mark"><Icon name="location" size={18} /></span>바른자리</div>
          <div className="hero-title">내 주변 흡연구역 찾기</div>
          <p>가까운 지정 구역을 확인하고 바른자리를 이용하세요.</p>
        </header>

        <div className="location-card">
          <span className="location-icon"><Icon name="location" size={19} /></span>
          <div><small>현재 위치</small><strong>{previewState === "denied" ? "위치를 확인할 수 없어요" : "현재 위치 확인됨 · 예시 위치"}</strong></div>
          <button className={refreshing ? "spin" : ""} onClick={refreshLocation} aria-label="현재 위치 새로고침"><Icon name="refresh" size={19} /></button>
        </div>

        {previewState === "denied" && <div className="permission-state">
          <Icon name="info" size={19} /><div><strong>위치 권한이 필요합니다</strong><p>브라우저 설정에서 위치 권한을 허용하면 가까운 순으로 확인할 수 있어요.</p></div>
          <button onClick={() => setPreviewState("default")}>권한 설정 안내</button>
        </div>}

        <label className="search-field">
          <Icon name="search" size={20} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="지역명 또는 장소명을 검색하세요" />
          {query && <button onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>}
        </label>

        <div className="filters">{(["전체", "흡연구역", "흡연부스"] as const).map((item) =>
          <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>
        )}</div>

        <MapPreview />

        <div className="list-heading"><div><strong>주변 흡연구역</strong><span>{filtered.length}곳</span></div><small>가까운 순</small></div>
        <div className="place-list">
          {filtered.length ? filtered.map((place) =>
            <button className="place-card" key={place.id} onClick={() => openDetail(place)}>
              <span className="card-pin"><Icon name="pin" size={19} /></span>
              <span className="place-copy"><strong>{place.name}</strong><span>{place.address}</span><small><b>{place.distance}</b><i />{place.type}</small></span>
              <Icon name="chevron" size={18} />
            </button>
          ) : <EmptyState />}
        </div>
        <div className="data-note"><Icon name="info" size={14} />화면의 모든 장소와 주소는 예시 데이터입니다.</div>
      </div>
      {notice && <div className="toast">{notice}</div>}
    </section>
    <ListAnnotation state={previewState} onState={setPreviewState} />
    </div>
    <div className={`prototype-pair ${activeScreen !== "detail" ? "mobile-hidden" : ""}`} id="ui-02">
      <DetailScreen place={selectedPlace} onBack={() => {
        setActiveScreen("list");
        window.setTimeout(() => document.getElementById("ui-01")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
      }} />
      <DetailAnnotation />
    </div>
  </main>;
}
