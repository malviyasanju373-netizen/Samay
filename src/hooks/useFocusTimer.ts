import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "@/firebase";
import {
  cancelSession,
  completeSession,
  setStudyingStatus,
  startSession,
  touchStudyingStatus,
} from "@/services/sessions";
import { startActiveFocusSession, stopActiveFocusSession, updateGroupMemberMinutes } from "@/services/groups";
import { updateAttendance } from "@/services/attendance";
import { STORAGE_KEYS } from "@/storage/services";

type TimerState = "idle" | "running" | "paused";










type ActiveSession = {
  sessionId: string;
  categoryId: string;
  title: string;
  targetMinutes: number | null;
  startedAt: number;
  elapsedSeconds: number;
  groupId?: string | null;
  timerState?: TimerState;
};

const STUDYING_HEARTBEAT_MS = 30 * 1000;

export function useFocusTimer() {
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appActiveRef = useRef(AppState.currentState === "active");
  const elapsedSecondsRef = useRef(0);

  // Restore active session from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION).then((raw) => {
      if (!raw) return;
      try {





        const saved: ActiveSession = JSON.parse(raw);
        console.log("[SESSION LOADED]", saved);
        const savedState: TimerState = saved.timerState === "paused" ? "paused" : "running";
        const elapsed = savedState === "running"
          ? saved.elapsedSeconds + Math.floor((Date.now() - saved.startedAt) / 1000)
          : saved.elapsedSeconds;
        const restoredSession = { ...saved, elapsedSeconds: elapsed, startedAt: Date.now() };
        console.log("[FOCUS RESTORE] activeSession =", restoredSession);
        setActiveSession(restoredSession);
        setElapsedSeconds(elapsed);
        setTimerState(savedState);
        const uid = auth().currentUser?.uid;
        if (uid && savedState === "running") {
          touchStudyingStatus(
            uid,
            saved.sessionId,
            saved.title || saved.categoryId,
            saved.targetMinutes,
            new Date(Date.now() - elapsed * 1000)
          ).catch(() => {});
        }
      } catch {}
    }).catch(() => {});
  }, []);

  const tick = useCallback(() => {
    setElapsedSeconds((s) => s + 1);
  }, []);

  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  useEffect(() => {
    if (timerState === "running") {
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerState, tick]);

  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid || !activeSession) return;

    if (timerState !== "running") {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      setStudyingStatus(uid, false).catch(() => {});
      return;
    }

    if (appActiveRef.current) {
      touchStudyingStatus(
        uid,
        activeSession.sessionId,
        activeSession.title || activeSession.categoryId,
        activeSession.targetMinutes
      ).catch(() => {});
    }
    heartbeatRef.current = setInterval(() => {
      if (appActiveRef.current) {
        touchStudyingStatus(
          uid,
          activeSession.sessionId,
          activeSession.title || activeSession.categoryId,
          activeSession.targetMinutes
        ).catch(() => {});
      }
    }, STUDYING_HEARTBEAT_MS);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [activeSession, timerState]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      appActiveRef.current = state === "active";
      const uid = auth().currentUser?.uid;
      if (!uid || !activeSession) return;

      if (state === "active" && timerState === "running") {
        touchStudyingStatus(
          uid,
          activeSession.sessionId,
          activeSession.title || activeSession.categoryId,
          activeSession.targetMinutes,
          new Date(Date.now() - elapsedSecondsRef.current * 1000)
        ).catch(() => {});
      } else if (state !== "active") {
        setStudyingStatus(uid, false).catch(() => {});
      }
    });

    return () => subscription.remove();
  }, [activeSession, timerState]);

  // Persist elapsed seconds to storage while active
  useEffect(() => {
    if (!activeSession || timerState === "idle") return;
    const updated = { ...activeSession, elapsedSeconds, startedAt: Date.now(), timerState };
    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(updated)).catch(() => {});
  }, [elapsedSeconds, activeSession, timerState]);

  const start = useCallback(async (categoryId: string, title: string, targetMinutes: number | null, groupId?: string) => {
    console.log("[TIMER START]");
    console.log("[START RECEIVED GROUP ID]", groupId);
    setError(null);


    const uid = auth().currentUser?.uid;
    const userName = auth().currentUser?.displayName || "User";
    if (!uid) {
      setError("Sign in to start a focus session.");
      return false;
    }





    try {
      const sessionId = await startSession(uid, categoryId, title, targetMinutes);
      console.log("[FOCUS START]", { groupId, sessionId, uid });
      const session: ActiveSession = { sessionId, categoryId, title, targetMinutes, startedAt: Date.now(), elapsedSeconds: 0, groupId: groupId || null, timerState: "running" };
      console.log("[ACTIVE SESSION CREATE] activeSession =", session);
      
      if (groupId) {
        try {
          await startActiveFocusSession(groupId, uid, userName);
        } catch (groupErr: any) {
          console.error("[useFocusTimer] Failed to start active focus session in group:", groupErr?.message);
        }
      }

      setActiveSession(session);
      setElapsedSeconds(0);
      setTimerState("running");
      console.log("[SESSION SAVED]", session);
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
      return true;
    } catch (err: any) {
      setError(err?.message ?? "Could not start the session.");
      return false;
    }
  }, []);

  const pause = useCallback(() => {
    console.log("[TIMER PAUSE]");
    const uid = auth().currentUser?.uid;
    if (uid) setStudyingStatus(uid, false).catch(() => {});
    setTimerState("paused");
  }, []);

  const resume = useCallback(() => {
    console.log("[TIMER RESUME]");
    const uid = auth().currentUser?.uid;
    if (uid && activeSession) {
      touchStudyingStatus(
        uid,
        activeSession.sessionId,
        activeSession.title || activeSession.categoryId,
        activeSession.targetMinutes,
        new Date(Date.now() - elapsedSeconds * 1000)
      ).catch(() => {});
    }
    setTimerState("running");
  }, [activeSession, elapsedSeconds]);






  const stop = useCallback(async () => {
    if (!activeSession) return 0;
    console.log("[TIMER STOP]");
    console.log("[STOP EXECUTED]");
    console.log("[BEFORE STOP] activeSession =", activeSession);
    setError(null);
    const uid = auth().currentUser?.uid;
    if (!uid) {
      setError("Sign in to save this focus session.");
      return 0;




















    }
    const durationMinutes = Math.max(1, Math.floor(elapsedSeconds / 60));
    try {
      const savedRaw = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
      const saved = savedRaw ? JSON.parse(savedRaw) : null;
      console.log("[SESSION LOADED]", saved);
      const groupId = saved?.groupId || null;
      console.log("[STOP GROUP ID]", groupId);

      await completeSession(uid, activeSession.sessionId, durationMinutes);
      console.log("[STOP] completeSession finished");
      console.log("[STOP] groupId =", groupId);
      console.log("[STOP] uid =", uid);
      console.log("[STOP] durationMinutes =", durationMinutes);

      if (groupId) {
              console.log("[STOP] about to call updateGroupMemberMinutes");
              console.log("[LEADERBOARD UPDATE]");
              await updateGroupMemberMinutes(groupId, uid, durationMinutes);
              console.log("[STOP] about to call updateAttendance");
              console.log("[ATTENDANCE WRITE]");
              console.log("[ATTENDANCE WRITING]");
              await updateAttendance(
                groupId,
                uid,
                auth().currentUser?.displayName || "User",
                durationMinutes
              ).catch((err: any) => {
                console.error("[STOP] updateAttendance error:", err?.message);
              });
              await stopActiveFocusSession(groupId, uid).catch(() => {});
            }

      console.log("[TIMER COMPLETE]");
      setTimerState("idle");
      setElapsedSeconds(0);
      setActiveSession(null);
      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
      console.log("[SESSION CLEANED]");
      return durationMinutes;
    } catch (err: any) {
      setTimerState("paused");
      setError(err?.message ?? "Could not save the session. Check your connection and try again.");
      return 0;
    }
  }, [activeSession, elapsedSeconds]);

  const cancel = useCallback(async () => {
    console.log("[TIMER RESET]");
    const uid = auth().currentUser?.uid;
    const sessionId = activeSession?.sessionId;
    
    const savedRaw = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    if (savedRaw) {
      const saved: any = JSON.parse(savedRaw);
      if (uid && saved.groupId) {
        await stopActiveFocusSession(saved.groupId, uid).catch(() => {});
      }
    }

    setTimerState("idle");
    setElapsedSeconds(0);
    setActiveSession(null);
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    if (uid && sessionId) {
      try {
        await cancelSession(uid, sessionId);
      } catch {
        await setStudyingStatus(uid, false).catch(() => {});
      }
    }
  }, [activeSession]);

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const progress = activeSession?.targetMinutes
    ? Math.min(elapsedSeconds / (activeSession.targetMinutes * 60), 1)
    : 0;

  return {
    timerState,
    elapsedSeconds,
    minutes,
    seconds,
    progress,
    activeSession,
    error,
    clearError: () => setError(null),
    start,
    pause,
    resume,
    stop,
    cancel,
  };
}
