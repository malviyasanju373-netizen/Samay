import { useEffect, useState } from "react";
import {
  getTodayDateKey,
  subscribeToAttendanceForDate,
  subscribeToAttendanceDates,
  getGroupAttendanceSummary,
} from "@/services/attendance";

type AttendanceRecord = {
  uid: string;
  displayName: string;
  focusMinutes: number;
  present: boolean;
};

type AttendanceSummary = Record<
  string,
  { presentDays: number; totalDays: number; percentage: number }
>;

/**
 * Hook to subscribe to today's attendance for a group.
 * Provides real-time updates.
 */
export function useTodayAttendance(groupId: string | null) {
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setTodayRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const dateKey = getTodayDateKey();

    const unsubscribe = subscribeToAttendanceForDate(
      groupId,
      dateKey,
      (records) => {
        setTodayRecords(records);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [groupId]);

  return { todayRecords, loading };
}

/**
 * Hook to subscribe to attendance summaries for all members.
 * Returns member-wise present days, total days, and percentage.
 */
export function useAttendanceSummary(groupId: string | null) {
  const [summary, setSummary] = useState<AttendanceSummary>({});













  const [totalDays, setTotalDays] = useState(0);
  const [loading, setLoading] = useState(true);

  // Listen for new attendance dates being created
  useEffect(() => {
    if (!groupId) {
      setSummary({});
      setTotalDays(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribeDates = subscribeToAttendanceDates(
      groupId,
      async (dateKeys) => {
        setTotalDays(dateKeys.length);

        if (dateKeys.length === 0) {
          setSummary({});
          setLoading(false);
          return;
        }

        try {
          const summaryData = await getGroupAttendanceSummary(groupId);
          setSummary(summaryData);
        } catch {
          console.error("[useAttendanceSummary] Failed to get summary");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
      }
    );

    return () => {
      unsubscribeDates();
    };
  }, [groupId]);

  return { summary, totalDays, loading };
}

/**
 * Calculate group average attendance percentage.
 */
export function useGroupAverageAttendance(groupId: string | null): number {
  const { summary, loading } = useAttendanceSummary(groupId);

  if (loading || Object.keys(summary).length === 0) return 0;

  const uids = Object.keys(summary);
  const totalPercentage = uids.reduce((sum, uid) => sum + summary[uid].percentage, 0);
  return Math.round(totalPercentage / uids.length);
}