import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, FlatList, SafeAreaView
} from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { auth } from "@/firebase";
import { 
  getPendingJoinRequests, 
  approveJoinRequest, 
  rejectJoinRequest,
  getGroupMembers,
} from "@/services/groups";
import { useTheme } from "@/context/ThemeContext";

interface JoinRequest {
  uid: string;
  displayName: string;
  email?: string;
  requestedAt: any;
  status?: string;
}

export default function PendingRequestsScreen({ route, navigation }: any) {
  const groupId = typeof route?.params?.groupId === "string" ? route.params?.groupId : "";
  const groupName = typeof route?.params?.groupName === "string" ? route.params?.groupName : "Study Group";
  
  const { theme } = useTheme();
  const currentUid = auth()?.currentUser?.uid ?? null;
  const currentDisplayName = auth()?.currentUser?.displayName ?? "User";
  
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingUids, setProcessingUids] = useState<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const s = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadRequests = useCallback(async () => {
    if (!groupId) {
      setError("Group not found");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const pendingRequests = await getPendingJoinRequests(groupId);
      if (mountedRef.current) {
        setRequests(pendingRequests as JoinRequest[]);
      }
    } catch (err: any) {
      console.error("[PendingRequests] Error loading requests:", err);
      if (mountedRef.current) {
        setError(err?.message || "Failed to load pending requests");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [groupId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const safeGoBack = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleApprove = useCallback(async (request: JoinRequest) => {
    if (!groupId || !request.uid) return;

    setProcessingUids((prev) => new Set(prev).add(request.uid));

    try {
      await approveJoinRequest(
        groupId,
        request.uid,
        request.displayName,
        undefined
      );

      if (mountedRef.current) {
        // Remove approved request from list
        setRequests((prev) => prev.filter((r) => r.uid !== request.uid));
        Alert.alert("Success", `${request.displayName} has been approved and added to the group`);
      }
    } catch (err: any) {
      console.error("[PendingRequests] Approve error:", err);
      if (mountedRef.current) {
        Alert.alert("Error", err?.message || "Failed to approve request");
      }
    } finally {
      if (mountedRef.current) {
        setProcessingUids((prev) => {
          const next = new Set(prev);
          next.delete(request.uid);
          return next;
        });
      }
    }
  }, [groupId]);

  const handleReject = useCallback(async (request: JoinRequest) => {
    if (!groupId || !request.uid) return;

    Alert.alert("Reject Request", `Reject join request from ${request.displayName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          setProcessingUids((prev) => new Set(prev).add(request.uid));

          try {
            await rejectJoinRequest(groupId, request.uid);

            if (mountedRef.current) {
              // Remove rejected request from list
              setRequests((prev) => prev.filter((r) => r.uid !== request.uid));
              Alert.alert("Success", `Request from ${request.displayName} has been rejected`);
            }
          } catch (err: any) {
            console.error("[PendingRequests] Reject error:", err);
            if (mountedRef.current) {
              Alert.alert("Error", err?.message || "Failed to reject request");
            }
          } finally {
            if (mountedRef.current) {
              setProcessingUids((prev) => {
                const next = new Set(prev);
                next.delete(request.uid);
                return next;
              });
            }
          }
        },
      },
    ]);
  }, [groupId]);

  const formatDate = (timestamp: any): string => {
    try {
      if (!timestamp) return "Unknown date";
      const date = timestamp?.toDate?.() || new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString();
    } catch {
      return "Unknown date";
    }
  };

  const renderRequestCard = ({ item: request }: { item: JoinRequest }) => {
    const isProcessing = processingUids.has(request.uid);

    return (
      <View style={[s.requestCard, { backgroundColor: theme.colors.card }]}>
        <View style={s.requestHeader}>
          <View style={s.userInfo}>
            <Text style={[s.userName, { color: theme.colors.text }]}>
              {request.displayName}
            </Text>
            {request.email && (
              <Text style={[s.userEmail, { color: theme.colors.textSecondary }]}>
                {request.email}
              </Text>
            )}
            <Text style={[s.requestDate, { color: theme.colors.textTertiary }]}>
              Requested {formatDate(request.requestedAt)}
            </Text>
          </View>
        </View>

        <View style={s.actionButtons}>
          <TouchableOpacity
            style={[s.rejectBtn, { borderColor: theme.colors.error }]}
            onPress={() => handleReject(request)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={theme.colors.error} />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={18} color={theme.colors.error} />
                <Text style={[s.rejectBtnText, { color: theme.colors.error }]}>Reject</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.approveBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => handleApprove(request)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={s.approveBtnText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={s.emptyContainer}>
      <Ionicons name="checkmark-done-outline" size={48} color={theme.colors.textTertiary} />
      <Text style={[s.emptyTitle, { color: theme.colors.text }]}>No pending requests</Text>
      <Text style={[s.emptyMessage, { color: theme.colors.textSecondary }]}>
        All join requests have been reviewed
      </Text>
    </View>
  );

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
        <View style={s.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
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
        <View style={s.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={[s.errorTitle, { color: theme.colors.error }]}>Error</Text>
          <Text style={[s.errorMessage, { color: theme.colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity
            style={[s.retryBtn, { backgroundColor: theme.colors.primary }]}
            onPress={loadRequests}
          >
            <Text style={s.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={safeGoBack} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={s.headerTitleContainer}>
          <Text style={s.headerTitle} numberOfLines={1}>
            Pending Requests
          </Text>
          <Text style={[s.groupNameSubtitle, { color: theme.colors.textSecondary }]}>
            {groupName}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.uid}
        renderItem={renderRequestCard}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={renderEmptyState}
        scrollEnabled={true}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backBtn: {
      width: 44,
      height: 44,
      justifyContent: "center",
    },
    headerTitleContainer: {
      flex: 1,
      paddingHorizontal: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    groupNameSubtitle: {
      fontSize: 12,
      marginTop: 2,
    },
    listContent: {
      padding: 16,
      paddingBottom: 32,
      flexGrow: 1,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      marginTop: 16,
    },
    emptyMessage: {
      fontSize: 14,
      marginTop: 8,
      textAlign: "center",
    },
    loaderContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    errorTitle: {
      fontSize: 16,
      fontWeight: "700",
      marginTop: 16,
    },
    errorMessage: {
      fontSize: 14,
      marginTop: 8,
      textAlign: "center",
    },
    retryBtn: {
      marginTop: 24,
      paddingVertical: 12,
      paddingHorizontal: 32,
      borderRadius: 8,
    },
    retryBtnText: {
      color: "#fff",
      fontWeight: "600",
      fontSize: 14,
      textAlign: "center",
    },
    requestCard: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    requestHeader: {
      marginBottom: 16,
    },
    userInfo: {
      gap: 4,
    },
    userName: {
      fontSize: 16,
      fontWeight: "700",
    },
    userEmail: {
      fontSize: 13,
      fontWeight: "500",
    },
    requestDate: {
      fontSize: 12,
      fontStyle: "italic",
    },
    actionButtons: {
      flexDirection: "row",
      gap: 12,
    },
    rejectBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1.5,
      gap: 6,
    },
    rejectBtnText: {
      fontWeight: "600",
      fontSize: 13,
    },
    approveBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: 8,
      gap: 6,
    },
    approveBtnText: {
      color: "#fff",
      fontWeight: "600",
      fontSize: 13,
    },
  });
