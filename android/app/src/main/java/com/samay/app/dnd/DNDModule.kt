package com.samay.app.dnd

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DNDModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "DNDModule"
    }

    override fun getName(): String = "DNDModule"

    private fun getNotificationManager(): NotificationManager? {
        return reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
    }

    @ReactMethod
    fun hasNotificationPolicyAccess(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                promise.resolve(false)
                return
            }
            val nm = getNotificationManager()
            promise.resolve(nm?.isNotificationPolicyAccessGranted ?: false)
        } catch (e: Exception) {
            Log.e(TAG, "hasNotificationPolicyAccess error", e)
            promise.reject("DND_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun isDNDEnabled(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                promise.resolve(false)
                return
            }
            val nm = getNotificationManager()
            val filter = nm?.currentInterruptionFilter ?: NotificationManager.INTERRUPTION_FILTER_ALL
            promise.resolve(filter != NotificationManager.INTERRUPTION_FILTER_ALL)
        } catch (e: Exception) {
            Log.e(TAG, "isDNDEnabled error", e)
            promise.reject("DND_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getCurrentInterruptionFilter(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                promise.resolve(NotificationManager.INTERRUPTION_FILTER_ALL)
                return
            }
            val nm = getNotificationManager()
            promise.resolve(nm?.currentInterruptionFilter ?: NotificationManager.INTERRUPTION_FILTER_ALL)
        } catch (e: Exception) {
            Log.e(TAG, "getCurrentInterruptionFilter error", e)
            promise.reject("DND_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun enableDND(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                promise.reject("UNSUPPORTED", "DND not supported on this device")
                return
            }
            val nm = getNotificationManager()
            if (nm == null) {
                promise.reject("DND_ERROR", "NotificationManager not available")
                return
            }
            if (!nm.isNotificationPolicyAccessGranted) {
                promise.reject("PERMISSION_DENIED", "Notification policy access not granted")
                return
            }
            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "enableDND error", e)
            promise.reject("DND_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun disableDND(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                promise.reject("UNSUPPORTED", "DND not supported on this device")
                return
            }
            val nm = getNotificationManager()
            if (nm == null) {
                promise.reject("DND_ERROR", "NotificationManager not available")
                return
            }
            if (!nm.isNotificationPolicyAccessGranted) {
                promise.reject("PERMISSION_DENIED", "Notification policy access not granted")
                return
            }
            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "disableDND error", e)
            promise.reject("DND_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setInterruptionFilter(filter: Int, promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                promise.reject("UNSUPPORTED", "DND not supported on this device")
                return
            }
            val nm = getNotificationManager()
            if (nm == null) {
                promise.reject("DND_ERROR", "NotificationManager not available")
                return
            }
            if (!nm.isNotificationPolicyAccessGranted) {
                promise.reject("PERMISSION_DENIED", "Notification policy access not granted")
                return
            }
            nm.setInterruptionFilter(filter)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "setInterruptionFilter error", e)
            promise.reject("DND_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openNotificationPolicySettings(promise: Promise) {
        val ctx = reactApplicationContext

        // Log device info for debugging
        Log.d(TAG, "========== DND SETTINGS DEBUG ==========")
        Log.d(TAG, "Manufacturer: ${Build.MANUFACTURER}")
        Log.d(TAG, "Brand: ${Build.BRAND}")
        Log.d(TAG, "Device: ${Build.DEVICE}")
        Log.d(TAG, "Model: ${Build.MODEL}")
        Log.d(TAG, "Android SDK: ${Build.VERSION.SDK_INT}")
        Log.d(TAG, "Android Release: ${Build.VERSION.RELEASE}")
        Log.d(TAG, "Context: $ctx")

        // Priority 1: ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            val resolveInfo = intent.resolveActivity(ctx.packageManager)
            Log.d(TAG, "ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS resolveActivity: $resolveInfo")
            if (resolveInfo != null) {
                ctx.startActivity(intent)
                Log.d(TAG, "ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS launched successfully")
                promise.resolve("dnd_settings")
                return
            } else {
                Log.d(TAG, "ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS not available (resolveActivity null)")
            }
        } catch (e: Exception) {
            Log.e(TAG, "ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS failed", e)
        }

        // Priority 2: ACTION_NOTIFICATION_LISTENER_SETTINGS
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            val resolveInfo = intent.resolveActivity(ctx.packageManager)
            Log.d(TAG, "ACTION_NOTIFICATION_LISTENER_SETTINGS resolveActivity: $resolveInfo")
            if (resolveInfo != null) {
                ctx.startActivity(intent)
                Log.d(TAG, "ACTION_NOTIFICATION_LISTENER_SETTINGS launched successfully")
                promise.resolve("notification_listener_settings")
                return
            } else {
                Log.d(TAG, "ACTION_NOTIFICATION_LISTENER_SETTINGS not available (resolveActivity null)")
            }
        } catch (e: Exception) {
            Log.e(TAG, "ACTION_NOTIFICATION_LISTENER_SETTINGS failed", e)
        }

        // Priority 3: ACTION_APPLICATION_DETAILS_SETTINGS (app-specific settings)
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            intent.data = android.net.Uri.parse("package:${ctx.packageName}")
            val resolveInfo = intent.resolveActivity(ctx.packageManager)
            Log.d(TAG, "ACTION_APPLICATION_DETAILS_SETTINGS resolveActivity: $resolveInfo")
            if (resolveInfo != null) {
                ctx.startActivity(intent)
                Log.d(TAG, "ACTION_APPLICATION_DETAILS_SETTINGS launched successfully")
                promise.resolve("app_settings")
                return
            } else {
                Log.d(TAG, "ACTION_APPLICATION_DETAILS_SETTINGS not available (resolveActivity null)")
            }
        } catch (e: Exception) {
            Log.e(TAG, "ACTION_APPLICATION_DETAILS_SETTINGS failed", e)
        }

        // Priority 4: ACTION_SETTINGS (general settings as last resort)
        try {
            val intent = Intent(Settings.ACTION_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            val resolveInfo = intent.resolveActivity(ctx.packageManager)
            Log.d(TAG, "ACTION_SETTINGS resolveActivity: $resolveInfo")
            if (resolveInfo != null) {
                ctx.startActivity(intent)
                Log.d(TAG, "ACTION_SETTINGS launched successfully")
                promise.resolve("general_settings")
                return
            } else {
                Log.d(TAG, "ACTION_SETTINGS not available (resolveActivity null)")
            }
        } catch (e: Exception) {
            Log.e(TAG, "ACTION_SETTINGS failed", e)
        }

        Log.e(TAG, "ALL INTENTS FAILED - no settings intent could be launched")
        promise.reject("DND_ERROR", "All settings intents failed")
    }
}
