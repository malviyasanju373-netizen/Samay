import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Modal, Pressable, TextInput, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/context/ThemeContext";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import { CATEGORIES } from "@/types/session";
import { updateTodo } from "@/services/todos";
import firestore from "@react-native-firebase/firestore";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 240;
const STROKE_W = 14;
const RADIUS = (RING_SIZE - STROKE_W) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const TARGETS = [
  { label: "25m", minutes: 25 },
  { label: "45m", minutes: 45 },
  { label: "1h",  minutes: 60 },
  { label: "2h",  minutes: 120 },
  { label: "Free", minutes: null },
];

function pad(n: number) { return String(n).padStart(2, "0"); }

export default function TimerScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { timerState, minutes, seconds, progress, activeSession, error, clearError, start, pause, resume, stop, cancel, reset } = useFocusTimer();
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
  const [completedMinutes, setCompletedMinutes] = useState(0);
  const [busy, setBusy] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
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
      setCompletedMinutes(done);
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
    setCompletedMinutes(0);
    setShowCompletionModal(false);
    setBusy(false);
  };

  const handleDone = async () => {
    console.log("[TIMER RESET]");
    if (todoId) {
      try {
        await updateTodo(todoId, {
          completed: true,
          completedAt: firestore.FieldValue.serverTimestamp() as any,
        });
      } catch (err) {
        console.error("[TimerScreen] Failed to update todo on completion:", err);
      }
    }
    await reset();
    setSelectedCategoryId("other");
    setSelectedTarget(25);
    setCustomTitle("");
    setShowStartModal(false);
    setShowCompletionModal(false);
    setCompletedMinutes(0);
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Ring */}
        <View style={s.ringWrapper}>
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
              <>
                <Text style={s.readyText}>Ready</Text>
                <View style={[s.categoryDot, { backgroundColor: selectedCat.color + "20" }]}>
                  <Ionicons name={selectedCat.icon as any} size={22} color={selectedCat.color} />
                </View>
              </>
            ) : (
              <>
                <Text style={[s.timerText, { color: ringColor }]}>
                  {pad(minutes)}:{pad(seconds)}
                </Text>
                <Text style={s.timerCategory}>{activeSession?.title ?? selectedCat.label}</Text>
                {selectedTarget && (
                  <Text style={s.timerTarget}>{selectedTarget}m goal</Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* Controls */}
        <View style={s.controls}>
          {isIdle && (
            <TouchableOpacity onPress={handleStartPress} disabled={busy} style={[s.mainBtn, { backgroundColor: theme.colors.primary }, busy && s.disabled]} activeOpacity={0.85}>
              {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="play" size={28} color="#fff" />}
            </TouchableOpacity>
          )}
          {isRunning && (
            <>
              <TouchableOpacity onPress={handlePause} style={[s.mainBtn, { backgroundColor: theme.colors.timerPaused }]} activeOpacity={0.85}>
                <Ionicons name="pause" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleStop} disabled={busy} style={[s.stopBtn, busy && s.disabled]} activeOpacity={0.85}>
                {busy ? <ActivityIndicator color={theme.colors.error} /> : <Ionicons name="stop" size={22} color={theme.colors.error} />}
              </TouchableOpacity>
            </>
          )}
          {isPaused && (
            <>
              <TouchableOpacity onPress={handleResume} style={[s.mainBtn, { backgroundColor: theme.colors.timerActive }]} activeOpacity={0.85}>
                <Ionicons name="play" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleTrash} disabled={busy} style={[s.stopBtn, busy && s.disabled]} activeOpacity={0.85}>
                <Ionicons name="trash-outline" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </>
          )}
        </View>
        {error ? <Text style={s.errorText}>{error}</Text> : null}

        {/* Category selector (only when idle) */}
        {isIdle && (
          <>
            <Text style={s.sectionLabel}>SUBJECT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategoryId(cat.id)}
                  style={[s.catChip, selectedCategoryId === cat.id && { backgroundColor: cat.color + "22", borderColor: cat.color }]}
                  activeOpacity={0.8}
                >
                  <Ionicons name={cat.icon as any} size={16} color={selectedCategoryId === cat.id ? cat.color : theme.colors.textSecondary} />
                  <Text style={[s.catLabel, selectedCategoryId === cat.id && { color: cat.color, fontWeight: "700" }]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[s.sectionLabel, { marginTop: 20 }]}>GOAL</Text>
            <View style={s.targetRow}>
              {TARGETS.map((t) => (
                <TouchableOpacity
                  key={t.label}
                  onPress={() => setSelectedTarget(t.minutes)}
                  style={[s.targetChip, selectedTarget === t.minutes && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
                  activeOpacity={0.8}
                >
                  <Text style={[s.targetLabel, selectedTarget === t.minutes && { color: "#fff", fontWeight: "700" }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

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
              {Math.floor(completedMinutes / 60) > 0
                ? `${Math.floor(completedMinutes / 60)}h ${completedMinutes % 60}m`
                : `${completedMinutes}m`}
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
    scroll: { alignItems: "center", paddingHorizontal: 16, paddingTop: 24 },
    ringWrapper: { position: "relative", alignItems: "center", justifyContent: "center", marginBottom: 32 },
    ringCenter: { position: "absolute", alignItems: "center" },
    readyText: { fontSize: 22, fontWeight: "700", color: theme.colors.textSecondary },
    categoryDot: { marginTop: 10, width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
    timerText: { fontSize: 56, fontWeight: "900", letterSpacing: -2 },
    timerCategory: { fontSize: 14, fontWeight: "600", color: theme.colors.textSecondary, marginTop: -4 },
    timerTarget: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
    controls: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 32 },
    disabled: { opacity: 0.6 },
    errorText: { color: theme.colors.error, fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: -18, marginBottom: 20 },
    mainBtn: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
    stopBtn: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: theme.colors.border },
    sectionLabel: { alignSelf: "flex-start", fontSize: 10, fontWeight: "700", color: theme.colors.textTertiary, letterSpacing: 1.2, marginBottom: 10 },
    catChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22, borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
    catLabel: { fontSize: 13, fontWeight: "500", color: theme.colors.textSecondary },
    targetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignSelf: "stretch" },
    targetChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
    targetLabel: { fontSize: 13, fontWeight: "600", color: theme.colors.textSecondary },
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
