import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import { auth } from "@/firebase";
import { ensureUserProfile, UserProfile } from "@/services/userProfile";
import { userProfileCacheService } from "@/storage/services";

const profileCache = new Map<string, UserProfile>();

type CachedUserProfile = Omit<UserProfile, "createdAt" | "usernameLastChanged"> & {
  createdAt: number | null;
  usernameLastChanged: number | null;
};

function toCachedProfile(p: UserProfile): CachedUserProfile {
  return {
    ...p,
    createdAt: p.createdAt?.toMillis?.() ?? null,
    usernameLastChanged: p.usernameLastChanged?.toMillis?.() ?? null,
  };
}

function fromCachedProfile(c: CachedUserProfile | null): UserProfile | null {
  if (!c || c.createdAt == null) return null;
  return {
    ...c,
    createdAt: Timestamp.fromMillis(c.createdAt),
    usernameLastChanged: c.usernameLastChanged != null ? Timestamp.fromMillis(c.usernameLastChanged) : null,
  };
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadForUser = useCallback(async (
    uid: string,
    fallback: { displayName?: string | null; email?: string | null; photoURL?: string | null },
    options?: { force?: boolean }
  ) => {
    const cached = profileCache.get(uid) ?? fromCachedProfile(await userProfileCacheService.get<CachedUserProfile>(uid));
    if (cached && !options?.force) {
      profileCache.set(uid, cached);
      setProfile(cached);
      setLoading(false);
      return cached;
    }
    setLoading(!cached);
    try {
      const p = await ensureUserProfile(uid, fallback);
      if (!p) { setProfile(cached ?? null); return cached ?? null; }
      profileCache.set(uid, p);
      await userProfileCacheService.set(uid, toCachedProfile(p));
      setProfile(p);
      return p;
    } catch (err: any) {
      console.error("[useUserProfile]", err?.message ?? err);
      if (cached) { setProfile(cached); return cached; }
      return null;
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!auth) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadForUser(user.uid, { displayName: user.displayName, email: user.email, photoURL: user.photoURL });
      } else {
        const lastUid = profile?.uid;
        setProfile(null);
        profileCache.clear();
        if (lastUid) userProfileCacheService.clear(lastUid).catch(() => {});
        setLoading(false);
      }
    });
    return unsub;
  }, [loadForUser, profile?.uid]);

  const reload = useCallback((): Promise<UserProfile | null> => {
    const user = auth?.currentUser;
    if (user) return loadForUser(user.uid, { displayName: user.displayName, email: user.email, photoURL: user.photoURL }, { force: true });
    return Promise.resolve(null);
  }, [loadForUser]);

  return { profile, loading, reload };
}
