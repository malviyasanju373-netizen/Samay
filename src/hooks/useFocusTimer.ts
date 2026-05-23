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
import { STORAGE_KEYS } from "@/storage/services";

type TimerState = "idle" | "running" | "paused";

type ActiveSession = {
  sessionId: string;
  categoryId: string;
  title: string;
  targetMinutes: number | null;
  startedAt: number;
  elapsedSeconds: number;
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
        const elapsed = saved.elapsedSeconds + Math.floor((Date.now() - saved.startedAt) / 1000);
        setActiveSession({ ...saved, elapsedSeconds: elapsed, startedAt: Date.now() });
        setElapsedSeconds(elapsed);
        setTimerState("running");
        const uid = auth?.currentUser?.uid;
        if (uid) {
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
    const uid = auth?.currentUser?.uid;
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
      const uid = auth?.currentUser?.uid;
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

  // Persist elapsed seconds to storage while running
  useEffect(() => {
    if (!activeSession || timerState !== "running") return;
    const updated = { ...activeSession, elapsedSeconds, startedAt: Date.now() };
    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(updated)).catch(() => {});
  }, [elapsedSeconds, activeSession, timerState]);

  const start = useCallback(async (categoryId: string, title: string, targetMinutes: number | null) => {
    setError(null);
    const uid = auth?.currentUser?.uid;
    if (!uid) {
      setError("Sign in to start a focus session.");
      return false;
    }
    try {
      const sessionId = await startSession(uid, categoryId, title, targetMinutes);
      const session: ActiveSession = { sessionId, categoryId, title, targetMinutes, startedAt: Date.now(), elapsedSeconds: 0 };
      setActiveSession(session);
      setElapsedSeconds(0);
      setTimerState("running");
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
      return true;
    } catch (err: any) {
      setError(err?.message ?? "Could not start the session.");
      return false;
    }
  }, []);

  const pause = useCallback(() => {
    const uid = auth?.currentUser?.uid;
    if (uid) setStudyingStatus(uid, false).catch(() => {});
    setTimerState("paused");
  }, []);

  const resume = useCallback(() => {
    const uid = auth?.currentUser?.uid;
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
    setError(null);
    const uid = auth?.currentUser?.uid;
    if (!uid) {
      setError("Sign in to save this focus session.");
      return 0;
    }
    const durationMinutes = Math.max(1, Math.floor(elapsedSeconds / 60));
    try {
      await completeSession(uid, activeSession.sessionId, durationMinutes);
      setTimerState("idle");
      setElapsedSeconds(0);
      setActiveSession(null);
      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
      return durationMinutes;
    } catch (err: any) {
      setTimerState("paused");
      setError(err?.message ?? "Could not save the session. Check your connection and try again.");
      return 0;
    }
  }, [activeSession, elapsedSeconds]);

  const cancel = useCallback(async () => {
    const uid = auth?.currentUser?.uid;
    const sessionId = activeSession?.sessionId;
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
