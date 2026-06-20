import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, firestore } from "@/firebase";
import { useTheme } from "@/context/ThemeContext";
import Ionicons from "@react-native-vector-icons/ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  changeUsername, cooldownDaysRemaining, updateDisplayName, updateGoal,
} from "@/services/userProfile";
import { testCreateTodo } from "@/services/todos";
import AppDialog, { AppDialogButton } from "@/components/AppDialog";
import { formatStudyTime } from "@/utils/timeFormat";

const AVATAR_KEY = "LOCAL_PROFILE_PHOTO";

function formatMemberSince(value: any) {
  const date = typeof value?.toDate === "function" ? value.toDate() : value instanceof Date ? value : null;
  if (!date || isNaN(date.getTime())) return "Recently joined";
  return `Since ${date.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`;
}

type DialogState = { title: string; message: string; buttons?: AppDialogButton[] };

export default function ProfileScreen({ navigation }: any) {
  const { theme, themeMode, setThemeMode } = useTheme();
  const user = auth().currentUser;
  const { profile, loading: profileLoading, reload: reloadProfile } = useUserProfile();

  const [photoUri, setPhotoUri] = useState<string | null>(user?.photoURL ?? null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(user?.displayName || "");
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editingUsername, setEditingUsername] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [editingGoal, setEditingGoal] = useState("");
  const [goalLoading, setGoalLoading] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const showDialog = (title: string, message: string, buttons?: AppDialogButton[]) => setDialog({ title, message, buttons });
  const hideDialog = () => setDialog(null);

  useEffect(() => {
    AsyncStorage.getItem(AVATAR_KEY).then((uri) => { if (uri) setPhotoUri(uri); });
  }, []);

  useEffect(() => {
    if (!user) return;
    firestore().collection("users").doc(user.uid).get().then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const mins = d?.totalFocusMinutes ?? 0;
        const secs = d?.totalFocusSeconds ?? (mins * 60);
        setTotalSeconds(secs);
      }
    }).catch(() => {});
  }, [user]);

  const handlePickPhoto = async () => {
    let ImagePicker: typeof import("expo-image-picker");
    try {
      ImagePicker = require("expo-image-picker");
    } catch {
      showDialog("Unavailable", "Photo picker is not available on this build.");
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { showDialog("Permission Needed", "Allow photo access to set a profile picture."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      const uri = result.assets[0].uri;
      setPhotoUri(uri);
      await AsyncStorage.setItem(AVATAR_KEY, uri);
    }
  };

  const handleSaveName = async () => {
    if (!editingName.trim()) return;
    if (!user) { showDialog("Unavailable", "No signed-in user found."); return; }
    try {
      await user.updateProfile({ displayName: editingName.trim() });
      await updateDisplayName(user.uid, editingName.trim());
      setIsEditingName(false);
      await reloadProfile();
    } catch (err: any) { showDialog("Error", err.message); }
  };

  const handleSaveUsername = async () => {
    if (!editingUsername.trim() || !user) return;
    setUsernameLoading(true);
    try {
      const result = await changeUsername(user.uid, editingUsername.trim());
      if (result.ok) {
        setIsEditingUsername(false);
        await reloadProfile();
      } else {
        const msgs: Record<string, string> = {
          taken: "That username is already taken.",
          cooldown: `You can change username again in ${cooldownDaysRemaining(profile?.usernameLastChanged ?? null)} days.`,
          same: "That's already your username.",
          invalid: "Username must be at least 3 characters.",
        };
        showDialog("Can't Change", msgs[result.reason] ?? "Something went wrong.");
      }
    } catch (err: any) {
      showDialog("Error", err?.message ?? "Could not update username.");
    } finally {
      setUsernameLoading(false);
    }
  };

  const handleSaveGoal = async () => {
    if (!user) return;
    setGoalLoading(true);
    try {
      await updateGoal(user.uid, editingGoal.trim());
      setIsEditingGoal(false);
      await reloadProfile();
    } catch (err: any) { showDialog("Error", err.message); }
    setGoalLoading(false);
  };

  const handleCreateTestTodo = async () => {
    try {
      await testCreateTodo();
      showDialog("Success", "Todo Created");
    } catch (err: any) {
      showDialog("Error", err?.message ?? "Failed to create test todo.");
    }
  };

  const handleSignOut = () => {
    showDialog("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel", onPress: hideDialog },
      { text: "Sign Out", style: "destructive", onPress: async () => { hideDialog(); await auth().signOut(); } },
    ]);
  };

  const themeOptions: Array<{ mode: "system" | "light" | "dark"; icon: string; label: string }> = [
    { mode: "system", icon: "phone-portrait-outline", label: "Auto" },
    { mode: "light",  icon: "sunny-outline",          label: "Light" },
    { mode: "dark",   icon: "moon-outline",            label: "Dark" },
  ];

  const s = createStyles(theme);

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.header}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          )}
          <Text style={s.headerTitle}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Avatar + name */}
          <View style={s.avatarSection}>
            <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.8} style={s.avatarWrap}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.avatarPlaceholder]}>
                  <Text style={s.avatarInitial}>{(user?.displayName || "U")[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={s.avatarEdit}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>

            {isEditingName ? (
              <View style={s.editRow}>
                <TextInput value={editingName} onChangeText={setEditingName} style={s.nameInput} autoFocus onSubmitEditing={handleSaveName} />
                <TouchableOpacity onPress={handleSaveName} style={s.saveChip}><Text style={s.saveChipText}>Save</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setIsEditingName(false)} style={s.cancelChip}><Text style={s.cancelChipText}>✕</Text></TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => { setEditingName(user?.displayName || ""); setIsEditingName(true); }} style={s.nameRow}>
                <Text style={s.displayName}>{user?.displayName || "Set name"}</Text>
                <Ionicons name="pencil" size={14} color={theme.colors.textSecondary} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            )}

            <Text style={s.memberSince}>{formatMemberSince(profile?.createdAt)}</Text>
          </View>

          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statValue}>{formatStudyTime(totalSeconds)}</Text>
              <Text style={s.statLabel}>Total Focus</Text>
            </View>
            <View style={[s.statCard, { borderColor: theme.colors.border }]}>
              <Text style={s.statValue}>@{profile?.username ?? "—"}</Text>
              <Text style={s.statLabel}>Username</Text>
            </View>
          </View>

          {/* Username edit */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>USERNAME</Text>
            {isEditingUsername ? (
              <View style={s.editGroup}>
                <TextInput value={editingUsername} onChangeText={setEditingUsername} style={s.editInput} placeholder="New username (min 3 chars)" placeholderTextColor={theme.colors.textTertiary} autoFocus autoCapitalize="none" />
                <View style={s.editActions}>
                  <TouchableOpacity onPress={handleSaveUsername} disabled={usernameLoading} style={s.saveChip}>
                    {usernameLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveChipText}>Save</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setIsEditingUsername(false)} style={s.cancelChip}><Text style={s.cancelChipText}>Cancel</Text></TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => { setEditingUsername(profile?.username ?? ""); setIsEditingUsername(true); }} style={s.editTrigger} activeOpacity={0.8}>
                <Text style={s.editTriggerText}>@{profile?.username ?? "—"}</Text>
                <Ionicons name="pencil" size={15} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Goal edit */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>MY GOAL</Text>
            {isEditingGoal ? (
              <View style={s.editGroup}>
                <TextInput value={editingGoal} onChangeText={setEditingGoal} style={s.editInput} placeholder="e.g. UPSC 2027, JEE 2026" placeholderTextColor={theme.colors.textTertiary} autoFocus />
                <View style={s.editActions}>
                  <TouchableOpacity onPress={handleSaveGoal} disabled={goalLoading} style={s.saveChip}>
                    {goalLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveChipText}>Save</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setIsEditingGoal(false)} style={s.cancelChip}><Text style={s.cancelChipText}>Cancel</Text></TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => { setEditingGoal(profile?.goal ?? ""); setIsEditingGoal(true); }} style={s.editTrigger} activeOpacity={0.8}>
                <Text style={s.editTriggerText}>{profile?.goal || "Set your goal"}</Text>
                <Ionicons name="pencil" size={15} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Theme */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>APPEARANCE</Text>
            <View style={s.themeRow}>
              {themeOptions.map((opt) => (
                <TouchableOpacity key={opt.mode} onPress={() => setThemeMode(opt.mode)} style={[s.themeChip, themeMode === opt.mode && s.themeChipActive]} activeOpacity={0.8}>
                  <Ionicons name={opt.icon as any} size={16} color={themeMode === opt.mode ? theme.colors.textInverse : theme.colors.textSecondary} />
                  <Text style={[s.themeChipText, themeMode === opt.mode && s.themeChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Actions */}
          <View style={s.section}>
            <TouchableOpacity style={s.actionRow} onPress={handleCreateTestTodo} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={18} color={theme.colors.textSecondary} />
              <Text style={s.actionText}>Create Test Todo</Text>
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity style={s.actionRow} onPress={() => navigation.navigate('TodoScreen')} activeOpacity={0.8}>
              <Ionicons name="list-outline" size={18} color={theme.colors.textSecondary} />
              <Text style={s.actionText}>Open Todos</Text>
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity style={s.actionRow} onPress={() => navigation.navigate("Account")} activeOpacity={0.8}>
              <Ionicons name="settings-outline" size={18} color={theme.colors.textSecondary} />
              <Text style={s.actionText}>Account Settings</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} style={{ marginLeft: "auto" }} />
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity style={s.actionRow} onPress={handleSignOut} activeOpacity={0.8}>
              <Ionicons name="log-out-outline" size={18} color={theme.colors.error} />
              <Text style={[s.actionText, { color: theme.colors.error }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      <AppDialog visible={!!dialog} title={dialog?.title ?? ""} message={dialog?.message ?? ""} buttons={dialog?.buttons ?? [{ text: "OK", style: "default", onPress: hideDialog }]} onDismiss={hideDialog} />
    </SafeAreaView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
    headerTitle: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
    scrollContent: { paddingHorizontal: 16 },
    avatarSection: { alignItems: "center", paddingVertical: 28 },
    avatarWrap: { position: "relative", marginBottom: 12 },
    avatar: { width: 88, height: 88, borderRadius: 44 },
    avatarPlaceholder: { backgroundColor: theme.colors.primary + "22", alignItems: "center", justifyContent: "center" },
    avatarInitial: { fontSize: 36, fontWeight: "700", color: theme.colors.primary },
    avatarEdit: { position: "absolute", bottom: 2, right: 2, backgroundColor: theme.colors.primary, borderRadius: 12, width: 24, height: 24, alignItems: "center", justifyContent: "center" },
    nameRow: { flexDirection: "row", alignItems: "center" },
    displayName: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
    memberSince: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 4 },
    editRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 4 },
    nameInput: { fontSize: 18, fontWeight: "700", color: theme.colors.text, borderBottomWidth: 2, borderBottomColor: theme.colors.primary, paddingHorizontal: 4, paddingVertical: 2, minWidth: 140 },
    statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
    statCard: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center" },
    statValue: { fontSize: 18, fontWeight: "800", color: theme.colors.primary, marginBottom: 4 },
    statLabel: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
    section: { backgroundColor: theme.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 16, marginBottom: 12 },
    sectionLabel: { fontSize: 10, fontWeight: "700", color: theme.colors.textTertiary, letterSpacing: 1, marginBottom: 10 },
    editTrigger: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    editTriggerText: { fontSize: 15, fontWeight: "500", color: theme.colors.text, flex: 1 },
    editGroup: { gap: 10 },
    editInput: { fontSize: 15, color: theme.colors.text, borderBottomWidth: 1.5, borderBottomColor: theme.colors.primary, paddingVertical: 6, paddingHorizontal: 2 },
    editActions: { flexDirection: "row", gap: 8 },
    saveChip: { backgroundColor: theme.colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
    saveChipText: { fontSize: 13, fontWeight: "700", color: "#fff" },
    cancelChip: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: theme.colors.border },
    cancelChipText: { fontSize: 13, fontWeight: "600", color: theme.colors.textSecondary },
    themeRow: { flexDirection: "row", gap: 8 },
    themeChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border },
    themeChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    themeChipText: { fontSize: 12, fontWeight: "600", color: theme.colors.textSecondary },
    themeChipTextActive: { color: theme.colors.textInverse },
    actionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
    actionText: { fontSize: 15, fontWeight: "500", color: theme.colors.text },
    divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 12 },
  });
}
