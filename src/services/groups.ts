import {
  collection, doc, getDoc, getDocs, updateDoc,
  serverTimestamp, increment, onSnapshot, Unsubscribe, writeBatch, query, orderBy, Timestamp,
  addDoc,
} from "firebase/firestore";
import { auth, requireFirestore } from "@/firebase";
import { Group, GroupMember, GroupLeaderboardEntry } from "@/types/group";

/**
 * Firestore Schema:
 * groups/{groupId}
 *   name, description, createdBy, createdAt, memberCount, maxMembers, attendancePercentage, totalStudyTime
 * 
 * groups/{groupId}/members/{uid}
 *   uid, name, displayName, studyTime, attendance, isOnline, joinedAt, photoURL, totalFocusMinutes
 */

const GROUPS_CACHE_TTL_MS = 30 * 1000;
let groupsListCache: { fetchedAt: number; groups: Group[] } | null = null;

type ListenerEntry<T> = {
  unsubscribe: Unsubscribe;
  hasLatest: boolean;
  latest?: T;
  subscribers: Set<{
    onUpdate: (value: T) => void;
    onError?: (error: Error) => void;
  }>;
};

const groupListeners = new Map<string, ListenerEntry<Group | null>>();
const groupMembersListeners = new Map<string, ListenerEntry<GroupMember[]>>();

function normalizeGroup(id: string, data: Record<string, any>): Group {
  return {
    id,
    ...data,
    name: String(data.name || "Study Group"),
    description: String(data.description || ""),
    createdBy: String(data.createdBy || "Unknown"),
    adminId: data?.adminId ? String(data.adminId) : String(data.createdBy || ""),
    createdAt: data?.createdAt && typeof data.createdAt.toDate === "function" ? data.createdAt : Timestamp.now(),
    memberCount: Number(data.memberCount || 0),
    maxMembers: Math.max(1, Number(data.maxMembers || 50)),
    attendancePercentage: Number(data.attendancePercentage ?? 0),
    totalStudyTime: Number(data.totalStudyTime ?? 0),
    camStudyHours: Number(data.camStudyHours ?? 0),
  } as Group;
}

function normalizeGroupMember(uid: string, data: Record<string, any>): GroupMember {
  const rawName = data.name || data.displayName || "User";
  const rawStudyTime = Number(data.studyTime ?? data.totalFocusMinutes ?? 0);
  return {
    uid,
    ...data,
    name: String(rawName),
    displayName: data.displayName ? String(data.displayName) : String(rawName),
    studyTime: Number(rawStudyTime),
    totalFocusMinutes: Number(data.totalFocusMinutes ?? rawStudyTime),
    attendance: Number(data.attendance ?? 0),
    isOnline: Boolean(data.isOnline ?? false),
    joinedAt:
      data?.joinedAt && typeof data.joinedAt.toDate === "function"
        ? data.joinedAt
        : Timestamp.now(),
    photoURL: data.photoURL || null,
  } as GroupMember;
}

function notifyListeners<T>(entry: ListenerEntry<T>, value: T) {
  entry.latest = value;
  entry.hasLatest = true;
  entry.subscribers.forEach((subscriber) => subscriber.onUpdate(value));
}

function notifyListenerErrors<T>(entry: ListenerEntry<T>, error: Error) {
  entry.subscribers.forEach((subscriber) => subscriber.onError?.(error));
}

export async function createGroup(
  name: string,
  description: string,
  createdBy: string,
  creatorDisplayName: string,
  creatorPhotoURL?: string | null,
  maxMembers: number = 50
): Promise<Group> {
  const db = requireFirestore();
  const groupName = name.trim();
  if (!groupName) throw new Error("Group name is required");

  console.log("Current user:", auth?.currentUser);

  const uid = auth?.currentUser?.uid;

  if (!uid) {
    throw new Error("User not logged in");
  }

  const groupData = {
    name: groupName,
    description: description || "",
    adminId: uid,
    createdBy: uid,
    createdAt: serverTimestamp(),
    memberCount: 1,
    maxMembers: Math.max(1, Number(maxMembers || 50)),
    attendancePercentage: 0,
    totalStudyTime: 0,
    camStudyHours: 0,
  };

  const groupRef = await addDoc(collection(db, "groups"), groupData);
  const groupId = groupRef.id;

  console.log("Saved group:", groupData);

  const batch = writeBatch(db);

  // Add creator as first member
  batch.set(doc(db, "groups", groupId, "members", uid), {
    uid: uid,
    name: creatorDisplayName,
    displayName: creatorDisplayName,
    photoURL: creatorPhotoURL || null,
    totalFocusMinutes: 0,
    studyTime: 0,
    attendance: 0,
    isOnline: false,
    joinedAt: serverTimestamp(),
  });
  await batch.commit();
  groupsListCache = null;

  return {
    id: groupId,
    ...groupData,
    createdAt: Timestamp.now(), // Fallback for local UI until sync
  } as Group;
}

export async function getGroup(groupId: string): Promise<Group | null> {
  if (!groupId) return null;
  try {
    const db = requireFirestore();
    const snap = await getDoc(doc(db, "groups", groupId));
    if (!snap.exists()) return null;
    return normalizeGroup(snap.id, snap.data());
  } catch (err: any) {
    return null;
  }
}

export async function getGroupsList(forceRefresh = false): Promise<Group[]> {
  if (!forceRefresh && groupsListCache && Date.now() - groupsListCache.fetchedAt < GROUPS_CACHE_TTL_MS) {
    return groupsListCache.groups;
  }

  try {
    const db = requireFirestore();
    const snap = await getDocs(collection(db, "groups"));
    const groups = snap.docs
      .map((d) => normalizeGroup(d.id, d.data()))
      .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
    groupsListCache = { fetchedAt: Date.now(), groups };
    return groups;
  } catch (err: any) {
    return [];
  }
}

export async function joinGroup(groupId: string, uid: string, displayName: string, photoURL?: string | null): Promise<void> {
  const db = requireFirestore();
  if (!groupId) throw new Error("Missing group id");
  if (!uid) throw new Error("User not authenticated");

  const groupRef = doc(db, "groups", groupId);
  const memberRef = doc(db, "groups", groupId, "members", uid);

  // Check if already member
  const existing = await getDoc(memberRef);
  if (existing.exists()) {
    return;
  }

  const batch = writeBatch(db);
  batch.set(memberRef, {
    uid,
    name: displayName,
    displayName,
    photoURL: photoURL || null,
    totalFocusMinutes: 0,
    studyTime: 0,
    attendance: 0,
    isOnline: false,
    joinedAt: serverTimestamp(),
  });
  batch.update(groupRef, {
    memberCount: increment(1),
  });
  await batch.commit();
  groupsListCache = null;

}

export async function leaveGroup(groupId: string, uid: string): Promise<void> {
  const db = requireFirestore();
  if (!groupId) throw new Error("Missing group id");
  if (!uid) throw new Error("User not authenticated");

  const batch = writeBatch(db);
  batch.delete(doc(db, "groups", groupId, "members", uid));
  batch.update(doc(db, "groups", groupId), {
    memberCount: increment(-1),
  });
  await batch.commit();
  groupsListCache = null;

}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  if (!groupId) return [];
  try {
    const db = requireFirestore();
    const snap = await getDocs(collection(db, "groups", groupId, "members"));
    const members = snap.docs.map((d) => normalizeGroupMember(d.id, d.data()));
    return members.sort((a, b) => b.studyTime - a.studyTime);
  } catch (err: any) {
    return [];
  }
}

export async function getGroupLeaderboard(groupId: string): Promise<GroupLeaderboardEntry[]> {
  const members = await getGroupMembers(groupId);
  return members.map((m, i) => ({ ...m, rank: i + 1 }));
}

export async function deleteGroup(groupId: string): Promise<void> {
  if (!groupId) throw new Error("Missing group id");
  const db = requireFirestore();
  try {
    // Delete members and messages in batches
    const batch = writeBatch(db);

    const membersSnap = await getDocs(collection(db, "groups", groupId, "members"));
    let opCount = 0;
    for (const d of membersSnap.docs) {
      batch.delete(doc(db, "groups", groupId, "members", d.id));
      opCount++;
      if (opCount >= 400) {
        await batch.commit();
        opCount = 0;
      }
    }

    const messagesSnap = await getDocs(collection(db, "groups", groupId, "messages"));
    for (const d of messagesSnap.docs) {
      batch.delete(doc(db, "groups", groupId, "messages", d.id));
      opCount++;
      if (opCount >= 400) {
        await batch.commit();
        opCount = 0;
      }
    }

    // delete the group document
    batch.delete(doc(db, "groups", groupId));
    await batch.commit();
    groupsListCache = null;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export function subscribeToGroupMembers(
  groupId: string,
  onUpdate: (members: GroupMember[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!groupId) {
    onUpdate([]);
    return () => {};
  }
  const existing = groupMembersListeners.get(groupId);
  if (existing) {
    const subscriber = { onUpdate, onError };
    existing.subscribers.add(subscriber);
    if (existing.hasLatest) onUpdate(existing.latest as GroupMember[]);
    return () => {
      existing.subscribers.delete(subscriber);
      if (existing.subscribers.size === 0) {
        existing.unsubscribe();
        groupMembersListeners.delete(groupId);
      }
    };
  }


  try {
    const db = requireFirestore();
    const subscriber = { onUpdate, onError };
    const entry: ListenerEntry<GroupMember[]> = {
      hasLatest: false,
      subscribers: new Set([subscriber]),
      unsubscribe: () => {},
    };
    groupMembersListeners.set(groupId, entry);

    entry.unsubscribe = onSnapshot(
      collection(db, "groups", groupId, "members"),
      (snap) => {
        try {
          const members = snap.docs.map((d) => normalizeGroupMember(d.id, d.data()));
          notifyListeners(entry, members.sort((a, b) => b.studyTime - a.studyTime));
        } catch (err) {
          notifyListenerErrors(entry, err instanceof Error ? err : new Error(String(err)));
        }
      },
      (err) => {
        notifyListenerErrors(entry, err);
      }
    );
    return () => {
      entry.subscribers.delete(subscriber);
      if (entry.subscribers.size === 0) {
        entry.unsubscribe();
        groupMembersListeners.delete(groupId);
      }
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (onError) onError(error);
    return () => {};
  }
}

export function subscribeToGroup(
  groupId: string,
  onUpdate: (group: Group | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!groupId) {
    onUpdate(null);
    return () => {};
  }
  const existing = groupListeners.get(groupId);
  if (existing) {
    const subscriber = { onUpdate, onError };
    existing.subscribers.add(subscriber);
    if (existing.hasLatest) onUpdate(existing.latest as Group | null);
    return () => {
      existing.subscribers.delete(subscriber);
      if (existing.subscribers.size === 0) {
        existing.unsubscribe();
        groupListeners.delete(groupId);
      }
    };
  }


  try {
    const db = requireFirestore();
    const subscriber = { onUpdate, onError };
    const entry: ListenerEntry<Group | null> = {
      hasLatest: false,
      subscribers: new Set([subscriber]),
      unsubscribe: () => {},
    };
    groupListeners.set(groupId, entry);

    entry.unsubscribe = onSnapshot(
      doc(db, "groups", groupId),
      (snap) => {
        try {
          if (!snap.exists()) {
            notifyListeners(entry, null);
            return;
          }

          const data = snap.data();
          const group = normalizeGroup(snap.id, data);
          notifyListeners(entry, group);
        } catch (err) {
          notifyListenerErrors(entry, err instanceof Error ? err : new Error(String(err)));
        }
      },
      (err) => {
        notifyListenerErrors(entry, err);
      }
    );
    return () => {
      entry.subscribers.delete(subscriber);
      if (entry.subscribers.size === 0) {
        entry.unsubscribe();
        groupListeners.delete(groupId);
      }
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (onError) onError(error);
    return () => {};
  }
}

/**
 * Subscribe to the groups collection and listen for real-time updates.
 * @param sortKey Field to sort by (e.g., "createdAt", "attendancePercentage", etc.)
 * @param onUpdate Callback for updated group list
 * @param onError Optional error callback
 * @returns Unsubscribe function
 */
export function subscribeToGroupsList(
  sortKey: string = "createdAt",
  onUpdate: (groups: Group[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const db = requireFirestore();
    const q = query(collection(db, "groups"), orderBy(sortKey, "desc"));
    return onSnapshot(
      q,
      (snap) => {
        const groups = snap.docs.map((d) => normalizeGroup(d.id, d.data())) as Group[];
        onUpdate(groups);
      },
      (err) => {
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    if (onError) onError(err);
    return () => {};
  }
}

export async function updateGroupMemberMinutes(
  groupId: string,
  uid: string,
  minutesToAdd: number
): Promise<void> {
  const db = requireFirestore();
  if (!groupId || !uid || !Number.isFinite(minutesToAdd)) return;
  console.log("[updateGroupMemberMinutes] Adding", minutesToAdd, "minutes to uid:", uid, "in group:", groupId);

  await updateDoc(doc(db, "groups", groupId, "members", uid), {
    totalFocusMinutes: increment(minutesToAdd),
  });
}

function timestampToMillis(value: any): number {
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return 0;
}
