import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/context/ThemeContext";

const TERMS_ACCEPTED_AT_KEY = "TERMS_ACCEPTED_AT";

export default function TermsUpdateScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [accepting, setAccepting] = useState(false);
  const s = createStyles(theme);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await AsyncStorage.setItem(TERMS_ACCEPTED_AT_KEY, new Date().toISOString());
      navigation.replace("MainTabs");
    } catch {
      setAccepting(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Terms Updated</Text>
        <Text style={s.subtitle}>We've updated our Terms of Service and Privacy Policy.</Text>
        <Text style={s.body}>Please review and accept the updated terms to continue using Samay.</Text>

        <View style={s.linkGroup}>
          <TouchableOpacity onPress={() => navigation.navigate("Terms")} style={s.link}>
            <Text style={s.linkText}>Read Terms of Service →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("PrivacyPolicy")} style={s.link}>
            <Text style={s.linkText}>Read Privacy Policy →</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleAccept} disabled={accepting} style={[s.acceptBtn, accepting && { opacity: 0.6 }]} activeOpacity={0.8}>
          <Text style={s.acceptBtnText}>{accepting ? "Please wait…" : "Accept & Continue"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    content: { flexGrow: 1, padding: 24, justifyContent: "center" },
    title: { fontSize: 26, fontWeight: "700", color: theme.colors.text, marginBottom: 12 },
    subtitle: { fontSize: 16, color: theme.colors.text, fontWeight: "600", marginBottom: 12 },
    body: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 22, marginBottom: 28 },
    linkGroup: { marginBottom: 32, gap: 12 },
    link: { paddingVertical: 4 },
    linkText: { fontSize: 14, color: theme.colors.primary, fontWeight: "500" },
    acceptBtn: { backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
    acceptBtnText: { fontSize: 16, fontWeight: "700", color: theme.colors.textInverse },
  });
}
