let lastFetchAt = 0;
const listeners = new Set<() => void>();

export function subscribeTechCoinRefresh(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function triggerTechCoinRefresh(force = false) {
  const now = Date.now();
  if (!force && now - lastFetchAt < 1500) return;
  lastFetchAt = now;
  window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
  for (const listener of listeners) listener();
}
