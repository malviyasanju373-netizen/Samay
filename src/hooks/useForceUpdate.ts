import { useCallback, useState } from "react";

export function useForceUpdate() {
  const [, setState] = useState(0);
  return useCallback(() => setState((n) => n + 1), []);
}
