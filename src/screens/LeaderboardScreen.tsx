import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { auth } from "@/firebase";
import { LeaderboardEntry } from "@/services/leaderboard";
import { useLeaderboard } from "@/hooks/useLeaderboard";
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

export default function LeaderboardScreen({ navigation }: any) {
  const { theme } = useTheme();
  const currentUid = auth?.currentUser?.uid;
  const { entries, loading, refreshing, fetchedAt, error, refetch } = useLeaderboard();
  const s = createStyles(theme);

  console.log("[LeaderboardScreen] Rendering with entries:", entries.length, "loading:", loading, "entries:", entries);

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
        <View style={s.center}><ActivityIndicator color={theme.colors.primary} size="large" /></View>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {error && <Text style={s.errorText}>{error}</Text>}

        {entries && entries.length > 0 ? (
          <View style={s.listSection}>
            {entries.map((entry, index) => {
              const displayName = entry.displayName || "Anonymous";
              const minutes = entry.totalFocusMinutes || 0;
              const rank = entry.rank || index + 1;
              
              return (
                <View key={entry.uid} style={s.listRow}>
                  <Text style={s.listRank}>#{rank}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.listName}>{displayName}</Text>
                  </View>
                  <Text style={s.listTime}>{formatHours(minutes)}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={s.emptyState}>
            <Ionicons name="bar-chart-outline" size={48} color={theme.colors.textTertiary} />
            <Text style={s.emptyStateTitle}>No data yet</Text>
            <Text style={s.emptyStateText}>Complete focus sessions to appear on the leaderboard</Text>
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
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
    headerTitle: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    cacheLabel: { fontSize: 11, color: theme.colors.textTertiary, textAlign: "center", paddingTop: 6, paddingBottom: 2 },
    emptyState: { paddingHorizontal: 24, paddingVertical: 60, alignItems: "center", justifyContent: "center" },
    emptyStateTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text, marginTop: 16, marginBottom: 8 },
    emptyStateText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: "center" },
    listSection: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
    listRow: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: theme.colors.border, gap: 12 },
    listRowHighlight: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + "08" },
    listRank: { fontSize: 14, fontWeight: "700", color: theme.colors.text, width: 30 },
    listName: { fontSize: 14, fontWeight: "600", color: theme.colors.text, flex: 1 },
    listTime: { fontSize: 14, fontWeight: "700", color: theme.colors.primary },
    errorText: { textAlign: "center", color: theme.colors.error, padding: 16, fontSize: 13 },
  });
}
