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

type AttendanceRecord = {
  present: boolean;
  displayName: string;
  focusMinutes: number;
  sessionCount: number;
};

type AttendanceByDate = Record<string, Record<string, AttendanceRecord>>;
type CalendarCell = { dateKey: string; day: number; isBlank: false } | { dateKey: ""; day: 0; isBlank: true };

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthTitle(monthDate: Date): string {
  return monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function getMonthDays(monthDate: Date): string[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dateKeys: string[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    dateKeys.push(toDateKey(new Date(year, month, day)));
  }

  return dateKeys;
}

export function buildCalendarCells(monthDate: Date, dateKeys: string[]): CalendarCell[] {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
  const blanks: CalendarCell[] = Array.from({ length: firstDay }, () => ({ dateKey: "", day: 0, isBlank: true }));
  const days: CalendarCell[] = dateKeys.map((dateKey) => ({
    dateKey,
    day: Number(dateKey.split("-")[2] || 0),
    isBlank: false,
  }));

  return [...blanks, ...days];
}

function getMemberName(member?: GroupMember | null): string {
  return member?.displayName || member?.name || "Select member";
}

function getDateDisplay(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function GroupMonthlyAttendanceScreen({ route, navigation }: any) {
  const groupId = typeof route?.params?.groupId === "string" ? route.params.groupId : "";
  const { theme } = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { members, loading: membersLoading, error: membersError } = useGroupMembers(groupId);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedUid, setSelectedUid] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()));
  const [attendanceByDate, setAttendanceByDate] = useState<AttendanceByDate>({});
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  const dateKeys = useMemo(() => getMonthDays(visibleMonth), [visibleMonth]);
  const calendarCells = useMemo(() => buildCalendarCells(visibleMonth, dateKeys), [dateKeys, visibleMonth]);
  const selectedMember = useMemo(
    () => members.find((member) => member.uid === selectedUid) || members[0] || null,
    [members, selectedUid]
  );
  const selectedRecord = selectedDateKey && selectedMember
    ? attendanceByDate[selectedDateKey]?.[selectedMember.uid]
    : undefined;
  const hasAttendanceData = useMemo(
    () => dateKeys.some((dateKey) => Object.keys(attendanceByDate[dateKey] || {}).length > 0),
    [attendanceByDate, dateKeys]
  );

  const safeGoBack = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.("GroupDetail", { groupId });
  }, [navigation, groupId]);

  useEffect(() => {
    if (!selectedUid && members.length > 0) {
      setSelectedUid(members[0].uid);
    }
  }, [members, selectedUid]);

  useEffect(() => {
    if (!dateKeys.includes(selectedDateKey)) {
      setSelectedDateKey(dateKeys[0] || "");
    }
  }, [dateKeys, selectedDateKey]);

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

    const loadMonthlyAttendance = async () => {
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
                sessionCount: Number(data?.sessionCount ?? data?.sessionsCount ?? data?.sessions ?? 0),
              };
            });

            return [dateKey, memberAttendance] as const;
          })
        );

        if (!mounted) return;
        setAttendanceByDate(Object.fromEntries(attendanceEntries));
      } catch (err: any) {
        if (!mounted) return;
        console.error("[GroupMonthlyAttendance] Failed to load monthly attendance:", err?.message);
        setAttendanceError("Unable to load monthly attendance data");
      } finally {
        if (mounted) setAttendanceLoading(false);
      }
    };

    loadMonthlyAttendance();

    return () => {
      mounted = false;
    };
  }, [dateKeys, groupId]);

  const goToPreviousMonth = useCallback(() => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }, []);

  const loading = membersLoading || attendanceLoading;
  const error = attendanceError || membersError;

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={safeGoBack} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Monthly Report</Text>
          <View style={{ width: 44 }} />
        </View>
        <LoadingState message="Loading monthly calendar..." />
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
          <Text style={s.headerTitle}>Monthly Report</Text>
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
        <Text style={s.headerTitle} numberOfLines={1}>Monthly Report</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        <View style={s.selectorSection}>
          <TouchableOpacity
            style={s.selectorButton}
            activeOpacity={0.75}
            onPress={() => setSelectorOpen((open) => !open)}
          >
            <View style={s.selectorLabelWrap}>
              <Text style={s.selectorLabel}>Member</Text>
              <Text style={s.selectorValue} numberOfLines={1}>{getMemberName(selectedMember)}</Text>
              {selectedMember && <Text style={s.selectorSecondaryId}>{getSecondaryIdentifier(selectedMember.uid, selectedMember.email, selectedMember.name)}</Text>}
            </View>
            <Ionicons
              name={selectorOpen ? "chevron-up" : "chevron-down"}
              size={20}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>

          {selectorOpen && (
            <View style={s.memberMenu}>
              {members.map((member) => {
                const selected = member.uid === selectedMember?.uid;
                return (
                  <TouchableOpacity
                    key={member.uid}
                    style={[s.memberOption, selected && s.memberOptionSelected]}
                    activeOpacity={0.75}
                    onPress={() => {
                      setSelectedUid(member.uid);
                      setSelectorOpen(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.memberOptionText, selected && s.memberOptionTextSelected]} numberOfLines={1}>
                        {getMemberName(member)}
                      </Text>
                      <Text style={[s.memberOptionSecondaryId, selected && s.memberOptionSecondaryIdSelected]}>
                        {getSecondaryIdentifier(member.uid, member.email, member.name)}
                      </Text>
                    </View>
                    {selected && <Ionicons name="checkmark" size={18} color={theme.colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={s.monthNav}>
          <TouchableOpacity style={s.monthButton} activeOpacity={0.75} onPress={goToPreviousMonth}>
            <Ionicons name="chevron-back" size={18} color={theme.colors.primary} />
            <Text style={s.monthButtonText}>Previous</Text>
          </TouchableOpacity>
          <Text style={s.monthTitle}>{getMonthTitle(visibleMonth)}</Text>
          <TouchableOpacity style={s.monthButton} activeOpacity={0.75} onPress={goToNextMonth}>
            <Text style={s.monthButtonText}>Next</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {!hasAttendanceData ? (
          <View style={s.emptyState}>
            <Ionicons name="calendar-outline" size={52} color={theme.colors.textTertiary} />
            <Text style={s.emptyText}>No monthly attendance data available yet</Text>
          </View>
        ) : (
          <>
            <View style={s.calendarCard}>
              <View style={s.weekdayRow}>
                {WEEKDAY_LABELS.map((label) => (
                  <Text key={label} style={s.weekdayText}>{label}</Text>
                ))}
              </View>
              <View style={s.calendarGrid}>
                {calendarCells.map((cell, idx) => {
                  if (cell.isBlank) {
                    return <View key={`blank-${idx}`} style={s.calendarCell} />;
                  }

                  const record = selectedMember ? attendanceByDate[cell.dateKey]?.[selectedMember.uid] : undefined;
                  const selected = cell.dateKey === selectedDateKey;
                  const statusStyle = record
                    ? record.present ? s.presentCell : s.absentCell
                    : s.noRecordCell;

                  return (
                    <TouchableOpacity
                      key={cell.dateKey}
                      style={[s.calendarCell, statusStyle, selected && s.selectedCell]}
                      activeOpacity={0.75}
                      onPress={() => setSelectedDateKey(cell.dateKey)}
                    >
                      <Text style={[s.calendarDay, selected && s.selectedCellText]}>{cell.day}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={s.legendRow}>
              <View style={s.legendItem}><View style={[s.legendDot, s.presentDot]} /><Text style={s.legendText}>Present</Text></View>
              <View style={s.legendItem}><View style={[s.legendDot, s.absentDot]} /><Text style={s.legendText}>Absent</Text></View>
              <View style={s.legendItem}><View style={[s.legendDot, s.noRecordDot]} /><Text style={s.legendText}>No record</Text></View>
              <View style={s.legendItem}><View style={[s.legendDot, s.selectedDot]} /><Text style={s.legendText}>Selected</Text></View>
            </View>

            <View style={s.detailCard}>
              <Text style={s.detailTitle}>Attendance Details</Text>
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Date</Text>
                <Text style={s.detailValue}>{selectedDateKey ? getDateDisplay(selectedDateKey) : "No date selected"}</Text>
              </View>
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Present/Absent</Text>
                <Text style={s.detailValue}>
                  {selectedRecord ? selectedRecord.present ? "Present" : "Absent" : "No record"}
                </Text>
              </View>
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Focus Minutes</Text>
                <Text style={s.detailValue}>{selectedRecord?.focusMinutes ?? 0}</Text>
              </View>
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Session Count</Text>
                <Text style={s.detailValue}>{selectedRecord?.sessionCount ?? 0}</Text>
              </View>
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Attendance Status</Text>
                <Text style={[
                  s.detailValue,
                  selectedRecord?.present ? s.presentText : selectedRecord ? s.absentText : s.noRecordText,
                ]}>
                  {selectedRecord ? selectedRecord.present ? "Present" : "Absent" : "No record"}
                </Text>
              </View>
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
    selectorSection: { marginBottom: 14 },
    selectorButton: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    selectorLabelWrap: { flex: 1 },
    selectorLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.textTertiary,
      marginBottom: 3,
    },
    selectorValue: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    selectorSecondaryId: {
      fontSize: 12,
      color: theme.colors.textTertiary,
      marginTop: 2,
    },
    memberMenu: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: 8,
      overflow: "hidden",
    },
    memberOption: {
      minHeight: 46,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: 10,
    },
    memberOptionSelected: { backgroundColor: theme.colors.primary + "12" },
    memberOptionText: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    memberOptionTextSelected: { color: theme.colors.primary },
    memberOptionSecondaryId: {
      fontSize: 11,
      color: theme.colors.textTertiary,
      marginTop: 1,
    },
    memberOptionSecondaryIdSelected: { color: theme.colors.primary },
    monthNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
      gap: 10,
    },
    monthButton: {
      minHeight: 40,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    monthButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    monthTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: "800",
      color: theme.colors.text,
      textAlign: "center",
    },
    calendarCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      marginBottom: 12,
    },
    weekdayRow: {
      flexDirection: "row",
      marginBottom: 8,
    },
    weekdayText: {
      flex: 1,
      textAlign: "center",
      fontSize: 11,
      fontWeight: "800",
      color: theme.colors.textSecondary,
    },
    calendarGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    calendarCell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: theme.colors.card,
    },
    calendarDay: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.colors.text,
    },
    presentCell: { backgroundColor: theme.colors.success + "35" },
    absentCell: { backgroundColor: theme.colors.danger + "30" },
    noRecordCell: { backgroundColor: theme.colors.border + "70" },
    selectedCell: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    selectedCellText: { color: "#fff" },
    legendRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 14,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    presentDot: { backgroundColor: theme.colors.success },
    absentDot: { backgroundColor: theme.colors.danger },
    noRecordDot: { backgroundColor: theme.colors.textTertiary },
    selectedDot: { backgroundColor: theme.colors.primary },
    legendText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
    detailCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.primary + "50",
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
      padding: 16,
    },
    detailTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.colors.text,
      marginBottom: 12,
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    detailLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.textSecondary,
    },
    detailValue: {
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.text,
      textAlign: "right",
    },
    presentText: { color: theme.colors.success },
    absentText: { color: theme.colors.danger },
    noRecordText: { color: theme.colors.textTertiary },
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
