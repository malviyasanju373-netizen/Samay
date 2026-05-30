import { useCallback, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, requireFirestore } from "@/firebase";

type DeleteAccountResult =
  | { success: true }
  | { success: false; code: "missing-password" | "missing-user" | "missing-email" | "offline" | "wrong-password" | "requires-recent-login" | "permission-denied" | "network-error" | "unknown"; message: string };

async function hasInternetConnection(): Promise<boolean> {
  try {
    const r = (await Promise.race([
      fetch("https://www.gstatic.com/generate_204", { method: "GET" }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
    ])) as Response;
    return r.ok;
  } catch { return false; }
}

function mapDeleteError(error: unknown): Exclude<DeleteAccountResult, { success: true }> {
  const code = typeof error === "object" && error && "code" in error ? String((error as any).code) : "";
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return { success: false, code: "wrong-password", message: "The password you entered is incorrect." };
    case "auth/requires-recent-login":
      return { success: false, code: "requires-recent-login", message: "For security, please sign in again and retry." };
    case "auth/network-request-failed":
      return { success: false, code: "network-error", message: "Network error. Check your connection and try again." };
    default:
      return { success: false, code: "unknown", message: "Couldn't delete your account right now. Please try again." };
  }
}

export function useDeleteAccount() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);

  const deleteAccountWithPassword = useCallback(async (password: string): Promise<DeleteAccountResult> => {
    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      const r: DeleteAccountResult = { success: false, code: "missing-password", message: "Enter your password to confirm account deletion." };
      setError(r.message);
      return r;
    }
    const user = auth().currentUser;
    if (!user) { const r: DeleteAccountResult = { success: false, code: "missing-user", message: "No signed-in user found." }; setError(r.message); return r; }
    if (!user.email) { const r: DeleteAccountResult = { success: false, code: "missing-email", message: "This account does not support password re-authentication." }; setError(r.message); return r; }

    setIsDeleting(true);
    setError(null);
    try {
      if (!(await hasInternetConnection())) {
        const r: DeleteAccountResult = { success: false, code: "offline", message: "Internet connection required to delete your account." };
        setError(r.message);
        return r;
      }
      const credential = auth.EmailAuthProvider.credential(user.email, trimmedPassword);
      await user.reauthenticateWithCredential(credential);
      const db = requireFirestore();
      await db.collection("users").doc(user.uid).delete();
      await db.collection("userProfiles").doc(user.uid).delete();
      await user.delete();
      await AsyncStorage.clear();
      return { success: true };
    } catch (err) {
      const mapped = mapDeleteError(err);
      setError(mapped.message);
      return mapped;
    } finally { setIsDeleting(false); }
  }, []);

  return { isDeleting, error, clearError, deleteAccountWithPassword };
}
