import { useEffect, useState } from "react";
import { subscribeToGroup } from "@/services/groups";
import { Group } from "@/types/group";

export function useGroup(groupId?: string | null) {
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) {
      setGroup(null);
      setLoading(false);
      setError("Missing group id");
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToGroup(
      groupId,
      (g) => {
        if (!mounted) return;
        setGroup((current) => {
          if (
            current?.id === g?.id &&
            current?.name === g?.name &&
            current?.description === g?.description &&
            current?.memberCount === g?.memberCount &&
            current?.maxMembers === g?.maxMembers &&
            current?.adminId === g?.adminId
          ) {
            return current;
          }
          return g;
        });
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

  return { group, loading, error };
}
