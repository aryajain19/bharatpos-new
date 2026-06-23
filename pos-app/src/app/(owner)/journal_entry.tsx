import { useAppTheme } from '../../providers/ThemeProvider';
import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Alert, Platform, ActivityIndicator } from 'react-native';
import { Text, useTheme, Card, DataTable, Button, Divider, IconButton, Surface, TextInput } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type VoucherType = 'Sales' | 'Purchase' | 'Payment' | 'Receipt' | 'Contra' | 'Journal';

interface EntryLine {
  id: string;
  ledger: string;
  debit: string;
  credit: string;
}

const VOUCHER_TYPES: { label: VoucherType; color: string; icon: string }[] = [
  { label: 'Sales', color: '#1E293B', icon: 'cart-arrow-up' },
  { label: 'Purchase', color: '#1E293B', icon: 'cart-arrow-down' },
  { label: 'Payment', color: '#1E293B', icon: 'cash-minus' },
  { label: 'Receipt', color: '#1E293B', icon: 'cash-plus' },
  { label: 'Contra', color: '#1E293B', icon: 'bank-transfer' },
  { label: 'Journal', color: '#1E293B', icon: 'book-open-page-variant' },
];



const TYPE_BADGE_COLORS: Record<VoucherType, string> = {
  Sales: '#E8F5E9',
  Purchase: '#E3F2FD',
  Payment: '#FFF3E0',
  Receipt: '#F3E5F5',
  Contra: '#ECEFF1',
  Journal: '#FCE4EC',
};

const TYPE_TEXT_COLORS: Record<VoucherType, string> = {
  Sales: '#2E7D32',
  Purchase: '#1565C0',
  Payment: '#E65100',
  Receipt: '#6A1B9A',
  Contra: '#37474F',
  Journal: '#AD1457',
};

let lineIdCounter = 3;

export default function JournalEntryScreen() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const { width } = useWindowDimensions();
  const isDesktop = width > 800;

  const [selectedType, setSelectedType] = useState<VoucherType>('Journal');
  const [voucherDate, setVoucherDate] = useState(() => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  });
  const [randomSeq, setRandomSeq] = useState(() => Math.floor(1000 + Math.random() * 9000));
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<EntryLine[]>([
    { id: '1', ledger: '', debit: '', credit: '' },
    { id: '2', ledger: '', debit: '', credit: '' },
  ]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = async () => {
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
      const tenantId = auth.currentUser?.uid || 'anonymous';
      const q = query(collection(db, 'transactions'), where('tenant_id', '==', tenantId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllTransactions(data);
    } catch (err: any) {
      console.error("Error fetching recent vouchers:", err);
      setError(err.message || "Failed to load recent transactions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const voucherNumber = useMemo(() => {
    const prefixMap: Record<VoucherType, string> = {
      Sales: 'SV', Purchase: 'PU', Payment: 'PV', Receipt: 'RV', Contra: 'CV', Journal: 'JV',
    };
    return `${prefixMap[selectedType]}-2026-${randomSeq}`;
  }, [selectedType, randomSeq]);

  const totalDebit = useMemo(() => lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0), [lines]);
  const isBalanced = totalDebit > 0 && totalDebit === totalCredit;

  const updateLine = (id: string, field: keyof EntryLine, value: string) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const addLine = () => {
    lineIdCounter++;
    setLines(prev => [...prev, { id: String(lineIdCounter), ledger: '', debit: '', credit: '' }]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const formatINR = (n: number) => {
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleSaveVoucher = () => {
    if (!isBalanced) return;

    // Convert DD/MM/YYYY to YYYY-MM-DD
    const parts = voucherDate.split('/');
    const dateStr = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : voucherDate;

    const saveToFirebase = async () => {
      const { isFirebaseConfigured, db, auth } = await import('../../lib/firebase');
      const { collection, addDoc } = await import('../../lib/firestore_adapter');
      if (isFirebaseConfigured) {
        try {
          const tenantId = auth.currentUser?.uid || 'anonymous';
          await addDoc(collection(db, 'transactions'), {
            tenant_id: tenantId,
            dateTime: `${dateStr} 12:00`,
            created_at: new Date().toISOString(),
            voucherType: selectedType,
            voucherNo: voucherNumber,
            partyName: lines[0]?.ledger || 'Journal Voucher',
            debit: totalDebit,
            credit: totalCredit,
            paymentMethod: selectedType === 'Receipt' ? 'UPI' : selectedType === 'Payment' ? 'Cash' : 'None',
            gstAmount: 0,
            taxableValue: totalDebit,
          });
        } catch (error) {
          console.error("Error saving journal entry:", error);
        }
      }
    };
    saveToFirebase();

    Alert.alert(' Voucher Saved', `Accounting voucher ${voucherNumber} has been recorded in the Day Book.`);
    setLines([
      { id: '1', ledger: '', debit: '', credit: '' },
      { id: '2', ledger: '', debit: '', credit: '' },
    ]);
    setNarration('');
    setRandomSeq(Math.floor(1000 + Math.random() * 9000));
    loadTransactions();
  };

  const recentVouchers = useMemo(() => {
    return allTransactions.slice(0, 5).map(t => {
      const parts = t.dateTime.split(' ')[0].split('-');
      const dateStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : t.dateTime.split(' ')[0];
      return {
        voucherNo: t.voucherNo,
        type: t.voucherType as VoucherType,
        date: dateStr,
        amount: Math.max(t.debit, t.credit),
        narration: t.partyName,
      };
    });
  }, [allTransactions]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Journal Entry...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Journal Entry</Text>
          <Text style={{ marginTop: 8, color: 'gray', textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 24 }}>{error}</Text>
          <Button mode="contained" onPress={loadTransactions} style={{ borderRadius: 10, width: '100%', backgroundColor: appTheme.colors.primary }}>
            Retry Sync
          </Button>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="book-edit-outline" size={28} color="#5E35B1" />
          <Text variant="headlineSmall" style={styles.title}>Journal Entry — Voucher Entry</Text>
        </View>
        <Text style={styles.subtitle}>Create manual accounting entries like Sales, Purchases, Payments & more</Text>
      </View>

      {/* Voucher Type Selector */}
      <Card style={styles.card} elevation={1}>
        <Card.Content>
          <Text variant="titleSmall" style={{ fontWeight: 'bold', marginBottom: 12, color: appTheme.colors.onSurface }}>SELECT VOUCHER TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {VOUCHER_TYPES.map(vt => {
                const active = selectedType === vt.label;
                return (
                  <TouchableOpacity
                    key={vt.label}
                    onPress={() => setSelectedType(vt.label)}
                    style={[
                      styles.typeBtn,
                      { backgroundColor: active ? vt.color : '#F5F6FA', borderColor: active ? vt.color : '#E0E0E0' },
                    ]}
                  >
                    <Icon name={vt.icon} size={18} color={active ? '#fff' : '#777'} />
                    <Text style={{ color: active ? '#fff' : '#555', fontWeight: active ? 'bold' : '600', fontSize: 13, marginLeft: 6 }}>
                      {vt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </Card.Content>
      </Card>

      {/* Voucher Header */}
      <Card style={[styles.card, { marginTop: 16 }]} elevation={1}>
        <Card.Content>
          <View style={[styles.headerRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
            <View style={[styles.headerField, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Voucher Number</Text>
              <Surface style={styles.readonlyField} elevation={0}>
                <Icon name="pound" size={16} color="#5E35B1" />
                <Text style={styles.readonlyText}>{voucherNumber}</Text>
              </Surface>
            </View>
            <View style={[styles.headerField, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Voucher Type</Text>
              <Surface style={[styles.readonlyField, { backgroundColor: TYPE_BADGE_COLORS[selectedType] }]} elevation={0}>
                <Icon name="tag" size={16} color={TYPE_TEXT_COLORS[selectedType]} />
                <Text style={[styles.readonlyText, { color: TYPE_TEXT_COLORS[selectedType], fontWeight: 'bold' }]}>{selectedType}</Text>
              </Surface>
            </View>
            <View style={[styles.headerField, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput
                value={voucherDate}
                onChangeText={setVoucherDate}
                mode="outlined"
                dense
                style={{ backgroundColor: 'white' }}
                outlineStyle={{ borderRadius: 8 }}
                left={<TextInput.Icon icon="calendar" size={18} />}
              />
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Entry Lines */}
      <Card style={[styles.card, { marginTop: 16 }]} elevation={1}>
        <Card.Content>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View>
              <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Entry Lines</Text>
              <Text style={{ color: appTheme.colors.onSurface, fontSize: 12, marginTop: 2 }}>Add ledger accounts with debit or credit amounts</Text>
            </View>
            <Button
              mode="contained"
              icon="plus"
              onPress={addLine}
              compact
              style={{ borderRadius: 8, backgroundColor: appTheme.colors.surface }}
              labelStyle={{ fontSize: 12 }}
            >
              Add Row
            </Button>
          </View>

          {/* Table Header */}
          <View style={styles.lineHeader}>
            <Text style={[styles.lineHeaderText, { flex: 0.5 }]}>#</Text>
            <Text style={[styles.lineHeaderText, { flex: 3 }]}>Ledger Account</Text>
            <Text style={[styles.lineHeaderText, { flex: 1.5 }]}>Debit (₹)</Text>
            <Text style={[styles.lineHeaderText, { flex: 1.5 }]}>Credit (₹)</Text>
            <Text style={[styles.lineHeaderText, { flex: 0.5 }]}> </Text>
          </View>

          {lines.map((line, idx) => (
            <View key={line.id} style={styles.lineRow}>
              <Text style={[styles.lineIndex, { flex: 0.5 }]}>{idx + 1}</Text>
              <View style={{ flex: 3, marginRight: 8 }}>
                <TextInput
                  value={line.ledger}
                  onChangeText={(v: any) => updateLine(line.id, 'ledger', v)}
                  mode="outlined"
                  dense
                  placeholder="e.g. Cash, Bank, Sales..."
                  style={styles.lineInput}
                  outlineStyle={{ borderRadius: 6, borderColor: appTheme.colors.outline }}
                />
              </View>
              <View style={{ flex: 1.5, marginRight: 8 }}>
                <TextInput
                  value={line.debit}
                  onChangeText={(v: any) => updateLine(line.id, 'debit', v)}
                  mode="outlined"
                  dense
                  placeholder="0.00"
                  keyboardType="numeric"
                  style={[styles.lineInput, { backgroundColor: line.debit ? '#E8F5E9' : 'white' }]}
                  outlineStyle={{ borderRadius: 6, borderColor: line.debit ? '#4CAF50' : '#E0E0E0' }}
                />
              </View>
              <View style={{ flex: 1.5, marginRight: 8 }}>
                <TextInput
                  value={line.credit}
                  onChangeText={(v: any) => updateLine(line.id, 'credit', v)}
                  mode="outlined"
                  dense
                  placeholder="0.00"
                  keyboardType="numeric"
                  style={[styles.lineInput, { backgroundColor: line.credit ? '#FFF3E0' : 'white' }]}
                  outlineStyle={{ borderRadius: 6, borderColor: line.credit ? '#FF9800' : '#E0E0E0' }}
                />
              </View>
              <View style={{ flex: 0.5, alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={() => removeLine(line.id)}
                  style={[styles.removeBtn, { opacity: lines.length <= 2 ? 0.3 : 1 }]}
                  disabled={lines.length <= 2}
                >
                  <Icon name="close-circle" size={20} color="#F44336" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Totals */}
          <Divider style={{ marginVertical: 16, backgroundColor: appTheme.colors.surface }} />
          <View style={styles.totalsRow}>
            <View style={{ flex: 0.5 }} />
            <Text style={[styles.totalLabel, { flex: 3 }]}>TOTALS</Text>
            <View style={[styles.totalBox, { flex: 1.5, backgroundColor: appTheme.colors.surface, borderColor: appTheme.colors.outline }]}>
              <Text style={[styles.totalValue, { color: appTheme.colors.onSurface }]}>{formatINR(totalDebit)}</Text>
            </View>
            <View style={[styles.totalBox, { flex: 1.5, backgroundColor: appTheme.colors.surface, borderColor: appTheme.colors.outline, marginLeft: 8 }]}>
              <Text style={[styles.totalValue, { color: appTheme.colors.onSurface }]}>{formatINR(totalCredit)}</Text>
            </View>
            <View style={{ flex: 0.5 }} />
          </View>

          {/* Balance Indicator */}
          <View style={[styles.balanceIndicator, { backgroundColor: isBalanced ? '#E8F5E9' : (totalDebit === 0 && totalCredit === 0) ? '#F5F5F5' : '#FFEBEE' }]}>
            <Icon
              name={isBalanced ? 'check-circle' : (totalDebit === 0 && totalCredit === 0) ? 'information' : 'alert-circle'}
              size={20}
              color={isBalanced ? '#2E7D32' : (totalDebit === 0 && totalCredit === 0) ? '#9E9E9E' : '#C62828'}
            />
            <Text style={{
              marginLeft: 8,
              fontWeight: 'bold',
              fontSize: 14,
              color: isBalanced ? '#2E7D32' : (totalDebit === 0 && totalCredit === 0) ? '#9E9E9E' : '#C62828',
            }}>
              {isBalanced ? ' Balanced — Voucher is ready to save' : (totalDebit === 0 && totalCredit === 0) ? 'Enter debit and credit amounts' : ` Not Balanced — Difference: ${formatINR(Math.abs(totalDebit - totalCredit))}`}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Narration + Save */}
      <Card style={[styles.card, { marginTop: 16 }]} elevation={1}>
        <Card.Content>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 12 }}>Narration</Text>
          <TextInput
            value={narration}
            onChangeText={setNarration}
            mode="outlined"
            multiline
            numberOfLines={3}
            placeholder="Enter voucher narration / description..."
            style={{ backgroundColor: 'white', marginBottom: 16 }}
            outlineStyle={{ borderRadius: 8 }}
          />
          <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end' }}>
            <Button
              mode="outlined"
              icon="eraser"
              onPress={() => {
                setLines([
                  { id: '1', ledger: '', debit: '', credit: '' },
                  { id: '2', ledger: '', debit: '', credit: '' },
                ]);
                setNarration('');
              }}
              style={{ borderRadius: 8, borderColor: appTheme.colors.outline }}
             
            >
              Clear All
            </Button>
            <Button
              mode="contained"
              icon="content-save"
              onPress={handleSaveVoucher}
              disabled={!isBalanced}
              style={{ borderRadius: 8, backgroundColor: isBalanced ? '#4CAF50' : '#BDBDBD', paddingHorizontal: 16 }}
              labelStyle={{ fontWeight: 'bold' }}
            >
              Save Voucher
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Recent Vouchers */}
      <Card style={[styles.card, { marginTop: 24, marginBottom: 40 }]} elevation={1}>
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Icon name="history" size={22} color="#5E35B1" />
            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Recent Vouchers</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 600 }}>
              <DataTable>
                <DataTable.Header style={{ backgroundColor: appTheme.colors.surface }}>
                  <DataTable.Title><Text style={styles.tableHead}>Voucher No</Text></DataTable.Title>
                  <DataTable.Title><Text style={styles.tableHead}>Type</Text></DataTable.Title>
                  <DataTable.Title><Text style={styles.tableHead}>Date</Text></DataTable.Title>
                  <DataTable.Title numeric><Text style={styles.tableHead}>Amount</Text></DataTable.Title>
                  <DataTable.Title><Text style={styles.tableHead}>Narration</Text></DataTable.Title>
                </DataTable.Header>

                {recentVouchers.map((v, i) => (
                  <DataTable.Row key={i} style={{ borderBottomColor: '#F0F0F0' }}>
                    <DataTable.Cell>
                      <Text style={{ fontWeight: 'bold', color: appTheme.colors.onSurface, fontSize: 13 }}>{v.voucherNo}</Text>
                    </DataTable.Cell>
                    <DataTable.Cell>
                      <View style={[styles.typeBadge, { backgroundColor: TYPE_BADGE_COLORS[v.type] }]}>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: TYPE_TEXT_COLORS[v.type] }}>{v.type}</Text>
                      </View>
                    </DataTable.Cell>
                    <DataTable.Cell><Text style={{ fontSize: 13 }}>{v.date}</Text></DataTable.Cell>
                    <DataTable.Cell numeric><Text style={{ fontWeight: 'bold', fontSize: 13 }}>{formatINR(v.amount)}</Text></DataTable.Cell>
                    <DataTable.Cell><Text style={{ fontSize: 12, color: appTheme.colors.onSurface }} numberOfLines={1}>{v.narration}</Text></DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            </View>
          </ScrollView>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { paddingTop: 24, paddingBottom: 16 },
  title: { fontWeight: 'bold', },
  subtitle: { fontSize: 13, marginTop: 4, marginLeft: 38 },
  card: { backgroundColor: 'white', borderRadius: 12 },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  headerRow: { gap: 16 },
  headerField: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: 'bold', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  readonlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  readonlyText: { fontSize: 14, fontWeight: '600' },
  lineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  lineHeaderText: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  lineRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginBottom: 8 },
  lineIndex: { fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  lineInput: { backgroundColor: 'white', height: 38, fontSize: 13 },
  removeBtn: { padding: 4 },
  totalsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  totalLabel: { fontWeight: 'bold', fontSize: 13, letterSpacing: 1 },
  totalBox: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, marginRight: 0 },
  totalValue: { fontWeight: 'bold', fontSize: 14, textAlign: 'right' },
  balanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tableHead: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
});
