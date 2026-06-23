import { useState, useEffect, useMemo } from "react";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { requireFirestore } from "@/firebase";
import { useTodos } from "@/hooks/useTodos";
import type { CalendarDay } from "@/types/calendar";
import type { FocusSession } from "@/types/session";
import type { Todo } from "@/types/todo";

type CalendarState = {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  monthData: CalendarDay[];
  selectedDayData: CalendarDay | null;
  selectedDaySessions: FocusSession[];
  selectedDayCompletedTodos: Todo[];
  sessions: FocusSession[];
  loading: boolean;
};

function getDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonthBoundary(year: number, month: number) {
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthDates(year: number, month: number): string[] {
  const days: string[] = [];
  const total = getDaysInMonth(year, month);
  for (let d = 1; d <= total; d++) {
    days.push(getDateKey(new Date(year, month, d)));
  }
  return days;
}

/**
 * Hook that builds calendar day summaries from existing sessions, attendance, and todos.
 *
 * Firestore queries used (one-time reads per month change):
 * 1. sessions collection: where uid == currentUser, isCompleted == true, startTime in [monthStart, monthEnd]
 * 2. groups collection: where "members/{uid}" exists (simplified: query all groups user created or is member of)
 * 3. For each group, attendance subcollection for month date keys
 *
 * Uses existing useTodos subscription for todos data.
 */
export function useCalendarData(): CalendarState {
  const uid = auth().currentUser?.uid ?? null;
  const { todos } = useTodos();

  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<string>(getDateKey(today));
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [attendanceDates, setAttendanceDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Determine the month to display from the selected date
  const selectedDateObj = new Date(selectedDate + "T00:00:00");
  const displayYear = selectedDateObj.getFullYear();
  const displayMonth = selectedDateObj.getMonth();

  // Fetch sessions for the display month
  useEffect(() => {
    if (!uid) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const { start, end } = getMonthBoundary(displayYear, displayMonth);
    const startTimestamp = firestore.Timestamp.fromDate(start);
    const endTimestamp = firestore.Timestamp.fromDate(end);

    setLoading(true);

    const fetchSessions = async () => {
      try {
        const snap = await requireFirestore()
          .collection("sessions")
          .where("uid", "==", uid)
          .where("isCompleted", "==", true)
          .where("startTime", ">=", startTimestamp)
          .where("startTime", "<=", endTimestamp)
          .get();

        const result = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as FocusSession)
        );
        setSessions(result);
      } catch (err) {
        console.error("[useCalendarData] Failed to fetch sessions:", err);
        setSessions([]);
      }
    };

    void fetchSessions();
  }, [uid, displayYear, displayMonth]);

  // Fetch attendance dates for the display month
  useEffect(() => {
    if (!uid) {
      setAttendanceDates(new Set());
      return;
    }

    const fetchAttendance = async () => {
      try {
        // Find groups where user is a member
        const groupsSnap = await requireFirestore()
          .collection("groups")
          .where("createdBy", "==", uid)
          .get();

        const groupIds = groupsSnap.docs.map((d) => d.id);

        // Also check groups where user might be a member via subcollection
        // For a complete approach we'd need an index, but for MVP we check created groups
        const attDates = new Set<string>();
        const monthDateKeys = getMonthDates(displayYear, displayMonth);

        for (const groupId of groupIds) {
          for (const dateKey of monthDateKeys) {
            const memberSnap = await requireFirestore()
              .collection("groups")
              .doc(groupId)
              .collection("attendance")
              .doc(dateKey)
              .collection("members")
              .doc(uid)
              .get();

            if ((typeof memberSnap.exists === "function" ? memberSnap.exists() : memberSnap.exists) && memberSnap.data()?.present === true) {
              attDates.add(dateKey);
            }
          }
        }

        setAttendanceDates(attDates);
      } catch (err) {
        console.error("[useCalendarData] Failed to fetch attendance:", err);
        setAttendanceDates(new Set());
      } finally {
        setLoading(false);
      }
    };

    void fetchAttendance();
  }, [uid, displayYear, displayMonth]);

  // Build monthData
  const monthData = useMemo<CalendarDay[]>(() => {
    const monthDateKeys = getMonthDates(displayYear, displayMonth);
    const sessionMap = new Map<string, FocusSession[]>();

    for (const session of sessions) {
      const ts =
        typeof (session.startTime as any)?.toDate === "function"
          ? (session.startTime as any).toDate()
          : new Date();
      const key = getDateKey(ts);
      if (!sessionMap.has(key)) {
        sessionMap.set(key, []);
      }
      sessionMap.get(key)!.push(session);
    }

    // Count completed todos per day
    const todosCompletedMap = new Map<string, number>();
    for (const todo of todos) {
      if (todo.completed && todo.completedAt) {
        const ts =
          typeof (todo.completedAt as any)?.toDate === "function"
            ? (todo.completedAt as any).toDate()
            : new Date();
        const key = getDateKey(ts);
        todosCompletedMap.set(key, (todosCompletedMap.get(key) ?? 0) + 1);
      }
    }

    return monthDateKeys.map((dateKey) => {
      const daySessions = sessionMap.get(dateKey) ?? [];
      const studyTimeSeconds = daySessions.reduce(
        (sum, s) =>
          sum + (s.durationSeconds ?? (s.durationMinutes ?? 0) * 60),
        0
      );

      return {
        dateString: dateKey,
        day: parseInt(dateKey.split("-")[2], 10),
        month: parseInt(dateKey.split("-")[1], 10),
        year: parseInt(dateKey.split("-")[0], 10),
        studyTimeSeconds,
        sessionCount: daySessions.length,
        todosCompleted: todosCompletedMap.get(dateKey) ?? 0,
        hasAttendance: attendanceDates.has(dateKey),
      };
    });
  }, [sessions, todos, attendanceDates, displayYear, displayMonth]);

  const selectedDayData = useMemo<CalendarDay | null>(() => {
    return monthData.find((d) => d.dateString === selectedDate) ?? null;
  }, [monthData, selectedDate]);

  // Derive sessions for the selected day from in-memory data (no new query)
  const selectedDaySessions = useMemo<FocusSession[]>(() => {
    return sessions.filter((s) => {
      const ts =
        typeof (s.startTime as any)?.toDate === "function"
          ? (s.startTime as any).toDate()
          : new Date();
      return getDateKey(ts) === selectedDate;
    });
  }, [sessions, selectedDate]);

  // Derive completed todos for the selected day from in-memory data (no new query)
  const selectedDayCompletedTodos = useMemo<Todo[]>(() => {
    return todos.filter((todo) => {
      if (!todo.completed || !todo.completedAt) return false;
      const ts =
        typeof (todo.completedAt as any)?.toDate === "function"
          ? (todo.completedAt as any).toDate()
          : new Date();
      return getDateKey(ts) === selectedDate;
    });
  }, [todos, selectedDate]);

  return {
    selectedDate,
    setSelectedDate,
    monthData,
    selectedDayData,
    selectedDaySessions,
    selectedDayCompletedTodos,
    sessions,
    loading,
  };
}
