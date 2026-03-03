import { createContext } from "react";
import type { User } from "../types";
import type { Dispatch, SetStateAction } from "react";
export type AuthContextType = {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  refreshUser: () => Promise<User | null>;
  loading: boolean;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType>(
  {} as AuthContextType
);
