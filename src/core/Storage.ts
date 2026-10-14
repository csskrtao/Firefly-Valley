const PREFIX = 'firefly-valley';
export const SLOT_COUNT = 3;

/** localStorage 的安全封装：隐私模式或被禁用时读写都不会抛错。 */
export const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(`${PREFIX}:${key}`);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(`${PREFIX}:${key}`);
    } catch {
      /* 忽略 */
    }
  },
};

export const slotKey = (slot: number): string => `slot${slot}`;
