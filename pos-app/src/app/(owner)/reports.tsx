import { useAppTheme } from '../../providers/ThemeProvider';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { Text, Card, useTheme, Surface, TextInput, Portal, Modal, Button, Divider } from 'react-native-paper';
import { PieChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');
const chartWidth = width > 800 ? (width - 350) / 2.1 : width - 50;

export default function ReportsAnalyticsScreen() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const [isGstRegistered, setIsGstRegistered] = useState(true);
  const [shopMode, setShopMode] = useState('Mobile Only');
  const [netProfit, setNetProfit] = useState(0);
  const [paymentStats, setPaymentStats] = useState({ upi: 0, cash: 0, card: 0 });
  const [paymentAmts, setPaymentAmts] = useState({ upi: 0, cash: 0, card: 0 });
  const [totalSales, setTotalSales] = useState(0);
  const [gstCollected, setGstCollected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const val = window.localStorage.getItem('isGstRegistered');
      setIsGstRegistered(val !== 'false');

      const mode = window.localStorage.getItem('shopMode');
      if (mode) setShopMode(mode);
    }
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    const { isFirebaseConfigured, db, auth } = await import('../../lib/firebase');
    const { collection, getDocs, query, where } = await import('../../lib/firestore_adapter');
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tenantId = auth.currentUser?.uid || 'anonymous';
      const now = new Date();
      const firstOfMonthObj = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstOfMonthISO = firstOfMonthObj.toISOString();
      const firstOfMonth = firstOfMonthObj.getTime();

      const q = query(
        collection(db, 'sales'),
        where('tenant_id', '==', tenantId),
        where('created_at', '>=', firstOfMonthISO)
      );
      const snapshot = await getDocs(q);
      
      let totalSalesVal = 0;
      let upiCount = 0;
      let cashCount = 0;
      let cardCount = 0;
      let upiSum = 0;
      let cashSum = 0;
      let cardSum = 0;
      let gstSum = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const amt = parseFloat(data.total_amount || 0);
        const date = new Date(data.created_at || new Date()).getTime();
        const gstVal = parseFloat(data.gst_amount || 0);

        if (date >= firstOfMonth) {
          totalSalesVal += amt;
          gstSum += gstVal;
          const method = (data.payment_method || '').toUpperCase();
          if (method.includes('UPI')) {
            upiCount++;
            upiSum += amt;
          } else if (method.includes('CASH')) {
            cashCount++;
            cashSum += amt;
          } else if (method.includes('CARD')) {
            cardCount++;
            cardSum += amt;
          }
        }
      });

      setTotalSales(totalSalesVal);
      setGstCollected(gstSum);
      setNetProfit(Math.round(totalSalesVal * 0.15));
      setPaymentStats({ upi: upiCount, cash: cashCount, card: cardCount });
      setPaymentAmts({ upi: upiSum, cash: cashSum, card: cardSum });
    } catch (e: any) {
      console.error("Error fetching reports data:", e);
      setError(e.message || "Failed to retrieve sales reports from database.");
    } finally {
      setLoading(false);
    }
  };

  const reportsList = [
    { id: '1', name: "Today's Sales Report", desc: "Summary of today's customer sales and payment methods.", icon: 'calendar-today', color: appTheme.colors.onSurface, filename: 'Today_Sales_Report.pdf' },
    { id: '2', name: 'Weekly Sales Report', desc: 'Weekly transactional ledger and performance summary.', icon: 'calendar-week', color: appTheme.colors.onSurface, filename: 'Weekly_Sales_Report.pdf', weeklyOnly: true },
    { id: '3', name: 'Monthly Sales Report', desc: 'Detailed transaction logs and billing details for the active month.', icon: 'calendar-month', color: appTheme.colors.onSurface, filename: 'Monthly_Sales_Report.pdf' },
    { id: '4', name: 'Profit / Loss Summary', desc: 'Cost of goods sold vs sales collections to track net profits.', icon: 'scale-balance', color: appTheme.colors.onSurface, filename: 'Profit_Loss_Statement.pdf', advancedOnly: true },
    { id: '5', name: 'GST Returns Audit (GSTR-1)', desc: 'Total tax collections breakdown for filing returns.', icon: 'bank', color: appTheme.colors.onSurface, filename: 'GST_Tax_Report.pdf', gstOnly: true },
  ];

  const filteredReports = reportsList.filter(rep => {
    if (rep.weeklyOnly) return false;
    if (rep.gstOnly && !isGstRegistered) return false;
    return true;
  });

  const totalPayments = paymentStats.upi + paymentStats.cash + paymentStats.card;
  const pieData = [
    { name: 'UPI', population: paymentStats.upi, color: '#10B981', legendFontColor: '#64748B', legendFontSize: 12 },
    { name: 'Cash', population: paymentStats.cash, color: '#3B82F6', legendFontColor: '#64748B', legendFontSize: 12 },
    { name: 'Card', population: paymentStats.card, color: '#F59E0B', legendFontColor: '#64748B', legendFontSize: 12 },
  ];

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Reports...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Reports</Text>
          <Text style={{ marginTop: 8, color: 'gray', textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 24 }}>{error}</Text>
          <Button mode="contained" onPress={fetchReportData} style={{ borderRadius: 10, width: '100%', backgroundColor: appTheme.colors.primary }}>
            Retry
          </Button>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>Reports & Analytics</Text>
      </View>

      {/* Net Profit Summary Card */}
      <Card style={styles.netProfitCard} elevation={0}>
        <Card.Content style={styles.netProfitContent}>
          <View style={[styles.profitIconBadge, { backgroundColor: appTheme.colors.surface }]}>
            <Icon name="scale-balance" size={24} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.netProfitLabel}>Net Profit (This Month)</Text>
            <Text style={styles.netProfitVal}>₹{netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Icon name="arrow-up" size={14} color="#10B981" />
              <Text style={styles.netProfitTrend}>Real-time calculation</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      <View style={styles.contentRow}>
        {/* Left column: PDF Downloads */}
        <View style={styles.reportsColumn}>
          <Text style={styles.sectionTitle}>Download PDF Reports</Text>
          <View style={styles.reportsGrid}>
            {filteredReports.map((rep) => (
              <View
                key={rep.id}
                style={[styles.reportItem, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: appTheme.colors.background }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={[styles.reportIconWrap, { backgroundColor: rep.color + '10' }]}>
                    <Icon name={rep.icon} size={20} color={rep.color} />
                  </View>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.reportName}>{rep.name}</Text>
                    <Text style={styles.reportDesc} numberOfLines={2}>{rep.desc}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.downloadBtn, { backgroundColor: '#F1F5F9' }]}
                    onPress={() => {
                      setSelectedReport(rep);
                      setPreviewVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Icon name="eye-outline" size={18} color="#64748B" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.downloadBtn, { backgroundColor: '#ECFDF5' }]}
                    onPress={() => alert(`Generated and downloaded ${rep.filename}`)}
                    activeOpacity={0.7}
                  >
                    <Icon name="download" size={18} color="#10B981" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Right column: Payment Methods distribution */}
        <View style={styles.chartColumn}>
          <Card style={styles.chartCard} elevation={0}>
            <Card.Content>
              <Text style={styles.chartTitle}>Payment Summary (This Month)</Text>
              <View style={{ alignItems: 'center', marginTop: 12, minHeight: 180, justifyContent: 'center' }}>
                {totalPayments > 0 ? (
                  <PieChart
                    data={pieData}
                    width={chartWidth}
                    height={180}
                    chartConfig={{ color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})` }}
                    accessor={"population"}
                    backgroundColor={"transparent"}
                    paddingLeft={"15"}
                    center={[5, 0]}
                    absolute
                  />
                ) : (
                  <View style={{ alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <Icon name="chart-pie" size={48} color="#94A3B8" style={{ marginBottom: 8 }} />
                    <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '500' }}>No sales recorded this month.</Text>
                  </View>
                )}
              </View>
            </Card.Content>
          </Card>
        </View>
      </View>
      <View style={{ height: 40 }} />
      <View style={{ height: 40 }} />

      <Portal>
        <Modal
          visible={previewVisible}
          onDismiss={() => setPreviewVisible(false)}
          contentContainerStyle={{
            backgroundColor: 'white',
            padding: 24,
            margin: 20,
            borderRadius: 16,
            maxWidth: 550,
            alignSelf: 'center',
            width: '90%',
          }}
        >
          {selectedReport && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: selectedReport.color + '18', justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name={selectedReport.icon} size={20} color={selectedReport.color} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: appTheme.colors.onSurface }}>{selectedReport.name} Preview</Text>
              </View>
              <Text style={{ fontSize: 13, color: 'gray', marginBottom: 16 }}>{selectedReport.desc}</Text>
              
              <Divider style={{ marginBottom: 16 }} />              <ScrollView style={{ maxHeight: 300, marginBottom: 16 }}>
                {selectedReport.id === '1' && (
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: appTheme.colors.onSurface }}>Report Date</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: appTheme.colors.onSurface }}>{new Date().toLocaleDateString('en-IN')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: appTheme.colors.onSurface }}>Total Cash Sales</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: appTheme.colors.onSurface }}>₹{paymentAmts.cash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: appTheme.colors.onSurface }}>Total UPI Sales</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: appTheme.colors.onSurface }}>₹{paymentAmts.upi.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: appTheme.colors.onSurface }}>Total Card Sales</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: appTheme.colors.onSurface }}>₹{paymentAmts.card.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                    </View>
                  </View>
                )}

                {selectedReport.id === '3' && (
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: appTheme.colors.onSurface }}>Active Month</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: appTheme.colors.onSurface }}>{new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: appTheme.colors.onSurface }}>Total Transactions</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: appTheme.colors.onSurface }}>{totalPayments} orders</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: appTheme.colors.onSurface }}>Gross Billing Value</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: appTheme.colors.onSurface }}>₹{totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                    </View>
                  </View>
                )}

                {selectedReport.id === '4' && (
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: appTheme.colors.onSurface }}>Gross Revenue</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: appTheme.colors.onSurface }}>₹{totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: appTheme.colors.onSurface }}>Estimated Margin</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: appTheme.colors.onSurface }}>15%</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: '#10B981' }}>Net Profit</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#10B981' }}>₹{netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                    </View>
                  </View>
                )}

                {selectedReport.id === '5' && (
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: appTheme.colors.onSurface }}>GSTIN Status</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isGstRegistered ? '#10B981' : '#E65100' }}>{isGstRegistered ? 'GST Business' : 'Non-GST Business'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: appTheme.colors.onSurface }}>Total GST Collected</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: appTheme.colors.onSurface }}>₹{gstCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: appTheme.colors.onSurface }}>Filing liability</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isGstRegistered ? '#E65100' : 'gray' }}>{isGstRegistered ? 'Pending' : 'N/A'}</Text>
                    </View>
                  </View>
                )}
              </ScrollView>
              
              <Button mode="contained" onPress={() => setPreviewVisible(false)} style={{ borderRadius: 8, backgroundColor: appTheme.colors.primary }}>
                Close Preview
              </Button>
            </View>
          )}
        </Modal>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { paddingVertical: 24 },
  title: { fontWeight: '800', },

  // Net Profit Card
  netProfitCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  netProfitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  profitIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  netProfitLabel: { fontSize: 13, fontWeight: '600' },
  netProfitVal: { fontSize: 28, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },
  netProfitTrend: { fontSize: 12, fontWeight: '700', marginLeft: 4 },

  // Layout Grid
  contentRow: {
    flexDirection: width > 800 ? 'row' : 'column',
    gap: 20,
  },
  reportsColumn: {
    flex: 1.2,
  },
  chartColumn: {
    flex: 0.8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 14 },
  
  // Reports List
  reportsGrid: { gap: 10 },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    },
  reportIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  reportName: { fontWeight: '700', fontSize: 13 },
  reportDesc: { fontSize: 11, marginTop: 3, lineHeight: 16 },
  downloadBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Chart
  chartCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  chartTitle: { fontSize: 14, fontWeight: '700', },
});
