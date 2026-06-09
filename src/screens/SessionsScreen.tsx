import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/context/ThemeContext";
import { auth } from "@/firebase";
import { getRecentSessions } from "@/services/sessions";
import { FocusSession, CATEGORIES } from "@/types/session";
import { formatStudyTime } from "@/utils/timeFormat";

function formatHMS(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h${m > 0 ? ` ${m}m` : ""}`;
}

function sessionDate(session: FocusSession) {
  const ts = typeof (session.startTime as any)?.toDate === "function"
    ? (session.startTime as any).toDate()
    : new Date();
  return ts.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function sessionTime(session: FocusSession) {
  const ts = typeof (session.startTime as any)?.toDate === "function"
    ? (session.startTime as any).toDate()
    : new Date();
  return ts.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function groupByDate(sessions: FocusSession[]): { date: string; items: FocusSession[] }[] {
  const map = new Map<string, FocusSession[]>();
  for (const s of sessions) {
    const d = sessionDate(s);
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(s);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

export default function SessionsScreen() {
  const { theme } = useTheme();
  const user = auth().currentUser;
  const s = createStyles(theme);

  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setError("Sign in to view sessions.");
      return;
    }
    try {
      setError(null);
      const data = await getRecentSessions(user.uid, 50);
      setSessions(data);
    } catch (err: any) {
      setError(err?.message ?? "Could not load sessions.");
    }
  }, [user]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

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

  const groups = groupByDate(sessions);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Sessions</Text>
        <Text style={s.headerCount}>{sessions.length}</Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        contentContainerStyle={s.scroll}
      >
        {groups.length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="timer-outline" size={48} color={theme.colors.textTertiary} />
            <Text style={s.emptyText}>No sessions yet</Text>
            <Text style={s.emptySubtext}>Start your first focus session</Text>
          </View>
        )}
        {error ? <Text style={s.errorText}>{error}</Text> : null}
        {groups.map(({ date, items }) => (
          <View key={date}>
            <Text style={s.dateHeader}>{date}</Text>
            {items.map((session) => {
              const cat = CATEGORIES.find((c) => c.id === session.categoryId) ?? CATEGORIES[CATEGORIES.length - 1];
              const pct = session.targetMinutes
                ? Math.min(session.durationMinutes / session.targetMinutes, 1)
                : 1;
              return (
                <View key={session.id} style={s.card}>
                  <View style={[s.catIcon, { backgroundColor: cat.color + "18" }]}>
                    <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle} numberOfLines={1}>{session.title || cat.label}</Text>
                    <Text style={s.cardTime}>{sessionTime(session)}</Text>
                    {session.targetMinutes && (
                      <View style={s.progressBar}>
                        <View style={[s.progressFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: cat.color }]} />
                      </View>
                    )}
                  </View>
                  <View style={s.cardRight}>
                    <Text style={[s.cardDuration, { color: cat.color }]}>{formatStudyTime(session.durationSeconds ?? session.durationMinutes * 60)}</Text>
                    {session.targetMinutes && (

                      <Text style={s.cardTarget}>/{formatStudyTime(session.targetMinutes * 60)}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    errorText: { color: theme.colors.error, fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 12 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    headerTitle: { fontSize: 24, fontWeight: "800", color: theme.colors.text },
    headerCount: { fontSize: 14, fontWeight: "700", color: theme.colors.textTertiary, backgroundColor: theme.colors.card, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    scroll: { paddingHorizontal: 16 },
    dateHeader: { fontSize: 12, fontWeight: "700", color: theme.colors.textTertiary, letterSpacing: 0.5, marginTop: 16, marginBottom: 8, textTransform: "uppercase" },
    card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
    catIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    cardTitle: { fontSize: 14, fontWeight: "600", color: theme.colors.text, marginBottom: 2 },
    cardTime: { fontSize: 12, color: theme.colors.textTertiary },
    progressBar: { height: 3, backgroundColor: theme.colors.border, borderRadius: 2, marginTop: 6, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 2 },
    cardRight: { alignItems: "flex-end" },
    cardDuration: { fontSize: 16, fontWeight: "800" },
    cardTarget: { fontSize: 11, color: theme.colors.textTertiary },
    emptyState: { alignItems: "center", paddingTop: 80, gap: 8 },
    emptyText: { fontSize: 18, fontWeight: "700", color: theme.colors.textSecondary },
    emptySubtext: { fontSize: 13, color: theme.colors.textTertiary },
  });
}
