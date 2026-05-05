import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/context/ThemeContext";

export default function PrivacySecurityScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = createStyles(theme);

  const rows = [
    { icon: "lock-closed-outline", label: "Privacy Policy", route: "PrivacyPolicy" },
    { icon: "document-text-outline", label: "Terms of Service", route: "Terms" },
    { icon: "trash-outline", label: "Delete Account", route: "DeleteAccount", danger: true },
  ];

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Privacy & Security</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={s.group}>
          {rows.map((row, i) => (
            <React.Fragment key={row.route}>
              <TouchableOpacity style={s.row} onPress={() => navigation.navigate(row.route)} activeOpacity={0.8}>
                <View style={s.rowInner}>
                  <Ionicons name={row.icon as any} size={18} color={row.danger ? theme.colors.error : theme.colors.textSecondary} style={s.icon} />
                  <Text style={[s.rowText, row.danger && { color: theme.colors.error }]}>{row.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              {i < rows.length - 1 && <View style={s.divider} />}
            </React.Fragment>
          ))}
        </View>
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
    group: { backgroundColor: theme.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 15 },
    rowInner: { flexDirection: "row", alignItems: "center", flex: 1 },
    icon: { marginRight: 12 },
    rowText: { fontSize: 15, color: theme.colors.text, fontWeight: "500" },
    divider: { height: 1, backgroundColor: theme.colors.border, marginHorizontal: 16 },
  });
}
