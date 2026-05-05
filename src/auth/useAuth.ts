import { useEffect, useState } from "react";
import { onAuthStateChanged, onIdTokenChanged, User } from "firebase/auth";
import { auth } from "@/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u ? { ...u } : null);
      setLoading(false);
    });
    const unsubToken = onIdTokenChanged(auth, (u) => {
      setUser(u ? { ...u } : null);
    });
    return () => { unsubAuth(); unsubToken(); };
  }, []);

  return { user, loading };
}
