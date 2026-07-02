import { useAppTheme } from '../../providers/ThemeProvider';
import { DS } from '../../constants/designTokens';

import { useAuth } from '../../providers/AuthProvider';
import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Platform, ActivityIndicator } from 'react-native';
import { Text, Card, Button, Surface, Divider, useTheme, TextInput } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy } from '../../lib/firestore_adapter';

// ─── Types ────────────────────────────────────────────────────────────
interface Ledger {
  id: string;
  name: string;
  balance: number;
  type: 'Dr' | 'Cr';
}

interface AccountGroup {
  key: string;
  name: string;
  icon: string;
  color: string;
  ledgers: Ledger[];
}

// ─── Standard Chart of Accounts ───────────────────────────────────────
const ACCOUNT_GROUPS: AccountGroup[] = [
  {
    key: 'assets',
    name: 'Assets',
    icon: 'bank',
    color: '#10B981',
    ledgers: [
      { id: 'a1', name: 'Cash in Hand',            balance: 0,   type: 'Dr' },
      { id: 'a2', name: 'Bank Account - SBI',      balance: 0,  type: 'Dr' },
      { id: 'a3', name: 'Bank Account - HDFC',     balance: 0,  type: 'Dr' },
      { id: 'a4', name: 'Inventory',               balance: 0,  type: 'Dr' },
      { id: 'a5', name: 'Accounts Receivable',     balance: 0,   type: 'Dr' },
      { id: 'a6', name: 'Fixed Assets - Furniture', balance: 0,  type: 'Dr' },
    ],
  },
  {
    key: 'liabilities',
    name: 'Liabilities',
    icon: 'credit-card-outline',
    color: '#F44336',
    ledgers: [
      { id: 'l1', name: 'Accounts Payable',     balance: 0,  type: 'Cr' },
      { id: 'l2', name: 'GST Payable',          balance: 0,  type: 'Cr' },
      { id: 'l3', name: 'TDS Payable',          balance: 0,   type: 'Cr' },
      { id: 'l4', name: 'Loan - ICICI Bank',    balance: 0, type: 'Cr' },
    ],
  },
  {
    key: 'income',
    name: 'Income',
    icon: 'trending-up',
    color: '#2196F3',
    ledgers: [
      { id: 'i1', name: 'Sales Revenue',     balance: 0, type: 'Cr' },
      { id: 'i2', name: 'Interest Income',   balance: 0,   type: 'Cr' },
      { id: 'i3', name: 'Other Income',      balance: 0,   type: 'Cr' },
      { id: 'i4', name: 'Discount Received', balance: 0,   type: 'Cr' },
    ],
  },
  {
    key: 'expenses',
    name: 'Expenses',
    icon: 'trending-down',
    color: '#FF9800',
    ledgers: [
      { id: 'e1', name: 'Cost of Goods Sold', balance: 0, type: 'Dr' },
      { id: 'e2', name: 'Rent Expense',       balance: 0,  type: 'Dr' },
      { id: 'e3', name: 'Salaries & Wages',   balance: 0, type: 'Dr' },
      { id: 'e4', name: 'Utilities',          balance: 0,   type: 'Dr' },
      { id: 'e5', name: 'Marketing & Ads',    balance: 0,  type: 'Dr' },
      { id: 'e6', name: 'Office Supplies',    balance: 0,   type: 'Dr' },
      { id: 'e7', name: 'Depreciation',       balance: 0,   type: 'Dr' },
    ],
  },
  {
    key: 'equity',
    name: 'Equity',
    icon: 'scale-balance',
    color: '#9C27B0',
    ledgers: [
      { id: 'q1', name: "Owner's Capital",    balance: 0, type: 'Cr' },
      { id: 'q2', name: 'Retained Earnings',  balance: 0, type: 'Cr' },
      { id: 'q3', name: 'Drawings',           balance: 0,  type: 'Dr' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────
const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ═══════════════════════════════════════════════════════════════════════
// Ledgers Screen (Chart of Accounts)
// ═══════════════════════════════════════════════════════════════════════
export default function LedgersScreen() {
  const { tenantId, loading: authLoading } = useAuth();

  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width > 800;

  // ── State ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    assets: true,
    liabilities: true,
    income: false,
    expenses: false,
    equity: false,
  });
  const [showAddForm, setShowAddForm] = useState(false);

  // New ledger form
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('Assets');
  const [newBalance, setNewBalance] = useState('');
  const [newType, setNewType] = useState<'Dr' | 'Cr'>('Dr');

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
      console.error("Error fetching ledgers transactions:", err);
      setError(err.message || "Failed to load ledger transactions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && tenantId) {
      fetchTransactions();
    }
  }, [authLoading, tenantId]);

  const dynamicAccountGroups = useMemo(() => {
    let cashChange = 0;
    let bankChange = 0;
    let salesRevenue = 0;
    let gstPayable = 0;
    let expenseRent = 0;
    let expenseSalaries = 0;
    let expenseSupplies = 0;
    let cogs = 0;

    allTransactions.forEach(t => {
      const amt = Math.max(t.debit, t.credit);
      const isSalesOrReceipt = t.voucherType === 'Sales' || t.voucherType === 'Receipt';
      const isPurchaseOrPayment = t.voucherType === 'Purchase' || t.voucherType === 'Payment';

      if (t.voucherType === 'Sales') {
        salesRevenue += t.taxableValue || (amt * 0.95);
        gstPayable += t.gstAmount || (amt * 0.05);
      }

      if (t.paymentMethod === 'Cash') {
        if (isSalesOrReceipt) cashChange += amt;
        if (isPurchaseOrPayment) cashChange -= amt;
      } else if (t.paymentMethod === 'UPI' || t.paymentMethod === 'Card' || t.paymentMethod === 'Bank') {
        if (isSalesOrReceipt) bankChange += amt;
        if (isPurchaseOrPayment) bankChange -= amt;
      }

      if (t.voucherType === 'Payment') {
        if (t.partyName.toLowerCase().includes('rent')) {
          expenseRent += amt;
        } else if (t.partyName.toLowerCase().includes('salary') || t.partyName.toLowerCase().includes('wages')) {
          expenseSalaries += amt;
        } else {
          expenseSupplies += amt;
        }
      }
      
      if (t.voucherType === 'Purchase') {
        cogs += t.taxableValue || (amt * 0.95);
      }
    });

    return ACCOUNT_GROUPS.map(group => {
      return {
        ...group,
        ledgers: group.ledgers.map(ledger => {
          let bal = 0;
          if (ledger.name === 'Cash in Hand') {
            bal = cashChange;
          } else if (ledger.name === 'Bank Account - SBI') {
            bal = bankChange;
          } else if (ledger.name === 'Sales Revenue') {
            bal = salesRevenue;
          } else if (ledger.name === 'GST Payable') {
            bal = gstPayable;
          } else if (ledger.name === 'Rent Expense') {
            bal = expenseRent;
          } else if (ledger.name === 'Salaries & Wages') {
            bal = expenseSalaries;
          } else if (ledger.name === 'Office Supplies') {
            bal = expenseSupplies;
          } else if (ledger.name === 'Cost of Goods Sold') {
            bal = cogs;
          }
          return {
            ...ledger,
            balance: Math.max(0, bal),
          };
        })
      };
    });
  }, [allTransactions]);

  // ── Filtered data ───────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return dynamicAccountGroups;
    const q = searchQuery.toLowerCase();
    return dynamicAccountGroups.map(g => ({
      ...g,
      ledgers: g.ledgers.filter(l => l.name.toLowerCase().includes(q)),
    })).filter(g => g.ledgers.length > 0 || g.name.toLowerCase().includes(q));
  }, [searchQuery, dynamicAccountGroups]);

  // ── Group total ─────────────────────────────────────────────────
  const groupTotal = (group: AccountGroup) => {
    let total = 0;
    group.ledgers.forEach(l => {
      total += l.type === 'Dr' ? l.balance : -l.balance;
    });
    return total;
  };

  // ── Handle add ledger ───────────────────────────────────────────
  const handleAddLedger = () => {
    if (!newName.trim()) return;
    // In a real app → addDoc(collection(db, 'ledgers'), { ... })
    setNewName('');
    setNewBalance('');
    setNewGroup('Assets');
    setNewType('Dr');
    setShowAddForm(false);
  };

  // ── Toggle group ────────────────────────────────────────────────
  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Overall stats ───────────────────────────────────────────────
  const totalLedgers = dynamicAccountGroups.reduce((sum, g) => sum + g.ledgers.length, 0);
  const totalAssets = dynamicAccountGroups.find(g => g.key === 'assets')?.ledgers.reduce((s, l) => s + l.balance, 0) ?? 0;
  const totalLiabilities = dynamicAccountGroups.find(g => g.key === 'liabilities')?.ledgers.reduce((s, l) => s + l.balance, 0) ?? 0;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Chart of Accounts...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Chart of Accounts</Text>
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
          <Text variant="headlineSmall" style={styles.title}>Chart of Accounts</Text>
          <Text style={styles.subtitle}>Manage your ledgers and account groups — the backbone of double-entry bookkeeping</Text>
        </View>
        <Button
          mode="contained"
          icon="plus"
          onPress={() => setShowAddForm(!showAddForm)}
          style={styles.addBtn}
          labelStyle={{ fontWeight: '700' }}
        >
          {showAddForm ? 'Cancel' : 'Add Ledger'}
        </Button>
      </View>

      {/* Stats Row */}
      <View style={[styles.statsRow, !isWide && { flexDirection: 'column' }]}>
        <Card style={[styles.statCard, { borderLeftColor: '#5E35B1' }]} elevation={1}>
          <Card.Content style={styles.statContent}>
            <View style={[styles.statIcon, { backgroundColor: appTheme.colors.surface }]}>
              <Icon name="book-open-page-variant" size={22} color="#5E35B1" />
            </View>
            <View>
              <Text style={styles.statLabel}>Total Ledgers</Text>
              <Text style={[styles.statValue, { color: appTheme.colors.onSurface }]}>{totalLedgers}</Text>
            </View>
          </Card.Content>
        </Card>
        <Card style={[styles.statCard, { borderLeftColor: '#1565C0' }]} elevation={1}>
          <Card.Content style={styles.statContent}>
            <View style={[styles.statIcon, { backgroundColor: appTheme.colors.surface }]}>
              <Icon name="arrow-up-bold" size={22} color="#1565C0" />
            </View>
            <View>
              <Text style={styles.statLabel}>Total Assets</Text>
              <Text style={[styles.statValue, { color: appTheme.colors.onSurface }]}>{fmt(totalAssets)}</Text>
            </View>
          </Card.Content>
        </Card>
        <Card style={[styles.statCard, { borderLeftColor: '#C62828' }]} elevation={1}>
          <Card.Content style={styles.statContent}>
            <View style={[styles.statIcon, { backgroundColor: appTheme.colors.surface }]}>
              <Icon name="arrow-down-bold" size={22} color="#C62828" />
            </View>
            <View>
              <Text style={styles.statLabel}>Total Liabilities</Text>
              <Text style={[styles.statValue, { color: appTheme.colors.onSurface }]}>{fmt(totalLiabilities)}</Text>
            </View>
          </Card.Content>
        </Card>
        <Card style={[styles.statCard, { borderLeftColor: '#2E7D32' }]} elevation={1}>
          <Card.Content style={styles.statContent}>
            <View style={[styles.statIcon, { backgroundColor: appTheme.colors.surface }]}>
              <Icon name="scale-balance" size={22} color="#2E7D32" />
            </View>
            <View>
              <Text style={styles.statLabel}>Net Worth</Text>
              <Text style={[styles.statValue, { color: appTheme.colors.onSurface }]}>{fmt(totalAssets - totalLiabilities)}</Text>
            </View>
          </Card.Content>
        </Card>
      </View>

      {/* Add Ledger Inline Form */}
      {showAddForm && (
        <Card style={[styles.card, { marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#5E35B1' }]} elevation={2}>
          <Card.Content>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 16, color: appTheme.colors.onSurface }}>
              <Icon name="plus-circle" size={20} color="#5E35B1" /> {' '}Create New Ledger
            </Text>
            <View style={[styles.formRow, !isWide && { flexDirection: 'column' }]}>
              <TextInput
                label="Ledger Name"
                value={newName}
                onChangeText={setNewName}
                mode="outlined"
                style={[styles.formInput, !isWide && { minWidth: '100%' }]}
                dense
              />
              <TextInput
                label="Account Group"
                value={newGroup}
                onChangeText={setNewGroup}
                mode="outlined"
                style={[styles.formInput, !isWide && { minWidth: '100%' }]}
                right={<TextInput.Icon icon="chevron-down" />}
                dense
              />
              <TextInput
                label="Opening Balance"
                value={newBalance}
                onChangeText={setNewBalance}
                mode="outlined"
                keyboardType="numeric"
                left={<TextInput.Affix text="₹" />}
                style={[styles.formInput, !isWide && { minWidth: '100%' }]}
                dense
              />
              <View style={styles.typeToggle}>
                <TouchableOpacity
                  style={[styles.typeBtn, newType === 'Dr' && styles.typeBtnActiveDr]}
                  onPress={() => setNewType('Dr')}
                >
                  <Text style={[styles.typeBtnText, newType === 'Dr' && { color: appTheme.colors.onSurface }]}>Debit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, newType === 'Cr' && styles.typeBtnActiveCr]}
                  onPress={() => setNewType('Cr')}
                >
                  <Text style={[styles.typeBtnText, newType === 'Cr' && { color: appTheme.colors.onSurface }]}>Credit</Text>
                </TouchableOpacity>
              </View>
              <Button mode="contained" onPress={handleAddLedger} style={styles.saveBtn} labelStyle={{ fontWeight: '700' }}>
                Save Ledger
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Search Bar */}
      <View style={{ marginBottom: 20 }}>
        <TextInput
          label="Search ledgers..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          mode="outlined"
          left={<TextInput.Icon icon="magnify" />}
          right={searchQuery ? <TextInput.Icon icon="close" onPress={() => setSearchQuery('')} /> : undefined}
          style={{ backgroundColor: 'white', borderRadius: 12 }}
          dense
        />
      </View>

      {/* Account Groups */}
      {filteredGroups.map((group) => {
        const isExpanded = expandedGroups[group.key] ?? false;
        const total = groupTotal(group);
        const totalAbs = Math.abs(total);
        const totalType = total >= 0 ? 'Dr' : 'Cr';

        return (
          <Card
            key={group.key}
            style={[styles.groupCard, { borderLeftWidth: 5, borderLeftColor: group.color }]}
            elevation={1}
          >
            {/* Group Header */}
            <TouchableOpacity
              onPress={() => toggleGroup(group.key)}
              activeOpacity={0.7}
            >
              <View style={styles.groupHeader}>
                <View style={styles.groupHeaderLeft}>
                  <View style={[styles.groupIconWrap, { backgroundColor: group.color + '18' }]}>
                    <Icon name={group.icon} size={22} color={group.color} />
                  </View>
                  <View>
                    <Text style={[styles.groupName, { color: group.color }]}>{group.name}</Text>
                    <Text style={styles.groupCount}>{group.ledgers.length} ledgers</Text>
                  </View>
                </View>
                <View style={styles.groupHeaderRight}>
                  <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                    <Text style={[styles.groupTotal, { color: group.color }]}>{fmt(totalAbs)}</Text>
                    <Text style={styles.groupTotalType}>{totalType}</Text>
                  </View>
                  <Icon
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color={group.color}
                  />
                </View>
              </View>
            </TouchableOpacity>

            {/* Ledger Rows */}
            {isExpanded && (
              <View style={styles.ledgerList}>
                <Divider style={{ backgroundColor: group.color + '30' }} />
                {group.ledgers.map((ledger, idx) => (
                  <View key={ledger.id}>
                    <View style={styles.ledgerRow}>
                      <View style={styles.ledgerNameWrap}>
                        <View style={[styles.ledgerDot, { backgroundColor: group.color }]} />
                        <Text style={styles.ledgerName}>{ledger.name}</Text>
                      </View>
                      <View style={styles.ledgerBalanceWrap}>
                        <Text style={[styles.ledgerBalance, { color: ledger.type === 'Dr' ? '#1565C0' : '#C62828' }]}>
                          {fmt(ledger.balance)}
                        </Text>
                        <View style={[
                          styles.typeBadge,
                          { backgroundColor: ledger.type === 'Dr' ? '#E3F2FD' : '#FFEBEE' },
                        ]}>
                          <Text style={[
                            styles.typeBadgeText,
                            { color: ledger.type === 'Dr' ? '#1565C0' : '#C62828' },
                          ]}>
                            {ledger.type}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {idx < group.ledgers.length - 1 && <Divider style={{ marginLeft: 32 }} />}
                  </View>
                ))}
              </View>
            )}
          </Card>
        );
      })}

      {filteredGroups.length === 0 && (
        <Card style={[styles.card, { marginBottom: 32 }]} elevation={1}>
          <Card.Content style={styles.emptyState}>
            <Icon name="file-search-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No ledgers match "{searchQuery}"</Text>
          </Card.Content>
        </Card>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { paddingVertical: 24, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  title: { fontWeight: 'bold', },
  subtitle: { fontSize: 13, marginTop: 2 },
  addBtn: { borderRadius: DS.radius.md, paddingHorizontal: 8 },

  card: { backgroundColor: DS.colors.cardBg, borderRadius: DS.radius.md },

  // Stats
  statsRow: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: DS.colors.cardBg, borderRadius: DS.radius.md, borderLeftWidth: 4 },
  statContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statIcon: { width: 44, height: 44, borderRadius: DS.radius.md, justifyContent: 'center', alignItems: 'center' },
  statLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },

  // Form
  formRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center' },
  formInput: { flex: 1, minWidth: 180, backgroundColor: DS.colors.cardBg },
  typeToggle: { flexDirection: 'row', borderRadius: DS.radius.sm, overflow: 'hidden', borderWidth: 1.5, },
  typeBtn: { paddingHorizontal: 18, paddingVertical: 10 },
  typeBtnText: { fontWeight: '700', fontSize: 13, },
  typeBtnActiveDr: { },
  typeBtnActiveCr: { },
  saveBtn: { borderRadius: DS.radius.sm, paddingHorizontal: 8 },

  // Group card
  groupCard: { backgroundColor: DS.colors.cardBg, borderRadius: DS.radius.md, marginBottom: 16, overflow: 'hidden' },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18 },
  groupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  groupIconWrap: { width: 44, height: 44, borderRadius: DS.radius.md, justifyContent: 'center', alignItems: 'center' },
  groupName: { fontSize: 17, fontWeight: '800' },
  groupCount: { fontSize: 12, marginTop: 2 },
  groupHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  groupTotal: { fontSize: 18, fontWeight: '800' },
  groupTotalType: { fontSize: 11, textAlign: 'right' },

  // Ledger rows
  ledgerList: { paddingBottom: 8 },
  ledgerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  ledgerNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  ledgerDot: { width: 8, height: 8, borderRadius: 4 },
  ledgerName: { fontSize: 14, fontWeight: '500' },
  ledgerBalanceWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ledgerBalance: { fontSize: 14, fontWeight: '700' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: DS.radius.sm },
  typeBadgeText: { fontSize: 11, fontWeight: '800' },

  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { marginTop: 10, fontSize: 14 },
});
