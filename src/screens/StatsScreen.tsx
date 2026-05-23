import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { auth } from "@/firebase";
import { getWeeklyMinutes, getRecentSessions } from "@/services/sessions";
import { CATEGORIES, FocusSession } from "@/types/session";
import Ionicons from "@react-native-vector-icons/ionicons";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatHMS(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h${m > 0 ? ` ${m}m` : ""}`;
}

function categoryBreakdown(sessions: FocusSession[]): { categoryId: string; minutes: number }[] {
  const map = new Map<string, number>();
  for (const s of sessions) {
    map.set(s.categoryId, (map.get(s.categoryId) ?? 0) + s.durationMinutes);
  }
  return Array.from(map.entries())
    .map(([categoryId, minutes]) => ({ categoryId, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5);
}

export default function StatsScreen() {
  const { theme } = useTheme();
  const user = auth?.currentUser;
  const s = createStyles(theme);

  const [weeklyMinutes, setWeeklyMinutes] = useState<number[]>(Array(7).fill(0));
  const [breakdown, setBreakdown] = useState<{ categoryId: string; minutes: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setError("Sign in to view stats.");
      return;
    }
    try {
      setError(null);
      const [weekly, sessions] = await Promise.all([
        getWeeklyMinutes(user.uid),
        getRecentSessions(user.uid, 100),
      ]);
      setWeeklyMinutes(weekly);
      setBreakdown(categoryBreakdown(sessions));
    } catch (err: any) {
      setError(err?.message ?? "Could not load stats.");
    }
  }, [user]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const maxWeekly = Math.max(...weeklyMinutes, 1);
  const totalWeek = weeklyMinutes.reduce((a, b) => a + b, 0);
  const avgDay = Math.round(totalWeek / 7);

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
        <Text style={s.pageTitle}>Stats</Text>
        {error ? <Text style={s.errorText}>{error}</Text> : null}

        {/* Weekly summary */}
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Ionicons name="time" size={20} color={theme.colors.primary} />
            <Text style={s.summaryValue}>{formatHMS(totalWeek)}</Text>
            <Text style={s.summaryLabel}>This week</Text>
          </View>
          <View style={s.summaryCard}>
            <Ionicons name="trending-up" size={20} color={theme.colors.success} />
            <Text style={s.summaryValue}>{formatHMS(avgDay)}</Text>
            <Text style={s.summaryLabel}>Daily avg</Text>
          </View>
        </View>

        {/* Bar chart */}
        <View style={s.chartCard}>
          <View style={s.bars}>
            {weeklyMinutes.map((mins, i) => {
              const pct = mins / maxWeekly;
              const today = i === (new Date().getDay() + 6) % 7;
              return (
                <View key={i} style={s.barCol}>
                  <Text style={s.barValue}>{mins > 0 ? formatHMS(mins) : ""}</Text>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, {
                      height: `${Math.max(pct * 100, mins > 0 ? 4 : 0)}%` as any,
                      backgroundColor: today ? theme.colors.primary : theme.colors.primary + "55",
                    }]} />
                  </View>
                  <Text style={[s.barDay, today && { color: theme.colors.primary, fontWeight: "700" }]}>{DAYS[i]}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Category breakdown */}
        {breakdown.length > 0 && (
          <>
            <Text style={s.sectionTitle}>BY SUBJECT</Text>
            <View style={s.breakdownCard}>
              {breakdown.map(({ categoryId, minutes }) => {
                const cat = CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES[CATEGORIES.length - 1];
                const pct = minutes / (breakdown[0]?.minutes || 1);
                return (
                  <View key={categoryId} style={s.breakdownRow}>
                    <Ionicons name={cat.icon as any} size={16} color={cat.color} style={{ marginRight: 8 }} />
                    <Text style={s.breakdownName}>{cat.label}</Text>
                    <View style={s.breakdownBarTrack}>
                      <View style={[s.breakdownBarFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: cat.color }]} />
                    </View>
                    <Text style={[s.breakdownTime, { color: cat.color }]}>{formatHMS(minutes)}</Text>
                  </View>
                );
              })}
            </View>
          </>
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
    pageTitle: { fontSize: 24, fontWeight: "800", color: theme.colors.text, marginBottom: 16 },
    summaryRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
    summaryCard: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, alignItems: "center", gap: 4, borderWidth: 1, borderColor: theme.colors.border },
    summaryValue: { fontSize: 20, fontWeight: "800", color: theme.colors.text },
    summaryLabel: { fontSize: 11, color: theme.colors.textTertiary, fontWeight: "600" },
    chartCard: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.border },
    bars: { flexDirection: "row", alignItems: "flex-end", height: 140, gap: 6 },
    barCol: { flex: 1, alignItems: "center", height: "100%" },
    barValue: { fontSize: 8, color: theme.colors.textTertiary, marginBottom: 2, height: 12 },
    barTrack: { flex: 1, width: "100%", backgroundColor: theme.colors.border, borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
    barFill: { width: "100%", borderRadius: 4 },
    barDay: { fontSize: 10, color: theme.colors.textSecondary, marginTop: 4, fontWeight: "600" },
    sectionTitle: { fontSize: 10, fontWeight: "700", color: theme.colors.textTertiary, letterSpacing: 1.2, marginBottom: 10 },
    breakdownCard: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border, gap: 14 },
    breakdownRow: { flexDirection: "row", alignItems: "center" },
    breakdownName: { fontSize: 13, fontWeight: "600", color: theme.colors.text, width: 64 },
    breakdownBarTrack: { flex: 1, height: 6, backgroundColor: theme.colors.border, borderRadius: 3, overflow: "hidden", marginHorizontal: 8 },
    breakdownBarFill: { height: "100%", borderRadius: 3 },
    breakdownTime: { fontSize: 12, fontWeight: "700", width: 40, textAlign: "right" },
  });
}
