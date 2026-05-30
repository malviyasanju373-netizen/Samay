import AsyncStorage from "@react-native-async-storage/async-storage";
import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { requireFirestore } from "@/firebase";

export type LeaderboardEntry = {
  uid: string;
  displayName: string;
  totalFocusMinutes: number;
  rank: number;
};

type Cache = { data: LeaderboardEntry[]; fetchedAt: number };

const CACHE_KEY = "samay_leaderboard_v1";
const CACHE_TTL_MS = 60 * 60 * 1000;

async function buildLeaderboardEntries(
  docs: FirebaseFirestoreTypes.QueryDocumentSnapshot[]
): Promise<LeaderboardEntry[]> {
  const db = requireFirestore();
  return Promise.all(
    docs.map(async (d, i) => {
      const data = d.data();
      const totalFocusMinutes = typeof data.totalFocusMinutes === "number" ? data.totalFocusMinutes : 0;
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

      return { uid: d.id, displayName, totalFocusMinutes, rank: i + 1 };
    })
  );
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
  const snap = await db
    .collection("users")
    .orderBy("totalFocusMinutes", "desc")
    .limit(10)
    .get();
  const entries = await buildLeaderboardEntries(snap.docs);

  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: entries, fetchedAt: Date.now() }));
  } catch {}

  return entries;
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
    .orderBy("totalFocusMinutes", "desc")
    .limit(10)
    .onSnapshot(
      async (snap) => {
        try {
          const entries = await buildLeaderboardEntries(snap.docs);
          try {
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: entries, fetchedAt: Date.now() }));
          } catch {}
          onUpdate(entries);
        } catch (err) {
          onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      },
      (err) => onError?.(err)
    );
}
