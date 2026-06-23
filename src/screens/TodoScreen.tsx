import React, { useState, useCallback, useRef } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/context/ThemeContext";
import { useTodos } from "@/hooks/useTodos";
import { addTodo, toggleTodo, deleteTodo } from "@/services/todos";
import { Todo } from "@/types/todo";
import { CATEGORIES } from "@/types/session";
import { formatStudyTime } from "@/utils/timeFormat";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = -80;
const DELETE_BUTTON_WIDTH = 80;

type TodoItemProps = {
  todo: Todo;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onStartFocus: (todo: Todo) => void;
};

const TodoItem = React.memo(function TodoItem({ todo, onToggle, onDelete, onStartFocus }: TodoItemProps) {
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

  return (
    <View style={[s.todoItemContainer, { height: showProgress ? 92 : 72 }]}>
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
        <TouchableOpacity
          onPress={() => onToggle(todo.id, !todo.completed)}
          style={s.checkboxContainer}
          activeOpacity={0.7}
        >
          <View style={[s.checkbox, todo.completed && s.checkboxChecked]}>
            {todo.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
        </TouchableOpacity>

        <View style={s.todoContent}>
          <Text
            style={[s.todoTitle, todo.completed && s.todoTitleCompleted]}
            numberOfLines={1}
          >
            {todo.title}
          </Text>
          {todo.completed ? (
            <View style={s.progressRow}>
              <View style={s.progressBarBg}>
                <View style={[s.progressBarFill, { width: "100%", backgroundColor: theme.colors.primary }]} />
              </View>
              <Text style={s.progressText}>100%</Text>
            </View>
          ) : showProgress ? (
            <View style={s.progressRow}>
              <View style={s.progressBarBg}>
                <View style={[s.progressBarFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: theme.colors.primary }]} />
              </View>
              <Text style={s.progressText}>{focusDisplay} / {plannedDisplay}</Text>
            </View>
          ) : formatDuration(todo.plannedDurationMinutes) ? (
            <View style={s.durationRow}>
              <Ionicons name="time-outline" size={12} color={theme.colors.textTertiary} />
              <Text style={s.durationText}>
                {formatDuration(todo.plannedDurationMinutes)}
              </Text>
            </View>
          ) : null}
        </View>

        {!todo.completed && (
          <TouchableOpacity
            onPress={() => onStartFocus(todo)}
            style={s.startFocusBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="play" size={14} color={theme.colors.primary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={handleDelete} style={s.deleteIconBtn}>
          <Ionicons name="trash-outline" size={18} color={theme.colors.textTertiary} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});

export default function TodoScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  const { todos, loading, error } = useTodos();

  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openAddModal = useCallback(() => {
    setTitle("");
    setDuration("");
    setModalVisible(true);
  }, []);

  const handleCreate = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const minutes = duration.trim() === "" ? 0 : Math.max(0, parseInt(duration.trim(), 10) || 0);

    setSubmitting(true);
    try {
      await addTodo(trimmed, null, minutes, null);
      setModalVisible(false);
      setTitle("");
      setDuration("");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not create todo.");
    } finally {
      setSubmitting(false);
    }
  }, [title, duration]);

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

  const handleStartFocus = useCallback((todo: Todo) => {
    navigation.navigate("Tabs", {
      screen: "Timer",
      params: {
        todoId: todo.id,
        subjectId: todo.subjectId,
        plannedDurationMinutes: todo.plannedDurationMinutes,
        title: todo.title,
      },
    });
  }, [navigation]);

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

      {todos.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="checkmark-done-circle-outline" size={64} color={theme.colors.textTertiary} />
          <Text style={s.emptyTitle}>No Todos Yet</Text>
          <Text style={s.emptySubtitle}>Tap + to create your first todo</Text>
        </View>
      ) : (
        <FlatList
          data={todos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TodoItem
              todo={item}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onStartFocus={handleStartFocus}
            />
          )}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add Todo Modal */}
      {modalVisible && (
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Todo</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

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

            <TouchableOpacity
              onPress={handleCreate}
              disabled={submitting || !title.trim()}
              style={[s.createBtn, (!title.trim() || submitting) && s.createBtnDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.createBtnText}>Create Todo</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
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
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    todoItemContainer: {
      justifyContent: "center",
      marginBottom: 8,
    },
    deleteButton: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: theme.colors.error,
      borderRadius: 12,
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
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      height: 72,
      gap: 12,
    },
    checkboxContainer: {
      padding: 4,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
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
    todoContent: {
      flex: 1,
      justifyContent: "center",
      gap: 4,
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
    progressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    progressBarBg: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.border,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      borderRadius: 3,
    },
    progressText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      minWidth: 60,
      textAlign: "right",
    },
    durationRow: {
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
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.primary + "15",
      alignItems: "center",
      justifyContent: "center",
    },
    deleteIconBtn: {
      padding: 8,
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
    createBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: 14,
      padding: 16,
      alignItems: "center",
      marginTop: 4,
    },
    createBtnDisabled: {
      opacity: 0.5,
    },
    createBtnText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },
  });
}