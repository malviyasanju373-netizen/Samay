import { useMemo } from "react";
import { useCalendarData } from "@/hooks/useCalendarData";

type StreakResult = {
  currentStreak: number;
  bestStreak: number;
};

function getDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function useStudyStreak(): StreakResult {
  const { sessions } = useCalendarData();

  return useMemo(() => {
    if (sessions.length === 0) {
      return { currentStreak: 0, bestStreak: 0 };
    }

    // Build set of dates that have study time > 0
    const studyDates = new Set<string>();
    for (const sess of sessions) {
      const ts = typeof (sess.startTime as any)?.toDate === "function"
        ? (sess.startTime as any).toDate()
        : new Date();
      const key = getDateKey(ts);
      const dur = sess.durationSeconds ?? (sess.durationMinutes ?? 0) * 60;
      if (dur > 0) {
        studyDates.add(key);
      }
    }

    if (studyDates.size === 0) {
      return { currentStreak: 0, bestStreak: 0 };
    }

    // Sort dates ascending
    const sortedDates = Array.from(studyDates).sort();

    // Calculate best streak (longest consecutive run)
    let bestStreak = 1;
    let currentRun = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1] + "T00:00:00");
      const curr = new Date(sortedDates[i] + "T00:00:00");
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diffDays === 1) {
        currentRun += 1;
        bestStreak = Math.max(bestStreak, currentRun);
      } else {
        currentRun = 1;
      }
    }

    // Calculate current streak (from today or yesterday backwards)
    const today = new Date();
    const todayKey = getDateKey(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = getDateKey(yesterday);

    let currentStreak = 0;
    let checkDate = new Date(today);

    // If today has no study, start checking from yesterday
    if (!studyDates.has(todayKey)) {
      checkDate = yesterday;
      if (!studyDates.has(yesterdayKey)) {
        // No study today or yesterday => streak is 0
        return { currentStreak: 0, bestStreak };
      }
    }

    // Count consecutive days backwards
    while (true) {
      const key = getDateKey(checkDate);
      if (studyDates.has(key)) {
        currentStreak += 1;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return { currentStreak, bestStreak };
  }, [sessions]);
}