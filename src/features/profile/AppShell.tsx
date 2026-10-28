import type { ReactNode } from "react";

export type MainTab = "map" | "reports" | "rewards" | "profile";

type IconName =
  | "back"
  | "check"
  | "document"
  | "gift"
  | "map"
  | "person"
  | "shield"
  | "upload";

export function AppIcon({
  name,
  size = 20,
}: {
  name: IconName;
  size?: number;
}) {
  const paths: Record<IconName, ReactNode> = {
    back: <path d="m15 18-6-6 6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    document: (
      <>
        <path d="M6 3h9l3 3v15H6z" />
        <path d="M9 11h6M9 15h6M15 3v4h4" />
      </>
    ),
    gift: (
      <>
        <path d="M4 10h16v11H4zM3 6h18v4H3zM12 6v15" />
        <path d="M12 6c-1-3-6-4-6-1 0 2 3 2 6 1Zm0 0c1-3 6-4 6-1 0 2-3 2-6 1Z" />
      </>
    ),
    map: (
      <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
        <path d="M9 3v15m6-12v15" />
      </>
    ),
    person: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m-4 4 4-4 4 4" />
        <path d="M5 14v6h14v-6" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function ScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack?: () => void;
}) {
  return (
    <header className="feature-header">
      {onBack ? (
        <button onClick={onBack} aria-label="이전 화면으로 돌아가기">
          <AppIcon name="back" />
        </button>
      ) : (
        <span />
      )}
      <strong>{title}</strong>
      <span />
    </header>
  );
}

export function BottomNavigation({
  active,
  onSelect,
}: {
  active: MainTab;
  onSelect: (tab: MainTab) => void;
}) {
  const items: Array<[MainTab, IconName, string]> = [
    ["map", "map", "지도"],
    ["reports", "document", "신고 내역"],
    ["rewards", "gift", "리워드"],
    ["profile", "person", "마이페이지"],
  ];
  return (
    <nav className="bottom-navigation" aria-label="주요 메뉴">
      {items.map(([value, icon, label]) => (
        <button
          className={active === value ? "active" : ""}
          key={value}
          onClick={() => onSelect(value)}
        >
          <AppIcon name={icon} size={19} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function ScreenAnnotation({
  screen,
  path,
  elements,
  data,
  action,
  link,
  children,
}: {
  screen: string;
  path: string;
  elements: string;
  data: string;
  action: string;
  link: string;
  children?: ReactNode;
}) {
  const notes = [
    ["화면 ID·화면명", screen],
    ["진입 경로", path],
    ["주요 구성 요소", elements],
    ["표시 데이터 및 DB 필드", data],
    ["사용자 동작", action],
    ["연계 기능", link],
  ];
  return (
    <aside className="annotation">
      <div className="annotation-kicker">DEVELOPER NOTE</div>
      <div className="annotation-title">{screen} 화면 정의</div>
      <div className="annotation-list">
        {notes.map(([title, body], index) => (
          <div className="annotation-row" key={title}>
            <span>{index + 1}</span>
            <div>
              <strong>{title}</strong>
              <p>{body}</p>
            </div>
          </div>
        ))}
      </div>
      {children}
      <p className="annotation-foot">
        목업 데이터와 실제 연동 기능은 구분되어 있으며, 화면 내부에는 이 설명이
        표시되지 않습니다.
      </p>
    </aside>
  );
}
