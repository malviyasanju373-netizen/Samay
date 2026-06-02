import React, { useCallback, useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { useTheme } from "@/context/ThemeContext";
import { LoadingState, ErrorState } from "@/components/UIStates";
import { formatLiveElapsedTime } from "@/utils/timeFormat";
import { getSecondaryIdentifier } from "@/utils/memberIdentification";

const LiveTimerText = ({ startedAt }: { startedAt: any }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const startMs = typeof startedAt.toDate === "function" ? startedAt.toDate().getTime() : Number(startedAt);
    if (isNaN(startMs)) return;

    const calc = () => Math.floor(Math.max(0, Date.now() - startMs) / 1000);
    setElapsed(calc());
    const interval = setInterval(() => setElapsed(calc()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return <Text style={{ fontSize: 14, color: "#22C55E", fontWeight: "600", marginLeft: "auto" }}>{formatLiveElapsedTime(elapsed)}</Text>;
};

export default function GroupMembersScreen({ route, navigation }: any) {
  const groupId = typeof route?.params?.groupId === "string" ? route.params.groupId : "";
  const groupName = route?.params?.groupName || "Members";
  const { theme } = useTheme();

  const { leaderboard, loading, error } = useGroupMembers(groupId);
  const s = useMemo(() => createStyles(theme), [theme]);

  const safeGoBack = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.("GroupDetail", { groupId });
  }, [navigation, groupId]);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={safeGoBack} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Loading...</Text>
          <View style={{ width: 44 }} />
        </View>
        <LoadingState message="Loading members..." />
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
          <Text style={s.headerTitle}>Error</Text>
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
        <Text style={s.headerTitle} numberOfLines={1}>{groupName} Members</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView style={s.content} contentContainerStyle={s.scrollContent}>
        {/* Who's Studying Now */}
        {Array.isArray(leaderboard) && leaderboard.some((m) => m.isStudying) ? (
          <View style={s.activeSessionsSection}>
            <Text style={s.sectionTitle}>Who's Studying Now</Text>
            {leaderboard
              .filter((m) => m.isStudying)
              .map((member, idx) => {
                const secondaryId = getSecondaryIdentifier(member.uid, member.email, member.name);
                return (
                  <View key={member.uid || `session-${idx}`} style={s.leaderboardRow}>
                    <View style={s.studyingDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.memberName}>{member.displayName || "User"}</Text>
                      <Text style={s.secondaryId}>{secondaryId}</Text>
                    </View>
                    <LiveTimerText startedAt={(member as any).currentSessionStart} />
                  </View>
                );
              })}
          </View>
        ) : null}

        {/* All Members */}
        <View style={s.membersSection}>
          <Text style={s.sectionTitle}>All Members</Text>
          {Array.isArray(leaderboard) && leaderboard.length > 0 ? leaderboard.map((member, idx) => {
            const secondaryId = getSecondaryIdentifier(member.uid, member.email, member.name);
            return (
              <View key={member?.uid || `member-${idx}`} style={s.leaderboardRow}>
                <View style={[s.studyingDot, { backgroundColor: member?.isOnline ? '#22C55E' : '#9CA3AF' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.memberName}>{member?.displayName || "Unknown"}</Text>
                  <Text style={s.secondaryId}>{secondaryId}</Text>
                </View>
              </View>
            );
          }) : (
            <Text style={{ color: theme.colors.textSecondary }}>No members found.</Text>
          )}
        </View>
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
    },
    backBtn: { width: 44, height: 44, justifyContent: "center" },
    headerTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.text, flex: 1 },
    content: { flex: 1 },
    scrollContent: { padding: 16 },
    activeSessionsSection: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    membersSection: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
    },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text, marginBottom: 12 },
    leaderboardRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    memberName: { flex: 1, fontSize: 14, color: theme.colors.text },
    secondaryId: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
    studyingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#22C55E",
      marginRight: 8,
    },
  });
