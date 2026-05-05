import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, Pressable, ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/firebase";
import { useTheme } from "@/context/ThemeContext";
import Ionicons from "@react-native-vector-icons/ionicons";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AccountScreen({ navigation }: any) {
  const { theme } = useTheme();
  const user = auth.currentUser;
  const s = createStyles(theme);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordSending, setPasswordSending] = useState(false);
  const [passwordDone, setPasswordDone] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleSendReset = async () => {
    if (!user?.email) return;
    setPasswordSending(true);
    setPasswordError("");
    try {
      await sendPasswordResetEmail(auth, user.email);
      setPasswordDone(true);
    } catch (err: any) {
      setPasswordError(err.message ?? "Something went wrong.");
    } finally { setPasswordSending(false); }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await user?.delete();
      await AsyncStorage.clear();
    } catch (err: any) {
      setDeleteError(
        err.code === "auth/requires-recent-login"
          ? "Please log out and log back in, then try again."
          : err.message ?? "Something went wrong."
      );
      setDeleteLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Account</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContent}>
        <View style={s.menuGroup}>
          <TouchableOpacity style={s.groupRow} onPress={() => { setPasswordDone(false); setPasswordError(""); setShowPasswordModal(true); }} activeOpacity={0.8}>
            <View style={s.menuItemInner}>
              <Ionicons name="key-outline" size={18} color={theme.colors.textSecondary} style={s.menuIcon} />
              <Text style={s.menuText}>Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <View style={s.groupDivider} />
          <TouchableOpacity style={s.groupRow} onPress={() => navigation.navigate("GeneralFeedback")} activeOpacity={0.8}>
            <View style={s.menuItemInner}>
              <Ionicons name="chatbubble-outline" size={18} color={theme.colors.textSecondary} style={s.menuIcon} />
              <Text style={s.menuText}>Feedback</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <View style={s.groupDivider} />
          <TouchableOpacity style={s.groupRow} onPress={() => navigation.navigate("PrivacySecurity")} activeOpacity={0.8}>
            <View style={s.menuItemInner}>
              <Ionicons name="shield-outline" size={18} color={theme.colors.textSecondary} style={s.menuIcon} />
              <Text style={s.menuText}>Privacy & Security</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal visible={showPasswordModal} transparent animationType="fade" onRequestClose={() => setShowPasswordModal(false)}>
        <Pressable style={[s.backdrop, { backgroundColor: theme.isDark ? "rgba(0,0,0,0.76)" : "rgba(16,20,32,0.42)" }]} onPress={() => setShowPasswordModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={s.modalCard}>
            <View style={s.modalIconWrap}>
              <Ionicons name="key-outline" size={28} color={theme.colors.primary} />
            </View>
            {passwordDone ? (
              <>
                <Text style={s.modalTitle}>Email Sent</Text>
                <Text style={s.modalBody}>A password reset link has been sent to{"\n"}<Text style={s.modalEmail}>{user?.email}</Text></Text>
                <TouchableOpacity style={s.primaryBtn} onPress={() => setShowPasswordModal(false)}>
                  <Text style={s.primaryBtnText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.modalTitle}>Change Password</Text>
                <Text style={s.modalBody}>We'll send a reset link to{"\n"}<Text style={s.modalEmail}>{user?.email}</Text></Text>
                {passwordError ? <Text style={s.errorText}>{passwordError}</Text> : null}
                <TouchableOpacity style={[s.primaryBtn, passwordSending && { opacity: 0.7 }]} onPress={handleSendReset} disabled={passwordSending}>
                  {passwordSending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryBtnText}>Send Reset Link</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={s.ghostBtn} onPress={() => setShowPasswordModal(false)}>
                  <Text style={s.ghostBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete Account Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <Pressable style={[s.backdrop, { backgroundColor: theme.isDark ? "rgba(0,0,0,0.76)" : "rgba(16,20,32,0.42)" }]} onPress={() => !deleteLoading && setShowDeleteModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={s.modalCard}>
            <View style={[s.modalIconWrap, { backgroundColor: theme.colors.error + "18" }]}>
              <Ionicons name="trash-outline" size={28} color={theme.colors.error} />
            </View>
            <Text style={s.modalTitle}>Delete Account</Text>
            <Text style={s.modalBody}>This will permanently delete your account and all data. This cannot be undone.</Text>
            {deleteError ? <Text style={s.errorText}>{deleteError}</Text> : null}
            <TouchableOpacity style={[s.dangerBtn, deleteLoading && { opacity: 0.7 }]} onPress={handleDeleteAccount} disabled={deleteLoading}>
              {deleteLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryBtnText}>Delete My Account</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.ghostBtn} onPress={() => setShowDeleteModal(false)} disabled={deleteLoading}>
              <Text style={s.ghostBtnText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
    headerTitle: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
    scrollContent: { padding: 16 },
    menuGroup: { backgroundColor: theme.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, overflow: "hidden" },
    groupRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 15 },
    groupDivider: { height: 1, backgroundColor: theme.colors.border, marginHorizontal: 16 },
    menuItemInner: { flexDirection: "row", alignItems: "center", flex: 1 },
    menuIcon: { marginRight: 12 },
    menuText: { fontSize: 15, color: theme.colors.text, fontWeight: "500" },
    backdrop: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
    modalCard: { width: "100%", maxWidth: 360, backgroundColor: theme.colors.surface, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 28, alignItems: "center", borderWidth: 1, borderColor: theme.colors.border },
    modalIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.primary + "18", alignItems: "center", justifyContent: "center", marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.text, marginBottom: 8, textAlign: "center" },
    modalBody: { fontSize: 14, color: theme.colors.textSecondary, textAlign: "center", lineHeight: 21, marginBottom: 20 },
    modalEmail: { fontWeight: "600", color: theme.colors.text },
    errorText: { fontSize: 13, color: theme.colors.error, textAlign: "center", marginBottom: 12 },
    primaryBtn: { width: "100%", backgroundColor: theme.colors.primary, paddingVertical: 13, borderRadius: 12, alignItems: "center", marginBottom: 10 },
    dangerBtn: { width: "100%", backgroundColor: theme.colors.error, paddingVertical: 13, borderRadius: 12, alignItems: "center", marginBottom: 10 },
    primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
    ghostBtn: { width: "100%", paddingVertical: 11, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: theme.colors.border },
    ghostBtnText: { fontSize: 15, fontWeight: "600", color: theme.colors.textSecondary },
  });
}
