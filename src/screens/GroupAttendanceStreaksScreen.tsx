import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/context/ThemeContext";
import { LoadingState, ErrorState } from "@/components/UIStates";
import { requireFirestore } from "@/firebase";
import { getTodayDateKey, subscribeToAttendanceForDate } from "@/services/attendance";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { getSecondaryIdentifier } from "@/utils/memberIdentification";
import type { GroupMember } from "@/types/group";

import { calculateRankings, BaseLeaderboardEntry } from "@/utils/leaderboardUtils";

type AttendanceByDate = Record<string, Record<string, { present: boolean; displayName: string; focusMinutes: number }>>;
type TodayAttendanceRecord = { uid: string; displayName: string; focusMinutes: number; present: boolean };

export type AttendanceStreakMember = BaseLeaderboardEntry & {
  uid: string;
  displayName: string;
  streak: number;
};

export function calculateAttendanceStreaks(
  members: GroupMember[],
  attendanceByDate: AttendanceByDate
): AttendanceStreakMember[] {
  const dateKeys = Object.keys(attendanceByDate).sort((a, b) => b.localeCompare(a));
  if (dateKeys.length === 0) return [];

  const rawStreaks = members.map((member) => {
    let streak = 0;

    for (const dateKey of dateKeys) {
      const attendanceRecord = attendanceByDate[dateKey]?.[member.uid];
      if (attendanceRecord?.present === true) {
        streak += 1;
        continue;
      }
      break;
    }

    return {
      uid: member.uid,
      displayName: member.displayName || member.name || "User",
      streak,
      currentStreak: streak,
      totalSessions: (member as any).totalSessions || 0,
      joinedAtMs: (member as any).joinedAtMs || Number.MAX_SAFE_INTEGER,
    };
  });

  return calculateRankings(rawStreaks, "currentStreak") as AttendanceStreakMember[];
}

function buildFallbackStreaks(
  members: GroupMember[],
  todayRecords: TodayAttendanceRecord[]
): AttendanceStreakMember[] {
  const rawStreaks = members.map((member) => {
    const todayRecord = todayRecords.find((record) => record.uid === member.uid);
    const streak = todayRecord?.present ? 1 : 0;
    
    return {
      uid: member.uid,
      displayName: todayRecord?.displayName || member.displayName || member.name || "User",
      streak,
      currentStreak: streak,
      totalSessions: (member as any).totalSessions || 0,
      joinedAtMs: (member as any).joinedAtMs || Number.MAX_SAFE_INTEGER,
    };
  });

  return calculateRankings(rawStreaks, "currentStreak") as AttendanceStreakMember[];
}

function formatDayCount(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export default function GroupAttendanceStreaksScreen({ route, navigation }: any) {
  const groupId = typeof route?.params?.groupId === "string" ? route.params.groupId : "";
  const { theme } = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { members, loading: membersLoading, error: membersError } = useGroupMembers(groupId);
  const [attendanceByDate, setAttendanceByDate] = useState<AttendanceByDate>({});
  const [todayRecords, setTodayRecords] = useState<TodayAttendanceRecord[]>([]);
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
        console.error("[GroupAttendanceStreaks] Failed to load attendance:", err?.message);
        setAttendanceError("Unable to load attendance streak data");
      } finally {
        if (mounted) setAttendanceLoading(false);
      }
    };

    loadAttendance();

    return () => {
      mounted = false;
    };
  }, [groupId]);

  const calculatedStreakMembers = useMemo(
    () => calculateAttendanceStreaks(members, attendanceByDate),
    [attendanceByDate, members]
  );
  const fallbackUsed = calculatedStreakMembers.length === 0 && members.length > 0;
  const streakMembers = useMemo(
    () => fallbackUsed ? buildFallbackStreaks(members, todayRecords) : calculatedStreakMembers,
    [calculatedStreakMembers, fallbackUsed, members, todayRecords]
  );
  const longestStreakMember = streakMembers[0] ?? null;
  const loading = membersLoading || attendanceLoading;
  const error = attendanceError || membersError;

  console.log("[STREAK MEMBERS]", streakMembers);
  console.log("[LONGEST STREAK]", longestStreakMember);
  console.log("[FALLBACK STREAKS USED]", fallbackUsed);
  console.log("[FALLBACK STREAK MEMBERS]", streakMembers);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={safeGoBack} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Attendance Streaks</Text>
          <View style={{ width: 44 }} />
        </View>
        <LoadingState message="Loading streaks..." />
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
          <Text style={s.headerTitle}>Attendance Streaks</Text>
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
        <Text style={s.headerTitle} numberOfLines={1}>Attendance Streaks</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        {streakMembers.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="flame-outline" size={52} color={theme.colors.textTertiary} />
            <Text style={s.emptyText}>No attendance streak data available yet</Text>
          </View>
        ) : (
          <>
            {longestStreakMember && (
              <View style={s.highlightCard}>
                <View style={s.highlightHeader}>
                  <Ionicons name="flame" size={24} color={theme.colors.warning} />
                  <Text style={s.highlightTitle}>Longest Current Streak</Text>
                </View>
                <Text style={s.highlightName}>{longestStreakMember.displayName}</Text>
                <Text style={s.highlightId}>{getSecondaryIdentifier(longestStreakMember.uid, (members.find(m => m.uid === longestStreakMember.uid))?.email, (members.find(m => m.uid === longestStreakMember.uid))?.name)}</Text>
                <Text style={s.highlightCount}>{formatDayCount(longestStreakMember.streak)}</Text>
              </View>
            )}

            <Text style={s.sectionTitle}>Attendance Streak Rankings</Text>
            <View style={s.rankingsSection}>
              {streakMembers.map((member, idx) => {
                const memberData = members.find(m => m.uid === member.uid);
                return (
                  <View key={member.uid || `streak-${idx}`} style={s.rankingRow}>
                    <Text style={s.rankText}>#{idx + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.memberName} numberOfLines={1}>{member.displayName}</Text>
                      <Text style={s.memberSecondaryId}>{getSecondaryIdentifier(member.uid, memberData?.email, memberData?.name)}</Text>
                    </View>
                    <Text style={s.streakCount}>{formatDayCount(member.streak)}</Text>
                  </View>
                );
              })}
            </View>
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
    highlightCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 22,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.warning + "70",
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.warning,
    },
    highlightHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    highlightTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.textSecondary,
    },
    highlightName: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.text,
      textAlign: "center",
      marginBottom: 4,
    },
    highlightId: {
      fontSize: 12,
      color: theme.colors.textTertiary,
      marginBottom: 8,
    },
    highlightCount: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.warning,
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
      marginBottom: 20,
    },
    rankingRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: 12,
    },
    rankText: {
      width: 36,
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
    streakCount: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textSecondary,
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
