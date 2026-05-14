import { useEffect, useState } from "react";
import { onAuthStateChanged, onIdTokenChanged, User } from "firebase/auth";
import { auth } from "@/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[useAuth] subscribing to auth state');
    let unsubAuth: () => void;
    let unsubToken: () => void;
    try {
      unsubAuth = onAuthStateChanged(auth, (u) => {
        console.log('[useAuth] onAuthStateChanged — user:', u?.uid ?? 'null');
        setUser(u ? { ...u } : null);
        setLoading(false);
      }, (err) => {
        console.error('[useAuth] onAuthStateChanged error:', err?.message);
        setLoading(false);
      });
      unsubToken = onIdTokenChanged(auth, (u) => {
        console.log('[useAuth] onIdTokenChanged — user:', u?.uid ?? 'null');
        setUser(u ? { ...u } : null);
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
