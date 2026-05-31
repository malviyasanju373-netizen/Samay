import { useState, useEffect, useCallback, useRef } from 'react';
import { subscribeToMessages, sendMessage as sendMessageApi, ChatMessage } from '@/services/chat';

interface UseGroupChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
}

export function useGroupChat(groupId: string): UseGroupChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToMessages(
      groupId,
      (newMessages) => {
        if (mountedRef.current) {
          setMessages(newMessages);
          setLoading(false);
        }
      },
      (err) => {
        if (mountedRef.current) {
          setError(err.message);
          setLoading(false);
        }
      }
    );

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [groupId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!groupId) return;
      try {
        await sendMessageApi(groupId, text);
      } catch (err: any) {
        setError(err?.message || 'Failed to send message');
      }
    },
    [groupId]
  );

  return { messages, loading, error, sendMessage };
}