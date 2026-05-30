import { useEffect, useState } from "react";
import { subscribeToSubCollection } from "@/firebase";
import { ActiveSession } from "@/types/group";

/**
 * Hook to listen for real-time updates to a group's active sessions subcollection.
 * @param groupId - The ID of the group to fetch sessions for.
 */
export function useGroupActiveSessions(groupId?: string | null) {
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) {
      setActiveSessions([]);
      setLoading(false);
      setError("Missing group id");
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToSubCollection(
      "groups",
      groupId,
      "activeSessions",
      (docs) => {
        if (!mounted) return;
        
        // Normalize the Firestore documents into ActiveSession objects
        const sessions: ActiveSession[] = docs.map((doc) => ({
          sessionId: doc.id,
          userId: doc.userId,
          userName: doc.userName || "User",
          isRunning: doc.isRunning ?? true,
          startedAt: doc.startedAt,
          groupId: doc.groupId,
          startTime: doc.startTime?.toDate ? doc.startTime.toDate().getTime() : Number(doc.startTime),
          subject: doc.subject,
          lastUpdatedAt: doc.lastUpdatedAt?.toDate ? doc.lastUpdatedAt.toDate().getTime() : Number(doc.lastUpdatedAt),
          totalSeconds: doc.totalSeconds ?? 0,
        }));

        setActiveSessions(sessions);
        setError(null);
        setLoading(false);
      },
      (err) => {
        if (!mounted) return;
        console.error("[useGroupActiveSessions] Error:", err);
        setError("Realtime active sessions update failed");
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [groupId]);

  return { activeSessions, loading, error };
}

