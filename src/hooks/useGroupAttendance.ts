import { useEffect, useState, useCallback } from "react";
import {
  getTodayDateKey,
  getCurrentWeekDateKeys,
  subscribeToAttendanceForDate,
  subscribeToWeeklyAttendance,
  getGroupAttendanceSummary,
} from "@/services/attendance";
import { subscribeToGroupMembers } from "@/services/groups";

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
  email?: string;
  username?: string;
  attendancePercentage: number;
  presentDays: number;
  totalDays: number;
  totalFocusMinutes: number;
};

type GroupMember = {
  uid: string;
  displayName: string;
  email?: string;
  name?: string;
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
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [totalDays, setTotalDays] = useState(0);
  const [groupMemberCount, setGroupMemberCount] = useState(0);
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
      setGroupMemberCount(0);
      setGroupMembers([]);
      return;
    }

    const unsubscribe = subscribeToGroupMembers(
      groupId,
      (members) => {
        const normalizedMembers = Array.isArray(members)
          ? members
              .map((member: any) => ({
                uid: member.uid ?? member.id ?? "",
                displayName: member.displayName ?? member.name ?? "User",
              }))
              .filter((member) => member.uid)
          : [];

        setGroupMembers(normalizedMembers);
        setGroupMemberCount(Array.isArray(members) ? members.length : 0);
      },
      () => {
        setGroupMemberCount(0);
        setGroupMembers([]);
      }
    );

    return () => unsubscribe();
  }, [groupId]);

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
  const totalMembers = groupMemberCount;

  // ── Derived: today's attendance percentage ──
  const summaryUids = Object.keys(summary);
  const attendancePercentage =
    totalMembers > 0
      ? Math.round((todayPresent / totalMembers) * 100)
      : 0;

  // ── Helper to enrich member with email and username ──
  const getMemberEmailAndUsername = (uid: string) => {
    const member = groupMembers.find((m) => m.uid === uid);
    return {
      email: member?.email,
      username: member?.name,
    };
  };

  // ── Derived: ranked members ──
  const fallbackChampionsUsed = summaryUids.length === 0 && todayRecords.length > 0;
  const rankedMembers: RankedMember[] = fallbackChampionsUsed
    ? groupMembers
        .map((member) => {
          const todayRecord = todayRecords.find((r) => r.uid === member.uid);
          const present = todayRecord?.present ?? false;

          return {
            uid: member.uid,
            displayName: todayRecord?.displayName ?? member.displayName,
            email: member.email,
            username: member.name,
            attendancePercentage: present ? 100 : 0,
            presentDays: present ? 1 : 0,
            totalDays: 1,
            totalFocusMinutes: todayRecord?.focusMinutes ?? 0,
          };
        })
        .sort((a, b) => b.attendancePercentage - a.attendancePercentage)
    : summaryUids
        .map((uid) => ({
          uid,
          displayName: "User",
        }))
        .map((member) => {
          let displayName = member.displayName;
          for (const dateKey of Object.keys(weeklyData)) {
            const dayData = weeklyData[dateKey][member.uid];
            if (dayData?.displayName) {
              displayName = dayData.displayName;
              break;
            }
          }
          const todayRecord = todayRecords.find((r) => r.uid === member.uid);
          if (todayRecord) {
            displayName = todayRecord.displayName;
          }

          const s = summary[member.uid];
          const { email, username } = getMemberEmailAndUsername(member.uid);
          return {
            uid: member.uid,
            displayName,
            email,
            username,
            attendancePercentage: s.percentage,
            presentDays: s.presentDays,
            totalDays: s.totalDays,
            totalFocusMinutes: s.totalFocusMinutes,
          };
        })
        .sort((a, b) => b.attendancePercentage - a.attendancePercentage);

  // ── Diagnostic logs ──
  console.log("[TODAY RECORDS]", todayRecords);
  console.log("[SUMMARY]", summary);
  console.log("[SUMMARY UIDS]", Object.keys(summary));
  console.log("[RANKED MEMBERS]", rankedMembers);
  console.log("[FALLBACK CHAMPIONS USED]", fallbackChampionsUsed);
  console.log("[FALLBACK MEMBERS COUNT]", fallbackChampionsUsed ? rankedMembers.length : 0);
  console.log("[TRACKED DAYS]", totalDays);
  console.log("[RANKED MEMBERS LENGTH]", rankedMembers.length);
  console.log("[SUMMARY UID COUNT]", Object.keys(summary).length);

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
