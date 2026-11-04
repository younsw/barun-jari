import type { AppUser, AuthService, PendingAdultRequest } from "./types";

/**
 * 가짜 로그인. Supabase 키가 없을 때 브라우저 localStorage에만 저장한다.
 * 비밀번호는 SHA-256 해시로만 남긴다. 실제 서비스에서는 쓰지 않는다.
 *
 * 관리자 승인 흐름을 시험할 수 있도록 이 브라우저에서 처음 가입한 계정을 관리자(승인 완료)로 만든다.
 * 이후 가입한 계정은 승인 대기 상태가 되고, 관리자 계정으로 로그인해 마이페이지에서 승인한다.
 */
const USERS_KEY = "barunjari.mockAuth.users";
const SESSION_KEY = "barunjari.mockAuth.session";

type StoredUser = AppUser & { passwordHash: string; declaredBirthYear: number | null; requestedAt: string | null };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 새로고침 시 로그아웃된다.
  }
}

async function hash(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 예전 형식으로 저장된 가짜 회원도 읽을 수 있게 빈 필드를 채운다. */
function normalize(user: Partial<StoredUser> & { id: string; email: string; passwordHash: string }): StoredUser {
  const isAdultVerified = user.isAdultVerified === true;
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname ?? "",
    isAdultVerified,
    adultStatus: user.adultStatus ?? (isAdultVerified ? "approved" : "none"),
    adultRejectReason: user.adultRejectReason ?? null,
    verifiedAt: user.verifiedAt ?? null,
    isAdmin: user.isAdmin === true,
    createdAt: user.createdAt ?? new Date().toISOString(),
    passwordHash: user.passwordHash,
    declaredBirthYear: user.declaredBirthYear ?? null,
    requestedAt: user.requestedAt ?? null,
  };
}

function strip({ passwordHash: _passwordHash, declaredBirthYear: _year, requestedAt: _requestedAt, ...user }: StoredUser): AppUser {
  return user;
}

export function createMockAuthService(): AuthService {
  const listeners = new Set<(event?: string) => void>();
  let memoryUsers = read<StoredUser[]>(USERS_KEY, []).map(normalize);
  let memorySession = read<string | null>(SESSION_KEY, null);

  const notify = () => listeners.forEach((fn) => fn());
  const saveUsers = (users: StoredUser[]) => { memoryUsers = users; write(USERS_KEY, users); };
  const saveSession = (id: string | null) => { memorySession = id; write(SESSION_KEY, id); notify(); };
  const findCurrent = () => memoryUsers.find((user) => user.id === memorySession) ?? null;
  const replace = (updated: StoredUser) => saveUsers(memoryUsers.map((user) => (user.id === updated.id ? updated : user)));
  const requireAdmin = () => {
    const current = findCurrent();
    if (!current?.isAdmin) throw new Error("관리자만 처리할 수 있어요.");
    return current;
  };

  return {
    async getCurrentUser() {
      const user = findCurrent();
      return user ? strip(user) : null;
    },

    async signUp({ email, password, nickname, verification }) {
      const normalized = email.trim().toLowerCase();
      if (memoryUsers.some((user) => user.email === normalized)) throw new Error("이미 가입된 이메일이에요.");
      const now = new Date().toISOString();
      const firstUser = memoryUsers.length === 0;
      const user: StoredUser = {
        id: crypto.randomUUID(),
        email: normalized,
        nickname,
        isAdultVerified: firstUser,
        adultStatus: firstUser ? "approved" : "pending",
        adultRejectReason: null,
        verifiedAt: firstUser ? now : null,
        isAdmin: firstUser,
        createdAt: now,
        passwordHash: await hash(password),
        declaredBirthYear: firstUser ? null : verification.declaredBirthYear ?? null,
        requestedAt: firstUser ? null : now,
      };
      saveUsers([...memoryUsers, user]);
      saveSession(user.id);
      return strip(user);
    },

    async signIn({ email, password }) {
      const user = memoryUsers.find((item) => item.email === email.trim().toLowerCase());
      if (!user || user.passwordHash !== (await hash(password))) throw new Error("이메일 또는 비밀번호가 맞지 않아요.");
      saveSession(user.id);
      return strip(user);
    },

    async signOut() {
      saveSession(null);
    },

    async requestAdultVerification(verification) {
      const current = findCurrent();
      if (!current) throw new Error("로그인이 필요해요.");
      if (current.adultStatus === "approved") return strip(current);
      const updated: StoredUser = {
        ...current,
        adultStatus: "pending",
        adultRejectReason: null,
        declaredBirthYear: verification.declaredBirthYear ?? null,
        requestedAt: new Date().toISOString(),
      };
      replace(updated);
      notify();
      return strip(updated);
    },

    // 예시 모드: 메일 대신 바로 재설정 화면으로 보낸다 (가입된 이메일일 때만)
    async requestPasswordReset(email) {
      const user = memoryUsers.find((item) => item.email === email.trim().toLowerCase());
      if (!user) return;
      memorySession = user.id;
      write(SESSION_KEY, user.id);
      listeners.forEach((fn) => fn("PASSWORD_RECOVERY"));
    },

    async updatePassword(password) {
      const current = findCurrent();
      if (!current) throw new Error("로그인이 필요해요.");
      const updated = { ...current, passwordHash: await hash(password) };
      saveUsers(memoryUsers.map((user) => (user.id === updated.id ? updated : user)));
    },

    async deleteAccount() {
      const current = findCurrent();
      if (!current) throw new Error("로그인이 필요해요.");
      saveUsers(memoryUsers.filter((user) => user.id !== current.id));
      saveSession(null);
    },

    async listPendingAdultRequests() {
      requireAdmin();
      return memoryUsers
        .filter((user) => user.adultStatus === "pending")
        .sort((a, b) => (a.requestedAt ?? "").localeCompare(b.requestedAt ?? ""))
        .map((user): PendingAdultRequest => ({
          userId: user.id,
          nickname: user.nickname,
          email: user.email,
          declaredBirthYear: user.declaredBirthYear,
          requestedAt: user.requestedAt,
          joinedAt: user.createdAt,
        }));
    },

    async reviewAdultRequest(userId, approve, reason) {
      requireAdmin();
      const target = memoryUsers.find((user) => user.id === userId);
      if (!target) throw new Error("회원을 찾을 수 없어요.");
      if (target.adultStatus !== "pending") throw new Error("승인 대기 중인 요청이 아니에요.");
      replace({
        ...target,
        adultStatus: approve ? "approved" : "rejected",
        isAdultVerified: approve,
        verifiedAt: approve ? new Date().toISOString() : null,
        adultRejectReason: approve ? null : reason?.trim().slice(0, 200) || null,
        declaredBirthYear: null,
      });
      notify();
    },

    onAuthChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
}
