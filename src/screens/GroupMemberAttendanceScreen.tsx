import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { LoadingState, ErrorState } from "@/components/UIStates";
import { useTheme } from "@/context/ThemeContext";
import { requireFirestore } from "@/firebase";
import { useGroupAttendance } from "@/hooks/useGroupAttendance";
import { getSecondaryIdentifier } from "@/utils/memberIdentification";
import type { RankedMember } from "@/hooks/useGroupAttendance";

type AttendanceByDate = Record<string, Record<string, { present: boolean; displayName: string; focusMinutes: number }>>;

type MemberAttendanceStats = {
  uid: string;
  displayName: string;
  email?: string;
  username?: string;
  attendancePercentage: number;
  presentDays: number;
  totalTrackedDays: number;
  currentStreak: number;
  longestStreak: number;
  totalFocusMinutes: number;
};

function formatDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function calculateCurrentStreak(uid: string, dateKeys: string[], attendanceByDate: AttendanceByDate): number {
  let streak = 0;

  for (const dateKey of [...dateKeys].reverse()) {
    if (attendanceByDate[dateKey]?.[uid]?.present === true) {
      streak += 1;
      continue;
    }
    break;
  }

  return streak;
}

function calculateLongestStreak(uid: string, dateKeys: string[], attendanceByDate: AttendanceByDate): number {
  let longest = 0;
  let current = 0;

  dateKeys.forEach((dateKey) => {
    if (attendanceByDate[dateKey]?.[uid]?.present === true) {
      current += 1;
      longest = Math.max(longest, current);
      return;
    }
    current = 0;
  });

  return longest;
}

/**
 * Build member stats from ranked members and streak data
 */
export function buildMemberAttendanceStats(
  rankedMembers: RankedMember[],
  attendanceByDate: AttendanceByDate,
  dateKeys: string[]
): MemberAttendanceStats[] {
  console.log("[MEMBER ATTENDANCE DATA] Processing", rankedMembers.length, "members");
  console.log("[MEMBER ATTENDANCE DATA] Date keys:", dateKeys.length, "days");

  const stats = rankedMembers.map((member) => {
    const currentStreak = calculateCurrentStreak(member.uid, dateKeys, attendanceByDate);
    const longestStreak = calculateLongestStreak(member.uid, dateKeys, attendanceByDate);

    const stat: MemberAttendanceStats = {
      uid: member.uid,
      displayName: member.displayName,
      email: member.email,
      username: member.username,
      attendancePercentage: member.attendancePercentage,
      presentDays: member.presentDays,
      totalTrackedDays: member.totalDays,
      currentStreak,
      longestStreak,
      totalFocusMinutes: member.totalFocusMinutes,
    };

    console.log("[MEMBER SUMMARY]", stat);
    return stat;
  });

  // Log streak info
  stats.forEach((stat) => {
    console.log(
      `[MEMBER STREAKS] ${stat.displayName}: current=${stat.currentStreak}, longest=${stat.longestStreak}`
    );
  });

  return stats;
}

export default function GroupMemberAttendanceScreen({ route, navigation }: any) {
  const groupId = typeof route?.params?.groupId === "string" ? route.params.groupId : "";
  const { theme } = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  
  // Get ranked members and summary data from useGroupAttendance
  const { rankedMembers, totalTrackedDays, loading: useGroupAttendanceLoading } = useGroupAttendance(groupId);
  
  // Load attendance data separately for streak calculations
  const [attendanceByDate, setAttendanceByDate] = useState<AttendanceByDate>({});
  const [dateKeys, setDateKeys] = useState<string[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberAttendanceStats | null>(null);

  const safeGoBack = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.("GroupDetail", { groupId });
  }, [navigation, groupId]);

  // Load attendance data for streak calculations
  useEffect(() => {
    if (!groupId) {
      setAttendanceByDate({});
      setDateKeys([]);
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
        
        const loadedDateKeys = attendanceDatesSnap.docs.map((doc) => doc.id).sort();
        console.log("[MEMBER ATTENDANCE DATA] Found", loadedDateKeys.length, "tracked days");
        
        const attendanceEntries = await Promise.all(
          loadedDateKeys.map(async (dateKey) => {
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
        setDateKeys(loadedDateKeys);
        setAttendanceByDate(Object.fromEntries(attendanceEntries));
      } catch (err: any) {
        if (!mounted) return;
        console.error("[GroupMemberAttendance] Failed to load attendance:", err?.message);
        setAttendanceError("Unable to load member attendance data");
      } finally {
        if (mounted) setAttendanceLoading(false);
      }
    };

    loadAttendance();

    return () => {
      mounted = false;
    };
  }, [groupId]);

  // Build member stats from ranked members and attendance data
  const memberStats = useMemo(
    () => buildMemberAttendanceStats(rankedMembers, attendanceByDate, dateKeys),
    [rankedMembers, attendanceByDate, dateKeys]
  );
  
  const topPerformer = memberStats[0] ?? null;
  const loading = useGroupAttendanceLoading || attendanceLoading;
  const error = attendanceError;

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={safeGoBack} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Member Attendance</Text>
          <View style={{ width: 44 }} />
        </View>
        <LoadingState message="Loading member attendance..." />
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
          <Text style={s.headerTitle}>Member Attendance</Text>
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
        <Text style={s.headerTitle} numberOfLines={1}>Member Attendance</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        {topPerformer && (
          <View style={s.topCard}>
            <View style={s.topHeader}>
              <Ionicons name="ribbon" size={24} color={theme.colors.warning} />
              <Text style={s.topTitle}>Top Performer</Text>
            </View>
            <Text style={s.topName}>{topPerformer.displayName}</Text>
            <Text style={s.topId}>{getSecondaryIdentifier(topPerformer.uid, topPerformer.email, topPerformer.username)}</Text>
            <Text style={s.topPercent}>{topPerformer.attendancePercentage}% attendance</Text>
            <Text style={s.topDetail}>{topPerformer.currentStreak} day current streak</Text>
          </View>
        )}

        {memberStats.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="people-outline" size={52} color={theme.colors.textTertiary} />
            <Text style={s.emptyText}>No group members available yet</Text>
          </View>
        ) : (
          <View style={s.memberSection}>
            <Text style={s.sectionTitle}>Members</Text>
            {memberStats.map((member) => (
              <TouchableOpacity
                key={member.uid}
                style={s.memberCard}
                activeOpacity={0.75}
                onPress={() => setSelectedMember(member)}
              >
                <View style={s.memberHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.memberName} numberOfLines={1}>{member.displayName}</Text>
                    <Text style={s.memberSecondaryId}>{getSecondaryIdentifier(member.uid, member.email, member.username)}</Text>
                  </View>
                  <Text style={s.memberPercent}>{member.attendancePercentage}%</Text>
                </View>
                <View style={s.statGrid}>
                  <Text style={s.statText}>Present: {member.presentDays}</Text>
                  <Text style={s.statText}>Tracked: {member.totalTrackedDays}</Text>
                  <Text style={s.statText}>Current: {member.currentStreak}</Text>
                  <Text style={s.statText}>Longest: {member.longestStreak}</Text>
                  <Text style={s.statText}>Focus: {member.totalFocusMinutes} min</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!selectedMember} animationType="slide" transparent onRequestClose={() => setSelectedMember(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={1}>{selectedMember?.displayName || "Member"}</Text>
              <TouchableOpacity style={s.closeBtn} onPress={() => setSelectedMember(null)}>
                <Ionicons name="close" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {selectedMember && (
              <ScrollView contentContainerStyle={s.modalContent}>
                <View style={s.detailStats}>
                  <Text style={s.detailStat}>Attendance: {selectedMember.attendancePercentage}%</Text>
                  <Text style={s.detailStat}>Present Days: {selectedMember.presentDays}</Text>
                  <Text style={s.detailStat}>Total Days: {selectedMember.totalTrackedDays}</Text>
                  <Text style={s.detailStat}>Current Streak: {selectedMember.currentStreak}</Text>
                  <Text style={s.detailStat}>Longest Streak: {selectedMember.longestStreak}</Text>
                  <Text style={s.detailStat}>Total Focus: {selectedMember.totalFocusMinutes} min</Text>
                </View>

                <Text style={s.sectionTitle}>Attendance Calendar</Text>
                <View style={s.calendarGrid}>
                  {dateKeys.map((dateKey) => {
                    const record = attendanceByDate[dateKey]?.[selectedMember.uid];
                    const present = record?.present === true;
                    return (
                      <View
                        key={`${selectedMember.uid}-${dateKey}`}
                        style={[
                          s.calendarCell,
                          record ? present ? s.presentCell : s.absentCell : s.noRecordCell,
                        ]}
                      >
                        <Text style={s.calendarDate}>{formatDateKey(dateKey)}</Text>
                        <Text style={s.calendarStatus}>{record ? present ? "P" : "A" : "-"}</Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
    topCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 20,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.warning + "60",
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.warning,
    },
    topHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    topTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.textSecondary },
    topName: { fontSize: 22, fontWeight: "800", color: theme.colors.text, textAlign: "center" },
    topId: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2, marginBottom: 8 },
    topPercent: { fontSize: 17, fontWeight: "800", color: theme.colors.primary, marginTop: 4 },
    topDetail: { fontSize: 13, fontWeight: "600", color: theme.colors.textTertiary, marginTop: 2 },
    sectionTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.text, marginBottom: 12 },
    memberSection: { gap: 10 },
    memberCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
    },
    memberHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
    memberName: { flex: 1, fontSize: 16, fontWeight: "800", color: theme.colors.text },
    memberSecondaryId: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
    memberPercent: { fontSize: 17, fontWeight: "800", color: theme.colors.primary },
    statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    statText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      backgroundColor: theme.colors.background,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    emptyState: { alignItems: "center", paddingVertical: 72, gap: 12 },
    emptyText: { fontSize: 14, color: theme.colors.textTertiary, textAlign: "center" },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    modalCard: {
      maxHeight: "88%",
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      overflow: "hidden",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: theme.colors.text },
    closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    modalContent: { padding: 16, paddingBottom: 28 },
    detailStats: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      marginBottom: 18,
      gap: 8,
    },
    detailStat: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
    calendarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    calendarCell: {
      width: 78,
      minHeight: 58,
      borderRadius: 10,
      padding: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    presentCell: { backgroundColor: theme.colors.success + "35" },
    absentCell: { backgroundColor: theme.colors.danger + "30" },
    noRecordCell: { backgroundColor: theme.colors.border + "70" },
    calendarDate: { fontSize: 11, fontWeight: "800", color: theme.colors.textSecondary },
    calendarStatus: { fontSize: 18, fontWeight: "900", color: theme.colors.text, marginTop: 4 },
  });
