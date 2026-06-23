import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

export type Todo = {
  id: string;
  title: string;
  subjectId: string | null;
  completed: boolean;
  completedAt: FirebaseFirestoreTypes.Timestamp | null;
  plannedDurationMinutes: number;
  actualFocusSeconds: number;
  plannedStartTime: FirebaseFirestoreTypes.Timestamp | null;
  plannedDate?: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
};
