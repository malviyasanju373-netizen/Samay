export function formatMinutesToHoursMinutes(totalMinutes: number): string {
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }
  return `${totalMinutes}m`;
}

export function formatStudyTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${hours}h`;
  }

  if (minutes > 0) {
    if (secs > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${minutes}m`;
  }

  return `${secs}s`;
}

export function formatElapsedTime(elapsedSeconds: number): string {
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  
  const pad = (n: number) => String(n).padStart(2, "0");
  
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format elapsed seconds as compact time string: "2h 14m", "18m", "45s"
 */
export function formatLiveElapsedTime(elapsedSeconds: number): string {
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
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

export function minutesToSeconds(minutes: number): number {
  return (minutes || 0) * 60;
}
