import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { requireFirestore } from "@/firebase";
import { calculateRankings, BaseLeaderboardEntry, RankedLeaderboardEntry } from "@/utils/leaderboardUtils";

export type LeaderboardEntry = RankedLeaderboardEntry<BaseLeaderboardEntry & {
  displayName: string;
  totalFocusMinutes: number;
}>;

type Cache = { data: LeaderboardEntry[]; fetchedAt: number };

const CACHE_KEY = "samay_leaderboard_v1";
const CACHE_TTL_MS = 60 * 60 * 1000;

async function buildLeaderboardEntries(
  docs: FirebaseFirestoreTypes.QueryDocumentSnapshot[]
): Promise<LeaderboardEntry[]> {
  const db = requireFirestore();
  const rawEntries = await Promise.all(
    docs.map(async (d) => {
      const data = d.data();
      // Primary sort key: totalFocusSeconds (raw numeric)
      const totalFocusSeconds = typeof data.totalFocusSeconds === "number" ? data.totalFocusSeconds : 0;
      const totalFocusMinutes = typeof data.totalFocusMinutes === "number" ? data.totalFocusMinutes : Math.floor(totalFocusSeconds / 60);
      const totalSessions = typeof data.totalSessions === "number" ? data.totalSessions : 0;
      const currentStreak = typeof data.currentStreak === "number" ? data.currentStreak : 0;
      const joinedAtMs = data.createdAt?.toMillis?.() ?? 0;
      let displayName = data.displayName || "Anonymous";

      if (!data.displayName) {
        try {
          const profileSnap = await db.collection("userProfiles").doc(d.id).get();
          const profile = profileSnap.data();
          if (profileSnap.exists() && profile?.displayName) {
            displayName = profile.displayName;
            await db.collection("users").doc(d.id).update({ displayName });
          }
        } catch {
          console.warn("[buildLeaderboardEntries] Could not backfill displayName for uid:", d.id);
        }
      }

      return {
        uid: d.id,
        displayName,
        totalFocusMinutes,
        totalFocusSeconds,
        totalSessions,
        currentStreak,
        joinedAtMs,
      };
    })
  );

  // Sort by totalFocusSeconds descending using the central utility
  return calculateRankings(rawEntries, "totalFocusSeconds");
}

export async function getLeaderboard(forceRefresh = false): Promise<LeaderboardEntry[]> {
  if (!forceRefresh) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const cache: Cache = JSON.parse(raw);
        if (Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.data;
      }
    } catch {}
  }

  const db = requireFirestore();
  // Order by totalFocusSeconds descending for correct Firestore-level sorting
  const snap = await db
    .collection("users")
    .orderBy("totalFocusSeconds", "desc")
    .limit(50)
    .get();
  
  const entries = await buildLeaderboardEntries(snap.docs);

  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: entries.slice(0, 10), fetchedAt: Date.now() }));
  } catch {}

  return entries.slice(0, 10);
}

export async function getCachedFetchTime(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) return (JSON.parse(raw) as Cache).fetchedAt;
  } catch {}
  return null;
}

export function subscribeToLeaderboard(
  onUpdate: (entries: LeaderboardEntry[]) => void,
  onError?: (error: Error) => void
): () => void {
  const db = requireFirestore();
  return db
    .collection("users")
    .orderBy("totalFocusSeconds", "desc")
    .limit(50)
    .onSnapshot(
      async (snap) => {
        try {
          const entries = await buildLeaderboardEntries(snap.docs);
          const top10 = entries.slice(0, 10);
          try {
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: top10, fetchedAt: Date.now() }));
          } catch {}
          onUpdate(top10);
        } catch (err) {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      },
      (err) => onError?.(err)
    );
}
