import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from '../lib/firestore_adapter';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';

type Permissions = {
  pos_access: boolean;
  stock_management: boolean;
  barcode_generation: boolean;
  reporting: boolean;
};

type AuthContextType = {
  user: User | null;
  role: 'admin' | 'owner' | 'vendor' | null;
  permissions: Permissions | null;
  subscriptionPlan: string | null;
  isTrialExpired: boolean;
  tenantId: string | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  permissions: null,
  subscriptionPlan: null,
  isTrialExpired: false,
  tenantId: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  
  const [role, setRole] = useState<'admin' | 'owner' | 'vendor' | null>(() => {
    if (typeof window !== 'undefined') {
      return (window.localStorage.getItem('cachedUserRole') as any) || null;
    }
    return null;
  });
  
  const [permissions, setPermissions] = useState<Permissions | null>(() => {
    if (typeof window !== 'undefined') {
      const p = window.localStorage.getItem('cachedPermissions');
      try {
        return p ? JSON.parse(p) : null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('cachedUserPlan') || null;
    }
    return null;
  });
  
  const [isTrialExpired, setIsTrialExpired] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('cachedIsTrialExpired') === 'true';
    }
    return false;
  });
  
  const [tenantId, setTenantId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('cachedTenantId') || null;
    }
    return null;
  });
  
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      // Stale-While-Revalidate: if user data is cached, start immediately without showing loader
      return !window.localStorage.getItem('cachedUserRole');
    }
    return true;
  });

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchUserData(firebaseUser.uid);
      } else {
        setRole(null);
        setPermissions(null);
        setSubscriptionPlan(null);
        setTenantId(null);
        setIsTrialExpired(false);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('cachedUserRole');
          window.localStorage.removeItem('cachedUserPlan');
          window.localStorage.removeItem('cachedTenantId');
          window.localStorage.removeItem('cachedPermissions');
          window.localStorage.removeItem('cachedIsTrialExpired');
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchUserData = async (uid: string) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      
      // Use Promise.race to prevent hanging if Firestore is misconfigured
      const dbPromise = getDoc(userDocRef);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('firestore-timeout')), 4000));
      const userSnap: any = await Promise.race([dbPromise, timeoutPromise]);

      if (userSnap && userSnap.exists && userSnap.exists()) {
        const data = userSnap.data();
        setRole(data.role);
        setSubscriptionPlan(data.subscription_plan);
        setTenantId(data.tenant_id || uid);
        
        let userPermissions = data.permissions;
        let expired = false;

        if (data.subscription_end_date && new Date() > new Date(data.subscription_end_date.toDate()) && data.subscription_plan === 'free_trial') {
          expired = true;
          if (userPermissions) {
            userPermissions.pos_access = false;
          }
        }
        
        setIsTrialExpired(expired);
        setPermissions(userPermissions);

        // Cache details in localStorage for instantaneous subsequent reloads
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('cachedUserRole', data.role || '');
          window.localStorage.setItem('cachedUserPlan', data.subscription_plan || '');
          window.localStorage.setItem('cachedTenantId', data.tenant_id || uid);
          window.localStorage.setItem('cachedPermissions', JSON.stringify(userPermissions || {}));
          window.localStorage.setItem('cachedIsTrialExpired', String(expired));
        }
      } else {
        console.warn("User doc missing in Firestore, using default owner profile.");
        setRole('owner');
        setSubscriptionPlan('Standard Monthly');
        setTenantId(uid);
      }
    } catch (error) {
      console.warn("Error fetching Firebase user data:", error);
      // Fallback if firestore throws an error or times out
      setRole('owner');
      setSubscriptionPlan('Standard Monthly');
      setTenantId(uid);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, permissions, subscriptionPlan, isTrialExpired, tenantId, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
