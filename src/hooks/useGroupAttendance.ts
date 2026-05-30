import { useEffect, useState, useCallback } from "react";
import {
  getTodayDateKey,
  getCurrentWeekDateKeys,
  subscribeToAttendanceForDate,
  subscribeToWeeklyAttendance,
  getGroupAttendanceSummary,
} from "@/services/attendance";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type AttendanceRecord = {
  uid: string;
  displayName: string;
  focusMinutes: number;
  present: boolean;
};

export type WeeklyAttendance = Record<
  string,
  Record<string, { present: boolean; focusMinutes: number; displayName: string }>
>;

export type RankedMember = {
  uid: string;
  displayName: string;
  attendancePercentage: number;
  presentDays: number;
  totalDays: number;
  totalFocusMinutes: number;
};

export type GroupAttendanceData = {
  /** Number of members present today */
  todayPresent: number;
  /** Total number of members with attendance data today */
  totalMembers: number;
  /** Overall group attendance percentage (average of all members) */
  attendancePercentage: number;
  /** Weekly grid data: { dateKey: { uid: { present, focusMinutes, displayName } } } */
  weeklyAttendance: WeeklyAttendance;
  /** Members ranked by attendance percentage descending */
  rankedMembers: RankedMember[];
  /** All unique date keys tracked */
  totalTrackedDays: number;
  /** Loading state */
  loading: boolean;
};

// ─────────────────────────────────────────────────────────────
// Hook: useGroupAttendance
// ─────────────────────────────────────────────────────────────

/**
 * Advanced Group Attendance hook.
 * Provides real-time today's attendance, overall %, member ranking, and weekly grid.
 *
 * Firestore path: groups/{groupId}/attendance/{dateKey}/members/{uid}
 *
 * Returns: { todayPresent, totalMembers, attendancePercentage, weeklyAttendance, rankedMembers, totalTrackedDays, loading }
 */
export function useGroupAttendance(groupId: string | null): GroupAttendanceData {
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyAttendance>({});
  const [summary, setSummary] = useState<
    Record<string, { presentDays: number; totalDays: number; percentage: number; totalFocusMinutes: number }>
  >({});
  const [totalDays, setTotalDays] = useState(0);
  const [loading, setLoading] = useState(true);

  // ── Subscribe to today's attendance (real-time) ──
  useEffect(() => {
    if (!groupId) {
      setTodayRecords([]);
      return;
    }

    const dateKey = getTodayDateKey();
    const unsub = subscribeToAttendanceForDate(
      groupId,
      dateKey,
      (records) => {
        setTodayRecords(records);
      },
      () => {
        /* error handled silently */
      }
    );

    return () => unsub();
  }, [groupId]);

  // ── Subscribe to weekly attendance (real-time, last 7 days) ──
  useEffect(() => {
    if (!groupId) {
      setWeeklyData({});
      return;
    }

    const weekKeys = getCurrentWeekDateKeys();
    const unsub = subscribeToWeeklyAttendance(
      groupId,
      weekKeys,
      (data) => {
        setWeeklyData(data);
      },
      () => {
        /* error handled silently */
      }
    );

    return () => unsub();
  }, [groupId]);

  // ── Load summary for ranking (async, updates when dates change) ──
  useEffect(() => {
    if (!groupId) {
      setSummary({});
      setTotalDays(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    let mounted = true;

    const load = async () => {
      try {
        const [summaryData] = await Promise.all([
          getGroupAttendanceSummary(groupId),
        ]);

        if (!mounted) return;

        const uids = Object.keys(summaryData);
        setTotalDays(uids.length > 0 ? summaryData[uids[0]]?.totalDays ?? 0 : 0);
        setSummary(summaryData);
      } catch (err) {
        console.error("[useGroupAttendance] Failed to load summary:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [groupId]);

  // ── Derived: today's counts ──
  const todayPresent = todayRecords.filter((r) => r.present).length;
  const totalMembers = todayRecords.length;

  // ── Derived: overall attendance percentage ──
  const summaryUids = Object.keys(summary);
  const attendancePercentage =
    summaryUids.length > 0
      ? Math.round(
          summaryUids.reduce((sum, uid) => sum + summary[uid].percentage, 0) /
            summaryUids.length
        )
      : 0;

  // ── Derived: ranked members ──
  const rankedMembers: RankedMember[] = summaryUids
    .map((uid) => ({
      uid,
      displayName: "User",
    }))
    .map((member) => {
      // Try to get displayName from weeklyData as fallback
      let displayName = member.displayName;
      for (const dateKey of Object.keys(weeklyData)) {
        const dayData = weeklyData[dateKey][member.uid];
        if (dayData?.displayName) {
          displayName = dayData.displayName;
          break;
        }
      }
      // Also check todayRecords
      const todayRecord = todayRecords.find((r) => r.uid === member.uid);
      if (todayRecord) {
        displayName = todayRecord.displayName;
      }

      const s = summary[member.uid];
      return {
        uid: member.uid,
        displayName,
        attendancePercentage: s.percentage,
        presentDays: s.presentDays,
        totalDays: s.totalDays,
        totalFocusMinutes: s.totalFocusMinutes,
      };
    })
    .sort((a, b) => b.attendancePercentage - a.attendancePercentage);

  return {
    todayPresent,
    totalMembers,
    attendancePercentage,
    weeklyAttendance: weeklyData,
    rankedMembers,
    totalTrackedDays: totalDays,
    loading,
  };
}
