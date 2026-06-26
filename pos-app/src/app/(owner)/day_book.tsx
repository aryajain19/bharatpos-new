import { useAppTheme } from '../../providers/ThemeProvider';

import { useAuth } from '../../providers/AuthProvider';
import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, Card, DataTable, Button, Surface, Divider, useTheme, IconButton, TextInput } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { collection, getDocs, query, where, orderBy } from '../../lib/firestore_adapter';

// ─── Voucher Type Config ──────────────────────────────────────────────
const VOUCHER_COLORS: Record<string, { bg: string; text: string }> = {
  Sales:    { bg: '#E8F5E9', text: '#2E7D32' },
  Purchase: { bg: '#FFEBEE', text: '#C62828' },
  Receipt:  { bg: '#E3F2FD', text: '#1565C0' },
  Payment:  { bg: '#FFF3E0', text: '#E65100' },
  Journal:  { bg: '#F3E5F5', text: '#6A1B9A' },
};

// ─── Transaction Schema ───────────────────────────────────────────────
interface Transaction {
  id: string;
  dateTime: string;
  voucherType: keyof typeof VOUCHER_COLORS;
  voucherNo: string;
  partyName: string;
  debit: number;
  credit: number;
}



// ─── Helper: Format currency ─────────────────────────────────────────
const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── VoucherBadge Component ───────────────────────────────────────────
function VoucherBadge({ type }: { type: string }) {
  const colors = VOUCHER_COLORS[type] ?? { bg: '#EEEEEE', text: '#333' };
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>{type}</Text>
    </View>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────
function SummaryCard({ icon, label, amount, color, iconBg }: { icon: string; label: string; amount: number; color: string; iconBg: string }) {
  return (
    <Card style={[styles.summaryCard, { borderLeftWidth: 4, borderLeftColor: color }]} elevation={1}>
      <Card.Content style={styles.summaryContent}>
        <View style={[styles.summaryIcon, { backgroundColor: iconBg }]}>
          <Icon name={icon} size={24} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryLabel}>{label}</Text>
          <Text style={[styles.summaryAmount, { color }]}>{fmt(amount)}</Text>
        </View>
      </Card.Content>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Day Book Screen
// ═══════════════════════════════════════════════════════════════════════
export default function DayBookScreen() {
  const { tenantId, loading: authLoading } = useAuth();

  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width > 800;

  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [filterType, setFilterType] = useState<string>('All');
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    if (!isFirebaseConfigured) {
      setAllTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { auth } = await import('../../lib/firebase');
      if (!tenantId) return;
      const q = query(collection(db, 'transactions'), where('tenant_id', '==', tenantId), orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setAllTransactions(data);
    } catch (err: any) {
      console.error("Error fetching transactions:", err);
      setError(err.message || "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // ── Filtered transactions ────────────────────────────────────────
  const transactions = useMemo(() => {
    let list = allTransactions.filter(t => t.dateTime.startsWith(selectedDate));
    if (filterType !== 'All') list = list.filter(t => t.voucherType === filterType);
    return list;
  }, [allTransactions, selectedDate, filterType]);

  // ── Running balance computation ─────────────────────────────────
  const { rows, totalDebits, totalCredits } = useMemo(() => {
    let running = 0;
    let debits = 0;
    let credits = 0;
    const mapped = transactions.map(t => {
      debits += t.debit;
      credits += t.credit;
      running += t.debit - t.credit;
      return { ...t, runningBalance: running };
    });
    return { rows: mapped, totalDebits: debits, totalCredits: credits };
  }, [transactions]);

  const netBalance = totalDebits - totalCredits;

  // ── Quick filter pills ──────────────────────────────────────────
  const FILTER_OPTIONS = ['All', 'Sales', 'Purchase', 'Receipt', 'Payment', 'Journal'];

  // ── Navigate date ───────────────────────────────────────────────
  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Day Book...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Day Book</Text>
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
        <View style={{ flex: 1 }}>
          <Text variant="headlineSmall" style={styles.title}>Day Book</Text>
          <Text style={styles.subtitle}>Chronological register of all financial transactions</Text>
        </View>
      </View>

      {/* Date Picker Row */}
      <Card style={[styles.card, { marginBottom: 20 }]} elevation={1}>
        <Card.Content style={[styles.dateRow, !isWide && { flexDirection: 'column', alignItems: 'stretch' }]}>
          <View style={styles.datePickerGroup}>
            <IconButton icon="chevron-left" size={24} onPress={() => shiftDate(-1)} style={styles.dateArrow} />
            <View style={{ flex: 1, minWidth: 180, maxWidth: 220 }}>
              <TextInput
                label="Date"
                value={selectedDate}
                onChangeText={setSelectedDate}
                mode="outlined"
                left={<TextInput.Icon icon="calendar" />}
                style={{ backgroundColor: 'white' }}
                dense
              />
            </View>
            <IconButton icon="chevron-right" size={24} onPress={() => shiftDate(1)} style={styles.dateArrow} />
            <Button
              mode="outlined"
              onPress={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              style={{ marginLeft: 8, borderRadius: 8 }}
              compact
            >
              Today
            </Button>
          </View>

          {/* Quick Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: isWide ? 0 : 12 }}>
            <View style={styles.filterRow}>
              {FILTER_OPTIONS.map(opt => {
                const active = filterType === opt;
                const pillColor = opt === 'All' ? '#607D8B' : (VOUCHER_COLORS[opt]?.text ?? '#333');
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setFilterType(opt)}
                    style={[
                      styles.filterPill,
                      { borderColor: pillColor },
                      active && { backgroundColor: pillColor },
                    ]}
                  >
                    <Text style={[styles.filterPillText, { color: active ? '#fff' : pillColor }]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </Card.Content>
      </Card>

      {/* Summary Cards */}
      <View style={[styles.summaryRow, !isWide && { flexDirection: 'column' }]}>
        <SummaryCard icon="arrow-down-bold-circle" label="Total Receipts (Dr)" amount={totalDebits} color="#2E7D32" iconBg="#E8F5E9" />
        <SummaryCard icon="arrow-up-bold-circle" label="Total Payments (Cr)" amount={totalCredits} color="#C62828" iconBg="#FFEBEE" />
        <SummaryCard icon="scale-balance" label="Net Balance" amount={netBalance} color={netBalance >= 0 ? '#1565C0' : '#C62828'} iconBg="#E3F2FD" />
      </View>

      {/* Transaction Table */}
      <Card style={[styles.card, { marginTop: 20, marginBottom: 32 }]} elevation={1}>
        <Card.Content>
          <View style={styles.tableHeader}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              <Icon name="format-list-bulleted" size={20} color="#5E35B1" /> {' '}Transactions
            </Text>
            <Text style={styles.txCount}>{rows.length} entries</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 900 }}>
              <DataTable>
                <DataTable.Header style={styles.dtHeader}>
                  <DataTable.Title style={{ flex: 1.4 }}><Text style={styles.colHeader}>Date / Time</Text></DataTable.Title>
                  <DataTable.Title style={{ flex: 1 }}><Text style={styles.colHeader}>Voucher #</Text></DataTable.Title>
                  <DataTable.Title style={{ flex: 1 }}><Text style={styles.colHeader}>Type</Text></DataTable.Title>
                  <DataTable.Title style={{ flex: 1.6 }}><Text style={styles.colHeader}>Party Name</Text></DataTable.Title>
                  <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHeader}>Debit (₹)</Text></DataTable.Title>
                  <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHeader}>Credit (₹)</Text></DataTable.Title>
                  <DataTable.Title numeric style={{ flex: 1.1 }}><Text style={styles.colHeader}>Running Bal.</Text></DataTable.Title>
                </DataTable.Header>

                {rows.map((t) => (
                  <DataTable.Row key={t.id} style={styles.dtRow}>
                    <DataTable.Cell style={{ flex: 1.4 }}>
                      <Text style={styles.cellTime}>{t.dateTime.split(' ')[1]}</Text>
                    </DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1 }}>
                      <Text style={styles.cellVoucher}>{t.voucherNo}</Text>
                    </DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1 }}>
                      <VoucherBadge type={t.voucherType} />
                    </DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1.6 }}>
                      <Text style={styles.cellParty}>{t.partyName}</Text>
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}>
                      <Text style={[styles.cellAmount, t.debit > 0 && { color: appTheme.colors.onSurface, fontWeight: '700' }]}>
                        {t.debit > 0 ? fmt(t.debit) : '—'}
                      </Text>
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}>
                      <Text style={[styles.cellAmount, t.credit > 0 && { color: appTheme.colors.onSurface, fontWeight: '700' }]}>
                        {t.credit > 0 ? fmt(t.credit) : '—'}
                      </Text>
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1.1 }}>
                      <Text style={[styles.cellRunning, { color: t.runningBalance >= 0 ? '#1565C0' : '#C62828' }]}>
                        {fmt(Math.abs(t.runningBalance))}
                        <Text style={{ fontSize: 11 }}>{t.runningBalance >= 0 ? ' Dr' : ' Cr'}</Text>
                      </Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}

                {/* Totals Row */}
                <DataTable.Row style={[styles.dtRow, { backgroundColor: appTheme.colors.surface }]}>
                  <DataTable.Cell style={{ flex: 1.4 }}><Text style={styles.totalLabel}>TOTAL</Text></DataTable.Cell>
                  <DataTable.Cell style={{ flex: 1 }}><Text> </Text></DataTable.Cell>
                  <DataTable.Cell style={{ flex: 1 }}><Text> </Text></DataTable.Cell>
                  <DataTable.Cell style={{ flex: 1.6 }}><Text> </Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 1 }}>
                    <Text style={[styles.totalAmount, { color: appTheme.colors.onSurface }]}>{fmt(totalDebits)}</Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 1 }}>
                    <Text style={[styles.totalAmount, { color: appTheme.colors.onSurface }]}>{fmt(totalCredits)}</Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 1.1 }}>
                    <Text style={[styles.totalAmount, { color: netBalance >= 0 ? '#1565C0' : '#C62828' }]}>
                      {fmt(Math.abs(netBalance))} {netBalance >= 0 ? 'Dr' : 'Cr'}
                    </Text>
                  </DataTable.Cell>
                </DataTable.Row>

                {rows.length === 0 && (
                  <DataTable.Row>
                    <DataTable.Cell>
                      <View style={styles.emptyState}>
                        <Icon name="calendar-blank-outline" size={40} color="#ccc" />
                        <Text style={styles.emptyText}>No transactions found for {selectedDate}</Text>
                      </View>
                    </DataTable.Cell>
                  </DataTable.Row>
                )}
              </DataTable>
            </View>
          </ScrollView>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { paddingVertical: 24, flexDirection: 'row', alignItems: 'center' },
  title: { fontWeight: 'bold', },
  subtitle: { fontSize: 13, marginTop: 2 },

  card: { backgroundColor: 'white', borderRadius: 12 },

  // Date row
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  datePickerGroup: { flexDirection: 'row', alignItems: 'center' },
  dateArrow: { margin: 0 },

  // Filter pills
  filterRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  filterPill: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  filterPillText: { fontSize: 12, fontWeight: '700' },

  // Summary cards
  summaryRow: { flexDirection: 'row', gap: 16 },
  summaryCard: { flex: 1, backgroundColor: 'white', borderRadius: 12 },
  summaryContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  summaryIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  summaryLabel: { fontSize: 12, marginBottom: 4 },
  summaryAmount: { fontSize: 20, fontWeight: '800' },

  // Table
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontWeight: 'bold', },
  txCount: { fontSize: 13, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  colHeader: { fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' },
  dtHeader: { borderBottomWidth: 2, borderBottomColor: '#E8E8F0' },
  dtRow: { borderBottomWidth: 1, borderBottomColor: '#F0F0F5' },

  // Cells
  cellTime: { fontSize: 13, fontWeight: '600' },
  cellVoucher: { fontSize: 12, fontWeight: '600' },
  cellParty: { fontSize: 13, fontWeight: '500' },
  cellAmount: { fontSize: 13, },
  cellRunning: { fontSize: 13, fontWeight: '700' },

  // Badge
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  // Totals
  totalLabel: { fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  totalAmount: { fontWeight: '900', fontSize: 14 },

  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, width: '100%' },
  emptyText: { marginTop: 8, fontSize: 14 },
});
