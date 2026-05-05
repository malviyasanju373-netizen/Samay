import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/context/ThemeContext";

export default function TermsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = createStyles(theme);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.updated}>Last updated: May 2025</Text>

        <Text style={s.section}>1. Acceptance of Terms</Text>
        <Text style={s.body}>By using Samay, you agree to these Terms of Service. If you do not agree, please do not use the app.</Text>

        <Text style={s.section}>2. Use of the App</Text>
        <Text style={s.body}>Samay is a focus timer and productivity tracking app. You may use it for personal, non-commercial purposes. You must not use the app to harm others or violate any applicable law.</Text>

        <Text style={s.section}>3. User Accounts</Text>
        <Text style={s.body}>You are responsible for maintaining the confidentiality of your account credentials. You are responsible for all activity that occurs under your account.</Text>

        <Text style={s.section}>4. Leaderboard & Community</Text>
        <Text style={s.body}>Your username and total focus hours are displayed publicly on the leaderboard. Choose a username that does not contain offensive or inappropriate content. We reserve the right to remove any username at our discretion.</Text>

        <Text style={s.section}>5. Data & Privacy</Text>
        <Text style={s.body}>Your use of Samay is also governed by our Privacy Policy. By using the app, you consent to the collection and use of data as described in our Privacy Policy.</Text>

        <Text style={s.section}>6. Termination</Text>
        <Text style={s.body}>We reserve the right to suspend or terminate your account for violation of these terms. You may delete your account at any time from the Account Settings screen.</Text>

        <Text style={s.section}>7. Disclaimer</Text>
        <Text style={s.body}>Samay is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free service.</Text>

        <Text style={s.section}>8. Contact</Text>
        <Text style={s.body}>For questions about these terms, contact us at hello@samay.in</Text>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    updated: { fontSize: 12, color: theme.colors.textTertiary, marginBottom: 20 },
    section: { fontSize: 15, fontWeight: "700", color: theme.colors.text, marginTop: 20, marginBottom: 8 },
    body: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 22 },
  });
}
