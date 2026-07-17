export interface RecentTime {
  time: string; // "HH:mm"
  usedAt: string; // ISO timestamp
}

const RECENT_STORAGE_KEY = "recent-departure-times";
const MAX_RECENT_TIMES = 8;

export function loadRecentTimes(): RecentTime[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordRecentTime(time: string): RecentTime[] {
  const now = new Date().toISOString();
  const prev = loadRecentTimes();
  const filtered = prev.filter((r) => r.time !== time);
  const updated = [{ time, usedAt: now }, ...filtered].slice(0, MAX_RECENT_TIMES);
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
