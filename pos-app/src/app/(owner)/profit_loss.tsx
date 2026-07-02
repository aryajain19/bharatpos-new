import { useAppTheme } from '../../providers/ThemeProvider';
import { DS } from '../../constants/designTokens';

import { useAuth } from '../../providers/AuthProvider';
import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions, Platform, ActivityIndicator, Alert } from 'react-native';
import { Text, useTheme, Card, Button, Divider, Surface, TextInput } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface LineItem {
  label: string;
  amount: number;
  indent?: boolean;
  bold?: boolean;
}

export default function ProfitLossScreen() {
  const { tenantId, loading: authLoading } = useAuth();

  const { isDarkMode, toggleTheme } = useAppTheme();
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
    const { isFirebaseConfigured, db, auth } = await import('../../lib/firebase');
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
    if (!authLoading && tenantId) {
      fetchTransactions();
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
      const amt = Math.max(t.debit, t.credit);
      
      if (t.voucherType === 'Sales') {
        salesRevenue += t.taxableValue || (amt * 0.95);
      } else if (t.voucherType === 'Receipt') {
        if (t.partyName.toLowerCase().includes('interest')) {
          interestIncome += amt;
        } else if (!t.partyName.toLowerCase().includes('opening cash')) {
          otherIncome += amt;
        }
      } else if (t.voucherType === 'Purchase') {
        cogs += t.taxableValue || (amt * 0.95);
      } else if (t.voucherType === 'Payment') {
        if (t.partyName.toLowerCase().includes('rent')) {
          rentExpense += amt;
        } else if (t.partyName.toLowerCase().includes('salary') || t.partyName.toLowerCase().includes('wage')) {
          salariesExpense += amt;
        } else if (t.partyName.toLowerCase().includes('electricity') || t.partyName.toLowerCase().includes('bill')) {
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
        { label: 'Marketing & Advertising', amount: marketingExpense },
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
    return (n < 0 ? '-' : '') + '₹' + abs.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const renderStatementLine = (label: string, amount: number, opts?: { bold?: boolean; indent?: boolean; color?: string; underline?: boolean; doubleUnderline?: boolean; bg?: string }) => (
    <View style={[
      styles.statementLine,
      opts?.bg ? { backgroundColor: opts.bg } : null,
    ]}>
      <Text style={[
        styles.lineLabel,
        opts?.indent && { paddingLeft: 20 },
        opts?.bold && { fontWeight: 'bold' },
        opts?.color && { color: opts.color },
      ]}>
        {opts?.indent ? '    ' : ''}{label}
      </Text>
      <Text style={[
        styles.lineAmount,
        opts?.bold && { fontWeight: 'bold', fontSize: 15 },
        opts?.color && { color: opts.color },
        opts?.underline && { textDecorationLine: 'underline' },
      ]}>
        {formatINR(amount)}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Profit & Loss...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Profit & Loss</Text>
          <Text style={{ marginTop: 8, color: 'gray', textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 24 }}>{error}</Text>
          <Button mode="contained" onPress={fetchTransactions} style={{ borderRadius: 10, width: '100%', backgroundColor: appTheme.colors.primary }}>
            Retry Sync
          </Button>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="chart-line" size={28} color="#2E7D32" />
          <View>
            <Text variant="headlineSmall" style={styles.title}>Profit & Loss Statement</Text>
            <Text style={styles.subtitle}>Income Statement — Auto-generated from your books</Text>
          </View>
        </View>
      </View>

      {/* Date Range + Export */}
      <Card style={styles.card} elevation={1}>
        <Card.Content>
          <View style={[styles.dateRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
            <View style={{ flexDirection: 'row', gap: 12, flex: 1, flexWrap: 'wrap' }}>
              <View style={{ flex: 1, minWidth: 160 }}>
                <Text style={styles.fieldLabel}>FROM DATE</Text>
                <TextInput
                  value={fromDate}
                  onChangeText={setFromDate}
                  mode="outlined"
                  dense
                  style={{ backgroundColor: 'white' }}
                  outlineStyle={{ borderRadius: 8 }}
                  left={<TextInput.Icon icon="calendar-start" size={18} />}
                />
              </View>
              <View style={{ flex: 1, minWidth: 160 }}>
                <Text style={styles.fieldLabel}>TO DATE</Text>
                <TextInput
                  value={toDate}
                  onChangeText={setToDate}
                  mode="outlined"
                  dense
                  style={{ backgroundColor: 'white' }}
                  outlineStyle={{ borderRadius: 8 }}
                  left={<TextInput.Icon icon="calendar-end" size={18} />}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginTop: isDesktop ? 18 : 12 }}>
              <Button 
                mode="contained" 
                icon="refresh" 
                onPress={() => fetchTransactions()} 
                style={{ borderRadius: 8 }} 
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
                    Alert.alert("Export", "PDF Export is available on the Web interface.");
                  }
                }} 
                style={{ borderRadius: 8 }} 
                compact
              >
                Export PDF
              </Button>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Net Profit Hero Card */}
      <Card style={[styles.card, { marginTop: 16, backgroundColor: isProfit ? '#1B5E20' : '#B71C1C' }]} elevation={2}>
        <Card.Content style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10 }}>
              <Icon name={isProfit ? 'trending-up' : 'trending-down'} size={28} color="white" />
            </View>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' }}>
                {isProfit ? 'NET PROFIT' : 'NET LOSS'}
              </Text>
              <Text style={{ color: 'white', fontSize: 32, fontWeight: 'bold', letterSpacing: 0.5 }}>
                {formatINR(netProfit)}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Profit Margin</Text>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
              {totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0}%
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Summary Cards Row */}
      <View style={[styles.summaryRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
        {[
          { label: 'Total Revenue', value: totalRevenue, icon: 'cash-multiple', color: appTheme.colors.onSurface, bg: '#E8F5E9' },
          { label: 'Total Expenses', value: totalExpenses, icon: 'cash-minus', color: appTheme.colors.onSurface, bg: '#FFEBEE' },
          { label: 'Gross Profit', value: grossProfit, icon: 'chart-areaspline', color: appTheme.colors.onSurface, bg: '#E3F2FD' },
          { label: 'Operating Profit', value: operatingProfit, icon: 'cog', color: appTheme.colors.onSurface, bg: '#FFF3E0' },
        ].map((item, idx) => (
          <Card key={idx} style={[styles.card, { flex: 1, minWidth: 170 }]} elevation={1}>
            <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ backgroundColor: item.bg, borderRadius: 10, padding: 8 }}>
                <Icon name={item.icon} size={22} color={item.color} />
              </View>
              <View>
                <Text style={{ fontSize: 11, color: appTheme.colors.onSurface, fontWeight: '600' }}>{item.label}</Text>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: item.color }}>{formatINR(item.value)}</Text>
              </View>
            </Card.Content>
          </Card>
        ))}
      </View>

      {/* Two Column Statement */}
      <View style={[styles.columnsRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
        {/* Revenue Column */}
        <Card style={[styles.card, { flex: 1 }]} elevation={1}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: appTheme.colors.surface }]}>
                <Icon name="arrow-up-bold" size={18} color="#2E7D32" />
              </View>
              <Text variant="titleMedium" style={{ fontWeight: 'bold', color: appTheme.colors.onSurface }}>Revenue</Text>
            </View>
            <Divider style={{ marginBottom: 12, backgroundColor: appTheme.colors.surface, height: 2 }} />

            <Text style={styles.groupTitle}>Sales & Income</Text>
            {revenueItems.map((item: any, i: number) => (
              <React.Fragment key={i}>
                {renderStatementLine(item.label, item.amount, { indent: true })}
              </React.Fragment>
            ))}
            <Divider style={{ marginVertical: 8, backgroundColor: appTheme.colors.surface }} />
            {renderStatementLine('Total Revenue', totalRevenue, { bold: true, color: appTheme.colors.onSurface, underline: true })}

            <View style={{ height: 24 }} />
            <Text style={styles.groupTitle}>Cost of Goods Sold</Text>
            {renderStatementLine('COGS — Purchases & Direct Costs', dynamicCogs, { indent: true })}
            <Divider style={{ marginVertical: 8, backgroundColor: appTheme.colors.surface }} />
            {renderStatementLine('Total COGS', dynamicCogs, { bold: true, color: appTheme.colors.onSurface, underline: true })}

            <View style={{ height: 16 }} />
            <Surface style={[styles.profitLine, { backgroundColor: appTheme.colors.surface }]} elevation={0}>
              <Text style={{ fontWeight: 'bold', color: appTheme.colors.onSurface, fontSize: 14 }}>Gross Profit</Text>
              <Text style={{ fontWeight: 'bold', color: appTheme.colors.onSurface, fontSize: 16 }}>{formatINR(grossProfit)}</Text>
            </Surface>
          </Card.Content>
        </Card>

        {/* Expenses Column */}
        <Card style={[styles.card, { flex: 1 }]} elevation={1}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: appTheme.colors.surface }]}>
                <Icon name="arrow-down-bold" size={18} color="#C62828" />
              </View>
              <Text variant="titleMedium" style={{ fontWeight: 'bold', color: appTheme.colors.onSurface }}>Expenses</Text>
            </View>
            <Divider style={{ marginBottom: 12, backgroundColor: appTheme.colors.surface, height: 2 }} />

            <Text style={styles.groupTitle}>Operating Expenses</Text>
            {operatingExpenses.map((item: any, i: number) => (
              <React.Fragment key={i}>
                {renderStatementLine(item.label, item.amount, { indent: true })}
              </React.Fragment>
            ))}
            <Divider style={{ marginVertical: 8, backgroundColor: appTheme.colors.surface }} />
            {renderStatementLine('Total Operating Expenses', totalOperatingExpenses, { bold: true, color: appTheme.colors.onSurface, underline: true })}

            <View style={{ height: 24 }} />
            <Surface style={[styles.profitLine, { backgroundColor: appTheme.colors.surface }]} elevation={0}>
              <Text style={{ fontWeight: 'bold', color: appTheme.colors.onSurface, fontSize: 14 }}>Operating Profit</Text>
              <Text style={{ fontWeight: 'bold', color: appTheme.colors.onSurface, fontSize: 16 }}>{formatINR(operatingProfit)}</Text>
            </Surface>

            <View style={{ height: 16 }} />
            <Text style={styles.groupTitle}>Total All Expenses</Text>
            {renderStatementLine('COGS', dynamicCogs, { indent: true })}
            {renderStatementLine('Operating Expenses', totalOperatingExpenses, { indent: true })}
            <Divider style={{ marginVertical: 8, backgroundColor: appTheme.colors.surface }} />
            {renderStatementLine('Total Expenses', totalExpenses, { bold: true, color: appTheme.colors.onSurface, underline: true })}
          </Card.Content>
        </Card>
      </View>

      {/* Grand Net Profit Section */}
      <Card style={[styles.card, { marginTop: 16, marginBottom: 40, borderWidth: 2, borderColor: isProfit ? '#4CAF50' : '#F44336' }]} elevation={1}>
        <Card.Content>
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: appTheme.colors.onSurface, letterSpacing: 1, marginBottom: 16 }}>INCOME STATEMENT SUMMARY</Text>

          {renderStatementLine('Total Revenue', totalRevenue, { bold: true, color: appTheme.colors.onSurface })}
          <Divider style={{ marginVertical: 6 }} />
          {renderStatementLine('Less: Cost of Goods Sold', -dynamicCogs, { indent: true, color: appTheme.colors.onSurface })}
          <Divider style={{ marginVertical: 6 }} />
          {renderStatementLine('Gross Profit', grossProfit, { bold: true, color: appTheme.colors.onSurface, bg: '#F5F6FA' })}
          <Divider style={{ marginVertical: 6 }} />
          {renderStatementLine('Less: Operating Expenses', -totalOperatingExpenses, { indent: true, color: appTheme.colors.onSurface })}
          <Divider style={{ marginVertical: 6 }} />
          {renderStatementLine('Operating Profit', operatingProfit, { bold: true, color: appTheme.colors.onSurface, bg: '#F5F6FA' })}

          <View style={{ height: 8 }} />
          <View style={{ height: 2, backgroundColor: appTheme.colors.surface }} />
          <View style={{ height: 2, marginTop: 2, backgroundColor: appTheme.colors.surface }} />
          <View style={[styles.netProfitRow, { backgroundColor: isProfit ? '#E8F5E9' : '#FFEBEE' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: isProfit ? '#2E7D32' : '#C62828' }}>
                {isProfit ? 'Net Profit' : 'Net Loss'}
              </Text>
            </View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: isProfit ? '#2E7D32' : '#C62828' }}>
              {formatINR(netProfit)}
            </Text>
          </View>
          <View style={{ height: 2, backgroundColor: appTheme.colors.surface }} />
          <View style={{ height: 2, marginTop: 2, backgroundColor: appTheme.colors.surface }} />
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { paddingTop: 24, paddingBottom: 16 },
  title: { fontWeight: 'bold', },
  subtitle: { fontSize: 13, marginTop: 2 },
  card: { backgroundColor: DS.colors.cardBg, borderRadius: DS.radius.md },
  fieldLabel: { fontSize: 11, fontWeight: 'bold', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateRow: { gap: 16, alignItems: 'flex-start' },
  summaryRow: { gap: 12, marginTop: 16 },
  columnsRow: { gap: 16, marginTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionIcon: { borderRadius: DS.radius.sm, padding: 6 },
  groupTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  statementLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: DS.radius.sm,
  },
  lineLabel: { fontSize: 14, },
  lineAmount: { fontSize: 14, fontWeight: '600' },
  profitLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: DS.radius.md,
  },
  netProfitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: DS.radius.md,
    marginVertical: 8,
  },
});
