import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/context/ThemeContext";

export default function CamStudyComingSoonScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);

  const safeGoBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation?.navigate?.("GroupsList");
    }
  };

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={safeGoBack} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Cam Study</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={s.content}>
        <View style={s.iconContainer}>
          <Ionicons name="videocam" size={80} color={theme.colors.primary} />
        </View>

        <Text style={s.heading}>Coming Soon 🚀</Text>
        
        <Text style={s.description}>
          Live camera-based study sessions and camera activity rankings will be available in a future update.
        </Text>

        <View style={s.badge}>
          <Text style={s.badgeText}>Upcoming Feature</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.card,
    },
    backBtn: {
      width: 44,
      height: 44,
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      flex: 1,
      textAlign: "center",
    },
    content: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    iconContainer: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: theme.colors.surface,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 32,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 10,
    },
    heading: {
      fontSize: 28,
      fontWeight: "800",
      color: theme.colors.text,
      marginBottom: 16,
      textAlign: "center",
    },
    description: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: "center",
      lineHeight: 24,
      marginBottom: 32,
    },
    badge: {
      backgroundColor: theme.colors.primary + '20', // 20% opacity
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.primary + '40',
    },
    badgeText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
  });
