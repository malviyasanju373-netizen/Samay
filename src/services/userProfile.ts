import {
  doc, getDoc, setDoc, runTransaction, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { requireFirestore } from "@/firebase";

export type UserProfile = {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string | null;
  email: string | null;
  usernameLastChanged: Timestamp | null;
  createdAt: Timestamp;
  goal: string | null;
};

/**
 * Firestore schema
 * ─────────────────────────────────────────
 * userProfiles/{uid}
 *   username, displayName, photoURL, email
 *   goal: string | null        (e.g. "UPSC 2027")
 *   usernameLastChanged, createdAt
 *
 * usernames/{username_lowercase}  ← uniqueness reservation
 *   uid: string
 *
 * users/{uid}
 *   totalFocusMinutes: number   ← leaderboard score
 * ─────────────────────────────────────────
 */

const USERNAME_CHANGE_COOLDOWN_DAYS = 7;
const ensureProfileInFlight = new Map<string, Promise<UserProfile>>();

function generateCandidateUsername(): string {
  const num = Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;
  const prefixes = ["Focus", "Dhyan", "Samay", "Gyan", "Karma"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return `${prefix}${num}`;
}

async function generateUniqueUsername(): Promise<string> {
  const db = requireFirestore();
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = generateCandidateUsername();
    const snap = await getDoc(doc(db, "usernames", candidate.toLowerCase()));
    if (!snap.exists()) return candidate;
  }
  return `Focus${Date.now() % 100000}`;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = requireFirestore();
  const snap = await getDoc(doc(db, "userProfiles", uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as UserProfile;
}

export async function createInitialUserProfile(
  uid: string,
  fallback: { displayName?: string | null; email?: string | null; photoURL?: string | null }
): Promise<UserProfile> {
  const db = requireFirestore();
  console.log("[createInitialUserProfile] Starting for uid:", uid);
  const profileRef = doc(db, "userProfiles", uid);
  const snap = await getDoc(profileRef);
  if (snap.exists()) {
    console.log("[createInitialUserProfile] Profile already exists for uid:", uid);
    return { uid, ...snap.data() } as UserProfile;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const username = await generateUniqueUsername();
    const reservationKey = username.toLowerCase();

    const profile: Omit<UserProfile, "uid"> = {
      username,
      displayName: fallback.displayName || "",
      photoURL: fallback.photoURL || null,
      email: fallback.email || null,
      usernameLastChanged: null,
      goal: null,
      createdAt: serverTimestamp() as unknown as Timestamp,
    };

    try {
      console.log("[createInitialUserProfile] Attempt", attempt + 1, "- Creating profile for uid:", uid, "with username:", username);
      await runTransaction(db, async (tx) => {
        const profileSnap = await tx.get(profileRef);
        if (profileSnap.exists()) {
          console.log("[createInitialUserProfile] Profile already exists during transaction for uid:", uid);
          return;
        }
        const reservationSnap = await tx.get(doc(db, "usernames", reservationKey));
        if (reservationSnap.exists()) throw new Error("collision");
        tx.set(profileRef, profile);
        console.log("[createInitialUserProfile] Set profile for uid:", uid);
        tx.set(doc(db, "usernames", reservationKey), { uid });
        console.log("[createInitialUserProfile] Reserved username:", username);
        tx.set(doc(db, "users", uid), { totalFocusMinutes: 0, displayName: profile.displayName || "Anonymous" }, { merge: true });
        console.log("[createInitialUserProfile] Created users doc with displayName:", profile.displayName || "Anonymous", "for uid:", uid);
      });
      const final = await getDoc(profileRef);
      console.log("[createInitialUserProfile] Successfully created profile for uid:", uid);
      return { uid, ...final.data() } as UserProfile;
    } catch (err: any) {
      console.warn("[createInitialUserProfile] Attempt", attempt + 1, "failed - uid:", uid, "error:", err?.message);
      if (err?.code === "already-exists") {
        const existing = await getDoc(profileRef);
        if (existing.exists()) return { uid, ...existing.data() } as UserProfile;
        if (attempt < 2) continue;
      }
      if (err?.message === "collision" && attempt < 2) continue;
      console.error("[createInitialUserProfile] Final error for uid:", uid, "error:", err?.message);
      throw err;
    }
  }
  throw new Error("Failed to assign a unique username after 3 attempts");
}

export async function ensureUserProfile(
  uid: string,
  fallback: { displayName?: string | null; email?: string | null; photoURL?: string | null }
): Promise<UserProfile> {
  const existing = ensureProfileInFlight.get(uid);
  if (existing) return existing;

  const request = (async () => {
    const db = requireFirestore();
    const profileRef = doc(db, "userProfiles", uid);
    const snap = await getDoc(profileRef);
    if (!snap.exists()) return createInitialUserProfile(uid, fallback);
    const data = snap.data() as Partial<UserProfile>;
    if (typeof data.username === "string" && data.username.trim()) {
      return { uid, ...snap.data() } as UserProfile;
    }
    return createInitialUserProfile(uid, fallback);
  })();

  ensureProfileInFlight.set(uid, request);
  try { return await request; } finally { ensureProfileInFlight.delete(uid); }
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const db = requireFirestore();
  const snap = await getDoc(doc(db, "usernames", username.toLowerCase()));
  return !snap.exists();
}

export type UsernameChangeResult =
  | { ok: true }
  | { ok: false; reason: "taken" | "cooldown" | "same" | "invalid" };

export async function changeUsername(uid: string, newUsername: string): Promise<UsernameChangeResult> {
  const db = requireFirestore();
  const trimmed = newUsername.trim();
  if (trimmed.length < 3) return { ok: false, reason: "invalid" };

  const profileRef = doc(db, "userProfiles", uid);
  const newKey = trimmed.toLowerCase();

  try {
    await runTransaction(db, async (tx) => {
      const profileSnap = await tx.get(profileRef);
      const profile = profileSnap.data() as UserProfile | undefined;
      if (!profile) throw Object.assign(new Error("no-profile"), { code: "no-profile" });
      if (profile.username.toLowerCase() === newKey) throw Object.assign(new Error("same"), { code: "same" });

      if (profile.usernameLastChanged) {
        const elapsed = Date.now() - profile.usernameLastChanged.toMillis();
        if (elapsed < USERNAME_CHANGE_COOLDOWN_DAYS * 86400000) {
          throw Object.assign(new Error("cooldown"), { code: "cooldown" });
        }
      }

      const oldKey = profile.username.toLowerCase();
      const [oldSnap, newSnap] = await Promise.all([
        tx.get(doc(db, "usernames", oldKey)),
        tx.get(doc(db, "usernames", newKey)),
      ]);
      if (newSnap.exists() && newSnap.data()?.uid !== uid) {
        throw Object.assign(new Error("taken"), { code: "taken" });
      }
      if (oldSnap.exists()) tx.delete(doc(db, "usernames", oldKey));
      tx.set(doc(db, "usernames", newKey), { uid });
      tx.update(profileRef, { username: trimmed, usernameLastChanged: serverTimestamp() });
    });
    return { ok: true };
  } catch (err: any) {
    const code = err?.code ?? err?.message;
    if (code === "taken") return { ok: false, reason: "taken" };
    if (code === "cooldown") return { ok: false, reason: "cooldown" };
    if (code === "same") return { ok: false, reason: "same" };
    throw err;
  }
}

export async function updateDisplayName(uid: string, displayName: string): Promise<void> {
  const db = requireFirestore();
  await setDoc(doc(db, "userProfiles", uid), { displayName }, { merge: true });
}

export async function updateGoal(uid: string, goal: string): Promise<void> {
  const db = requireFirestore();
  await setDoc(doc(db, "userProfiles", uid), { goal }, { merge: true });
}

export function cooldownDaysRemaining(usernameLastChanged: Timestamp | null): number {
  if (!usernameLastChanged) return 0;
  const elapsed = Date.now() - usernameLastChanged.toMillis();
  const remaining = USERNAME_CHANGE_COOLDOWN_DAYS * 86400000 - elapsed;
  return remaining > 0 ? Math.ceil(remaining / 86400000) : 0;
}
