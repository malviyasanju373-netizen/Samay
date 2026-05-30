import firestore from "@react-native-firebase/firestore";
import { requireFirestore } from "@/firebase";

/** Attendance Rule threshold in minutes */
const ATTENDANCE_THRESHOLD_MINUTES = 25;

/**
 * Get today's date key in yyyy-mm-dd format
 */
export function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get a date key for N days ago
 */
export function getDateKeyForDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get weekday index (0=Sun, 1=Mon ... 6=Sat)
 */
export function getWeekdayIndex(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/**
 * Get the date keys for the current week (Mon-Sun)
 */
export function getCurrentWeekDateKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  const dayOfWeek = now.getDay();
  // Monday offset: if Sunday (0), go back 6 days; else go back (dayOfWeek - 1)
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  for (let i = 0; i < 7; i++) {
    keys.push(getDateKeyForDaysAgo(mondayOffset - i));
  }
  return keys;
}

/**
 * Update attendance for a user in a group when a focus session completes.
 * If 25+ minutes, marks Present. Otherwise Absent.
 * Uses set with merge to be idempotent.
 *
 * Firestore path: groups/{groupId}/attendance/{dateKey}/members/{uid}
 */
export async function updateAttendance(
  groupId: string,
  uid: string,
  displayName: string,
  sessionMinutes: number
): Promise<void> {
  if (!groupId || !uid) {
    console.warn("[updateAttendance] Missing groupId or uid, skipping");
    return;
  }

  const dateKey = getTodayDateKey();
  const present = sessionMinutes >= ATTENDANCE_THRESHOLD_MINUTES;
  const totalMinutes = sessionMinutes;

  try {
    const db = requireFirestore();
    const memberAttendanceRef = db
      .collection("groups")
      .doc(groupId)
      .collection("attendance")
      .doc(dateKey)
      .collection("members")
      .doc(uid);

    // Use set with merge to accumulate minutes and update status
    await memberAttendanceRef.set(
      {
        uid,
        displayName: displayName || "User",
        focusMinutes: firestore.FieldValue.increment(totalMinutes),
        present,
        dateKey,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err: any) {
    console.error("[updateAttendance] ERROR:", err?.message);
  }
}

/**
 * Get present day count for a user in a group.
 */
export async function getUserPresentDays(
  groupId: string,
  uid: string
): Promise<number> {
  if (!groupId || !uid) return 0;

  try {
    const db = requireFirestore();
    const attendanceDates = await db
      .collection("groups")
      .doc(groupId)
      .collection("attendance")
      .get();

    let presentDays = 0;

    for (const dateDoc of attendanceDates.docs) {
      const memberSnap = await dateDoc.ref
        .collection("members")
        .doc(uid)
        .get();

      if (memberSnap.exists()) {
        const data = memberSnap.data();
        if (data?.present === true) {
          presentDays++;
        }
      }
    }

    return presentDays;
  } catch (err: any) {
    console.error("[getUserPresentDays] ERROR:", err?.message);
    return 0;
  }
}

/**
 * Get total unique attendance days for a group.
 */
export async function getGroupAttendanceDateCount(groupId: string): Promise<number> {
  if (!groupId) return 0;

  try {
    const db = requireFirestore();
    const snap = await db
      .collection("groups")
      .doc(groupId)
      .collection("attendance")
      .get();

    return snap.docs.length;
  } catch (err: any) {
    console.error("[getGroupAttendanceDateCount] ERROR:", err?.message);
    return 0;
  }
}

/**
 * Subscribe to all attendance records for a group's specific date.
 * Returns unsubscribe function.
 */
export function subscribeToAttendanceForDate(
  groupId: string,
  dateKey: string,
  onUpdate: (members: Array<{ uid: string; displayName: string; focusMinutes: number; present: boolean }>) => void,
  onError?: (error: Error) => void
): () => void {
  if (!groupId || !dateKey) {
    onUpdate([]);
    return () => {};
  }

  try {
    const db = requireFirestore();
    return db
      .collection("groups")
      .doc(groupId)
      .collection("attendance")
      .doc(dateKey)
      .collection("members")
      .onSnapshot(
        (snap) => {
          const members = snap.docs.map((doc) => {
            const data = doc.data();
            return {
              uid: doc.id,
              displayName: String(data?.displayName || "User"),
              focusMinutes: Number(data?.focusMinutes ?? data?.minutes ?? 0),
              present: Boolean(data?.present),
            };
          });
          onUpdate(members);
        },
        (err) => {
          console.error("[subscribeToAttendanceForDate] ERROR:", err?.message);
          onError?.(err);
        }
      );
  } catch (err: any) {
    console.error("[subscribeToAttendanceForDate] Failed to subscribe:", err?.message);
    onError?.(err);
    return () => {};
  }
}

/**
 * Get all attendance date keys for a group.
 */
export async function getAttendanceDateKeys(groupId: string): Promise<string[]> {
  if (!groupId) return [];

  try {
    const db = requireFirestore();
    const snap = await db
      .collection("groups")
      .doc(groupId)
      .collection("attendance")
      .orderBy("__name__", "desc")
      .get();

    return snap.docs.map((d) => d.id);
  } catch (err: any) {
    console.error("[getAttendanceDateKeys] ERROR:", err?.message);
    return [];
  }
}

/**
 * Subscribe to attendance date documents to get real-time updates
 * when new attendance dates are created.
 */
export function subscribeToAttendanceDates(
  groupId: string,
  onUpdate: (dateKeys: string[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!groupId) {
    onUpdate([]);
    return () => {};
  }

  try {
    const db = requireFirestore();
    return db
      .collection("groups")
      .doc(groupId)
      .collection("attendance")
      .onSnapshot(
        (snap) => {
          const dates = snap.docs.map((d) => d.id);
          onUpdate(dates);
        },
        (err) => {
          console.error("[subscribeToAttendanceDates] ERROR:", err?.message);
          onError?.(err);
        }
      );
  } catch (err: any) {
    console.error("[subscribeToAttendanceDates] Failed to subscribe:", err?.message);
    onError?.(err);
    return () => {};
  }
}

/**
 * Subscribe to weekly attendance records (last 7 days) for all members.
 * Returns unsubscribe function.
 * Calls onUpdate with a map: { dateKey: { uid: { present, focusMinutes, displayName } } }
 */
export function subscribeToWeeklyAttendance(
  groupId: string,
  weekDateKeys: string[],
  onUpdate: (weeklyData: Record<string, Record<string, { present: boolean; focusMinutes: number; displayName: string }>>) => void,
  onError?: (error: Error) => void
): () => void {
  if (!groupId || weekDateKeys.length === 0) {
    onUpdate({});
    return () => {};
  }

  const unsubscribes: (() => void)[] = [];
  let destroyed = false;

  const mergedState: Record<string, Record<string, { present: boolean; focusMinutes: number; displayName: string }>> = {};

  weekDateKeys.forEach((dk) => {
    mergedState[dk] = {};
  });

  let pendingUpdate: ReturnType<typeof setTimeout> | null = null;
  const scheduleUpdate = () => {
    if (pendingUpdate) clearTimeout(pendingUpdate);
    pendingUpdate = setTimeout(() => {
      if (!destroyed) {
        onUpdate({ ...mergedState });
      }
    }, 50);
  };

  try {
    const db = requireFirestore();

    weekDateKeys.forEach((dateKey) => {
      const unsub = db
        .collection("groups")
        .doc(groupId)
        .collection("attendance")
        .doc(dateKey)
        .collection("members")
        .onSnapshot(
          (snap) => {
            if (destroyed) return;
            const memberData: Record<string, { present: boolean; focusMinutes: number; displayName: string }> = {};
            snap.docs.forEach((doc) => {
              const data = doc.data();
              memberData[doc.id] = {
                present: Boolean(data?.present ?? false),
                focusMinutes: Number(data?.focusMinutes ?? data?.minutes ?? 0),
                displayName: String(data?.displayName || "User"),
              };
            });
            mergedState[dateKey] = memberData;
            scheduleUpdate();
          },
          (err) => {
            console.error(`[subscribeToWeeklyAttendance] Error for ${dateKey}:`, err?.message);
            onError?.(err);
          }
        );
      unsubscribes.push(unsub);
    });
  } catch (err: any) {
    console.error("[subscribeToWeeklyAttendance] Failed to subscribe:", err?.message);
    onError?.(err);
  }

  return () => {
    destroyed = true;
    if (pendingUpdate) clearTimeout(pendingUpdate);
    unsubscribes.forEach((fn) => fn());
  };
}

/**
 * Get member-level total focus minutes across all attendance dates.
 */
export async function getMemberTotalFocusMinutes(
  groupId: string,
  uid: string
): Promise<number> {
  if (!groupId || !uid) return 0;
  try {
    const db = requireFirestore();
    const attendanceDates = await db
      .collection("groups")
      .doc(groupId)
      .collection("attendance")
      .get();

    let total = 0;

    for (const dateDoc of attendanceDates.docs) {
      const memberSnap = await dateDoc.ref
        .collection("members")
        .doc(uid)
        .get();

      if (memberSnap.exists()) {
        const data = memberSnap.data();
        total += Number(data?.focusMinutes ?? data?.minutes ?? 0);
      }
    }

    return total;
  } catch (err: any) {
    console.error("[getMemberTotalFocusMinutes] ERROR:", err?.message);
    return 0;
  }
}

/**
 * Get attendance summary for all members across all dates.
 * Includes focus minutes per member.
 */
export async function getGroupAttendanceSummary(
  groupId: string
): Promise<Record<string, { presentDays: number; totalDays: number; percentage: number; totalFocusMinutes: number }>> {
  if (!groupId) return {};

  try {
    const db = requireFirestore();
    const attendanceDates = await db
      .collection("groups")
      .doc(groupId)
      .collection("attendance")
      .get();

    const totalDays = attendanceDates.docs.length;
    if (totalDays === 0) return {};

    const memberSummary: Record<string, { presentDays: number; totalDays: number; percentage: number; totalFocusMinutes: number }> = {};

    for (const dateDoc of attendanceDates.docs) {
      const membersSnap = await dateDoc.ref.collection("members").get();
      membersSnap.docs.forEach((memberDoc) => {
        const data = memberDoc.data();
        const uid = memberDoc.id;
        if (!memberSummary[uid]) {
          memberSummary[uid] = { presentDays: 0, totalDays: 0, percentage: 0, totalFocusMinutes: 0 };
        }
        memberSummary[uid].totalDays++;
        if (data?.present === true) {
          memberSummary[uid].presentDays++;
        }
        memberSummary[uid].totalFocusMinutes += Number(data?.focusMinutes ?? data?.minutes ?? 0);
      });
    }

    Object.keys(memberSummary).forEach((uid) => {
      const summary = memberSummary[uid];
      summary.percentage = summary.totalDays > 0
        ? Math.round((summary.presentDays / summary.totalDays) * 100)
        : 0;
    });

    return memberSummary;
  } catch (err: any) {
    console.error("[getGroupAttendanceSummary] ERROR:", err?.message);
    return {};
  }
}
