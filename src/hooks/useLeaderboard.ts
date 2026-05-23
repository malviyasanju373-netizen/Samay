import { useEffect, useState, useCallback } from "react";
import { subscribeToLeaderboard, getLeaderboard, getCachedFetchTime, LeaderboardEntry } from "@/services/leaderboard";

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[useLeaderboard] Initial load starting...");
    setLoading(true);
    getLeaderboard()
      .then(async (data) => {
        console.log("[useLeaderboard] Initial load successful, entries:", data.length);
        setEntries(data);
        const time = await getCachedFetchTime();
        setFetchedAt(time);
        setError(null);
      })
      .catch((err) => {
        setError("Could not load leaderboard.");
        console.error("[useLeaderboard] Initial load error:", err?.message || String(err));
      })
      .finally(() => setLoading(false));

    const unsubscribe = subscribeToLeaderboard(
      async (data) => {
        console.log("[useLeaderboard] Realtime update received, entries:", data.length);
        setEntries(data);
        const time = await getCachedFetchTime();
        setFetchedAt(time);
        setError(null);
      },
      (err) => {
        console.error("[useLeaderboard] Realtime error:", err?.message || String(err));
        setError("Realtime update failed.");
      }
    );

    return () => unsubscribe();
  }, []);

  const refetch = useCallback(async () => {
    console.log("[useLeaderboard] Manual refresh starting...");
    setRefreshing(true);
    try {
      const data = await getLeaderboard(true);
      console.log("[useLeaderboard] Manual refresh successful, entries:", data.length);
      setEntries(data);
      const time = await getCachedFetchTime();
      setFetchedAt(time);
      setError(null);
    } catch (err) {
      setError("Could not refresh leaderboard.");
      console.error("[useLeaderboard] Refresh error:", err?.message || String(err));
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { entries, loading, refreshing, fetchedAt, error, refetch };
}
