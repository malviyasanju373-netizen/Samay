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

/**
 * Convert any timestamp (Firestore Timestamp, Date, number, null) to milliseconds.
 * Returns NaN if conversion fails.
 */
function toMillis(value: any): number {
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  return NaN;
}

/**
 * Format a message timestamp for chat bubbles.
 *
 * Today:        "10:42 PM"
 * Yesterday:    "Yesterday 8:15 PM"
 * Older:        "18 Jun, 10:42 PM"
 *
 * @param timestamp - Firestore Timestamp, Date, number (ms), or null/undefined
 * @returns Formatted time string, or empty string on failure.
 */
export function formatMessageTimestamp(timestamp: any): string {
  try {
    const ms = toMillis(timestamp);
    if (!Number.isFinite(ms)) return '';

    const date = new Date(ms);
    const now = new Date();

    const timeStr = date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    // Compare dates using local date strings to avoid timezone offsets
    const dateStr = date.toLocaleDateString();
    const todayStr = now.toLocaleDateString();

    if (dateStr === todayStr) {
      // Today: show time only
      return timeStr;
    }

    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString();

    if (dateStr === yesterdayStr) {
      return `Yesterday ${timeStr}`;
    }

    // Older: show "18 Jun, 10:42 PM"
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });
    return `${day} ${month}, ${timeStr}`;
  } catch {
    return '';
  }
}