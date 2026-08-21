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
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  permissions: null,
  subscriptionPlan: null,
  isTrialExpired: false,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    return auth.currentUser || null;
  });
  const [role, setRole] = useState<'admin' | 'owner' | 'vendor' | null>(() => {
    if (typeof window !== 'undefined') {
      return (window.localStorage.getItem('cachedAdminRole') as any) || null;
    }
    return null;
  });
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const [loading, setLoading] = useState(() => {
    // If not in browser or already has currentUser, don't block
    if (typeof window !== 'undefined') {
      const bypass = window.localStorage.getItem('adminBypass');
      if (bypass) return false;
    }
    return !auth.currentUser;
  });

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const failSafeTimeout = setTimeout(() => {
      setLoading(false);
    }, 1200);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(failSafeTimeout);
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchUserData(firebaseUser.uid);
      } else {
        setRole(null);
        setPermissions(null);
        setSubscriptionPlan(null);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('cachedAdminRole');
        }
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(failSafeTimeout);
      unsubscribe();
    };
  }, []);

  const fetchUserData = async (uid: string) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        setRole(data.role);
        if (typeof window !== 'undefined' && data.role) {
          window.localStorage.setItem('cachedAdminRole', data.role);
        }
        setSubscriptionPlan(data.subscription_plan);
        
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
      }
    } catch (error) {
      console.error("Error fetching Firebase user data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, permissions, subscriptionPlan, isTrialExpired, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
