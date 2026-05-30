import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import firestore from "@react-native-firebase/firestore";
import { requireFirestore } from "@/firebase";

export function useOnlinePresence(uid?: string | null) {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!uid) return;
    appStateRef.current = AppState.currentState;
    lastOnlineRef.current = null;

    const writePresence = async (isOnline: boolean) => {
      if (lastOnlineRef.current === isOnline) return;
      lastOnlineRef.current = isOnline;

      try {
        const data: Record<string, any> = { isOnline };
        if (!isOnline) data.lastSeen = firestore.FieldValue.serverTimestamp();
        await requireFirestore().collection("users").doc(uid).set(data, { merge: true });
      } catch (error) {
        console.error("[useOnlinePresence] presence write failed:", error);
      }
    };

    writePresence(appStateRef.current === "active").catch(() => {});

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (appStateRef.current === nextState) return;
      const wasActive = appStateRef.current === "active";
      const isActive = nextState === "active";
      appStateRef.current = nextState;

      if (wasActive === isActive) return;
      writePresence(isActive).catch(() => {});
    });

    return () => {
      subscription.remove();
    };
  }, [uid]);
}
