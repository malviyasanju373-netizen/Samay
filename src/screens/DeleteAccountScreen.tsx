import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/context/ThemeContext";
import { useDeleteAccount } from "@/hooks/useDeleteAccount";

export default function DeleteAccountScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { isDeleting, error, deleteAccountWithPassword } = useDeleteAccount();
  const [password, setPassword] = useState("");
  const s = createStyles(theme);

  const handleDelete = async () => {
    const result = await deleteAccountWithPassword(password);
    if (!result.success) return;
    navigation.reset({ index: 0, routes: [{ name: "AuthChoice" }] });
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Delete Account</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={[s.warningBox, { backgroundColor: theme.colors.error + "12" }]}>
            <Ionicons name="warning" size={24} color={theme.colors.error} style={{ marginBottom: 8 }} />
            <Text style={[s.warningTitle, { color: theme.colors.error }]}>This cannot be undone</Text>
            <Text style={s.warningBody}>All your focus sessions, statistics, and leaderboard data will be permanently deleted.</Text>
          </View>

          <Text style={s.label}>Enter your password to confirm</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={theme.colors.textTertiary}
            secureTextEntry
            style={s.input}
            editable={!isDeleting}
          />

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <TouchableOpacity onPress={handleDelete} disabled={isDeleting || !password} style={[s.deleteBtn, (isDeleting || !password) && { opacity: 0.5 }]} activeOpacity={0.8}>
            {isDeleting ? <ActivityIndicator color="#fff" /> : <Text style={s.deleteBtnText}>Delete My Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={s.cancelBtn} disabled={isDeleting}>
            <Text style={s.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
    headerTitle: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
    content: { padding: 20 },
    warningBox: { borderRadius: 16, padding: 20, alignItems: "center", marginBottom: 28 },
    warningTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
    warningBody: { fontSize: 14, color: theme.colors.textSecondary, textAlign: "center", lineHeight: 20 },
    label: { fontSize: 14, fontWeight: "600", color: theme.colors.textSecondary, marginBottom: 10 },
    input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: theme.colors.text, marginBottom: 8 },
    errorText: { fontSize: 13, color: theme.colors.error, marginBottom: 12 },
    deleteBtn: { backgroundColor: theme.colors.error, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 12 },
    deleteBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
    cancelBtn: { borderRadius: 12, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: theme.colors.border },
    cancelBtnText: { fontSize: 15, fontWeight: "600", color: theme.colors.textSecondary },
  });
}
