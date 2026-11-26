'use client';

import { createContext, useContext, useState } from 'react';
import type { User } from './auth';

interface UserContextValue {
  user: User | null;
  setUser: (user: User | null) => void;
  sessionReady: boolean;
  setSessionReady: (ready: boolean) => void;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  setUser: () => {},
  sessionReady: false,
  setSessionReady: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  return (
    <UserContext.Provider value={{ user, setUser, sessionReady, setSessionReady }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  return useContext(UserContext);
}
