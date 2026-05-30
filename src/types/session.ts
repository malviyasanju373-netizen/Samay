import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

export type SessionCategory = {
  id: string;
  label: string;
  icon: string;
  color: string;
};

export const CATEGORIES: SessionCategory[] = [
  { id: "upsc",    label: "UPSC",    icon: "shield",          color: "#38BDF8" },
  { id: "jee",     label: "JEE",     icon: "flask",           color: "#A78BFA" },
  { id: "neet",    label: "NEET",    icon: "medkit",          color: "#F472B6" },
  { id: "ca",      label: "CA",      icon: "calculator",      color: "#FBBF24" },
  { id: "ssc",     label: "SSC",     icon: "document-text",   color: "#2DD4BF" },
  { id: "work",    label: "Work",    icon: "briefcase",       color: "#60A5FA" },
  { id: "coding",  label: "Coding",  icon: "code-slash",      color: "#34D399" },
  { id: "reading", label: "Reading", icon: "book",            color: "#F97316" },
  { id: "other",   label: "Other",   icon: "ellipsis-horizontal", color: "#9CA3AF" },
];

export type FocusSession = {
  id: string;
  uid: string;
  categoryId: string;
  title: string;
  startTime: FirebaseFirestoreTypes.Timestamp;
  endTime: FirebaseFirestoreTypes.Timestamp | null;
  durationMinutes: number;
  targetMinutes: number | null;
  isCompleted: boolean;
};
