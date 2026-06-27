import { useAppTheme } from '../../providers/ThemeProvider';

import { useAuth } from '../../providers/AuthProvider';
import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Platform, ActivityIndicator } from 'react-native';
import { Text, useTheme, Card, DataTable, Surface, Divider, TextInput, Button } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type Transaction = {
  id: string;
  date: string;
  particulars: string;
  voucherType: string;
  voucherNo: string;
  receipt: number;
  payment: number;
};



const CASH_OPENING = 0;
const BANK_OPENING = 0;

const fmt = (n: number) => {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export default function CashBankBookScreen() {
  const { tenantId, loading: authLoading } = useAuth();

  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const { width } = useWindowDimensions();
  const isDesktop = width > 800;

  const [activeTab, setActiveTab] = useState<'cash' | 'bank'>('cash');
  const [fromDate, setFromDate] = useState('01/06/2026');
  const [toDate, setToDate] = useState('13/06/2026');
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    const { isFirebaseConfigured, db, auth } = await import('../../lib/firebase');
    const { collection, getDocs, query, where, orderBy } = await import('../../lib/firestore_adapter');
    if (!isFirebaseConfigured) {
      setAllTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!tenantId) return;
      const q = query(collection(db, 'transactions'), where('tenant_id', '==', tenantId), orderBy('created_at', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllTransactions(data);
    } catch (err: any) {
      console.error("Error fetching transactions:", err);
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

  const isCash = activeTab === 'cash';
  const openingBalance = isCash ? CASH_OPENING : BANK_OPENING;

  const transactions = useMemo(() => {
    const list = allTransactions.filter(t => {
      const isCashPayment = t.paymentMethod === 'Cash';
      const isBankPayment = t.paymentMethod === 'UPI' || t.paymentMethod === 'Card' || t.paymentMethod === 'Bank';
      if (activeTab === 'cash') {
        return isCashPayment;
      } else {
        return isBankPayment;
      }
    });

    return list.map(t => {
      const isReceipt = t.debit > 0;
      const parts = t.dateTime.split(' ')[0].split('-');
      const dateStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : t.dateTime.split(' ')[0];
      return {
        id: t.id,
        date: dateStr,
        particulars: t.partyName,
        voucherType: t.voucherType,
        voucherNo: t.voucherNo,
        receipt: isReceipt ? t.debit : 0,
        payment: !isReceipt ? t.credit : 0,
      };
    });
  }, [allTransactions, activeTab]);

  const computed = useMemo(() => {
    let runningBalance = openingBalance;
    const rows = transactions.map(txn => {
      runningBalance += txn.receipt - txn.payment;
      return { ...txn, balance: runningBalance };
    });
    const totalReceipts = transactions.reduce((s, t) => s + t.receipt, 0);
    const totalPayments = transactions.reduce((s, t) => s + t.payment, 0);
    const closingBalance = openingBalance + totalReceipts - totalPayments;
    return { rows, totalReceipts, totalPayments, closingBalance };
  }, [transactions, openingBalance]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Cash & Bank Book...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Cash/Bank Book</Text>
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
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>Cash & Bank Book</Text>
        <Text style={styles.subtitle}>Track all cash-in-hand and bank account movements</Text>
      </View>

      {/* Tab Toggle */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'cash' && styles.tabBtnActive]}
          onPress={() => setActiveTab('cash')}
          activeOpacity={0.7}
        >
          <Icon name="cash" size={18} color={activeTab === 'cash' ? '#FFF' : '#5E35B1'} />
          <Text style={[styles.tabText, activeTab === 'cash' && styles.tabTextActive]}>Cash Book</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'bank' && styles.tabBtnActive]}
          onPress={() => setActiveTab('bank')}
          activeOpacity={0.7}
        >
          <Icon name="bank" size={18} color={activeTab === 'bank' ? '#FFF' : '#5E35B1'} />
          <Text style={[styles.tabText, activeTab === 'bank' && styles.tabTextActive]}>Bank Book</Text>
        </TouchableOpacity>
      </View>

      {/* Opening Balance + Filters Row */}
      <View style={[styles.topRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
        {/* Opening Balance */}
        <Card style={[styles.card, styles.openingCard]} elevation={1}>
          <Card.Content style={styles.balanceCardContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.balanceIcon}>
                <Icon name={isCash ? 'cash-multiple' : 'bank-outline'} size={22} color="#5E35B1" />
              </View>
              <View>
                <Text style={styles.balanceLabel}>Opening Balance</Text>
                <Text style={styles.balanceAmount}>{fmt(openingBalance)}</Text>
              </View>
            </View>
            <Text style={styles.balancePeriod}>As on {fromDate}</Text>
          </Card.Content>
        </Card>

        {/* Closing Balance */}
        <Card style={[styles.card, styles.closingCard]} elevation={1}>
          <Card.Content style={styles.balanceCardContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.balanceIcon, { backgroundColor: appTheme.colors.surface }]}>
                <Icon name="check-circle-outline" size={22} color="#2E7D32" />
              </View>
              <View>
                <Text style={styles.balanceLabel}>Closing Balance</Text>
                <Text style={[styles.balanceAmount, { color: appTheme.colors.onSurface }]}>{fmt(computed.closingBalance)}</Text>
              </View>
            </View>
            <Text style={styles.balancePeriod}>As on {toDate}</Text>
          </Card.Content>
        </Card>

        {/* Date Filters */}
        <Card style={[styles.card, { flex: isDesktop ? 1 : undefined }]} elevation={1}>
          <Card.Content>
            <Text style={{ fontWeight: '600', fontSize: 13, color: appTheme.colors.onSurface, marginBottom: 10 }}>DATE RANGE FILTER</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TextInput
                label="From"
                value={fromDate}
                onChangeText={setFromDate}
                mode="outlined"
                style={[styles.dateInput]}
                dense
                left={<TextInput.Icon icon="calendar" />}
              />
              <TextInput
                label="To"
                value={toDate}
                onChangeText={setToDate}
                mode="outlined"
                style={[styles.dateInput]}
                dense
                left={<TextInput.Icon icon="calendar" />}
              />
            </View>
          </Card.Content>
        </Card>
      </View>

      {/* Summary Cards Row */}
      <View style={[styles.summaryRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
        <Surface style={[styles.summaryCard, { borderLeftColor: '#2E7D32' }]} elevation={1}>
          <Icon name="arrow-down-circle" size={28} color="#2E7D32" />
          <View>
            <Text style={styles.summaryLabel}>Total Receipts</Text>
            <Text style={[styles.summaryValue, { color: appTheme.colors.onSurface }]}>{fmt(computed.totalReceipts)}</Text>
          </View>
        </Surface>
        <Surface style={[styles.summaryCard, { borderLeftColor: '#C62828' }]} elevation={1}>
          <Icon name="arrow-up-circle" size={28} color="#C62828" />
          <View>
            <Text style={styles.summaryLabel}>Total Payments</Text>
            <Text style={[styles.summaryValue, { color: appTheme.colors.onSurface }]}>{fmt(computed.totalPayments)}</Text>
          </View>
        </Surface>
        <Surface style={[styles.summaryCard, { borderLeftColor: '#5E35B1' }]} elevation={1}>
          <Icon name="scale-balance" size={28} color="#5E35B1" />
          <View>
            <Text style={styles.summaryLabel}>Net Movement</Text>
            <Text style={[styles.summaryValue, { color: appTheme.colors.onSurface }]}>
              {computed.totalReceipts - computed.totalPayments >= 0 ? '+' : ''}{fmt(computed.totalReceipts - computed.totalPayments)}
            </Text>
          </View>
        </Surface>
      </View>

      {/* Transaction Table */}
      <Card style={[styles.card, { marginTop: 20 }]} elevation={1}>
        <Card.Content>
          <View style={styles.tableHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name={isCash ? 'book-open-variant' : 'bank-transfer'} size={20} color="#5E35B1" />
              <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                {isCash ? 'Cash Book Ledger' : 'Bank Book Ledger'}
              </Text>
            </View>
            <Text style={{ color: appTheme.colors.onSurface, fontSize: 12 }}>
              {transactions.length} transactions • {fromDate} to {toDate}
            </Text>
          </View>

          <Divider style={{ marginVertical: 12 }} />

          <ScrollView horizontal={!isDesktop} showsHorizontalScrollIndicator={false}>
            <DataTable style={{ minWidth: 800 }}>
              <DataTable.Header style={styles.dataHeader}>
                <DataTable.Title style={{ flex: 0.8 }}><Text style={styles.colHead}>Date</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 1.5 }}><Text style={styles.colHead}>Particulars</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 1 }}><Text style={styles.colHead}>Voucher Type</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 0.8 }}><Text style={styles.colHead}>Voucher No</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHead}>Receipt (₹)</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHead}>Payment (₹)</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHead}>Balance (₹)</Text></DataTable.Title>
              </DataTable.Header>

              {/* Opening Balance Row */}
              <DataTable.Row style={styles.openingRow}>
                <DataTable.Cell style={{ flex: 0.8 }}><Text style={styles.openingText}>{fromDate}</Text></DataTable.Cell>
                <DataTable.Cell style={{ flex: 1.5 }}><Text style={[styles.openingText, { fontWeight: 'bold' }]}>Opening Balance</Text></DataTable.Cell>
                <DataTable.Cell style={{ flex: 1 }}><Text style={styles.openingText}>—</Text></DataTable.Cell>
                <DataTable.Cell style={{ flex: 0.8 }}><Text style={styles.openingText}>—</Text></DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}><Text style={styles.openingText}>—</Text></DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}><Text style={styles.openingText}>—</Text></DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}><Text style={[styles.openingText, { fontWeight: 'bold' }]}>{fmt(openingBalance)}</Text></DataTable.Cell>
              </DataTable.Row>

              {computed.rows.map((txn, index) => (
                <DataTable.Row key={txn.id} style={index % 2 === 0 ? styles.evenRow : undefined}>
                  <DataTable.Cell style={{ flex: 0.8 }}><Text style={styles.cellText}>{txn.date}</Text></DataTable.Cell>
                  <DataTable.Cell style={{ flex: 1.5 }}><Text style={styles.cellText} numberOfLines={1}>{txn.particulars}</Text></DataTable.Cell>
                  <DataTable.Cell style={{ flex: 1 }}>
                    <View style={[styles.voucherBadge, { backgroundColor: txn.receipt > 0 ? '#E8F5E9' : '#FFEBEE' }]}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: txn.receipt > 0 ? '#2E7D32' : '#C62828' }}>{txn.voucherType}</Text>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell style={{ flex: 0.8 }}><Text style={[styles.cellText, { color: appTheme.colors.onSurface }]}>{txn.voucherNo}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 1 }}>
                    <Text style={[styles.cellText, { color: txn.receipt > 0 ? '#2E7D32' : '#AAA', fontWeight: txn.receipt > 0 ? '600' : '400' }]}>
                      {txn.receipt > 0 ? fmt(txn.receipt) : '—'}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 1 }}>
                    <Text style={[styles.cellText, { color: txn.payment > 0 ? '#C62828' : '#AAA', fontWeight: txn.payment > 0 ? '600' : '400' }]}>
                      {txn.payment > 0 ? fmt(txn.payment) : '—'}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 1 }}>
                    <Text style={[styles.cellText, { fontWeight: '600' }]}>{fmt(txn.balance)}</Text>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}

              {/* Closing Balance Row */}
              <DataTable.Row style={styles.closingRow}>
                <DataTable.Cell style={{ flex: 0.8 }}><Text style={styles.closingText}>{toDate}</Text></DataTable.Cell>
                <DataTable.Cell style={{ flex: 1.5 }}><Text style={[styles.closingText, { fontWeight: 'bold' }]}>Closing Balance</Text></DataTable.Cell>
                <DataTable.Cell style={{ flex: 1 }}><Text style={styles.closingText}>—</Text></DataTable.Cell>
                <DataTable.Cell style={{ flex: 0.8 }}><Text style={styles.closingText}>—</Text></DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>
                  <Text style={[styles.closingText, { fontWeight: 'bold' }]}>{fmt(computed.totalReceipts)}</Text>
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>
                  <Text style={[styles.closingText, { fontWeight: 'bold' }]}>{fmt(computed.totalPayments)}</Text>
                </DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}>
                  <Text style={[styles.closingText, { fontWeight: 'bold', fontSize: 14 }]}>{fmt(computed.closingBalance)}</Text>
                </DataTable.Cell>
              </DataTable.Row>
            </DataTable>
          </ScrollView>
        </Card.Content>
      </Card>

      {/* Footer Note */}
      <View style={styles.footerNote}>
        <Icon name="information-outline" size={14} color="#999" />
        <Text style={{ color: appTheme.colors.onSurface, fontSize: 12, marginLeft: 6 }}>
          All figures are in Indian Rupees (₹). This report is auto-generated from voucher entries.
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { paddingTop: 24, paddingBottom: 8 },
  title: { fontWeight: 'bold', },
  subtitle: { fontSize: 13, marginTop: 4 },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 20,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    },
  tabTextActive: {
    },

  // Cards
  card: { backgroundColor: 'white', borderRadius: 12 },
  topRow: { gap: 16 },
  openingCard: { flex: 1 },
  closingCard: { flex: 1 },
  balanceCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceLabel: { fontSize: 12, fontWeight: '500' },
  balanceAmount: { fontSize: 20, fontWeight: 'bold', marginTop: 2 },
  balancePeriod: { fontSize: 11, },

  // Date inputs
  dateInput: { flex: 1, backgroundColor: 'white' },

  // Summary cards
  summaryRow: { gap: 16, marginTop: 20 },
  summaryCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'white',
    borderLeftWidth: 4,
  },
  summaryLabel: { fontSize: 12, fontWeight: '500' },
  summaryValue: { fontSize: 18, fontWeight: 'bold', marginTop: 2 },

  // Table
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  dataHeader: { },
  colHead: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  cellText: { fontSize: 13 },
  evenRow: { },
  openingRow: { },
  openingText: { fontSize: 13, },
  closingRow: { },
  closingText: { fontSize: 13, },
  voucherBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 4,
  },
});
