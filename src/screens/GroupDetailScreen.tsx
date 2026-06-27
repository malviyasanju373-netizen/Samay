import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, RefreshControl, ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { auth } from "@/firebase";
import { useGroup } from "@/hooks/useGroup";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { 
  joinGroup, 
  leaveGroup,
  requestJoinGroup,
  hasPendingJoinRequest,
  getPendingJoinRequests,
} from "@/services/groups";
import { useTheme } from "@/context/ThemeContext";
import { formatStudyTime } from "@/utils/timeFormat";
import { LoadingState, ErrorState } from "@/components/UIStates";

export default function GroupDetailScreen({ route, navigation }: any) {
  const groupId = typeof route?.params?.groupId === "string" ? route.params.groupId : "";
  const { theme } = useTheme();
  const currentUid = auth()?.currentUser?.uid ?? null;
  
  const { group, loading: groupLoading, error: groupError } = useGroup(groupId);
  const { leaderboard, loading: membersLoading, error: membersError } = useGroupMembers(groupId);
  
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const mountedRef = useRef(true);
  const s = useMemo(() => createStyles(theme), [theme]);

  const isMember = useMemo(
    () => Array.isArray(leaderboard) && leaderboard.some((m) => m?.uid === currentUid),
    [leaderboard, currentUid]
  );
  const currentMember = useMemo(
    () => Array.isArray(leaderboard) ? leaderboard.find((m) => m?.uid === currentUid) : undefined,
    [leaderboard, currentUid]
  );
  const isOwner = Boolean(currentUid && (group?.adminId === currentUid || group?.createdBy === currentUid));
  const isRoleAdmin = currentMember?.role === "admin";
  const canManageJoinRequests = isOwner || isRoleAdmin;
  
  const loading = groupLoading || membersLoading;
  const error = groupError || membersError;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Check for pending join request
  useEffect(() => {
    if (!groupId || !currentUid) return;

    const checkPendingRequest = async () => {
      try {
        const isPending = await hasPendingJoinRequest(groupId, currentUid);
        if (mountedRef.current) {
          setHasPendingRequest(isPending);
        }
      } catch (err: any) {
        console.error("[GroupDetail] Error checking pending request:", err);
      }
    };

    checkPendingRequest();
  }, [groupId, currentUid]);

  // Load pending requests count for admins
  useEffect(() => {
    if (!group || !groupId || !currentUid) return;

    if (!canManageJoinRequests) return;

    const loadPendingCount = async () => {
      try {
        const requests = await getPendingJoinRequests(groupId);
        if (mountedRef.current) {
          setPendingRequestCount(requests.length);
        }
      } catch (err: any) {
        console.error("[GroupDetail] Error loading pending requests:", err);
      }
    };

    loadPendingCount();
  }, [canManageJoinRequests, group, groupId]);

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

  const handleStartGroupStudy = useCallback(() => {
    const params = { groupId, groupName: group?.name || "Study Group" };
    const routeNames = navigation?.getState?.()?.routeNames || [];
    console.log("[GROUP DETAIL]", groupId, group?.name);

    if (routeNames.includes("Tabs")) {
      navigation.navigate("Tabs", { screen: "Timer", params });
      return;
    }

    if (routeNames.includes("MainTabs")) {
      navigation.navigate("MainTabs", {
        screen: "Tabs",
        params: { screen: "Timer", params },
      });
      return;
    }

    navigation?.navigate?.("Timer", params);
  }, [navigation, groupId, group?.name]);

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
      console.log("[JOIN GROUP ERROR]", err?.code, err?.message);
      if (mountedRef.current) {
        const message =
          err?.code === "firestore/unavailable" || err?.code === "firestore/network-request-failed"
            ? "Network issue. Please try again in a few seconds."
            : err?.message || "Failed to join group";
        Alert.alert("Error", message);
      }
    } finally {
      if (mountedRef.current) setJoining(false);
    }
  }, [groupId, currentUid]);

  const handleRequestJoin = useCallback(async () => {
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
      await requestJoinGroup(groupId, currentUid, displayName);
      if (mountedRef.current) {
        setHasPendingRequest(true);
        Alert.alert("Success", "Request sent to group admin");
      }
    } catch (err: any) {
      if (mountedRef.current) {
        Alert.alert("Error", err?.message || "Failed to send request");
      }
    } finally {
      if (mountedRef.current) setJoining(false);
    }
  }, [groupId, currentUid]);

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

  const isAdmin = canManageJoinRequests;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, []);

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
        {/* Hero Group Card */}
        <View style={s.heroCard}>
          <View style={s.heroHeader}>
            <View style={s.heroTitleRow}>
              <Text style={s.groupName} numberOfLines={1}>
                {group?.name || "Study Group"}
              </Text>
            </View>
            <Text style={s.groupDesc} numberOfLines={2}>
              {group?.description || "No description"}
            </Text>
          </View>

          {/* Compact Metric Pills */}
          <View style={s.metricPills}>
            <View style={[s.metricPill, { backgroundColor: theme.colors.primary + "15" }]}>
              <Ionicons name="people" size={14} color={theme.colors.primary} />
              <Text style={[s.metricPillText, { color: theme.colors.primary }]}>
                {group?.memberCount ?? 0}/{group?.maxMembers ?? 0}
              </Text>
            </View>
            <View style={[s.metricPill, { backgroundColor: theme.colors.success + "15" }]}>
              <Ionicons name="time" size={14} color={theme.colors.success} />
              <Text style={[s.metricPillText, { color: theme.colors.success }]}>
                {formatStudyTime(group?.totalStudyTimeSeconds ?? (group?.totalStudyTime || 0) * 3600)}
              </Text>
            </View>
            <View style={[s.metricPill, { backgroundColor: theme.colors.warning + "15" }]}>
              <Ionicons name="videocam" size={14} color={theme.colors.warning} />
              <Text style={[s.metricPillText, { color: theme.colors.warning }]}>
                {group?.camStudyHours ?? 0}h
              </Text>
            </View>
          </View>

          {/* Primary CTA */}
          {!isMember && !isAdmin && (
            <View style={s.ctaContainer}>
              {group?.isPrivate && !hasPendingRequest ? (
                <TouchableOpacity
                  style={[s.ctaButton, joining && s.ctaButtonDisabled]}
                  onPress={handleRequestJoin}
                  disabled={joining}
                >
                  {joining ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="mail" size={16} color="#fff" />
                      <Text style={s.ctaButtonText}>Request to Join</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : hasPendingRequest ? (
                <TouchableOpacity
                  style={[s.ctaButton, s.ctaButtonPending]}
                  disabled={true}
                >
                  <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
                  <Text style={[s.ctaButtonText, { color: theme.colors.primary }]}>Request Pending</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[s.ctaButton, joining && s.ctaButtonDisabled]}
                  onPress={handleJoin}
                  disabled={joining}
                >
                  {joining ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="person-add" size={16} color="#fff" />
                      <Text style={s.ctaButtonText}>Join Group</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {(isMember || isAdmin) && (
            <TouchableOpacity
              style={s.ctaButtonPrimary}
              onPress={handleStartGroupStudy}
              activeOpacity={0.85}
            >
              <Ionicons name="play-circle" size={18} color="#fff" />
              <Text style={s.ctaButtonText}>Start Group Study</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 2x2 Dashboard Grid */}
        {(isMember || isAdmin) && (
          <View style={s.dashboardGrid}>
            {isAdmin && group?.isPrivate && (
              <TouchableOpacity 
                style={s.gridTile} 
                onPress={() => safeNavigate("PendingRequests", { groupId, groupName: group?.name })}
              >
                <View style={s.gridTileIcon}>
                  <Ionicons name="mail-outline" size={34} color={theme.colors.primary} />
                  {pendingRequestCount > 0 && (
                    <View style={[s.badge, { backgroundColor: theme.colors.error }]}>
                      <Text style={s.badgeText}>{pendingRequestCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.gridTileLabel}>Requests</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={s.gridTile} 
              onPress={() => safeNavigate("GroupLeaderboard", { groupId, groupName: group?.name })}
            >
              <View style={s.gridTileIcon}>
                <Ionicons name="trophy-outline" size={34} color={theme.colors.warning} />
              </View>
              <Text style={s.gridTileLabel}>Leaderboard</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={s.gridTile} 
              onPress={() => safeNavigate("GroupChat", { groupId, groupName: group?.name })}
            >
              <View style={s.gridTileIcon}>
                <Ionicons name="chatbubbles-outline" size={34} color={theme.colors.info} />
              </View>
              <Text style={s.gridTileLabel}>Group Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={s.gridTile} 
              onPress={() => safeNavigate("GroupMembers", { groupId, groupName: group?.name })}
            >
              <View style={s.gridTileIcon}>
                <Ionicons name="people-outline" size={34} color={theme.colors.accent1} />
              </View>
              <Text style={s.gridTileLabel}>Members</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={s.gridTile} 
              onPress={() => safeNavigate("GroupAttendance", { groupId, groupName: group?.name })}
            >
              <View style={s.gridTileIcon}>
                <Ionicons name="calendar-outline" size={34} color={theme.colors.accent2} />
              </View>
              <Text style={s.gridTileLabel}>Attendance</Text>
            </TouchableOpacity>
          </View>
        )}

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
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backBtn: { width: 44, height: 44, justifyContent: "center" },
    headerTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.text, flex: 1 },
    headerTitleContainer: { flex: 1 },
    headerActionBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
    content: { flex: 1 },
    scrollContent: { padding: 16 },
    heroCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      gap: 14,
    },
    heroHeader: {
      gap: 6,
    },
    heroTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    groupName: { 
      fontSize: 20, 
      fontWeight: "800", 
      color: theme.colors.text,
      letterSpacing: -0.3,
    },
    groupDesc: { 
      fontSize: 13, 
      color: theme.colors.textSecondary, 
      lineHeight: 18,
    },
    metricPills: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    metricPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
    },
    metricPillText: {
      fontSize: 12,
      fontWeight: "600",
    },
    ctaContainer: {
      marginTop: 4,
    },
    ctaButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    ctaButtonDisabled: { opacity: 0.6 },
    ctaButtonPending: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: theme.colors.primary,
    },
    ctaButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    ctaButtonPrimary: {
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    dashboardGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    gridTile: {
      width: "48%",
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 14,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      aspectRatio: 1,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    gridTileIcon: {
      width: "auto",
      height: "auto",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    gridTileLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
      textAlign: "center",
    },
    badge: {
      position: "absolute",
      top: -6,
      right: -6,
      borderRadius: 12,
      minWidth: 20,
      height: 20,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 5,
      borderWidth: 2,
      borderColor: theme.colors.card,
    },
    badgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "700",
    },
  });