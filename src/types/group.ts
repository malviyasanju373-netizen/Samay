import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

export type Group = {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  adminId?: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  memberCount: number;
  maxMembers: number;
  attendancePercentage?: number;
  totalStudyTime?: number;
  totalStudyTimeSeconds?: number;
  camStudyHours?: number;
  isPrivate?: boolean;
};

export type GroupMember = {
  uid: string;
  role?: "owner" | "admin" | "member";
  name: string;
  displayName?: string;
  studyTime: number;
  totalFocusMinutes: number;
  totalFocusSeconds?: number;
  attendance: number;
  isOnline: boolean;
  joinedAt: FirebaseFirestoreTypes.Timestamp;
  email?: string;
  photoURL?: string;
  isStudying?: boolean;
  lastActiveAtMs?: number;
  lastSeenAtMs?: number;
  currentSessionSubject?: string | null;
  currentSessionId?: string | null;
};

export type GroupLeaderboardEntry = GroupMember & {
  rank: number;
};

export type ActiveSession = {
  userId: string;
  userName: string;
  isRunning: boolean;
  startedAt: FirebaseFirestoreTypes.Timestamp;
  totalSeconds: number;
};
