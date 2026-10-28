import { useEffect, useState } from "react";
import { isMockData } from "../auth/supabaseClient";
import {
  AppIcon,
  BottomNavigation,
  ScreenAnnotation,
  ScreenHeader,
  type MainTab,
} from "../profile/AppShell";
import { reasonLabels, type PointLedgerRecord } from "./mockPoints";
import { getMyPoints, getPointHistory, type PointSummary } from "./rewardService";
import "./rewards.css";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
  }).format(new Date(value));

export default function RewardsScreen({
  onTab,
}: {
  onTab: (tab: MainTab) => void;
}) {
  const [points, setPoints] = useState<PointSummary | null>(null);
  const [history, setHistory] = useState<PointLedgerRecord[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([getMyPoints(), getPointHistory()])
      .then(([summary, entries]) => {
        setPoints(summary);
        setHistory(entries);
      })
      .catch((caught: Error) => setError(caught.message));
  }, []);

  const today = points?.todayEarned ?? 0;
  const limit = points?.dailyLimit ?? 10;
  const goalReached = today >= limit;
  const percentage = Math.min((today / limit) * 100, 100);

  return (
    <div className="feature-pair">
      <section className="phone-frame" aria-label="UI-09 리워드 포인트 모바일 화면">
        <div className="feature-screen">
          <ScreenHeader title="내 리워드" />
          <div className="feature-body">
            <div className="reward-summary">
              <span>현재 보유 포인트{isMockData ? " · 예시" : ""}</span>
              <strong>{points ? `${points.balance.toLocaleString()} P` : "…"}</strong>
              <div className="today-progress">
                <div>
                  <span>오늘 적립</span>
                  <b>{today}/{limit}P</b>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${percentage}%` }} />
                </div>
                <p>
                  {goalReached
                    ? "오늘은 모두 받았어요"
                    : `오늘 ${limit - today}P 더 받을 수 있어요`}
                </p>
              </div>
            </div>
            {error && <p className="inline-error">{error}</p>}
            <div className="demo-notice reward-policy">
              오류 신고가 반영되면 3P가 적립돼요. 하루(한국 시간)에 최대
              {` ${limit}P`}까지 받을 수 있어요.
              {isMockData && " 지금은 Supabase 키가 없어 예시 내역을 보여줘요."}
            </div>
            <div className="section-heading">
              <strong>적립 내역</strong>
              <span>{history.length}건</span>
            </div>
            <div className="point-history">
              {history.length === 0 && !error && points && (
                <p className="point-empty">아직 적립 내역이 없어요. 장소 정보 오류를 신고해 보세요.</p>
              )}
              {history.map((entry) => (
                <div key={entry.id}>
                  <span className="point-plus">
                    <AppIcon name="gift" size={17} />
                  </span>
                  <div>
                    <strong>{reasonLabels[entry.reason] ?? entry.reason}</strong>
                    <small>{formatDate(entry.created_at)}</small>
                  </div>
                  <b className="positive">+{entry.amount}P</b>
                </div>
              ))}
            </div>
            <div className="point-guide">
              <strong>포인트 이용 안내</strong>
              <p>
                현금화, 지역화폐 전환, 상품 구매, 랭킹 기능은 제공하지 않습니다.
                흡연 행위 자체에는 포인트를 주지 않습니다.
              </p>
            </div>
          </div>
          <BottomNavigation active="rewards" onSelect={onTab} />
        </div>
      </section>
      <ScreenAnnotation
        screen="UI-09 리워드·포인트"
        path="하단 리워드, 마이페이지 내 리워드"
        elements="보유 포인트, 오늘 진행 상태, 적립 내역, 이용 안내"
        data="get_my_point_summary(), point_ledger.amount, reason, ref_id, created_at"
        action="내역 확인, 하단 메뉴 이동"
        link="getMyPoints(), getPointHistory(), UI-10 마이페이지"
      />
    </div>
  );
}
