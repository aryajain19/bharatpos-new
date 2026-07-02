import React, { useRef, useEffect, useState } from 'react';
import { DS } from '../../../constants/designTokens';
import { View, StyleSheet, ScrollView, TouchableOpacity, Animated, Alert, Switch, Platform } from 'react-native';
import { Text, Surface, Divider, useTheme, TextInput } from 'react-native-paper';
import { useAuth } from '../../../providers/AuthProvider';
import { auth, db, isFirebaseConfigured } from '../../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from '../../../lib/firestore_adapter';
import { signOut } from 'firebase/auth';
import { useAppTheme } from '../../../providers/ThemeProvider';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// --- Settings Options ---
const SETTINGS_OPTIONS = [
  { key: 'darkmode', icon: 'theme-light-dark', label: 'Dark Mode', type: 'toggle' },
  { key: 'notifications', icon: 'bell-ring-outline', label: 'Notifications', type: 'toggle' },
  { key: 'language', icon: 'translate', label: 'Language', subtitle: 'English (India)', type: 'nav' },
  { key: 'help', icon: 'help-circle-outline', label: 'Help & Support', type: 'nav' },
  { key: 'about', icon: 'information-outline', label: 'About App', subtitle: 'v2.1.0', type: 'nav' },
  { key: 'privacy', icon: 'shield-check-outline', label: 'Privacy Policy', type: 'nav' },
];

export default function ProfileScreen() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const { user, tenantId } = useAuth();
  const theme = useTheme();

  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [loading, setLoading] = useState(true);

  // Profile and Store Information States
  const [profileName, setProfileName] = useState(() => {
    return user?.email?.split('@')[0] || 'User';
  });
  const [storeNameText, setStoreNameText] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem('storeName') || 'BharatPOS';
    }
    return 'BharatPOS';
  });
  const [shiftTiming, setShiftTiming] = useState('');
  const [storeIdText, setStoreIdText] = useState('');

  // Real Stats States
  const [totalSales, setTotalSales] = useState(0);
  const [billsGenerated, setBillsGenerated] = useState(0);
  const [daysActive, setDaysActive] = useState(1);

  // Animations
  const avatarScale = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;
  const statAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    // Avatar bounce
    Animated.spring(avatarScale, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 12 }).start();

    // Content slide-in
    Animated.parallel([
      Animated.timing(contentFade, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
      Animated.timing(contentSlide, { toValue: 0, duration: 600, delay: 200, useNativeDriver: true }),
    ]).start();

    // Stats stagger
    Animated.stagger(150, statAnims.map(a =>
      Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 8 })
    )).start();

    fetchProfileData();
  }, [user]);

  const fetchProfileData = async () => {
    if (!isFirebaseConfigured || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. Fetch salesperson profile from users collection
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      let resolvedCreatedAt = new Date();
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.full_name) {
          setProfileName(data.full_name);
        }
        if (data.shift_timing) {
          setShiftTiming(data.shift_timing);
        }
        if (data.created_at) {
          const rawCreated = data.created_at;
          resolvedCreatedAt = new Date(rawCreated);
          const diffTime = Math.abs(Date.now() - resolvedCreatedAt.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
          setDaysActive(diffDays);
        }
      }

      // 2. Fetch store name from owner's user document (tenantId)
      if (tenantId) {
        const tenantDocRef = doc(db, 'users', tenantId);
        const tenantSnap = await getDoc(tenantDocRef);
        if (tenantSnap.exists()) {
          const tenantData = tenantSnap.data();
          if (tenantData.store_name) {
            setStoreNameText(tenantData.store_name);
          }
        }
        // Generate a custom Store ID based on tenantId
        setStoreIdText(`SGS-${tenantId.substring(0, 6).toUpperCase()}`);
      }

      // 3. Fetch sales metrics for this vendor
      const q = query(
        collection(db, 'sales'),
        where('tenant_id', '==', tenantId || 'anonymous'),
        where('vendor_id', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      setBillsGenerated(snapshot.docs.length);
      let total = 0;
      snapshot.docs.forEach((doc: any) => {
        const d = doc.data();
        total += Number(d.total_amount || 0);
      });
      setTotalSales(total);
    } catch (err) {
      console.error("Error fetching vendor profile metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  const userName = profileName;
  const userInitial = (profileName?.[0] || 'U').toUpperCase();
  const userEmail = user?.email || 'Not set';

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      doLogout();
    } else {
      Alert.alert(
        'Confirm Logout',
        'Are you sure you want to logout? You will need to sign in again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Logout', style: 'destructive', onPress: doLogout },
        ]
      );
    }
  };

  const doLogout = async () => {
    try {
      if (isFirebaseConfigured) { await signOut(auth); }
    } catch (error) { console.error('Logout error:', error); }
    router.replace('/(auth)/login');
  };

  const handleToggle = (key: string, value: boolean) => {
    if (key === 'darkmode') setDarkMode(value);
    if (key === 'notifications') setNotifications(value);
  };

  const formatSales = (val: number) => {
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)}L`;
    }
    if (val >= 1000) {
      return `₹${(val / 1000).toFixed(1)}k`;
    }
    return `₹${val.toFixed(0)}`;
  };

  // --- Stats Data ---
  const statsData = [
    { label: 'Total Sales', value: formatSales(totalSales), icon: 'trending-up', color: appTheme.colors.onSurface, bg: '#E8F5E9' },
    { label: 'Bills Generated', value: String(billsGenerated), icon: 'receipt', color: appTheme.colors.onSurface, bg: '#D1FAE5' },
    { label: 'Days Active', value: String(daysActive), icon: 'calendar-check', color: appTheme.colors.onSurface, bg: '#E3F2FD' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header with Avatar */}
        <View style={styles.headerBg}>
          <View style={styles.headerDecor1} />
          <View style={styles.headerDecor2} />

          <Animated.View style={[styles.avatarContainer, { transform: [{ scale: avatarScale }] }]}>
            <View style={styles.avatarOuter}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{userInitial}</Text>
              </View>
            </View>
            <View style={styles.onlineDot} />
          </Animated.View>

          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userEmail}>{userEmail}</Text>

          <View style={styles.roleBadge}>
            <Icon name="shield-star" size={13} color="#10B981" />
            <Text style={styles.roleBadgeText}>Sales Representative</Text>
          </View>
        </View>

        {/* Content */}
        <Animated.View style={[styles.contentArea, { opacity: contentFade, transform: [{ translateY: contentSlide }] }]}>

          {/* Store Info Card */}
          <Surface style={styles.storeCard} elevation={2}>
            <View style={styles.storeCardHeader}>
              <Icon name="store" size={20} color="#10B981" />
              <Text style={styles.storeCardTitle}>Store Information</Text>
            </View>
            <View style={styles.storeInfoRow}>
              <View style={styles.storeInfoItem}>
                <Text style={styles.storeInfoLabel}>Store Name</Text>
                <Text style={styles.storeInfoValue}>{storeNameText}</Text>
              </View>
              <View style={styles.storeInfoItem}>
                <Text style={styles.storeInfoLabel}>Role</Text>
                <Text style={styles.storeInfoValue}>Sales Counter</Text>
              </View>
            </View>
            <View style={styles.storeInfoRow}>
              <View style={styles.storeInfoItem}>
                <Text style={styles.storeInfoLabel}>Shift Timing</Text>
                <Text style={styles.storeInfoValue}>{shiftTiming}</Text>
              </View>
              <View style={styles.storeInfoItem}>
                <Text style={styles.storeInfoLabel}>Store ID</Text>
                <Text style={styles.storeInfoValue}>{storeIdText}</Text>
              </View>
            </View>
          </Surface>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {statsData.map((stat, idx) => (
              <Animated.View key={stat.label} style={[styles.statCardWrapper, { transform: [{ scale: statAnims[idx] }] }]}>
                <Surface style={styles.statCard} elevation={2}>
                  <View style={[styles.statIconBg, { backgroundColor: stat.bg }]}>
                    <Icon name={stat.icon} size={20} color={stat.color} />
                  </View>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </Surface>
              </Animated.View>
            ))}
          </View>

          {/* Settings */}
          <Text style={styles.sectionTitle}>Settings</Text>
          <Surface style={styles.settingsCard} elevation={1}>
            {SETTINGS_OPTIONS.map((opt, idx) => {
              const isToggle = opt.type === 'toggle';
              const toggleValue = opt.key === 'darkmode' ? darkMode : notifications;

              return (
                <React.Fragment key={opt.key}>
                  <TouchableOpacity
                    style={styles.settingsItem}
                    activeOpacity={isToggle ? 1 : 0.6}
                    onPress={() => {
                      if (!isToggle) {
                        // Navigate placeholder
                      }
                    }}
                  >
                    <View style={styles.settingsLeft}>
                      <View style={styles.settingsIconBg}>
                        <Icon name={opt.icon} size={18} color="#10B981" />
                      </View>
                      <View>
                        <Text style={styles.settingsLabel}>{opt.label}</Text>
                        {opt.subtitle && <Text style={styles.settingsSubtitle}>{opt.subtitle}</Text>}
                      </View>
                    </View>
                    {isToggle ? (
                      <Switch
                        value={toggleValue}
                        onValueChange={(v: any) => handleToggle(opt.key, v)}
                        trackColor={{ false: '#E0E0E0', true: '#D1C4E9' }}
                        thumbColor={toggleValue ? '#10B981' : '#BDBDBD'}
                      />
                    ) : (
                      <Icon name="chevron-right" size={20} color="#CCC" />
                    )}
                  </TouchableOpacity>
                  {idx < SETTINGS_OPTIONS.length - 1 && <Divider style={styles.settingsDivider} />}
                </React.Fragment>
              );
            })}
          </Surface>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
            <Icon name="logout" size={20} color="white" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>POS App v2.1.0 • Made in India </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, },

  // --- Header ---
  headerBg: {
    paddingTop: 56,
    paddingBottom: 36,
    alignItems: 'center',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  headerDecor1: {
    position: 'absolute',
    top: -30,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerDecor2: {
    position: 'absolute',
    bottom: -20,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  // --- Avatar ---
  avatarContainer: { alignItems: 'center', marginBottom: 14, position: 'relative' },
  avatarOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: DS.colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: 'bold' },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: DS.radius.sm,
    borderWidth: 3,
    },
  userName: { color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 3 },
  userEmail: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 12 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  roleBadgeText: { fontSize: 12, fontWeight: '700' },

  // --- Content ---
  contentArea: { paddingHorizontal: 20, marginTop: -8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 24, marginBottom: 14, letterSpacing: 0.3 },

  // --- Store Card ---
  storeCard: {
    backgroundColor: DS.colors.cardBg,
    borderRadius: 18,
    padding: 20,
    marginTop: 16,
    shadowColor: '#10B981',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  storeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  storeCardTitle: { fontSize: 15, fontWeight: 'bold', },
  storeInfoRow: { flexDirection: 'row', marginBottom: 14, gap: 16 },
  storeInfoItem: { flex: 1 },
  storeInfoLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  storeInfoValue: { fontSize: 14, fontWeight: '600', },

  // --- Stats ---
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  statCardWrapper: { flex: 1 },
  statCard: {
    backgroundColor: DS.colors.cardBg,
    borderRadius: DS.radius.lg,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  statIconBg: { width: 40, height: 40, borderRadius: DS.radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 18, fontWeight: 'bold', marginBottom: 2 },
  statLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },

  // --- Settings ---
  settingsCard: {
    backgroundColor: DS.colors.cardBg,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  settingsLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  settingsIconBg: {
    width: 36,
    height: 36,
    borderRadius: DS.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLabel: { fontSize: 14, fontWeight: '600', },
  settingsSubtitle: { fontSize: 11, marginTop: 1 },
  settingsDivider: { marginHorizontal: 18 },

  // --- Logout ---
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: DS.radius.lg,
    marginTop: 28,
    gap: 8,
    shadowColor: '#F44336',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  logoutText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  versionText: { textAlign: 'center', fontSize: 11, marginTop: 20 },
});
