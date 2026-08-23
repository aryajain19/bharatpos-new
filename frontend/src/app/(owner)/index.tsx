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
import { DS } from '../../constants/designTokens';
import POSAssistantModal from '../../components/POSAssistantModal';

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
  changeText?: string;
  changeColor?: string;
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
  const [showAssistantModal, setShowAssistantModal] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

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

      const now = new Date();
      const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startDate = sevenDaysAgo < firstOfMonth ? sevenDaysAgo : firstOfMonth;
      const startDateISO = startDate.toISOString();

      // Fire all 4 queries concurrently in parallel
      const workersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'salesperson'),
        where('tenant_id', '==', tenantId)
      );
      const shopDocRef = doc(db, 'shops', tenantId);
      const productsQuery = query(collection(db, 'products'), where('tenant_id', '==', tenantId));
      const salesQuery = query(
        collection(db, 'sales'),
        where('tenant_id', '==', tenantId),
        where('created_at', '>=', startDateISO)
      );

      const [workersRes, shopRes, prodsRes, salesRes] = await Promise.allSettled([
        getDocs(workersQuery),
        getDoc(shopDocRef),
        getDocs(productsQuery),
        getDocs(salesQuery),
      ]);

      // Process Workers
      if (workersRes.status === 'fulfilled') {
        const wList: any[] = [];
        workersRes.value.forEach((d: any) => {
          wList.push({ id: d.id, ...d.data() });
        });
        setWorkersList(wList);
      }

      // Process Shop Metadata
      let sCode = '';
      if (shopRes.status === 'fulfilled' && shopRes.value.exists && shopRes.value.exists()) {
        const shopData = shopRes.value.data();
        sCode = shopData.syncCode || shopData.sync_code;
      }
      if (!sCode) {
        sCode = `POS-${tenantId.substring(0, 6).toUpperCase()}`;
      }
      setShopSyncCode(sCode);

      // Process Products for Low Stock & AI Copilot
      if (prodsRes.status === 'fulfilled') {
        let lowStock = 0;
        const pList: any[] = [];
        prodsRes.value.forEach((d: any) => {
          const pData = d.data();
          const pObj = { id: d.id, ...pData, price: pData.selling_price || pData.price || 0 };
          pList.push(pObj);
          if ((pData.stock_qty || pData.stock_quantity || 0) < 5) lowStock++;
        });
        setProducts(pList);
        setLowStockAlertCount(lowStock);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.localStorage.setItem('cachedLowStock', String(lowStock));
        }
      }

      // Process Sales
      if (salesRes.status === 'fulfilled') {
        processSalesData(salesRes.value.docs);
      }

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

  // Comparison Calculations
  const salesDiff = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : 0;
  const salesDiffText = salesDiff >= 0 ? `+${salesDiff.toFixed(0)}% vs yesterday` : `${salesDiff.toFixed(0)}% vs yesterday`;
  const salesDiffColor = salesDiff >= 0 ? '#16A34A' : '#DC2626';

  const profitMarginText = todaySales > 0 ? `${((totalProfit / todaySales) * 100).toFixed(0)}% net margin` : '0% net margin';
  const lowStockAlertText = lowStockAlertCount > 0 ? `${lowStockAlertCount} items need attention` : 'All items in stock';

  const metrics: MetricConfig[] = shopMode === 'Mobile Only' ? (
    isGstRegistered ? [
      { title: "Today's Sales", value: salesValue, prefix: '₹', icon: 'currency-inr', color: '#16A34A', bgColor: '#F0FDF4', changeText: salesDiffText, changeColor: salesDiffColor },
      { title: "Total Amount Collected", value: salesValue, prefix: '₹', icon: 'cash-check', color: '#16A34A', bgColor: '#F0FDF4', changeText: 'Settled to bank', changeColor: '#6B7280' },
      { title: "Total Profit", value: totalProfit, prefix: '₹', icon: 'trending-up', color: '#16A34A', bgColor: '#F0FDF4', changeText: profitMarginText, changeColor: '#16A34A' },
      { title: "GST Collected", value: 0, prefix: '₹', icon: 'bank', color: '#4B5563', bgColor: '#F9FAFB', changeText: 'Tax Portal synced', changeColor: '#6B7280' },
    ] : [
      { title: "Today's Sales", value: salesValue, prefix: '₹', icon: 'currency-inr', color: '#16A34A', bgColor: '#F0FDF4', changeText: salesDiffText, changeColor: salesDiffColor },
      { title: "Total Amount Collected", value: salesValue, prefix: '₹', icon: 'cash-check', color: '#16A34A', bgColor: '#F0FDF4', changeText: 'Settled to bank', changeColor: '#6B7280' },
      { title: "Coming Soon (Khata)", value: 0, prefix: '₹', icon: 'account-clock', color: '#4B5563', bgColor: '#F9FAFB', changeText: 'Bookkeeping module', changeColor: '#6B7280' },
      { title: "Low Stock Alert", value: lowStockAlertCount, icon: 'alert-outline', color: '#DC2626', bgColor: '#FEF2F2', changeText: lowStockAlertText, changeColor: lowStockAlertCount > 0 ? '#DC2626' : '#16A34A' },
    ]
  ) : [
    { title: "Today's Sales", value: salesValue, prefix: '₹', icon: 'currency-inr', color: '#16A34A', bgColor: '#F0FDF4', changeText: salesDiffText, changeColor: salesDiffColor },
    { title: "Yesterday's Sales", value: yesterdaySales, prefix: '₹', icon: 'chart-timeline-variant', color: '#4B5563', bgColor: '#F9FAFB', changeText: 'Previous day revenue', changeColor: '#6B7280' },
    { title: "Monthly Sales", value: monthlySales, prefix: '₹', icon: 'calendar-month', color: '#16A34A', bgColor: '#F0FDF4', changeText: 'Target: ₹1,00,000', changeColor: '#16A34A' },
    { title: "Total Profit", value: totalProfit, prefix: '₹', icon: 'trending-up', color: '#16A34A', bgColor: '#F0FDF4', changeText: profitMarginText, changeColor: '#16A34A' },
    { title: "Low Stock Alert", value: lowStockAlertCount, icon: 'alert-outline', color: '#DC2626', bgColor: '#FEF2F2', changeText: lowStockAlertText, changeColor: lowStockAlertCount > 0 ? '#DC2626' : '#16A34A' },
  ];

  const renderShopModeWidget = () => {
    if (shopMode === 'Mobile Only') {
      return (
        <Card style={styles.modeCard} elevation={0}>
          <Card.Content>
            <View style={styles.modeCardHeader}>
              <View style={[styles.modeIconCircle, { backgroundColor: appTheme.colors.surface }]}>
                <Icon name="cellphone" size={20} color="#10B981" />
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
                <Icon name="package-variant-plus" size={16} color="#10B981" />
                <Text style={styles.modeActionText}>Add Products</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modeActionBtn} onPress={() => router.push('/(owner)/barcode_generator' as any)}>
                <Icon name="barcode" size={16} color="#2E7D32" />
                <Text style={styles.modeActionText}>Create Barcode</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modeActionBtn} onPress={() => router.push('/(owner)/inventory' as any)}>
                <Icon name="clipboard-list" size={16} color="#10B981" />
                <Text style={styles.modeActionText}>Stock Management</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modeActionBtn} onPress={() => router.push('/(owner)/upgrade' as any)}>
                <Icon name="star-outline" size={16} color="#10B981" />
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
              <Icon name="cellphone-link-variant" size={20} color="#10B981" />
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
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.greetingBadge, { backgroundColor: isDarkMode ? '#10B981' : '#ECFDF5' }]}
                onPress={() => setShowAssistantModal(true)}
              >
                <Icon name="robot-happy" size={16} color={isDarkMode ? '#FFFFFF' : '#10B981'} />
                <Text style={[styles.greetingBadgeText, { color: isDarkMode ? '#FFFFFF' : '#10B981', fontWeight: '700' }]}>
                  AI Copilot 🎙️
                </Text>
              </TouchableOpacity>
              <View style={styles.greetingBadge}>
                <Icon name="store" size={16} color="#10B981" />
                <Text style={styles.greetingBadgeText}>Main Branch</Text>
              </View>
            </View>
          </View>
        </FadeInSection>

        {/* ── Conversational AI Copilot Bar ──────────────────────── */}
        <FadeInSection delay={50}>
          <TouchableOpacity
            style={[
              styles.aiCopilotBanner,
              { backgroundColor: isDarkMode ? '#0F172A' : '#ECFDF5', borderColor: isDarkMode ? '#1E293B' : '#A7F3D0' }
            ]}
            onPress={() => setShowAssistantModal(true)}
            activeOpacity={0.85}
          >
            <View style={styles.aiCopilotLeft}>
              <View style={[styles.aiCopilotIconBox, { backgroundColor: '#10B981' }]}>
                <Icon name="robot-happy" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.aiCopilotTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
                    BharatPOS AI Voice Assistant
                  </Text>
                  <View style={styles.aiNewPill}>
                    <Text style={styles.aiNewPillText}>AI COPILOT</Text>
                  </View>
                </View>
                <Text style={[styles.aiCopilotSub, { color: isDarkMode ? '#94A3B8' : '#047857' }]}>
                  Speak or type: "Add 2 Milk and 1 Bread", "Check stock for Sugar", "Today's sales"
                </Text>
              </View>
            </View>
            <View style={styles.aiMicBtn}>
              <Icon name="microphone" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
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
                      withInnerLines={false}
                      withOuterLines={false}
                      withVerticalLines={false}
                      withHorizontalLines={false}
                      withShadow={true}
                      fromZero={false}
                      yAxisLabel="₹"
                      yAxisSuffix=""
                      chartConfig={{
                        backgroundColor: "#ffffff",
                        backgroundGradientFrom: "#ffffff",
                        backgroundGradientTo: "#ffffff",
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(22, 163, 74, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                        style: { borderRadius: 12 },
                        propsForDots: { r: "4", strokeWidth: "2", stroke: "#16A34A", fill: "#fff" },
                        propsForBackgroundLines: { stroke: '#F3F4F6', strokeDasharray: '' },
                        fillShadowGradientFrom: '#16A34A',
                        fillShadowGradientTo: '#ffffff',
                        fillShadowGradientFromOpacity: 0.1,
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

      {/* Floating AI Voice Assistant Button */}
      <TouchableOpacity
        style={styles.floatingAiFab}
        onPress={() => setShowAssistantModal(true)}
        activeOpacity={0.85}
      >
        <Icon name="robot-happy" size={24} color="#FFFFFF" />
        <View style={styles.floatingAiPulse} />
      </TouchableOpacity>

      {/* POS Conversational AI Assistant Modal */}
      <POSAssistantModal
        visible={showAssistantModal}
        onClose={() => setShowAssistantModal(false)}
        products={products}
        contextData={{
          todaySales: salesValue,
          todayBills: ordersValue,
        }}
      />
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
          <View style={styles.metricCardHeader}>
            <Text style={styles.metricTitle}>{config.title}</Text>
            <View style={[styles.metricIconCircle, { backgroundColor: config.bgColor }]}>
              <Icon name={config.icon} size={16} color={config.color} />
            </View>
          </View>
          <View style={styles.metricBody}>
            <Text style={styles.metricValue}>{formatted}</Text>
            {config.changeText && (
              <Text style={[styles.metricChangeText, { color: config.changeColor || '#6B7280' }]}>
                {config.changeText}
              </Text>
            )}
          </View>
        </Card.Content>
      </Card>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.colors.surfaceBg },
  content: { padding: DS.space.lg },

  // Greeting
  greetingContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.space.xl },
  greetingText: { fontSize: DS.font.h1.fontSize, fontWeight: DS.font.h1.fontWeight, letterSpacing: DS.font.h1.letterSpacing, color: DS.colors.text },
  greetingSubtext: { fontSize: DS.font.body.fontSize, marginTop: DS.space.xs, color: DS.colors.textSecondary },
  greetingBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: DS.radius.full, backgroundColor: '#F0FDF4' },
  greetingBadgeText: { marginLeft: 6, fontSize: DS.font.caption.fontSize, fontWeight: DS.font.caption.fontWeight, color: DS.colors.brand },

  // Metrics Grid
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: DS.space.md, marginBottom: DS.space.lg },
  metricCardWrapper: { flexGrow: 1, flexBasis: '22%', minWidth: 220, maxWidth: 320 },
  metricCard: { borderRadius: 12, backgroundColor: DS.colors.cardBg, borderWidth: 1, borderColor: DS.colors.border },
  metricCardContent: { padding: 16, minHeight: 110, justifyContent: 'space-between' },
  metricCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  metricIconCircle: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  metricBody: { gap: 2 },
  metricValue: { fontSize: 24, fontWeight: '700', color: DS.colors.text },
  metricTitle: { fontSize: 13, fontWeight: '500', color: DS.colors.textSecondary },
  metricChangeText: { fontSize: 12, fontWeight: '600' },

  // Bottom Row
  bottomRow: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  rightColumn: { flex: 1, minWidth: 320, gap: 20 },

  // Chart
  chartCard: { flex: 2, minWidth: 500, borderRadius: 12, backgroundColor: DS.colors.cardBg, borderWidth: 1, borderColor: DS.colors.border },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chartTitle: { fontSize: DS.font.h3.fontSize, fontWeight: DS.font.h3.fontWeight, color: DS.colors.text },
  chartSubtitle: { fontSize: DS.font.caption.fontSize, marginTop: 2, color: DS.colors.textSecondary },
  chartLegend: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6, backgroundColor: DS.colors.brand },
  legendText: { fontSize: DS.font.caption.fontSize, color: DS.colors.textSecondary },

  // Section Headers
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: DS.font.h3.fontSize, fontWeight: DS.font.h3.fontWeight, color: DS.colors.text },

  // Activity Feed
  activityCard: { borderRadius: 12, backgroundColor: DS.colors.cardBg, borderWidth: 1, borderColor: DS.colors.border },
  activityItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  activityIcon: { width: 34, height: 34, borderRadius: DS.radius.sm, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
  activityContent: { flex: 1 },
  activityText: { fontSize: 13, lineHeight: 18, color: DS.colors.text },
  activityTime: { fontSize: DS.font.caption.fontSize, marginTop: 3, color: DS.colors.textMuted },

  // Top Selling
  topSellingCard: { borderRadius: 12, backgroundColor: DS.colors.cardBg, borderWidth: 1, borderColor: DS.colors.border },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: DS.colors.border, marginBottom: 4 },
  tableHeaderText: { fontSize: DS.font.label.fontSize, fontWeight: DS.font.label.fontWeight, textTransform: 'uppercase', letterSpacing: DS.font.label.letterSpacing, color: DS.colors.textSecondary },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: DS.colors.borderLight },
  rankBadge: { width: 26, height: 26, borderRadius: DS.radius.sm, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rankText: { fontSize: DS.font.caption.fontSize, fontWeight: '700' },
  tableCell: { fontSize: 13, color: DS.colors.text },

  // Shop Mode Card styles
  modeCard: { borderRadius: 12, backgroundColor: DS.colors.cardBg, borderWidth: 1, borderColor: DS.colors.border, padding: 20, marginBottom: 24 },
  modeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  modeCardTitle: { fontSize: 16, fontWeight: '800', color: DS.colors.text },
  modeCardSubtitle: { fontSize: DS.font.label.fontSize, fontWeight: '600', marginTop: 2, color: DS.colors.textSecondary },
  modeCardDesc: { fontSize: 13, lineHeight: 18, marginBottom: 16, color: DS.colors.textSecondary },
  modeActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modeActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: DS.radius.sm, borderWidth: 1, borderColor: DS.colors.border, backgroundColor: DS.colors.cardBg },
  modeActionText: { fontSize: DS.font.label.fontSize, fontWeight: '700', color: DS.colors.textSecondary },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: DS.radius.md, borderLeftWidth: 4, borderLeftColor: DS.colors.brand, backgroundColor: DS.colors.brandLight },
  syncText: { fontSize: 12, fontWeight: '700', color: DS.colors.brand },
  modeIconCircle: { width: 42, height: 42, borderRadius: DS.radius.md, alignItems: 'center', justifyContent: 'center' },

  // AI Copilot Banner & Floating Button
  aiCopilotBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  aiCopilotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  aiCopilotIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiCopilotTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  aiNewPill: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiNewPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  aiCopilotSub: {
    fontSize: 12,
    marginTop: 2,
  },
  aiMicBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  floatingAiFab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  floatingAiPulse: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
