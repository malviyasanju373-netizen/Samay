import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/context/ThemeContext";

export default function PrivacyPolicyScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = createStyles(theme);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.updated}>Last updated: May 2025</Text>

        <Text style={s.section}>1. Information We Collect</Text>
        <Text style={s.body}>We collect information you provide when creating an account (name, email, photo) and usage data such as focus session duration, categories, and timestamps. We do not collect location, contacts, or payment information.</Text>

        <Text style={s.section}>2. How We Use Your Information</Text>
        <Text style={s.body}>Your focus session data powers your personal statistics, streak tracking, and leaderboard rankings. Your name and username are visible to other Samay users on the leaderboard.</Text>

        <Text style={s.section}>3. Data Storage</Text>
        <Text style={s.body}>All data is stored securely on Google Firebase (Firestore and Firebase Auth). Firebase complies with GDPR and other privacy regulations. Session data is linked to your user ID.</Text>

        <Text style={s.section}>4. Data Sharing</Text>
        <Text style={s.body}>We do not sell your personal data. Aggregate, anonymized usage statistics may be used to improve the app. Your username and total focus hours are visible on the public leaderboard.</Text>

        <Text style={s.section}>5. Your Rights</Text>
        <Text style={s.body}>You may delete your account at any time from Profile → Account Settings → Delete Account. This permanently removes your profile, session history, and leaderboard entry.</Text>

        <Text style={s.section}>6. Children's Privacy</Text>
        <Text style={s.body}>Samay is not directed to children under 13. We do not knowingly collect information from children under 13.</Text>

        <Text style={s.section}>7. Contact</Text>
        <Text style={s.body}>For privacy concerns, contact us at privacy@samay.in</Text>

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
