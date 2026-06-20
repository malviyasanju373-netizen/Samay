import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

export type Todo = {
  id: string;
  title: string;
  subjectId: string | null;
  completed: boolean;
  completedAt: FirebaseFirestoreTypes.Timestamp | null;
  plannedDurationMinutes: number;
  plannedStartTime: FirebaseFirestoreTypes.Timestamp | null;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
};
