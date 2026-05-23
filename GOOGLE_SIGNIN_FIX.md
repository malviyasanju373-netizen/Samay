# Google Sign-In DEVELOPER_ERROR Fix Guide

## Problem Summary
Your app was throwing `DEVELOPER_ERROR (code 10)` when attempting Google Sign-In. This error occurs when there's a mismatch between your app's configuration and Firebase's settings.

## Root Causes Fixed

### 1. ✅ Missing `offlineAccess: false` Configuration
**Issue**: The `GoogleSignin.configure()` call was missing the `offlineAccess: false` option, which is required when using a web client ID for Firebase authentication.

**Fixed in**: [src/screens/AuthChoiceScreen.tsx](src/screens/AuthChoiceScreen.tsx#L85-L90)

```typescript
// BEFORE (❌ Missing offlineAccess)
googleSignInModule.GoogleSignin.configure({ 
  webClientId: googleWebClientId,
});

// AFTER (✅ Correct configuration)
googleSignInModule.GoogleSignin.configure({ 
  webClientId: googleWebClientId,
  offlineAccess: false,
  forceCodeForRefreshToken: false,
});
```

### 2. ✅ Enhanced Diagnostic Logging
**New files created**:
- [src/utils/googleSignInDiagnostics.ts](src/utils/googleSignInDiagnostics.ts) - Configuration validation utility
- Automatic diagnostics run on app startup (development only)

### 3. ✅ Detailed Error Logging
**Improvements**:
- Full error object logging in catch handler
- Specific DEVELOPER_ERROR (code 10) handling with diagnostic checklist
- Token extraction and validation logging
- Firebase credential creation logging

## Verification Checklist

### Step 1: Verify Firebase Project Configuration
Go to [Firebase Console](https://console.firebase.google.com/):

1. Select your project: **samay-cbcdd**
2. Navigate to **Authentication** > **Sign-in method**
3. Ensure **Google** provider is **ENABLED** ✓
4. If not enabled, click Enable and Save

### Step 2: Verify SHA1 Fingerprint

Your app's SHA1 fingerprint must match Firebase records.

**Current SHA1 in google-services.json:**
```
f8532527d22d56bb32b3a8ab4776e244cbe034d7
```

**To verify your actual app's SHA1:**

On Windows PowerShell:
```powershell
# For development build
$ANDROID_HOME = "${env:LOCALAPPDATA}\Android\sdk"
& "$ANDROID_HOME\platform-tools\keytool" -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android | Select-String "SHA1"
```

**Expected output** should show the SHA1 above.

**If SHA1 doesn't match:**
1. Go to Firebase Console > Project Settings > Your Apps > Android
2. Update the SHA1 fingerprint
3. Download fresh `google-services.json`
4. Replace `android/app/google-services.json`
5. Rebuild the app

### Step 3: Verify google-services.json

**File location**: `android/app/google-services.json`

**Expected contents** (key sections):
```json
{
  "project_info": {
    "project_number": "54974357437",
    "project_id": "samay-cbcdd"
  },
  "client": [
    {
      "client_info": {
        "android_client_info": {
          "package_name": "com.samay.app"
        }
      }
    }
  ]
}
```

### Step 4: Verify Environment Variables

**File location**: `.env`

**Must contain** (for web client ID):
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=54974357437-65bmm8pjvenchausg26siseo8mnn0jfj.apps.googleusercontent.com
```

⚠️ **Important**: This MUST be the **Web OAuth 2.0 Client ID**, NOT the Android Client ID.

**Android Client ID** (wrong for webClientId):
```
54974357437-2s23ttfqs2pt8snkrlo7ffk5rmrr4uiq.apps.googleusercontent.com  ❌ DON'T USE THIS
```

### Step 5: Verify Firebase Credentials

**File location**: `.env`

Verify all keys are present:
```
EXPO_PUBLIC_FIREBASE_PROJECT_ID=samay-cbcdd
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyABmqsihcbG23Ilj35CWWJ0xr9OS5hZJ-8
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=samay-cbcdd.firebaseapp.com
EXPO_PUBLIC_FIREBASE_APP_ID=1:54974357437:web:112b2bd133fd61f564fcd4
```

### Step 6: Rebuild with Fresh Configuration

```bash
# Clear expo cache and rebuild
eas build --platform android --clean

# OR for development build:
expo run:android --clean

# OR if using dev client:
npx expo run:android --clean
```

## Console Logs to Expect

When the app starts, you should see diagnostic output:

```
=== GOOGLE SIGN-IN CONFIGURATION DIAGNOSTICS ===
✅ Google Sign-In configuration appears valid!

=== EXPECTED CONFIGURATION ===
Package Name: com.samay.app
Project ID: samay-cbcdd
Project Number: 54974357437
Web Client ID: 54974357437-65bmm8pjvenchausg26siseo8mnn0jfj.apps.googleusercontent.com
Android SHA1: f8532527d22d56bb32b3a8ab4776e244cbe034d7
```

During successful Google Sign-In:
```
[GoogleSignIn] hasPlayServices check starting...
[GoogleSignIn] ✓ Play Services available, signing in...
[GoogleSignIn] User signed in successfully
[GoogleSignIn] ✓ Credential created, signing in to Firebase...
[GoogleSignIn] ✓ Firebase sign-in successful
[GoogleSignIn] ✓ Sign-in successful for user: xxx@gmail.com
```

## Troubleshooting DEVELOPER_ERROR (Code 10)

If you still see `DEVELOPER_ERROR`, check console logs for:

```
[GoogleSignIn] SIGN-IN ERROR {
  errorCode: 10,
  errorMessage: "DEVELOPER_ERROR"
}
```

**Diagnostic checklist from console**:
1. Verify webClientId is correct (Web OAuth 2.0 Client ID, not Android)
2. Ensure SHA1 fingerprint in Firebase Console matches app
3. Check Firebase Authentication has Google provider enabled
4. Verify google-services.json is up to date
5. Confirm offlineAccess is set to false
6. Try clearing app data and rebuilding

### Common Causes:

| Error | Cause | Fix |
|-------|-------|-----|
| DEVELOPER_ERROR (code 10) | Wrong client ID | Use Web Client ID, not Android Client ID |
| DEVELOPER_ERROR (code 10) | SHA1 mismatch | Update SHA1 in Firebase, download new google-services.json |
| DEVELOPER_ERROR (code 10) | Google provider disabled | Enable Google auth in Firebase Console |
| SIGN_IN_CANCELLED | User cancelled | No fix needed, user interaction |
| PLAY_SERVICES_NOT_AVAILABLE | Google Play not installed | Install Google Play Store on device |

## Files Modified

1. **[src/screens/AuthChoiceScreen.tsx](src/screens/AuthChoiceScreen.tsx)**
   - Added `offlineAccess: false` to GoogleSignin.configure()
   - Added `forceCodeForRefreshToken: false`
   - Enhanced error logging with diagnostic checklist
   - Added detailed logging at each step of sign-in process

2. **[src/utils/googleSignInDiagnostics.ts](src/utils/googleSignInDiagnostics.ts)** (NEW)
   - Configuration validation utility
   - Auto-runs on app startup in development mode
   - Provides diagnostic output and checklist

## Next Steps

1. Review the console logs when running `npx expo run:android`
2. Verify all items in the "Verification Checklist" above
3. Rebuild the app with `--clean` flag
4. Test Google Sign-In and watch console for detailed logs
5. If still failing, share console logs showing the DEVELOPER_ERROR details

## Testing

Run the app and test the Google Sign-In flow:

```bash
npx expo run:android --clean
```

Check the logs in VS Code terminal or Android Studio logcat.

---

**Summary of fixes**:
- ✅ GoogleSignin.configure() now includes `offlineAccess: false`
- ✅ Added comprehensive diagnostic logging
- ✅ Enhanced error messages with troubleshooting steps
- ✅ Created verification utility for configuration validation
