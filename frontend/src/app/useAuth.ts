import { createContext, useContext } from "react";
import type { User } from "../../shared/domain";
export interface AuthValue {
  user: User | null;
  loading: boolean;
  serviceError: string;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
}
export const AuthContext = createContext<AuthValue | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
