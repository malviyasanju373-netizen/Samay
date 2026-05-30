import { useEffect, useState } from "react";
import type { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { auth } from "@/firebase";

export function useAuth() {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[useAuth] subscribing to auth state");
    let unsubAuth: (() => void) | undefined;
    let unsubToken: (() => void) | undefined;

    try {
      unsubAuth = auth().onAuthStateChanged(
        (nextUser) => {
          console.log("[useAuth] onAuthStateChanged - uid:", nextUser?.uid ?? "null");
          setUser(nextUser);
          setLoading(false);
        }
      );

      unsubToken = auth().onIdTokenChanged(
        (nextUser) => {
          console.log("[useAuth] onIdTokenChanged - uid:", nextUser?.uid ?? "null");
        }
      );
    } catch (error: any) {
      console.error("[useAuth] subscription setup FAILED:", error?.message);
      setLoading(false);
    }

    return () => {
      unsubAuth?.();
      unsubToken?.();
    };
  }, []);

  return { user, loading };
}
