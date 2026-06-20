import { useEffect, useState, useRef } from "react";
import { subscribeTodos } from "@/services/todos";
import { Todo } from "@/types/todo";

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeTodos(
      (todos) => {
        setTodos(todos);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    if (unsubscribe) {
      unsubscribeRef.current = unsubscribe;
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  return { todos, loading, error };
}