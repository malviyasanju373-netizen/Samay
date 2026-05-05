import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "@/firebase";
import { startSession, completeSession } from "@/services/sessions";
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

export function useFocusTimer() {
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      } catch {}
    }).catch(() => {});
  }, []);

  const tick = useCallback(() => {
    setElapsedSeconds((s) => s + 1);
  }, []);

  useEffect(() => {
    if (timerState === "running") {
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerState, tick]);

  // Persist elapsed seconds to storage while running
  useEffect(() => {
    if (!activeSession || timerState !== "running") return;
    const updated = { ...activeSession, elapsedSeconds, startedAt: Date.now() };
    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(updated)).catch(() => {});
  }, [elapsedSeconds, activeSession, timerState]);

  const start = useCallback(async (categoryId: string, title: string, targetMinutes: number | null) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const sessionId = await startSession(uid, categoryId, title, targetMinutes);
    const session: ActiveSession = { sessionId, categoryId, title, targetMinutes, startedAt: Date.now(), elapsedSeconds: 0 };
    setActiveSession(session);
    setElapsedSeconds(0);
    setTimerState("running");
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
  }, []);

  const pause = useCallback(() => {
    setTimerState("paused");
  }, []);

  const resume = useCallback(() => {
    setTimerState("running");
  }, []);

  const stop = useCallback(async () => {
    if (!activeSession) return 0;
    const uid = auth.currentUser?.uid;
    if (!uid) return 0;
    const durationMinutes = Math.max(1, Math.floor(elapsedSeconds / 60));
    setTimerState("idle");
    setElapsedSeconds(0);
    setActiveSession(null);
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    await completeSession(uid, activeSession.sessionId, durationMinutes);
    return durationMinutes;
  }, [activeSession, elapsedSeconds]);

  const cancel = useCallback(async () => {
    setTimerState("idle");
    setElapsedSeconds(0);
    setActiveSession(null);
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  }, []);

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
    start,
    pause,
    resume,
    stop,
    cancel,
  };
}
