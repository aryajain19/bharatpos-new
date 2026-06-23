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
  const [role, setRole] = useState<'admin' | 'owner' | 'vendor' | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
