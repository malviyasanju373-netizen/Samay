import React, { useCallback, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useGroupAttendance } from "@/hooks/useGroupAttendance";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { useTheme } from "@/context/ThemeContext";
import { LoadingState, ErrorState } from "@/components/UIStates";

const WEEK_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type NavCard = {
  title: string;
  icon: string;
  route: string;
  color: string;
};

const NAV_CARDS: NavCard[] = [
  { title: "Attendance Champions", icon: "trophy", route: "GroupAttendanceChampions", color: "#F59E0B" },
  { title: "Attendance Streaks", icon: "flame", route: "GroupAttendanceStreaks", color: "#F97316" },
  { title: "Weekly Report", icon: "calendar", route: "GroupWeeklyAttendance", color: "#38BDF8" },
  { title: "Monthly Report", icon: "stats-chart", route: "GroupMonthlyAttendance", color: "#A78BFA" },
  { title: "Member Attendance", icon: "people", route: "GroupMemberAttendance", color: "#22C55E" },
];

export default function GroupAttendanceScreen({ route, navigation }: any) {
  const groupId = typeof route?.params?.groupId === "string" ? route.params.groupId : "";
  const groupName = route?.params?.groupName || "Attendance";
  const { theme } = useTheme();

  const { todayPresent, totalMembers, attendancePercentage, weeklyAttendance, rankedMembers, loading } = useGroupAttendance(groupId);
  const error: string | null = null;
  const { leaderboard } = useGroupMembers(groupId);
  const s = useMemo(() => createStyles(theme), [theme]);
  const weekDateKeys = useMemo(() => Object.keys(weeklyAttendance).sort().slice(0, 7), [weeklyAttendance]);

  const safeGoBack = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.("GroupDetail", { groupId });
  }, [navigation, groupId]);

  const navigateTo = useCallback(
    (routeName: string) => {
      navigation?.navigate?.(routeName, { groupId, groupName });
    },
    [navigation, groupId, groupName]
  );

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
        <Text style={s.headerTitle} numberOfLines={1}>{groupName}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        {/* Today's Attendance Card */}
        <View style={s.attendanceCard}>
          <Text style={s.sectionTitle}>Today's Attendance</Text>
          <View style={s.attendanceStats}>
            <View style={s.statItem}>
              <Ionicons name="checkmark-circle" size={22} color={theme.colors.success} />
              <Text style={s.statValue}>{todayPresent}</Text>
              <Text style={s.statLabel}>Present</Text>
            </View>
            <View style={s.statItem}>
              <Ionicons name="people" size={22} color={theme.colors.primary} />
              <Text style={s.statValue}>{totalMembers}</Text>
              <Text style={s.statLabel}>Total</Text>
            </View>
            <View style={s.statItem}>
              <Ionicons name="analytics" size={22} color={theme.colors.accent2} />
              <Text style={s.statValue}>{attendancePercentage}%</Text>
              <Text style={s.statLabel}>Rate</Text>
            </View>
          </View>
        </View>

        {/* Dashboard Navigation Cards */}
        <Text style={s.sectionTitle}>Quick Navigation</Text>
        <View style={s.navGrid}>
          {NAV_CARDS.map((card) => (
            <TouchableOpacity
              key={card.route}
              style={s.navCard}
              activeOpacity={0.7}
              onPress={() => navigateTo(card.route)}
            >
              <View style={[s.navIconWrapper, { backgroundColor: card.color + "20" }]}>
                <Ionicons name={card.icon as any} size={24} color={card.color} />
              </View>
              <Text style={s.navCardTitle}>{card.title}</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          ))}
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
                        <Text style={s.dayStatus}>{isPresent ? "🟢" : "🔴"}</Text>
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
                (lm: any) => lm.uid === member.uid && lm.isStudying
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
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          },
          backBtn: { width: 44, height: 44, justifyContent: "center" },
    headerTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.text, flex: 1 },
    content: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 32 },
    attendanceCard: {
          backgroundColor: theme.colors.card,
          borderRadius: 12,
          padding: 20,
          marginBottom: 16,
        },
        attendanceStats: {
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "center",
          marginTop: 8,
        },
        statItem: { alignItems: "center", gap: 4 },
        statLabel: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: "500" },
        statValue: { fontSize: 22, fontWeight: "700", color: theme.colors.text },
        // Navigation cards
        navGrid: {
          gap: 10,
          marginBottom: 20,
        },
        navCard: {
          backgroundColor: theme.colors.card,
          borderRadius: 12,
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        navIconWrapper: {
          width: 40,
          height: 40,
          borderRadius: 10,
          justifyContent: "center",
          alignItems: "center",
        },
        navCardTitle: {
          flex: 1,
          fontSize: 15,
          fontWeight: "600",
          color: theme.colors.text,
        },
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
