import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Animated, Platform, ActivityIndicator } from 'react-native';
import { Text, useTheme, Surface, TextInput, Card, Button } from 'react-native-paper';
import { useAuth } from '../../../providers/AuthProvider';
import { useAppTheme } from '../../../providers/ThemeProvider';
import { router } from 'expo-router';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { db, auth, isFirebaseConfigured } from '../../../lib/firebase';
import { collection, query, where, getDocs } from '../../../lib/firestore_adapter';
import { signOut } from 'firebase/auth';

// --- Recent Transactions Demo Data ---
const RECENT_TRANSACTIONS = [
  { id: '1', name: 'Parle-G Biscuit x3', amount: 60, time: '2 min ago', icon: 'cookie', color: '#10B981' },
  { id: '2', name: 'Amul Butter 500g x1', amount: 280, time: '18 min ago', icon: 'cheese', color: '#F44336' },
  { id: '3', name: 'Tata Salt 1kg x2', amount: 48, time: '35 min ago', icon: 'shaker-outline', color: '#2196F3' },
  { id: '4', name: 'Surf Excel 1kg x1', amount: 230, time: '1 hr ago', icon: 'washing-machine', color: '#FF9800' },
  { id: '5', name: 'Haldiram Namkeen x4', amount: 160, time: '1.5 hr ago', icon: 'food-variant', color: '#9C27B0' },
];

// --- Greeting Helper ---
const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

// --- Animated Quick Action Button ---
const QuickActionButton = ({ icon, label, bgColor, iconColor, onPress }: {
  icon: string; label: string; bgColor: string; iconColor: string; onPress: () => void;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      <Animated.View style={[styles.actionCard, { transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.actionIconBg, { backgroundColor: bgColor }]}>
          <MaterialCommunityIcons name={icon} size={26} color={iconColor} />
        </View>
        <Text style={styles.actionLabel}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function VendorDashboard() {
  const { user, tenantId } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todaySales, setTodaySales] = useState(0);
  const [todayOrders, setTodayOrders] = useState(0);
  const [itemsCheckedOutCount, setItemsCheckedOutCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appTheme = useTheme();

  // Animated values for staggered card fade-in
  const fadeAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const slideAnims = useRef([
    new Animated.Value(30),
    new Animated.Value(30),
    new Animated.Value(30),
    new Animated.Value(30),
    new Animated.Value(30),
  ]).current;

  // Header animation
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-20)).current;

  // Transactions section animation
  const txnFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchMetrics();

    // Header entrance
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    // Staggered metric cards
    const animations = fadeAnims.map((fade, i) =>
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 500, delay: 200 + i * 120, useNativeDriver: true }),
        Animated.timing(slideAnims[i], { toValue: 0, duration: 500, delay: 200 + i * 120, useNativeDriver: true }),
      ])
    );
    Animated.stagger(0, animations).start();

    // Transactions section
    Animated.timing(txnFade, { toValue: 1, duration: 600, delay: 900, useNativeDriver: true }).start();
  }, [user]);

  const fetchMetrics = async () => {
    if (!isFirebaseConfigured || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    try {
      const q = query(
        collection(db, 'sales'),
        where('tenant_id', '==', tenantId || 'anonymous'),
        where('vendor_id', '==', user.uid),
        where('created_at', '>=', today.toISOString())
      );
      const snapshot = await getDocs(q);
      setTodayOrders(snapshot.docs.length);
      let total = 0;
      let itemsCheckedOut = 0;
      snapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        total += Number(data.total_amount || 0);
        (data.items || []).forEach((item: any) => {
          itemsCheckedOut += Number(item.qty || 0);
        });
      });
      setTodaySales(total);
      setItemsCheckedOutCount(itemsCheckedOut);

      if (tenantId) {
        const productsSnap = await getDocs(query(
          collection(db, 'products'),
          where('tenant_id', '==', tenantId)
        ));
        let lowStock = 0;
        let outOfStock = 0;
        productsSnap.docs.forEach((doc: any) => {
          const qty = doc.data().stock_qty !== undefined ? doc.data().stock_qty : (doc.data().stock || 0);
          if (qty <= 0) outOfStock++;
          else if (qty <= 5) lowStock++;
        });
        setLowStockCount(lowStock);
        setOutOfStockCount(outOfStock);
      }

      const allSalesQuery = query(
        collection(db, 'sales'),
        where('tenant_id', '==', tenantId || 'anonymous'),
        where('vendor_id', '==', user.uid)
      );
      const allSalesSnap = await getDocs(allSalesQuery);
      const txns: any[] = [];
      allSalesSnap.docs.forEach((doc: any) => {
        const d = doc.data();
        txns.push({
          id: doc.id,
          name: (d.items || []).map((i: any) => `${i.name} x${i.qty}`).join(', ') || 'POS Checkout',
          amount: d.total_amount || 0,
          created_at: d.created_at || new Date().toISOString()
        });
      });
      txns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecentTransactions(txns.slice(0, 5));

    } catch (err: any) {
      console.error("Error fetching vendor metrics:", err);
      setError(err.message || "Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (isFirebaseConfigured) { await signOut(auth); }
    } catch (error) { console.error("Firebase logout error:", error); }
    router.replace('/(auth)/login');
  };

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatTxnTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hr ago`;
      return date.toLocaleDateString('en-IN');
    } catch {
      return '';
    }
  };
  const userName = user?.email?.split('@')[0] || 'Ramesh';
  const userInitial = (user?.email?.[0] || 'R').toUpperCase();
  const greeting = getGreeting();

  // --- Metric card data ---
  const metricsData = [
    { label: "Today's Sales", value: fmt(todaySales), icon: 'currency-inr', color: appTheme.colors.onSurface, bgColor: '#ECFDF5', valueColor: '#1E293B' },
    { label: 'Orders Processed', value: String(todayOrders), icon: 'receipt', color: appTheme.colors.onSurface, bgColor: '#ECFDF5', valueColor: '#1E293B' },
    { label: 'Items Checked Out', value: String(itemsCheckedOutCount), icon: 'cart-arrow-up', color: appTheme.colors.onSurface, bgColor: '#EEF2FF', valueColor: '#1E293B' },
    { label: 'Low Stock Items', value: String(lowStockCount), icon: 'alert-outline', color: appTheme.colors.onSurface, bgColor: '#FFFBEB', valueColor: '#1E293B' },
  ];

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading POS Portal...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Dashboard</Text>
          <Text style={{ marginTop: 8, color: 'gray', textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 24 }}>{error}</Text>
          <Button mode="contained" onPress={fetchMetrics} style={{ borderRadius: 10, width: '100%', backgroundColor: appTheme.colors.primary }}>
            Retry Sync
          </Button>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Premium Gradient-Like Header */}
        <View style={styles.headerOuter}>
          <View style={styles.headerGradientTop} />
          <View style={styles.headerGradientBottom} />
          <Animated.View style={[styles.headerContent, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.greetingSmall}>{greeting} </Text>
                <Text style={styles.dashboardTitle}>POS Sales Portal</Text>
              </View>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                <MaterialCommunityIcons name="logout" size={20} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
            </View>
            <View style={styles.headerProfileRow}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{userInitial}</Text>
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerGreeting}>{userName}</Text>
                <Text style={styles.headerRole}>Store Sales Representative</Text>
              </View>
              <View style={styles.headerDatePill}>
                <MaterialCommunityIcons name="calendar-today" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.headerDateText}>
                  {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Content Area */}
        <View style={styles.contentBody}>

          {/* Section: Metrics Grid */}
          <Text style={styles.sectionTitle}>Daily Performance</Text>
          <View style={styles.metricsGrid}>
            {metricsData.map((metric, idx) => (
              <Animated.View
                key={metric.label}
                style={[
                  styles.metricCardWrapper,
                  { opacity: fadeAnims[idx], transform: [{ translateY: slideAnims[idx] }] },
                ]}
              >
                <Surface style={styles.metricCard} elevation={0}>
                  <View style={styles.metricCardTop}>
                    <View style={[styles.iconWrapper, { backgroundColor: metric.bgColor }]}>
                      <MaterialCommunityIcons name={metric.icon} size={20} color={metric.color} />
                    </View>
                    <MaterialCommunityIcons name="dots-horizontal" size={20} color="#94A3B8" />
                  </View>
                  <View style={styles.metricCardBottom}>
                    <Text style={styles.metricValue}>{metric.value}</Text>
                    <Text style={styles.metricLabel}>{metric.label}</Text>
                  </View>
                </Surface>
              </Animated.View>
            ))}

            {outOfStockCount > 0 && (
              <Animated.View
                style={[
                  { width: '100%' },
                  { opacity: fadeAnims[4], transform: [{ translateY: slideAnims[4] }] },
                ]}
              >
                <Surface style={styles.alertCard} elevation={0}>
                  <View style={[styles.iconWrapper, { backgroundColor: appTheme.colors.surface, marginRight: 16 }]}>
                    <MaterialCommunityIcons name="close-circle-outline" size={22} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertValue}>{outOfStockCount} Items Require Restock</Text>
                    <Text style={styles.alertLabel}>Out of Stock Products</Text>
                  </View>
                  <View style={[styles.alertBadge, { backgroundColor: '#FFEBEE' }]}>
                    <Text style={[styles.alertBadgeText, { color: '#C62828' }]}>Urgent</Text>
                  </View>
                </Surface>
              </Animated.View>
            )}
          </View>

          {/* Section: Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <QuickActionButton icon="qrcode-scan" label="Billing Scan" bgColor="#D1FAE5" iconColor="#10B981" onPress={() => router.push('/(vendor)/scan')} />
            <QuickActionButton icon="archive-outline" label="Products" bgColor="#E3F2FD" iconColor="#1565C0" onPress={() => router.push('/(vendor)/(tabs)/products')} />
            <QuickActionButton icon="cart-outline" label="My Cart" bgColor="#E8F5E9" iconColor="#2E7D32" onPress={() => router.push('/(vendor)/cart')} />
            <QuickActionButton icon="chart-box-outline" label="Sales Log" bgColor="#FFF3E0" iconColor="#E65100" onPress={() => router.push('/(vendor)/(tabs)/sales')} />
          </View>

          {/* Section: Recent Transactions */}
          <Animated.View style={{ opacity: txnFade }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <TouchableOpacity onPress={() => router.push('/(vendor)/(tabs)/sales')}>
                <Text style={styles.viewAllLink}>View All →</Text>
              </TouchableOpacity>
            </View>

            <Surface style={styles.transactionsCard} elevation={1}>
              {recentTransactions.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <MaterialCommunityIcons name="receipt" size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
                  <Text style={{ fontStyle: 'italic', color: '#64748B', fontSize: 13 }}>No Data Available</Text>
                </View>
              ) : (
                recentTransactions.map((txn, idx) => (
                  <View key={txn.id}>
                    <View style={styles.txnRow}>
                      <View style={[styles.txnIconBg, { backgroundColor: '#E8F5E9' }]}>
                        <MaterialCommunityIcons name="receipt" size={20} color="#10B981" />
                      </View>
                      <View style={styles.txnInfo}>
                        <Text style={styles.txnName} numberOfLines={1}>{txn.name}</Text>
                        <Text style={styles.txnTime}>{formatTxnTime(txn.created_at)}</Text>
                      </View>
                      <Text style={styles.txnAmount}>₹{txn.amount}</Text>
                    </View>
                    {idx < recentTransactions.length - 1 && <View style={styles.txnDivider} />}
                  </View>
                ))
              )}
            </Surface>
          </Animated.View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, },

  // --- Premium Header ---
  headerOuter: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#10B981',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  headerGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    },
  headerGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    opacity: 0.5,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: {
    paddingTop: 54,
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greetingSmall: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  dashboardTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarText: { fontSize: 20, fontWeight: 'bold' },
  headerTextContainer: { marginLeft: 16, flex: 1 },
  headerGreeting: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  headerRole: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 3 },
  headerDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  headerDateText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },

  // --- Content ---
  contentBody: { paddingHorizontal: 20, paddingTop: 8 },
  sectionTitle: { marginTop: 24, marginBottom: 16, fontWeight: 'bold', fontSize: 16, letterSpacing: 0.3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  viewAllLink: { fontSize: 13, fontWeight: '600', marginTop: 24 },

  // --- Metrics Grid ---
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 16 },
  metricCardWrapper: { flexGrow: 1, flexBasis: '22%', minWidth: 200, maxWidth: 320 },
  metricCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  metricCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  metricCardBottom: {},
  iconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: { fontSize: 13, marginTop: 4, fontWeight: '600' },
  metricValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },

  // Alert Card
  alertCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 8,
  },
  alertValue: { fontSize: 16, fontWeight: '700', },
  alertLabel: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  alertBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  alertBadgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },

  // --- Quick Actions ---
  actionsGrid: { flexDirection: 'row', gap: 10 },
  actionCard: {
    backgroundColor: 'white',
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#10B981',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  actionIconBg: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  // --- Transactions ---
  transactionsCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  txnIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnInfo: { flex: 1, marginLeft: 14 },
  txnName: { fontSize: 13, fontWeight: '600', },
  txnTime: { fontSize: 11, marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: 'bold', },
  txnDivider: { height: 1, marginHorizontal: 16 },
});
