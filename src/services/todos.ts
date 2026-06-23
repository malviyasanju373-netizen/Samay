import firestore from "@react-native-firebase/firestore";
import { requireFirestore } from "@/firebase";
import { Todo } from "@/types/todo";
import auth from "@react-native-firebase/auth";
import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

const TODOS_COLLECTION = "todos";

function getUid(): string {
  const uid = auth().currentUser?.uid;
  if (!uid) throw new Error("User must be authenticated to access todos");
  return uid;
}

function getTodosRef(uid: string) {
  return requireFirestore().collection("users").doc(uid).collection(TODOS_COLLECTION);
}

export async function addTodo(
  title: string,
  subjectId: string | null = null,
  plannedDurationMinutes: number = 0,
  plannedStartTime: FirebaseFirestoreTypes.Timestamp | null = null,
  plannedDate?: string
): Promise<string> {
  const uid = getUid();
  const db = requireFirestore();

  try {
    const ref = getTodosRef(uid).doc();
    await ref.set({
      title,
      subjectId,
      completed: false,
      actualFocusSeconds: 0,
      plannedDurationMinutes,
      plannedStartTime,
      plannedDate,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  } catch (err: any) {
    console.error("[todos] addTodo failed:", err?.message, err?.code);
    throw err;
  }
}

export async function updateTodo(todoId: string, updates: Partial<Omit<Todo, "id" | "createdAt">>): Promise<void> {
  const uid = getUid();
  const db = requireFirestore();

  try {
    const data: Record<string, any> = { ...updates, updatedAt: firestore.FieldValue.serverTimestamp() };
    await getTodosRef(uid).doc(todoId).update(data);
  } catch (err: any) {
    console.error("[todos] updateTodo failed:", err?.message, err?.code);
    throw err;
  }
}

export async function deleteTodo(todoId: string): Promise<void> {
  const uid = getUid();
  const db = requireFirestore();

  try {
    await getTodosRef(uid).doc(todoId).delete();
  } catch (err: any) {
    console.error("[todos] deleteTodo failed:", err?.message, err?.code);
    throw err;
  }
}

const COMPLETION_THRESHOLD = 0.8; // 80%

export async function addFocusSeconds(todoId: string, sessionDurationSeconds: number): Promise<void> {
  const uid = getUid();
  const db = requireFirestore();
  const todoRef = getTodosRef(uid).doc(todoId);

  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(todoRef);
      if (!doc.exists) {
        console.warn("[todos] addFocusSeconds: todo not found", todoId);
        return;
      }

      const data = doc.data()!;
      const currentActual = typeof data.actualFocusSeconds === "number" ? data.actualFocusSeconds : 0;
      const newActual = currentActual + sessionDurationSeconds;
      const plannedMinutes = data.plannedDurationMinutes || 0;
      const plannedSeconds = plannedMinutes * 60;

      const updates: Record<string, any> = {
        actualFocusSeconds: newActual,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      // Auto-complete if cumulative focus >= 80% of planned duration (in seconds)
      if (plannedSeconds > 0 && newActual >= plannedSeconds * COMPLETION_THRESHOLD && !data.completed) {
        updates.completed = true;
        updates.completedAt = firestore.FieldValue.serverTimestamp();
        console.log("[todos] addFocusSeconds: todo auto-completed at", newActual, "of", plannedSeconds, "seconds");
      }

      transaction.update(todoRef, updates);
    });
  } catch (err: any) {
    console.error("[todos] addFocusSeconds failed:", err?.message, err?.code);
    throw err;
  }
}

export async function toggleTodo(todoId: string, completed: boolean): Promise<void> {
  const uid = getUid();
  const db = requireFirestore();

  try {
    await getTodosRef(uid).doc(todoId).update({
      completed,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  } catch (err: any) {
    console.error("[todos] toggleTodo failed:", err?.message, err?.code);
    throw err;
  }
}

export function subscribeTodos(
  callback: (todos: Todo[]) => void,
  onError?: (error: Error) => void
): (() => void) | null {
  try {
    const uid = getUid();
    console.log("[todos] Subscribing to todos for uid:", uid);

    const unsubscribe = getTodosRef(uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(
        (snapshot) => {
          const todos = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Todo[];

          console.log("[todos] Snapshot received:", todos.length, "todos");
          callback(todos);
        },
        (error: any) => {
          console.error("[todos] Firestore subscription error:", error?.code, error?.message);
          onError?.(error as Error);
        }
      );

    return unsubscribe;
  } catch (err: any) {
    console.error("[todos] subscribeTodos failed:", err?.message);
    onError?.(err as Error);
    return null;
  }
}

/**
 * Temporary test function - service level only, no UI
 * Creates a test todo: "Test Todo"
 */
export async function testCreateTodo(): Promise<string> {
  const todoId = await addTodo("Test Todo");
  console.log("[todos] Test todo created with id:", todoId);
  return todoId;
}