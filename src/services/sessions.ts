import {
  collection, doc, addDoc, updateDoc, getDocs, query,
  where, orderBy, limit, serverTimestamp, Timestamp, increment,
  onSnapshot, Unsubscribe, setDoc, writeBatch, documentId,
} from "firebase/firestore";
import { requireFirestore } from "@/firebase";
import { FocusSession } from "@/types/session";

const STUDYING_STALE_MS = 90 * 1000;

type StudyingStatusesSummary = {
  onlineCount: number;
  studyingCount: number;
  statusMap: Record<string, any>;
};

export async function startSession(
  uid: string,
  categoryId: string,
  title: string,
  targetMinutes: number | null
): Promise<string> {
  const db = requireFirestore();
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
  await setStudyingStatus(uid, true, ref.id, title || categoryId, targetMinutes);
  return ref.id;
}

export async function setStudyingStatus(
  uid: string,
  isStudying: boolean,
  currentSessionId: string | null = null,
  currentSubject: string | null = null,
  currentTargetMinutes: number | null = null,
  currentSessionStart?: any
): Promise<void> {
  const db = requireFirestore();
  const data: Record<string, any> = {
    isStudying,
    lastActiveAt: serverTimestamp(),
    currentSessionId: isStudying ? currentSessionId : null,
    currentSubject: isStudying ? currentSubject : null,
    currentTargetMinutes: isStudying ? currentTargetMinutes : null,
    currentSessionStart: isStudying ? currentSessionStart || serverTimestamp() : null,
  };

  await setDoc(
    doc(db, "users", uid),
    data,
    { merge: true }
  );
}

export async function touchStudyingStatus(
  uid: string,
  currentSessionId: string,
  currentSubject?: string | null,
  currentTargetMinutes?: number | null,
  currentSessionStart?: any
): Promise<void> {
  const db = requireFirestore();
  const data: Record<string, any> = {
    isStudying: true,
    lastActiveAt: serverTimestamp(),
    currentSessionId,
    currentSubject: currentSubject || null,
    currentTargetMinutes: currentTargetMinutes ?? null,
  };
  if (currentSessionStart) data.currentSessionStart = currentSessionStart;

  await setDoc(
    doc(db, "users", uid),
    data,
    { merge: true }
  );
}

export async function cancelSession(uid: string, sessionId: string): Promise<void> {
  const db = requireFirestore();
  const batch = writeBatch(db);

  batch.update(doc(db, "sessions", sessionId), {
    endTime: serverTimestamp(),
    durationMinutes: 0,
    isCompleted: true,
    cancelled: true,
  });
  batch.set(
    doc(db, "users", uid),
    {
      isStudying: false,
      lastActiveAt: serverTimestamp(),
      currentSessionId: null,
      currentSubject: null,
      currentTargetMinutes: null,
      currentSessionStart: null,
    },
    { merge: true }
  );

  await batch.commit();
}

export async function completeSession(
  uid: string,
  sessionId: string,
  durationMinutes: number
): Promise<void> {
  const db = requireFirestore();
  console.log("[completeSession] Starting for uid:", uid, "sessionId:", sessionId, "duration:", durationMinutes);
  
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, "sessions", sessionId), {
      endTime: serverTimestamp(),
      durationMinutes,
      isCompleted: true,
    });
    batch.set(
      doc(db, "users", uid),
      {
        isStudying: false,
        lastActiveAt: serverTimestamp(),
        currentSessionId: null,
        currentSubject: null,
        currentTargetMinutes: null,
        currentSessionStart: null,
      },
      { merge: true }
    );
    await batch.commit();
    console.log("[completeSession] Session marked complete:", sessionId);
    
    if (durationMinutes > 0) {
      await updateDoc(doc(db, "users", uid), {
        totalFocusMinutes: increment(durationMinutes),
      });
      console.log("[completeSession] User totalFocusMinutes updated - uid:", uid, "added:", durationMinutes);
    }
  } catch (error: any) {
    console.error("[completeSession] Error - uid:", uid, "error:", error?.code || error?.message);
    throw error;
  }
}

export async function getRecentSessions(uid: string, count = 20): Promise<FocusSession[]> {
  const db = requireFirestore();
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
  const db = requireFirestore();
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
  const db = requireFirestore();
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

function isFreshStatus(data: any): boolean {
  if (!data?.lastActiveAt) return false;
  const lastActive = typeof data.lastActiveAt?.toDate === "function"
    ? data.lastActiveAt.toDate().getTime()
    : 0;
  return Date.now() - lastActive <= STUDYING_STALE_MS;
}

function isFreshStudyingStatus(data: any): boolean {
  return !!data?.isStudying && !!data?.currentSessionId && isFreshStatus(data);
}

export function subscribeToStudyingStatusesForUids(
  uids: string[],
  onUpdate: (activeSessions: Record<string, any>, summary: StudyingStatusesSummary) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const db = requireFirestore();
  const uniqueUids = Array.from(new Set((uids || []).filter(Boolean)));
  if (uniqueUids.length === 0) {
    onUpdate({}, { onlineCount: 0, studyingCount: 0, statusMap: {} });
    return () => {};
  }

  const chunks: string[][] = [];
  for (let i = 0; i < uniqueUids.length; i += 10) chunks.push(uniqueUids.slice(i, i + 10));

  const docsByUid: Record<string, any> = {};
  const emit = () => {
    const activeMap: Record<string, any> = {};
    const statusMap: Record<string, any> = {};
    let onlineCount = 0;
    uniqueUids.forEach((uid) => {
      const data = docsByUid[uid];
      if (data) {
        statusMap[uid] = data;
        if (isFreshStatus(data)) {
          onlineCount += 1;
        }
        if (isFreshStudyingStatus(data)) activeMap[uid] = data;
      }
    });
    onUpdate(activeMap, {
      onlineCount,
      studyingCount: Object.keys(activeMap).length,
      statusMap,
    });
  };

  const unsubscribes = chunks.map((chunk) => {
    const q = query(collection(db, "users"), where(documentId(), "in", chunk));
    return onSnapshot(
      q,
      (snap) => {
        snap.docs.forEach((d) => {
          docsByUid[d.id] = { uid: d.id, ...d.data() };
        });
        emit();
      },
      (err) => {
        console.error("[subscribeToStudyingStatusesForUids] Listener error:", err?.message);
        if (onError) onError(err);
      }
    );
  });

  const staleInterval = setInterval(emit, 15000);

  return () => {
    clearInterval(staleInterval);
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  };
}

export async function getLastCompletedSessionsForUids(uids: string[], limitPerQuery = 50): Promise<Record<string, any>> {
  const db = requireFirestore();
  if (!uids || uids.length === 0) return {};
  const result: Record<string, any> = {};

  // Firestore supports "in" for up to 10 values. If more, chunk.
  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 10) chunks.push(uids.slice(i, i + 10));

  for (const chunk of chunks) {
    const q = query(
      collection(db, "sessions"),
      where("uid", "in", chunk),
      where("isCompleted", "==", true),
      orderBy("startTime", "desc"),
      limit(limitPerQuery)
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const data = { id: d.id, ...d.data() } as any;
      const uid = data.uid;
      if (!result[uid] || (data.startTime && result[uid].startTime < data.startTime)) {
        result[uid] = data;
      }
    });
  }

  return result;
}
