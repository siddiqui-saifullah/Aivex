import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { User } from "../types";

export type SessionUser = Pick<User, "_id" | "name" | "username"> & Partial<User>;

interface UserContextValue {
  user: SessionUser | null;
  setUser: Dispatch<SetStateAction<SessionUser | null>>;
  loading: boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
export const UserContext = createContext<UserContextValue | null>(null);

/** Read the persisted session; clears it if it is corrupt. */
const loadStoredUser = (): SessionUser | null => {
  const storedUser = localStorage.getItem("user");
  const storedToken = localStorage.getItem("token");

  if (!storedUser || !storedToken) return null;

  try {
    return JSON.parse(storedUser) as SessionUser;
  } catch (err) {
    console.error("Failed to parse stored user:", err);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    return null;
  }
};

export function UserProvider({ children }: { children: ReactNode }) {
  // Read synchronously so protected routes don't flash a loader on every load
  const [user, setUser] = useState<SessionUser | null>(loadStoredUser);
  const loading = false;

  return (
    <UserContext.Provider value={{ user, setUser, loading }}>
      {children}
    </UserContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUser(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
}
