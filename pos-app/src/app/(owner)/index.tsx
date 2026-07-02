import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Animated, Platform, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Text, Card, useTheme, Surface, TextInput, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart } from 'react-native-chart-kit';
import { db, isFirebaseConfigured, auth } from '../../lib/firebase';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc } from '../../lib/firestore_adapter';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { router } from 'expo-router';

// ── Animated Counter Hook ──────────────────────────────────────────────
function useAnimatedCounter(target: number, duration: number = 1200) {
  const [display, setDisplay] = useState(0);
  const animRef = useRef<any>(null);

  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const startTime = Date.now();
    const startVal = 0;
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplay(Math.round(startVal + (target - startVal) * eased));
      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      }
    };
    tick();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [target, duration]);

  return display;
}

// ── Greeting Helper ────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// ── Formatted Date Helper ──────────────────────────────────────────────
function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ── Metric Card Config ─────────────────────────────────────────────────
interface MetricConfig {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: string;
  color: string;
  bgColor: string;
}

// ── Animated Section Wrapper ───────────────────────────────────────────
const FadeInSection = ({ delay = 0, children }: { delay?: number; children: React.ReactNode }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 600, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 600, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
};

// ── Main Dashboard ─────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const { tenantId, loading: authLoading, subscriptionPlan } = useAuth();

  const [todaySales, setTodaySales] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return parseFloat(window.localStorage.getItem('cachedTodaySales') || '0');
    }
    return 0;
  });
  const [yesterdaySales, setYesterdaySales] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return parseFloat(window.localStorage.getItem('cachedYesterdaySales') || '0');
    }
    return 0;
  });
  const [monthlySales, setMonthlySales] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return parseFloat(window.localStorage.getItem('cachedMonthlySales') || '0');
    }
    return 0;
  });
  const [totalProfit, setTotalProfit] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return parseFloat(window.localStorage.getItem('cachedTotalProfit') || '0');
    }
    return 0;
  });
  const [totalOrders, setTotalOrders] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return parseFloat(window.localStorage.getItem('cachedTotalOrders') || '0');
    }
    return 0;
  });
  const [lowStockAlertCount, setLowStockAlertCount] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return parseFloat(window.localStorage.getItem('cachedLowStock') || '0');
    }
    return 0;
  });
  const [recentActivity, setRecentActivity] = useState<any[]>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const val = window.localStorage.getItem('cachedRecentActivity');
      return val ? JSON.parse(val) : [];
    }
    return [];
  });
  const [topSellingProducts, setTopSellingProducts] = useState<any[]>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const val = window.localStorage.getItem('cachedTopSelling');
      return val ? JSON.parse(val) : [];
    }
    return [];
  });
  const [chartLabels, setChartLabels] = useState<string[]>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const val = window.localStorage.getItem('cachedChartLabels');
      return val ? JSON.parse(val) : [];
    }
    return [];
  });
  const [chartData, setChartData] = useState<number[]>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const val = window.localStorage.getItem('cachedChartData');
      return val ? JSON.parse(val) : [];
    }
    return [];
  });
  const [workersList, setWorkersList] = useState<any[]>([]);
  const [shopSyncCode, setShopSyncCode] = useState('');
  
  const [shopMode, setShopMode] = useState('Mobile Only');
  const [isGstRegistered, setIsGstRegistered] = useState(true);

  const [loading, setLoading] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return !window.localStorage.getItem('cachedTodaySales');
    }
    return true;
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    fetchMetrics();
    let unsubscribe: any = null;
    if (isFirebaseConfigured && tenantId) {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startDate = sevenDaysAgo < firstOfMonth ? sevenDaysAgo : firstOfMonth;
      const startDateISO = startDate.toISOString();

      const q = query(
        collection(db, 'sales'),
        where('tenant_id', '==', tenantId),
        where('created_at', '>=', startDateISO)
      );

      unsubscribe = onSnapshot(q, (snapshot: any) => {
        try {
          processSalesData(snapshot.docs);
        } catch (err) {
          console.error("Real-time sales update process failed:", err);
        }
      });
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const mode = window.localStorage.getItem('shopMode');
      if (mode) setShopMode(mode);

      const gstReg = window.localStorage.getItem('isGstRegistered');
      if (gstReg !== null) {
        setIsGstRegistered(gstReg !== 'false');
      }
    }

    return () => { if (unsubscribe) unsubscribe(); };
  }, [authLoading, tenantId]);

  const processSalesData = (docs: any[]) => {
    const now = new Date();
    const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStr = todayStr - 86400000;
    const firstOfMonthStr = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let tSales = 0, ySales = 0, mSales = 0, profit = 0, tOrders = 0;
    const productStats: Record<string, any> = {};
    const activities: any[] = [];
    
    const labels: string[] = [];
    const dataPoints = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStr);
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
    }

    docs.forEach((doc: any) => {
      const data = doc.data();
      const amt = parseFloat(data.total_amount || 0);
      const date = new Date(data.created_at || new Date()).getTime();

      if (date >= todayStr) { tSales += amt; tOrders++; }
      else if (date >= yesterdayStr && date < todayStr) { ySales += amt; }
      if (date >= firstOfMonthStr) { mSales += amt; }
      
      const saleDateObj = new Date(date);
      const dateStr = saleDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const idx = labels.indexOf(dateStr);
      if (idx !== -1) {
        dataPoints[idx] += amt;
      }

      // Calculate real profit
      let cost = 0;
      let hasCostPrice = false;
      (data.items || []).forEach((item: any) => {
        if (item.cost_price !== undefined && item.cost_price > 0) {
           hasCostPrice = true;
           cost += (parseFloat(item.cost_price) * item.qty);
        } else {
           // fallback logic if needed, but we will just rely on actual cost_price
        }
        if (!productStats[item.id]) productStats[item.id] = { name: item.name, qty: 0, revenue: 0 };
        productStats[item.id].qty += item.qty;
        productStats[item.id].revenue += (item.qty * parseFloat(item.price || 0));
      });
      
      // If no cost price available, don't add to profit to avoid fake numbers. 
      // If we want to show 0 when no cost price is available.
      if (hasCostPrice) {
         profit += (amt - cost);
      }

      activities.push({
        id: doc.id,
        date: date,
        icon: 'cart-check',
        color: appTheme.colors.onSurface,
        text: `Sale by ${data.served_by || 'Staff'} — ₹${amt.toLocaleString()}`,
        time: new Date(date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      });
    });

    setTodaySales(tSales);
    setYesterdaySales(ySales);
    setMonthlySales(mSales);
    setTotalProfit(Math.round(profit));
    setTotalOrders(tOrders);
    setChartLabels(labels);
    setChartData(dataPoints);

    // Sort Top Products
    const topProdList = Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((p, idx) => ({ ...p, rank: idx + 1 }));
    setTopSellingProducts(topProdList);

    // Sort Recent Activity
    activities.sort((a, b) => b.date - a.date);
    const recentActList = activities.slice(0, 5);
    setRecentActivity(recentActList);

    // Cache metrics in localStorage
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem('cachedTodaySales', String(tSales));
      window.localStorage.setItem('cachedYesterdaySales', String(ySales));
      window.localStorage.setItem('cachedMonthlySales', String(mSales));
      window.localStorage.setItem('cachedTotalProfit', String(Math.round(profit)));
      window.localStorage.setItem('cachedTotalOrders', String(tOrders));
      window.localStorage.setItem('cachedRecentActivity', JSON.stringify(recentActList));
      window.localStorage.setItem('cachedTopSelling', JSON.stringify(topProdList));
      window.localStorage.setItem('cachedChartLabels', JSON.stringify(labels));
      window.localStorage.setItem('cachedChartData', JSON.stringify(dataPoints));
    }
  };

  const fetchMetrics = async () => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!tenantId) return;
      
      
      // Fetch Workers
      const workersSnapshot = await getDocs(query(
        collection(db, 'users'),
        where('role', '==', 'salesperson'),
        where('tenant_id', '==', tenantId)
      ));
      const wList: any[] = [];
      workersSnapshot.forEach((doc: any) => {
        wList.push({ id: doc.id, ...doc.data() });
      });
      setWorkersList(wList);

      // Fetch Shop Metadata for sync code
      let sCode = '';
      try {
        const shopSnap = await getDoc(doc(db, 'shops', tenantId));
        if (shopSnap.exists && shopSnap.exists()) {
          const shopData = shopSnap.data();
          sCode = shopData.syncCode || shopData.sync_code;
        }
      } catch (err) {
        console.warn("Error fetching shop sync code:", err);
      }
      if (!sCode) {
        sCode = `POS-${tenantId.substring(0, 6).toUpperCase()}`;
      }
      setShopSyncCode(sCode);

      // Fetch Products for Low Stock Alert
      const prodSnapshot = await getDocs(query(collection(db, 'products'), where('tenant_id', '==', tenantId)));
      let lowStock = 0;
      prodSnapshot.forEach((doc: any) => {
        if ((doc.data().stock_qty || 0) < 5) lowStock++;
      });
      setLowStockAlertCount(lowStock);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.setItem('cachedLowStock', String(lowStock));
      }

      // Fetch Sales (constrained range)
      const now = new Date();
      const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startDate = sevenDaysAgo < firstOfMonth ? sevenDaysAgo : firstOfMonth;
      const startDateISO = startDate.toISOString();

      const q = query(
        collection(db, 'sales'),
        where('tenant_id', '==', tenantId),
        where('created_at', '>=', startDateISO)
      );

      const salesSnapshot = await getDocs(q);
      processSalesData(salesSnapshot.docs);
    } catch (error: any) {
      console.error("Error fetching metrics:", error);
      setError(error.message || "Unable to sync dashboard stats from Firebase database.");
    } finally {
      setLoading(false);
    }
  };

  // Use real data
  const salesValue = todaySales;
  const ordersValue = totalOrders;

  const metrics: MetricConfig[] = shopMode === 'Mobile Only' ? (
    isGstRegistered ? [
      { title: "Today's Sales", value: salesValue, prefix: '₹', icon: 'currency-inr', color: appTheme.colors.onSurface, bgColor: '#ECFDF5' },
      { title: "Total Amount Collected", value: salesValue, prefix: '₹', icon: 'cash-check', color: appTheme.colors.onSurface, bgColor: '#ECFDF5' },
      { title: "Total Profit", value: totalProfit, prefix: '₹', icon: 'trending-up', color: appTheme.colors.onSurface, bgColor: '#EEF2FF' },
      { title: "GST Collected", value: 0, prefix: '₹', icon: 'bank', color: appTheme.colors.onSurface, bgColor: '#FEF2F2' },
    ] : [
      { title: "Today's Sales", value: salesValue, prefix: '₹', icon: 'currency-inr', color: appTheme.colors.onSurface, bgColor: '#ECFDF5' },
      { title: "Total Amount Collected", value: salesValue, prefix: '₹', icon: 'cash-check', color: appTheme.colors.onSurface, bgColor: '#ECFDF5' },
      { title: "Coming Soon (Khata)", value: 0, prefix: '₹', icon: 'account-clock', color: appTheme.colors.onSurface, bgColor: '#FEF2F2' },
      { title: "Low Stock Alert", value: lowStockAlertCount, icon: 'alert-outline', color: appTheme.colors.onSurface, bgColor: '#FFFBEB' },
    ]
  ) : [
    { title: "Today's Sales", value: salesValue, prefix: '₹', icon: 'currency-inr', color: appTheme.colors.onSurface, bgColor: '#ECFDF5' },
    { title: "Yesterday's Sales", value: yesterdaySales, prefix: '₹', icon: 'chart-timeline-variant', color: appTheme.colors.onSurface, bgColor: '#F1F5F9' },
    { title: "Monthly Sales", value: monthlySales, prefix: '₹', icon: 'calendar-month', color: appTheme.colors.onSurface, bgColor: '#ECFDF5' },
    { title: "Total Profit", value: totalProfit, prefix: '₹', icon: 'trending-up', color: appTheme.colors.onSurface, bgColor: '#EEF2FF' },
    { title: "Low Stock Alert", value: lowStockAlertCount, icon: 'alert-outline', color: appTheme.colors.onSurface, bgColor: '#FFFBEB' },
  ];

  const renderShopModeWidget = () => {
    if (shopMode === 'Mobile Only') {
      return (
        <Card style={styles.modeCard} elevation={0}>
          <Card.Content>
            <View style={styles.modeCardHeader}>
              <View style={[styles.modeIconCircle, { backgroundColor: appTheme.colors.surface }]}>
                <Icon name="cellphone" size={20} color="#D81B60" />
              </View>
              <View>
                <Text style={styles.modeCardTitle}>Mobile Shop Console</Text>
                <Text style={styles.modeCardSubtitle}>Mode: Mobile Only Shop (Optimized for Phones)</Text>
              </View>
            </View>
            <Text style={styles.modeCardDesc}>
              Everything is optimized for your mobile camera terminal. Quick billing, stock tracking, and barcode scanner are fully operational directly on phone.
            </Text>
            <View style={styles.modeActionsRow}>
              <TouchableOpacity style={styles.modeActionBtn} onPress={() => router.push('/(owner)/pos_billing' as any)}>
                <Icon name="barcode-scan" size={16} color="#10B981" />
                <Text style={styles.modeActionText}>Billing Terminal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modeActionBtn} onPress={() => router.push('/(owner)/products_management' as any)}>
                <Icon name="package-variant-plus" size={16} color="#E65100" />
                <Text style={styles.modeActionText}>Add Products</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modeActionBtn} onPress={() => router.push('/(owner)/barcode_generator' as any)}>
                <Icon name="barcode" size={16} color="#2E7D32" />
                <Text style={styles.modeActionText}>Create Barcode</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modeActionBtn} onPress={() => router.push('/(owner)/inventory' as any)}>
                <Icon name="clipboard-list" size={16} color="#D81B60" />
                <Text style={styles.modeActionText}>Stock Management</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modeActionBtn} onPress={() => router.push('/(owner)/upgrade' as any)}>
                <Icon name="star-outline" size={16} color="#6366F1" />
                <Text style={styles.modeActionText}>Subscriptions</Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>
      );
    } else if (shopMode === 'Laptop + Mobile') {
      return (
        <Card style={styles.modeCard} elevation={0}>
          <Card.Content>
            <View style={styles.modeCardHeader}>
              <View style={[styles.modeIconCircle, { backgroundColor: appTheme.colors.surface }]}>
                <Icon name="laptop" size={20} color="#10B981" />
              </View>
              <View>
                <Text style={styles.modeCardTitle}>Medium Shop Sync Console</Text>
                <Text style={styles.modeCardSubtitle}>Mode: Laptop POS + Worker Phone Sync</Text>
              </View>
            </View>
            <Text style={styles.modeCardDesc}>
              Your laptop serves as the main checkout counter while salesperson phones perform fast barcode scans and quick register checkout.
            </Text>
            <View style={styles.syncRow}>
              <Icon name="cellphone-link-variant" size={20} color="#0369A1" />
              <View style={{ flex: 1 }}>
                <Text style={styles.syncText}>
                  Staff Phone Sync Code: <Text style={{ fontWeight: '800', textDecorationLine: 'underline' }}>{shopSyncCode || 'Loading...'}</Text>
                </Text>
                <Text style={{ fontSize: 11, color: appTheme.colors.onSurface, marginTop: 2 }}>
                  Instruct cashiers to enter this code on the worker sign-in screen to connect their devices.
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: 'gray' }}>Worker</Text>
            </View>
          </Card.Content>
        </Card>
      );
    } else {
      return (
        <Card style={styles.modeCard} elevation={0}>
          <Card.Content>
            <View style={styles.modeCardHeader}>
              <View style={[styles.modeIconCircle, { backgroundColor: appTheme.colors.surface }]}>
                <Icon name="domain" size={20} color="#10B981" />
              </View>
              <View>
                <Text style={styles.modeCardTitle}>Large Store Central Dashboard</Text>
                <Text style={styles.modeCardSubtitle}>Mode: Multi-Device Sync & Separate Permissions</Text>
              </View>
            </View>
            <Text style={styles.modeCardDesc}>
              Central inventory synced automatically across all workers. Manage roles and set terminal session permissions manually.
            </Text>
            <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
              <View style={{ flex: 1, minWidth: 200, backgroundColor: appTheme.colors.surface, borderWidth: 1, borderColor: appTheme.colors.outline, borderRadius: 10, padding: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: appTheme.colors.onSurface, marginBottom: 6, textTransform: 'uppercase' }}>Worker Status</Text>
                {workersList.length > 0 ? (
                  workersList.map((w, idx) => (
                    <View key={w.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, color: appTheme.colors.onSurface }}>{w.full_name || w.name || 'Staff'}</Text>
                      <Text style={{ fontSize: 12, color: appTheme.colors.onSurface, fontWeight: 'bold' }}>Active</Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ fontSize: 12, color: appTheme.colors.onSurface, fontStyle: 'italic' }}>No Data Available</Text>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 200, backgroundColor: appTheme.colors.surface, borderWidth: 1, borderColor: appTheme.colors.outline, borderRadius: 10, padding: 12, justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: appTheme.colors.primary }}>{workersList.length} Registered Workers</Text>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: appTheme.colors.onSurface, textTransform: 'uppercase' }}>Terminal Permissions</Text>
                <Text style={{ fontSize: 12, color: appTheme.colors.onSurface, marginTop: 4 }}>Staff are restricted from accessing reports or inventory settings.</Text>
                <TouchableOpacity onPress={() => router.push('/(owner)/vendors' as any)} style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 11, color: appTheme.colors.onSurface, fontWeight: 'bold' }}>Edit Worker Permissions →</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card.Content>
        </Card>
      );
    }
  };

  const user = auth.currentUser;
  let userName = user?.displayName || user?.email?.split('@')[0] || 'Store Owner';
  if (userName.length > 0 && user?.email && userName === user.email.split('@')[0]) {
    userName = userName.charAt(0).toUpperCase() + userName.slice(1);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading BharatPOS Dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.content, { padding: screenWidth <= 600 ? 12 : 24 }]}>
 
        {/* ── Greeting Header ─────────────────────────────────────── */}
        <FadeInSection delay={0}>
          <View style={[styles.greetingContainer, screenWidth <= 600 && { flexDirection: 'column', alignItems: 'flex-start', gap: 12 }]}>
            <View>
              <Text style={styles.greetingText}>{getGreeting()}, {userName}! </Text>
              <Text style={styles.greetingSubtext}>{getFormattedDate()}</Text>
            </View>
            <View style={styles.greetingBadge}>
              <Icon name="store" size={16} color="#10B981" />
              <Text style={styles.greetingBadgeText}>Main Branch</Text>
            </View>
          </View>
        </FadeInSection>
 
        {/* ── Metric Cards ────────────────────────────────────────── */}
        <FadeInSection delay={100}>
          <View style={styles.metricsGrid}>
            {metrics.map((m, idx) => (
              <GradientMetricCard key={idx} config={m} />
            ))}
          </View>
        </FadeInSection>
 
        {/* ── Shop Mode Adaptive Console Widget ──────────────────── */}
        <FadeInSection delay={150}>
          {renderShopModeWidget()}
        </FadeInSection>
 
        {/* ── Chart + Recent Activity Row ─────────────────────────── */}
        <View style={styles.bottomRow}>
          {/* Sales Chart */}
          <FadeInSection delay={200}>
            <Card style={[styles.chartCard, { minWidth: screenWidth <= 600 ? '100%' : 500 }]} elevation={0}>
              <Card.Content>
                <View style={styles.chartHeader}>
                  <View>
                    <Text style={styles.chartTitle}>Sales Overview</Text>
                    <Text style={styles.chartSubtitle}>Last 7 days performance</Text>
                  </View>
                  <View style={styles.chartLegend}>
                    <View style={styles.legendDot} />
                    <Text style={styles.legendText}>Revenue (₹)</Text>
                  </View>
                </View>
                {(!chartData.length || chartData.every(val => val === 0)) ? (
                  <View style={{ height: 240, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderRadius: 16, marginVertical: 8 }}>
                    <Icon name="chart-line-variant" size={48} color="#94a3b8" style={{ marginBottom: 8 }} />
                    <Text style={{ color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>No Data Available</Text>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <LineChart
                      data={{
                        labels: chartLabels.length ? chartLabels : ["No Data"],
                        datasets: [{ data: chartData.length ? chartData : [0] }]
                      }}
                      width={Math.max(screenWidth - 380, 720)}
                      height={240}
                      withDots={true}
                      withInnerLines={true}
                      withOuterLines={false}
                      withVerticalLines={false}
                      withHorizontalLines={true}
                      withShadow={true}
                      fromZero={false}
                      yAxisLabel="₹"
                      yAxisSuffix=""
                      chartConfig={{
                        backgroundColor: "#ffffff",
                        backgroundGradientFrom: "#ffffff",
                        backgroundGradientTo: "#ffffff",
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(100, 100, 100, ${opacity})`,
                        style: { borderRadius: 16 },
                        propsForDots: { r: "5", strokeWidth: "2", stroke: "#10B981", fill: "#fff" },
                        propsForBackgroundLines: { stroke: '#F0F0F0', strokeDasharray: '' },
                        fillShadowGradientFrom: '#10B981',
                        fillShadowGradientTo: '#ffffff',
                        fillShadowGradientFromOpacity: 0.15,
                        fillShadowGradientToOpacity: 0,
                      }}
                      bezier
                      style={{ marginVertical: 8, borderRadius: 16 }}
                    />
                  </ScrollView>
                )}
              </Card.Content>
            </Card>
          </FadeInSection>
 
          {/* Recent Activity + Top Selling Column */}
          <View style={[styles.rightColumn, { minWidth: screenWidth <= 600 ? '100%' : 320 }]}>
            {/* Recent Activity Feed */}
            <FadeInSection delay={300}>
              <Card style={styles.activityCard} elevation={0}>
                <Card.Content>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Activity</Text>
                    <Icon name="history" size={18} color="#999" />
                  </View>
                  {recentActivity.length > 0 ? (
                    recentActivity.map((item) => (
                      <View key={item.id} style={styles.activityItem}>
                        <View style={[styles.activityIcon, { backgroundColor: item.color + '18' }]}>
                          <Icon name={item.icon} size={16} color={item.color} />
                        </View>
                        <View style={styles.activityContent}>
                          <Text style={styles.activityText} numberOfLines={2}>{item.text}</Text>
                          <Text style={styles.activityTime}>{item.time}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                      <Text style={{ color: appTheme.colors.onSurfaceVariant, fontSize: 13, fontStyle: 'italic' }}>No Data Available</Text>
                    </View>
                  )}
                </Card.Content>
              </Card>
            </FadeInSection>

            {/* Top Selling Products */}
            <FadeInSection delay={400}>
              <Card style={styles.topSellingCard} elevation={0}>
                <Card.Content>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Top Selling Products</Text>
                  </View>
                  {/* Table Header */}
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, { flex: 0.3 }]}>#</Text>
                    <Text style={[styles.tableHeaderText, { flex: 2 }]}>Product</Text>
                    <Text style={[styles.tableHeaderText, { flex: 0.6, textAlign: 'center' }]}>Qty</Text>
                    <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Revenue</Text>
                  </View>
                  {topSellingProducts.length > 0 ? (
                    topSellingProducts.map((p) => (
                      <View key={p.rank} style={styles.tableRow}>
                        <View style={[styles.rankBadge, p.rank <= 3 && { backgroundColor: p.rank === 1 ? '#FFF8E1' : p.rank === 2 ? '#F3E5F5' : '#E8F5E9' }]}>
                          <Text style={[styles.rankText, p.rank <= 3 && { color: p.rank === 1 ? '#F57F17' : p.rank === 2 ? '#7B1FA2' : '#2E7D32' }]}>{p.rank}</Text>
                        </View>
                        <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{p.name}</Text>
                        <Text style={[styles.tableCell, { flex: 0.6, textAlign: 'center', fontWeight: '600' }]}>{p.qty}</Text>
                        <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', fontWeight: '700', color: appTheme.colors.onSurface }]}>₹{p.revenue.toLocaleString('en-IN')}</Text>
                      </View>
                    ))
                  ) : (
                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                      <Text style={{ color: appTheme.colors.onSurfaceVariant, fontSize: 13, fontStyle: 'italic' }}>No Data Available</Text>
                    </View>
                  )}
                </Card.Content>
              </Card>
            </FadeInSection>
          </View>
        </View>

      </View>
    </ScrollView>
  );
}

// ── Premium Metric Card Component ──────────────────────────────────────
const GradientMetricCard = ({ config }: { config: MetricConfig }) => {
  const displayValue = useAnimatedCounter(config.value, 1400);
  const formatted = config.prefix
    ? `${config.prefix}${displayValue.toLocaleString('en-IN')}`
    : displayValue.toLocaleString('en-IN');

  return (
    <View style={styles.metricCardWrapper}>
      <Card style={styles.metricCard} elevation={0}>
        <Card.Content style={styles.metricCardContent}>
          <View style={styles.metricCardTop}>
            <View style={[styles.metricIconCircle, { backgroundColor: config.bgColor }]}>
              <Icon name={config.icon} size={20} color={config.color} />
            </View>
          </View>
          <View>
            <Text style={styles.metricValue}>{formatted}</Text>
            <Text style={styles.metricTitle}>{config.title}</Text>
          </View>
        </Card.Content>
      </Card>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, },
  content: { padding: 24 },

  // Greeting
  greetingContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  greetingText: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  greetingSubtext: { fontSize: 14, marginTop: 4 },
  greetingBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  greetingBadgeText: { marginLeft: 6, fontSize: 13, fontWeight: '600', },

  // Metrics Grid
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
  metricCardWrapper: { flexGrow: 1, flexBasis: '22%', minWidth: 220, maxWidth: 320 },
  metricCard: { borderRadius: 16, borderWidth: 1, },
  metricCardContent: { padding: 20, minHeight: 130, justifyContent: 'space-between' },
  metricCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  metricIconCircle: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  metricTitle: { fontSize: 13, marginTop: 4, fontWeight: '600' },

  // Bottom Row
  bottomRow: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  rightColumn: { flex: 1, minWidth: 320, gap: 20 },

  // Chart
  chartCard: { flex: 2, minWidth: 500, borderRadius: 16, borderWidth: 1, },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chartTitle: { fontSize: 17, fontWeight: '700', },
  chartSubtitle: { fontSize: 12, marginTop: 2 },
  chartLegend: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 12, },

  // Section Headers
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', },

  // Activity Feed
  activityCard: { borderRadius: 16, borderWidth: 1, },
  activityItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  activityIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
  activityContent: { flex: 1 },
  activityText: { fontSize: 13, lineHeight: 18 },
  activityTime: { fontSize: 11, marginTop: 3 },
  // Top Selling
  topSellingCard: { borderRadius: 16, borderWidth: 1, },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', marginBottom: 4 },
  tableHeaderText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  rankBadge: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rankText: { fontSize: 12, fontWeight: '700', },
  tableCell: { fontSize: 13, },

  // Shop Mode Card styles
  modeCard: { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 24 },
  modeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  modeCardTitle: { fontSize: 16, fontWeight: '800', },
  modeCardSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  modeCardDesc: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  modeActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modeActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, },
  modeActionText: { fontSize: 11, fontWeight: '700', },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#0284C7' },
  syncText: { fontSize: 12, fontWeight: '700' },
  modeIconCircle: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
