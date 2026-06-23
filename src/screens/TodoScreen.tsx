import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Animated,
  PanResponder,
  Dimensions,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/context/ThemeContext";
import { useTodos } from "@/hooks/useTodos";
import { addTodo, toggleTodo, deleteTodo, updateTodo, addFocusSeconds } from "@/services/todos";
import { useFocusTimerContext } from "@/context/FocusTimerContext";
import { Todo } from "@/types/todo";
import { CATEGORIES } from "@/types/session";
import { formatStudyTime } from "@/utils/timeFormat";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = -80;
const DELETE_BUTTON_WIDTH = 80;
const ACTIVE_TODO_KEY = "ACTIVE_TODO_ID";

type FilterMode = "active" | "completed";

type TodoItemProps = {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onStartFocus: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  isActive: boolean;
  timerState: "idle" | "running" | "paused";
  elapsedSeconds: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
};

const TodoItem = React.memo(function TodoItem({
  todo, onToggle, onDelete, onStartFocus, onEdit,
  isActive, timerState, elapsedSeconds, onPause, onResume, onStop,
}: TodoItemProps) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -DELETE_BUTTON_WIDTH));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < SWIPE_THRESHOLD) {
          Animated.spring(translateX, {
            toValue: -DELETE_BUTTON_WIDTH,
            useNativeDriver: true,
          }).start();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleDelete = useCallback(() => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDelete(todo.id);
    });
  }, [todo.id, onDelete, translateX]);

  const formatDuration = (minutes: number) => {
    if (minutes <= 0) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const actualFocusSeconds = todo.actualFocusSeconds || 0;
  const planned = todo.plannedDurationMinutes || 0;
  const plannedSeconds = planned * 60;
  const percent = plannedSeconds > 0 ? Math.min((actualFocusSeconds / plannedSeconds) * 100, 100) : 0;
  const showProgress = planned > 0;
  const focusDisplay = actualFocusSeconds > 0 ? formatStudyTime(actualFocusSeconds) : "0s";
  const plannedDisplay = planned > 0 ? formatStudyTime(plannedSeconds) : "";

  const subject = todo.subjectId ? CATEGORIES.find((c) => c.id === todo.subjectId) : null;

  const timerMinutes = Math.floor(elapsedSeconds / 60);
  const timerSeconds = elapsedSeconds % 60;
  const timerDisplay = `${timerMinutes}m ${timerSeconds.toString().padStart(2, "0")}s`;

  return (
    <View style={s.todoItemContainer}>
      {/* Delete button behind */}
      <View style={[s.deleteButton, { width: DELETE_BUTTON_WIDTH }]}>
        <TouchableOpacity onPress={handleDelete} style={s.deleteButtonInner}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={s.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable content */}
      <Animated.View
        style={[
          s.todoItem,
          { transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Row 1: Checkbox + Title + Edit + Delete */}
        <View style={s.row1}>
          <TouchableOpacity
            onPress={() => onToggle(todo.id, !todo.completed)}
            style={s.checkboxContainer}
            activeOpacity={0.7}
          >
            <View style={[s.checkbox, todo.completed && s.checkboxChecked]}>
              {todo.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
          </TouchableOpacity>

          <View style={s.titleContainer}>
            <Text
              style={[s.todoTitle, todo.completed && s.todoTitleCompleted]}
              numberOfLines={1}
            >
              {todo.title}
            </Text>
            {todo.plannedDate && (
              <View style={s.plannedDateBadge}>
                <Ionicons name="calendar-outline" size={11} color={theme.colors.textTertiary} />
                <Text style={s.plannedDateText}>{formatDateLabel(todo.plannedDate)}</Text>
              </View>
            )}
            {subject && (
              <View style={s.subjectBadge}>
                <View style={[s.subjectDot, { backgroundColor: subject.color }]} />
                <Text style={s.subjectLabel}>{subject.label}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity onPress={() => onEdit(todo)} style={s.editIconBtn}>
            <Ionicons name="pencil" size={16} color={theme.colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDelete} style={s.deleteIconBtn}>
            <Ionicons name="trash-outline" size={16} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Row 2: Progress bar + Progress text + Play/Embedded Timer */}
        <View style={s.row2}>
          {isActive && timerState !== "idle" ? (
            <>
              {/* Embedded Timer Controls */}
              <View style={s.embeddedTimerArea}>
                <Ionicons name="timer" size={14} color={theme.colors.primary} />
                <Text style={s.embeddedTimerText}>{timerDisplay}</Text>
              </View>
              <View style={s.embeddedTimerButtons}>
                {timerState === "running" ? (
                  <>
                    <TouchableOpacity
                      onPress={onPause}
                      style={[s.timerControlBtn, { backgroundColor: theme.colors.warning }]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pause" size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={onStop}
                      style={[s.timerControlBtn, { backgroundColor: theme.colors.error }]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="stop" size={16} color="#fff" />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={onResume}
                      style={[s.timerControlBtn, { backgroundColor: theme.colors.success }]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="play" size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={onStop}
                      style={[s.timerControlBtn, { backgroundColor: theme.colors.error }]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="stop" size={16} color="#fff" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          ) : todo.completed ? (
            <>
              <View style={s.progressBarBg}>
                <View style={[s.progressBarFill, { width: "100%", backgroundColor: theme.colors.primary }]} />
              </View>
              <Text style={s.progressText}>100%</Text>
            </>
          ) : showProgress ? (
            <>
              <View style={s.progressBarBg}>
                <View style={[s.progressBarFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: theme.colors.primary }]} />
              </View>
              <Text style={s.progressText}>{focusDisplay} / {plannedDisplay}</Text>
            </>
          ) : formatDuration(todo.plannedDurationMinutes) ? (
            <View style={s.durationRow}>
              <Ionicons name="time-outline" size={13} color={theme.colors.textTertiary} />
              <Text style={s.durationText}>
                {formatDuration(todo.plannedDurationMinutes)}
              </Text>
            </View>
          ) : (
            <View style={s.durationRow} />
          )}

          {!todo.completed && !isActive && (
            <TouchableOpacity
              onPress={() => onStartFocus(todo)}
              style={s.startFocusBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="play" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </View>
  );
});

export default function TodoScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  const { todos, loading, error } = useTodos();
  const timer = useFocusTimerContext();

  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [plannedDate, setPlannedDate] = useState<string>(getTodayString());
  const [submitting, setSubmitting] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [filter, setFilter] = useState<FilterMode>("active");
  const [activeTodoId, setActiveTodoId] = useState<string | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  // Read preselectedDate from navigation params (e.g. from Calendar)
  const preselectedDate = route?.params?.preselectedDate;

  const isEditing = editingTodo !== null;

  // ------ Active Todo Persistence ------

  // Restore activeTodoId from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(ACTIVE_TODO_KEY).then((stored) => {
      if (stored) {
        setActiveTodoId(stored);
      }
    });
  }, []);

  // Persist activeTodoId to storage whenever it changes
  useEffect(() => {
    if (activeTodoId) {
      AsyncStorage.setItem(ACTIVE_TODO_KEY, activeTodoId);
    } else {
      AsyncStorage.removeItem(ACTIVE_TODO_KEY);
    }
  }, [activeTodoId]);

  // ------
  // Handle timer transitioning from running/paused to idle unexpectedly
  // (e.g. session completed, cancelled, or expired). This is the catch-all.
  const prevTimerStateRef = useRef(timer.timerState);
  useEffect(() => {
    const prev = prevTimerStateRef.current;
    prevTimerStateRef.current = timer.timerState;

    if (prev !== "idle" && timer.timerState === "idle" && activeTodoId) {
      const savedTodoId = activeTodoId;
      const savedSeconds = timer.elapsedSeconds;
      setActiveTodoId(null);
      if (savedSeconds > 0) {
        addFocusSeconds(savedTodoId, savedSeconds).catch((err: any) => {
          console.error("[TodoScreen] Failed to save focus seconds:", err?.message);
        });
      }
    }
  }, [timer.timerState, timer.elapsedSeconds, activeTodoId]);

  // ------ Modal handlers ------

  const openAddModal = useCallback(() => {
    setEditingTodo(null);
    setTitle("");
    setDuration("");
    setSubjectId(null);
    setPlannedDate(preselectedDate || getTodayString());
    setModalVisible(true);
  }, [preselectedDate]);

  const openEditModal = useCallback((todo: Todo) => {
    setEditingTodo(todo);
    setTitle(todo.title);
    setDuration(todo.plannedDurationMinutes > 0 ? String(todo.plannedDurationMinutes) : "");
    setSubjectId(todo.subjectId);
    setPlannedDate(todo.plannedDate || getTodayString());
    setModalVisible(true);
  }, []);

  const handleCreate = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const minutes = duration.trim() === "" ? 0 : Math.max(0, parseInt(duration.trim(), 10) || 0);

    setSubmitting(true);
    try {
      await addTodo(trimmed, subjectId, minutes, null, plannedDate);
      setModalVisible(false);
      setTitle("");
      setDuration("");
      setSubjectId(null);
      setPlannedDate(getTodayString());
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not create todo.");
    } finally {
      setSubmitting(false);
    }
  }, [title, duration, subjectId, plannedDate]);

  const handleUpdate = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || !editingTodo) return;

    const minutes = duration.trim() === "" ? 0 : Math.max(0, parseInt(duration.trim(), 10) || 0);

    setSubmitting(true);
    try {
      await updateTodo(editingTodo.id, {
        title: trimmed,
        subjectId,
        plannedDurationMinutes: minutes,
        plannedDate,
      });
      setModalVisible(false);
      setEditingTodo(null);
      setTitle("");
      setDuration("");
      setSubjectId(null);
      setPlannedDate(getTodayString());
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not update todo.");
    } finally {
      setSubmitting(false);
    }
  }, [title, duration, subjectId, editingTodo, plannedDate]);

  const handleToggle = useCallback((id: string, completed: boolean) => {
    toggleTodo(id, completed).catch((err: any) => {
      Alert.alert("Error", err?.message ?? "Could not update todo.");
    });
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteTodo(id).catch((err: any) => {
      Alert.alert("Error", err?.message ?? "Could not delete todo.");
    });
  }, []);

  // ------ Focus Session Handlers ------

  const saveFocusSeconds = useCallback(async (todoId: string, seconds: number) => {
    if (seconds <= 0) return;
    try {
      await addFocusSeconds(todoId, seconds);
    } catch (err: any) {
      console.error("[TodoScreen] Failed to save focus seconds:", err?.message);
    }
  }, []);

  const handleStartFocus = useCallback(async (todo: Todo) => {
    // If another todo already has an active timer, confirm switching
    if (activeTodoId && activeTodoId !== todo.id && timer.timerState !== "idle") {
      Alert.alert(
        "Switch Focus",
        "A focus session is already active for another task. Switching will stop the current session. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Switch",
            style: "destructive",
            onPress: async () => {
              const prevTodoId = activeTodoId;
              const prevSeconds = timer.elapsedSeconds;
              // Cancel the current session (sets timerState to idle)
              await timer.cancel();
              setActiveTodoId(null);
              // Save seconds from previous session
              await saveFocusSeconds(prevTodoId!, prevSeconds);
              // Start new session
              const started = await timer.start(
                todo.subjectId || "general",
                todo.title,
                todo.plannedDurationMinutes || null,
              );
              if (started) {
                setActiveTodoId(todo.id);
              }
            },
          },
        ]
      );
      return;
    }

    // No active timer for a different todo, start fresh
    const started = await timer.start(
      todo.subjectId || "general",
      todo.title,
      todo.plannedDurationMinutes || null,
    );
    if (started) {
      setActiveTodoId(todo.id);
    }
  }, [activeTodoId, timer, saveFocusSeconds]);

  const handlePause = useCallback(() => {
    timer.pause();
  }, [timer]);

  const handleResume = useCallback(() => {
    timer.resume();
  }, [timer]);

  const handleStop = useCallback(() => {
    Alert.alert(
      "Stop Focus",
      "Are you sure you want to stop this focus session?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop",
          style: "destructive",
          onPress: async () => {
            const todoId = activeTodoId;
            const seconds = timer.elapsedSeconds;
            await timer.stop(); // sets timer state to idle
            // The effect that watches timerState will save focus seconds,
            // but we also save here to be safe (idempotent call)
            if (seconds > 0 && todoId) {
              await saveFocusSeconds(todoId, seconds);
            }
          },
        },
      ]
    );
  }, [activeTodoId, timer, saveFocusSeconds]);

  // ------ Filter & Sort ------

  const filteredAndSortedTodos = useMemo(() => {
    let result = [...todos];

    if (filter === "active") {
      result = result.filter((t) => !t.completed);
      result.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });
    } else {
      result = result.filter((t) => t.completed);
      result.sort((a, b) => {
        const aTime = a.completedAt?.toMillis?.() ?? 0;
        const bTime = b.completedAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });
    }

    return result;
  }, [todos, filter]);

  // ------ Render ------

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Todos</Text>
        </View>
        <View style={s.center}><ActivityIndicator color={theme.colors.primary} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Todos</Text>
        </View>
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={s.errorText}>{error.message}</Text>
          <TouchableOpacity onPress={() => navigation.replace("TodoScreen")} style={s.retryBtn}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Todos</Text>
        <TouchableOpacity onPress={openAddModal} style={s.headerAddBtn}>
          <Ionicons name="add" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter Segmented Control */}
      <View style={s.filterContainer}>
        <TouchableOpacity
          style={[s.filterBtn, filter === "active" && s.filterBtnActive]}
          onPress={() => setFilter("active")}
          activeOpacity={0.7}
        >
          <Text style={[s.filterBtnText, filter === "active" && s.filterBtnTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.filterBtn, filter === "completed" && s.filterBtnActive]}
          onPress={() => setFilter("completed")}
          activeOpacity={0.7}
        >
          <Text style={[s.filterBtnText, filter === "completed" && s.filterBtnTextActive]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      {filteredAndSortedTodos.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="checkmark-done-circle-outline" size={64} color={theme.colors.textTertiary} />
          <Text style={s.emptyTitle}>
            {filter === "active" ? "No Active Todos" : "No Completed Todos"}
          </Text>
          <Text style={s.emptySubtitle}>
            {filter === "active" ? "Tap + to create your first todo" : "Complete some todos to see them here"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredAndSortedTodos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TodoItem
              todo={item}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onStartFocus={handleStartFocus}
              onEdit={openEditModal}
              isActive={activeTodoId === item.id}
              timerState={timer.timerState}
              elapsedSeconds={timer.elapsedSeconds}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
            />
          )}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add/Edit Todo Modal */}
      {modalVisible && (
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{isEditing ? "Edit Todo" : "New Todo"}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Date Picker Modal */}
            <Modal visible={datePickerVisible} transparent animationType="fade" onRequestClose={() => setDatePickerVisible(false)}>
              <TouchableOpacity style={s.datePickerOverlay} activeOpacity={1} onPress={() => setDatePickerVisible(false)}>
                <View style={s.datePickerModal}>
                  <Text style={s.datePickerTitle}>Select Date</Text>
                  <ScrollView style={s.datePickerScroll} contentContainerStyle={s.datePickerContent}>
                    {generateDateOptions().map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => { setPlannedDate(opt.value); setDatePickerVisible(false); }}
                        style={[s.dateOption, plannedDate === opt.value && s.dateOptionSelected]}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.dateOptionText, plannedDate === opt.value && s.dateOptionTextSelected]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity onPress={() => setDatePickerVisible(false)} style={s.datePickerCloseBtn}>
                    <Text style={s.datePickerCloseText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>

            <TextInput
              style={s.input}
              placeholder="What needs to be done?"
              placeholderTextColor={theme.colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />

            <TextInput
              style={s.input}
              placeholder="Planned duration (minutes)"
              placeholderTextColor={theme.colors.textTertiary}
              value={duration}
              onChangeText={setDuration}
              keyboardType="number-pad"
            />

            {/* Planned Date */}
            <Text style={s.sectionLabel}>Planned Date</Text>
            <TouchableOpacity
              onPress={() => setDatePickerVisible(true)}
              style={s.datePickerBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
              <Text style={s.datePickerBtnText}>{formatDateLabel(plannedDate)}</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
            </TouchableOpacity>

            {/* Subject Picker */}
            <Text style={s.sectionLabel}>Subject (optional)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.subjectPicker}
              contentContainerStyle={s.subjectPickerContent}
            >
              <TouchableOpacity
                style={[s.subjectChip, subjectId === null && s.subjectChipSelected]}
                onPress={() => setSubjectId(null)}
                activeOpacity={0.7}
              >
                <Text style={[s.subjectChipText, subjectId === null && s.subjectChipTextSelected]}>
                  None
                </Text>
              </TouchableOpacity>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    s.subjectChip,
                    subjectId === cat.id && s.subjectChipSelected,
                    { borderColor: cat.color },
                  ]}
                  onPress={() => setSubjectId(cat.id)}
                  activeOpacity={0.7}
                >
                  <View style={[s.subjectChipDot, { backgroundColor: cat.color }]} />
                  <Text
                    style={[
                      s.subjectChipText,
                      subjectId === cat.id && s.subjectChipTextSelected,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={isEditing ? handleUpdate : handleCreate}
              disabled={submitting || !title.trim()}
              style={[s.createBtn, (!title.trim() || submitting) && s.createBtnDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.createBtnText}>{isEditing ? "Save Changes" : "Create Todo"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function generateDateOptions(): Array<{ label: string; value: string }> {
  const options: Array<{ label: string; value: string }> = [];
  const today = new Date();

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const value = `${y}-${m}-${day}`;

    let label: string;
    if (i === 0) label = "Today";
    else if (i === 1) label = "Tomorrow";
    else label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

    options.push({ label, value });
  }

  return options;
}

function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "Select date";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (dateStr === getTodayString()) return "Today";
  if (dateStr === `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`) return "Tomorrow";

  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: theme.colors.text,
    },
    headerAddBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterContainer: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 3,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      borderRadius: 10,
    },
    filterBtnActive: {
      backgroundColor: theme.colors.primary,
    },
    filterBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
    filterBtnTextActive: {
      color: "#fff",
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    todoItemContainer: {
      height: 96,
      justifyContent: "center",
      marginBottom: 8,
      overflow: "hidden",
      borderRadius: 14,
    },
    deleteButton: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: theme.colors.error,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    deleteButtonInner: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
    },
    deleteButtonText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2,
    },
    todoItem: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      height: 96,
      gap: 6,
    },
    row1: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    row2: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
    },
    checkboxContainer: {
      padding: 2,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    checkboxChecked: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    titleContainer: {
      flex: 1,
      gap: 2,
    },
    todoTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    todoTitleCompleted: {
      textDecorationLine: "line-through",
      color: theme.colors.textTertiary,
    },
    subjectBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    subjectDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    subjectLabel: {
      fontSize: 11,
      fontWeight: "500",
      color: theme.colors.textSecondary,
    },
    plannedDateBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginTop: 1,
    },
    plannedDateText: {
      fontSize: 11,
      fontWeight: "500",
      color: theme.colors.textTertiary,
    },
    progressBarBg: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.border,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      borderRadius: 4,
    },
    progressText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      minWidth: 70,
      textAlign: "right",
    },
    durationRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    durationText: {
      fontSize: 12,
      color: theme.colors.textTertiary,
      fontWeight: "500",
    },
    startFocusBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    editIconBtn: {
      padding: 6,
    },
    deleteIconBtn: {
      padding: 6,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginTop: 16,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    errorText: {
      fontSize: 14,
      color: theme.colors.error,
      textAlign: "center",
      marginTop: 12,
    },
    retryBtn: {
      marginTop: 16,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: theme.colors.primary,
    },
    retryText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 32,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.text,
    },
    input: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 12,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    subjectPicker: {
      marginBottom: 12,
    },
    subjectPickerContent: {
      gap: 8,
      paddingRight: 8,
    },
    subjectChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    subjectChipSelected: {
      backgroundColor: theme.colors.primary + "20",
      borderColor: theme.colors.primary,
    },
    subjectChipDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    subjectChipText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
    subjectChipTextSelected: {
      color: theme.colors.primary,
    },
    createBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: 14,
      padding: 16,
      alignItems: "center",
      marginTop: 4,
    },
    datePickerBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 12,
    },
    datePickerBtnText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    datePickerOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    datePickerModal: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 20,
      width: "100%",
      maxHeight: "70%",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    datePickerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 12,
      textAlign: "center",
    },
    datePickerScroll: {
      maxHeight: 300,
    },
    datePickerContent: {
      gap: 8,
    },
    dateOption: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    dateOptionSelected: {
      backgroundColor: theme.colors.primary + "20",
      borderColor: theme.colors.primary,
    },
    dateOptionText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
      textAlign: "center",
    },
    dateOptionTextSelected: {
      color: theme.colors.primary,
    },
    datePickerCloseBtn: {
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    datePickerCloseText: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      textAlign: "center",
    },
    createBtnDisabled: {
      opacity: 0.5,
    },
    createBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },
    // Embedded timer styles
    embeddedTimerArea: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    embeddedTimerText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    embeddedTimerButtons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    timerControlBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}