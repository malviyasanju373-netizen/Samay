import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated,
  RefreshControl, LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { subscribeToGroupsList } from "@/services/groups";
import { useTheme } from "@/context/ThemeContext";
import { Group } from "@/types/group";
import { LoadingState, EmptyState, ErrorState } from "@/components/UIStates";
import { formatStudyTime } from "@/utils/timeFormat";

interface EnhancedGroup extends Group {
  rank?: number;
  isPromoted?: boolean;
  categories?: string[];
  attendancePercentage: number;
  totalStudyTime: number;
}

const TAB_CONFIG = [
  { label: "New", sortKey: "createdAt" },
  { label: "Attendance", sortKey: "attendancePercentage" },
  { label: "Studytime", sortKey: "totalStudyTime" },
  { label: "Cam Study", sortKey: "createdAt" }, // sortKey unused for this tab
] as const;

type TabLabel = typeof TAB_CONFIG[number]["label"];

export default function GroupsListScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [groups, setGroups] = useState<EnhancedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabLabel>(TAB_CONFIG[0].label);
  const [tabLayoutVersion, setTabLayoutVersion] = useState(0);
  
  const s = useMemo(() => createStyles(theme), [theme]);

  const animatedValue = useRef(new Animated.Value(0)).current;
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const mountedRef = useRef(true);
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});

  const activeSortKey = useMemo(() => {
    return TAB_CONFIG.find((item) => item.label === activeTab)?.sortKey || "createdAt";
  }, [activeTab]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToGroupsList(activeSortKey, (fetchedGroups) => {
      if (!mountedRef.current) return;
      const enhanced: EnhancedGroup[] = (Array.isArray(fetchedGroups) ? fetchedGroups : []).map(g => ({
        ...g,
        attendancePercentage: g.attendancePercentage ?? 0,
        totalStudyTime: g.totalStudyTime ?? 0,
      }));
      setGroups(enhanced);
      setError(null);
      setLoading(false);
      setRefreshing(false);
    }, (err) => {
      if (!mountedRef.current) return;
      setError(err?.message || "Failed to load groups");
      setLoading(false);
      setRefreshing(false);
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
      animatedValue.stopAnimation();
      animatedWidth.stopAnimation();
      contentOpacity.stopAnimation();
    };
  }, [activeSortKey, animatedValue, animatedWidth, contentOpacity]);

  const handleTabLayout = useCallback((tab: string, event: LayoutChangeEvent) => {
    if (!event?.nativeEvent?.layout) return;
    const { x, width } = event.nativeEvent.layout;
    const current = tabLayouts.current[tab];
    if (current?.x === x && current.width === width) return;
    tabLayouts.current[tab] = { x, width };
    setTabLayoutVersion((version) => version + 1);
  }, []);

  const safeNavigate = useCallback((screen: string, params?: Record<string, unknown>) => {
    navigation?.navigate(screen, params);
  }, [navigation]);

  const onRefresh = useCallback(() => {
    if (!mountedRef.current) return;
    setRefreshing(true);
    setTimeout(() => {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }, 600);
  }, []);

  const handleTabPress = useCallback((tab: TabLabel) => {
    if (tab === "Cam Study") {
      safeNavigate("CamStudyComingSoon");
      return;
    }

    if (activeTab === tab || !mountedRef.current) return;

    Animated.timing(contentOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      if (!mountedRef.current) return;
      setActiveTab(tab);
      
      const layout = tabLayouts.current[tab];
      if (layout) {
        Animated.parallel([
          Animated.spring(animatedValue, {
            toValue: layout.x,
            damping: 15,
            stiffness: 150,
            useNativeDriver: false,
          }),
          Animated.spring(animatedWidth, {
            toValue: layout.width,
            damping: 15,
            stiffness: 150,
            useNativeDriver: false,
          }),
        ]).start();
      }

      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  }, [activeTab, animatedValue, animatedWidth, contentOpacity]);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Study Group</Text>
        </View>
        <LoadingState message="Loading groups..." size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Study Group</Text>
        </View>
        <ErrorState 
          title="Unable to Load Groups"
          message={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
          }}
          retryLabel="Try Again"
          icon="alert-circle-outline"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Study Group</Text>
      </View>

      <View style={s.categoryTabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.categoryTabsContent}
        >
          {TAB_CONFIG.map(({ label }) => (
            <TouchableOpacity
              key={label}
              onLayout={(event) => handleTabLayout(label, event)}
              onPress={() => handleTabPress(label)}
              style={s.categoryTab}
              activeOpacity={0.7}
            >
              <Text style={[s.categoryTabText, activeTab === label && s.activeCategoryTabText]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
          <Animated.View 
            style={[
              s.tabIndicator, 
              { 
                left: animatedValue, 
                width: animatedWidth,
                // transform removed for Fabric compatibility
              }
            ]} 
          />
        </ScrollView>
      </View>

      <View style={s.content}> 
        <ScrollView
          style={s.content}
          contentContainerStyle={s.groupsList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {groups && groups.length === 0 ? (
            <EmptyState 
              title="No Groups Yet"
              subtitle="Create a new study group to get started and connect with other students"
              icon="people-outline"
              actionLabel="Create Group"
              onAction={() => safeNavigate("CreateGroup")}
              actionIcon="add-circle"
            />
          ) : (
            groups ? groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  styles={s}
                  onPress={() => safeNavigate("GroupDetail", { groupId: group.id })}
                />
            )) : null
          )}
        </ScrollView>
      </View>

      <View style={{ position: "absolute", bottom: 30, right: 20 }}>
        <TouchableOpacity
          onPress={() => safeNavigate("CreateGroup")}
          style={{ backgroundColor: theme.colors.primary, borderRadius: 28, width: 56, height: 56, justifyContent: "center", alignItems: "center", elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 }}
          activeOpacity={1}
        >
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const GroupCard = memo(function GroupCard({
  group,
  styles,
  onPress,
}: {
  group: EnhancedGroup;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.groupCard} activeOpacity={0.8}>
      <View style={styles.groupHeader}>
        <View style={styles.groupTitleContainer}>
          <Text style={styles.groupName} numberOfLines={1}>{group.name || "Study Group"}</Text>
        </View>
        <View style={styles.memberBadge}>
          <Ionicons name="people" size={14} color="#FFA500" />
          <Text style={styles.memberCount}>{group.memberCount || 0}</Text>
        </View>
      </View>

      <Text style={styles.groupDesc} numberOfLines={2}>
        {group.description || "No description yet"}
      </Text>

      <View style={styles.groupStats}>
          <View style={styles.groupStatItem}>
            <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
            <Text style={styles.groupStatText}>{group.attendancePercentage ?? 0}%</Text>
          </View>
          <View style={styles.groupStatItem}>
            <Ionicons name="time" size={14} color="#FBBF24" />

            <Text style={styles.groupStatText}>{formatStudyTime((group.totalStudyTime ?? 0) * 3600)}</Text>
          </View>
      </View>
    </TouchableOpacity>
  );
});

function createStyles(theme: any) {
  const { colors, spacing, typography, radius, shadows } = theme;
  
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, backgroundColor: colors.background },
    headerTitle: { fontSize: typography.fontSize["2xl"], fontWeight: typography.fontWeight.bold, color: colors.text, flex: 1 },
    content: { flex: 1, width: '100%' },
    groupsList: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120, gap: spacing.lg },
    groupCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, borderWidth: 1, borderColor: colors.border, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
    groupHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
    groupTitleContainer: { flex: 1 },
    groupName: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.text },
    memberBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm },
    memberCount: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.text },
    groupDesc: { fontSize: typography.fontSize.base, color: colors.textSecondary },
    categoryTabsContainer: { maxHeight: 60, backgroundColor: colors.background },
    categoryTabsContent: { paddingHorizontal: spacing.xl, alignItems: 'center', gap: spacing.sm },
    categoryTab: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    categoryTabText: { color: colors.textSecondary, fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.base },
    activeCategoryTabText: { color: colors.primary },
    tabIndicator: { height: 3, backgroundColor: colors.primary, position: "absolute", bottom: 0, borderRadius: 1.5 },
    floatingCreateButton: { position: "absolute", bottom: 30, right: spacing.xl, backgroundColor: colors.primary, borderRadius: radius.full, width: 56, height: 56, justifyContent: "center", alignItems: "center", elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
    groupStats: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
    groupStatItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    groupStatText: { color: colors.text, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium },
  });
}



