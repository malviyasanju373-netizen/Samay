import { useEffect, useMemo, useRef, useState } from "react";
import { subscribeToGroupMembers } from "@/services/groups";
import { subscribeToStudyingStatusesForUids } from "@/services/sessions";
import { GroupLeaderboardEntry, GroupMember } from "@/types/group";

export function useGroupMembers(groupId?: string | null) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastSignatureRef = useRef("");

  const memberUids = useMemo(() => members.map((member) => member.uid), [members]);
  const memberUidsKey = useMemo(() => memberUids.join(","), [memberUids]);

  const mergedMembers = useMemo(() => {
    return members.map((member) => {
      const status = statusMap[member.uid] ?? {};
      let lastActiveAtMs: number | undefined;
      if (status?.lastActiveAt) {
        const value = status.lastActiveAt;
        lastActiveAtMs = typeof value?.toDate === "function" ? value.toDate().getTime() : Number(value);
      }
      return {
        ...member,
        isStudying: !!status?.isStudying && !!status?.currentSessionId,
        lastActiveAtMs,
        currentSessionSubject: status?.currentSubject ?? null,
        currentSessionId: status?.currentSessionId ?? null,
        currentSessionStart: status?.currentSessionStart ?? null,
      };
    });
  }, [members, statusMap]);

  const leaderboard = useMemo<GroupLeaderboardEntry[]>(() => {
    const entries = mergedMembers.map((member, i) => ({ ...member, rank: i + 1 }));
    entries.forEach((entry) => {
      console.log(`[useGroupMembers leaderboard] rank: ${entry.rank}, uid: ${entry.uid}, rendered minutes: ${entry.totalFocusMinutes}`);
    });
    return entries;
  }, [mergedMembers]);

  useEffect(() => {
    if (!groupId) {
      setMembers([]);
      lastSignatureRef.current = "";
      setLoading(false);
      setError("Missing group id");
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToGroupMembers(
      groupId,
      (m) => {
        if (!mounted) return;
        const signature = m
          .map((member) => `${member.uid}:${member.totalFocusMinutes || 0}:${member.name || member.displayName || ""}:${member.attendance || 0}:${member.isOnline ? 1 : 0}`)
          .join("|");
        if (signature === lastSignatureRef.current) {
          setError(null);
          setLoading(false);
          return;
        }
        lastSignatureRef.current = signature;
        console.log(`[useGroupMembers] Members updated, signature changed. First member: uid=${m[0]?.uid}, totalFocusMinutes=${m[0]?.totalFocusMinutes}`);
        setMembers(m);
        setError(null);
        setLoading(false);
      },
      (err) => {
        if (!mounted) return;
        setError("Realtime update failed");
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [groupId]);

  useEffect(() => {
    if (!groupId || memberUids.length === 0) {
      setStatusMap({});
      return;
    }

    let mounted = true;
    const unsubscribe = subscribeToStudyingStatusesForUids(
      memberUids,
      (_, summary) => {
        if (!mounted) return;
        setStatusMap(summary.statusMap || {});
      },
      () => {
        if (!mounted) return;
        setError("Realtime session update failed");
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [groupId, memberUidsKey]);

  return { members, leaderboard, loading, error };
}
