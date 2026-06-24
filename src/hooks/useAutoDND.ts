import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { auth } from "@/firebase";
import { getUserProfile } from "@/services/userProfile";
import {
  hasNotificationPolicyAccess,
  isDNDEnabled,
  getCurrentInterruptionFilter,
  enableDND,
  restoreInterruptionFilter,
  openNotificationPolicySettings,
  INTERRUPTION_FILTER_ALL,
} from "@/services/dnd";

type DNDState = {
  /** Whether DND is currently active (for UI indicator) */
  active: boolean;
  /** Whether the user has granted Notification Policy Access */
  permissionGranted: boolean;
  /** Whether we need to show the permission modal */
  needsPermissionModal: boolean;
  /** Call to dismiss the permission modal */
  dismissPermissionModal: () => void;
  /** Open system settings for DND permission */
  requestPermission: () => Promise<void>;
  /** Called when focus starts to enable DND */
  onFocusStart: () => Promise<void>;
  /** Called when focus ends to restore DND */
  onFocusEnd: () => Promise<void>;
};

export function useAutoDND(): DNDState {
  const [active, setActive] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [needsPermissionModal, setNeedsPermissionModal] = useState(false);
  const previousFilterRef = useRef<number>(INTERRUPTION_FILTER_ALL);
  const checkedPermissionRef = useRef(false);

  // Check permission on mount
  useEffect(() => {
    if (checkedPermissionRef.current) return;
    checkedPermissionRef.current = true;
    hasNotificationPolicyAccess().then((granted) => {
      setPermissionGranted(granted);
    }).catch(() => {});
  }, []);

  // Check if DND is already active on mount
  useEffect(() => {
    isDNDEnabled().then((enabled) => {
      setActive(enabled);
    }).catch(() => {});
  }, []);

  const dismissPermissionModal = useCallback(() => {
    setNeedsPermissionModal(false);
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const result = await openNotificationPolicySettings();
      console.log("[useAutoDND] Settings opened:", result);
      if (result !== "dnd_settings") {
        const messages: Record<string, string> = {
          notification_listener_settings:
            "Please enable 'Notification Access' for Samay in the Notification Listener settings.",
          app_settings:
            "Please go to your app's settings and enable 'Notification Access' or 'Do Not Disturb Access'.",
          general_settings:
            "Please go to Apps > Samay > Notification Access to enable Do Not Disturb permissions.",
        };
        Alert.alert(
          "Grant Notification Access",
          messages[result] ?? "Please enable Notification Access for Samay in your device settings.",
          [{ text: "OK" }]
        );
      }
      setNeedsPermissionModal(false);
    } catch (e: any) {
      console.error("[useAutoDND] requestPermission failed:", e?.message);
      Alert.alert(
        "Could Not Open Settings",
        "Please go to your device Settings > Apps > Samay > Notification Access to enable Do Not Disturb permissions.",
        [{ text: "OK" }]
      );
      setNeedsPermissionModal(false);
    }
  }, []);

  /**
   * Called when a focus session starts.
   * Saves the current DND state and enables DND if autoDND is enabled.
   */
  const onFocusStart = useCallback(async (): Promise<void> => {
    try {
      const uid = auth().currentUser?.uid;
      if (!uid) return;

      // Check if autoDND is enabled in user profile
      const profile = await getUserProfile(uid);
      if (!profile?.autoDND) return;

      // Check permission
      const granted = await hasNotificationPolicyAccess();
      setPermissionGranted(granted);

      if (!granted) {
        setNeedsPermissionModal(true);
        return;
      }

      // Save current interruption filter before enabling DND
      const currentFilter = await getCurrentInterruptionFilter();
      previousFilterRef.current = currentFilter;

      // Enable DND
      await enableDND();
      setActive(true);
    } catch (e: any) {
      if (e?.code === "PERMISSION_DENIED") {
        setNeedsPermissionModal(true);
        return;
      }
      console.warn("[useAutoDND] onFocusStart error:", e?.message);
    }
  }, []);

  /**
   * Called when a focus session ends.
   * Restores the previous DND state.
   */
  const onFocusEnd = useCallback(async (): Promise<void> => {
    try {
      const uid = auth().currentUser?.uid;
      if (!uid) return;

      const profile = await getUserProfile(uid);
      if (!profile?.autoDND) return;

      const granted = await hasNotificationPolicyAccess();
      if (!granted) return;

      // Restore the previous interruption filter
      await restoreInterruptionFilter(previousFilterRef.current);
      setActive(false);
    } catch (e: any) {
      console.warn("[useAutoDND] onFocusEnd error:", e?.message);
    }
  }, []);

  return {
    active,
    permissionGranted,
    needsPermissionModal,
    dismissPermissionModal,
    requestPermission,
    onFocusStart,
    onFocusEnd,
  };
}