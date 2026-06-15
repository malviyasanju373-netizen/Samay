import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { LoadingState, ErrorState } from "@/components/UIStates";
import { useTheme } from "@/context/ThemeContext";
import { requireFirestore } from "@/firebase";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { getSecondaryIdentifier } from "@/utils/memberIdentification";
import type { GroupMember } from "@/types/group";

import { calculateRankings, BaseLeaderboardEntry } from "@/utils/leaderboardUtils";

type AttendanceByDate = Record<string, Record<string, { present: boolean; displayName: string; focusMinutes: number }>>;

type WeeklyMember = BaseLeaderboardEntry & {
  uid: string;
  displayName: string;
  email?: string;
  username?: string;
  presentDays: number;
  totalDays: number;
  attendancePercentage: number;
};

type WeeklySummary = {
  presentRecords: number;
  totalPossibleRecords: number;
  attendanceRate: number;
};

type WeeklyReport = {
  weeklyMembers: WeeklyMember[];
  weeklySummary: WeeklySummary;
  hasAttendanceData: boolean;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekdayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return WEEKDAY_LABELS[new Date(year, month - 1, day).getDay()];
}

export function getLast7Days(): string[] {
  const dateKeys: string[] = [];
  const today = new Date();

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    dateKeys.push(toDateKey(date));
  }

  return dateKeys;
}

export function buildWeeklyAttendanceReport(
  members: GroupMember[],
  attendanceByDate: AttendanceByDate,
  dateKeys: string[]
): WeeklyReport {
  const hasAttendanceData = dateKeys.some((dateKey) => Object.keys(attendanceByDate[dateKey] || {}).length > 0);
  const totalPossibleRecords = members.length * dateKeys.length;
  let presentRecords = 0;

  const rawMembers = members.map((member) => {
    let weeklyFocusSeconds = 0;
    const presentDays = dateKeys.reduce((count, dateKey) => {
      const record = attendanceByDate[dateKey]?.[member.uid];
      const present = record?.present === true;
      if (present) presentRecords += 1;
      if (record?.focusMinutes) weeklyFocusSeconds += record.focusMinutes * 60;
      return present ? count + 1 : count;
    }, 0);
    const attendancePercentage = dateKeys.length > 0
      ? Math.round((presentDays / dateKeys.length) * 100)
      : 0;

    return {
      uid: member.uid,
      displayName: member.displayName || member.name || "User",
      email: member.email,
      username: member.name,
      presentDays,
      totalDays: dateKeys.length,
      attendancePercentage,
      weeklyFocusSeconds,
      currentStreak: (member as any).currentStreak || 0,
      totalSessions: (member as any).totalSessions || 0,
      joinedAtMs: (member as any).joinedAtMs || Number.MAX_SAFE_INTEGER,
    };
  });

  const weeklyMembers = calculateRankings(rawMembers, "weeklyFocusSeconds") as WeeklyMember[];

  const weeklySummary = {
    presentRecords,
    totalPossibleRecords,
    attendanceRate: totalPossibleRecords > 0
      ? Math.round((presentRecords / totalPossibleRecords) * 100)
      : 0,
  };

  return { weeklyMembers, weeklySummary, hasAttendanceData };
}

export default function GroupWeeklyAttendanceScreen({ route, navigation }: any) {
  const groupId = typeof route?.params?.groupId === "string" ? route.params.groupId : "";
  const { theme } = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { members, loading: membersLoading, error: membersError } = useGroupMembers(groupId);
  const dateKeys = useMemo(() => getLast7Days(), []);
  const [attendanceByDate, setAttendanceByDate] = useState<AttendanceByDate>({});
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  const safeGoBack = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.("GroupDetail", { groupId });
  }, [navigation, groupId]);

  useEffect(() => {
    if (!groupId) {
      setAttendanceByDate({});
      setAttendanceLoading(false);
      setAttendanceError("Missing group id");
      return;
    }

    let mounted = true;
    setAttendanceLoading(true);
    setAttendanceError(null);

    const loadWeeklyAttendance = async () => {
      try {
        const db = requireFirestore();
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
        console.error("[GroupWeeklyAttendance] Failed to load weekly attendance:", err?.message);
        setAttendanceError("Unable to load weekly attendance data");
      } finally {
        if (mounted) setAttendanceLoading(false);
      }
    };

    loadWeeklyAttendance();

    return () => {
      mounted = false;
    };
  }, [dateKeys, groupId]);

  const { weeklyMembers, weeklySummary, hasAttendanceData } = useMemo(
    () => buildWeeklyAttendanceReport(members, attendanceByDate, dateKeys),
    [attendanceByDate, dateKeys, members]
  );
  const loading = membersLoading || attendanceLoading;
  const error = attendanceError || membersError;

  console.log("[WEEKLY DATE KEYS]", dateKeys);
  console.log("[WEEKLY MEMBERS]", weeklyMembers);
  console.log("[WEEKLY SUMMARY]", weeklySummary);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={safeGoBack} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Weekly Report</Text>
          <View style={{ width: 44 }} />
        </View>
        <LoadingState message="Loading weekly report..." />
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
          <Text style={s.headerTitle}>Weekly Report</Text>
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
        <Text style={s.headerTitle} numberOfLines={1}>Weekly Report</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        {!hasAttendanceData ? (
          <View style={s.emptyState}>
            <Ionicons name="calendar-outline" size={52} color={theme.colors.textTertiary} />
            <Text style={s.emptyText}>No weekly attendance data available yet</Text>
          </View>
        ) : (
          <>
            <View style={s.summaryCard}>
              <View style={s.summaryHeader}>
                <Ionicons name="calendar" size={24} color={theme.colors.primary} />
                <Text style={s.summaryTitle}>This Week</Text>
              </View>
              <View style={s.summaryStats}>
                <View style={s.summaryStat}>
                  <Text style={s.summaryValue}>{weeklySummary.presentRecords}</Text>
                  <Text style={s.summaryLabel}>Present Records</Text>
                </View>
                <View style={s.summaryStat}>
                  <Text style={s.summaryValue}>{weeklySummary.totalPossibleRecords}</Text>
                  <Text style={s.summaryLabel}>Total Possible Records</Text>
                </View>
                <View style={s.summaryStat}>
                  <Text style={s.summaryValue}>{weeklySummary.attendanceRate}%</Text>
                  <Text style={s.summaryLabel}>Attendance Rate</Text>
                </View>
              </View>
            </View>

            <Text style={s.sectionTitle}>Weekly Member Rankings</Text>
            <View style={s.rankingsSection}>
              {weeklyMembers.map((member, idx) => (
                <View key={member.uid || `weekly-rank-${idx}`} style={s.rankingRow}>
                  <Text style={s.rankText}>#{idx + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.memberName} numberOfLines={1}>{member.displayName}</Text>
                    <Text style={s.memberSecondaryId}>{getSecondaryIdentifier(member.uid, member.email, member.username)}</Text>
                  </View>
                  <Text style={s.memberDays}>{member.presentDays}/{member.totalDays}</Text>
                  <Text style={s.memberPercent}>{member.attendancePercentage}%</Text>
                </View>
              ))}
            </View>

            <Text style={s.sectionTitle}>Weekly Attendance Grid</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.gridSection}>
                <View style={s.gridRow}>
                  <Text style={[s.gridNameCell, s.gridHeaderText]}>Member</Text>
                  {dateKeys.map((dateKey) => (
                    <Text key={dateKey} style={[s.gridDayCell, s.gridHeaderText]}>
                      {getWeekdayLabel(dateKey)}
                    </Text>
                  ))}
                </View>
                {weeklyMembers.map((member, idx) => (
                  <View key={member.uid || `weekly-grid-${idx}`} style={s.gridRow}>
                    <Text style={s.gridNameCell} numberOfLines={1}>{member.displayName}</Text>
                    {dateKeys.map((dateKey) => {
                      const present = attendanceByDate[dateKey]?.[member.uid]?.present === true;
                      return (
                        <Text
                          key={`${member.uid}-${dateKey}`}
                          style={[
                            s.gridDayCell,
                            present ? s.presentMark : s.absentMark,
                          ]}
                        >
                          {present ? "✓" : "✗"}
                        </Text>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </>
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
    summaryCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 22,
      borderWidth: 1,
      borderColor: theme.colors.primary + "60",
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
    },
    summaryHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginBottom: 16,
    },
    summaryTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    summaryStats: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
    },
    summaryStat: {
      flex: 1,
      alignItems: "center",
      gap: 4,
    },
    summaryValue: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.text,
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.textTertiary,
      textAlign: "center",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 12,
    },
    rankingsSection: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 22,
    },
    rankingRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: 10,
    },
    rankText: {
      width: 38,
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    memberName: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    memberSecondaryId: {
      fontSize: 12,
      color: theme.colors.textTertiary,
      marginTop: 1,
    },
    memberDays: {
      width: 44,
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      textAlign: "right",
    },
    memberPercent: {
      width: 48,
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.primary,
      textAlign: "right",
    },
    gridSection: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 20,
      minWidth: 430,
    },
    gridRow: {
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    gridNameCell: {
      width: 118,
      paddingVertical: 10,
      paddingRight: 10,
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    gridDayCell: {
      width: 42,
      paddingVertical: 10,
      textAlign: "center",
      fontSize: 15,
      fontWeight: "700",
    },
    gridHeaderText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    presentMark: {
      color: theme.colors.success,
    },
    absentMark: {
      color: theme.colors.textTertiary,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 72,
      gap: 12,
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textTertiary,
      textAlign: "center",
    },
  });
