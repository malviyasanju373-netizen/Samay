import {
  collection, doc, addDoc, updateDoc, getDocs, query,
  where, orderBy, limit, serverTimestamp, Timestamp, increment,
} from "firebase/firestore";
import { db } from "@/firebase";
import { FocusSession } from "@/types/session";

export async function startSession(
  uid: string,
  categoryId: string,
  title: string,
  targetMinutes: number | null
): Promise<string> {
  const ref = await addDoc(collection(db, "sessions"), {
    uid,
    categoryId,
    title,
    startTime: serverTimestamp(),
    endTime: null,
    durationMinutes: 0,
    targetMinutes,
    isCompleted: false,
  });
  return ref.id;
}

export async function completeSession(
  uid: string,
  sessionId: string,
  durationMinutes: number
): Promise<void> {
  await updateDoc(doc(db, "sessions", sessionId), {
    endTime: serverTimestamp(),
    durationMinutes,
    isCompleted: true,
  });
  if (durationMinutes > 0) {
    await updateDoc(doc(db, "users", uid), {
      totalFocusMinutes: increment(durationMinutes),
    });
  }
}

export async function getRecentSessions(uid: string, count = 20): Promise<FocusSession[]> {
  const q = query(
    collection(db, "sessions"),
    where("uid", "==", uid),
    where("isCompleted", "==", true),
    orderBy("startTime", "desc"),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FocusSession));
}

export async function getTodayMinutes(uid: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const q = query(
    collection(db, "sessions"),
    where("uid", "==", uid),
    where("isCompleted", "==", true),
    where("startTime", ">=", Timestamp.fromDate(startOfDay))
  );
  const snap = await getDocs(q);
  return snap.docs.reduce((sum, d) => sum + (d.data().durationMinutes ?? 0), 0);
}

export async function getWeeklyMinutes(uid: string): Promise<number[]> {
  const days: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - i);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    const q = query(
      collection(db, "sessions"),
      where("uid", "==", uid),
      where("isCompleted", "==", true),
      where("startTime", ">=", Timestamp.fromDate(start)),
      where("startTime", "<=", Timestamp.fromDate(end))
    );
    const snap = await getDocs(q);
    days.push(snap.docs.reduce((sum, d) => sum + (d.data().durationMinutes ?? 0), 0));
  }
  return days;
}
