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
        if (typeof window !== 'undefined') {
          const lastUid = window.localStorage.getItem('cachedUserUid');
          if (lastUid && lastUid !== firebaseUser.uid) {
            window.localStorage.removeItem('cachedUserRole');
            window.localStorage.removeItem('cachedUserPlan');
            window.localStorage.removeItem('cachedTenantId');
            window.localStorage.removeItem('cachedPermissions');
            window.localStorage.removeItem('cachedIsTrialExpired');
            window.localStorage.removeItem('storeName');
            window.localStorage.removeItem('storeAddress');
            window.localStorage.removeItem('gstNumber');
            window.localStorage.removeItem('isGstRegistered');
            window.localStorage.removeItem('shopMode');
            setRole(null);
            setPermissions(null);
            setSubscriptionPlan(null);
            setTenantId(null);
            setIsTrialExpired(false);
          }
          window.localStorage.setItem('cachedUserUid', firebaseUser.uid);
        }
        await fetchUserData(firebaseUser.uid);
      } else {
        setRole(null);
        setPermissions(null);
        setSubscriptionPlan(null);
        setTenantId(null);
        setIsTrialExpired(false);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('cachedUserUid');
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
        const resolvedTenantId = data.tenant_id || uid;
        setTenantId(resolvedTenantId);
        
        let userPermissions = data.permissions;
        let expired = false;
        let planVal = data.subscription_plan;
        const isStaff = data.role !== 'owner' && data.role !== 'admin';

        if (isStaff && data.tenant_id) {
          try {
            const tenantDocRef = doc(db, 'users', data.tenant_id);
            const tenantSnap = await getDoc(tenantDocRef);
            if (tenantSnap && tenantSnap.exists && tenantSnap.exists()) {
              const tenantData = tenantSnap.data();
              planVal = tenantData.subscription_plan;
              let tenantEndDate: Date | null = null;
              const rawTenantEnd = tenantData.subscription_end_date;
              if (rawTenantEnd) {
                if (typeof rawTenantEnd.toDate === 'function') {
                  tenantEndDate = rawTenantEnd.toDate();
                } else {
                  tenantEndDate = new Date(rawTenantEnd);
                }
              }
              if (tenantEndDate && new Date() > tenantEndDate) {
                expired = true;
              }
            }
          } catch (err) {
            console.warn("Failed to check tenant subscription for staff:", err);
          }
        } else {
          // Owner or Admin
          let subscriptionEndDate: Date | null = null;
          const rawEndDate = data.subscription_end_date;
          if (rawEndDate) {
            if (typeof rawEndDate.toDate === 'function') {
              subscriptionEndDate = rawEndDate.toDate();
            } else {
              subscriptionEndDate = new Date(rawEndDate);
            }
          }
          if (subscriptionEndDate && new Date() > subscriptionEndDate) {
            expired = true;
          }
        }

        if (expired && userPermissions) {
          userPermissions.pos_access = false;
        }

        setSubscriptionPlan(planVal);
        setIsTrialExpired(expired);
        setPermissions(userPermissions);

        // Cache details in localStorage for instantaneous subsequent reloads
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('cachedUserRole', data.role || '');
          window.localStorage.setItem('cachedUserPlan', planVal || '');
          window.localStorage.setItem('cachedTenantId', resolvedTenantId);
          window.localStorage.setItem('cachedPermissions', JSON.stringify(userPermissions || {}));
          window.localStorage.setItem('cachedIsTrialExpired', String(expired));
          
          if (data.storeName || data.store_name) {
            window.localStorage.setItem('storeName', data.storeName || data.store_name || 'BharatPOS');
          }
          if (data.isGstRegistered !== undefined || data.is_gst_registered !== undefined) {
            const isGst = data.isGstRegistered !== undefined ? data.isGstRegistered : data.is_gst_registered;
            window.localStorage.setItem('isGstRegistered', String(isGst));
          }
          if (data.shopMode || data.shop_mode) {
            window.localStorage.setItem('shopMode', data.shopMode || data.shop_mode || 'Mobile Only');
          }
          if (data.gstNumber || data.gst_number) {
            window.localStorage.setItem('gstNumber', data.gstNumber || data.gst_number || '');
          }
          if (data.storeAddress || data.store_address) {
            window.localStorage.setItem('storeAddress', data.storeAddress || data.store_address || '');
          }
          // Dispatch custom event to notify other layouts
          window.dispatchEvent(new Event('storeNameUpdated'));
        }
      } else {
        console.warn("User doc missing in Firestore, using default owner profile.");
        setRole('owner');
        setSubscriptionPlan('Premium Yearly');
        setTenantId(uid);
      }
    } catch (error) {
      console.warn("Error fetching Firebase user data:", error);
      // Fallback if firestore throws an error or times out
      setRole('owner');
      setSubscriptionPlan('Premium Yearly');
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

