import { NativeModules, Platform } from "react-native";

const { DNDModule } = NativeModules;

const INTERRUPTION_FILTER_ALL = 1;
const INTERRUPTION_FILTER_PRIORITY = 2;

// Diagnostic logs - run once at module import
console.log("[DND] Platform.OS:", Platform.OS);
console.log("[DND] NativeModules.DNDModule:", DNDModule);
console.log("[DND] NativeModules keys:", Object.keys(NativeModules));
if (DNDModule) {
  console.log("[DND] DNDModule methods:", Object.keys(DNDModule));
} else {
  console.warn("[DND] DNDModule is NULL - native module not registered!");
  console.warn("[DND] App must be rebuilt with 'npx expo run:android' to register DNDModule");
}

function isSupported(): boolean {
  const supported = Platform.OS === "android" && DNDModule != null;
  console.log("[DND] isSupported:", supported, "Platform:", Platform.OS, "Module:", !!DNDModule);
  return supported;
}

function rejectUnsupported(): never {
  const detail = !DNDModule
    ? "DNDModule native module not found. Rebuild with 'npx expo run:android'."
    : "DND is only supported on Android 6+ with Notification Policy Access";
  console.error("[DND] rejectUnsupported:", detail);
  throw new Error(detail);
}

/**
 * Check if the app has Notification Policy Access (required for DND control).
 */
export async function hasNotificationPolicyAccess(): Promise<boolean> {
  if (!isSupported()) return false;
  try {
    return await DNDModule.hasNotificationPolicyAccess();
  } catch {
    return false;
  }
}

/**
 * Check if DND is currently enabled on the device.
 */
export async function isDNDEnabled(): Promise<boolean> {
  if (!isSupported()) return false;
  try {
    return await DNDModule.isDNDEnabled();
  } catch {
    return false;
  }
}

/**
 * Get the current interruption filter value.
 * Returns the Android NotificationManager.INTERRUPTION_FILTER_* constant.
 */
export async function getCurrentInterruptionFilter(): Promise<number> {
  if (!isSupported()) return INTERRUPTION_FILTER_ALL;
  try {
    return await DNDModule.getCurrentInterruptionFilter();
  } catch {
    return INTERRUPTION_FILTER_ALL;
  }
}

/**
 * Enable DND by setting interruption filter to PRIORITY.
 * Requires Notification Policy Access.
 */
export async function enableDND(): Promise<boolean> {
  if (!isSupported()) rejectUnsupported();
  try {
    return await DNDModule.enableDND();
  } catch (e: any) {
    if (e?.code === "PERMISSION_DENIED") throw e;
    console.warn("[DND] enableDND failed:", e?.message);
    return false;
  }
}

/**
 * Disable DND by setting interruption filter to ALL.
 * Requires Notification Policy Access.
 */
export async function disableDND(): Promise<boolean> {
  if (!isSupported()) rejectUnsupported();
  try {
    return await DNDModule.disableDND();
  } catch (e: any) {
    if (e?.code === "PERMISSION_DENIED") throw e;
    console.warn("[DND] disableDND failed:", e?.message);
    return false;
  }
}

/**
 * Restore a previous interruption filter value.
 * Pass the filter value obtained from getCurrentInterruptionFilter().
 */
export async function restoreInterruptionFilter(filter: number): Promise<boolean> {
  if (!isSupported()) rejectUnsupported();
  try {
    return await DNDModule.setInterruptionFilter(filter);
  } catch (e: any) {
    if (e?.code === "PERMISSION_DENIED") throw e;
    console.warn("[DND] restoreInterruptionFilter failed:", e?.message);
    return false;
  }
}

/**
 * Open system settings for Notification Policy Access.
 * Returns one of:
 *   'dnd_settings' - DND-specific settings opened
 *   'notification_listener_settings' - Notification listener settings opened
 *   'app_settings' - App-specific settings opened
 *   'general_settings' - General system settings opened
 * Throws on failure.
 */
export async function openNotificationPolicySettings(): Promise<string> {
  if (!isSupported()) rejectUnsupported();
  try {
    console.log("[DND] Calling DNDModule.openNotificationPolicySettings()");
    const result: string = await DNDModule.openNotificationPolicySettings();
    console.log("[DND] Settings opened result:", result);
    return result;
  } catch (e: any) {
    console.warn("[DND] openNotificationPolicySettings failed:", e?.message);
    throw e;
  }
}

export { INTERRUPTION_FILTER_ALL, INTERRUPTION_FILTER_PRIORITY };