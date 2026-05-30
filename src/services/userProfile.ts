import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { requireFirestore } from "@/firebase";

export type UserProfile = {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string | null;
  email: string | null;
  usernameLastChanged: FirebaseFirestoreTypes.Timestamp | null;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  goal: string | null;
};

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
    const snap = await db.collection("usernames").doc(candidate.toLowerCase()).get();
    if (!snap.exists()) return candidate;
  }
  return `Focus${Date.now() % 100000}`;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = requireFirestore();
  const snap = await db.collection("userProfiles").doc(uid).get();
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as UserProfile;
}

export async function createInitialUserProfile(
  uid: string,
  fallback: { displayName?: string | null; email?: string | null; photoURL?: string | null }
): Promise<UserProfile> {
  const db = requireFirestore();
  console.log("[createInitialUserProfile] Starting for uid:", uid);
  const profileRef = db.collection("userProfiles").doc(uid);
  const snap = await profileRef.get();
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
      createdAt: firestore.FieldValue.serverTimestamp() as unknown as FirebaseFirestoreTypes.Timestamp,
    };

    try {
      console.log("[createInitialUserProfile] Attempt", attempt + 1, "- Creating profile for uid:", uid, "with username:", username);
      await db.runTransaction(async (tx) => {
        const profileSnap = await tx.get(profileRef);
        if (profileSnap.exists()) {
          console.log("[createInitialUserProfile] Profile already exists during transaction for uid:", uid);
          return;
        }
        const reservationRef = db.collection("usernames").doc(reservationKey);
        const reservationSnap = await tx.get(reservationRef);
        if (reservationSnap.exists()) throw new Error("collision");
        tx.set(profileRef, profile);
        tx.set(reservationRef, { uid });
        tx.set(
          db.collection("users").doc(uid),
          { totalFocusMinutes: 0, displayName: profile.displayName || "Anonymous" },
          { merge: true }
        );
      });
      const final = await profileRef.get();
      console.log("[createInitialUserProfile] Successfully created profile for uid:", uid);
      return { uid, ...final.data() } as UserProfile;
    } catch (err: any) {
      console.warn("[createInitialUserProfile] Attempt", attempt + 1, "failed - uid:", uid, "error:", err?.message);
      if (err?.code === "already-exists") {
        const existing = await profileRef.get();
        if (existing.exists()) return { uid, ...existing.data() } as UserProfile;
        if (attempt < 2) continue;
      }
      if (err?.message === "collision" && attempt < 2) continue;
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
    const profileRef = db.collection("userProfiles").doc(uid);
    const snap = await profileRef.get();
    if (!snap.exists()) return createInitialUserProfile(uid, fallback);
    const data = snap.data() as Partial<UserProfile> | undefined;
    if (typeof data?.username === "string" && data.username.trim()) {
      return { uid, ...snap.data() } as UserProfile;
    }
    return createInitialUserProfile(uid, fallback);
  })();

  ensureProfileInFlight.set(uid, request);
  try { return await request; } finally { ensureProfileInFlight.delete(uid); }
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const db = requireFirestore();
  const snap = await db.collection("usernames").doc(username.toLowerCase()).get();
  return !snap.exists();
}

export type UsernameChangeResult =
  | { ok: true }
  | { ok: false; reason: "taken" | "cooldown" | "same" | "invalid" };

export async function changeUsername(uid: string, newUsername: string): Promise<UsernameChangeResult> {
  const db = requireFirestore();
  const trimmed = newUsername.trim();
  if (trimmed.length < 3) return { ok: false, reason: "invalid" };

  const profileRef = db.collection("userProfiles").doc(uid);
  const newKey = trimmed.toLowerCase();

  try {
    await db.runTransaction(async (tx) => {
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
      const oldRef = db.collection("usernames").doc(oldKey);
      const newRef = db.collection("usernames").doc(newKey);
      const oldSnap = await tx.get(oldRef);
      const newSnap = await tx.get(newRef);
      if (newSnap.exists() && newSnap.data()?.uid !== uid) {
        throw Object.assign(new Error("taken"), { code: "taken" });
      }
      if (oldSnap.exists()) tx.delete(oldRef);
      tx.set(newRef, { uid });
      tx.update(profileRef, {
        username: trimmed,
        usernameLastChanged: firestore.FieldValue.serverTimestamp(),
      });
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
  await db.collection("userProfiles").doc(uid).set({ displayName }, { merge: true });
}

export async function updateGoal(uid: string, goal: string): Promise<void> {
  const db = requireFirestore();
  await db.collection("userProfiles").doc(uid).set({ goal }, { merge: true });
}

export function cooldownDaysRemaining(usernameLastChanged: FirebaseFirestoreTypes.Timestamp | null): number {
  if (!usernameLastChanged) return 0;
  const elapsed = Date.now() - usernameLastChanged.toMillis();
  const remaining = USERNAME_CHANGE_COOLDOWN_DAYS * 86400000 - elapsed;
  return remaining > 0 ? Math.ceil(remaining / 86400000) : 0;
}
