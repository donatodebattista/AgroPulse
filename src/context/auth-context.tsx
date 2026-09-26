import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, customStorage } from '@/lib/supabase';
import { Membership, Organization, UserRole } from '@/types/database.types';
import { withClockSkewRetry } from '@/utils/supabase-retry';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  memberships: Membership[];
  currentMembership: Membership | null;
  currentOrg: Organization | null;
  currentRole: UserRole | null;
  switchOrganization: (orgId: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMemberships: () => Promise<void>;
}

const ACTIVE_ORG_STORAGE_KEY = '@agropulse_active_org_id';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  const fetchMemberships = useCallback(async (userId: string) => {
    try {
      const { data, error } = await withClockSkewRetry(() =>
        supabase
          .from('memberships')
          .select(`
            id,
            user_id,
            organization_id,
            role,
            created_at,
            organization:organizations (
              id,
              name,
              region,
              created_at
            )
          `)
          .eq('user_id', userId)
      );

      if (error) {
        console.error('[AuthContext] Error fetching memberships:', error.message);
        return [];
      }

      // Normalizar estructura de organización
      const formatted = (data || []).map((item: any) => ({
        ...item,
        organization: Array.isArray(item.organization) ? item.organization[0] : item.organization,
      })) as Membership[];

      setMemberships(formatted);

      if (formatted.length > 0) {
        const savedOrgId = await customStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
        const exists = formatted.some((m) => m.organization_id === savedOrgId);
        if (savedOrgId && exists) {
          setActiveOrgId(savedOrgId);
        } else {
          const defaultOrgId = formatted[0].organization_id;
          setActiveOrgId(defaultOrgId);
          await customStorage.setItem(ACTIVE_ORG_STORAGE_KEY, defaultOrgId);
        }
      } else {
        setActiveOrgId(null);
      }

      return formatted;
    } catch (err) {
      console.error('[AuthContext] Unexpected error in fetchMemberships:', err);
      return [];
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // 1. Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchMemberships(initialSession.user.id).finally(() => {
          if (isMounted) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // 2. Suscribirse a cambios en la sesión de Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        if (!isMounted) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await fetchMemberships(currentSession.user.id);
        } else {
          setMemberships([]);
          setActiveOrgId(null);
          await customStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
        }
        setIsLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchMemberships]);

  const switchOrganization = async (orgId: string) => {
    const exists = memberships.some((m) => m.organization_id === orgId);
    if (!exists) {
      console.warn(`[AuthContext] El usuario no pertenece a la organización ${orgId}`);
      return;
    }
    setActiveOrgId(orgId);
    await customStorage.setItem(ACTIVE_ORG_STORAGE_KEY, orgId);
  };

  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    await customStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
    setSession(null);
    setUser(null);
    setMemberships([]);
    setActiveOrgId(null);
    setIsLoading(false);
  };

  const refreshMemberships = async () => {
    if (user) {
      await fetchMemberships(user.id);
    }
  };

  const currentMembership = memberships.find((m) => m.organization_id === activeOrgId) ?? null;
  const currentOrg = currentMembership?.organization ?? null;
  const currentRole = currentMembership?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isLoading,
        memberships,
        currentMembership,
        currentOrg,
        currentRole,
        switchOrganization,
        signOut,
        refreshMemberships,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}
