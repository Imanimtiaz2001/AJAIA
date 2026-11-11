import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { UserDTO } from '../../shared/types';
import { api, queryKeys } from '../api/client';
import { ApiError } from '../api/http';

interface AuthState {
  user: UserDTO | null;
  isLoading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      try {
        return await api.auth.me();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: Infinity,
    retry: false,
  });

  /** Forget the previous account's cached documents when the signed-in user changes. */
  const dropUserScopedData = useCallback(
    () => queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.me[0] }),
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const user = await api.auth.login(email, password);
      queryClient.setQueryData(queryKeys.me, user);
      dropUserScopedData();
    },
    [queryClient, dropUserScopedData],
  );

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => undefined);
    queryClient.setQueryData(queryKeys.me, null);
    dropUserScopedData();
  }, [queryClient, dropUserScopedData]);

  const value = useMemo<AuthState>(
    () => ({ user: me.data ?? null, isLoading: me.isPending, login, logout }),
    [me.data, me.isPending, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** For screens behind <RequireAuth>, where a user is guaranteed. */
export function useCurrentUser(): UserDTO {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser requires a signed-in user');
  return user;
}
