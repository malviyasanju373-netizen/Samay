import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useGroupAttendance } from "@/hooks/useGroupAttendance";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { useGroup } from "@/hooks/useGroup";
import { useTheme } from "@/context/ThemeContext";
import { getCurrentUserUid, requireFirestore } from "@/firebase";
import { getTodayDateKey, subscribeToAttendanceForDate } from "@/services/attendance";
import { formatStudyTime } from "@/utils/timeFormat";
import { LoadingState, ErrorState } from "@/components/UIStates";
import { calculateAttendanceStreaks, type AttendanceStreakMember } from "@/screens/GroupAttendanceStreaksScreen";

type TabKey = "attendance" | "ranking" | "streaks" | "reports";

type AttendanceByDate = Record<string, Record<string, { present: boolean; displayName: string; focusMinutes: number }>>;
type TodayAttendanceRecord = { uid: string; displayName: string; focusMinutes: number; present: boolean };

type ReportCard = {
  title: string;
  icon: string;
  route: string;
  color: string;
  adminOnly?: boolean;
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "attendance", label: "Attendance" },
  { key: "ranking", label: "Ranking" },
  { key: "streaks", label: "Streaks" },
  { key: "reports", label: "Reports" },
];

const REPORT_CARDS: ReportCard[] = [
  { title: "Weekly Report", icon: "calendar", route: "GroupWeeklyAttendance", color: "#38BDF8" },
  { title: "Monthly Report", icon: "stats-chart", route: "GroupMonthlyAttendance", color: "#A78BFA" },
  { title: "Attendance Champions", icon: "trophy", route: "GroupAttendanceChampions", color: "#F59E0B" },
  { title: "Member Attendance", icon: "people", route: "GroupMemberAttendance", color: "#22C55E", adminOnly: true },
];

function formatDays(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function getRankLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

function buildFallbackStreaks(
  members: ReturnType<typeof useGroupMembers>["members"],
  todayRecords: TodayAttendanceRecord[]
): AttendanceStreakMember[] {
  return members
    .map((member, originalIndex) => {
      const todayRecord = todayRecords.find((record) => record.uid === member.uid);
      return {
        uid: member.uid,
        displayName: todayRecord?.displayName || member.displayName || member.name || "User",
        streak: todayRecord?.present ? 1 : 0,
        originalIndex,
      };
    })
    .sort((a, b) => b.streak - a.streak || a.originalIndex - b.originalIndex)
    .map(({ originalIndex, ...member }) => member);
}

export default function GroupAttendanceScreen({ route, navigation }: any) {
  const groupId = typeof route?.params?.groupId === "string" ? route.params.groupId : "";
  const groupName = route?.params?.groupName || "Attendance";
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<TabKey>("attendance");
  const [attendanceByDate, setAttendanceByDate] = useState<AttendanceByDate>({});
  const [todayRecords, setTodayRecords] = useState<TodayAttendanceRecord[]>([]);
  const [streakLoading, setStreakLoading] = useState(true);
  const [streakError, setStreakError] = useState<string | null>(null);

  const { group, loading: groupLoading, error: groupError } = useGroup(groupId);
  const { todayPresent, totalMembers, attendancePercentage, rankedMembers, loading: attendanceLoading } = useGroupAttendance(groupId);
  const { members, leaderboard, loading: membersLoading, error: membersError } = useGroupMembers(groupId);
  const s = useMemo(() => createStyles(theme), [theme]);

  const currentUid = getCurrentUserUid();
  const isAdminOrOwner = Boolean(currentUid && (group?.adminId === currentUid || group?.createdBy === currentUid));
  const error = groupError || membersError;
  const loading = attendanceLoading || groupLoading || membersLoading;

  const attendanceRanking = useMemo(
    () => [...rankedMembers].sort((a, b) => b.attendancePercentage - a.attendancePercentage),
    [rankedMembers]
  );

  const studyTimeRanking = useMemo(
    () => [...leaderboard].sort((a, b) => (b.totalFocusMinutes || 0) - (a.totalFocusMinutes || 0)),
    [leaderboard]
  );

  const calculatedStreakMembers: AttendanceStreakMember[] = useMemo(
    () => calculateAttendanceStreaks(members, attendanceByDate),
    [attendanceByDate, members]
  );
  const fallbackStreakMembers = useMemo(
    () => buildFallbackStreaks(members, todayRecords),
    [members, todayRecords]
  );
  const streakMembers = calculatedStreakMembers.length === 0 ? fallbackStreakMembers : calculatedStreakMembers;
  const currentStreakLeader = streakMembers[0] ?? null;
  const duplicateDisplayNames = useMemo(() => {
    const counts = streakMembers.reduce<Record<string, number>>((acc, member) => {
      acc[member.displayName] = (acc[member.displayName] || 0) + 1;
      return acc;
    }, {});
    return new Set(Object.keys(counts).filter((name) => counts[name] > 1));
  }, [streakMembers]);

  const visibleReportCards = useMemo(
    () => REPORT_CARDS.filter((card) => !card.adminOnly || isAdminOrOwner),
    [isAdminOrOwner]
  );

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

  useEffect(() => {
    if (!groupId) {
      setAttendanceByDate({});
      setStreakLoading(false);
      setStreakError("Missing group id");
      return;
    }

    let mounted = true;
    setStreakLoading(true);
    setStreakError(null);

    const loadAttendance = async () => {
      try {
        const db = requireFirestore();
        const attendanceDatesSnap = await db
          .collection("groups")
          .doc(groupId)
          .collection("attendance")
          .get();
        const dateKeys = attendanceDatesSnap.docs.map((doc) => doc.id).sort((a, b) => b.localeCompare(a));
        const attendanceEntries = await Promise.all(
          dateKeys.map(async (dateKey) => {
            const membersSnap = await db
              .collection("groups")
              .doc(groupId)
              .collection("attendance")
              .doc(dateKey)
              .collection("members")
              .get();

            const memberAttendance: AttendanceByDate[string] = {};
            membersSnap.docs.forEach((doc) => {
              const data = doc.data();
              memberAttendance[doc.id] = {
                present: Boolean(data?.present),
                displayName: String(data?.displayName || "User"),
                focusMinutes: Number(data?.focusMinutes ?? data?.minutes ?? 0),
              };
            });

            return [dateKey, memberAttendance] as const;
          })
        );

        if (!mounted) return;
        setAttendanceByDate(Object.fromEntries(attendanceEntries));
      } catch (err: any) {
        if (!mounted) return;
        console.error("[GroupAttendanceScreen] Failed to load attendance streak data:", err?.message);
        setStreakError("Unable to load attendance streak data");
      } finally {
        if (mounted) setStreakLoading(false);
      }
    };

    loadAttendance();

    return () => {
      mounted = false;
    };
  }, [groupId]);

  useEffect(() => {
    if (!groupId) {
      setTodayRecords([]);
      return;
    }

    const unsubscribe = subscribeToAttendanceForDate(
      groupId,
      getTodayDateKey(),
      setTodayRecords,
      () => {
        setTodayRecords([]);
      }
    );

    return () => unsubscribe();
  }, [groupId]);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={safeGoBack} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Loading...</Text>
          <View style={s.headerSpacer} />
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
          <View style={s.headerSpacer} />
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
        <View style={s.headerSpacer} />
      </View>

      <View style={s.tabs}>
        {TABS.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.tabButton, selected && s.tabButtonActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <Text style={[s.tabText, selected && s.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        {activeTab === "attendance" && (
          <>
            <View style={s.metricsGrid}>
              <View style={s.metricCard}>
                <Ionicons name="checkmark-circle" size={22} color={theme.colors.success} />
                <Text style={s.metricValue}>{todayPresent}</Text>
                <Text style={s.metricLabel}>Present Members</Text>
              </View>
              <View style={s.metricCard}>
                <Ionicons name="people" size={22} color={theme.colors.primary} />
                <Text style={s.metricValue}>{totalMembers}</Text>
                <Text style={s.metricLabel}>Total Members</Text>
              </View>
              <View style={s.metricCard}>
                <Ionicons name="analytics" size={22} color={theme.colors.accent2} />
                <Text style={s.metricValue}>{attendancePercentage}%</Text>
                <Text style={s.metricLabel}>Attendance Rate</Text>
              </View>
            </View>

            <View style={s.summaryCard}>
              <Text style={s.sectionTitle}>Today's Attendance</Text>
              <Text style={s.summaryText}>
                {todayPresent} of {totalMembers} members are marked present today.
              </Text>
              <Text style={s.summarySubtext}>Current attendance rate: {attendancePercentage}%</Text>
            </View>
          </>
        )}

        {activeTab === "ranking" && (
          <>
            <Text style={s.sectionTitle}>Attendance Ranking</Text>
            <View style={s.listCard}>
              {attendanceRanking.length === 0 ? (
                <Text style={s.emptyText}>No attendance ranking available yet</Text>
              ) : (
                attendanceRanking.map((member, idx) => (
                  <View key={member.uid || `attendance-${idx}`} style={s.rankingRow}>
                    <Text style={s.rankText}>#{idx + 1}</Text>
                    <Text style={s.memberName} numberOfLines={1}>{member.displayName || "User"}</Text>
                    <Text style={s.scoreText}>{member.attendancePercentage}%</Text>
                  </View>
                ))
              )}
            </View>

            <Text style={s.sectionTitle}>Study Time Ranking</Text>
            <View style={s.listCard}>
              {studyTimeRanking.length === 0 ? (
                <Text style={s.emptyText}>No study time ranking available yet</Text>
              ) : (
                studyTimeRanking.map((member, idx) => (
                  <View key={member.uid || `study-${idx}`} style={s.rankingRow}>
                    <Text style={s.rankText}>#{idx + 1}</Text>
                    <Text style={s.memberName} numberOfLines={1}>{member.displayName || member.name || "User"}</Text>
                    <Text style={s.scoreText}>{formatStudyTime(member.totalFocusSeconds ?? (member.totalFocusMinutes || 0) * 60)}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {activeTab === "streaks" && (
          <>
            {streakLoading ? (
              <View style={s.listCard}>
                <Text style={s.emptyText}>Loading streaks...</Text>
              </View>
            ) : streakError ? (
              <View style={s.listCard}>
                <Text style={s.emptyText}>{streakError}</Text>
              </View>
            ) : streakMembers.length === 0 ? (
              <View style={s.listCard}>
                <Text style={s.emptyText}>No attendance streak data available yet</Text>
              </View>
            ) : (
              <>
                <View style={s.streakLeaderCard}>
                  <View style={s.streakLeaderHeader}>
                    <Ionicons name="flame" size={24} color={theme.colors.warning} />
                    <Text style={s.streakLeaderTitle}>Current Streak Leader</Text>
                  </View>
                  <Text style={s.streakLeaderName} numberOfLines={1}>{currentStreakLeader?.displayName}</Text>
                  <Text style={s.streakLeaderDays}>{formatDays(currentStreakLeader?.streak ?? 0)}</Text>
                </View>

                <Text style={s.sectionTitle}>🏆 Streak Leaderboard</Text>
                <View style={s.listCard}>
                  {streakMembers.map((member, idx) => (
                    <View key={member.uid || `streak-${idx}`} style={s.rankingRow}>
                      <Text style={s.rankBadge}>{getRankLabel(idx + 1)}</Text>
                      <View style={s.memberTextBlock}>
                        <Text style={s.memberName} numberOfLines={1}>{member.displayName}</Text>
                        {duplicateDisplayNames.has(member.displayName) && (
                          <Text style={s.memberUidSuffix}>...{member.uid.slice(-4)}</Text>
                        )}
                      </View>
                      <Text style={s.scoreText}>{formatDays(member.streak)}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {activeTab === "reports" && (
          <View style={s.reportGrid}>
            {visibleReportCards.map((card) => (
              <TouchableOpacity
                key={card.route}
                style={s.reportCard}
                activeOpacity={0.75}
                onPress={() => navigateTo(card.route)}
              >
                <View style={[s.reportIconWrapper, { backgroundColor: card.color + "20" }]}>
                  <Ionicons name={card.icon as any} size={24} color={card.color} />
                </View>
                <Text style={s.reportTitle}>{card.title}</Text>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            ))}
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
    headerSpacer: { width: 44 },
    headerTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.text, flex: 1 },
    tabs: {
      flexDirection: "row",
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: 6,
    },
    tabButton: {
      flex: 1,
      minHeight: 36,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    tabButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      textAlign: "center",
    },
    tabTextActive: {
      color: "#fff",
    },
    content: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 32 },
    metricsGrid: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 16,
    },
    metricCard: {
      flex: 1,
      minHeight: 112,
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      padding: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 5,
    },
    metricValue: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.colors.text,
    },
    metricLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.textTertiary,
      textAlign: "center",
    },
    summaryCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 12,
    },
    summaryText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 6,
    },
    summarySubtext: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    listCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      padding: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    rankingRow: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: 10,
    },
    rankText: {
      width: 42,
      fontSize: 14,
      fontWeight: "800",
      color: theme.colors.primary,
    },
    flameRank: {
      width: 58,
      fontSize: 14,
      fontWeight: "800",
      color: theme.colors.primary,
    },
    rankBadge: {
      width: 42,
      fontSize: 16,
      fontWeight: "800",
      color: theme.colors.primary,
      textAlign: "center",
    },
    memberTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    memberName: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    memberUidSuffix: {
      fontSize: 12,
      color: theme.colors.textTertiary,
      marginTop: 2,
    },
    scoreText: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.colors.textSecondary,
    },
    emptyText: {
      paddingVertical: 24,
      fontSize: 14,
      color: theme.colors.textTertiary,
      textAlign: "center",
    },
    streakLeaderCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      padding: 18,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: theme.colors.warning + "70",
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.warning,
    },
    streakLeaderHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    streakLeaderTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.colors.text,
    },
    streakLeaderName: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.text,
      marginBottom: 4,
    },
    streakLeaderDays: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.colors.warning,
    },
    reportGrid: {
      gap: 10,
    },
    reportCard: {
      minHeight: 64,
      backgroundColor: theme.colors.card,
      borderRadius: 8,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    reportIconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    reportTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
  });
