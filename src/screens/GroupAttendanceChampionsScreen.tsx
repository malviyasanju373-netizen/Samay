import React, { useCallback, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useGroupAttendance } from "@/hooks/useGroupAttendance";
import { useTheme } from "@/context/ThemeContext";
import { LoadingState, ErrorState } from "@/components/UIStates";

const MEDAL_CONFIG = [
  { emoji: "🥇", label: "Gold", color: "#F59E0B" },
  { emoji: "🥈", label: "Silver", color: "#9CA3AF" },
  { emoji: "🥉", label: "Bronze", color: "#D97706" },
];

export default function GroupAttendanceChampionsScreen({ route, navigation }: any) {
  const groupId = typeof route?.params?.groupId === "string" ? route.params.groupId : "";
  const groupName = route?.params?.groupName || "Group";
  const { theme } = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);

  const { rankedMembers, totalTrackedDays, loading } = useGroupAttendance(groupId);
  const error: string | null = null;

  const safeGoBack = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.("GroupDetail", { groupId });
  }, [navigation, groupId]);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={safeGoBack} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Attendance Champions</Text>
          <View style={{ width: 44 }} />
        </View>
        <LoadingState message="Loading champions..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={safeGoBack} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Error</Text>
          <View style={{ width: 44 }} />
        </View>
        <ErrorState title="Unable to Load" message={error} onRetry={safeGoBack} retryLabel="Go Back" />
      </SafeAreaView>
    );
  }

  const topThree = rankedMembers.slice(0, 3);
  const rest = rankedMembers.slice(3);

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={safeGoBack} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>Attendance Champions</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        {/* Most Consistent Member Card */}
        {rankedMembers.length > 0 && (
          <View style={s.consistentCard}>
            <View style={s.consistentHeader}>
              <Ionicons name="trophy" size={24} color={theme.colors.warning} />
              <Text style={s.consistentTitle}>Most Consistent Member</Text>
            </View>
            <Text style={s.consistentName}>{rankedMembers[0].displayName}</Text>
            <Text style={s.consistentPercent}>{rankedMembers[0].attendancePercentage}% attendance</Text>
            <Text style={s.consistentDetail}>
              {rankedMembers[0].presentDays} of {rankedMembers[0].totalDays} tracked days
            </Text>
          </View>
        )}

        {/* Podium - Top 3 */}
        {topThree.length > 0 && (
          <View style={s.podiumSection}>
            <Text style={s.sectionTitle}>Top 3 Champions</Text>
            {topThree.map((member, idx) => {
              const medal = MEDAL_CONFIG[idx];
              return (
                <View key={member.uid || `champ-${idx}`} style={[s.championCard, { borderLeftColor: medal.color, borderLeftWidth: 4 }]}>
                  <View style={s.medalBadge}>
                    <Text style={s.medalEmoji}>{medal.emoji}</Text>
                    <Text style={[s.medalLabel, { color: medal.color }]}>{medal.label}</Text>
                  </View>
                  <View style={s.championInfo}>
                    <Text style={s.championName}>{member.displayName}</Text>
                    <Text style={s.championPercent}>{member.attendancePercentage}%</Text>
                    <Text style={s.championDetail}>
                      {member.presentDays} present / {member.totalDays} tracked
                    </Text>
                  </View>
                  <View style={s.championBadge}>
                    <Text style={s.championBadgeText}>#{idx + 1}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Remaining Members */}
        {rest.length > 0 && (
          <View style={s.restSection}>
            <Text style={s.sectionTitle}>All Members</Text>
            {rest.map((member, idx) => (
              <View key={member.uid || `rest-${idx}`} style={s.restRow}>
                <Text style={s.restRank}>{idx + 4}</Text>
                <View style={s.restInfo}>
                  <Text style={s.restName}>{member.displayName}</Text>
                  <Text style={s.restDetail}>
                    {member.presentDays} present · {member.totalDays} tracked
                  </Text>
                </View>
                <Text style={s.restPercent}>{member.attendancePercentage}%</Text>
              </View>
            ))}
          </View>
        )}

        {/* No data state */}
        {rankedMembers.length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="trophy-outline" size={48} color={theme.colors.textTertiary} />
            <Text style={s.emptyText}>No attendance data available yet</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backBtn: { width: 44, height: 44, justifyContent: "center" },
    headerTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.text, flex: 1 },
    content: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 32 },
    // Most Consistent Card
    consistentCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 20,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.warning + "60",
    },
    consistentHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    consistentTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
    consistentName: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 4,
    },
    consistentPercent: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.success,
      marginBottom: 2,
    },
    consistentDetail: {
      fontSize: 13,
      color: theme.colors.textTertiary,
    },
    // Podium Section
    podiumSection: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 12,
    },
    championCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 10,
    },
    medalBadge: {
      alignItems: "center",
      minWidth: 48,
    },
    medalEmoji: {
      fontSize: 28,
    },
    medalLabel: {
      fontSize: 10,
      fontWeight: "700",
      marginTop: -2,
    },
    championInfo: {
      flex: 1,
    },
    championName: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 2,
    },
    championPercent: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    championDetail: {
      fontSize: 12,
      color: theme.colors.textTertiary,
      marginTop: 2,
    },
    championBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.primary + "20",
      justifyContent: "center",
      alignItems: "center",
    },
    championBadgeText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    // Rest Section
    restSection: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    },
    restRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: 10,
    },
    restRank: {
      width: 28,
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textTertiary,
      textAlign: "center",
    },
    restInfo: {
      flex: 1,
    },
    restName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    restDetail: {
      fontSize: 12,
      color: theme.colors.textTertiary,
      marginTop: 1,
    },
    restPercent: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    // Empty
    emptyState: {
      alignItems: "center",
      paddingVertical: 60,
      gap: 12,
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textTertiary,
    },
  });