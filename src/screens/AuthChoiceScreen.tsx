import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, ScrollView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import type {
  FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import { auth } from "@/firebase";
import { useTheme } from "@/context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createInitialUserProfile } from "@/services/userProfile";
import { userProfileCacheService } from "@/storage/services";
import AppDialog, { AppDialogButton } from "@/components/AppDialog";
import { logGoogleSignInDiagnostics } from "@/utils/googleSignInDiagnostics";

const WELCOME_BANNER_KEY = "WELCOME_BANNER_PENDING";
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// Run diagnostics on module load
if (__DEV__) {
  logGoogleSignInDiagnostics();
}

// Debug: Log environment loading
if (__DEV__) {
  console.log("[GoogleSignIn] Environment googleWebClientId:", googleWebClientId ? "✓ Found" : "✗ Missing");
}

const googleSignInModule = (() => {
  try {
    const module = require("@react-native-google-signin/google-signin") as typeof import("@react-native-google-signin/google-signin");
    if (__DEV__) {
      console.log("[GoogleSignIn] Module loaded successfully");
    }
    return module;
  } catch (error) {
    if (__DEV__) {
      console.error("[GoogleSignIn] Failed to load module:", error);
    }
    return null;
  }
})();

async function assignInitialProfileIfNeeded(user: any) {
  if (!user) return;
  console.log("[assignInitialProfileIfNeeded] Starting for uid:", user.uid);
  try {
    const profile = await createInitialUserProfile(user.uid, {
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
    });
    console.log("[assignInitialProfileIfNeeded] Profile created, uid:", user.uid, "username:", profile.username);
    await userProfileCacheService.set(user.uid, {
      ...profile,
      createdAt: profile.createdAt?.toMillis?.() ?? null,
      usernameLastChanged: profile.usernameLastChanged?.toMillis?.() ?? null,
    });
    console.log("[assignInitialProfileIfNeeded] Cache updated for uid:", user.uid);
  } catch (error: any) {
    console.error("[assignInitialProfileIfNeeded] Error for uid:", user.uid, "error:", error?.message);
    throw error;
  }
}

type DialogState = { title: string; message: string; buttons?: AppDialogButton[] };

export default function AuthChoiceScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const showDialog = (title: string, message: string, buttons?: AppDialogButton[]) =>
    setDialog({ title, message, buttons });
  const hideDialog = () => setDialog(null);

  useEffect(() => {
    try {
      if (__DEV__) {
        console.log("[GoogleSignIn] Setup starting...", {
          hasWebClientId: !!googleWebClientId,
          hasModule: !!googleSignInModule,
        });
      }

      if (!googleWebClientId) {
        if (__DEV__) {
          console.warn("[GoogleSignIn] Skipping setup: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set. Please add it to your .env file.");
        }
        return;
      }

      if (!googleSignInModule) {
        if (__DEV__) {
          console.warn("[GoogleSignIn] Skipping setup: Google Sign-In module not available");
        }
        return;
      }

      // Configure Google Sign-In
      googleSignInModule.GoogleSignin.configure({ 
        webClientId: googleWebClientId,
        offlineAccess: false,
        forceCodeForRefreshToken: false,
      });
      
      if (__DEV__) {
        console.log("[GoogleSignIn] ✓ Configured successfully", {
          webClientId: googleWebClientId ? googleWebClientId.substring(0, 20) + "..." : "NOT SET",
          offlineAccess: false,
        });
      }
      
      setGoogleConfigured(true);
    } catch (error) {
      if (__DEV__) {
        console.error("[GoogleSignIn] Configuration failed:", error);
      }
    }
  }, []);

  const handleGoogleLogin = async () => {
    if (!googleSignInModule || !googleConfigured) { 
      if (__DEV__) {
        console.warn("[GoogleSignIn] Cannot proceed with login:", {
          moduleAvailable: !!googleSignInModule,
          isConfigured: googleConfigured,
          webClientIdSet: !!googleWebClientId,
        });
      }
      showDialog("Unavailable", "Google Sign-In is not configured yet. Please check your .env file and ensure EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is set.");
      return;
    }
    if (auth().currentUser) { showDialog("Already Signed In", "You have an active session."); return; }
    
    if (__DEV__) {
      console.log("[GoogleSignIn] Starting sign-in process...");
    }
    
    setGoogleLoading(true);
    try {
      if (__DEV__) {
        console.log("[GoogleSignIn] hasPlayServices check starting...");
      }
      
      await googleSignInModule.GoogleSignin.hasPlayServices();
      
      if (__DEV__) {
        console.log("[GoogleSignIn] ✓ Play Services available, signing in...");
      }
      
      const userInfo = await googleSignInModule.GoogleSignin.signIn();

      if (userInfo.type === "cancelled") {
        if (__DEV__) {
          console.log("[GoogleSignIn] Sign-in cancelled by user");
        }
        return;
      }
      
      if (__DEV__) {
        console.log("[GoogleSignIn] User signed in successfully", {
          uid: userInfo.data.user.id ? userInfo.data.user.id.substring(0, 8) + "..." : "N/A",
          hasIdToken: !!userInfo.data.idToken,
          hasServerAuthCode: !!userInfo.data.serverAuthCode,
          userName: userInfo.data.user.name,
          userEmail: userInfo.data.user.email,
        });
      }
      
      const idToken = userInfo.data.idToken;
      
      if (__DEV__) {
        console.log("[GoogleSignIn] Extracted idToken", {
          tokenLength: idToken ? idToken.length : 0,
          tokenStart: idToken ? idToken.substring(0, 20) + "..." : "NO TOKEN",
        });
      }
      
      if (!idToken) { 
        if (__DEV__) {
          console.error("[GoogleSignIn] CRITICAL: No idToken received from Google. userInfo:", JSON.stringify(userInfo, null, 2));
        }
        showDialog("Sign-In Failed", "Could not get a valid token. Please try again."); 
        return; 
      }
      
      if (__DEV__) {
        console.log("[GoogleSignIn] Creating Firebase credential...");
      }
      
      const credential = auth.GoogleAuthProvider.credential(idToken);
      
      if (__DEV__) {
        console.log("[GoogleSignIn] ✓ Credential created, signing in to Firebase...");
      }
      
      let result;
      try {
        if (__DEV__) {
          console.log("[GoogleSignIn:signInWithCredential] Calling auth().signInWithCredential()...", {
            idTokenExists: !!idToken,
            idTokenLength: idToken?.length ?? 0,
            firebaseProjectId: auth().app.options?.projectId ?? "unknown",
            webClientId: googleWebClientId ? googleWebClientId.substring(0, 40) + "..." : "NOT SET",
          });
        }
        
        result = await auth().signInWithCredential(credential);
      } catch (error: any) {
        if (__DEV__) {
          console.group("[GoogleSignIn:signInWithCredential] ❌ FAILED");
          console.error("error.code:", error?.code ?? "undefined");
          console.error("error.message:", error?.message ?? "undefined");
          console.error("full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
          console.error("Firebase project ID:", auth().app.options?.projectId ?? "unknown");
          console.error("webClientId being used:", googleWebClientId ?? "NOT SET");
          console.error("idToken exists:", !!idToken);
          console.error("idToken length:", idToken?.length ?? 0);
          console.groupEnd();
        }
        throw error;
      }

      const user = result.user;
      const additionalUserInfo = (result as FirebaseAuthTypes.UserCredential & {
        additionalUserInfo?: { isNewUser?: boolean };
      }).additionalUserInfo;
      
      if (__DEV__) {
        console.log("[GoogleSignIn] ✓ Firebase sign-in successful", {
          uid: user.uid ? user.uid.substring(0, 8) + "..." : "N/A",
          email: user.email,
          isNewUser: additionalUserInfo?.isNewUser,
        });
      }
      
      // Always ensure profile exists (not just for new users)
      const isNewUser = additionalUserInfo?.isNewUser;
      console.log("[GoogleSignIn] Auth uid:", user.uid, "isNewUser:", isNewUser);
      await assignInitialProfileIfNeeded(user);
      
      const name = user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "User";
      await AsyncStorage.setItem(WELCOME_BANNER_KEY, name);
      
      if (__DEV__) {
        console.log("[GoogleSignIn] ✓ Sign-in successful for user:", user?.email);
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error("[GoogleSignIn] SIGN-IN ERROR", {
          errorCode: error?.code,
          errorMessage: error?.message,
          errorFullObject: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        });
      }
      
      if (error.code === googleSignInModule.statusCodes.SIGN_IN_CANCELLED) {
        if (__DEV__) {
          console.log("[GoogleSignIn] Sign-in cancelled by user");
        }
        return;
      }
      if (error.code === googleSignInModule.statusCodes.IN_PROGRESS) { 
        showDialog("In Progress", "A sign-in attempt is already underway."); 
        return; 
      }
      if (error.code === googleSignInModule.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) { 
        showDialog("Google Play Required", "Google Play Services are not available."); 
        return; 
      }
      
      // Additional debugging for DEVELOPER_ERROR
      if (error.code === 10 || error.message?.includes("DEVELOPER_ERROR")) {
        if (__DEV__) {
          console.error("[GoogleSignIn] DEVELOPER_ERROR (code 10) - This typically means:", {
            checkList: [
              "1. Verify webClientId is correct (Web OAuth 2.0 Client ID, not Android)",
              "2. Ensure SHA1 fingerprint in firebase-console matches app",
              "3. Check Firebase Authentication has Google provider enabled",
              "4. Verify google-services.json is up to date",
              "5. Confirm offlineAccess is set to false",
              "6. Try clearing app data and rebuilding",
            ],
            currentWebClientId: googleWebClientId ? googleWebClientId.substring(0, 30) + "..." : "NOT SET",
          });
        }
      }
      
      showDialog("Sign-In Failed", error.message || "Something went wrong.");
    } finally { setGoogleLoading(false); }
  };

  const handleEmailLogin = async () => {
    if (loading) return;
    if (!email || !password) { showDialog("Missing Details", "Please enter your email and password."); return; }
    if (password.length < 6) { showDialog("Password Too Short", "Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      try {
        await auth().signInWithEmailAndPassword(trimmedEmail, password);
        const user = auth().currentUser;
        if (!user) throw new Error("Signed in, but no user session was returned.");
        console.log("[handleEmailLogin] Sign-in successful, uid:", user.uid);
        await assignInitialProfileIfNeeded(user);
        await AsyncStorage.setItem(WELCOME_BANNER_KEY, user?.displayName?.split(" ")[0] || "User");
        return;
      } catch (loginError: any) {
        if (loginError.code === "auth/user-not-found" || loginError.code === "auth/invalid-credential") {
          if (!trimmedEmail.toLowerCase().endsWith("@gmail.com")) {
            showDialog("Gmail Only", "Samay currently supports Gmail accounts."); return;
          }
          try {
            const signupResult = await auth().createUserWithEmailAndPassword(trimmedEmail, password);
            const user = signupResult.user;
            console.log("[handleEmailLogin] Sign-up successful, uid:", user.uid);
            await assignInitialProfileIfNeeded(user);
            await AsyncStorage.setItem(WELCOME_BANNER_KEY, user?.displayName?.split(" ")[0] || "User");
            return;
          } catch (signupError: any) {
            if (signupError.code === "auth/email-already-in-use") { showDialog("Incorrect Credentials", "Incorrect email or password."); return; }
            if (signupError.code === "auth/weak-password") { showDialog("Weak Password", "Password must be at least 6 characters."); return; }
            throw signupError;
          }
        }
        if (loginError.code === "auth/wrong-password") { showDialog("Incorrect Credentials", "Incorrect email or password."); return; }
        if (loginError.code === "auth/invalid-email") { showDialog("Invalid Email", "Please enter a valid email."); return; }
        throw loginError;
      }
    } catch (err: any) {
      showDialog("Something Went Wrong", err.message || "An unexpected error occurred.");
    } finally { setLoading(false); }
  };

  const handleForgotPassword = async () => {
    if (!email) { showDialog("Enter Your Email", "Type your email above, then tap Forgot Password again."); return; }
    try {
      await auth().sendPasswordResetEmail(email.trim());
      showDialog("Reset Link Sent", "Check your inbox for a password reset link.", [{ text: "OK", style: "default", onPress: hideDialog }]);
    } catch (err: any) {
      showDialog("Could Not Send", err.message || "Failed to send the reset link.");
    }
  };

  const s = createStyles(theme);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={20}>
        <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.banner}>
            <Text style={s.appName}>Samay</Text>
            <Text style={s.tagline}>समय · FOCUS · TRACK · ACHIEVE</Text>
          </View>

          <View style={s.form}>
            <Text style={s.formTitle}>Get Started</Text>
            <TextInput placeholder="Email" placeholderTextColor={theme.colors.textSecondary} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={s.input} editable={!loading} />
            <TextInput placeholder="Password" placeholderTextColor={theme.colors.textSecondary} value={password} onChangeText={setPassword} secureTextEntry style={s.input} editable={!loading} />
            <TouchableOpacity onPress={handleEmailLogin} disabled={loading} style={[s.primaryButton, loading && s.buttonDisabled]} activeOpacity={0.8}>
              <Text style={s.primaryButtonText}>{loading ? "Please wait…" : "Continue"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleForgotPassword} style={s.forgotButton}>
              <Text style={s.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>OR</Text>
              <View style={s.dividerLine} />
            </View>
            <TouchableOpacity onPress={handleGoogleLogin} disabled={googleLoading || loading} style={[s.googleButton, (googleLoading || loading) && s.buttonDisabled]} activeOpacity={0.8}>
              <Text style={s.googleButtonText}>{googleLoading ? "Signing in…" : "Continue with Google"}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      <AppDialog visible={!!dialog} title={dialog?.title ?? ""} message={dialog?.message ?? ""} buttons={dialog?.buttons ?? [{ text: "OK", style: "default", onPress: hideDialog }]} onDismiss={hideDialog} />
    </SafeAreaView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { flexGrow: 1, paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing["4xl"], justifyContent: "center" },
    banner: { alignItems: "center", marginBottom: theme.spacing["3xl"] },
    appName: { fontSize: theme.typography.fontSize["4xl"], fontWeight: theme.typography.fontWeight.bold, color: theme.colors.text, marginBottom: theme.spacing.sm, letterSpacing: theme.typography.letterSpacing.tight },
    tagline: { fontSize: theme.typography.fontSize.xs, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.textSecondary, letterSpacing: theme.typography.letterSpacing.wider },
    form: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.xl, borderWidth: 1, borderColor: theme.colors.border },
    formTitle: { fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.bold, color: theme.colors.text, marginBottom: theme.spacing.lg },
    input: { backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, color: theme.colors.text, marginBottom: theme.spacing.md, fontSize: theme.typography.fontSize.base },
    primaryButton: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md, paddingVertical: theme.spacing.md, alignItems: "center", marginBottom: theme.spacing.md },
    primaryButtonText: { fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.textInverse },
    buttonDisabled: { opacity: 0.5 },
    forgotButton: { alignItems: "center", paddingVertical: theme.spacing.sm, marginBottom: theme.spacing.lg },
    forgotText: { fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium, color: theme.colors.primary },
    divider: { flexDirection: "row", alignItems: "center", marginVertical: theme.spacing.lg },
    dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
    dividerText: { fontSize: theme.typography.fontSize.xs, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.textSecondary, marginHorizontal: theme.spacing.md },
    googleButton: { backgroundColor: theme.colors.surface, borderWidth: 2, borderColor: theme.isDark ? theme.colors.primary : theme.colors.border, borderRadius: theme.radius.md, paddingVertical: theme.spacing.md, alignItems: "center" },
    googleButtonText: { fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.semibold, color: theme.isDark ? theme.colors.primary : theme.colors.text },
  });
}
