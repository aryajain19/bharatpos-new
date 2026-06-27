import { useAppTheme } from '../../../providers/ThemeProvider';
import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { Text, useTheme, Surface, TextInput, Card, Button } from 'react-native-paper';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { collection, query, where, orderBy, getDocs } from '../../../lib/firestore_adapter';
import { useAuth } from '../../../providers/AuthProvider';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// --- Date filter options ---
type DateFilter = 'today' | 'week' | 'month';

// --- Payment modes ---


// --- Demo sales data ---


export default function SalesHistoryScreen() {
  const appTheme = useTheme();

  const PAYMENT_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
    Cash: { icon: 'cash', color: appTheme.colors.onSurface, bg: '#E8F5E9' },
    UPI: { icon: 'cellphone-nfc', color: appTheme.colors.onSurface, bg: '#D1FAE5' },
    Card: { icon: 'credit-card-outline', color: appTheme.colors.onSurface, bg: '#E3F2FD' },
  };

  const { isDarkMode, toggleTheme } = useAppTheme();

  const { user, tenantId, loading: authLoading } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<DateFilter>('today');

  // Animations
  const headerFade = useRef(new Animated.Value(0)).current;
  const statsFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchSales();
    Animated.stagger(200, [
      Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(statsFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [user]);

  const fetchSales = async () => {
    if (!isFirebaseConfigured || !user) {
      setSales([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, 'sales'),
        where('tenant_id', '==', tenantId || 'anonymous'),
        where('vendor_id', '==', user.uid),
        orderBy('created_at', 'desc')
      );
      const snapshot = await getDocs(q);
      const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSales(salesData);
    } catch (err: any) {
      console.error("Error fetching vendor sales:", err);
      setError(err.message || "Failed to load sales history.");
    } finally {
      setLoading(false);
    }
  };

  // Filter sales by date range
  const getFilteredSales = () => {
    const now = new Date();
    return sales.filter(s => {
      const saleDate = new Date(s.created_at);
      if (activeFilter === 'today') {
        return saleDate.toDateString() === now.toDateString();
      } else if (activeFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 3600000);
        return saleDate >= weekAgo;
      }
      return true; // month — show all
    });
  };

  const filteredSales = getFilteredSales();

  // Summary Stats
  const totalSales = filteredSales.reduce((sum, s) => sum + s.total_amount, 0);
  const totalBills = filteredSales.length;
  const avgBill = totalBills > 0 ? totalSales / totalBills : 0;

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const renderSale = ({ item, index }: any) => {
    const dateObj = new Date(item.created_at);
    const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const payInfo = PAYMENT_ICONS[item.payment_mode] || PAYMENT_ICONS.Cash;

    return (
      <Surface style={styles.saleCard} elevation={1}>
        <View style={styles.saleCardTop}>
          <View style={styles.saleLeft}>
            <Text style={styles.billNumber}>{item.bill_no}</Text>
            <Text style={styles.customerName}>{item.customer || 'Walk-in Customer'}</Text>
          </View>
          <View style={styles.saleRight}>
            <Text style={styles.saleAmount}>{fmt(item.total_amount)}</Text>
          </View>
        </View>

        <View style={styles.saleDivider} />

        <View style={styles.saleCardBottom}>
          <View style={styles.saleMetaItem}>
            <Icon name="calendar-clock" size={13} color="#999" />
            <Text style={styles.saleMetaText}>{dateStr}, {timeStr}</Text>
          </View>
          <View style={styles.saleMetaItem}>
            <Icon name="package-variant" size={13} color="#999" />
            <Text style={styles.saleMetaText}>{item.items_count} items</Text>
          </View>
          <View style={[styles.paymentBadge, { backgroundColor: payInfo.bg }]}>
            <Icon name={payInfo.icon} size={12} color={payInfo.color} />
            <Text style={[styles.paymentText, { color: payInfo.color }]}>{item.payment_mode}</Text>
          </View>
        </View>
      </Surface>
    );
  };

  const DATE_FILTERS: { key: DateFilter; label: string; icon: string }[] = [
    { key: 'today', label: 'Today', icon: 'calendar-today' },
    { key: 'week', label: 'This Week', icon: 'calendar-week' },
    { key: 'month', label: 'This Month', icon: 'calendar-month' },
  ];

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Sales History...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Sales History</Text>
          <Text style={{ marginTop: 8, color: 'gray', textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 24 }}>{error}</Text>
          <Button mode="contained" onPress={fetchSales} style={{ borderRadius: 10, width: '100%', backgroundColor: appTheme.colors.primary }}>
            Retry Sync
          </Button>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Animated.View style={[styles.headerInner, { opacity: headerFade }]}>
          <Text style={styles.headerTitle}>Sales History</Text>
          <Text style={styles.headerSubtitle}>{totalBills} transactions</Text>
        </Animated.View>
      </View>

      <View style={styles.content}>
        {/* Summary Stats */}
        <Animated.View style={[styles.statsRow, { opacity: statsFade }]}>
          <Surface style={styles.statCard} elevation={2}>
            <View style={[styles.statIcon, { backgroundColor: appTheme.colors.surface }]}>
              <Icon name="currency-inr" size={18} color="#4CAF50" />
            </View>
            <Text style={styles.statValue}>{fmt(totalSales)}</Text>
            <Text style={styles.statLabel}>Total Sales</Text>
          </Surface>
          <Surface style={styles.statCard} elevation={2}>
            <View style={[styles.statIcon, { backgroundColor: appTheme.colors.surface }]}>
              <Icon name="chart-line" size={18} color="#1565C0" />
            </View>
            <Text style={styles.statValue}>{fmt(avgBill)}</Text>
            <Text style={styles.statLabel}>Avg Bill</Text>
          </Surface>
          <Surface style={styles.statCard} elevation={2}>
            <View style={[styles.statIcon, { backgroundColor: appTheme.colors.surface }]}>
              <Icon name="receipt" size={18} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{totalBills}</Text>
            <Text style={styles.statLabel}>Total Bills</Text>
          </Surface>
        </Animated.View>

        {/* Date Filters Hidden for Worker (Today Only) */}

        {/* Sales List */}
        <FlatList
          data={filteredSales}
          keyExtractor={item => item.id}
          renderItem={renderSale}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="receipt-text-clock-outline" size={52} color="#CCC" />
              <Text style={styles.emptyTitle}>No sales found</Text>
              <Text style={styles.emptySubtitle}>Try changing the date filter</Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, },

  // --- Header ---
  header: { paddingHorizontal: 24, paddingTop: 52, paddingBottom: 24 },
  headerInner: {},
  headerTitle: { color: 'white', fontSize: 26, fontWeight: 'bold', marginBottom: 4 },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },

  // --- Content ---
  content: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 20, paddingHorizontal: 20 },

  // --- Stats Row ---
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  statLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },

  // --- Date Filters ---
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 1,
    },
  filterChipActive: { },
  filterText: { fontSize: 12, fontWeight: '600', },
  filterTextActive: { color: 'white' },

  // --- Sale Card ---
  saleCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  saleCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  saleLeft: { flex: 1 },
  billNumber: { fontWeight: 'bold', fontSize: 15, marginBottom: 3 },
  customerName: { fontSize: 12, },
  saleRight: { alignItems: 'flex-end' },
  saleAmount: { fontWeight: 'bold', fontSize: 18, },

  saleDivider: { height: 1, marginVertical: 12 },

  saleCardBottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  saleMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  saleMetaText: { fontSize: 11, },
  paymentBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4, marginLeft: 'auto' },
  paymentText: { fontSize: 10, fontWeight: '700' },

  // --- List ---
  listContent: { paddingBottom: 40 },

  // --- Empty ---
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 16 },
  emptySubtitle: { fontSize: 13, marginTop: 4 },
});
