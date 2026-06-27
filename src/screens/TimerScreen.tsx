import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Modal, Pressable, TextInput, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/context/ThemeContext";
import { useFocusTimerContext } from "@/context/FocusTimerContext";
import { CATEGORIES } from "@/types/session";
import { addFocusSeconds } from "@/services/todos";
import firestore from "@react-native-firebase/firestore";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 230;
const STROKE_W = 12;
const RADIUS = (RING_SIZE - STROKE_W) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const TARGETS = [
  { label: "25m", minutes: 25 },
  { label: "45m", minutes: 45 },
  { label: "1h",  minutes: 60 },
  { label: "2h",  minutes: 120 },
  { label: "Free", minutes: null },
];

function formatTimer(totalMinutes: number, totalSeconds: number) {
  const secs = totalMinutes * 60 + totalSeconds;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TimerScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { timerState, minutes, seconds, progress, activeSession, error, clearError, start, pause, resume, stop, cancel, reset, dnd } = useFocusTimerContext();
  const s = createStyles(theme);
  console.log("[TIMER PARAMS]", JSON.stringify(route?.params));
  const routeParams = route?.params ?? {};
  const groupStudyId = routeParams.groupId ?? routeParams.params?.groupId;
  const todoId = routeParams.todoId ?? null;

  const initialCategoryId = routeParams.subjectId ?? routeParams.categoryId ?? "other";
  const initialTarget = routeParams.plannedDurationMinutes && routeParams.plannedDurationMinutes > 0
    ? routeParams.plannedDurationMinutes
    : 25;

  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(initialTarget);
  const [showStartModal, setShowStartModal] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedSeconds, setCompletedSeconds] = useState(0);
  const [busy, setBusy] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const breathAnim = useRef(new Animated.Value(1)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Gentle breathing for idle state
  useEffect(() => {
    if (timerState === "idle") {
      const breathing = Animated.loop(
        Animated.sequence([
          Animated.timing(breathAnim, {
            toValue: 0.98,
            duration: 3000,
            useNativeDriver: false,
          }),
          Animated.timing(breathAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: false,
          }),
        ])
      );
      breathing.start();
      return () => breathing.stop();
    } else {
      breathAnim.setValue(1);
    }
  }, [timerState]);

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  const breathScale = breathAnim.interpolate({
    inputRange: [0.98, 1],
    outputRange: [0.995, 1],
  });

  const isIdle    = timerState === "idle";
  const isRunning = timerState === "running";
  const isPaused  = timerState === "paused";

  const selectedCat = CATEGORIES.find((c) => c.id === selectedCategoryId) ?? CATEGORIES[CATEGORIES.length - 1];

  const ringColor = isRunning
    ? theme.colors.timerActive
    : isPaused
    ? theme.colors.timerPaused
    : theme.colors.timerRing;

  const handlePressIn = () => {
    Animated.spring(pressAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  const handleStartPress = () => {
    if (!isIdle) return;
    console.log("[PLAY PRESSED]");
    clearError();
    setCustomTitle(selectedCat.label);
    setShowStartModal(true);
  };

  const handleConfirmStart = async () => {
    if (busy) return;
    setBusy(true);
    setShowStartModal(false);
    console.log("[START GROUP ID]", groupStudyId);
    await start(selectedCategoryId, customTitle.trim() || selectedCat.label, selectedTarget, groupStudyId);
    setBusy(false);
  };

  const handleStop = async () => {
    if (busy) return;
    setBusy(true);

    const done = await stop();

    if (typeof done === "number" && done > 0) {
      setCompletedSeconds(done);
      setShowCompletionModal(true);
    }
    
    setBusy(false);
  };

  const handlePause = () => {
    console.log("[PAUSE PRESSED]");
    pause();
  };

  const handleResume = () => {
    console.log("[PLAY PRESSED]");
    resume();
  };

  const handleTrash = async () => {
    if (busy) return;
    setBusy(true);
    console.log("[TRASH PRESSED]");
    await cancel();
    setCompletedSeconds(0);
    setShowCompletionModal(false);
    setBusy(false);
  };

  const handleDone = async () => {
    console.log("[TIMER RESET]");
    if (todoId && completedSeconds > 0) {
      try {
        await addFocusSeconds(todoId, completedSeconds);
        console.log("[TODO FLOW] addFocusSeconds called for todo", todoId, "with", completedSeconds, "seconds");
      } catch (err) {
        console.error("[TimerScreen] Failed to add focus seconds to todo:", err);
      }
    }
    await reset();
    setSelectedCategoryId("other");
    setSelectedTarget(25);
    setCustomTitle("");
    setShowStartModal(false);
    setShowCompletionModal(false);
    setCompletedSeconds(0);
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* DND Indicator */}
        {!isIdle && dnd.active && (
          <View style={s.dndPill}>
            <Ionicons name="moon-outline" size={14} color={theme.colors.textTertiary} />
            <Text style={s.dndPillText}>DND Active</Text>
          </View>
        )}

        {/* Timer Ring */}
        <View style={s.ringContainer}>
          <Animated.View style={[s.ringWrapper, isIdle && { transform: [{ scale: breathScale }] }]}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              {/* Background track */}
              <Circle
                cx={RING_SIZE / 2} cy={RING_SIZE / 2}
                r={RADIUS}
                stroke={theme.colors.timerRingBg}
                strokeWidth={STROKE_W}
                fill="none"
              />
              {/* Progress arc */}
              <AnimatedCircle
                cx={RING_SIZE / 2} cy={RING_SIZE / 2}
                r={RADIUS}
                stroke={ringColor}
                strokeWidth={STROKE_W}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                strokeDashoffset={strokeDashoffset}
                rotation="-90"
                origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
              />
            </Svg>

            {/* Center display */}
            <View style={s.ringCenter}>
              {isIdle ? (
                <Text style={s.readyText}>Ready to focus?</Text>
              ) : (
                <Text style={[s.timerText, { color: ringColor }]}>
                  {formatTimer(minutes, seconds)}
                </Text>
              )}
            </View>
          </Animated.View>
        </View>

        {/* Subject display (running/paused) */}
        {!isIdle && (
          <Text style={s.activeSubject}>{activeSession?.title ?? selectedCat.label}</Text>
        )}

        {/* Controls */}
        {isIdle && (
          <TouchableOpacity
            onPress={handleStartPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={busy}
            style={[s.startBtn, { backgroundColor: theme.colors.primary }, busy && s.disabled]}
            activeOpacity={0.9}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="play" size={24} color="#fff" />}
            <Text style={s.startBtnText}>Start Focus</Text>
          </TouchableOpacity>
        )}

        {isRunning && (
          <View style={s.controlRow}>
            <TouchableOpacity
              onPress={handlePause}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={[s.controlBtn, { backgroundColor: theme.colors.timerPaused }]}
              activeOpacity={0.9}
            >
              <Ionicons name="pause" size={20} color="#fff" />
              <Text style={s.controlBtnText}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleStop}
              disabled={busy}
              style={[s.controlBtnSecondary, busy && s.disabled]}
              activeOpacity={0.9}
            >
              {busy ? <ActivityIndicator color={theme.colors.error} /> : <Ionicons name="stop" size={20} color={theme.colors.error} />}
              <Text style={s.controlBtnSecondaryText}>Stop</Text>
            </TouchableOpacity>
          </View>
        )}

        {isPaused && (
          <View style={s.controlRow}>
            <TouchableOpacity
              onPress={handleResume}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={[s.controlBtn, { backgroundColor: theme.colors.timerActive }]}
              activeOpacity={0.9}
            >
              <Ionicons name="play" size={20} color="#fff" />
              <Text style={s.controlBtnText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleTrash}
              disabled={busy}
              style={[s.controlBtnSecondary, busy && s.disabled]}
              activeOpacity={0.9}
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.textSecondary} />
              <Text style={s.controlBtnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {error ? <Text style={s.errorText}>{error}</Text> : null}

        {/* Category selector (only when idle) */}
        {isIdle && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Subject</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setSelectedCategoryId(cat.id)}
                    style={[s.chip, isSelected && { backgroundColor: theme.colors.primary + "20", borderColor: theme.colors.primary }]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={16}
                      color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    <Text style={[s.chipText, isSelected && { color: theme.colors.primary }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[s.sectionLabel, { marginTop: 24 }]}>Goal</Text>
            <View style={s.goalRow}>
              {TARGETS.map((t) => {
                const isSelected = selectedTarget === t.minutes;
                return (
                  <TouchableOpacity
                    key={t.label}
                    onPress={() => setSelectedTarget(t.minutes)}
                    style={[s.goalChip, isSelected && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.goalChipText, isSelected && { color: "#fff" }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* DND Permission Modal */}
      <Modal visible={dnd.needsPermissionModal} transparent animationType="fade" onRequestClose={dnd.dismissPermissionModal}>
        <Pressable style={s.backdrop} onPress={dnd.dismissPermissionModal}>
          <Pressable onPress={(e) => e.stopPropagation()} style={[s.modal, { maxWidth: 340 }]}>
            <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 12 }}>🔕</Text>
            <Text style={s.modalTitle}>Allow DND Access</Text>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 20, paddingHorizontal: 8 }}>
              Allow Samay to automatically enable Do Not Disturb during focus sessions.
            </Text>
            <TouchableOpacity onPress={dnd.requestPermission} style={[s.modalBtn, { backgroundColor: theme.colors.primary }]} activeOpacity={0.85}>
              <Ionicons name="settings-outline" size={18} color="#fff" />
              <Text style={s.modalBtnText}>Open Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={dnd.dismissPermissionModal} style={s.modalCancelBtn}>
              <Text style={s.modalCancelText}>Not Now</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Start modal */}
      <Modal visible={showStartModal} transparent animationType="fade" onRequestClose={() => setShowStartModal(false)}>
        <Pressable style={s.backdrop} onPress={() => setShowStartModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={s.modal}>
            <Text style={s.modalTitle}>What are you focusing on?</Text>
            <TextInput
              value={customTitle}
              onChangeText={setCustomTitle}
              style={s.modalInput}
              placeholder={selectedCat.label}
              placeholderTextColor={theme.colors.textTertiary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleConfirmStart}
            />
            <TouchableOpacity onPress={handleConfirmStart} disabled={busy} style={[s.modalBtn, { backgroundColor: theme.colors.primary }, busy && s.disabled]} activeOpacity={0.85}>
              {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="play" size={18} color="#fff" />}
              <Text style={s.modalBtnText}>{busy ? "Starting" : "Start"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowStartModal(false)} style={s.modalCancelBtn}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Completion modal */}
      <Modal visible={showCompletionModal} transparent animationType="fade" onRequestClose={() => setShowCompletionModal(false)}>
        <Pressable style={s.backdrop} onPress={() => setShowCompletionModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={s.modal}>
            <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>✅</Text>
            <Text style={s.modalTitle}>Session Complete!</Text>
            <Text style={s.completionTime}>
              {Math.floor(completedSeconds / 3600) > 0
                ? `${Math.floor(completedSeconds / 3600)}h ${Math.floor((completedSeconds % 3600) / 60)}m`
                : `${Math.ceil(completedSeconds / 60)}m`}
            </Text>
            <Text style={s.completionLabel}>focused</Text>
            <TouchableOpacity onPress={handleDone} style={[s.modalBtn, { backgroundColor: theme.colors.primary, marginTop: 20 }]} activeOpacity={0.85}>
              <Text style={s.modalBtnText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { alignItems: "center", paddingHorizontal: 24, paddingTop: 24 },
    dndPill: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginBottom: 32,
    },
    dndPillText: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.colors.textTertiary,
    },
    ringContainer: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 40,
    },
    ringWrapper: {
      alignItems: "center",
      justifyContent: "center",
    },
    ringCenter: { position: "absolute", alignItems: "center" },
    readyText: { fontSize: 20, fontWeight: "600", color: theme.colors.textTertiary, letterSpacing: -0.3 },
    timerText: { fontSize: 40, fontWeight: "700", color: theme.colors.text, letterSpacing: 1.5, fontVariant: ["tabular-nums"] },
    activeSubject: { fontSize: 15, fontWeight: "500", color: theme.colors.textSecondary, marginBottom: 40, textAlign: "center" },
    startBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 18,
      paddingHorizontal: 32,
      borderRadius: 14,
      minWidth: 200,
    },
    startBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
    controlRow: {
      flexDirection: "row",
      gap: 16,
      alignItems: "center",
    },
    controlBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      minWidth: 120,
    },
    controlBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
    controlBtnSecondary: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      minWidth: 120,
    },
    controlBtnSecondaryText: { fontSize: 15, fontWeight: "600", color: theme.colors.textSecondary },
    disabled: { opacity: 0.5 },
    errorText: { color: theme.colors.error, fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 16 },
    section: { width: "100%", marginTop: 8 },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      marginBottom: 12,
    },
    chipRow: { gap: 10, paddingRight: 20, alignItems: "center" },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    chipText: { fontSize: 13, fontWeight: "500", color: theme.colors.textSecondary },
    goalRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    goalChip: {
      flex: 1,
      minWidth: 60,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
    },
    goalChipText: { fontSize: 13, fontWeight: "600", color: theme.colors.textSecondary },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
    modal: { width: "100%", backgroundColor: theme.colors.surface, borderRadius: 24, padding: 24, alignItems: "center", borderWidth: 1, borderColor: theme.colors.border },
    modalTitle: { fontSize: 17, fontWeight: "700", color: theme.colors.text, marginBottom: 14, textAlign: "center" },
    modalInput: { width: "100%", backgroundColor: theme.colors.background, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: theme.colors.text, marginBottom: 16 },
    modalBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 36, paddingVertical: 13, borderRadius: 24 },
    modalBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
    modalCancelBtn: { marginTop: 10, paddingVertical: 10 },
    modalCancelText: { fontSize: 14, color: theme.colors.textSecondary },
    completionTime: { fontSize: 48, fontWeight: "900", color: theme.colors.primary, letterSpacing: -2 },
    completionLabel: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: "600", marginTop: -4 },
  });
}