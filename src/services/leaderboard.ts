import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection, getDocs, getDoc, doc, orderBy, limit, query, onSnapshot, Unsubscribe, updateDoc,
} from "firebase/firestore";
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

async function buildLeaderboardEntries(docs: any[]): Promise<LeaderboardEntry[]> {
  const db = requireFirestore();
  return Promise.all(
    docs.map(async (d, i) => {
      const totalFocusMinutes: number =
        typeof d.data().totalFocusMinutes === "number" ? d.data().totalFocusMinutes : 0;
      let displayName = d.data().displayName || "Anonymous";
      
      // If displayName is missing, try to backfill from userProfiles
      if (!d.data().displayName) {
        try {
          const profileSnap = await getDoc(doc(db, "userProfiles", d.id));
          if (profileSnap.exists() && profileSnap.data().displayName) {
            displayName = profileSnap.data().displayName;
            // Silently update users doc with displayName for future queries
            try {
              await updateDoc(doc(db, "users", d.id), { displayName });
              console.log("[buildLeaderboardEntries] Updated missing displayName for uid:", d.id);
            } catch (updateErr: any) {
              console.warn("[buildLeaderboardEntries] Could not update displayName for uid:", d.id);
            }
          }
        } catch (err) {
          console.warn("[buildLeaderboardEntries] Could not fetch profile for uid:", d.id);
        }
      }
      
      console.log("[buildLeaderboardEntries] uid:", d.id, "displayName:", displayName, "minutes:", totalFocusMinutes);
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
        if (Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
          console.log("[getLeaderboard] Using cached data, entries:", cache.data.length);
          return cache.data;
        }
      }
    } catch {}
  }

  try {
    const db = requireFirestore();
    const q = query(collection(db, "users"), orderBy("totalFocusMinutes", "desc"), limit(10));
    console.log("[getLeaderboard] Querying users collection...");
    const snap = await getDocs(q);
    console.log("[getLeaderboard] Query returned", snap.docs.length, "users");

    const entries = await buildLeaderboardEntries(snap.docs);
    console.log("[getLeaderboard] Built leaderboard entries:", entries.map(e => ({ uid: e.uid, minutes: e.totalFocusMinutes, rank: e.rank })));

    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: entries, fetchedAt: Date.now() }));
    } catch {}

    return entries;
  } catch (error: any) {
    console.error("[getLeaderboard] Error fetching leaderboard:", error?.code || error?.message);
    throw error;
  }
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
): Unsubscribe {
  const db = requireFirestore();
  const q = query(collection(db, "users"), orderBy("totalFocusMinutes", "desc"), limit(10));
  console.log("[subscribeToLeaderboard] Setting up realtime listener...");

  return onSnapshot(
    q,
    async (snap) => {
      try {
        console.log("[subscribeToLeaderboard] Snapshot received, doc count:", snap.docs.length);
        const entries = await buildLeaderboardEntries(snap.docs);
        console.log("[subscribeToLeaderboard] Built entries:", entries.map(e => ({ uid: e.uid, minutes: e.totalFocusMinutes, rank: e.rank })));
        try {
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: entries, fetchedAt: Date.now() }));
        } catch {}
        onUpdate(entries);
      } catch (err) {
        console.error("[subscribeToLeaderboard] Error processing snapshot:", err instanceof Error ? err.message : String(err));
        if (onError) onError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    (err) => {
      console.error("[subscribeToLeaderboard] Listener error:", err?.code || err?.message);
      if (onError) onError(err);
    }
  );
}
