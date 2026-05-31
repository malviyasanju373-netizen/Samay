import React, { useCallback, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useGroupAttendance } from "@/hooks/useGroupAttendance";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { useTheme } from "@/context/ThemeContext";
import { LoadingState, ErrorState } from "@/components/UIStates";

const WEEK_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function GroupAttendanceScreen({ route, navigation }: any) {
  const groupId = typeof route?.params?.groupId === "string" ? route.params.groupId : "";
  const groupName = route?.params?.groupName || "Attendance";
  const { theme } = useTheme();

  const { todayPresent, totalMembers, attendancePercentage, weeklyAttendance, rankedMembers, loading } = useGroupAttendance(groupId);
  const error: string | null = null;
  const { leaderboard } = useGroupMembers(groupId); // For studying badge check
  const s = useMemo(() => createStyles(theme), [theme]);
  const weekDateKeys = useMemo(() => Object.keys(weeklyAttendance).sort().slice(0, 7), [weeklyAttendance]);

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
        <LoadingState message="Loading attendance..." />
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
        <Text style={s.headerTitle} numberOfLines={1}>{groupName} Attendance</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        {/* Attendance Card */}
        <View style={s.attendanceCard}>
          <Text style={s.sectionTitle}>Today's Attendance</Text>
          <View style={s.attendanceStats}>
            <View style={s.statItem}>
              <Text style={s.statLabel}>Present</Text>
              <Text style={s.statValue}>{todayPresent}</Text>
            </View>
            <View style={s.statItem}>
              <Text style={s.statLabel}>Total</Text>
              <Text style={s.statValue}>{totalMembers}</Text>
            </View>
            <View style={s.statItem}>
              <Text style={s.statLabel}>Rate</Text>
              <Text style={s.statValue}>{attendancePercentage}%</Text>
            </View>
          </View>
        </View>

        {/* Weekly Member Attendance */}
        {Array.isArray(rankedMembers) && rankedMembers.length > 0 ? (
          <View style={s.weeklySection}>
            <Text style={s.sectionTitle}>Weekly Member Attendance</Text>
            {rankedMembers.map((member, idx) => (
              <View key={member.uid || `weekly-${idx}`} style={s.weeklyMemberCard}>
                <View style={s.weeklyMemberHeader}>
                  <Text style={s.weeklyMemberName} numberOfLines={1}>
                    {member.displayName || "User"}
                  </Text>
                  <Text style={s.weeklyPercent}>{member.attendancePercentage}%</Text>
                </View>
                <View style={s.weeklyRow}>
                  {WEEK_DAY_LABELS.map((dayLabel, dayIndex) => {
                    const dateKey = weekDateKeys[dayIndex];
                    const isPresent = dateKey
                      ? weeklyAttendance[dateKey]?.[member.uid]?.present === true
                      : false;

                    return (
                      <View key={`${member.uid || idx}-${dayLabel}`} style={s.dayCell}>
                        <Text style={s.dayLabel}>{dayLabel}</Text>
                        <Text style={s.dayStatus}>{isPresent ? "🟢 Present" : "🔴 Absent"}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Attendance Ranking */}
        {Array.isArray(rankedMembers) && rankedMembers.length > 0 ? (
          <View style={s.rankingSection}>
            <Text style={s.sectionTitle}>Attendance Ranking</Text>
            {rankedMembers.map((member, idx) => {
              const isStudying = Array.isArray(leaderboard) && leaderboard.some(
                (lm) => lm.uid === member.uid && lm.isStudying
              );
              return (
                <View key={member.uid || `rank-${idx}`} style={s.leaderboardRow}>
                  <Text style={s.rankText}>{idx + 1}</Text>
                  <Text style={s.memberName}>{member.displayName || "User"}</Text>
                  {isStudying && (
                    <View style={s.studyingBadge}>
                      <Text style={s.studyingBadgeText}>Focusing</Text>
                    </View>
                  )}
                  <Text style={s.memberScore}>{member.attendancePercentage}%</Text>
                </View>
              );
            })}
          </View>
        ) : null}
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
    attendanceCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    attendanceStats: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    statItem: { alignItems: "center" },
    statLabel: { fontSize: 12, color: theme.colors.textTertiary },
    statValue: { fontSize: 18, fontWeight: "700", color: theme.colors.primary },
    rankingSection: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
    },
    weeklySection: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    weeklyMemberCard: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    weeklyMemberHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
      gap: 12,
    },
    weeklyMemberName: {
      flex: 1,
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    weeklyPercent: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    weeklyRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    dayCell: {
      minWidth: 68,
      flexGrow: 1,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: 8,
      backgroundColor: theme.colors.background,
      alignItems: "center",
    },
    dayLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      marginBottom: 4,
    },
    dayStatus: {
      fontSize: 10,
      fontWeight: "600",
      color: theme.colors.text,
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
