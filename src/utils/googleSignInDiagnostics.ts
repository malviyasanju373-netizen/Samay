/**
 * Google Sign-In Configuration Diagnostics
 * This utility helps verify that Google Sign-In is properly configured
 */

export const EXPECTED_CONFIG = {
  // From google-services.json
  packageName: "com.samay.app",
  projectNumber: "54974357437",
  projectId: "samay-cbcdd",
  
  // Android app OAuth client
  androidClientId: "54974357437-2s23ttfqs2pt8snkrlo7ffk5rmrr4uiq.apps.googleusercontent.com",
  androidSHA1: "f8532527d22d56bb32b3a8ab4776e244cbe034d7",
  
  // Web OAuth client (this is what should be used as webClientId)
  webClientId: "54974357437-65bmm8pjvenchausg26siseo8mnn0jfj.apps.googleusercontent.com",
};

export function validateGoogleSignInConfig(
  webClientId: string | undefined,
  env: Record<string, string | undefined>
): { valid: boolean; issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check if webClientId is set
  if (!webClientId) {
    issues.push("CRITICAL: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set in .env");
    return { valid: false, issues, warnings };
  }

  // Check webClientId format
  if (!webClientId.includes(".apps.googleusercontent.com")) {
    issues.push("CRITICAL: webClientId format is invalid. Should end with '.apps.googleusercontent.com'");
  }

  // Check if using correct client type (should be web, not android)
  if (webClientId.startsWith(EXPECTED_CONFIG.androidClientId)) {
    issues.push(
      "CRITICAL: You're using the Android Client ID as webClientId!\n" +
      "✓ Correct web client ID: " + EXPECTED_CONFIG.webClientId + "\n" +
      "✗ You're using: " + webClientId
    );
  }

  // Verify it matches expected web client
  if (webClientId !== EXPECTED_CONFIG.webClientId) {
    warnings.push(
      "WARNING: webClientId doesn't match expected value from google-services.json\n" +
      "Expected: " + EXPECTED_CONFIG.webClientId + "\n" +
      "Got: " + webClientId
    );
  }

  // Check Firebase config
  const firebaseConfig = {
    apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };

  const missingFirebaseKeys = Object.entries(firebaseConfig)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingFirebaseKeys.length > 0) {
    issues.push(`Missing Firebase config keys: ${missingFirebaseKeys.join(", ")}`);
  }

  // Check project ID consistency
  if (env.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== EXPECTED_CONFIG.projectId) {
    warnings.push(
      `Firebase project ID mismatch. Expected: ${EXPECTED_CONFIG.projectId}, ` +
      `Got: ${env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}`
    );
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
  };
}

export function logGoogleSignInDiagnostics() {
  if (typeof process === "undefined" || !process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
    console.log("[GoogleSignInDiagnostics] Running in environment without full config");
    return;
  }

  const validation = validateGoogleSignInConfig(
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    process.env as Record<string, string | undefined>
  );

  console.log("\n=== GOOGLE SIGN-IN CONFIGURATION DIAGNOSTICS ===\n");

  if (validation.issues.length > 0) {
    console.error("❌ CRITICAL ISSUES FOUND:");
    validation.issues.forEach((issue) => console.error("  - " + issue));
  }

  if (validation.warnings.length > 0) {
    console.warn("⚠️  WARNINGS:");
    validation.warnings.forEach((warning) => console.warn("  - " + warning));
  }

  if (validation.valid && validation.warnings.length === 0) {
    console.log("✅ Google Sign-In configuration appears valid!");
  }

  console.log("\n=== EXPECTED CONFIGURATION ===");
  console.log("Package Name:", EXPECTED_CONFIG.packageName);
  console.log("Project ID:", EXPECTED_CONFIG.projectId);
  console.log("Project Number:", EXPECTED_CONFIG.projectNumber);
  console.log("Web Client ID:", EXPECTED_CONFIG.webClientId);
  console.log("Android SHA1:", EXPECTED_CONFIG.androidSHA1);

  console.log("\n=== CHECKLIST FOR DEVELOPER_ERROR FIX ===");
  console.log(
    `
1. ✓ Verify firebase project (https://console.firebase.google.com/project/${EXPECTED_CONFIG.projectId})
   - Authentication > Google provider should be ENABLED
   - Ensure your account has access

2. ✓ Verify google-services.json is current
   - Download fresh from Firebase Console
   - Place in android/app/google-services.json
   - Verify SHA1 fingerprint: ${EXPECTED_CONFIG.androidSHA1}

3. ✓ Verify .env has correct webClientId
   - Should be: ${EXPECTED_CONFIG.webClientId}
   - NOT the Android Client ID

4. ✓ Verify AndroidManifest.xml
   - Package name should be: ${EXPECTED_CONFIG.packageName}
   - Should have internet permission

5. ✓ Verify build configuration
   - Run: npm run android -- --clean
   - This clears cache and rebuilds

6. ✓ Test with proper logging
   - Check console logs for DEVELOPER_ERROR details
   - Check Firebase console for authentication errors
`.trim()
  );

  console.log("\n");
}
