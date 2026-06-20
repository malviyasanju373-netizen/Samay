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
    navigation.navigate("Tabs", {
      screen: "Timer",
      params: {
        todoId: todo.id,
        subjectId: todo.subjectId,
        plannedDurationMinutes: todo.plannedDurationMinutes,
        title: todo.title,
      },
    });
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

        {/* Recent sessions */}
        {recentSessions.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Recent</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Sessions")} activeOpacity={0.8}>
                <Text style={s.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {recentSessions.map((session) => {
              const cat = CATEGORIES.find((c) => c.id === session.categoryId) ?? CATEGORIES[CATEGORIES.length - 1];
              return (
                <View key={session.id} style={s.sessionRow}>
                  <View style={[s.sessionIcon, { backgroundColor: cat.color + "18" }]}>
                    <Ionicons name={cat.icon as any} size={18} color={cat.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sessionTitle} numberOfLines={1}>{session.title || cat.label}</Text>
                    <Text style={s.sessionDate}>{sessionDateLabel(session)}</Text>
                  </View>
                  <Text style={s.sessionDuration}>{formatStudyTime(session.durationSeconds ?? session.durationMinutes * 60)}</Text>
                </View>
              );
            })}
          </>
        )}

        {/* Today's Todos */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Today's Todos</Text>
          <TouchableOpacity onPress={() => navigation.navigate("TodoScreen")} activeOpacity={0.8}>
            <Text style={s.seeAll}>See All →</Text>
          </TouchableOpacity>
        </View>
        {todayTodos.length > 0 ? (
          todayTodos.map((todo) => (
            <View key={todo.id} style={s.todoRow}>
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
              <View style={s.todoContent}>
                <Text style={s.todoTitle} numberOfLines={1}>{todo.title}</Text>
                {todo.plannedDurationMinutes > 0 && (
                  <Text style={s.todoDuration}>{todo.plannedDurationMinutes}m</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => handleStartFocus(todo)}
                style={[s.startFocusBadge, { backgroundColor: theme.colors.primary + "15" }]}
                activeOpacity={0.7}
              >
                <Ionicons name="play" size={14} color={theme.colors.primary} />
                <Text style={[s.startFocusText, { color: theme.colors.primary }]}>Start Focus</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={s.emptyTodos}>
            <Text style={s.emptyTodosText}>No Todos Yet</Text>
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
    sessionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
    sessionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    sessionTitle: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
    sessionDate: { fontSize: 12, color: theme.colors.textTertiary },
    sessionDuration: { fontSize: 14, fontWeight: "700", color: theme.colors.textSecondary },
    todoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
    checkboxTouch: { padding: 4 },
    todoContent: { flex: 1, justifyContent: "center", gap: 2 },
    todoTitle: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
    todoDuration: { fontSize: 12, fontWeight: "700", color: theme.colors.textSecondary },
    startFocusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
    startFocusText: { fontSize: 12, fontWeight: "700" },
    emptyTodos: { backgroundColor: theme.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 16, alignItems: "center" },
    emptyTodosText: { fontSize: 13, color: theme.colors.textTertiary, fontWeight: "500" },
  });
}
