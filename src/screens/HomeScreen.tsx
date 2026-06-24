import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/context/ThemeContext";
import { auth, firestore } from "@/firebase";
import { getTodayMinutes, getRecentSessions } from "@/services/sessions";
import { FocusSession, CATEGORIES } from "@/types/session";
import { useTodos } from "@/hooks/useTodos";
import { toggleTodo } from "@/services/todos";
import { Todo } from "@/types/todo";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useStudyStreak } from "@/hooks/useStudyStreak";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatStudyTime } from "@/utils/timeFormat";

const WELCOME_BANNER_KEY = "WELCOME_BANNER_PENDING";

function sessionDateLabel(session: FocusSession) {
  const ts = typeof (session.startTime as any)?.toDate === "function"
    ? (session.startTime as any).toDate()
    : new Date();
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - ts.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return ts.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function HomeScreen({ navigation }: any) {
  const { theme } = useTheme();
  const user = auth().currentUser;
  const s = createStyles(theme);

  const [todaySeconds, setTodaySeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [recentSessions, setRecentSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { todos: allTodos } = useTodos();
  const todayTodos = useMemo(() => allTodos.filter((t) => !t.completed).slice(0, 3), [allTodos]);
  const { profile: userProfile } = useUserProfile();
  const { currentStreak, bestStreak } = useStudyStreak();

  // Today's date string in YYYY-MM-DD format
  const getTodayString = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  const todayString = getTodayString();

  // Today's Progress calculations
  const todayProgress = useMemo(() => {
    const plannedToday = allTodos.filter((t) => t.plannedDate === todayString);
    const plannedCount = plannedToday.length;
    const completedCount = plannedToday.filter((t) => t.completed).length;
    const remainingCount = plannedCount - completedCount;
    const completionPercentage = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;

    return {
      plannedCount,
      completedCount,
      remainingCount,
      completionPercentage,
      hasTasks: plannedCount > 0,
    };
  }, [allTodos, todayString]);

  const load = useCallback(async () => {
    if (!user) {
      setError("Sign in to load your focus dashboard.");
      return;
    }
    try {
      setError(null);
      const [today, sessions, userSnap] = await Promise.all([
        getTodayMinutes(user.uid),
        getRecentSessions(user.uid, 5),
        firestore().collection("users").doc(user.uid).get(),
      ]);
            setTodaySeconds((today ?? 0) * 60);
      setRecentSessions(sessions);
      if (userSnap.exists()) {
        const d = userSnap.data();
        const mins = d?.totalFocusMinutes ?? 0;
        const secs = d?.totalFocusSeconds ?? (mins * 60);
        setTotalSeconds(secs);
      }
    } catch (err: any) {
      setError(err?.message ?? "Could not refresh your focus data.");
    }
  }, [user]);

  useEffect(() => {
    AsyncStorage.getItem(WELCOME_BANNER_KEY).then((name) => {
      if (name) { setWelcomeName(name); AsyncStorage.removeItem(WELCOME_BANNER_KEY); }
    });
    load().finally(() => setLoading(false));
  }, [load]);

  const handleToggle = useCallback((id: string, completed: boolean) => {
    toggleTodo(id, completed).catch((err: any) => {
      console.error("Could not toggle todo:", err?.message);
    });
  }, []);

  const handleStartFocus = useCallback((todo: Todo) => {
    navigation.navigate("TodoScreen", {});
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}><ActivityIndicator color={theme.colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* Greeting */}
        <View style={s.topRow}>
          <View>
            <Text style={s.greeting}>{welcomeName ? `Welcome, ${welcomeName}` : "Good focus"}</Text>
            <Text style={s.date}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate("Profile")} activeOpacity={0.8} style={s.avatarBtn}>
            <Ionicons name="person-circle-outline" size={36} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Today's focus — big hero stat */}
        {error ? <Text style={s.errorText}>{error}</Text> : null}
        <TouchableOpacity onPress={() => navigation.navigate("Timer")} style={s.heroCard} activeOpacity={0.9}>
          <View style={s.heroInner}>
            <Text style={s.heroTime}>{formatStudyTime(todaySeconds)}</Text>
            <Text style={s.heroLabel}>Today</Text>
          </View>
          <View style={s.heroRight}>
            <View style={[s.startBadge, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={s.startBadgeText}>Focus</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Daily Goal Progress Card */}
        {(() => {
          const dailyGoalMinutes = userProfile?.dailyGoalMinutes ?? null;
          const dailyGoalSeconds = (dailyGoalMinutes ?? 0) * 60;
          const progressFraction = dailyGoalSeconds > 0
            ? Math.min(todaySeconds / dailyGoalSeconds, 1)
            : 0;
          const percentage = Math.round(progressFraction * 100);
          const goalAchieved = dailyGoalMinutes !== null && dailyGoalMinutes > 0 && percentage >= 100;

          if (dailyGoalMinutes === null || dailyGoalMinutes === 0) {
            return (
              <View style={s.goalCard}>
                <Text style={s.goalTitle}>Daily Goal</Text>
                <Text style={s.goalPlaceholder}>Set your daily goal from Profile</Text>
              </View>
            );
          }

          return (
            <View style={s.goalCard}>
              <View style={s.goalTopRow}>
                <Text style={s.goalTitle}>Daily Goal</Text>
                {goalAchieved && <Text style={s.goalAchieved}>⭐ Goal Achieved</Text>}
              </View>
              <Text style={s.goalProgressText}>
                {formatStudyTime(todaySeconds)} / {formatStudyTime(dailyGoalSeconds)}
              </Text>
              <View style={s.goalProgressBarBg}>
                <View
                  style={[
                    s.goalProgressBarFill,
                    {
                      width: `${percentage}%`,
                      backgroundColor: goalAchieved ? theme.colors.success : theme.colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={s.goalPercentage}>{percentage}%</Text>
            </View>
          );
        })()}

        {/* Study Streak Card */}
        <View style={s.streakCard}>
          <View style={s.streakHeader}>
            <Text style={s.streakTitle}>🔥 Current Streak</Text>
          </View>
          <View style={s.streakValues}>
            <View style={s.streakValueItem}>
              <Text style={s.streakValue}>{currentStreak} Days</Text>
            </View>
            <View style={s.streakDivider} />
            <View style={s.streakValueItem}>
              <Text style={s.streakLabel}>Best</Text>
              <Text style={s.streakValue}>{bestStreak} Days</Text>
            </View>
          </View>
        </View>

        {/* Mini stats */}
        <View style={s.miniRow}>
          <View style={s.miniCard}>
            <Ionicons name="time-outline" size={22} color={theme.colors.accent5} />
            <Text style={s.miniValue}>{formatStudyTime(totalSeconds)}</Text>
            <Text style={s.miniLabel}>Total</Text>
          </View>
          <TouchableOpacity style={s.miniCard} onPress={() => navigation.navigate("Leaderboard")} activeOpacity={0.8}>
            <Ionicons name="trophy-outline" size={22} color={"#FFD700"} />
            <Text style={s.miniValue}>Top 10</Text>
            <Text style={s.miniLabel}>Board</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.miniCard} onPress={() => navigation.navigate("Stats")} activeOpacity={0.8}>
            <Ionicons name="bar-chart-outline" size={22} color={theme.colors.accent1} />
            <Text style={s.miniValue}>Stats</Text>
            <Text style={s.miniLabel}>Weekly</Text>
          </TouchableOpacity>
        </View>

        {/* Quick-start categories */}
        <Text style={s.sectionTitle}>Quick Start</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.categoryScroll} contentContainerStyle={{ gap: 10, paddingRight: 20 }}>
          {CATEGORIES.slice(0, 6).map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[s.categoryChip, { borderColor: cat.color + "44" }]}
              onPress={() => navigation.navigate("Timer", { categoryId: cat.id })}
              activeOpacity={0.8}
            >
              <Ionicons name={cat.icon as any} size={20} color={cat.color} />
              <Text style={[s.categoryLabel, { color: cat.color }]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Today's Planner */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Today's Planner</Text>
          <TouchableOpacity onPress={() => navigation.navigate("TodoScreen")} activeOpacity={0.8}>
            <Text style={s.seeAll}>See All →</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Progress Card */}
        {todayProgress.hasTasks ? (
          <View style={s.todayProgressCard}>
            <View style={s.todayProgressHeader}>
              <Text style={s.todayProgressTitle}>Today's Progress</Text>
              <Text style={s.todayProgressPercentage}>{todayProgress.completionPercentage}%</Text>
            </View>

            {/* Stats Row */}
            <View style={s.todayProgressStatsRow}>
              <View style={s.todayProgressStatItem}>
                <Text style={s.todayProgressStatValue}>{todayProgress.plannedCount}</Text>
                <Text style={s.todayProgressStatLabel}>Planned</Text>
              </View>
              <View style={s.todayProgressStatDivider} />
              <View style={s.todayProgressStatItem}>
                <Text style={[s.todayProgressStatValue, { color: theme.colors.success }]}>{todayProgress.completedCount}</Text>
                <Text style={s.todayProgressStatLabel}>Completed</Text>
              </View>
              <View style={s.todayProgressStatDivider} />
              <View style={s.todayProgressStatItem}>
                <Text style={[s.todayProgressStatValue, { color: theme.colors.accent1 }]}>{todayProgress.remainingCount}</Text>
                <Text style={s.todayProgressStatLabel}>Remaining</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={s.todayProgressBarBg}>
              <View
                style={[
                  s.todayProgressBarFill,
                  {
                    width: `${todayProgress.completionPercentage}%`,
                    backgroundColor: todayProgress.completionPercentage >= 100 ? theme.colors.success : theme.colors.primary,
                  },
                ]}
              />
            </View>
          </View>
        ) : (
          <View style={s.todayProgressEmpty}>
            <Ionicons name="calendar-outline" size={36} color={theme.colors.textTertiary} />
            <Text style={s.todayProgressEmptyTitle}>No tasks planned for today</Text>
            <Text style={s.todayProgressEmptySub}>Tap + in Todos to create your first task</Text>
          </View>
        )}

        {/* Todo Cards */}
        {todayTodos.length > 0 ? (
          todayTodos.map((todo) => {
            const cat = CATEGORIES.find((c) => c.id === todo.subjectId);
            const todoPlannedSecs = (todo.plannedDurationMinutes || 0) * 60;
            const todoProgress = todoPlannedSecs > 0
              ? Math.min((todo.actualFocusSeconds || 0) / todoPlannedSecs, 1)
              : 0;
            return (
              <View key={todo.id} style={s.todoCard}>
                {/* Row 1: Checkbox + Title + Focus button */}
                <View style={s.todoCardRow1}>
                  <TouchableOpacity
                    onPress={() => handleToggle(todo.id, !todo.completed)}
                    activeOpacity={0.7}
                    style={s.checkboxTouch}
                  >
                    <Ionicons
                      name={todo.completed ? "checkbox" : "square-outline"}
                      size={20}
                      color={todo.completed ? theme.colors.primary : theme.colors.textTertiary}
                    />
                  </TouchableOpacity>
                  <View style={s.todoCardTitleArea}>
                    <Text style={s.todoTitle} numberOfLines={1}>{todo.title}</Text>
                    <Text style={s.todoCardMeta}>
                      {cat ? cat.label : "General"}{" "}
                      {todo.plannedDurationMinutes > 0 && `• ${todo.plannedDurationMinutes}m`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleStartFocus(todo)}
                    style={[s.focusPill, { backgroundColor: theme.colors.primary }]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="play" size={12} color="#fff" />
                    <Text style={s.focusPillText}>Focus</Text>
                  </TouchableOpacity>
                </View>
                {/* Progress bar */}
                {todoPlannedSecs > 0 && (
                  <View style={s.todoProgressBarBg}>
                    <View
                      style={[
                        s.todoProgressBarFill,
                        {
                          width: `${Math.round(todoProgress * 100)}%`,
                          backgroundColor: todoProgress >= 1 ? theme.colors.success : theme.colors.primary,
                        },
                      ]}
                    />
                  </View>
                )}
                {/* Row 2: Time stats */}
                <View style={s.todoCardRow2}>
                  <Ionicons name="timer-outline" size={12} color={theme.colors.textTertiary} />
                  <Text style={s.todoCardTimeText}>
                    {formatStudyTime(todo.actualFocusSeconds || 0)} / {formatStudyTime(todoPlannedSecs)}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={s.emptyTodos}>
            <Ionicons name="document-text-outline" size={32} color={theme.colors.textTertiary} />
            <Text style={s.emptyTodosTitle}>No tasks planned today</Text>
            <Text style={s.emptyTodosSub}>Create your first task from Todos</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    errorText: { color: theme.colors.error, fontSize: 13, fontWeight: "600", marginBottom: 12 },
    scroll: { paddingHorizontal: 16, paddingTop: 16 },
    topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
    greeting: { fontSize: 22, fontWeight: "800", color: theme.colors.text },
    date: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
    avatarBtn: { padding: 4 },
    heroCard: { backgroundColor: theme.colors.surface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: theme.colors.border, flexDirection: "row", alignItems: "center", marginBottom: 14 },
    heroInner: { flex: 1 },
    heroTime: { fontSize: 52, fontWeight: "900", color: theme.colors.primary, letterSpacing: -2 },
    heroLabel: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: "600", marginTop: -4 },
    heroRight: { paddingLeft: 12 },
    startBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
    startBadgeText: { fontSize: 14, fontWeight: "700", color: "#fff" },
    goalCard: { backgroundColor: theme.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 16, marginBottom: 14 },
    goalTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    goalTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
    goalPlaceholder: { fontSize: 14, fontWeight: "500", color: theme.colors.textTertiary, marginTop: 4 },
    goalProgressText: { fontSize: 22, fontWeight: "800", color: theme.colors.text, marginVertical: 8 },
    goalProgressBarBg: { height: 6, borderRadius: 3, backgroundColor: theme.colors.divider, overflow: "hidden", marginBottom: 8 },
    goalProgressBarFill: { height: "100%", borderRadius: 3 },
    goalPercentage: { fontSize: 13, fontWeight: "700", color: theme.colors.textSecondary, textAlign: "right" },
    goalAchieved: { fontSize: 13, fontWeight: "700", color: theme.colors.success },
    streakCard: { backgroundColor: theme.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 16, marginBottom: 14 },
    streakHeader: { marginBottom: 8 },
    streakTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
    streakValues: { flexDirection: "row", alignItems: "center", gap: 16 },
    streakValueItem: { flex: 1, alignItems: "center" },
    streakValue: { fontSize: 22, fontWeight: "800", color: theme.colors.text },
    streakLabel: { fontSize: 11, fontWeight: "600", color: theme.colors.textTertiary, marginBottom: 2 },
    streakDivider: { width: 1, height: 32, backgroundColor: theme.colors.border },
    miniRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
    miniCard: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: 16, padding: 14, alignItems: "center", gap: 4, borderWidth: 1, borderColor: theme.colors.border },
    miniValue: { fontSize: 14, fontWeight: "800", color: theme.colors.text },
    miniLabel: { fontSize: 10, color: theme.colors.textTertiary, fontWeight: "600" },
    sectionTitle: { fontSize: 13, fontWeight: "700", color: theme.colors.textSecondary, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    seeAll: { fontSize: 13, color: theme.colors.primary, fontWeight: "600" },
    categoryScroll: { marginBottom: 20 },
    categoryChip: { backgroundColor: theme.colors.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, alignItems: "center", gap: 6, borderWidth: 1.5, minWidth: 72 },
    categoryLabel: { fontSize: 11, fontWeight: "700" },
    // ---- Old todo styles kept for reference (unused in new design) ----
    todoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
    checkboxTouch: { padding: 4 },
    todoContent: { flex: 1, justifyContent: "center", gap: 2 },
    todoTitle: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
    todoDuration: { fontSize: 12, fontWeight: "700", color: theme.colors.textSecondary },
    startFocusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
    startFocusText: { fontSize: 12, fontWeight: "700" },
    // ---- Todo Card ----
    todoCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      marginBottom: 10,
    },
    todoCardRow1: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    todoCardTitleArea: {
      flex: 1,
      justifyContent: "center",
    },
    todoCardMeta: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.textTertiary,
      marginTop: 1,
    },
    focusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    focusPillText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#fff",
    },
    todoProgressBarBg: {
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.divider,
      overflow: "hidden",
      marginTop: 10,
    },
    todoProgressBarFill: {
      height: "100%",
      borderRadius: 2,
    },
    todoCardRow2: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 6,
    },
    todoCardTimeText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.textTertiary,
    },
    // ---- Today's Progress Card ----
    todayProgressCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 18,
      marginBottom: 14,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    todayProgressHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    todayProgressTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.colors.text,
      letterSpacing: 0.2,
    },
    todayProgressPercentage: {
      fontSize: 18,
      fontWeight: "900",
      color: theme.colors.primary,
    },
    todayProgressStatsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    todayProgressStatItem: {
      flex: 1,
      alignItems: "center",
    },
    todayProgressStatValue: {
      fontSize: 20,
      fontWeight: "900",
      color: theme.colors.text,
    },
    todayProgressStatLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.textTertiary,
      marginTop: 2,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    todayProgressStatDivider: {
      width: 1,
      height: 28,
      backgroundColor: theme.colors.divider,
    },
    todayProgressBarBg: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.divider,
      overflow: "hidden",
    },
    todayProgressBarFill: {
      height: "100%",
      borderRadius: 4,
    },
    todayProgressEmpty: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 36,
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
    },
    todayProgressEmptyTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      marginTop: 8,
    },
    todayProgressEmptySub: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.colors.textTertiary,
    },
    // ---- Empty State ----
    emptyTodos: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 32,
      alignItems: "center",
      gap: 6,
    },
    emptyTodosTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      marginTop: 8,
    },
    emptyTodosSub: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.colors.textTertiary,
    },
  });
}
