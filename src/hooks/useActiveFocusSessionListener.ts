import { useEffect, useRef, useState } from "react";
import firestore from "@react-native-firebase/firestore";
import { requireFirestore } from "@/firebase";

export type LiveFocusSession = {
  uid: string;
  userId: string;
  displayName: string;
  userName: string;
  isRunning: boolean;
  elapsedSeconds: number;
  groupId: string | null;
};

/**
 * Hook to listen for real-time active focus sessions in a group and calculate live elapsed time.
 * Updates every second to reflect current elapsed time.
 * 
 * @param groupId - The ID of the group to listen to
 * @returns Object with activeSessions array, loading, and error states
 */
export function useActiveFocusSessionListener(groupId?: string | null) {
  const [activeSessions, setActiveSessions] = useState<Record<string, LiveFocusSession>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionsDataRef = useRef<Record<string, any>>({});

  // Cleanup function
  const cleanup = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  };

  // Calculate elapsed time for all sessions
  const calculateElapsedTimes = () => {
    try {
      const now = Date.now();
      const updated: Record<string, LiveFocusSession> = {};

      Object.entries(sessionsDataRef.current).forEach(([userId, sessionData]) => {
        if (!sessionData) return;

        const startedAtMs = sessionData.startedAt?.toMillis?.() 
          ?? (sessionData.startedAt instanceof Date 
            ? sessionData.startedAt.getTime()
            : Number(sessionData.startedAt));
        const safeStartedAtMs = Number.isFinite(startedAtMs) ? startedAtMs : now;

        const elapsedMs = now - safeStartedAtMs;
        const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
        const uid = String(sessionData.uid || userId);
        const displayName = String(sessionData.displayName || sessionData.userName || "User");

        updated[uid] = {
          uid,
          userId: uid,
          displayName,
          userName: displayName,
          isRunning: true,
          elapsedSeconds,
          groupId: sessionData.groupId ? String(sessionData.groupId) : null,
        };
      });

      setActiveSessions(updated);
    } catch (err) {
      console.error("[useActiveFocusSessionListener] Error calculating elapsed times:", err);
    }
  };

  useEffect(() => {
    if (!groupId) {
      setActiveSessions({});
      setLoading(false);
      setError("Missing group id");
      cleanup();
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    try {
      const db = requireFirestore();
      const unsubscribe = db
        .collection("groups")
        .doc(groupId)
        .collection("activeSessions")
        .onSnapshot(
          (snapshot) => {
            if (!mounted) return;

            try {
              // Update session data
              sessionsDataRef.current = {};
              snapshot.docs.forEach((doc) => {
                sessionsDataRef.current[doc.id] = doc.data();
              });

              // Calculate elapsed times immediately
              calculateElapsedTimes();
              setError(null);
              setLoading(false);
            } catch (err: any) {
              console.error("[useActiveFocusSessionListener] Error processing snapshot:", err);
              if (mounted) {
                setError("Failed to process sessions");
              }
            }
          },
          (err: any) => {
            if (!mounted) return;
            console.error("[useActiveFocusSessionListener] Firestore error:", err);
            setError("Failed to listen to active sessions");
            setLoading(false);
          }
        );

      unsubscribeRef.current = unsubscribe;

      // Set up interval to update elapsed times every second
      intervalRef.current = setInterval(() => {
        if (mounted) {
          calculateElapsedTimes();
        }
      }, 1000);

      return () => {
        mounted = false;
        cleanup();
      };
    } catch (err: any) {
      console.error("[useActiveFocusSessionListener] Setup error:", err);
      if (mounted) {
        setError("Failed to set up listener");
        setLoading(false);
      }
    }
  }, [groupId]);

  return { activeSessions, loading, error };
}
