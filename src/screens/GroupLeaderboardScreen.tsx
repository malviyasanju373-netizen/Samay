import React, { useCallback, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { useTheme } from "@/context/ThemeContext";
import { LoadingState, ErrorState } from "@/components/UIStates";
import { formatLiveElapsedTime, formatStudyTime } from "@/utils/timeFormat";

export default function GroupLeaderboardScreen({ route, navigation }: any) {
  const groupId = typeof route?.params?.groupId === "string" ? route.params.groupId : "";
  const groupName = route?.params?.groupName || "Leaderboard";
  const { theme } = useTheme();

  const { leaderboard, loading, error } = useGroupMembers(groupId);
  const s = useMemo(() => createStyles(theme), [theme]);

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
          <Text style={s.headerTitle}>Loading...</Text>
          <View style={{ width: 44 }} />
        </View>
        <LoadingState message="Loading leaderboard..." />
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

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={safeGoBack} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{groupName} Leaderboard</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        {/* Leaderboard */}
        {Array.isArray(leaderboard) && leaderboard.length > 0 ? (
          <View style={s.leaderboardSection}>
            <Text style={s.sectionTitle}>Leaderboard</Text>
            {leaderboard.map((member, idx) => (
              <View key={member?.uid || `member-${idx}`} style={s.leaderboardRow}>
                <Text style={s.rankText}>{idx + 1}</Text>
                <View style={[s.studyingDot, { backgroundColor: member?.isOnline ? '#22C55E' : '#9CA3AF' }]} />
                <Text style={s.memberName}>{member?.displayName || "Unknown"}</Text>
                {member?.isStudying && (
                  <View style={s.studyingBadge}>
                    <Text style={s.studyingBadgeText}>Studying</Text>
                  </View>
                )}

                <Text style={s.memberScore}>{formatStudyTime(member?.totalFocusSeconds ?? ((member?.totalFocusMinutes || 0) * 60))}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: theme.colors.textSecondary, textAlign: 'center', marginTop: 20 }}>No members found.</Text>
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
    },
    backBtn: { width: 44, height: 44, justifyContent: "center" },
    headerTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.text, flex: 1 },
    content: { flex: 1 },
    scrollContent: { padding: 16 },
    leaderboardSection: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
    },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text, marginBottom: 12 },
    leaderboardRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    rankText: { width: 30, fontSize: 14, fontWeight: "700", color: theme.colors.primary },
    memberName: { flex: 1, fontSize: 14, color: theme.colors.text },
    memberScore: { fontSize: 14, fontWeight: "600", color: theme.colors.textSecondary },
    studyingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#22C55E",
      marginRight: 8,
    },
    studyingBadge: {
      backgroundColor: "#22C55E",
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginRight: 8,
    },
    studyingBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "700",
    },
  });
