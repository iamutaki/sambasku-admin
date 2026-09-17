/**
 * Setup Vitest (environment: node).
 *
 * Tes unit `shared/auth/session.ts` memakai `sessionStorage` untuk cache
 * identitas non-sensitif. Di environment node objek itu tidak ada — beri
 * polyfill in-memory minimal supaya perilaku caching bisa diuji.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

globalThis.sessionStorage = new MemoryStorage();