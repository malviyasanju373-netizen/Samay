export function formatMinutesToHoursMinutes(totalMinutes: number): string {
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }
  return `${totalMinutes}m`;
}

export function formatLastActive(timestampMs: number): string {
  const now = Date.now();
  const diffMs = now - timestampMs;
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const hours = Math.floor(diffMins / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function isCurrentlyStudying(activeSessionStartedAtMs?: number): boolean {
  if (!activeSessionStartedAtMs) return false;
  const now = Date.now();
  const diffMins = (now - activeSessionStartedAtMs) / 60000;
  // Consider studying if session started less than 6 hours ago
  return diffMins < 360;
}
