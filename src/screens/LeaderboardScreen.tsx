import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { auth } from "@/firebase";
import { getLeaderboard, getCachedFetchTime, LeaderboardEntry } from "@/services/leaderboard";
import { useTheme } from "@/context/ThemeContext";

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function timeAgo(ms: number): string {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return "1 hour ago";
}

const P = [
  { trophySize: 38, color: "#FFD700", bg: "rgba(255,215,0,0.10)", border: "#b8960a", label: "CHAMPION", extraTop: 0 },
  { trophySize: 28, color: "#C0C0C0", bg: "rgba(200,200,210,0.07)", border: "#808090", label: "2ND",      extraTop: 20 },
  { trophySize: 26, color: "#CD7F32", bg: "rgba(205,127,50,0.07)",  border: "#7a5020", label: "3RD",      extraTop: 36 },
];

export default function LeaderboardScreen({ navigation }: any) {
  const { theme } = useTheme();
  const currentUid = auth.currentUser?.uid;
  const [entries, setEntries]       = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchedAt, setFetchedAt]   = useState<number | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const s = createStyles(theme);

  const load = useCallback(async (force = false) => {
    try {
      setError(null);
      const data = await getLeaderboard(force);
      setEntries(data);
      setFetchedAt(await getCachedFetchTime());
    } catch { setError("Could not load leaderboard."); }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const top3 = entries.slice(0, 3);
  const rest  = entries.slice(3);
  const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          )}
          <Text style={s.headerTitle}>Leaderboard</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.center}><ActivityIndicator color={theme.colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        {navigation?.canGoBack?.() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        )}
        <Text style={s.headerTitle}>Leaderboard</Text>
        <View style={{ width: 40 }} />
      </View>

      {fetchedAt && (
        <Text style={s.cacheLabel}>Updated {timeAgo(fetchedAt)}</Text>
      )}

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Podium */}
        {top3.length === 3 && (
          <View style={s.podiumRow}>
            {podiumOrder.map((entry, podiumIdx) => {
              const rank = entry.rank - 1;
              const cfg = P[rank];
              const isActualFirst = rank === 0;
              return (
                <View key={entry.uid} style={[s.podiumColumn, { marginTop: cfg.extraTop }]}>
                  <Text style={[s.podiumLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  <View style={[s.podiumCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                    <Ionicons name="trophy" size={cfg.trophySize} color={cfg.color} />
                    <Text style={[s.podiumName, isActualFirst && s.podiumNameFirst]} numberOfLines={1}>
                      {entry.username}
                    </Text>
                    <Text style={[s.podiumTime, { color: cfg.color }]}>
                      {formatHours(entry.totalFocusMinutes)}
                    </Text>
                    {entry.uid === currentUid && (
                      <View style={s.youBadge}><Text style={s.youBadgeText}>YOU</Text></View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Ranks 4–10 */}
        <View style={s.listSection}>
          {rest.map((entry) => (
            <View key={entry.uid} style={[s.listRow, entry.uid === currentUid && s.listRowHighlight]}>
              <Text style={s.listRank}>#{entry.rank}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.listName} numberOfLines={1}>{entry.username}</Text>
              </View>
              <Text style={s.listTime}>{formatHours(entry.totalFocusMinutes)}</Text>
              {entry.uid === currentUid && (
                <View style={s.youBadge}><Text style={s.youBadgeText}>YOU</Text></View>
              )}
            </View>
          ))}
        </View>

        {error && <Text style={s.errorText}>{error}</Text>}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
    headerTitle: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    cacheLabel: { fontSize: 11, color: theme.colors.textTertiary, textAlign: "center", paddingTop: 6, paddingBottom: 2 },
    podiumRow: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12, gap: 8 },
    podiumColumn: { flex: 1, alignItems: "center" },
    podiumLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2, marginBottom: 4 },
    podiumCard: { width: "100%", borderRadius: 16, borderWidth: 1.5, padding: 12, alignItems: "center", gap: 4 },
    podiumName: { fontSize: 12, fontWeight: "700", color: theme.colors.text, textAlign: "center" },
    podiumNameFirst: { fontSize: 13 },
    podiumTime: { fontSize: 13, fontWeight: "800" },
    youBadge: { backgroundColor: theme.colors.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
    youBadgeText: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
    listSection: { paddingHorizontal: 16, gap: 2 },
    listRow: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: theme.colors.border, gap: 12 },
    listRowHighlight: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + "08" },
    listRank: { fontSize: 13, fontWeight: "700", color: theme.colors.textSecondary, width: 30 },
    listName: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
    listTime: { fontSize: 14, fontWeight: "700", color: theme.colors.primary },
    errorText: { textAlign: "center", color: theme.colors.error, padding: 16, fontSize: 13 },
  });
}
