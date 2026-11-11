/**
 * React 시작점. 로그인 상태(AuthProvider)로 App을 감싸고 전역 CSS를 불러온다.
 * 만든 날: 2026-10-28 · 마지막 수정: 2026-11-11
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './features/auth'
import './index.css'
import './responsive.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
