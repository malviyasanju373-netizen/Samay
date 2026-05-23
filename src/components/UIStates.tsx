import React, { memo, useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  RefreshControl,
} from "react-native";

import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/context/ThemeContext";

/* ─────────────── Animated Wrapper ─────────────── */

const FadeInView = memo(function FadeInView({
  children,
  visible = true,
  style,
}: {
  children: React.ReactNode;
  visible?: boolean;
  style?: any;
}) {
  // Animation logic removed for Fabric compatibility
  return (
    <View style={style}>
      {children}
    </View>
  );
});

/* ─────────────── LoadingState ─────────────── */

interface LoadingStateProps {
  message?: string;
  size?: "small" | "medium" | "large";
  color?: string;
  icon?: string;
  fullScreen?: boolean;
}

const LoadingState = memo(function LoadingState({
  message = "Loading…",
  size = "large",
  color,
  icon,
  fullScreen = true,
}: LoadingStateProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, [animatedValue]);

  const spinnerSize = size === "small" ? 18 : size === "medium" ? 28 : 40;

  const containerStyle = fullScreen 
    ? styles.loadingContainer 
    : styles.loadingContainerInline;

  return (
    <View style={[containerStyle, { minHeight: fullScreen ? undefined : 120 }]}>
      <View style={styles.loadingInner}>
        {icon && (
          <Ionicons
            name={icon as never}
            size={size === "small" ? 20 : size === "medium" ? 28 : 40}
            color={color || theme.colors.primary}
            style={styles.loadingIcon}
          />
        )}
        <ActivityIndicator
          color={color || theme.colors.primary}
          size={spinnerSize}
        />
        <Text
          style={[
            styles.loadingText,
            size === "small" && styles.loadingTextSmall,
            { color: theme.colors.text },
          ]}
        >
          {message}
        </Text>
      </View>
    </View>
  );
});

/* ─────────────── EmptyState ─────────────── */

interface EmptyStateProps {
  title: string;
  subtitle: string;
  icon?: string;
  iconColor?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: string;
}

const EmptyState = memo(function EmptyState({
  title,
  subtitle,
  icon = "infinite-outline",
  iconColor,
  actionLabel = "Get Started",
  onAction,
  actionIcon = "arrow-forward",
}: EmptyStateProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <FadeInView>
      <View style={[styles.emptyContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.emptyCard, { backgroundColor: theme.colors.card }]}>
          <View style={[styles.emptyIconWrapper, { backgroundColor: theme.colors.surface }]}>
            <Ionicons
              name={icon as never}
              size={48}
              color={iconColor || theme.colors.textTertiary}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
          {onAction && (
            <TouchableOpacity
              onPress={onAction}
              activeOpacity={0.7}
              style={[styles.emptyActionBtn, { backgroundColor: theme.colors.primary }]}
            >
              <Ionicons name={actionIcon as never} size={16} color="#fff" />
              <Text style={styles.emptyActionText}>{actionLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </FadeInView>
  );
});

/* ─────────────── ErrorState ─────────────── */

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: string;
  showDetails?: boolean;
}

const ErrorState = memo(function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try Again",
  icon = "alert-circle-outline",
  showDetails = false,
}: ErrorStateProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <FadeInView>
      <View style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.errorCard, { backgroundColor: theme.colors.card }]}>
          <View style={[styles.errorIconWrapper, { backgroundColor: theme.colors.surface }]}>
            <Ionicons
              name={icon as never}
              size={44}
              color={theme.colors.error}
            />
          </View>
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>{title}</Text>
          {showDetails && (
            <Text style={[styles.errorMessage, { color: theme.colors.textSecondary }]}>{message}</Text>
          )}
          {!showDetails && (
            <Text style={[styles.errorSubtitle, { color: theme.colors.textSecondary }]}>{message}</Text>
          )}
          {onRetry && (
            <TouchableOpacity
              onPress={onRetry}
              activeOpacity={0.7}
              style={[styles.errorRetryBtn, { backgroundColor: theme.colors.primary }]}
            >
              <Ionicons name="refresh-outline" size={16} color="#fff" />
              <Text style={styles.errorRetryText}>{retryLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </FadeInView>
  );
});

/* ─────────────── SkeletonCard ─────────────── */

interface SkeletonCardProps {
  lines?: number;
  variant?: "group" | "session" | "leaderboard";
  count?: number;
}

const SkeletonCard = memo(function SkeletonCard({
  lines = 3,
  variant = "group",
  count = 1,
}: SkeletonCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderSkeleton = (key: string) => (
    <View style={[styles.skeletonCard, variant === "session" && styles.skeletonSession, variant === "leaderboard" && styles.skeletonLeaderboard]} key={key}>
      <View style={styles.skeletonShimmer}>
        {variant === "group" && (
          <>
            <View style={[styles.skeletonDot, { backgroundColor: theme.colors.primary + "40" }]} />
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonRow}>
              <View style={[styles.skeletonChip, { backgroundColor: theme.colors.textTertiary + "30" }]} />
              <View style={[styles.skeletonChip, { backgroundColor: theme.colors.textTertiary + "20" }]} />
            </View>
          </>
        )}
        {variant === "session" && (
          <>
            <View style={[styles.skeletonDot, { backgroundColor: theme.colors.primary + "30" }]} />
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
          </>
        )}
        {variant === "leaderboard" && (
          <>
            <View style={styles.skeletonRank} />
            <View style={[styles.skeletonDot, { backgroundColor: theme.colors.primary + "25" }]} />
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonLine} />
          </>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: count }).map((_, i) => renderSkeleton(`skeleton-${i}`))}
    </View>
  );
});

/* ─────────────── RefreshWrapper ─────────────── */

interface RefreshWrapperProps {
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const RefreshWrapper = memo(function RefreshWrapper({
  refreshing,
  onRefresh,
  children,
}: RefreshWrapperProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleRefresh = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  return (
    <View style={styles.refreshWrapper}>{children}</View>
  );
});

/* ──────────── createStyles ──────────── */

function createStyles(theme: any) {
  return StyleSheet.create({
    // ── Loading ──
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
    },
    loadingContainerInline: {
      minHeight: 120,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
    },
    loadingInner: {
      alignItems: "center",
      gap: 16,
    },
    loadingIcon: {
      marginBottom: 8,
    },
    loadingText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    loadingTextSmall: {
      fontSize: 12,
    },

    // ── Empty ──
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      paddingHorizontal: 24,
    },
    emptyCard: {
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: 24,
      padding: 40,
      borderWidth: 1,
      borderColor: theme.colors.border,
      width: "100%",
      maxWidth: 400,
    },
    emptyIconWrapper: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.text,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 24,
    },
    emptyActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 14,
    },
    emptyActionText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 15,
    },

    // ── Error ──
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      paddingHorizontal: 24,
    },
    errorCard: {
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: 24,
      padding: 36,
      borderWidth: 1,
      borderColor: theme.colors.border,
      width: "100%",
      maxWidth: 400,
    },
    errorIconWrapper: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.text,
      marginBottom: 8,
    },
    errorMessage: {
      fontSize: 13,
      color: theme.colors.error,
      textAlign: "center",
      lineHeight: 18,
      marginBottom: 16,
    },
    errorSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 20,
    },
    errorRetryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 28,
      paddingVertical: 12,
      borderRadius: 14,
    },
    errorRetryText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 15,
    },

    // ── Skeleton ──
    skeletonContainer: {
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    skeletonCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    skeletonSession: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
    },
    skeletonLeaderboard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
    },
    skeletonShimmer: {
      gap: 10,
    },
    skeletonDot: {
      width: 48,
      height: 48,
      borderRadius: 12,
      flexShrink: 0,
    },
    skeletonLine: {
      height: 14,
      borderRadius: 7,
      backgroundColor: theme.colors.surface,
      width: "100%",
    },
    skeletonLineShort: {
      width: "60%",
    },
    skeletonRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 4,
    },
    skeletonChip: {
      height: 24,
      borderRadius: 12,
      paddingHorizontal: 10,
      width: 80,
    },
    skeletonRank: {
      width: 32,
      flexShrink: 0,
    },

    // ── Refresh ──
    refreshWrapper: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
  });
}

export { FadeInView, LoadingState, EmptyState, ErrorState, SkeletonCard, RefreshWrapper, createStyles };
