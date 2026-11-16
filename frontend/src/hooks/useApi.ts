import { useEffect, useState } from "react";
import { api } from "../services/api";
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{
    path: string;
    version: number;
    data?: T;
    error?: string;
  }>({ path: "", version: -1 });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!path) return;
    let active = true;
    api<T>(path)
      .then((data) => {
        if (active) setState({ path, version, data });
      })
      .catch((e: Error) => {
        if (active) setState({ path, version, error: e.message });
      });
    return () => {
      active = false;
    };
  }, [path, version]);
  const current = !path || (state.path === path && state.version === version);
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: !current,
    refresh: () => setVersion((v) => v + 1),
  };
}
