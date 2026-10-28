import { useState, type ReactNode } from "react";
import { LoginScreen } from "./LoginScreen";
import { SignUpScreen } from "./SignUpScreen";
import { isMockAuth } from "./authService";
import "./auth.css";

/** 모바일 프레임 + 바른자리 헤더. 인증 관련 화면 공통 틀 */
export function AuthFrame({ title, description, children, onBack }: { title: string; description: string; children: ReactNode; onBack?: () => void }) {
  return <section className="phone-frame" aria-label={`${title} 모바일 화면`}>
    <div className="phone-content auth-screen">
      <header className="service-header">
        <div className="brand"><span className="brand-mark">B</span>바른자리</div>
        <div className="hero-title">{title}</div>
        <p>{description}</p>
      </header>
      {children}
      {onBack && <button className="auth-text-button" onClick={onBack}>이전 화면으로 돌아가기</button>}
      {isMockAuth && <p className="auth-mock-note">Supabase 키가 없어 테스트용 가짜 로그인으로 동작 중이에요.</p>}
    </div>
  </section>;
}

export function AuthScreen({ initialMode = "login", onBack }: { initialMode?: "login" | "signup"; onBack?: () => void }) {
  const [mode, setMode] = useState(initialMode);
  const [message, setMessage] = useState("");

  return <AuthFrame
    title={mode === "login" ? "다시 오셨네요" : "바른자리 가입하기"}
    description={mode === "login" ? "로그인하고 내 주변 흡연구역을 확인하세요." : "성인 인증을 마친 분만 가입할 수 있어요."}
    onBack={onBack}
  >
    <div className="auth-tabs" role="tablist">
      <button role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>로그인</button>
      <button role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>회원가입</button>
    </div>
    {message && <p className="auth-success" role="status">{message}</p>}
    {mode === "login"
      ? <LoginScreen />
      : <SignUpScreen onDone={(text) => { setMessage(text); setMode("login"); }} />}
  </AuthFrame>;
}
