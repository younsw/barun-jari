/**
 * 여러 화면이 같이 쓰는 틀: 아이콘, 상단 헤더(뒤로가기), 하단 메뉴(지도·인증하기·리워드·마이페이지).
 * 만든 날: 2026-10-28 · 마지막 수정: 2026-11-11
 */
import type { ReactNode } from "react";

// "reports"(내 신고 내역)는 하단 메뉴에서 빠지고 마이페이지에서 들어간다
export type MainTab = "map" | "checkin" | "reports" | "rewards" | "profile";

/** AppIcon에서 쓸 수 있는 아이콘 이름 (만든 날: 2026-10-28) */
type IconName =
  | "back"
  | "check"
  | "document"
  | "gift"
  | "map"
  | "person"
  | "shield"
  | "upload";

/** 공통 SVG 아이콘 (만든 날: 2026-10-28) */
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

/** 화면 위 제목 줄 (뒤로가기 버튼 선택) (만든 날: 2026-10-28) */
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

/** 하단 메뉴. 누르면 onSelect로 탭 이름을 넘긴다 (만든 날: 2026-10-28) */
export function BottomNavigation({
  active,
  onSelect,
}: {
  active: MainTab;
  onSelect: (tab: MainTab) => void;
}) {
  const items: Array<[MainTab, IconName, string]> = [
    ["map", "map", "지도"],
    ["checkin", "check", "인증하기"],
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
