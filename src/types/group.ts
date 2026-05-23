import { Timestamp } from "firebase/firestore";

export type Group = {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  adminId?: string;
  createdAt: Timestamp;
  memberCount: number;
  maxMembers: number;
  attendancePercentage?: number;
  totalStudyTime?: number;
  camStudyHours?: number;
};

export type GroupMember = {
  uid: string;
  name: string;
  displayName?: string;
  studyTime: number;
  totalFocusMinutes: number;
  attendance: number;
  isOnline: boolean;
  joinedAt: Timestamp;
  email?: string;
  photoURL?: string;
  isStudying?: boolean;
  lastActiveAtMs?: number;
  currentSessionSubject?: string | null;
  currentSessionId?: string | null;
};

export type GroupLeaderboardEntry = GroupMember & {
  rank: number;
};
