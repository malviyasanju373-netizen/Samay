import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, ScrollView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, GoogleAuthProvider, signInWithCredential,
  getAdditionalUserInfo,
} from "firebase/auth";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { auth } from "@/firebase";
import { useTheme } from "@/context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createInitialUserProfile } from "@/services/userProfile";
import { userProfileCacheService } from "@/storage/services";
import AppDialog, { AppDialogButton } from "@/components/AppDialog";

const WELCOME_BANNER_KEY = "WELCOME_BANNER_PENDING";
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

async function assignInitialProfileIfNeeded(user: any) {
  if (!user) return;
  const profile = await createInitialUserProfile(user.uid, {
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  });
  await userProfileCacheService.set(user.uid, {
    ...profile,
    createdAt: profile.createdAt?.toMillis?.() ?? null,
    usernameLastChanged: profile.usernameLastChanged?.toMillis?.() ?? null,
  });
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
      if (!googleWebClientId) return;
      GoogleSignin.configure({ webClientId: googleWebClientId });
      setGoogleConfigured(true);
    } catch {}
  }, []);

  const handleGoogleLogin = async () => {
    if (!googleConfigured) { showDialog("Unavailable", "Google Sign-In is not configured yet."); return; }
    if (auth.currentUser) { showDialog("Already Signed In", "You have an active session."); return; }
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken ?? (userInfo as any).idToken;
      if (!idToken) { showDialog("Sign-In Failed", "Could not get a valid token. Please try again."); return; }
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      const user = result.user as any;
      if (getAdditionalUserInfo(result)?.isNewUser) await assignInitialProfileIfNeeded(user);
      const name = user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "User";
      await AsyncStorage.setItem(WELCOME_BANNER_KEY, name);
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return;
      if (error.code === statusCodes.IN_PROGRESS) { showDialog("In Progress", "A sign-in attempt is already underway."); return; }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) { showDialog("Google Play Required", "Google Play Services are not available."); return; }
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
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
        const user = auth.currentUser as any;
        await AsyncStorage.setItem(WELCOME_BANNER_KEY, user?.displayName?.split(" ")[0] || "User");
        return;
      } catch (loginError: any) {
        if (loginError.code === "auth/user-not-found" || loginError.code === "auth/invalid-credential") {
          if (!trimmedEmail.toLowerCase().endsWith("@gmail.com")) {
            showDialog("Gmail Only", "Samay currently supports Gmail accounts."); return;
          }
          try {
            const signupResult = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
            const user = signupResult.user as any;
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
      await sendPasswordResetEmail(auth, email.trim());
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
