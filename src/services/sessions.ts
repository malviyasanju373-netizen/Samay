import firestore from "@react-native-firebase/firestore";
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
  const ref = await db.collection("sessions").add({
    uid,
    categoryId,
    title,
    startTime: firestore.FieldValue.serverTimestamp(),
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
  await db.collection("users").doc(uid).set(
    {
      isStudying,
      lastActiveAt: firestore.FieldValue.serverTimestamp(),
      currentSessionId: isStudying ? currentSessionId : null,
      currentSubject: isStudying ? currentSubject : null,
      currentTargetMinutes: isStudying ? currentTargetMinutes : null,
      currentSessionStart: isStudying ? currentSessionStart || firestore.FieldValue.serverTimestamp() : null,
    },
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
  const data: Record<string, any> = {
    isStudying: true,
    lastActiveAt: firestore.FieldValue.serverTimestamp(),
    currentSessionId,
    currentSubject: currentSubject || null,
    currentTargetMinutes: currentTargetMinutes ?? null,
  };
  if (currentSessionStart) data.currentSessionStart = currentSessionStart;
  await requireFirestore().collection("users").doc(uid).set(data, { merge: true });
}

export async function cancelSession(uid: string, sessionId: string): Promise<void> {
  const db = requireFirestore();
  const batch = db.batch();
  batch.update(db.collection("sessions").doc(sessionId), {
    endTime: firestore.FieldValue.serverTimestamp(),
    durationMinutes: 0,
    isCompleted: true,
    cancelled: true,
  });
  batch.set(
    db.collection("users").doc(uid),
    {
      isStudying: false,
      lastActiveAt: firestore.FieldValue.serverTimestamp(),
      currentSessionId: null,
      currentSubject: null,
      currentTargetMinutes: null,
      currentSessionStart: null,
    },
    { merge: true }
  );
  await batch.commit();
}

export async function completeSession(uid: string, sessionId: string, durationMinutes: number): Promise<void> {
  const db = requireFirestore();
  console.log("[completeSession] START", { uid, sessionId, durationMinutes });
  
  const batch = db.batch();
  batch.update(db.collection("sessions").doc(sessionId), {
    endTime: firestore.FieldValue.serverTimestamp(),
    durationMinutes,
    isCompleted: true,
  });
  batch.set(
    db.collection("users").doc(uid),
    {
      isStudying: false,
      lastActiveAt: firestore.FieldValue.serverTimestamp(),
      currentSessionId: null,
      currentSubject: null,
      currentTargetMinutes: null,
      currentSessionStart: null,
    },
    { merge: true }
  );
  await batch.commit();
  console.log("[completeSession] Batch committed (session marked isCompleted, user isStudying=false)");

  if (durationMinutes > 0) {
    await db.collection("users").doc(uid).update({
      totalFocusMinutes: firestore.FieldValue.increment(durationMinutes),
    });
    console.log("[completeSession] users/{uid}.totalFocusMinutes incremented by", durationMinutes);
    console.log("[completeSession] Firestore path: users/", uid);
    
    // Fetch updated user doc to verify
    const userSnap = await db.collection("users").doc(uid).get();
    if (userSnap.exists()) {
      const userData = userSnap.data();
      console.log("[completeSession] VERIFICATION: users/{uid} after update", {
        uid,
        totalFocusMinutes: userData?.totalFocusMinutes,
      });
    }
  }
}

export async function getRecentSessions(uid: string, count = 20): Promise<FocusSession[]> {
  const snap = await requireFirestore()
    .collection("sessions")
    .where("uid", "==", uid)
    .where("isCompleted", "==", true)
    .orderBy("startTime", "desc")
    .limit(count)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FocusSession));
}

export async function getTodayMinutes(uid: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const snap = await requireFirestore()
    .collection("sessions")
    .where("uid", "==", uid)
    .where("isCompleted", "==", true)
    .where("startTime", ">=", firestore.Timestamp.fromDate(startOfDay))
    .get();
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
    const snap = await db
      .collection("sessions")
      .where("uid", "==", uid)
      .where("isCompleted", "==", true)
      .where("startTime", ">=", firestore.Timestamp.fromDate(start))
      .where("startTime", "<=", firestore.Timestamp.fromDate(end))
      .get();
    days.push(snap.docs.reduce((sum, d) => sum + (d.data().durationMinutes ?? 0), 0));
  }
  return days;
}

function isFreshStatus(data: any): boolean {
  if (!data?.lastActiveAt) return false;
  const lastActive = typeof data.lastActiveAt?.toDate === "function" ? data.lastActiveAt.toDate().getTime() : 0;
  return Date.now() - lastActive <= STUDYING_STALE_MS;
}

function isFreshStudyingStatus(data: any): boolean {
  return !!data?.isStudying && !!data?.currentSessionId && isFreshStatus(data);
}

export function subscribeToStudyingStatusesForUids(
  uids: string[],
  onUpdate: (activeSessions: Record<string, any>, summary: StudyingStatusesSummary) => void,
  onError?: (err: Error) => void
): () => void {
  const db = requireFirestore();
  const uniqueUids = Array.from(new Set((uids || []).filter(Boolean)));
  if (uniqueUids.length === 0) {
    onUpdate({}, { onlineCount: 0, studyingCount: 0, statusMap: {} });
    return () => {};
  }

  const chunks: string[][] = [];
  for (let i = 0; i < uniqueUids.length; i += 10) chunks.push(uniqueUids.slice(i, i + 10));

  console.log("[subscribeToStudyingStatusesForUids] Before Firestore query. Unique UIDs count:", uniqueUids.length, "Chunks:", chunks.length);

  const docsByUid: Record<string, any> = {};
  const emit = () => {
    const activeMap: Record<string, any> = {};
    const statusMap: Record<string, any> = {};
    let onlineCount = 0;
    uniqueUids.forEach((uid) => {
      const data = docsByUid[uid];
      if (data) {
        statusMap[uid] = data;
        if (isFreshStatus(data)) onlineCount += 1;
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
    const documentIdField = '__name__';
    console.log("WHERE ARG =", documentIdField);
    console.log("WHERE TYPE =", typeof documentIdField);
    console.log("[subscribeToStudyingStatusesForUids] Executing .where() with chunk:", chunk);
    return db
      .collection("users")
      .where(documentIdField, "in", chunk)
      .onSnapshot(
        (snap) => {
          console.log("[subscribeToStudyingStatusesForUids] Query snapshot received. Docs count:", snap.docs.length);
          snap.docs.forEach((d) => {
            docsByUid[d.id] = { uid: d.id, ...d.data() };
          });
          emit();
        },
        (err) => onError?.(err)
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

  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 10) chunks.push(uids.slice(i, i + 10));

  for (const chunk of chunks) {
    const snap = await db
      .collection("sessions")
      .where("uid", "in", chunk)
      .where("isCompleted", "==", true)
      .orderBy("startTime", "desc")
      .limit(limitPerQuery)
      .get();
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

