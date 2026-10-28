import type { AppUser, AuthService } from "./types";

/**
 * 가짜 로그인. Supabase 키가 없을 때 브라우저 localStorage에만 저장한다.
 * 비밀번호는 SHA-256 해시로만 남긴다. 실제 서비스에서는 쓰지 않는다.
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

export function createMockAuthService(): AuthService {
  const listeners = new Set<() => void>();
  let memoryUsers = read<StoredUser[]>(USERS_KEY, []);
  let memorySession = read<string | null>(SESSION_KEY, null);

  const saveUsers = (users: StoredUser[]) => { memoryUsers = users; write(USERS_KEY, users); };
  const saveSession = (id: string | null) => { memorySession = id; write(SESSION_KEY, id); listeners.forEach((fn) => fn()); };
  const findCurrent = () => memoryUsers.find((user) => user.id === memorySession) ?? null;

  return {
    async getCurrentUser() {
      const user = findCurrent();
      return user ? strip(user) : null;
    },

    async signUp({ email, password, nickname, verification }) {
      const normalized = email.trim().toLowerCase();
      if (memoryUsers.some((user) => user.email === normalized)) throw new Error("이미 가입된 이메일이에요.");
      const user: StoredUser = {
        id: crypto.randomUUID(),
        email: normalized,
        nickname,
        isAdultVerified: true,
        verifiedAt: verification.verifiedAt,
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

    async saveAdultVerification(verification) {
      const current = findCurrent();
      if (!current) throw new Error("로그인이 필요해요.");
      const updated = { ...current, isAdultVerified: true, verifiedAt: verification.verifiedAt };
      saveUsers(memoryUsers.map((user) => (user.id === updated.id ? updated : user)));
      listeners.forEach((fn) => fn());
      return strip(updated);
    },

    onAuthChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
}
