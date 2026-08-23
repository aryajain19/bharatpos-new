import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions, Platform, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Text, useTheme, Card, Button, Divider, Surface, TextInput } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { DS } from '../../constants/designTokens';

export default function ProfitLossScreen() {
  const { tenantId, loading: authLoading } = useAuth();
  const { isDarkMode } = useAppTheme();
  const appTheme = useTheme();

  const { width } = useWindowDimensions();
  const isDesktop = width > 800;

  const [fromDate, setFromDate] = useState(() => {
    const now = new Date();
    const fyStart = now.getMonth() >= 3 ? new Date(now.getFullYear(), 3, 1) : new Date(now.getFullYear() - 1, 3, 1);
    return `${String(fyStart.getDate()).padStart(2, '0')}/${String(fyStart.getMonth() + 1).padStart(2, '0')}/${fyStart.getFullYear()}`;
  });
  const [toDate, setToDate] = useState(() => {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  });
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    const { isFirebaseConfigured, db } = await import('../../lib/firebase');
    const { collection, getDocs, query, where } = await import('../../lib/firestore_adapter');
    if (!isFirebaseConfigured) {
      setAllTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!tenantId) return;
      const q = query(collection(db, 'transactions'), where('tenant_id', '==', tenantId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllTransactions(data);
    } catch (err: any) {
      console.error("Error fetching P&L transactions:", err);
      setError(err.message || "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (tenantId) {
        fetchTransactions();
      } else {
        setLoading(false);
      }
    }
  }, [authLoading, tenantId]);

  const { revenueItems, dynamicCogs, operatingExpenses } = useMemo(() => {
    let salesRevenue = 0;
    let interestIncome = 0;
    let otherIncome = 0;
    let cogs = 0;
    let rentExpense = 0;
    let salariesExpense = 0;
    let utilitiesExpense = 0;
    let marketingExpense = 0;

    allTransactions.forEach(t => {
      const amt = Math.max(t.debit || 0, t.credit || 0);
      
      if (t.voucherType === 'Sales') {
        salesRevenue += t.taxableValue || (amt * 0.95);
      } else if (t.voucherType === 'Receipt') {
        if ((t.partyName || '').toLowerCase().includes('interest')) {
          interestIncome += amt;
        } else if (!(t.partyName || '').toLowerCase().includes('opening cash')) {
          otherIncome += amt;
        }
      } else if (t.voucherType === 'Purchase') {
        cogs += t.taxableValue || (amt * 0.95);
      } else if (t.voucherType === 'Payment') {
        const pName = (t.partyName || '').toLowerCase();
        if (pName.includes('rent')) {
          rentExpense += amt;
        } else if (pName.includes('salary') || pName.includes('wage')) {
          salariesExpense += amt;
        } else if (pName.includes('electricity') || pName.includes('bill') || pName.includes('water')) {
          utilitiesExpense += amt;
        } else {
          marketingExpense += amt;
        }
      }
    });

    return {
      revenueItems: [
        { label: 'Sales Revenue', amount: salesRevenue },
        { label: 'Interest Income', amount: interestIncome },
        { label: 'Other Income', amount: otherIncome },
      ],
      dynamicCogs: cogs,
      operatingExpenses: [
        { label: 'Rent', amount: rentExpense },
        { label: 'Salaries & Wages', amount: salariesExpense },
        { label: 'Utilities (Electricity, Water)', amount: utilitiesExpense },
        { label: 'Marketing & Other Expenses', amount: marketingExpense },
      ]
    };
  }, [allTransactions]);

  const totalRevenue = useMemo(() => revenueItems.reduce((s, i) => s + i.amount, 0), [revenueItems]);
  const totalOperatingExpenses = useMemo(() => operatingExpenses.reduce((s, i) => s + i.amount, 0), [operatingExpenses]);
  const totalExpenses = dynamicCogs + totalOperatingExpenses;
  const grossProfit = totalRevenue - dynamicCogs;
  const operatingProfit = grossProfit - totalOperatingExpenses;
  const netProfit = totalRevenue - totalExpenses;
  const isProfit = netProfit >= 0;

  const formatINR = (n: number) => {
    const abs = Math.abs(n);
    return (n < 0 ? '-' : '') + '₹' + abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const bgCard = isDarkMode ? '#1E293B' : '#FFFFFF';
  const borderCard = isDarkMode ? '#334155' : '#E2E8F0';
  const textMain = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textSub = isDarkMode ? '#94A3B8' : '#64748B';

  const renderStatementRow = (label: string, amount: number, opts?: { bold?: boolean; isNegative?: boolean; highlight?: boolean; indent?: boolean; isNet?: boolean }) => {
    const amtStr = opts?.isNegative && amount > 0 ? `-₹${amount.toFixed(2)}` : formatINR(amount);
    return (
      <View style={[
        styles.tableRow,
        opts?.highlight && { backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.5)' : '#F8FAFC' },
        opts?.isNet && { backgroundColor: isProfit ? (isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#F0FDF4') : (isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2'), borderRadius: 8 }
      ]}>
        <Text style={[
          styles.rowLabel,
          { color: opts?.isNet ? (isProfit ? '#10B981' : '#EF4444') : (opts?.bold ? textMain : textSub) },
          opts?.bold && { fontWeight: '700' },
          opts?.indent && { paddingLeft: 18 }
        ]}>
          {label}
        </Text>
        <Text style={[
          styles.rowAmount,
          { color: opts?.isNet ? (isProfit ? '#10B981' : '#EF4444') : (opts?.bold ? textMain : textSub) },
          opts?.bold && { fontWeight: '700', fontSize: 14 },
          opts?.isNet && { fontWeight: '800', fontSize: 16 }
        ]}>
          {amtStr}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={{ marginTop: 12, color: textSub, fontWeight: '600', fontSize: 13 }}>Loading Profit & Loss Statement...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }}>
        <Surface style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 460, alignItems: 'center', borderWidth: 1, borderColor: borderCard, backgroundColor: bgCard }} elevation={0}>
          <Icon name="alert-circle-outline" size={44} color="#EF4444" style={{ marginBottom: 12 }} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: textMain, textAlign: 'center', marginBottom: 8 }}>Unable to Load Profit & Loss</Text>
          <Text style={{ color: textSub, textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 20 }}>{error}</Text>
          <Button mode="contained" onPress={fetchTransactions} style={{ borderRadius: 8, width: '100%', backgroundColor: '#10B981' }}>
            Retry Sync
          </Button>
        </Surface>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC' }]} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chart-box-outline" size={22} color="#10B981" />
          </View>
          <View>
            <Text style={[styles.title, { color: textMain }]}>Profit & Loss Statement</Text>
            <Text style={[styles.subtitle, { color: textSub }]}>Real-time Income Statement auto-calculated from business ledgers</Text>
          </View>
        </View>
      </View>

      {/* Date Range Filter Bar */}
      <Surface style={[styles.card, { backgroundColor: bgCard, borderColor: borderCard }]} elevation={0}>
        <View style={[styles.dateRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
          <View style={{ flexDirection: 'row', gap: 12, flex: 1, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 150 }}>
              <Text style={[styles.fieldLabel, { color: textSub }]}>FROM DATE</Text>
              <TextInput
                value={fromDate}
                onChangeText={setFromDate}
                mode="outlined"
                dense
                style={{ backgroundColor: bgCard, fontSize: 13 }}
                outlineColor={borderCard}
                activeOutlineColor="#10B981"
                left={<TextInput.Icon icon="calendar-start" size={16} color="#64748B" />}
              />
            </View>
            <View style={{ flex: 1, minWidth: 150 }}>
              <Text style={[styles.fieldLabel, { color: textSub }]}>TO DATE</Text>
              <TextInput
                value={toDate}
                onChangeText={setToDate}
                mode="outlined"
                dense
                style={{ backgroundColor: bgCard, fontSize: 13 }}
                outlineColor={borderCard}
                activeOutlineColor="#10B981"
                left={<TextInput.Icon icon="calendar-end" size={16} color="#64748B" />}
              />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: isDesktop ? 16 : 8 }}>
            <Button 
              mode="contained" 
              icon="refresh" 
              onPress={() => fetchTransactions()} 
              style={{ borderRadius: 8, backgroundColor: '#10B981' }} 
              labelStyle={{ fontSize: 12, fontWeight: '700' }}
              compact
            >
              Regenerate
            </Button>
            <Button 
              mode="outlined" 
              icon="file-pdf-box" 
              onPress={() => {
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.print();
                } else {
                  Alert.alert("Export", "PDF Export is available on Web.");
                }
              }} 
              style={{ borderRadius: 8, borderColor: borderCard }} 
              labelStyle={{ color: textMain, fontSize: 12, fontWeight: '600' }}
              compact
            >
              Export PDF
            </Button>
          </View>
        </View>
      </Surface>

      {/* Net Profit Minimal Hero Card */}
      <Surface style={[styles.heroCard, { backgroundColor: bgCard, borderColor: isProfit ? (isDarkMode ? '#065F46' : '#A7F3D0') : (isDarkMode ? '#991B1B' : '#FECACA') }]} elevation={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: isProfit ? (isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5') : (isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#FEF2F2'), alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={isProfit ? 'trending-up' : 'trending-down'} size={26} color={isProfit ? '#10B981' : '#EF4444'} />
            </View>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: textSub, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {isProfit ? 'Net Profit (Earnings)' : 'Net Loss'}
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '800', color: isProfit ? '#10B981' : '#EF4444', letterSpacing: -0.5 }}>
                {formatINR(netProfit)}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: isDesktop ? 'flex-end' : 'flex-start' }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: textSub }}>PROFIT MARGIN</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, backgroundColor: isProfit ? (isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#F0FDF4') : (isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2'), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Icon name={isProfit ? 'arrow-top-right' : 'arrow-bottom-right'} size={14} color={isProfit ? '#10B981' : '#EF4444'} />
              <Text style={{ fontSize: 14, fontWeight: '800', color: isProfit ? '#10B981' : '#EF4444' }}>
                {totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0'}%
              </Text>
            </View>
          </View>
        </View>
      </Surface>

      {/* 4 Summary Metric Cards */}
      <View style={[styles.summaryGrid, { flexDirection: isDesktop ? 'row' : 'column' }]}>
        {[
          { label: 'Total Revenue', value: totalRevenue, icon: 'cash-plus', color: '#10B981', bg: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' },
          { label: 'Total Expenses', value: totalExpenses, icon: 'cash-minus', color: '#EF4444', bg: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2' },
          { label: 'Gross Profit', value: grossProfit, icon: 'chart-line', color: '#3B82F6', bg: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF' },
          { label: 'Operating Profit', value: operatingProfit, icon: 'cog-outline', color: '#8B5CF6', bg: isDarkMode ? 'rgba(139, 92, 246, 0.15)' : '#F5F3FF' },
        ].map((item, idx) => (
          <Surface key={idx} style={[styles.metricCard, { backgroundColor: bgCard, borderColor: borderCard }]} elevation={0}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={item.icon} size={18} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: textSub }}>{item.label}</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: textMain, marginTop: 2 }}>{formatINR(item.value)}</Text>
              </View>
            </View>
          </Surface>
        ))}
      </View>

      {/* Two Column Detailed Breakdown */}
      <View style={[styles.columnsRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
        {/* Revenue Breakdown */}
        <Surface style={[styles.card, { flex: 1, backgroundColor: bgCard, borderColor: borderCard }]} elevation={0}>
          <View style={styles.sectionHeader}>
            <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="arrow-up-right" size={16} color="#10B981" />
            </View>
            <Text style={[styles.sectionTitle, { color: textMain }]}>Revenue & Inflow</Text>
          </View>
          <Divider style={{ marginVertical: 10, backgroundColor: borderCard }} />

          <Text style={[styles.categoryHeader, { color: textSub }]}>SALES & INCOME</Text>
          {revenueItems.map((item, i) => (
            <View key={i} style={styles.lineItemRow}>
              <Text style={[styles.lineLabel, { color: textMain }]}>{item.label}</Text>
              <Text style={[styles.lineAmount, { color: textMain }]}>{formatINR(item.amount)}</Text>
            </View>
          ))}
          <View style={[styles.subtotalPill, { backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.4)' : '#F8FAFC', borderColor: borderCard }]}>
            <Text style={[styles.subtotalLabel, { color: textMain }]}>Total Revenue</Text>
            <Text style={[styles.subtotalAmount, { color: '#10B981' }]}>{formatINR(totalRevenue)}</Text>
          </View>

          <View style={{ height: 16 }} />
          <Text style={[styles.categoryHeader, { color: textSub }]}>DIRECT COSTS & COGS</Text>
          <View style={styles.lineItemRow}>
            <Text style={[styles.lineLabel, { color: textMain }]}>Cost of Goods Sold (Purchases)</Text>
            <Text style={[styles.lineAmount, { color: textMain }]}>{formatINR(dynamicCogs)}</Text>
          </View>
          <View style={[styles.subtotalPill, { backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.4)' : '#F8FAFC', borderColor: borderCard }]}>
            <Text style={[styles.subtotalLabel, { color: textMain }]}>Gross Profit</Text>
            <Text style={[styles.subtotalAmount, { color: '#3B82F6' }]}>{formatINR(grossProfit)}</Text>
          </View>
        </Surface>

        {/* Expenses Breakdown */}
        <Surface style={[styles.card, { flex: 1, backgroundColor: bgCard, borderColor: borderCard }]} elevation={0}>
          <View style={styles.sectionHeader}>
            <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="arrow-down-left" size={16} color="#EF4444" />
            </View>
            <Text style={[styles.sectionTitle, { color: textMain }]}>Operating Expenses</Text>
          </View>
          <Divider style={{ marginVertical: 10, backgroundColor: borderCard }} />

          <Text style={[styles.categoryHeader, { color: textSub }]}>OPERATING EXPENSES</Text>
          {operatingExpenses.map((item, i) => (
            <View key={i} style={styles.lineItemRow}>
              <Text style={[styles.lineLabel, { color: textMain }]}>{item.label}</Text>
              <Text style={[styles.lineAmount, { color: textMain }]}>{formatINR(item.amount)}</Text>
            </View>
          ))}
          <View style={[styles.subtotalPill, { backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.4)' : '#F8FAFC', borderColor: borderCard }]}>
            <Text style={[styles.subtotalLabel, { color: textMain }]}>Total Operating Expenses</Text>
            <Text style={[styles.subtotalAmount, { color: '#EF4444' }]}>{formatINR(totalOperatingExpenses)}</Text>
          </View>

          <View style={{ height: 16 }} />
          <Text style={[styles.categoryHeader, { color: textSub }]}>OPERATING PERFORMANCE</Text>
          <View style={styles.lineItemRow}>
            <Text style={[styles.lineLabel, { color: textMain }]}>Total All Expenses (COGS + Opex)</Text>
            <Text style={[styles.lineAmount, { color: textMain }]}>{formatINR(totalExpenses)}</Text>
          </View>
          <View style={[styles.subtotalPill, { backgroundColor: isDarkMode ? 'rgba(51, 65, 85, 0.4)' : '#F8FAFC', borderColor: borderCard }]}>
            <Text style={[styles.subtotalLabel, { color: textMain }]}>Operating Profit</Text>
            <Text style={[styles.subtotalAmount, { color: '#8B5CF6' }]}>{formatINR(operatingProfit)}</Text>
          </View>
        </Surface>
      </View>

      {/* Income Statement Summary Waterfall Table */}
      <Surface style={[styles.card, { marginTop: 16, marginBottom: 40, backgroundColor: bgCard, borderColor: borderCard }]} elevation={0}>
        <View style={styles.sectionHeader}>
          <Icon name="file-table-outline" size={18} color="#10B981" />
          <Text style={[styles.sectionTitle, { color: textMain }]}>Income Statement Summary</Text>
        </View>
        <Divider style={{ marginVertical: 10, backgroundColor: borderCard }} />

        {renderStatementRow('Total Revenue', totalRevenue, { bold: true })}
        <Divider style={{ backgroundColor: borderCard, marginVertical: 4 }} />
        {renderStatementRow('Less: Cost of Goods Sold (COGS)', dynamicCogs, { indent: true, isNegative: true })}
        <Divider style={{ backgroundColor: borderCard, marginVertical: 4 }} />
        {renderStatementRow('Gross Profit', grossProfit, { bold: true, highlight: true })}
        <Divider style={{ backgroundColor: borderCard, marginVertical: 4 }} />
        {renderStatementRow('Less: Operating Expenses', totalOperatingExpenses, { indent: true, isNegative: true })}
        <Divider style={{ backgroundColor: borderCard, marginVertical: 4 }} />
        {renderStatementRow('Operating Profit', operatingProfit, { bold: true, highlight: true })}
        <Divider style={{ backgroundColor: borderCard, marginVertical: 6 }} />

        {renderStatementRow(isProfit ? 'Net Profit' : 'Net Loss', netProfit, { isNet: true, bold: true })}
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { paddingTop: 20, paddingBottom: 14 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 12, marginTop: 2 },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  heroCard: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 1.5,
    marginTop: 12,
    marginBottom: 14,
  },
  summaryGrid: {
    gap: 12,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    minWidth: 160,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  fieldLabel: { fontSize: 10, fontWeight: '700', marginBottom: 4, letterSpacing: 0.5 },
  dateRow: { gap: 12, alignItems: 'flex-start' },
  columnsRow: { gap: 14, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  categoryHeader: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6, marginTop: 4 },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  lineLabel: { fontSize: 13 },
  lineAmount: { fontSize: 13, fontWeight: '600' },
  subtotalPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
  },
  subtotalLabel: { fontSize: 13, fontWeight: '700' },
  subtotalAmount: { fontSize: 14, fontWeight: '800' },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  rowLabel: { fontSize: 13 },
  rowAmount: { fontSize: 13, fontWeight: '600' },
});
