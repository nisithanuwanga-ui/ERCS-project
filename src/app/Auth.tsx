import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "../../shared/domain";
import { api, clearCsrf } from "../services/api";
import { AuthContext } from "./useAuth";
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  async function reload() {
    const result = await api<{ data: User }>("/auth/me");
    setUser(result.data);
  }
  useEffect(() => {
    let alive = true;
    api<{ data: User }>("/auth/me")
      .then((r) => {
        if (alive) setUser(r.data);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    function expired() {
      setUser(null);
      window.location.assign("/session-expired");
    }
    window.addEventListener("ercs:expired", expired);
    return () => {
      alive = false;
      window.removeEventListener("ercs:expired", expired);
    };
  }, []);
  async function signIn(email: string, password: string, remember: boolean) {
    const r = await api<{ data: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, remember }),
    });
    clearCsrf();
    setUser(r.data);
  }
  async function signOut() {
    await api("/auth/logout", { method: "POST" });
    clearCsrf();
    setUser(null);
  }
  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, reload }}>
      {children}
    </AuthContext.Provider>
  );
}
