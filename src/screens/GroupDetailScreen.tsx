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

    const isUserAdmin = group.adminId === currentUid;
    if (!isUserAdmin) return;

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
  }, [group, groupId, currentUid]);

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
      if (mountedRef.current) {
        Alert.alert("Error", err?.message || "Failed to join group");
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

  const isAdmin = group?.adminId === currentUid;

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

          {!isMember && !isAdmin && (
            <>
              {group?.isPrivate && !hasPendingRequest ? (
                <TouchableOpacity
                  style={[s.joinBtn, joining && s.joinBtnDisabled]}
                  onPress={handleRequestJoin}
                  disabled={joining}
                >
                  {joining ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="mail" size={16} color="#fff" />
                      <Text style={s.joinBtnText}>Request to Join</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : hasPendingRequest ? (
                <TouchableOpacity
                  style={[s.joinBtn, s.joinBtnPending]}
                  disabled={true}
                >
                  <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
                  <Text style={[s.joinBtnText, { color: theme.colors.primary }]}>Request Pending</Text>
                </TouchableOpacity>
              ) : (
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
            </>
          )}

          {(isMember || isAdmin) && (
            <TouchableOpacity
              style={s.groupStudyBtn}
              onPress={handleStartGroupStudy}
              activeOpacity={0.85}
            >
              <Ionicons name="play-circle" size={18} color="#fff" />
              <Text style={s.joinBtnText}>Start Group Study</Text>
            </TouchableOpacity>
          )}
        </View>

        {(isMember || isAdmin) && (
          <View style={s.navCardsContainer}>
            {isAdmin && group?.isPrivate && (
              <TouchableOpacity 
                style={s.navCard} 
                onPress={() => safeNavigate("PendingRequests", { groupId, groupName: group?.name })}
              >
                <View style={s.navCardIconContainer}>
                  <Ionicons name="mail-outline" size={24} color={theme.colors.primary} />
                  {pendingRequestCount > 0 && (
                    <View style={[s.badge, { backgroundColor: theme.colors.error }]}>
                      <Text style={s.badgeText}>{pendingRequestCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.navCardText}>Requests</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={s.navCard} onPress={() => safeNavigate("GroupLeaderboard", { groupId, groupName: group?.name })}>
              <Ionicons name="trophy-outline" size={24} color={theme.colors.primary} />
              <Text style={s.navCardText}>Leaderboard</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={s.navCard} onPress={() => safeNavigate("GroupChat", { groupId, groupName: group?.name })}>
              <Ionicons name="chatbubbles-outline" size={24} color={theme.colors.primary} />
              <Text style={s.navCardText}>Group Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.navCard} onPress={() => safeNavigate("GroupMembers", { groupId, groupName: group?.name })}>
              <Ionicons name="people-outline" size={24} color={theme.colors.primary} />
              <Text style={s.navCardText}>Members</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.navCard} onPress={() => safeNavigate("GroupAttendance", { groupId, groupName: group?.name })}>
              <Ionicons name="calendar-outline" size={24} color={theme.colors.primary} />
              <Text style={s.navCardText}>Attendance</Text>
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
    joinBtnPending: {
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    joinBtnText: { color: "#fff", fontWeight: "700" },
    groupStudyBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 12,
    },
    navCardsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      justifyContent: "space-between",
    },
    navCard: {
      backgroundColor: theme.colors.card,
      width: "48%",
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    navCardIconContainer: {
      position: "relative",
    },
    badge: {
      position: "absolute",
      top: -8,
      right: -8,
      borderRadius: 12,
      minWidth: 24,
      height: 24,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 6,
    },
    badgeText: {
      color: "#fff",
      fontSize: 11,
      fontWeight: "700",
    },
    navCardText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
  });
