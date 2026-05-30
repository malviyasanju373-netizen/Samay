import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { auth } from "@/firebase";
import { createGroup } from "@/services/groups";
import { useTheme } from "@/context/ThemeContext";

// CRASH FIX: Inline constants to avoid import issues
const CATEGORIES = [
  { id: 'study', label: 'Study', icon: 'book' },
  { id: 'focus', label: 'Focus', icon: 'stopwatch' },
  { id: 'coding', label: 'Coding', icon: 'code-slash' },
];

const GOALS = [
  { id: '1h', label: '1h/day' },
  { id: '2h', label: '2h/day' },
  { id: '4h', label: '4h/day' },
];

const EMOJIS = ["📚", "💻", "🧠", "🎯", "⚡", "🔥"];

export default function CreateGroupScreen({ navigation }: any) {
  const { theme } = useTheme();
  const currentUser = auth().currentUser;
  const currentUid = currentUser?.uid;
  const displayName = currentUser?.displayName ?? "User";
  const photoURL = currentUser?.photoURL ?? null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState("50");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const s = useMemo(() => createStyles(theme), [theme]);

  // CRASH FIX: Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // CRASH FIX: Safe navigation
  const safeGoBack = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation?.navigate?.("GroupsList");
    }
  }, [navigation]);

  // CRASH FIX: Comprehensive validation and error handling
  const handleCreate = useCallback(async () => {
    if (loading) return;

    // CRASH FIX: Validation with proper error messages
    if (!name.trim()) {
      setError("Group name is required");
      return;
    }

    if (name.trim().length < 2) {
      setError("Group name must be at least 2 characters");
      return;
    }

    if (!currentUid) {
      setError("User authentication failed");
      return;
    }

    const parsedMax = parseInt(maxMembers, 10);
    if (!Number.isFinite(parsedMax) || parsedMax < 1) {
      setError("Please enter a valid number for members");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // CRASH FIX: Use correct API signature (6 separate params)
      const group = await createGroup(
        name.trim(),
        description.trim(),
        currentUid,
        displayName,
        photoURL,
        Math.min(Math.max(parsedMax, 1), 500)
      );

      if (!mountedRef.current) return;

      Alert.alert("Success", "Group created successfully!", [
        {
          text: "View Group",
          onPress: () => {
            if (mountedRef.current) {
              navigation?.navigate?.("GroupDetail", { groupId: group.id });
            }
          },
        },
      ]);
    } catch (err: any) {
      console.error("[CreateGroup] Error:", err);
      if (mountedRef.current) {
        setError(err?.message || "Failed to create group");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [name, description, maxMembers, currentUid, displayName, photoURL, loading, navigation]);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={s.flex}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={safeGoBack} style={s.closeBtn}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>New Group</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          style={s.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
        >
          {/* Error Banner */}
          {error && (
            <View style={[s.errorBanner, { backgroundColor: theme.colors.error + "15" }]}>
              <Ionicons name="alert-circle" size={16} color={theme.colors.error} />
              <Text style={[s.errorText, { color: theme.colors.error }]}>{error}</Text>
              <TouchableOpacity onPress={() => setError(null)}>
                <Ionicons name="close" size={16} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          )}

          <View style={[s.card, { backgroundColor: theme.colors.card }]}>
            {/* Emoji Picker */}
            <View style={s.section}>
              <Text style={[s.label, { color: theme.colors.text }]}>GROUP EMOJI</Text>
              <View style={s.emojiGrid}>
                {EMOJIS.map((e) => (
                  <TouchableOpacity
                    key={e}
                    onPress={() => setEmoji(e)}
                    style={[
                      s.emojiButton,
                      emoji === e && [s.emojiButtonSelected, { borderColor: theme.colors.primary }],
                    ]}
                  >
                    <Text style={s.emojiText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Group Name */}
            <View style={s.section}>
              <Text style={[s.label, { color: theme.colors.text }]}>GROUP NAME</Text>
              <TextInput
                style={[s.input, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
                placeholder="e.g., Focus Masters"
                placeholderTextColor={theme.colors.textTertiary}
                value={name}
                onChangeText={setName}
                editable={!loading}
                maxLength={100}
              />
            </View>

            {/* Description */}
            <View style={s.section}>
              <Text style={[s.label, { color: theme.colors.text }]}>DESCRIPTION (optional)</Text>
              <TextInput
                style={[s.input, s.inputMulti, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
                placeholder="What's this group about?"
                placeholderTextColor={theme.colors.textTertiary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                editable={!loading}
                maxLength={200}
              />
            </View>

            {/* Max Members */}
            <View style={s.section}>
              <Text style={[s.label, { color: theme.colors.text }]}>MAX MEMBERS</Text>
              <TextInput
                style={[s.input, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
                placeholder="50"
                placeholderTextColor={theme.colors.textTertiary}
                value={maxMembers}
                onChangeText={setMaxMembers}
                keyboardType="number-pad"
                editable={!loading}
              />
            </View>

            {/* Create Button */}
            <View>
              <TouchableOpacity
                style={[s.createBtn, { backgroundColor: theme.colors.primary }, loading && s.btnDisabled]}
                onPress={handleCreate}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={s.createBtnText}>Create Group</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.card,
    },
    closeBtn: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    content: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    card: {
      borderRadius: 12,
      padding: 16,
    },
    section: { marginBottom: 20 },
    label: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    input: {
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    inputMulti: {
      textAlignVertical: "top",
      minHeight: 80,
    },
    emojiGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    emojiButton: {
      width: "22%",
      aspectRatio: 1,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: "transparent",
    },
    emojiButtonSelected: {
      borderWidth: 2,
    },
    emojiText: { fontSize: 24 },
    createBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderRadius: 8,
      gap: 8,
    },
    btnDisabled: { opacity: 0.6 },
    createBtnText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 16,
    },
    errorBanner: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      marginBottom: 16,
      gap: 8,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "500",
    },
  });
