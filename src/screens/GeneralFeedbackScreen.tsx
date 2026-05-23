import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/context/ThemeContext";
import { auth, db } from "@/firebase";
import { doc, addDoc, collection, serverTimestamp } from "firebase/firestore";

export default function GeneralFeedbackScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const s = createStyles(theme);

  const handleSend = async () => {
    if (!feedback.trim() || sending) return;
    if (!db) {
      setError("Feedback is unavailable until Firebase is configured.");
      return;
    }
    setSending(true);
    setError("");
    try {
      await addDoc(collection(db, "feedback"), {
        uid: auth?.currentUser?.uid ?? null,
        message: feedback.trim(),
        createdAt: serverTimestamp(),
        app: "samay",
      });
      setSent(true);
    } catch (err: any) {
      setError(err?.message ?? "Could not send feedback. Please try again.");
    } finally { setSending(false); }
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Feedback</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {sent ? (
            <View style={s.sentBox}>
              <Text style={s.sentEmoji}>🙏</Text>
              <Text style={s.sentTitle}>Thank you!</Text>
              <Text style={s.sentBody}>Your feedback helps us improve Samay.</Text>
              <TouchableOpacity onPress={() => navigation.goBack()} style={s.doneBtn}>
                <Text style={s.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={s.label}>Share your thoughts</Text>
              <TextInput
                value={feedback}
                onChangeText={setFeedback}
                placeholder="What can we improve?"
                placeholderTextColor={theme.colors.textTertiary}
                multiline
                numberOfLines={6}
                style={s.input}
                editable={!sending}
                textAlignVertical="top"
              />
              {error ? <Text style={s.errorText}>{error}</Text> : null}
              <TouchableOpacity onPress={handleSend} disabled={sending || !feedback.trim()} style={[s.sendBtn, (sending || !feedback.trim()) && { opacity: 0.5 }]} activeOpacity={0.8}>
                {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.sendBtnText}>Send Feedback</Text>}
              </TouchableOpacity>
            </>
          )}
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
    label: { fontSize: 14, fontWeight: "600", color: theme.colors.textSecondary, marginBottom: 10 },
    input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: theme.colors.text, minHeight: 140, marginBottom: 16 },
    errorText: { color: theme.colors.error, fontSize: 13, fontWeight: "600", marginBottom: 12 },
    sendBtn: { backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
    sendBtnText: { fontSize: 15, fontWeight: "700", color: theme.colors.textInverse },
    sentBox: { alignItems: "center", paddingTop: 60 },
    sentEmoji: { fontSize: 52, marginBottom: 16 },
    sentTitle: { fontSize: 22, fontWeight: "700", color: theme.colors.text, marginBottom: 8 },
    sentBody: { fontSize: 14, color: theme.colors.textSecondary, textAlign: "center", marginBottom: 32 },
    doneBtn: { backgroundColor: theme.colors.primary, borderRadius: 12, paddingHorizontal: 48, paddingVertical: 13 },
    doneBtnText: { fontSize: 15, fontWeight: "700", color: theme.colors.textInverse },
  });
}
