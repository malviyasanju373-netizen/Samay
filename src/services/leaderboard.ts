import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection, getDocs, getDoc, doc, orderBy, limit, query,
} from "firebase/firestore";
import { db } from "@/firebase";

export type LeaderboardEntry = {
  uid: string;
  username: string;
  totalFocusMinutes: number;
  rank: number;
};

type Cache = { data: LeaderboardEntry[]; fetchedAt: number };

const CACHE_KEY = "samay_leaderboard_v1";
const CACHE_TTL_MS = 60 * 60 * 1000;

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

  const q = query(collection(db, "users"), orderBy("totalFocusMinutes", "desc"), limit(10));
  const snap = await getDocs(q);

  const entries: LeaderboardEntry[] = await Promise.all(
    snap.docs.map(async (d, i) => {
      const totalFocusMinutes: number =
        typeof d.data().totalFocusMinutes === "number" ? d.data().totalFocusMinutes : 0;
      let username = "Focus" + d.id.slice(-4);
      try {
        const profileSnap = await getDoc(doc(db, "userProfiles", d.id));
        if (profileSnap.exists()) username = profileSnap.data().username ?? username;
      } catch {}
      return { uid: d.id, username, totalFocusMinutes, rank: i + 1 };
    })
  );

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
