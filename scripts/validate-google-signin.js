#!/usr/bin/env node

/**
 * Google Sign-In Configuration Validator
 * Run: node scripts/validate-google-signin.js
 * 
 * This script verifies all Google Sign-In configuration before building
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env");
const GOOGLE_SERVICES_FILE = path.join(ROOT, "android/app/google-services.json");
const APP_JSON = path.join(ROOT, "app.json");

console.log("\n📋 GOOGLE SIGN-IN CONFIGURATION VALIDATOR\n");
console.log("=" .repeat(60));

let isValid = true;

// Check 1: .env file exists
console.log("\n✓ Checking .env file...");
if (!fs.existsSync(ENV_FILE)) {
  console.error("  ❌ .env file not found at " + ENV_FILE);
  isValid = false;
} else {
  console.log("  ✓ .env file found");

  const envContent = fs.readFileSync(ENV_FILE, "utf-8");

  // Check webClientId
  const webClientIdMatch = envContent.match(/EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=(.+)/);
  if (!webClientIdMatch) {
    console.error("  ❌ EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID not set in .env");
    isValid = false;
  } else {
    const webClientId = webClientIdMatch[1].trim();
    console.log("  ✓ EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is set");

    // Validate format
    if (!webClientId.includes(".apps.googleusercontent.com")) {
      console.error("    ❌ Invalid format (missing '.apps.googleusercontent.com')");
      isValid = false;
    } else {
      console.log("    ✓ Valid OAuth client ID format");

      // Check if it's the web client, not android
      if (webClientId.includes("2s23ttfqs2pt8snkrlo7ffk5rmrr4uiq")) {
        console.error("    ❌ This appears to be the ANDROID client ID, not the WEB client ID!");
        console.error("    ❌ Use: 54974357437-65bmm8pjvenchausg26siseo8mnn0jfj.apps.googleusercontent.com");
        isValid = false;
      } else if (webClientId.includes("65bmm8pjvenchausg26siseo8mnn0jfj")) {
        console.log("    ✓ Correct WEB client ID");
      }
    }
  }

  // Check Firebase config
  console.log("\n✓ Checking Firebase configuration in .env...");
  const requiredKeys = [
    "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    "EXPO_PUBLIC_FIREBASE_API_KEY",
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "EXPO_PUBLIC_FIREBASE_APP_ID",
  ];

  requiredKeys.forEach((key) => {
    if (envContent.includes(key + "=")) {
      console.log("  ✓ " + key + " is set");
    } else {
      console.error("  ❌ " + key + " is missing");
      isValid = false;
    }
  });
}

// Check 2: google-services.json exists
console.log("\n✓ Checking google-services.json...");
if (!fs.existsSync(GOOGLE_SERVICES_FILE)) {
  console.error("  ❌ google-services.json not found at " + GOOGLE_SERVICES_FILE);
  isValid = false;
} else {
  console.log("  ✓ google-services.json found");

  try {
    const googleServices = JSON.parse(fs.readFileSync(GOOGLE_SERVICES_FILE, "utf-8"));

    // Check project info
    if (googleServices.project_info?.project_id === "samay-cbcdd") {
      console.log("  ✓ Project ID matches: samay-cbcdd");
    } else {
      console.error("  ❌ Project ID mismatch");
      isValid = false;
    }

    // Check package name
    const packageName = googleServices.client?.[0]?.client_info?.android_client_info?.package_name;
    if (packageName === "com.samay.app") {
      console.log("  ✓ Package name matches: com.samay.app");
    } else {
      console.error("  ❌ Package name mismatch. Expected 'com.samay.app', got '" + packageName + "'");
      isValid = false;
    }

    // Check SHA1
    const sha1 = googleServices.client?.[0]?.oauth_client?.[0]?.android_info?.certificate_hash;
    if (sha1) {
      console.log("  ✓ SHA1 fingerprint found: " + sha1.substring(0, 20) + "...");
    } else {
      console.error("  ⚠️  SHA1 fingerprint not found in google-services.json");
    }

    // Check OAuth clients
    const oauthClients = googleServices.client?.[0]?.oauth_client || [];
    console.log("  ✓ Found " + oauthClients.length + " OAuth client(s)");
    
    oauthClients.forEach((client, i) => {
      const type = client.client_type === 1 ? "Android" : client.client_type === 3 ? "Web" : "Unknown";
      console.log("    - " + type + " client: " + client.client_id.substring(0, 30) + "...");
    });
  } catch (error) {
    console.error("  ❌ Failed to parse google-services.json: " + error.message);
    isValid = false;
  }
}

// Check 3: app.json configuration
console.log("\n✓ Checking app.json...");
try {
  const appJson = JSON.parse(fs.readFileSync(APP_JSON, "utf-8"));

  // Check Android package name
  const androidPackage = appJson.expo?.android?.package;
  if (androidPackage === "com.samay.app") {
    console.log("  ✓ Android package name matches: com.samay.app");
  } else {
    console.error("  ❌ Android package name mismatch. Expected 'com.samay.app', got '" + androidPackage + "'");
    isValid = false;
  }

  // Check google-services.json reference
  const googleServicesPath = appJson.expo?.android?.googleServicesFile;
  if (googleServicesPath?.includes("google-services.json")) {
    console.log("  ✓ googleServicesFile configured: " + googleServicesPath);
  } else {
    console.warn("  ⚠️  googleServicesFile not properly configured");
  }

  // Check plugins
  const plugins = appJson.expo?.plugins || [];
  if (plugins.some((p) => p === "@react-native-google-signin/google-signin" || 
                            (Array.isArray(p) && p[0] === "@react-native-google-signin/google-signin"))) {
    console.log("  ✓ @react-native-google-signin/google-signin plugin configured");
  } else {
    console.warn("  ⚠️  @react-native-google-signin/google-signin plugin not found");
  }
} catch (error) {
  console.error("  ❌ Failed to parse app.json: " + error.message);
  isValid = false;
}

// Summary
console.log("\n" + "=".repeat(60));
if (isValid) {
  console.log("✅ All validations passed! You're ready to build.");
} else {
  console.log("❌ Some validations failed. Please fix the issues above.");
  console.log("\nFor detailed setup instructions, see: GOOGLE_SIGNIN_FIX.md");
}
console.log("=".repeat(60) + "\n");

process.exit(isValid ? 0 : 1);
