import React, { useState, useMemo, useCallback } from "react";
import type { FocusSession } from "@/types/session";
import type { Todo } from "@/types/todo";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/context/ThemeContext";
import { useCalendarData } from "@/hooks/useCalendarData";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useTodos } from "@/hooks/useTodos";
import { formatStudyTime, formatDuration } from "@/utils/timeFormat";
import { updateTodo } from "@/services/todos";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CalendarMode = "weekly" | "monthly";

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthLabel(year: number, month: number): string {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function isToday(dateString: string): boolean {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return dateString === `${y}-${m}-${d}`;
}

function getWeekStartDateString(date?: Date): string {
  const d = date || new Date();
  const dayOfWeek = d.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const day = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekDates(weekStart: string): string[] {
  const monday = new Date(weekStart + "T00:00:00");

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

export default function CalendarScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = createStyles(theme);

  const [mode, setMode] = useState<CalendarMode>("monthly");

  const {
    selectedDate,
    setSelectedDate,
    monthData,
    selectedDayData,
    selectedDaySessions,
    selectedDayCompletedTodos,
    sessions,
    loading,
  } = useCalendarData();
  const { profile: userProfile } = useUserProfile();
  const { todos: allTodos } = useTodos();
  const selectedDayPlannedTodos = useMemo(
    () => allTodos.filter((t) => t.plannedDate === selectedDate).slice(0, 10),
    [allTodos, selectedDate],
  );

  const weekDates = useMemo(() => getWeekDates(getWeekStartDateString(new Date(selectedDate + "T00:00:00"))), [selectedDate]);

  const weekData = useMemo(() => {
    const dailyGoalMinutes = userProfile?.dailyGoalMinutes ?? null;
    const dailyGoalSeconds = (dailyGoalMinutes ?? 0) * 60;

    const sessionMap = new Map<string, number>();
    for (const sess of sessions) {
      const ts = typeof (sess.startTime as any)?.toDate === "function"
        ? (sess.startTime as any).toDate()
        : new Date();
      const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}-${String(ts.getDate()).padStart(2, "0")}`;
      const dur = sess.durationSeconds ?? (sess.durationMinutes ?? 0) * 60;
      sessionMap.set(key, (sessionMap.get(key) ?? 0) + dur);
    }

    const todoCountMap = new Map<string, number>();
    for (const t of allTodos) {
      if (t.plannedDate) {
        todoCountMap.set(t.plannedDate, (todoCountMap.get(t.plannedDate) ?? 0) + 1);
      }
    }

    return weekDates.map((dateKey) => {
      const studySeconds = sessionMap.get(dateKey) ?? 0;
      const taskCount = todoCountMap.get(dateKey) ?? 0;
      const goalAchieved = dailyGoalMinutes !== null && dailyGoalMinutes > 0 && studySeconds >= dailyGoalSeconds;

      return {
        dateKey,
        dayName: WEEK_DAY_NAMES[new Date(dateKey + "T00:00:00").getDay() === 0 ? 6 : new Date(dateKey + "T00:00:00").getDay() - 1],
        taskCount,
        studySeconds,
        goalAchieved,
      };
    });
  }, [weekDates, sessions, allTodos, userProfile]);

  const calendarGrid = useMemo(() => {
    if (monthData.length === 0) return { grid: [] as (number | null)[][], label: "", dayMap: new Map() };

    const first = monthData[0];
    const year = first.year;
    const month = first.month - 1;
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const label = getMonthLabel(year, month);

    const dayMap = new Map<string, (typeof monthData)[0]>();
    for (const d of monthData) {
      dayMap.set(d.dateString, d);
    }

    const grid: (number | null)[][] = [];
    let week: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) {
      week.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, "0");
      const d = String(day).padStart(2, "0");
      const key = `${y}-${m}-${d}`;
      const dayData = dayMap.get(key);

      week.push(dayData ? dayData.day : day);

      if (week.length === 7) {
        grid.push(week);
        week = [];
      }
    }

    if (week.length > 0) {
      while (week.length < 7) {
        week.push(null);
      }
      grid.push(week);
    }

    return { grid, label, dayMap };
  }, [monthData]);

  const handlePrevMonth = () => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setMonth(d.getMonth() - 1);
    setSelectedDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
    );
  };

  const handleNextMonth = () => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setMonth(d.getMonth() + 1);
    setSelectedDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
    );
  };

  const handleWeekDayPress = (dateKey: string) => {
    setSelectedDate(dateKey);
  };

  // ------ Overdue Tasks ------
  const getTodayString = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const overdueTodos = useMemo(() => {
    const today = getTodayString();
    return allTodos.filter((t) => !t.completed && t.plannedDate && t.plannedDate < today);
  }, [allTodos]);

  // ------ Reschedule Handlers ------
  const [rescheduleMenuVisible, setRescheduleMenuVisible] = useState(false);
  const [rescheduleTargetId, setRescheduleTargetId] = useState<string | null>(null);

  const openRescheduleMenu = useCallback((todoId: string) => {
    setRescheduleTargetId(todoId);
    setRescheduleMenuVisible(true);
  }, []);

  const closeRescheduleMenu = useCallback(() => {
    setRescheduleMenuVisible(false);
    setRescheduleTargetId(null);
  }, []);

  const moveToTomorrow = useCallback(async () => {
    if (!rescheduleTargetId) return;
    const today = new Date();
    today.setDate(today.getDate() + 1);
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const tomorrow = `${y}-${m}-${d}`;
    try {
      await updateTodo(rescheduleTargetId, { plannedDate: tomorrow });
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not reschedule todo.");
    } finally {
      closeRescheduleMenu();
    }
  }, [rescheduleTargetId, closeRescheduleMenu]);

  const moveToNextWeek = useCallback(async () => {
    if (!rescheduleTargetId) return;
    const today = new Date();
    today.setDate(today.getDate() + 7);
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const nextWeek = `${y}-${m}-${d}`;
    try {
      await updateTodo(rescheduleTargetId, { plannedDate: nextWeek });
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not reschedule todo.");
    } finally {
      closeRescheduleMenu();
    }
  }, [rescheduleTargetId, closeRescheduleMenu]);

  const openDatePickerForReschedule = useCallback(() => {
    setRescheduleMenuVisible(false);
    // We reuse the existing date picker by navigating to TodoScreen with a special param
    if (rescheduleTargetId) {
      navigation.navigate("TodoScreen", {
        preselectedDate: selectedDate,
        rescheduleTodoId: rescheduleTargetId,
      });
      setRescheduleTargetId(null);
    }
  }, [rescheduleTargetId, selectedDate, navigation]);

  if (loading && monthData.length === 0) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Calendar</Text>
      </View>

      {/* Segmented Toggle */}
      <View style={s.segmentedControl}>
        <TouchableOpacity
          style={[s.segmentBtn, mode === "weekly" && s.segmentBtnActive]}
          onPress={() => setMode("weekly")}
          activeOpacity={0.7}
        >
          <Text style={[s.segmentBtnText, mode === "weekly" && s.segmentBtnTextActive]}>
            Weekly
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.segmentBtn, mode === "monthly" && s.segmentBtnActive]}
          onPress={() => setMode("monthly")}
          activeOpacity={0.7}
        >
          <Text style={[s.segmentBtnText, mode === "monthly" && s.segmentBtnTextActive]}>
            Monthly
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* WEEKLY MODE */}
        {mode === "weekly" && (
          <>
            {/* Horizontal Week Selector */}
            <View style={s.horizontalWeekSelector}>
              {weekData.map((day) => (
                <TouchableOpacity
                  key={day.dateKey}
                  style={[
                    s.horizontalDayBtn,
                    selectedDate === day.dateKey && s.horizontalDayBtnSelected,
                  ]}
                  onPress={() => handleWeekDayPress(day.dateKey)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      s.horizontalDayName,
                      selectedDate === day.dateKey && s.horizontalDayNameSelected,
                    ]}
                  >
                    {day.dayName}
                  </Text>
                  <Text
                    style={[
                      s.horizontalDayDate,
                      selectedDate === day.dateKey && s.horizontalDayDateSelected,
                    ]}
                  >
                    {day.dateKey.split("-")[2]}
                  </Text>
                  {day.goalAchieved && (
                    <Text style={s.horizontalDayBadge}>⭐</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Overdue Tasks Section */}
            {overdueTodos.length > 0 && (
              <View style={s.overdueSection}>
                <View style={s.overdueHeader}>
                  <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
                  <Text style={s.overdueTitle}>Overdue Tasks</Text>
                </View>
                {overdueTodos.map((todo) => (
                  <View key={todo.id} style={s.overdueRow}>
                    <View style={s.overdueInfo}>
                      <Text style={s.overdueTitle} numberOfLines={1}>
                        {todo.title}
                      </Text>
                      <Text style={s.overdueDate}>
                        {todo.plannedDate}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => openRescheduleMenu(todo.id)}
                      style={s.overdueRescheduleBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Planned Tasks Section */}
            <View style={s.detailSection}>
              <View style={s.detailSectionHeader}>
                <Ionicons name="checkbox-outline" size={18} color={theme.colors.primary} />
                <Text style={s.detailSectionTitle}>Planned Tasks</Text>
              </View>
              {selectedDayPlannedTodos.length === 0 ? (
                <Text style={s.detailEmptyText}>No planned tasks</Text>
              ) : (
                selectedDayPlannedTodos.map((todo) => (
                  <View key={todo.id} style={s.detailRow}>
                    <Text style={s.detailRowTitle} numberOfLines={1}>
                      {todo.title}
                    </Text>
                    <Ionicons
                      name={todo.completed ? "checkbox" : "square-outline"}
                      size={18}
                      color={todo.completed ? theme.colors.success : theme.colors.textTertiary}
                    />
                  </View>
                ))
              )}
            </View>

            {/* Completed Tasks Section */}
            <View style={selectedDayCompletedTodos.length === 0 ? s.detailSectionCompact : s.detailSection}>
              <View style={s.detailSectionHeader}>
                <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.success} />
                <Text style={s.detailSectionTitle}>Completed Tasks</Text>
              </View>
              {selectedDayCompletedTodos.length === 0 ? (
                <Text style={s.detailEmptyText}>No completed tasks</Text>
              ) : (
                selectedDayCompletedTodos.map((todo) => (
                  <View key={todo.id} style={s.detailRow}>
                    <Text style={s.detailRowTitle} numberOfLines={1}>
                      {todo.title}
                    </Text>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={theme.colors.success}
                    />
                  </View>
                ))
              )}
            </View>

            {/* Compact Study Summary */}
            {selectedDayData && (
              <View style={s.compactSummaryCard}>
                <View style={s.compactSummaryItem}>
                  <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
                  <Text style={s.compactSummaryValue}>
                    {formatStudyTime(selectedDayData.studyTimeSeconds)}
                  </Text>
                  <Text style={s.compactSummaryLabel}>Study Time</Text>
                </View>
                <View style={s.compactSummaryDivider} />
                <View style={s.compactSummaryItem}>
                  <Ionicons name="flame-outline" size={18} color={theme.colors.accent1} />
                  <Text style={s.compactSummaryValue}>{selectedDayData.sessionCount}</Text>
                  <Text style={s.compactSummaryLabel}>Sessions</Text>
                </View>
                <View style={s.compactSummaryDivider} />
                <View style={s.compactSummaryItem}>
                  <Ionicons
                    name={selectedDayData.hasAttendance ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={selectedDayData.hasAttendance ? theme.colors.accent5 : theme.colors.textTertiary}
                  />
                  <Text style={s.compactSummaryValue}>
                    {selectedDayData.hasAttendance ? "Present" : "—"}
                  </Text>
                  <Text style={s.compactSummaryLabel}>Attendance</Text>
                </View>
              </View>
            )}

            {/* Add Task Button */}
            <TouchableOpacity
              onPress={() => navigation.navigate("TodoScreen", { preselectedDate: selectedDate })}
              style={s.addTaskBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
              <Text style={s.addTaskBtnText}>Add Task</Text>
            </TouchableOpacity>

            {/* Session History (last section in Weekly Mode) */}
            {selectedDayData && selectedDaySessions.length > 0 && (
              <View style={s.detailSection}>
                <Text style={s.detailSectionTitle}>Session History</Text>
                {selectedDaySessions.slice(0, 5).map((session) => (
                  <View key={session.id} style={s.detailRow}>
                    <Text style={s.detailRowTitle} numberOfLines={1}>
                      {session.title}
                    </Text>
                    <Text style={s.detailRowValue}>
                      {formatDuration(session.durationSeconds ?? session.durationMinutes * 60)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* MONTHLY MODE */}
        {mode === "monthly" && (
          <>
            {/* Month Navigation */}
            <View style={s.monthNav}>
              <TouchableOpacity onPress={handlePrevMonth} activeOpacity={0.7} style={s.monthArrow}>
                <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={s.monthLabel}>{calendarGrid.label}</Text>
              <TouchableOpacity onPress={handleNextMonth} activeOpacity={0.7} style={s.monthArrow}>
                <Ionicons name="chevron-forward" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={s.weekdayRow}>
              {DAY_NAMES.map((name) => (
                <View key={name} style={s.weekdayCell}>
                  <Text style={s.weekdayText}>{name}</Text>
                </View>
              ))}
            </View>

            {/* Calendar Grid */}
            {calendarGrid.grid.map((week, wi) => (
              <View key={wi} style={s.calendarWeekRow}>
                {week.map((day, di) => {
                  if (day === null) {
                    return <View key={`blank-${di}`} style={s.dayCell} />;
                  }

                  const year = calendarGrid.label.split(" ")[1];
                  const monthNames = [
                    "January","February","March","April","May","June",
                    "July","August","September","October","November","December",
                  ];
                  const monthIndex = monthNames.indexOf(calendarGrid.label.split(" ")[0]);
                  const dayStr = String(day).padStart(2, "0");
                  const monthStr = String(monthIndex + 1).padStart(2, "0");
                  const fullDateKey = `${year}-${monthStr}-${dayStr}`;

                  const dayData = calendarGrid.dayMap.get(fullDateKey);
                  const isSelected = selectedDate === fullDateKey;
                  const today = isToday(fullDateKey);
                  const hasActivity =
                    dayData &&
                    (dayData.sessionCount > 0 ||
                      dayData.todosCompleted > 0 ||
                      dayData.hasAttendance);
                  const hasStudy = dayData && dayData.studyTimeSeconds > 0;

                  return (
                    <TouchableOpacity
                      key={fullDateKey}
                      style={[
                        s.dayCell,
                        isSelected && s.dayCellSelected,
                      ]}
                      onPress={() => setSelectedDate(fullDateKey)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          s.dayText,
                          today && s.dayTextToday,
                          isSelected && s.dayTextSelected,
                          !hasActivity && s.dayTextInactive,
                        ]}
                      >
                        {day}
                      </Text>
                      {(() => {
                        const dailyGoalMinutes = userProfile?.dailyGoalMinutes ?? null;
                        const dailyGoalSeconds = (dailyGoalMinutes ?? 0) * 60;
                        const studySeconds = dayData?.studyTimeSeconds ?? 0;

                        if (studySeconds === 0) {
                          return <Text style={s.dayIndicator}>🔴</Text>;
                        }
                        if (dailyGoalMinutes && studySeconds >= dailyGoalSeconds) {
                          return <Text style={s.dayIndicator}>⭐</Text>;
                        }
                        return <Text style={s.dayIndicator}>🟢</Text>;
                      })()}
                      {dayData?.hasAttendance && (
                        <View style={[s.dayDot, { backgroundColor: theme.colors.success }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* Selected Day Summary Card (Monthly mode keeps original) */}
            {selectedDayData ? (
              <View style={s.summaryCard}>
                <Text style={s.summaryDate}>
                  {new Date(selectedDayData.dateString + "T00:00:00").toLocaleDateString(
                    "en-US",
                    { weekday: "long", month: "long", day: "numeric", year: "numeric" }
                  )}
                </Text>
                <View style={s.summaryGrid}>
                  {/* Study Time */}
                  <View style={s.summaryItem}>
                    <View style={[s.summaryIcon, { backgroundColor: theme.colors.primary + "18" }]}>
                      <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
                    </View>
                    <Text style={s.summaryValue}>
                      {formatStudyTime(selectedDayData.studyTimeSeconds)}
                    </Text>
                    <Text style={s.summaryLabel}>Study Time</Text>
                  </View>

                  {/* Sessions */}
                  <View style={s.summaryItem}>
                    <View style={[s.summaryIcon, { backgroundColor: theme.colors.accent1 + "18" }]}>
                      <Ionicons name="flame-outline" size={20} color={theme.colors.accent1} />
                    </View>
                    <Text style={s.summaryValue}>{selectedDayData.sessionCount}</Text>
                    <Text style={s.summaryLabel}>Sessions</Text>
                  </View>

                  {/* Todos Completed */}
                  <View style={s.summaryItem}>
                    <View style={[s.summaryIcon, { backgroundColor: theme.colors.success + "18" }]}>
                      <Ionicons name="checkbox-outline" size={20} color={theme.colors.success} />
                    </View>
                    <Text style={s.summaryValue}>{selectedDayData.todosCompleted}</Text>
                    <Text style={s.summaryLabel}>Todos Completed</Text>
                  </View>

                  {/* Attendance */}
                  <View style={s.summaryItem}>
                    <View style={[s.summaryIcon, { backgroundColor: theme.colors.accent5 + "18" }]}>
                      <Ionicons
                        name={selectedDayData.hasAttendance ? "checkmark-circle" : "ellipse-outline"}
                        size={20}
                        color={selectedDayData.hasAttendance ? theme.colors.accent5 : theme.colors.textTertiary}
                      />
                    </View>
                    <Text style={s.summaryValue}>
                      {selectedDayData.hasAttendance ? "Present" : "—"}
                    </Text>
                    <Text style={s.summaryLabel}>Attendance</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={s.noDataCard}>
                <Ionicons name="calendar-outline" size={32} color={theme.colors.textTertiary} />
                <Text style={s.noDataText}>No data for this day</Text>
              </View>
            )}

            {/* Sessions Section (Monthly mode keeps original) */}
            {selectedDayData && (
              <View style={s.detailSection}>
                <Text style={s.detailSectionTitle}>Sessions</Text>
                {selectedDaySessions.length === 0 ? (
                  <Text style={s.detailEmptyText}>No sessions</Text>
                ) : (
                  selectedDaySessions.slice(0, 5).map((session) => (
                    <View key={session.id} style={s.detailRow}>
                      <Text style={s.detailRowTitle} numberOfLines={1}>
                        {session.title}
                      </Text>
                      <Text style={s.detailRowValue}>
                        {formatDuration(session.durationSeconds ?? session.durationMinutes * 60)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Completed Todos Section (Monthly mode keeps original) */}
            {selectedDayData && (
              <View style={s.detailSection}>
                <Text style={s.detailSectionTitle}>Completed Todos</Text>
                {selectedDayCompletedTodos.length === 0 ? (
                  <Text style={s.detailEmptyText}>No completed todos</Text>
                ) : (
                  selectedDayCompletedTodos.slice(0, 5).map((todo) => (
                    <View key={todo.id} style={s.detailRow}>
                      <Text style={s.detailRowTitle} numberOfLines={1}>
                        {todo.title}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Planned Tasks Section (Monthly mode keeps original) */}
            {selectedDayData && (
              <View style={s.detailSection}>
                <Text style={s.detailSectionTitle}>Planned Tasks</Text>
                {selectedDayPlannedTodos.length === 0 ? (
                  <Text style={s.detailEmptyText}>No planned tasks</Text>
                ) : (
                  selectedDayPlannedTodos.map((todo) => (
                    <View key={todo.id} style={s.detailRow}>
                      <Text style={s.detailRowTitle} numberOfLines={1}>
                        {todo.title}
                      </Text>
                      <Ionicons
                        name={todo.completed ? "checkbox" : "square-outline"}
                        size={18}
                        color={todo.completed ? theme.colors.success : theme.colors.textTertiary}
                      />
                    </View>
                  ))
                )}
                <TouchableOpacity
                  onPress={() => navigation.navigate("TodoScreen", { preselectedDate: selectedDate })}
                  style={s.addTaskBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
                  <Text style={s.addTaskBtnText}>Add Task</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Reschedule Menu Modal */}
      <Modal
        visible={rescheduleMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeRescheduleMenu}
      >
        <TouchableOpacity
          style={s.rescheduleOverlay}
          activeOpacity={1}
          onPress={closeRescheduleMenu}
        >
          <View style={s.rescheduleMenu}>
            <Text style={s.rescheduleTitle}>Reschedule Task</Text>
            <TouchableOpacity
              onPress={moveToTomorrow}
              style={s.rescheduleOption}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
              <Text style={s.rescheduleOptionText}>Move to Tomorrow</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={moveToNextWeek}
              style={s.rescheduleOption}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
              <Text style={s.rescheduleOptionText}>Move to Next Week</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openDatePickerForReschedule}
              style={s.rescheduleOption}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar" size={20} color={theme.colors.primary} />
              <Text style={s.rescheduleOptionText}>Pick Date</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={closeRescheduleMenu}
              style={s.rescheduleCancelBtn}
              activeOpacity={0.7}
            >
              <Text style={s.rescheduleCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: theme.colors.text,
    },
    scroll: {
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    segmentedControl: {
      flexDirection: "row",
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 4,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentBtnActive: {
      backgroundColor: theme.colors.primary,
    },
    segmentBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
    segmentBtnTextActive: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
    // Horizontal Week Selector (Weekly mode)
    horizontalWeekSelector: {
      flexDirection: "row",
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 8,
      marginBottom: 16,
      justifyContent: "space-between",
    },
    horizontalDayBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: 12,
      marginHorizontal: 2,
    },
    horizontalDayBtnSelected: {
      backgroundColor: theme.colors.primary + "20",
    },
    horizontalDayName: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.3,
      marginBottom: 4,
    },
    horizontalDayNameSelected: {
      color: theme.colors.primary,
      fontWeight: "700",
    },
    horizontalDayDate: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 2,
    },
    horizontalDayDateSelected: {
      color: theme.colors.primary,
    },
    horizontalDayBadge: {
      fontSize: 10,
      marginTop: 2,
    },
    // Selected Day Header (Weekly mode)
    selectedDayHeader: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    // Compact Study Summary (Weekly mode)
    compactSummaryCard: {
      flexDirection: "row",
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      marginTop: 16,
      alignItems: "center",
      justifyContent: "space-around",
    },
    compactSummaryItem: {
      flex: 1,
      alignItems: "center",
      gap: 4,
    },
    compactSummaryValue: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.colors.text,
    },
    compactSummaryLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.textTertiary,
      textAlign: "center",
    },
    compactSummaryDivider: {
      width: 1,
      height: 32,
      backgroundColor: theme.colors.border,
      marginHorizontal: 8,
    },
    // Original styles kept for Monthly mode and shared components
    weekSection: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      marginBottom: 16,
    },
    weekTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 12,
    },
    weekRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 10,
      marginBottom: 4,
    },
    weekRowSelected: {
      backgroundColor: theme.colors.primary + "18",
    },
    weekDayName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      width: 44,
    },
    weekDayNameSelected: {
      color: theme.colors.primary,
      fontWeight: "700",
    },
    weekStats: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    weekTaskCount: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.colors.textSecondary,
    },
    weekStudyTime: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.text,
    },
    weekGoalBadge: {
      color: theme.colors.success,
    },
    monthNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    monthArrow: {
      padding: 8,
    },
    monthLabel: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    weekdayRow: {
      flexDirection: "row",
      marginBottom: 4,
    },
    weekdayCell: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 6,
    },
    weekdayText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textTertiary,
      textTransform: "uppercase",
    },
    calendarWeekRow: {
      flexDirection: "row",
    },
    dayCell: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      borderRadius: 12,
      margin: 1,
      minHeight: 44,
    },
    dayCellSelected: {
      backgroundColor: theme.colors.primary + "20",
    },
    dayText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    dayTextToday: {
      color: theme.colors.primary,
      fontWeight: "800",
    },
    dayTextSelected: {
      color: theme.colors.primary,
      fontWeight: "800",
    },
    dayTextInactive: {
      color: theme.colors.textTertiary,
    },
    dayDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      marginTop: 2,
    },
    dayIndicator: {
      fontSize: 10,
      lineHeight: 12,
      marginTop: 1,
    },
    summaryCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 20,
      marginTop: 16,
    },
    summaryDate: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 16,
    },
    summaryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    summaryItem: {
      width: "46%",
      backgroundColor: theme.colors.background,
      borderRadius: 14,
      padding: 14,
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    summaryIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    summaryValue: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.text,
    },
    summaryLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.textTertiary,
      textAlign: "center",
    },
    noDataCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 40,
      alignItems: "center",
      gap: 8,
      marginTop: 16,
    },
    noDataText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textTertiary,
    },
    detailSection: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 20,
      marginTop: 16,
    },
    detailSectionCompact: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginTop: 16,
    },
    detailSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    detailSectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    detailEmptyText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.textTertiary,
      textAlign: "center",
      paddingVertical: 8,
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    detailRowTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      flex: 1,
      marginRight: 8,
    },
    detailRowValue: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.textSecondary,
    },
    addTaskBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    addTaskBtnText: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    // Overdue Tasks
    overdueSection: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      marginTop: 16,
    },
    overdueHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    overdueTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.error,
    },
    overdueRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    overdueInfo: {
      flex: 1,
      marginRight: 8,
    },
    overdueDate: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.colors.textTertiary,
      marginTop: 2,
    },
    overdueRescheduleBtn: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    // Reschedule Modal
    rescheduleOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    rescheduleMenu: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 20,
      width: "100%",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    rescheduleTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 16,
      textAlign: "center",
    },
    rescheduleOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 8,
    },
    rescheduleOptionText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    rescheduleCancelBtn: {
      marginTop: 8,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    rescheduleCancelText: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      textAlign: "center",
    },
  });
}
