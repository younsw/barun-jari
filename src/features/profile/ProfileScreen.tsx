import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { isMockData } from "../auth/supabaseClient";
import { getMyPoints } from "../rewards/rewardService";
import {
  AppIcon,
  BottomNavigation,
  ScreenAnnotation,
  ScreenHeader,
  type MainTab,
} from "./AppShell";
import "./profile.css";

// 앱 전체가 RequireAdult 안에 있으므로 이 화면은 항상 로그인·성인 인증을 마친 회원이 본다.
export default function ProfileScreen({ onTab }: { onTab: (tab: MainTab) => void }) {
  const { user, isAdultVerified, signOut } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    getMyPoints().then((points) => setBalance(points.balance)).catch(() => setBalance(null));
  }, []);

  return (
    <div className="feature-pair">
      <section className="phone-frame" aria-label="UI-10 마이페이지 모바일 화면">
        <div className="feature-screen">
          <ScreenHeader title="마이페이지" />
          <div className="feature-body">
            <div className="profile-card">
              <span className="profile-avatar">
                <AppIcon name="person" size={25} />
              </span>
              <div>
                <small>{user?.email}</small>
                <strong>{user?.nickname}</strong>
              </div>
            </div>
            <div className="profile-stats">
              <button disabled>
                <span>성인인증</span>
                <strong>{isAdultVerified ? "완료" : "미완료"}</strong>
              </button>
              <button onClick={() => onTab("rewards")}>
                <span>현재 포인트</span>
                <strong>{balance === null ? "-" : `${balance} P`}</strong>
              </button>
            </div>
            <div className="profile-menu">
              <button onClick={() => onTab("reports")}>
                <AppIcon name="document" />
                <span>
                  <strong>내 신고 내역</strong>
                  <small>제출한 시설 정보 신고 확인</small>
                </span>
                <b>›</b>
              </button>
              <button onClick={() => onTab("rewards")}>
                <AppIcon name="gift" />
                <span>
                  <strong>내 리워드</strong>
                  <small>포인트와 적립 내역 확인</small>
                </span>
                <b>›</b>
              </button>
              <button disabled>
                <AppIcon name="shield" />
                <span>
                  <strong>계정 정보</strong>
                  <small>
                    {isAdultVerified && user?.verifiedAt
                      ? `성인인증 완료 · ${new Date(user.verifiedAt).toLocaleDateString("ko-KR")}`
                      : "성인인증 상태 확인"}
                  </small>
                </span>
                <b>›</b>
              </button>
            </div>
            <div className="service-guide">
              <strong>서비스 이용 안내</strong>
              <p>
                {isMockData
                  ? "Supabase 키가 없어 예시 데이터로 동작 중입니다. "
                  : "공공데이터(서울 중랑구 흡연시설 현황)를 기반으로 합니다. "}
                방문 전 현장 정보를 다시 확인해 주세요.
              </p>
            </div>
            <button className="logout-button" onClick={() => void signOut()}>
              로그아웃
            </button>
          </div>
          <BottomNavigation active="profile" onSelect={onTab} />
        </div>
      </section>
      <ScreenAnnotation
        screen="UI-10 마이페이지"
        path="하단 마이페이지"
        elements="닉네임, 인증 상태, 포인트, 신고·리워드·계정 메뉴, 로그아웃"
        data="users.nickname, is_adult_verified, verified_at 및 get_my_point_summary()"
        action="인증 상태 확인, 신고·리워드 이동, 로그아웃"
        link="useAuth(), getMyPoints(), UI-07·09"
      />
    </div>
  );
}
