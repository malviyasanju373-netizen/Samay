export type LeaderboardSortMetric =
  | "totalFocusSeconds"
  | "weeklyFocusSeconds"
  | "monthlyFocusSeconds"
  | "groupFocusSeconds"
  | "attendanceRate"
  | "currentStreak";

export interface BaseLeaderboardEntry {
  uid: string;
  totalFocusSeconds?: number;
  weeklyFocusSeconds?: number;
  monthlyFocusSeconds?: number;
  groupFocusSeconds?: number;
  attendanceRate?: number;
  currentStreak?: number;
  
  // Tie-breakers
  totalSessions?: number;
  joinedAtMs?: number;

  // Rank gets assigned
  rank?: number;
  
}

export type RankedLeaderboardEntry<T extends BaseLeaderboardEntry> = T & {
  rank: number;
};

export function removeDuplicates<T extends BaseLeaderboardEntry>(entries: T[]): T[] {
  const seen = new Set<string>();
  return entries.filter(entry => {
    if (seen.has(entry.uid)) {
      return false;
    }
    seen.add(entry.uid);
    return true;
  });
}

export function sortLeaderboard<T extends BaseLeaderboardEntry>(
  entries: T[],
  metricKey: LeaderboardSortMetric
): T[] {
  return [...entries].sort((a, b) => {
    const valA = a[metricKey] || 0;
    const valB = b[metricKey] || 0;

    // Sort descending by primary metric
    if (valA !== valB) {
      return valB - valA;
    }

    // Tie-break 1: Higher streak
    const streakA = a.currentStreak || 0;
    const streakB = b.currentStreak || 0;
    if (streakA !== streakB) {
      return streakB - streakA;
    }

    // Tie-break 2: More completed sessions
    const sessionsA = a.totalSessions || 0;
    const sessionsB = b.totalSessions || 0;
    if (sessionsA !== sessionsB) {
      return sessionsB - sessionsA;
    }

    // Tie-break 3: Earlier join date (smaller ms value)
    const joinA = a.joinedAtMs || Number.MAX_SAFE_INTEGER;
    const joinB = b.joinedAtMs || Number.MAX_SAFE_INTEGER;
    if (joinA !== joinB) {
      return joinA - joinB; // Ascending for date
    }

    return 0;
  });
}

export function calculateRankings<T extends BaseLeaderboardEntry>(
  entries: T[],
  metricKey: LeaderboardSortMetric
): RankedLeaderboardEntry<T>[] {
  const uniqueEntries = removeDuplicates(entries);
  const sorted = sortLeaderboard(uniqueEntries, metricKey);
  
  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

export function getRankLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export function getUserRank<T extends BaseLeaderboardEntry>(
  rankedEntries: T[],
  uid: string
): number | null {
  const entry = rankedEntries.find(e => e.uid === uid);
  return entry?.rank ?? null;
}

export function formatDuration(seconds: number): string {
  if (seconds < 0 || isNaN(seconds)) return "0s";
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    if (m > 0) return `${h}h ${m}m`;
    return `${h}h`;
  }
  if (m > 0) {
    if (s > 0) return `${m}m ${s}s`;
    return `${m}m`;
  }
  return `${s}s`;
}
