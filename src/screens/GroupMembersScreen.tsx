import React, { useCallback, useMemo, useState, useEffect } from "react";
import { Alert, View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { useGroup } from "@/hooks/useGroup";
import { useTheme } from "@/context/ThemeContext";
import { LoadingState, ErrorState } from "@/components/UIStates";
import { formatLiveElapsedTime } from "@/utils/timeFormat";
import { getSecondaryIdentifier } from "@/utils/memberIdentification";
import { auth } from "@/firebase";
import { removeGroupMember, updateGroupMemberRole } from "@/services/groups";
import type { GroupLeaderboardEntry } from "@/types/group";

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

function getEffectiveRole(member: Pick<GroupLeaderboardEntry, "uid" | "role">, ownerUid?: string | null) {
  if (member.uid === ownerUid) return "owner";
  return member.role === "admin" ? "admin" : "member";
}

function getRoleBadge(role: "owner" | "admin" | "member") {
  if (role === "owner") return { label: "Owner", icon: "👑" };
  if (role === "admin") return { label: "Admin", icon: "🛡️" };
  return { label: "Member", icon: "👤" };
}

export default function GroupMembersScreen({ route, navigation }: any) {
  const groupId = typeof route?.params?.groupId === "string" ? route.params.groupId : "";
  const groupName = route?.params?.groupName || "Members";
  const { theme } = useTheme();
  const currentUid = auth()?.currentUser?.uid ?? null;

  const { leaderboard, loading, error } = useGroupMembers(groupId);
  const { group, loading: groupLoading, error: groupError } = useGroup(groupId);
  const s = useMemo(() => createStyles(theme), [theme]);
  const ownerUid = group?.adminId || group?.createdBy || null;
  const currentMember = useMemo(
    () => leaderboard.find((member) => member.uid === currentUid),
    [leaderboard, currentUid]
  );
  const currentRole = currentMember ? getEffectiveRole(currentMember, ownerUid) : "member";
  const canManageMembers = currentRole === "owner";
  const combinedLoading = loading || groupLoading;
  const combinedError = error || groupError;

  const safeGoBack = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.("GroupDetail", { groupId });
  }, [navigation, groupId]);

  const handlePromote = useCallback(async (member: GroupLeaderboardEntry) => {
    try {
      await updateGroupMemberRole(groupId, member.uid, "admin");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to promote member");
    }
  }, [groupId]);

  const handleDemote = useCallback(async (member: GroupLeaderboardEntry) => {
    try {
      await updateGroupMemberRole(groupId, member.uid, "member");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to demote admin");
    }
  }, [groupId]);

  const handleRemove = useCallback((member: GroupLeaderboardEntry) => {
    Alert.alert("Remove Member", `Remove ${member.displayName || member.name || "this member"} from the group?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await removeGroupMember(groupId, member.uid);
          } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to remove member");
          }
        },
      },
    ]);
  }, [groupId]);

  const openMemberActions = useCallback((member: GroupLeaderboardEntry) => {
    const role = getEffectiveRole(member, ownerUid);
    if (!canManageMembers || role === "owner") return;

    const actions = role === "admin"
      ? [
          { text: "Demote Admin to Member", onPress: () => handleDemote(member) },
          { text: "Remove Member", style: "destructive" as const, onPress: () => handleRemove(member) },
        ]
      : [
          { text: "Promote to Admin", onPress: () => handlePromote(member) },
          { text: "Remove Member", style: "destructive" as const, onPress: () => handleRemove(member) },
        ];

    Alert.alert(member.displayName || member.name || "Member", "Member actions", [
      ...actions,
      { text: "Cancel", style: "cancel" },
    ]);
  }, [canManageMembers, handleDemote, handlePromote, handleRemove, ownerUid]);

  if (combinedLoading) {
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

  if (combinedError) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={safeGoBack} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Error</Text>
          <View style={{ width: 44 }} />
        </View>
        <ErrorState title="Unable to Load" message={combinedError} onRetry={safeGoBack} retryLabel="Go Back" />
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
            const role = getEffectiveRole(member, ownerUid);
            const badge = getRoleBadge(role);
            const showActions = canManageMembers && role !== "owner";
            return (
              <View key={member?.uid || `member-${idx}`} style={s.leaderboardRow}>
                <View style={[s.studyingDot, { backgroundColor: member?.isOnline ? '#22C55E' : '#9CA3AF' }]} />
                <View style={s.memberInfo}>
                  <View style={s.memberTitleRow}>
                    <Text style={s.memberName} numberOfLines={1}>{member?.displayName || "Unknown"}</Text>
                    <View style={s.roleBadge}>
                      <Text style={s.roleBadgeText}>{badge.icon} {badge.label}</Text>
                    </View>
                  </View>
                  <Text style={s.secondaryId}>{secondaryId}</Text>
                </View>
                {showActions && (
                  <TouchableOpacity style={s.memberActionBtn} onPress={() => openMemberActions(member)}>
                    <Ionicons name="ellipsis-vertical" size={18} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
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
    memberInfo: { flex: 1, minWidth: 0 },
    memberTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    memberName: { flex: 1, fontSize: 14, color: theme.colors.text },
    secondaryId: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
    roleBadge: {
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    roleBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.textSecondary,
    },
    memberActionBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
    },
    studyingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#22C55E",
      marginRight: 8,
    },
  });
