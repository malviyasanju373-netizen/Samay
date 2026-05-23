import { useEffect, useState } from "react";
import { onAuthStateChanged, onIdTokenChanged, User } from "firebase/auth";
import { auth, firebaseInitError } from "@/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      if (firebaseInitError) console.warn("[useAuth] Firebase unavailable:", firebaseInitError);
      console.log("[useAuth] auth is null, setting user to null");
      setUser(null);
      setLoading(false);
      return;
    }
    console.log('[useAuth] subscribing to auth state');
    let unsubAuth: () => void;
    let unsubToken: () => void;
    try {
      unsubAuth = onAuthStateChanged(auth, (u) => {
        console.log('[useAuth] onAuthStateChanged — uid:', u?.uid ?? 'null');
        if (u?.uid) {
          console.log('[useAuth] User authenticated - uid:', u.uid);
        }
        setUser(u ? { ...u } : null);
        setLoading(false);
      }, (err) => {
        console.error('[useAuth] onAuthStateChanged error:', err?.message);
        setLoading(false);
      });
      unsubToken = onIdTokenChanged(auth, (u) => {
        console.log('[useAuth] onIdTokenChanged — uid:', u?.uid ?? 'null');
      }, (err) => {
        console.error('[useAuth] onIdTokenChanged error:', err?.message);
      });
    } catch (e: any) {
      console.error('[useAuth] subscription setup FAILED:', e?.message);
      setLoading(false);
    }
    return () => { unsubAuth?.(); unsubToken?.(); };
  }, []);

  return { user, loading };
}
