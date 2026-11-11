import type { AppUser, AuthService, Member } from "./types";

/**
 * 가짜 로그인. Supabase 키가 없을 때 브라우저 localStorage에만 저장한다.
 * 비밀번호는 SHA-256 해시로만 남긴다. 실제 서비스에서는 쓰지 않는다.
 *
 * 관리자 기능을 시험할 수 있도록 이 브라우저에서 처음 가입한 계정을 관리자로 만든다.
 */
const USERS_KEY = "barunjari.mockAuth.users";
const SESSION_KEY = "barunjari.mockAuth.session";

type StoredUser = AppUser & { passwordHash: string };

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

function strip({ passwordHash: _passwordHash, ...user }: StoredUser): AppUser {
  return user;
}

/** 예전 형식(성인 인증 필드)으로 저장된 가짜 회원도 읽을 수 있게 맞춘다 */
function normalize(user: StoredUser & { isAdmin?: boolean }): StoredUser {
  return { id: user.id, email: user.email, nickname: user.nickname, isAdmin: user.isAdmin === true, createdAt: user.createdAt, passwordHash: user.passwordHash };
}

export function createMockAuthService(): AuthService {
  const listeners = new Set<(event?: string) => void>();
  let memoryUsers = read<StoredUser[]>(USERS_KEY, []).map(normalize);
  let memorySession = read<string | null>(SESSION_KEY, null);

  const saveUsers = (users: StoredUser[]) => { memoryUsers = users; write(USERS_KEY, users); };
  const saveSession = (id: string | null) => { memorySession = id; write(SESSION_KEY, id); listeners.forEach((fn) => fn()); };
  const findCurrent = () => memoryUsers.find((user) => user.id === memorySession) ?? null;
  const requireAdmin = () => {
    if (!findCurrent()?.isAdmin) throw new Error("관리자만 할 수 있어요.");
  };

  return {
    async getCurrentUser() {
      const user = findCurrent();
      return user ? strip(user) : null;
    },

    async signUp({ email, password, nickname }) {
      const normalized = email.trim().toLowerCase();
      if (memoryUsers.some((user) => user.email === normalized)) throw new Error("이미 가입된 이메일이에요.");
      const user: StoredUser = {
        id: crypto.randomUUID(),
        email: normalized,
        nickname,
        isAdmin: memoryUsers.length === 0,
        createdAt: new Date().toISOString(),
        passwordHash: await hash(password),
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

    async updateNickname(nickname) {
      const current = findCurrent();
      if (!current) throw new Error("로그인이 필요해요.");
      saveUsers(memoryUsers.map((user) => (user.id === current.id ? { ...user, nickname } : user)));
    },

    async deleteAccount() {
      const current = findCurrent();
      if (!current) throw new Error("로그인이 필요해요.");
      saveUsers(memoryUsers.filter((user) => user.id !== current.id));
      saveSession(null);
    },

    async listMembers() {
      requireAdmin();
      return memoryUsers.map((user): Member => ({
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        isAdmin: user.isAdmin,
        joinedAt: user.createdAt,
        points: 0,
      }));
    },

    async setMemberAdmin(userId, isAdmin) {
      requireAdmin();
      const target = memoryUsers.find((user) => user.id === userId);
      if (!target) throw new Error("회원을 찾을 수 없어요.");
      if (!isAdmin && target.isAdmin && memoryUsers.filter((user) => user.isAdmin).length <= 1) throw new Error("관리자가 최소 1명은 있어야 해요.");
      saveUsers(memoryUsers.map((user) => (user.id === userId ? { ...user, isAdmin } : user)));
      listeners.forEach((fn) => fn());
    },

    onAuthChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
}
