import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { useRef, useState } from "react";
import { auth } from "@/firebase";
import { useTheme } from "@/context/ThemeContext";
import AppDialog, { AppDialogButton } from "@/components/AppDialog";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TERMS_ACCEPTED_AT_KEY = "TERMS_ACCEPTED_AT";
const WELCOME_BANNER_KEY = "WELCOME_BANNER_PENDING";

type DialogState = { title: string; message: string; buttons?: AppDialogButton[] };

export default function ProfileSetupScreen({ navigation }: any) {
  const { theme } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const showDialog = (title: string, message: string, buttons?: AppDialogButton[]) =>
    setDialog({ title, message, buttons });
  const hideDialog = () => setDialog(null);

  const handleSave = async () => {
    if (saving) return;
    if (!name.trim()) { showDialog("Enter Your Name", "Please type your name before continuing."); return; }
    if (!accepted) {
      showDialog("Acceptance Required", "Please accept the Terms of Service and Privacy Policy.", [{ text: "OK", style: "default", onPress: hideDialog }]);
      return;
    }
    try {
      setSaving(true);
      const user = auth().currentUser;
      if (!user) return;
      await user.updateProfile({ displayName: name.trim() });
      await AsyncStorage.setItem(TERMS_ACCEPTED_AT_KEY, new Date().toISOString());
      await AsyncStorage.setItem(WELCOME_BANNER_KEY, name.trim());
      await user.reload();
      await user.getIdToken(true);
      navigation.replace("MainTabs");
    } catch (err: any) {
      showDialog("Setup Failed", err.message || "Something went wrong. Please try again.");
    } finally { setSaving(false); }
  };

  const s = createStyles(theme);

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 120 : 80}>
      <ScrollView ref={scrollRef} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" style={{ backgroundColor: theme.colors.background }}>
        <View style={s.banner}>
          <Text style={s.appName}>Samay</Text>
          <Text style={s.emoji}>⏱</Text>
        </View>

        <View style={s.content}>
          <Text style={s.title}>Complete your profile</Text>
          <Text style={s.subtitle}>What should we call you?</Text>

          <TextInput
            placeholder="Your Name"
            placeholderTextColor={theme.colors.textSecondary}
            value={name}
            onChangeText={setName}
            editable={!saving}
            style={[s.input, saving && s.inputDisabled]}
            autoFocus
            onFocus={() => scrollRef.current?.scrollTo({ y: 280, animated: true })}
          />

          <TouchableOpacity onPress={() => setAccepted(!accepted)} activeOpacity={0.7} style={s.checkboxRow}>
            <View style={[s.checkbox, accepted && s.checkboxChecked]}>
              {accepted && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={s.checkboxLabel}>
              I agree to the{" "}
              <Text style={s.checkboxLink} onPress={() => navigation.navigate("Terms")}>Terms of Service</Text>
              {" "}and{" "}
              <Text style={s.checkboxLink} onPress={() => navigation.navigate("PrivacyPolicy")}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSave} disabled={saving} style={[s.saveButton, saving && s.saveButtonDisabled]} activeOpacity={0.8}>
            <Text style={s.saveButtonText}>{saving ? "Setting up…" : "Start Focusing"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <AppDialog visible={!!dialog} title={dialog?.title ?? ""} message={dialog?.message ?? ""} buttons={dialog?.buttons ?? [{ text: "OK", style: "default", onPress: hideDialog }]} onDismiss={hideDialog} />
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { flexGrow: 1, paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing["4xl"] },
    banner: { alignItems: "center", marginBottom: theme.spacing["3xl"] },
    appName: { fontSize: theme.typography.fontSize["3xl"], fontWeight: theme.typography.fontWeight.bold, color: theme.colors.text, marginBottom: theme.spacing.sm },
    emoji: { fontSize: 48 },
    content: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.xl, borderWidth: 1, borderColor: theme.colors.border },
    title: { fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.bold, color: theme.colors.text, marginBottom: theme.spacing.sm },
    subtitle: { fontSize: theme.typography.fontSize.base, color: theme.colors.textSecondary, marginBottom: theme.spacing.xl },
    input: { backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, color: theme.colors.text, marginBottom: theme.spacing.xl, fontSize: theme.typography.fontSize.md },
    inputDisabled: { opacity: 0.6 },
    checkboxRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: theme.spacing.xl, gap: theme.spacing.md },
    checkbox: { width: 22, height: 22, borderRadius: theme.radius.xs, borderWidth: 2, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center", marginTop: 1 },
    checkboxChecked: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    checkmark: { color: theme.colors.textInverse, fontSize: 13, fontWeight: theme.typography.fontWeight.bold },
    checkboxLabel: { flex: 1, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, lineHeight: 20 },
    checkboxLink: { color: theme.colors.primary, fontWeight: theme.typography.fontWeight.medium },
    saveButton: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md, paddingVertical: theme.spacing.md, alignItems: "center" },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: { fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.textInverse },
  });
}
