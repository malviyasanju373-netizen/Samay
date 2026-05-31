import firestore from "@react-native-firebase/firestore";
import { auth, requireFirestore } from "@/firebase";
import { ActiveSession, Group, GroupMember, GroupLeaderboardEntry } from "@/types/group";

// ... (existing code, added imports)

const GROUPS_CACHE_TTL_MS = 30 * 1000;
let groupsListCache: { fetchedAt: number; groups: Group[] } | null = null;

type ListenerEntry<T> = {
  unsubscribe: () => void;
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
    createdAt: data?.createdAt && typeof data.createdAt.toDate === "function" ? data.createdAt : firestore.Timestamp.now(),
    memberCount: Number(data.memberCount || 0),
    maxMembers: Math.max(1, Number(data.maxMembers || 50)),
    attendancePercentage: Number(data.attendancePercentage ?? 0),
    totalStudyTime: Number(data.totalStudyTime ?? 0),
    camStudyHours: Number(data.camStudyHours ?? 0),
    isPrivate: Boolean(data.isPrivate ?? false),
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
    joinedAt: data?.joinedAt && typeof data.joinedAt.toDate === "function" ? data.joinedAt : firestore.Timestamp.now(),
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
  maxMembers: number = 50,
  isPrivate: boolean = false
): Promise<Group> {
  const db = requireFirestore();
  const groupName = name.trim();
  if (!groupName) throw new Error("Group name is required");

  const uid = auth().currentUser?.uid;
  if (!uid) throw new Error("User not logged in");

  const groupData = {
    name: groupName,
    description: description || "",
    adminId: uid,
    createdBy: uid,
    createdAt: firestore.FieldValue.serverTimestamp(),
    memberCount: 1,
    maxMembers: Math.max(1, Number(maxMembers || 50)),
    attendancePercentage: 0,
    totalStudyTime: 0,
    camStudyHours: 0,
    isPrivate: !!isPrivate,
  };

  const groupRef = await db.collection("groups").add(groupData);
  const groupId = groupRef.id;
  const batch = db.batch();
  batch.set(db.collection("groups").doc(groupId).collection("members").doc(uid), {
    uid,
    name: creatorDisplayName,
    displayName: creatorDisplayName,
    photoURL: creatorPhotoURL || null,
    totalFocusMinutes: 0,
    studyTime: 0,
    attendance: 0,
    isOnline: false,
    joinedAt: firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
  groupsListCache = null;

  return {
    id: groupId,
    ...groupData,
    createdAt: firestore.Timestamp.now(),
    isPrivate,
  } as Group;
}

export async function getGroup(groupId: string): Promise<Group | null> {
  if (!groupId) return null;
  try {
    const snap = await requireFirestore().collection("groups").doc(groupId).get();
    if (!snap.exists()) return null;
    return normalizeGroup(snap.id, snap.data() || {});
  } catch {
    return null;
  }
}

export async function getGroupsList(forceRefresh = false): Promise<Group[]> {
  if (!forceRefresh && groupsListCache && Date.now() - groupsListCache.fetchedAt < GROUPS_CACHE_TTL_MS) {
    return groupsListCache.groups;
  }

  try {
    const snap = await requireFirestore().collection("groups").get();
    const groups = snap.docs
      .map((d) => normalizeGroup(d.id, d.data()))
      .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
    groupsListCache = { fetchedAt: Date.now(), groups };
    return groups;
  } catch {
    return [];
  }
}

export async function joinGroup(groupId: string, uid: string, displayName: string, photoURL?: string | null): Promise<void> {
  const db = requireFirestore();
  if (!groupId) throw new Error("Missing group id");
  if (!uid) throw new Error("User not authenticated");

  const groupRef = db.collection("groups").doc(groupId);
  const memberRef = groupRef.collection("members").doc(uid);
  const existing = await memberRef.get();
  if (existing.exists()) return;

  const batch = db.batch();
  batch.set(memberRef, {
    uid,
    name: displayName,
    displayName,
    photoURL: photoURL || null,
    totalFocusMinutes: 0,
    studyTime: 0,
    attendance: 0,
    isOnline: false,
    joinedAt: firestore.FieldValue.serverTimestamp(),
  });
  batch.update(groupRef, {
    memberCount: firestore.FieldValue.increment(1),
  });
  await batch.commit();
  groupsListCache = null;
}

export async function leaveGroup(groupId: string, uid: string): Promise<void> {
  const db = requireFirestore();
  if (!groupId) throw new Error("Missing group id");
  if (!uid) throw new Error("User not authenticated");

  const groupRef = db.collection("groups").doc(groupId);
  const batch = db.batch();
  batch.delete(groupRef.collection("members").doc(uid));
  batch.update(groupRef, { memberCount: firestore.FieldValue.increment(-1) });
  await batch.commit();
  groupsListCache = null;
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  if (!groupId) return [];
  try {
    const db = requireFirestore();
    console.log("[getGroupMembers] Reading from groups/", groupId, "/members");
    const snap = await db.collection("groups").doc(groupId).collection("members").get();
    console.log("[getGroupMembers] Found", snap.docs.length, "members in group");
    
    // Fetch totalFocusMinutes from users collection for each member
    const members = await Promise.all(
      snap.docs.map(async (d) => {
        const uid = d.id;
        const memberData = d.data();
        const memberDocValue = Number(memberData.totalFocusMinutes || 0);
        
        console.log("[getGroupMembers]", {
          uid,
          "groups/{groupId}/members/{uid}.totalFocusMinutes": memberDocValue,
          firestore_path_member_doc: `groups/${groupId}/members/${uid}`,
        });
        
        let totalFocusMinutes = memberDocValue;
        
        try {
          const userSnap = await db.collection("users").doc(uid).get();
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const fetchedMinutes = Number(userData?.totalFocusMinutes || 0);
            console.log("[getGroupMembers]", {
              uid,
              "users/{uid}.totalFocusMinutes": fetchedMinutes,
              firestore_path_user_doc: `users/${uid}`,
              synced: memberDocValue === fetchedMinutes,
            });
            totalFocusMinutes = fetchedMinutes;
          }
        } catch (err: any) {
          console.error(`[getGroupMembers] Failed to fetch user ${uid}:`, err?.message);
        }
        
        const normalized = normalizeGroupMember(uid, memberData);
        return { ...normalized, totalFocusMinutes, studyTime: totalFocusMinutes };
      })
    );
    
    return members.sort((a, b) => b.totalFocusMinutes - a.totalFocusMinutes);
  } catch (err: any) {
    console.error("[getGroupMembers] Error:", err?.message);
    return [];
  }
}

export async function getGroupLeaderboard(groupId: string): Promise<GroupLeaderboardEntry[]> {
  const members = await getGroupMembers(groupId);
  return members.map((m, i) => {
    console.log(`[getGroupLeaderboard] rank: ${i + 1}, uid: ${m.uid}, rendered minutes: ${m.totalFocusMinutes}`);
    return { ...m, rank: i + 1 };
  });
}

export async function startActiveFocusSession(
  groupId: string,
  userId: string,
  userName: string
): Promise<void> {
  if (!groupId || !userId) throw new Error("Invalid groupId or userId");
  try {
    await requireFirestore()
      .collection("groups")
      .doc(groupId)
      .collection("activeSessions")
      .doc(userId)
      .set({
        uid: userId,
        displayName: userName,
        startedAt: firestore.FieldValue.serverTimestamp(),
        groupId,
      }, { merge: true });
  } catch (err: any) {
    console.error("[groups] startActiveFocusSession error:", err?.message);
    throw err;
  }
}

export async function stopActiveFocusSession(groupId: string, userId: string): Promise<void> {
  if (!groupId || !userId) throw new Error("Invalid groupId or userId");
  try {
    await requireFirestore()
      .collection("groups")
      .doc(groupId)
      .collection("activeSessions")
      .doc(userId)
      .delete();
  } catch (err: any) {
    console.error("[groups] stopActiveFocusSession error:", err?.message);
    throw err;
  }
}

/**
 * Check if user is a member of group
 */
export async function isMemberOfGroup(groupId: string, uid: string): Promise<boolean> {
  if (!groupId || !uid) return false;
  try {
    const snap = await requireFirestore()
      .collection("groups")
      .doc(groupId)
      .collection("members")
      .doc(uid)
      .get();
    return snap.exists();
  } catch (err: any) {
    console.error("[groups] isMemberOfGroup error:", err?.message);
    return false;
  }
}

/**
 * Request to join a private group
 */
export async function requestJoinGroup(groupId: string, uid: string, displayName: string): Promise<void> {

  const path = `groups/${groupId}/joinRequests/${uid}`;
  console.log("[DEBUG requestJoinGroup] ENTERED — path:", path, "displayName:", displayName);
  if (!groupId || !uid) {
    console.log("[DEBUG requestJoinGroup] EARLY RETURN — groupId:", groupId, "uid:", uid);
    throw new Error("Invalid groupId or userId");
  }
  try {
    const db = requireFirestore();
    const requestRef = db.collection("groups").doc(groupId).collection("joinRequests").doc(uid);
    
    const existing = await requestRef.get();
    if (existing.exists()) {
      const existingStatus = existing.data()?.status;
      if (existingStatus === "pending") {
        throw new Error("Join request already pending");
      }
      // If status is "rejected" or "cancelled", update the existing request to "pending"
      if (existingStatus === "rejected" || existingStatus === "cancelled") {
        await requestRef.update({
          requestedAt: firestore.FieldValue.serverTimestamp(),
          status: "pending",
        });
        return;
      }
    }
    
    await requestRef.set({
      uid,
      displayName,
      requestedAt: firestore.FieldValue.serverTimestamp(),
      status: "pending",
    });
  } catch (err: any) {
    console.error("[DEBUG requestJoinGroup] FULL ERROR OBJECT:", JSON.stringify({
      code: err.code,
      message: err.message,
      name: err.name,
      stack: err.stack?.split('\n').slice(0, 3).join('\n'),
    }, null, 2));
    console.error("[groups] requestJoinGroup error:", err?.message);
    throw err;
  }
}

/**
 * Check if user has pending join request
 */
export async function hasPendingJoinRequest(groupId: string, uid: string): Promise<boolean> {

  const path = `groups/${groupId}/joinRequests/${uid}`;
  console.log("[DEBUG hasPendingJoinRequest] ENTERED — path:", path);
  if (!groupId || !uid) {
    console.log("[DEBUG hasPendingJoinRequest] EARLY RETURN — groupId:", groupId, "uid:", uid);
    return false;
  }
  try {
    console.log("[DEBUG hasPendingJoinRequest] EXECUTING QUERY — firestore().collection('groups').doc('" + groupId + "').collection('joinRequests').doc('" + uid + "').get()");
    const snap = await requireFirestore()
      .collection("groups")
      .doc(groupId)
      .collection("joinRequests")
      .doc(uid)
      .get();
    console.log("[DEBUG hasPendingJoinRequest] QUERY SUCCESS — exists:", snap.exists, "data:", snap.data());
    return snap.exists() && snap.data()?.status === "pending";
  } catch (err: any) {
    console.error("[DEBUG hasPendingJoinRequest] FULL ERROR OBJECT:", JSON.stringify({
      code: err.code,
      message: err.message,
      name: err.name,
      stack: err.stack?.split('\n').slice(0, 3).join('\n'),
    }, null, 2));
    console.error("[groups] hasPendingJoinRequest error:", err?.message);
    return false;
  }
}

/**
 * Get pending join requests for a group (admin only)
 */
export async function getPendingJoinRequests(groupId: string): Promise<Array<any>> {

  const path = `groups/${groupId}/joinRequests`;
  console.log("[DEBUG getPendingJoinRequests] ENTERED — path:", path);
  if (!groupId) {
    console.log("[DEBUG getPendingJoinRequests] EARLY RETURN — groupId:", groupId);
    return [];
  }
  try {
    console.log("[DEBUG getPendingJoinRequests] EXECUTING QUERY — firestore().collection('groups').doc('" + groupId + "').collection('joinRequests').where('status', '==', 'pending').get()");
    const snap = await requireFirestore()
      .collection("groups")
      .doc(groupId)
      .collection("joinRequests")
      .where("status", "==", "pending")
      .get();
    console.log("[DEBUG getPendingJoinRequests] QUERY SUCCESS — count:", snap.docs.length, "docs:", snap.docs.map(d => ({ id: d.id, ...d.data() })));
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  } catch (err: any) {
    console.error("[DEBUG getPendingJoinRequests] FULL ERROR OBJECT:", JSON.stringify({
      code: err.code,
      message: err.message,
      name: err.name,
      stack: err.stack?.split('\n').slice(0, 3).join('\n'),
    }, null, 2));
    console.error("[groups] getPendingJoinRequests error:", err?.message);
    return [];
  }
}

/**
 * Approve join request and add user as member
 */
export async function approveJoinRequest(groupId: string, uid: string, displayName: string, photoURL?: string | null): Promise<void> {
  if (!groupId || !uid) throw new Error("Invalid groupId or userId");
  try {
    const db = requireFirestore();
    const groupRef = db.collection("groups").doc(groupId);
    const batch = db.batch();
    
    // Add as member
    batch.set(groupRef.collection("members").doc(uid), {
      uid,
      name: displayName,
      displayName,
      photoURL: photoURL || null,
      totalFocusMinutes: 0,
      studyTime: 0,
      attendance: 0,
      isOnline: false,
      joinedAt: firestore.FieldValue.serverTimestamp(),
    });
    
    // Update join request status
    batch.update(groupRef.collection("joinRequests").doc(uid), {
      status: "approved",
      approvedAt: firestore.FieldValue.serverTimestamp(),
    });
    
    // Increment member count
    batch.update(groupRef, {
      memberCount: firestore.FieldValue.increment(1),
    });
    
    await batch.commit();
    console.log("[groups] Join request approved for:", groupId, uid);
    groupsListCache = null;
  } catch (err: any) {
    console.error("[groups] approveJoinRequest error:", err?.message);
    throw err;
  }
}

/**
 * Reject join request
 */
export async function rejectJoinRequest(groupId: string, uid: string): Promise<void> {
  if (!groupId || !uid) throw new Error("Invalid groupId or userId");
  try {
    const db = requireFirestore();
    await db
      .collection("groups")
      .doc(groupId)
      .collection("joinRequests")
      .doc(uid)
      .update({
        status: "rejected",
        rejectedAt: firestore.FieldValue.serverTimestamp(),
      });
    console.log("[groups] Join request rejected for:", groupId, uid);
  } catch (err: any) {
    console.error("[groups] rejectJoinRequest error:", err?.message);
    throw err;
  }
}

export function subscribeToGroupMembers(
  groupId: string,
  onUpdate: (members: GroupMember[]) => void,
  onError?: (error: Error) => void
): () => void {
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
    const subscriber = { onUpdate, onError };
    const entry: ListenerEntry<GroupMember[]> = {
      hasLatest: false,
      subscribers: new Set([subscriber]),
      unsubscribe: () => {},
    };
    groupMembersListeners.set(groupId, entry);
    const db = requireFirestore();
    entry.unsubscribe = db
      .collection("groups")
      .doc(groupId)
      .collection("members")
      .onSnapshot(
        async (snap) => {
          try {
            console.log("[subscribeToGroupMembers] Snapshot received for groupId:", groupId, "member count:", snap.docs.length);
            
            // Fetch totalFocusMinutes from users collection for each member
            const members = await Promise.all(
              snap.docs.map(async (d) => {
                const uid = d.id;
                const memberData = d.data();
                const memberDocValue = Number(memberData.totalFocusMinutes || 0);
                
                console.log("[subscribeToGroupMembers]", {
                  uid,
                  "groups/{groupId}/members/{uid}.totalFocusMinutes": memberDocValue,
                  firestore_path: `groups/${groupId}/members/${uid}`,
                });
                
                let totalFocusMinutes = memberDocValue;
                
                try {
                  const userSnap = await db.collection("users").doc(uid).get();
                  if (userSnap.exists()) {
                    const userData = userSnap.data();
                    const fetchedMinutes = Number(userData?.totalFocusMinutes || 0);
                    console.log("[subscribeToGroupMembers]", {
                      uid,
                      "users/{uid}.totalFocusMinutes": fetchedMinutes,
                      firestore_path: `users/${uid}`,
                      synced: memberDocValue === fetchedMinutes,
                    });
                    totalFocusMinutes = fetchedMinutes;
                  }
                } catch (err: any) {
                  console.error(`[subscribeToGroupMembers] Failed to fetch user ${uid}:`, err?.message);
                }
                
                const normalized = normalizeGroupMember(uid, memberData);
                return { ...normalized, totalFocusMinutes, studyTime: totalFocusMinutes };
              })
            );
            const sorted = members.sort((a, b) => b.totalFocusMinutes - a.totalFocusMinutes);
            console.log("[subscribeToGroupMembers] Broadcasting update, top member:", {
              uid: sorted[0]?.uid,
              totalFocusMinutes: sorted[0]?.totalFocusMinutes,
            });
            notifyListeners(entry, sorted);
          } catch (err) {
            console.error("[subscribeToGroupMembers] Error processing snapshot:", err);
            notifyListenerErrors(entry, err instanceof Error ? err : new Error(String(err)));
          }
        },
        (err) => notifyListenerErrors(entry, err)
      );
    return () => {
      entry.subscribers.delete(subscriber);
      if (entry.subscribers.size === 0) {
        entry.unsubscribe();
        groupMembersListeners.delete(groupId);
      }
    };
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)));
    return () => {};
  }
}

export function subscribeToGroup(
  groupId: string,
  onUpdate: (group: Group | null) => void,
  onError?: (error: Error) => void
): () => void {
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
    const subscriber = { onUpdate, onError };
    const entry: ListenerEntry<Group | null> = {
      hasLatest: false,
      subscribers: new Set([subscriber]),
      unsubscribe: () => {},
    };
    groupListeners.set(groupId, entry);
    entry.unsubscribe = requireFirestore()
      .collection("groups")
      .doc(groupId)
      .onSnapshot(
        (snap) => {
          if (!snap.exists()) {
            notifyListeners(entry, null);
            return;
          }
          notifyListeners(entry, normalizeGroup(snap.id, snap.data() || {}));
        },
        (err) => notifyListenerErrors(entry, err)
      );
    return () => {
      entry.subscribers.delete(subscriber);
      if (entry.subscribers.size === 0) {
        entry.unsubscribe();
        groupListeners.delete(groupId);
      }
    };
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)));
    return () => {};
  }
}

export function subscribeToGroupsList(
  sortKey: string = "createdAt",
  onUpdate: (groups: Group[]) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    return requireFirestore()
      .collection("groups")
      .orderBy(sortKey, "desc")
      .onSnapshot(
        (snap) => onUpdate(snap.docs.map((d) => normalizeGroup(d.id, d.data()))),
        (err) => onError?.(err)
      );
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)));
    return () => {};
  }
}

export async function updateGroupMemberMinutes(groupId: string, uid: string, minutesToAdd: number): Promise<void> {
  console.log("[GROUP UPDATE] entered");
  if (!groupId || !uid || !Number.isFinite(minutesToAdd)) return;

  const documentPath = `groups/${groupId}/members/${uid}`;
  const payload = {
    totalFocusMinutes: firestore.FieldValue.increment(minutesToAdd),
    studyTime: firestore.FieldValue.increment(minutesToAdd),
  };

  try {
    console.log("[GROUP UPDATE] path =", documentPath);
    await requireFirestore()
      .collection("groups")
      .doc(groupId)
      .collection("members")
      .doc(uid)
      .update(payload);
    console.log("[GROUP UPDATE] success");
  } catch (error) {
    console.log("[GROUP UPDATE] error =", error);
    throw error;
  }
}

export function timestampToMillis(value: any): number {
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return 0;
}
