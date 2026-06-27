import { useAppTheme } from '../../providers/ThemeProvider';

import { useAuth } from '../../providers/AuthProvider';
import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions, ActivityIndicator } from 'react-native';
import { Text, useTheme, Card, Button, Divider, Surface, TextInput } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface AccountItem {
  label: string;
  amount: number;
}

const sum = (items: AccountItem[]) => items.reduce((s, i) => s + i.amount, 0);

import { db, isFirebaseConfigured, auth } from '../../lib/firebase';
import { collection, getDocs, query, where } from '../../lib/firestore_adapter';

export default function BalanceSheetScreen() {
  const { tenantId, loading: authLoading } = useAuth();

  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const { width } = useWindowDimensions();
  const isDesktop = width > 800;

  const [asOfDate, setAsOfDate] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  });

  const [cashBalance, setCashBalance] = useState(0);
  const [bankBalance, setBankBalance] = useState(0);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [receivables, setReceivables] = useState(0);
  const [payables, setPayables] = useState(0);
  const [gstPayable, setGstPayable] = useState(0);
  const [retainedEarnings, setRetainedEarnings] = useState(0);
  const [capital, setCapital] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && tenantId) {
      fetchFinancialData();
    }
  }, [authLoading, tenantId]);

  const fetchFinancialData = async () => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!tenantId) return;

      // 1. Fetch products to calculate inventory value
      const prodSnapshot = await getDocs(query(collection(db, 'products'), where('tenant_id', '==', tenantId)));
      let totalInventory = 0;
      prodSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const price = parseFloat(data.selling_price || data.mrp || 0);
        const qty = parseInt(data.stock_qty || 0);
        totalInventory += (price * qty);
      });
      setInventoryValue(totalInventory);

      // 2. Fetch transactions to calculate Cash, Bank, Payables, Receivables, Retained Earnings
      const transSnapshot = await getDocs(query(collection(db, 'transactions'), where('tenant_id', '==', tenantId)));
      
      let cashChange = 0;
      let bankChange = 0;
      let salesRevenue = 0;
      let gstPayableVal = 0;
      let cogs = 0;
      let operatingExp = 0;
      let cap = 0;

      transSnapshot.docs.forEach(doc => {
        const t = doc.data();
        const amt = Math.max(parseFloat(t.debit || 0), parseFloat(t.credit || 0));
        const isSalesOrReceipt = t.voucherType === 'Sales' || t.voucherType === 'Receipt';
        const isPurchaseOrPayment = t.voucherType === 'Purchase' || t.voucherType === 'Payment';

        if (t.voucherType === 'Sales') {
          salesRevenue += t.taxableValue || (amt * 0.95);
          gstPayableVal += t.gstAmount || (amt * 0.05);
        } else if (t.voucherType === 'Purchase') {
          cogs += t.taxableValue || (amt * 0.95);
        } else if (t.voucherType === 'Payment') {
          operatingExp += amt;
        }

        if (t.paymentMethod === 'Cash') {
          if (isSalesOrReceipt) cashChange += amt;
          if (isPurchaseOrPayment) cashChange -= amt;
        } else if (t.paymentMethod === 'UPI' || t.paymentMethod === 'Card' || t.paymentMethod === 'Bank') {
          if (isSalesOrReceipt) bankChange += amt;
          if (isPurchaseOrPayment) bankChange -= amt;
        }

        if (t.partyName?.toLowerCase()?.includes('opening cash') || t.partyName?.toLowerCase()?.includes('capital')) {
          cap += amt;
        }
      });

      setCashBalance(Math.max(0, cashChange));
      setBankBalance(Math.max(0, bankChange));
      setGstPayable(Math.max(0, gstPayableVal));
      setCapital(cap);
      setRetainedEarnings(Math.max(0, salesRevenue - cogs - operatingExp));
    } catch (e: any) {
      console.error("Error fetching balance sheet financial data:", e);
      setError(e.message || "Failed to load balance sheet metrics.");
    } finally {
      setLoading(false);
    }
  };

  const currentAssets = [
    { label: 'Cash in Hand', amount: cashBalance },
    { label: 'Bank Account (Sync)', amount: bankBalance },
    { label: 'Inventory', amount: inventoryValue },
    { label: 'Accounts Receivable', amount: receivables },
  ];

  const fixedAssets = [
    { label: 'Shop Equipment', amount: 0 },
    { label: 'Furniture & Fixtures', amount: 0 },
  ];

  const currentLiabilities = [
    { label: 'Accounts Payable', amount: payables },
    { label: 'GST Payable', amount: gstPayable },
  ];

  const longTermLiabilities = [
    { label: 'Business Loan', amount: 0 },
  ];

  const ownersEquity = [
    { label: 'Capital', amount: capital },
    { label: 'Retained Earnings', amount: retainedEarnings },
  ];

  const currentAssetsTotal = sum(currentAssets);
  const fixedAssetsTotal = sum(fixedAssets);
  const totalAssets = currentAssetsTotal + fixedAssetsTotal;

  const currentLiabTotal = sum(currentLiabilities);
  const longTermLiabTotal = sum(longTermLiabilities);
  const equityTotal = sum(ownersEquity);
  const totalLiabilitiesEquity = currentLiabTotal + longTermLiabTotal + equityTotal;

  const isBalanced = totalAssets === totalLiabilitiesEquity;

  const formatINR = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const renderAccountLine = (label: string, amount: number, indent: boolean = false) => (
    <View style={[styles.accountLine, indent && { paddingLeft: 24 }]}>
      <Text style={[styles.accountLabel, !indent && { fontWeight: '600' }]}>{label}</Text>
      <Text style={styles.accountAmount}>{formatINR(amount)}</Text>
    </View>
  );

  const renderSubtotal = (label: string, amount: number) => (
    <View style={styles.subtotalLine}>
      <Text style={styles.subtotalLabel}>{label}</Text>
      <Text style={styles.subtotalAmount}>{formatINR(amount)}</Text>
    </View>
  );

  const renderGrandTotal = (label: string, amount: number) => (
    <View style={styles.grandTotalContainer}>
      <View style={styles.grandTotalLine}>
        <Text style={styles.grandTotalLabel}>{label}</Text>
        <Text style={styles.grandTotalAmount}>{formatINR(amount)}</Text>
      </View>
    </View>
  );

  const renderSectionGroup = (
    title: string,
    items: AccountItem[],
    subtotalLabel: string,
    subtotal: number,
  ) => (
    <View style={{ marginBottom: 24 }}>
      <Text style={styles.groupTitle}>{title}</Text>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {renderAccountLine(item.label, item.amount, true)}
        </React.Fragment>
      ))}
      <View style={styles.divider} />
      {renderSubtotal(subtotalLabel, subtotal)}
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Balance Sheet...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Balance Sheet</Text>
          <Text style={{ marginTop: 8, color: 'gray', textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 24 }}>{error}</Text>
          <Button mode="contained" onPress={fetchFinancialData} style={{ borderRadius: 10, width: '100%', backgroundColor: appTheme.colors.primary }}>
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
          <Icon name="scale-balance" size={28} color="#1565C0" />
          <View>
            <Text variant="headlineSmall" style={styles.title}>Balance Sheet</Text>
            <Text style={styles.subtitle}>Statement of Financial Position — Assets = Liabilities + Equity</Text>
          </View>
        </View>
      </View>

      {/* Top Controls */}
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end', flex: 1 }}>
          <View style={{ minWidth: 180 }}>
            <Text style={styles.fieldLabel}>AS OF DATE</Text>
            <TextInput
              value={asOfDate}
              onChangeText={setAsOfDate}
              mode="outlined"
              dense
              style={{ backgroundColor: 'white' }}
              outlineStyle={{ borderRadius: 4 }}
            />
          </View>
          <Button mode="contained" onPress={() => {}} style={styles.printBtn} labelStyle={{ color: 'white' }} compact>
            Print Statement
          </Button>
        </View>
        <View style={[styles.balanceStatus, { borderColor: isBalanced ? '#A7F3D0' : '#FCA5A5', backgroundColor: isBalanced ? '#ECFDF5' : '#FEF2F2' }]}>
          <Text style={{ fontWeight: '600', color: isBalanced ? '#2E7D32' : '#D32F2F' }}>
            {isBalanced ? 'Books Balanced' : 'Unbalanced'}
          </Text>
        </View>
      </View>

      <Card style={styles.sheetCard} elevation={0}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>COMPANY NAME</Text>
          <Text style={styles.sheetSubtitle}>Balance Sheet</Text>
          <Text style={styles.sheetDate}>As of {asOfDate}</Text>
        </View>

        {/* Two Column Layout */}
        <View style={[styles.columnsRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
          {/* LEFT: Assets */}
          <View style={styles.column}>
            <Text style={styles.columnHeader}>ASSETS</Text>
            <View style={styles.thickDivider} />

            {renderSectionGroup('Current Assets', currentAssets, 'Total Current Assets', currentAssetsTotal)}
            {renderSectionGroup('Fixed Assets', fixedAssets, 'Total Fixed Assets', fixedAssetsTotal)}
            
            <View style={{ flex: 1 }} />
            {renderGrandTotal('Total Assets', totalAssets)}
          </View>

          {/* RIGHT: Liabilities + Equity */}
          <View style={[styles.column, isDesktop && styles.columnRight]}>
            <Text style={styles.columnHeader}>LIABILITIES & EQUITY</Text>
            <View style={styles.thickDivider} />

            {renderSectionGroup('Current Liabilities', currentLiabilities, 'Total Current Liabilities', currentLiabTotal)}
            {renderSectionGroup('Long-term Liabilities', longTermLiabilities, 'Total Long-term Liab.', longTermLiabTotal)}
            {renderSectionGroup("Owner's Equity", ownersEquity, 'Total Equity', equityTotal)}

            <View style={{ flex: 1 }} />
            {renderGrandTotal('Total Liabilities & Equity', totalLiabilitiesEquity)}
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingBottom: 40 },
  header: { paddingTop: 24, paddingBottom: 16 },
  title: { fontWeight: 'bold', },
  subtitle: { fontSize: 13, marginTop: 4 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 16 },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  printBtn: { borderRadius: 4, marginBottom: 2 },
  balanceStatus: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  sheetCard: { backgroundColor: '#FFFFFF', padding: 32, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2, minHeight: 600, marginBottom: 40 },
  sheetHeader: { alignItems: 'center', marginBottom: 32 },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: '#1E293B' },
  sheetSubtitle: { fontSize: 16, marginTop: 4, color: '#1E293B' },
  sheetDate: { fontSize: 13, marginTop: 4, color: '#64748B' },
  columnsRow: { flexDirection: 'row', gap: 40 },
  column: { flex: 1 },
  columnRight: { borderLeftWidth: 1, borderLeftColor: '#E2E8F0', paddingLeft: 40 },
  columnHeader: { fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 8, color: '#1E293B' },
  thickDivider: { height: 2, backgroundColor: '#1E293B', marginBottom: 16 },
  groupTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, color: '#1E293B' },
  accountLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  accountLabel: { fontSize: 13, color: '#334155' },
  accountAmount: { fontSize: 13, color: '#1E293B' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  subtotalLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  subtotalLabel: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  subtotalAmount: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  grandTotalContainer: { borderTopWidth: 1, borderTopColor: '#1E293B', borderBottomWidth: 3, borderBottomColor: '#1E293B', paddingTop: 8, paddingBottom: 8, marginTop: 16 },
  grandTotalLine: { flexDirection: 'row', justifyContent: 'space-between' },
  grandTotalLabel: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  grandTotalAmount: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
});
