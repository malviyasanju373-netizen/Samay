import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, RefreshControl, Animated, Image, ActivityIndicator,
  Platform, UIManager, LayoutAnimation,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { auth } from "@/firebase";
import { useGroup } from "@/hooks/useGroup";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { useGroupActiveSessions } from "@/hooks/useGroupActiveSessions";
import { useGroupAttendance } from "@/hooks/useGroupAttendance";
import { joinGroup, leaveGroup } from "@/services/groups";
import { useTheme } from "@/context/ThemeContext";
import { LoadingState, ErrorState } from "@/components/UIStates";

export default function GroupDetailScreen({ route, navigation }: any) {
  // CRASH FIX: Type-safe route param extraction
  const groupId = typeof route?.params?.groupId === "string" ? route.params.groupId : "";
  const { theme } = useTheme();
  const currentUid = auth()?.currentUser?.uid ?? null;
  
  // CRASH FIX: Separate error and loading states to prevent race conditions
  const { group, loading: groupLoading, error: groupError } = useGroup(groupId);
    const { leaderboard, loading: membersLoading, error: membersError } = useGroupMembers(groupId);
    const { activeSessions, loading: sessionsLoading } = useGroupActiveSessions(groupId);
    const { todayPresent, totalMembers, attendancePercentage, rankedMembers, loading: attendanceLoading } = useGroupAttendance(groupId);
  
    const [joining, setJoining] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const mountedRef = useRef(true);
    const s = useMemo(() => createStyles(theme), [theme]);

  // CRASH FIX: Safely check membership with null-safe optional chaining
  const isMember = useMemo(
    () => Array.isArray(leaderboard) && leaderboard.some((m) => m?.uid === currentUid),
    [leaderboard, currentUid]
  );
  
  const loading = groupLoading || membersLoading;
  const error = groupError || membersError;

  // CRASH FIX: Proper cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // CRASH FIX: Safe navigation with null checks
  const safeGoBack = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.("GroupsList");
  }, [navigation]);

  const safeNavigate = useCallback((screen: string, params?: Record<string, unknown>) => {
    if (mountedRef.current) {
      navigation?.navigate?.(screen, params);
    }
  }, [navigation]);

  // CRASH FIX: Safe join with auth check
  const handleJoin = useCallback(async () => {
    if (!groupId) {
      Alert.alert("Error", "Group not found");
      return;
    }
    if (!currentUid) {
      Alert.alert("Error", "User not authenticated");
      return;
    }
    setJoining(true);
    try {
      const displayName = auth().currentUser?.displayName || "User";
      const photoURL = auth().currentUser?.photoURL ?? undefined;
      await joinGroup(groupId, currentUid, displayName, photoURL);
      if (mountedRef.current) {
        Alert.alert("Success", "Joined group successfully");
      }
    } catch (err: any) {
      if (mountedRef.current) {
        Alert.alert("Error", err?.message || "Failed to join group");
      }
    } finally {
      if (mountedRef.current) setJoining(false);
    }
  }, [groupId, currentUid]);

  // CRASH FIX: Safe leave with confirmation
  const handleLeave = useCallback(async () => {
    if (!groupId) {
      Alert.alert("Error", "Group not found");
      return;
    }
    Alert.alert("Leave Group", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          if (!currentUid) return;
          setLeaving(true);
          try {
            await leaveGroup(groupId, currentUid);
            if (mountedRef.current) safeGoBack();
          } catch (err: any) {
            if (mountedRef.current) {
              Alert.alert("Error", err?.message || "Failed to leave group");
            }
          } finally {
            if (mountedRef.current) setLeaving(false);
          }
        },
      },
    ]);
  }, [groupId, currentUid, safeGoBack]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refresh is automatic via subscriptions
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, []);

  // CRASH FIX: Show proper states
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
        <LoadingState message="Loading group details..." />
      </SafeAreaView>
    );
  }

  if (error || !group) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={safeGoBack} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Error</Text>
          <View style={{ width: 44 }} />
        </View>
        <ErrorState 
          title="Unable to Load Group"
          message={error || "Group not found"}
          onRetry={safeGoBack}
          retryLabel="Go Back"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={safeGoBack} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={s.headerTitleContainer}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {group?.name || "Study Group"}
          </Text>
        </View>
        {isMember ? (
          <TouchableOpacity onPress={handleLeave} disabled={leaving} style={s.headerActionBtn}>
            <Ionicons name="exit-outline" size={22} color={theme.colors.error} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView
        style={s.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={theme.colors.primary} 
          />
        }
      >
        {/* Group Info Card */}
        <View style={s.infoCard}>
          <Text style={s.groupName}>{group?.name || "Study Group"}</Text>
          <Text style={s.groupDesc}>{group?.description || "No description"}</Text>
                    <View style={s.groupStats}>
            <View style={s.statItem}>
              <Text style={s.statLabel}>Members</Text>
              <Text style={s.statValue}>{group?.memberCount ?? 0}/{group?.maxMembers ?? 0}</Text>
            </View>
            <View style={s.statItem}>
              <Text style={s.statLabel}>Study Time</Text>
              <Text style={s.statValue}>{group?.totalStudyTime ?? 0}h</Text>
            </View>
            <View style={s.statItem}>
              <Text style={s.statLabel}>Cam Study</Text>
              <Text style={s.statValue}>{group?.camStudyHours ?? 0}h</Text>
            </View>
          </View>

          {!isMember && (
            <TouchableOpacity
              style={[s.joinBtn, joining && s.joinBtnDisabled]}
              onPress={handleJoin}
              disabled={joining}
            >
              {joining ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="person-add" size={16} color="#fff" />
                  <Text style={s.joinBtnText}>Join Group</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

                {/* Who's Studying Now - Active Sessions */}
        {Array.isArray(activeSessions) && activeSessions.length > 0 ? (
          <View style={s.activeSessionsSection}>
            <Text style={s.sectionTitle}>Who's Studying Now</Text>
            {activeSessions.map((session, idx) => (
                          <View key={session.userId || `session-${idx}`} style={s.leaderboardRow}>
                            <View style={s.studyingDot} />
                            <Text style={s.memberName}>{session.userName || "User"}</Text>
                            <Ionicons name="timer-outline" size={14} color={theme.colors.primary} />
              </View>
            ))}
          </View>
        ) : null}

        {/* Attendance Card */}
        <View style={s.attendanceCard}>
          <Text style={s.sectionTitle}>Today's Attendance</Text>
          <View style={s.attendanceStats}>
            <View style={s.statItem}>
              <Text style={s.statLabel}>Present</Text>
              <Text style={s.statValue}>{todayPresent}</Text>
            </View>
            <View style={s.statItem}>
              <Text style={s.statLabel}>Total</Text>
              <Text style={s.statValue}>{totalMembers}</Text>
            </View>
            <View style={s.statItem}>
              <Text style={s.statLabel}>Rate</Text>
              <Text style={s.statValue}>{attendancePercentage}%</Text>
            </View>
          </View>
        </View>

        {/* Attendance Ranking */}
        {Array.isArray(rankedMembers) && rankedMembers.length > 0 ? (
          <View style={s.rankingSection}>
            <Text style={s.sectionTitle}>Attendance Ranking</Text>
            {rankedMembers.map((member, idx) => {
              const isStudying = Array.isArray(leaderboard) && leaderboard.some(
                (lm) => lm.uid === member.uid && lm.isStudying
              );
              return (
                <View key={member.uid || `rank-${idx}`} style={s.leaderboardRow}>
                  <Text style={s.rankText}>{idx + 1}</Text>
                  <Text style={s.memberName}>{member.displayName || "User"}</Text>
                  {isStudying && (
                    <View style={s.studyingBadge}>
                      <Text style={s.studyingBadgeText}>Focusing</Text>
                    </View>
                  )}
                  <Text style={s.memberScore}>{member.attendancePercentage}%</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Leaderboard */}
        {Array.isArray(leaderboard) && leaderboard.length > 0 ? (
          <View style={s.leaderboardSection}>
            <Text style={s.sectionTitle}>Leaderboard</Text>
            {leaderboard.map((member, idx) => (
              <View key={member?.uid || `member-${idx}`} style={s.leaderboardRow}>
                <Text style={s.rankText}>{idx + 1}</Text>
                <Text style={s.memberName}>{member?.displayName || "Unknown"}</Text>
                <Text style={s.memberScore}>{member?.totalFocusMinutes || 0}h</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ height: 20 }} />
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
    headerTitleContainer: { flex: 1 },
    headerActionBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
    content: { flex: 1 },
    scrollContent: { padding: 16 },
    infoCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    groupName: { fontSize: 20, fontWeight: "800", color: theme.colors.text, marginBottom: 8 },
    groupDesc: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 12 },
    groupStats: { flexDirection: "row", gap: 16, marginBottom: 12 },
    statItem: { alignItems: "center" },
    statLabel: { fontSize: 12, color: theme.colors.textTertiary },
    statValue: { fontSize: 18, fontWeight: "700", color: theme.colors.primary },
    joinBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    joinBtnDisabled: { opacity: 0.6 },
    joinBtnText: { color: "#fff", fontWeight: "700" },
    // Active Sessions styles
    activeSessionsSection: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    studyingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#22C55E",
      marginRight: 8,
    },
    sessionSubject: {
      fontSize: 12,
      color: theme.colors.textTertiary,
      marginRight: 8,
    },
    // Attendance Card styles
    attendanceCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    attendanceStats: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    // Ranking styles
    rankingSection: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    // Studying Badge styles
    studyingBadge: {
      backgroundColor: "#22C55E",
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginRight: 8,
    },
    studyingBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "700",
    },
    leaderboardSection: {
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
    rankText: { width: 30, fontSize: 14, fontWeight: "700", color: theme.colors.primary },
    memberName: { flex: 1, fontSize: 14, color: theme.colors.text },
    memberScore: { fontSize: 14, fontWeight: "600", color: theme.colors.textSecondary },
  });
