import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Platform, Dimensions, Animated, useWindowDimensions } from 'react-native';
import { Text, Divider, useTheme, IconButton, Avatar, Surface, Badge, Button, TextInput, ActivityIndicator } from 'react-native-paper';
import { Slot, router, usePathname } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { auth, isFirebaseConfigured, db } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '../../providers/AuthProvider';
import { collection, query, onSnapshot } from '../../lib/firestore_adapter';

const menuSections = [
  {
    label: 'POS Billing & Stock',
    items: [
      { name: 'Dashboard', icon: 'view-dashboard', path: '/(owner)' },
      { name: 'POS Billing', icon: 'cash-register', path: '/(owner)/pos_billing' },
      { name: 'Products', icon: 'package-variant', path: '/(owner)/products_management' },
      { name: 'Inventory', icon: 'clipboard-list-outline', path: '/(owner)/inventory' },
      { name: 'Barcode Gen.', icon: 'barcode', path: '/(owner)/barcode_generator' },
      { name: 'Reorder List', icon: 'alert-decagram-outline', path: '/(owner)/reorder_list' },
    ]
  },
  {
    label: 'Accounting & Tally',
    items: [
      { name: 'Day Book', icon: 'book-open-outline', path: '/(owner)/day_book' },
      { name: 'Cash & Bank Book', icon: 'cash-multiple', path: '/(owner)/cash_bank_book' },
      { name: 'Journal Entry', icon: 'notebook-outline', path: '/(owner)/journal_entry' },
      { name: 'Ledgers', icon: 'account-details-outline', path: '/(owner)/ledgers' },
      { name: 'Profit & Loss', icon: 'chart-line', path: '/(owner)/profit_loss' },
      { name: 'Balance Sheet', icon: 'scale-balance', path: '/(owner)/balance_sheet' },
      { name: 'GST Returns', icon: 'file-percent-outline', path: '/(owner)/gst_management', isGstOnly: true },
    ]
  },
  {
    label: 'Shop Management',
    items: [
      { name: 'Worker Mgmt', icon: 'account-group', path: '/(owner)/vendors' },
      { name: 'Reports Center', icon: 'file-chart', path: '/(owner)/reports' },
      { name: 'Subscription', icon: 'arrow-up-bold-circle', path: '/(owner)/upgrade' },
      { name: 'Settings', icon: 'cog', path: '/(owner)/settings' },
    ]
  }
];

// ── Live Clock Hook ────────────────────────────────────────────────────
function useLiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 30000); // update every 30s
    return () => clearInterval(id);
  }, []);
  const dateStr = time.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return { dateStr, timeStr };
}

// ── Sidebar Menu Item with hover ───────────────────────────────────────
const MenuItem = ({ item, isActive, onPress }: { item: any; isActive: boolean; onPress: () => void }) => {
  const [isHovered, setIsHovered] = useState(false);
  const bgAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(bgAnim, { toValue: isActive ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [isActive]);

  const backgroundColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0)', 'rgba(16, 185, 129, 0.1)'],
  });

  return (
    <Animated.View style={[{ backgroundColor }]}>
      <TouchableOpacity
        style={[
          styles.menuItem,
          isActive && styles.menuItemActive,
          isHovered && !isActive && styles.menuItemHover,
        ]}
        onPress={onPress}
        // @ts-ignore - web only
        onMouseEnter={Platform.OS === 'web' ? () => setIsHovered(true) : undefined}
        // @ts-ignore
        onMouseLeave={Platform.OS === 'web' ? () => setIsHovered(false) : undefined}
        activeOpacity={0.7}
      >
        <View style={[
          styles.menuIconContainer,
          isActive && { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
        ]}>
          <Icon name={item.icon} size={17} color={isActive ? '#10B981' : '#64748B'} />
        </View>
        <Text style={[styles.menuText, isActive && styles.menuTextActive]}>{item.name}</Text>
        {isActive && <View style={styles.activeIndicator} />}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Main Layout ────────────────────────────────────────────────────────
export default function OwnerLayout() {
  const pathname = usePathname();
  const theme = useTheme();
  const { dateStr, timeStr } = useLiveClock();
  
  const { user, isTrialExpired, loading } = useAuth();
  let userName = user?.displayName || user?.email?.split('@')[0] || 'Store Owner';
  // Capitalize first letter if it's from email
  if (userName.length > 0 && user?.email && userName === user.email.split('@')[0]) {
    userName = userName.charAt(0).toUpperCase() + userName.slice(1);
  }
  const initial = (user?.email?.[0] || userName.charAt(0)).toUpperCase();
  
  const [storeName, setStoreName] = useState('BharatPOS');
  const [shopMode, setShopMode] = useState('Mobile Only');
  const { width: screenWidth } = useWindowDimensions();
  const [isGstRegistered, setIsGstRegistered] = useState(true);

  // Announcement/Notification state & synchronization
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  const formatAlertTime = (createdAt: any) => {
    if (!createdAt) return '';
    let date: Date;
    if (createdAt.seconds) {
      date = new Date(createdAt.seconds * 1000);
    } else if (typeof createdAt === 'number') {
      date = new Date(createdAt);
    } else if (createdAt instanceof Date) {
      date = createdAt;
    } else {
      date = new Date(createdAt);
    }
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    }) + ', ' + date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setNotifications([]);
      setNotificationCount(0);
      return;
    }

    const q = query(collection(db, 'broadcast_alerts'));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const list: any[] = [];
      snapshot.docs.forEach((doc: any) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds : (typeof a.createdAt === 'number' ? a.createdAt / 1000 : 0);
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds : (typeof b.createdAt === 'number' ? b.createdAt / 1000 : 0);
        return timeB - timeA;
      });
      setNotifications(list);
      setNotificationCount(list.length);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const mode = window.localStorage.getItem('shopMode');
      if (mode) setShopMode(mode);
    }
  }, []);

  useEffect(() => {
    const updateFromStorage = () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const gstReg = window.localStorage.getItem('isGstRegistered');
        if (gstReg !== null) {
          setIsGstRegistered(gstReg !== 'false');
        }
        const storedName = window.localStorage.getItem('storeName');
        setStoreName(storedName || 'BharatPOS');
      }
    };

    updateFromStorage();

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('storeNameUpdated', updateFromStorage);
      return () => {
        window.removeEventListener('storeNameUpdated', updateFromStorage);
      };
    }
  }, [pathname]);

  const isLaptopLocked = false;

  const [isSidebarOpen, setIsSidebarOpen] = useState(screenWidth > 800);
  const lastWidthRef = useRef(screenWidth);

  useEffect(() => {
    if (screenWidth > 800 && lastWidthRef.current <= 800) {
      setIsSidebarOpen(true);
    }
    if (screenWidth <= 800 && lastWidthRef.current > 800) {
      setIsSidebarOpen(false);
    }
    lastWidthRef.current = screenWidth;
  }, [screenWidth]);

  const sidebarAnim = useRef(new Animated.Value(screenWidth > 800 ? 260 : 0)).current;

  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: isSidebarOpen ? 260 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [isSidebarOpen]);

  const handleLogout = async () => {
    try {
      if (isFirebaseConfigured) {
        await signOut(auth);
      }
    } catch (error) {
      console.error("Firebase logout error:", error);
    }
    router.replace('/(auth)/login');
  };

  const handleNav = (path: any) => {
    router.push(path);
    if (screenWidth <= 800) {
      setIsSidebarOpen(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={{ marginTop: 12, color: '#64748B', fontWeight: '600' }}>Loading BharatPOS...</Text>
      </View>
    );
  }

  const isUpgradePage = pathname?.includes('upgrade');
  if (isTrialExpired && !isUpgradePage) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Surface style={{ width: '100%', maxWidth: 500, padding: 40, borderRadius: 20, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FECACA' }} elevation={4}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Icon name="clock-alert-outline" size={32} color="#EF4444" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#7F1D1D', textAlign: 'center', marginBottom: 12 }}>Subscription Expired</Text>
          <Text style={{ fontSize: 15, color: '#991B1B', textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
            Your subscription has expired. Please renew your plan to regain full access to your business dashboard, inventory, and accounting.
          </Text>
          <Button 
            mode="contained" 
            buttonColor="#10B981" 
            labelStyle={{ fontWeight: 'bold' }} 
            style={{ width: '100%', borderRadius: 10, paddingVertical: 6 }} 
            onPress={() => router.push('/(owner)/upgrade' as any)}
          >
            Renew Subscription Now
          </Button>
          <Button 
            mode="text" 
            textColor="#EF4444" 
            style={{ marginTop: 12 }} 
            onPress={handleLogout}
          >
            Logout
          </Button>
        </Surface>
      </View>
    );
  }

  if (isLaptopLocked) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Surface style={{ width: '100%', maxWidth: 500, padding: 40, borderRadius: 20, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' }} elevation={4}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Icon name="laptop-off" size={32} color="#EF4444" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 12 }}> Laptop Terminal Locked</Text>
          <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 28 }}>
            Your account is currently on the <Text style={{ fontWeight: 'bold', color: '#D81B60' }}>Small Vendor Plan (Mobile-Only)</Text>.<br/>
            Dashboard access on desktop web browsers is disabled. To unlock laptop access and synchronize worker phones, upgrade to the Growth plan.
          </Text>
          <Button 
            mode="contained" 
            buttonColor="#10B981" 
            labelStyle={{ fontWeight: 'bold' }} 
            style={{ width: '100%', borderRadius: 10, paddingVertical: 6 }} 
            onPress={() => router.push('/(owner)/upgrade' as any)}
          >
            Upgrade Subscription Plan
          </Button>
          <TouchableOpacity 
            style={{ marginTop: 16 }} 
            onPress={() => {
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.localStorage.setItem('shopMode', 'Laptop + Mobile');
                window.location.reload();
              }
            }}
          >
            <Text style={{ color: '#10B981', fontWeight: 'bold', fontSize: 13 }}>Simulate Medium Shop Plan</Text>
          </TouchableOpacity>
        </Surface>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isSidebarOpen && screenWidth <= 800 && (
        <TouchableOpacity style={styles.overlay} onPress={() => setIsSidebarOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <Animated.View style={[
        styles.sidebar,
        { width: sidebarAnim },
        screenWidth <= 800 && isSidebarOpen && { position: 'absolute', zIndex: 100, width: 260 },
        !isSidebarOpen && { width: 0, overflow: 'hidden' },
      ]}>
        {/* Logo Area */}
        <View style={styles.logoContainer}>
          <View style={[styles.logoIconContainer, { backgroundColor: '#10B981' }]}>
            <Icon name="store" size={22} color="#fff" />
          </View>
          <View style={styles.logoTextContainer}>
            <Text style={[styles.logoText, { color: '#1E293B' }]} numberOfLines={1}>{storeName}</Text>
            <Text style={[styles.logoSubtext, { color: '#64748B' }]}>Owner Panel</Text>
          </View>
        </View>

        <Divider style={{ backgroundColor: '#E2E8F0', marginHorizontal: 16 }} />

        {/* Menu */}
        <ScrollView style={styles.sidebarMenu} showsVerticalScrollIndicator={false}>
          {menuSections.map((section, sIdx) => (
            <View key={sIdx}>
              <View style={styles.sectionLabelContainer}>
                <Text style={styles.sectionLabel}>{section.label.toUpperCase()}</Text>
                <View style={styles.sectionLine} />
              </View>

              {section.items
                .filter(item => !(item as any).isGstOnly || isGstRegistered)
                .map((item, iIdx) => {
                  const isActive = pathname === item.path || (item.path === '/(owner)' && pathname === '/(owner)/');
                  return (
                    <MenuItem
                      key={iIdx}
                      item={item}
                      isActive={isActive}
                      onPress={() => handleNav(item.path)}
                    />
                  );
                })}
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Logout */}
        <Divider style={{ backgroundColor: '#E2E8F0', marginHorizontal: 16 }} />
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <View style={styles.logoutIconContainer}>
            <Icon name="logout" size={18} color="#EF5350" />
          </View>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Main Content ────────────────────────────────────────── */}
      <View style={styles.main}>
        <Surface style={styles.topBar} elevation={0}>
          <View style={styles.topBarLeft}>
            <TouchableOpacity
              style={styles.menuToggle}
              onPress={() => setIsSidebarOpen(!isSidebarOpen)}
              activeOpacity={0.7}
            >
              <Icon name={isSidebarOpen ? 'menu-open' : 'menu'} size={22} color="#333" />
            </TouchableOpacity>
            {screenWidth > 480 && (
              <>
                <View style={styles.topBarDivider} />
                <Icon name="store-outline" size={18} color="#10B981" />
                <Text style={styles.storeName}>Main Branch</Text>
              </>
            )}
          </View>

          <View style={styles.topBarRight}>
            {/* Date & Time */}
            {screenWidth > 768 && (
              <>
                <View style={styles.dateTimeContainer}>
                  <Icon name="calendar-outline" size={15} color="#888" />
                  <Text style={styles.dateTimeText}>{dateStr}</Text>
                  <View style={styles.timeDot} />
                  <Icon name="clock-outline" size={15} color="#888" />
                  <Text style={styles.dateTimeText}>{timeStr}</Text>
                </View>
                <View style={styles.topBarDivider} />
              </>
            )}

            {/* Notification Bell */}
            <View style={styles.bellContainer}>
              <TouchableOpacity
                style={styles.bellButton}
                activeOpacity={0.7}
                onPress={() => setShowNotifications(!showNotifications)}
              >
                <Icon name={showNotifications ? "bell" : "bell-outline"} size={22} color={showNotifications ? "#1E293B" : "#555"} />
                {notificationCount > 0 && (
                  <Badge style={styles.bellBadge} size={16}>{notificationCount}</Badge>
                )}
              </TouchableOpacity>

              {showNotifications && (
                <View style={styles.dropdownContainer}>
                  <View style={styles.dropdownHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Icon name="bell-ring-outline" size={16} color="#475569" style={{ marginRight: 6 }} />
                      <Text style={styles.dropdownTitle}>Announcements</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowNotifications(false)}>
                      <Icon name="close" size={18} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                  <Divider style={{ backgroundColor: '#E2E8F0' }} />
                  <ScrollView style={styles.dropdownList} showsVerticalScrollIndicator={true}>
                    {notifications.length === 0 ? (
                      <View style={styles.emptyContainer}>
                        <Icon name="bell-off-outline" size={28} color="#94A3B8" style={{ marginBottom: 8 }} />
                        <Text style={styles.emptyText}>No new notifications</Text>
                      </View>
                    ) : (
                      notifications.map((item, idx) => (
                        <View key={item.id || idx}>
                          <View style={styles.notificationItem}>
                            <View style={styles.notifIconWrap}>
                              <Icon name="bullhorn-outline" size={16} color="#64748B" />
                            </View>
                            <View style={styles.notifContent}>
                              <Text style={styles.notifTitle}>{item.title}</Text>
                              <Text style={styles.notifText}>{item.text}</Text>
                              <Text style={styles.notifTime}>{formatAlertTime(item.createdAt)}</Text>
                            </View>
                          </View>
                          {idx < notifications.length - 1 && (
                            <Divider style={{ backgroundColor: '#F1F5F9', marginHorizontal: 12 }} />
                          )}
                        </View>
                      ))
                    )}
                  </ScrollView>
                </View>
              )}
            </View>

            {screenWidth > 600 && <View style={styles.topBarDivider} />}

            {/* User Avatar */}
            <View style={styles.userContainer}>
              {screenWidth > 600 && (
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{userName}</Text>
                  <Text style={styles.userRole}>Owner</Text>
                </View>
              )}
              <Avatar.Text
                size={36}
                label={initial}
                style={{ backgroundColor: '#10B981' }}
                labelStyle={{ fontSize: 14, fontWeight: '700' }}
              />
            </View>
          </View>
        </Surface>

        <View style={styles.contentArea}>
          <Slot />
        </View>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#F5F6FA' },
  main: { flex: 1, flexDirection: 'column' },

  // Sidebar
  sidebar: {
    width: 260,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    paddingTop: 0,
  },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99,
  },

  // Logo
  logoContainer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 22,
  },
  logoIconContainer: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center',
  },
  logoTextContainer: { marginLeft: 14 },
  logoText: { color: '#1E293B', fontWeight: '800', fontSize: 18, letterSpacing: -0.3 },
  logoSubtext: { color: '#64748B', fontSize: 11, marginTop: 1 },

  // Menu
  sidebarMenu: { flex: 1, marginTop: 8 },
  sectionLabelContainer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, marginTop: 20, marginBottom: 8,
  },
  sectionLabel: {
    color: '#94A3B8', fontSize: 10, fontWeight: '700',
    letterSpacing: 1.8, marginRight: 10,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },

  // Menu Item
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 16,
    marginHorizontal: 10, marginBottom: 2, borderRadius: 10,
  },
  menuItemActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  menuItemHover: {
    backgroundColor: '#F8FAFC',
  },
  menuIconContainer: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  menuText: {
    color: '#475569', marginLeft: 12, fontSize: 13.5, fontWeight: '500',
  },
  menuTextActive: { color: '#10B981', fontWeight: '700' },
  activeIndicator: {
    position: 'absolute', right: 0, top: '25%',
    width: 3, height: '50%', backgroundColor: '#10B981', borderRadius: 2,
  },

  // Logout
  logoutButton: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 20, marginHorizontal: 10,
    marginBottom: 8, marginTop: 8, borderRadius: 10,
  },
  logoutIconContainer: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: 'rgba(244,67,54,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoutText: {
    color: '#EF5350', fontWeight: '600', marginLeft: 12, fontSize: 14,
  },

  // Top Bar
  topBar: {
    height: 64, backgroundColor: '#fff', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center' },
  topBarRight: { flexDirection: 'row', alignItems: 'center' },
  menuToggle: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#F5F6FA', alignItems: 'center', justifyContent: 'center',
  },
  topBarDivider: {
    width: 1, height: 28, backgroundColor: '#ECECEC', marginHorizontal: 16,
  },
  storeName: { fontWeight: '700', fontSize: 15, color: '#333', marginLeft: 8 },

  // Date Time
  dateTimeContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9F9F9', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
  },
  dateTimeText: { fontSize: 13, color: '#666', marginLeft: 6, fontWeight: '500' },
  timeDot: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: '#CCC', marginHorizontal: 10,
  },

  // Notification Bell
  bellContainer: { position: 'relative' },
  bellButton: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#F5F6FA', alignItems: 'center', justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute', top: -2, right: -4,
    backgroundColor: '#EF4444', fontWeight: '700',
  },

  // Premium Notifications Dropdown
  dropdownContainer: {
    position: 'absolute',
    top: 48,
    right: 0,
    width: 340,
    maxHeight: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 999,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
  },
  dropdownTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  dropdownList: {
    maxHeight: 340,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 14,
  },
  notifIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 3,
  },
  notifText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    marginBottom: 6,
  },
  notifTime: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '500',
  },

  // User
  userContainer: { flexDirection: 'row', alignItems: 'center' },
  userInfo: { marginRight: 12, alignItems: 'flex-end' },
  userName: { fontSize: 13, fontWeight: '700', color: '#333' },
  userRole: { fontSize: 11, color: '#999', marginTop: 1 },

  // Content
  contentArea: { flex: 1, overflow: 'hidden' },
});
