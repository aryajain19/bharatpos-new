import { useAppTheme } from '../../providers/ThemeProvider';

import { useAuth } from '../../providers/AuthProvider';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, ActivityIndicator, Alert, Platform } from 'react-native';
import { Text, useTheme, Card, DataTable, Button, Surface, Divider, TextInput } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { db, isFirebaseConfigured, auth } from '../../lib/firebase';
import { collection, getDocs, query, orderBy, where, doc, getDoc, setDoc } from '../../lib/firestore_adapter';
import * as Print from 'expo-print';

// Dynamic GST summaries are computed from actual sales data.
const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

type TabType = 'overview' | 'gstr1' | 'gstr3b';

export default function GSTManagementScreen() {
  const { tenantId, loading: authLoading } = useAuth();

  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const { width } = useWindowDimensions();
  const isDesktop = width > 800;

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [gstNumber, setGstNumber] = useState('');
  const [defaultGstPct, setDefaultGstPct] = useState('18');
  const [returnPeriod, setReturnPeriod] = useState('June 2026');
  const [sales, setSales] = useState<any[]>([]);
  const [totalGstCollected, setTotalGstCollected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('BharatPOS');

  useEffect(() => {
    if (!authLoading && tenantId) {
      loadSettings();
      fetchSales();
    }
  }, [authLoading, tenantId]);

  const loadSettings = async () => {
    // Load from localStorage first for fast display
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const sn = window.localStorage.getItem('storeName');
      if (sn) setStoreName(sn);
      const gn = window.localStorage.getItem('gstNumber');
      if (gn) setGstNumber(gn);
    }
    // Then load from Firebase for source of truth
    if (!isFirebaseConfigured) return;
    try {
      if (!tenantId) return;
      const settingsRef = doc(db, 'settings', tenantId);
      const snap = await getDoc(settingsRef);
      if (snap.exists()) {
        const d = snap.data();
        if (d.gstNumber) setGstNumber(d.gstNumber);
        if (d.defaultGstPct) setDefaultGstPct(String(d.defaultGstPct));
        if (d.storeName) setStoreName(d.storeName);
      }
    } catch (err) {
      console.error('Failed to load GST settings:', err);
    }
  };

  const handleSaveSettings = async () => {
    if (!isFirebaseConfigured) {
      Alert.alert('Error', 'Firebase is not configured.');
      return;
    }
    try {
      if (!tenantId) return;
      const settingsRef = doc(db, 'settings', tenantId);
      await setDoc(settingsRef, {
        gstNumber,
        defaultGstPct: parseFloat(defaultGstPct) || 18,
        storeName,
        tenant_id: tenantId,
      }, { merge: true });
      // Also persist in localStorage for offline use
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.setItem('gstNumber', gstNumber);
        window.localStorage.setItem('storeName', storeName);
      }
      Alert.alert('Saved', 'GST settings saved successfully.');
    } catch (err: any) {
      console.error('Failed to save GST settings:', err);
      Alert.alert('Error', err.message || 'Failed to save settings.');
    }
  };

  const fetchSales = async () => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!tenantId) return;
      const q = query(collection(db, 'sales'), where('tenant_id', '==', tenantId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSales(data);
      let totalGst = 0;
      data.forEach((sale: any) => {
        totalGst += parseFloat(sale.gst_collected || 0);
      });
      setTotalGstCollected(totalGst);
    } catch (err: any) {
      console.error("Error fetching sales for GST report:", err);
      setError(err.message || "Failed to load sales GST records.");
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: 'view-dashboard-outline' },
    { key: 'gstr1', label: 'GSTR-1', icon: 'file-document-outline' },
    { key: 'gstr3b', label: 'GSTR-3B', icon: 'file-chart-outline' },
  ];

  const { b2bSupplies, b2cSmallSupplies, hsnSummary, outwardSupplies, eligibleITC, paymentOfTax, b2bTotals, cgstTot, sgstTot } = React.useMemo(() => {
    let cgstTot = 0, sgstTot = 0, taxTot = 0;
    const rates: Record<number, any> = {};
    const hsnGroups: Record<string, { hsn: string; description: string; totalQty: number; taxableValue: number; igst: number; cgst: number; sgst: number }> = {};
    const b2bRecords: any[] = [];
    let b2bTotalTaxable = 0, b2bTotalCgst = 0, b2bTotalSgst = 0, b2bTotalTotal = 0;
    
    sales.forEach(sale => {
      const items = sale.items || [];
      const isB2B = !!(sale.customer_gstin && sale.customer_gstin.length >= 15);
      let saleTaxable = 0, saleCgst = 0, saleSgst = 0;

      items.forEach((item: any) => {
        const rate = item.gst_pct || 0;
        const taxable = (item.price * item.qty);
        const cgst = (taxable * (rate / 100)) / 2;
        const sgst = (taxable * (rate / 100)) / 2;
        
        taxTot += taxable;
        cgstTot += cgst;
        sgstTot += sgst;
        saleTaxable += taxable;
        saleCgst += cgst;
        saleSgst += sgst;

        if (rate > 0 && !isB2B) {
          if (!rates[rate]) rates[rate] = { rate, taxableValue: 0, cgst: 0, sgst: 0, total: 0 };
          rates[rate].taxableValue += taxable;
          rates[rate].cgst += cgst;
          rates[rate].sgst += sgst;
          rates[rate].total += (taxable + cgst + sgst);
        }

        // HSN Summary grouping
        const hsnCode = item.hsn || 'N/A';
        if (!hsnGroups[hsnCode]) {
          hsnGroups[hsnCode] = { hsn: hsnCode, description: item.name || 'Unknown', totalQty: 0, taxableValue: 0, igst: 0, cgst: 0, sgst: 0 };
        }
        hsnGroups[hsnCode].totalQty += (item.qty || 1);
        hsnGroups[hsnCode].taxableValue += taxable;
        hsnGroups[hsnCode].cgst += cgst;
        hsnGroups[hsnCode].sgst += sgst;
      });

      // B2B Supplies: group per sale if customer GSTIN exists
      if (isB2B) {
        const saleTotal = saleTaxable + saleCgst + saleSgst;
        const dateStr = sale.created_at ? new Date(sale.created_at).toLocaleDateString('en-IN') : (sale.dateTime || '—');
        b2bRecords.push({
          gstin: sale.customer_gstin,
          invoiceNo: sale.bill_no || sale.voucherNo || '—',
          date: dateStr,
          taxableValue: saleTaxable,
          cgst: saleCgst,
          sgst: saleSgst,
          total: saleTotal,
        });
        b2bTotalTaxable += saleTaxable;
        b2bTotalCgst += saleCgst;
        b2bTotalSgst += saleSgst;
        b2bTotalTotal += saleTotal;
      }
    });

    const hsnSummaryArr = Object.values(hsnGroups).filter(h => h.hsn !== 'N/A').sort((a, b) => a.hsn.localeCompare(b.hsn));

    return {
      b2bSupplies: b2bRecords,
      b2bTotals: { taxable: b2bTotalTaxable, cgst: b2bTotalCgst, sgst: b2bTotalSgst, total: b2bTotalTotal },
      b2cSmallSupplies: Object.values(rates),
      hsnSummary: hsnSummaryArr,
      outwardSupplies: [
        { nature: 'Taxable outward supplies (other than zero/nil/exempt)', taxable: taxTot, igst: 0, cgst: cgstTot, sgst: sgstTot },
        { nature: 'Outward supplies (zero rated)', taxable: 0, igst: 0, cgst: 0, sgst: 0 },
        { nature: 'Outward supplies (nil rated, exempt)', taxable: 0, igst: 0, cgst: 0, sgst: 0 },
        { nature: 'Non-GST outward supplies', taxable: 0, igst: 0, cgst: 0, sgst: 0 },
      ],
      eligibleITC: [
        { nature: 'Import of goods', igst: 0, cgst: 0, sgst: 0 },
        { nature: 'Import of services', igst: 0, cgst: 0, sgst: 0 },
        { nature: 'Inward supplies from registered persons', igst: 0, cgst: 0, sgst: 0 },
        { nature: 'Inward supplies from composition/URP', igst: 0, cgst: 0, sgst: 0 },
      ],
      paymentOfTax: [
        { description: 'CGST', taxPayable: cgstTot, paidITC: 0, paidCash: cgstTot, total: cgstTot },
        { description: 'SGST', taxPayable: sgstTot, paidITC: 0, paidCash: sgstTot, total: sgstTot },
        { description: 'IGST', taxPayable: 0, paidITC: 0, paidCash: 0, total: 0 },
        { description: 'Cess', taxPayable: 0, paidITC: 0, paidCash: 0, total: 0 },
      ],
      cgstTot,
      sgstTot
    };
  }, [sales]);

  // ── Download / Print Handlers ──────────────────────────────────────────

  const triggerDownload = (data: object, filename: string) => {
    const jsonStr = JSON.stringify(data, null, 2);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // Native: use Share API
      const { Share } = require('react-native');
      Share.share({ message: jsonStr, title: filename }).catch(() => {});
    }
  };

  const handleDownloadGSTR1 = () => {
    const gstr1Data = {
      gstin: gstNumber,
      fp: returnPeriod,
      b2b: b2bSupplies.map(s => ({
        ctin: s.gstin,
        inv: [{ inum: s.invoiceNo, idt: s.date, val: s.total, itms: [{ txval: s.taxableValue, camt: s.cgst, samt: s.sgst }] }]
      })),
      b2cs: b2cSmallSupplies.map(r => ({ rt: r.rate, txval: r.taxableValue, camt: r.cgst, samt: r.sgst })),
      hsn: { data: hsnSummary.map(h => ({ hsn_sc: h.hsn, desc: h.description, qty: h.totalQty, txval: h.taxableValue, camt: h.cgst, samt: h.sgst, iamt: 0 })) },
    };
    triggerDownload(gstr1Data, `GSTR1_${returnPeriod.replace(/\s/g, '_')}.json`);
    Alert.alert('Downloaded', `GSTR-1 JSON for ${returnPeriod} exported.`);
  };

  const handleDownloadGSTR3B = () => {
    const gstr3bData = {
      gstin: gstNumber,
      ret_period: returnPeriod,
      sup_details: {
        osup_det: { txval: outwardSupplies[0].taxable, iamt: 0, camt: outwardSupplies[0].cgst, samt: outwardSupplies[0].sgst },
        osup_zero: { txval: 0, iamt: 0, camt: 0, samt: 0 },
        osup_nil_exmp: { txval: 0 },
        osup_nongst: { txval: 0 },
      },
      itc_elg: { itc_avl: eligibleITC.map(r => ({ ty: r.nature, iamt: r.igst, camt: r.cgst, samt: r.sgst })) },
      intr_ltfee: { intr_details: { iamt: 0, camt: 0, samt: 0 } },
      tax_pmt: paymentOfTax.map(r => ({ desc: r.description, tax_payable: r.taxPayable, paid_itc: r.paidITC, paid_cash: r.paidCash })),
    };
    triggerDownload(gstr3bData, `GSTR3B_${returnPeriod.replace(/\s/g, '_')}.json`);
    Alert.alert('Downloaded', `GSTR-3B JSON for ${returnPeriod} exported.`);
  };

  const handlePrintGSTR3B = async () => {
    const outwardRows = outwardSupplies.map(r =>
      `<tr><td style="padding:6px 8px;border:1px solid #ddd;">${r.nature}</td><td style="text-align:right;padding:6px 8px;border:1px solid #ddd;">${fmt(r.taxable)}</td><td style="text-align:right;padding:6px 8px;border:1px solid #ddd;">${fmt(r.igst)}</td><td style="text-align:right;padding:6px 8px;border:1px solid #ddd;">${fmt(r.cgst)}</td><td style="text-align:right;padding:6px 8px;border:1px solid #ddd;">${fmt(r.sgst)}</td></tr>`
    ).join('');
    const taxRows = paymentOfTax.map(r =>
      `<tr><td style="padding:6px 8px;border:1px solid #ddd;font-weight:bold;">${r.description}</td><td style="text-align:right;padding:6px 8px;border:1px solid #ddd;">${fmt(r.taxPayable)}</td><td style="text-align:right;padding:6px 8px;border:1px solid #ddd;">${fmt(r.paidITC)}</td><td style="text-align:right;padding:6px 8px;border:1px solid #ddd;">${fmt(r.paidCash)}</td><td style="text-align:right;padding:6px 8px;border:1px solid #ddd;">${fmt(r.total)}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>GSTR-3B ${returnPeriod}</title>
      <style>body{font-family:sans-serif;padding:24px;color:#333}h1{font-size:20px}h2{font-size:16px;margin-top:24px}table{width:100%;border-collapse:collapse;margin-top:8px}th{background:#f5f5f5;padding:8px;border:1px solid #ddd;font-size:11px;text-transform:uppercase}</style>
    </head><body>
      <h1>Form GSTR-3B — ${returnPeriod}</h1>
      <p>GSTIN: ${gstNumber} | Business: ${storeName}</p>
      <h2>3.1 Outward Supplies & Inward Supplies (Reverse Charge)</h2>
      <table><thead><tr><th style="text-align:left">Nature</th><th>Taxable</th><th>IGST</th><th>CGST</th><th>SGST</th></tr></thead><tbody>${outwardRows}</tbody></table>
      <h2>6. Payment of Tax</h2>
      <table><thead><tr><th style="text-align:left">Description</th><th>Tax Payable</th><th>Paid via ITC</th><th>Paid via Cash</th><th>Total</th></tr></thead><tbody>${taxRows}</tbody></table>
      <p style="margin-top:24px;font-size:12px;color:#999">Generated by BharatPOS on ${new Date().toLocaleDateString('en-IN')}</p>
    </body></html>`;

    try {
      await Print.printAsync({ html });
    } catch (err) {
      console.error('Print failed:', err);
    }
  };

  // ── Renderers ──────────────────────────────────────────

  const renderOverview = () => (
    <View style={[styles.contentRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
      {/* Left: Config */}
      <View style={styles.leftCol}>
        <Card style={styles.card} elevation={1}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon name="cog-outline" size={20} color="#5E35B1" />
              <Text variant="titleMedium" style={styles.sectionTitle}>GST Configuration</Text>
            </View>
            <Text style={styles.helperText}>Update your business GST details below. This will reflect on all generated invoices.</Text>

            <TextInput
              label="Business GSTIN Number"
              value={gstNumber}
              onChangeText={setGstNumber}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Default Global GST (%)"
              value={defaultGstPct}
              onChangeText={setDefaultGstPct}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              right={<TextInput.Affix text="%" />}
            />

            <Button mode="contained" onPress={handleSaveSettings} style={styles.saveBtn} icon="content-save">
              Save Settings
            </Button>
          </Card.Content>
        </Card>

        <Card style={[styles.card, { marginTop: 20, backgroundColor: appTheme.colors.surface }]} elevation={1}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon name="currency-inr" size={22} color="rgba(255,255,255,0.85)" />
              <Text variant="titleMedium" style={{ color: 'white' }}>Total GST Collected</Text>
            </View>
            <Text variant="displaySmall" style={{ color: 'white', fontWeight: 'bold' }}>
              {fmt(totalGstCollected)}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>From all recorded sales this period</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Right: Quick Stats */}
      <View style={styles.rightCol}>
        <View style={[styles.statsGrid, { flexDirection: isDesktop ? 'row' : 'column' }]}>
          {[
            { label: 'CGST Liability', value: fmt(totalGstCollected / 2), icon: 'arrow-right-circle', color: appTheme.colors.onSurface },
            { label: 'SGST Liability', value: fmt(totalGstCollected / 2), icon: 'arrow-left-circle', color: appTheme.colors.onSurface },
            { label: 'ITC Available', value: fmt(0), icon: 'shield-check', color: appTheme.colors.onSurface },
            { label: 'Net Payable', value: fmt(totalGstCollected), icon: 'cash-register', color: appTheme.colors.onSurface },
          ].map((stat, i) => (
            <Surface key={i} style={styles.statCard} elevation={1}>
              <View style={[styles.statIcon, { backgroundColor: stat.color + '15' }]}>
                <Icon name={stat.icon} size={22} color={stat.color} />
              </View>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            </Surface>
          ))}
        </View>


      </View>
    </View>
  );

  const renderGSTR1 = () => (
    <View>
      {/* Period selector */}
      <Card style={[styles.card, { marginBottom: 20 }]} elevation={1}>
        <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Icon name="calendar-range" size={20} color="#5E35B1" />
          <Text style={{ fontWeight: '600', color: appTheme.colors.onSurface }}>Return Period:</Text>
          <TextInput
            value={returnPeriod}
            onChangeText={setReturnPeriod}
            mode="outlined"
            dense
            style={{ width: 180, backgroundColor: 'white' }}
          />
          <Button mode="contained-tonal" icon="download" onPress={handleDownloadGSTR1}>
            Download JSON
          </Button>
        </Card.Content>
      </Card>

      {/* B2B Supplies */}
      <Card style={[styles.card, { marginBottom: 20 }]} elevation={1}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.sectionBadge, { backgroundColor: appTheme.colors.surface }]}>
                <Text style={{ color: appTheme.colors.onSurface, fontWeight: 'bold', fontSize: 12 }}>4A</Text>
              </View>
              <Text variant="titleMedium" style={styles.sectionTitle}>B2B Supplies</Text>
            </View>
            <Text style={styles.sectionSub}>Supplies to registered persons</Text>
          </View>
          <ScrollView horizontal={!isDesktop} showsHorizontalScrollIndicator={false}>
            <DataTable style={{ minWidth: 850 }}>
              <DataTable.Header style={styles.dataHeader}>
                <DataTable.Title style={{ flex: 1.5 }}><Text style={styles.colHead}>GSTIN</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 1 }}><Text style={styles.colHead}>Invoice No</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 0.8 }}><Text style={styles.colHead}>Date</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHead}>Taxable Value</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 0.7 }}><Text style={styles.colHead}>CGST</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 0.7 }}><Text style={styles.colHead}>SGST</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHead}>Total</Text></DataTable.Title>
              </DataTable.Header>
              {b2bSupplies.length === 0 ? (
                <DataTable.Row>
                  <DataTable.Cell><Text>No B2B Supplies found for this period.</Text></DataTable.Cell>
                </DataTable.Row>
              ) : (
                b2bSupplies.map((row: any, i: number) => (
                  <DataTable.Row key={i} style={i % 2 === 0 ? styles.evenRow : undefined}>
                    <DataTable.Cell style={{ flex: 1.5 }}><Text style={{ fontSize: 11, fontFamily: 'monospace' }}>{row.gstin}</Text></DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1 }}><Text style={styles.cellText}>{row.invoiceNo}</Text></DataTable.Cell>
                    <DataTable.Cell style={{ flex: 0.8 }}><Text style={styles.cellText}>{row.date}</Text></DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}><Text style={styles.cellText}>{fmt(row.taxableValue)}</Text></DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 0.7 }}><Text style={[styles.cellText, { color: appTheme.colors.onSurface }]}>{fmt(row.cgst)}</Text></DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 0.7 }}><Text style={[styles.cellText, { color: appTheme.colors.onSurface }]}>{fmt(row.sgst)}</Text></DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}><Text style={[styles.cellText, { fontWeight: '600' }]}>{fmt(row.total)}</Text></DataTable.Cell>
                  </DataTable.Row>
                ))
              )}
              {b2bSupplies.length > 0 && (
                <DataTable.Row style={styles.totalRow}>
                  <DataTable.Cell style={{ flex: 1.5 }}><Text style={styles.totalText}>Total</Text></DataTable.Cell>
                  <DataTable.Cell style={{ flex: 1 }}><Text>—</Text></DataTable.Cell>
                  <DataTable.Cell style={{ flex: 0.8 }}><Text>—</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 1 }}><Text style={styles.totalText}>{fmt(b2bTotals.taxable)}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 0.7 }}><Text style={styles.totalText}>{fmt(b2bTotals.cgst)}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 0.7 }}><Text style={styles.totalText}>{fmt(b2bTotals.sgst)}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 1 }}><Text style={styles.totalText}>{fmt(b2bTotals.total)}</Text></DataTable.Cell>
                </DataTable.Row>
              )}
            </DataTable>
          </ScrollView>
        </Card.Content>
      </Card>

      {/* B2C Small Supplies */}
      <Card style={[styles.card, { marginBottom: 20 }]} elevation={1}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.sectionBadge, { backgroundColor: appTheme.colors.surface }]}>
                <Text style={{ color: appTheme.colors.onSurface, fontWeight: 'bold', fontSize: 12 }}>7</Text>
              </View>
              <Text variant="titleMedium" style={styles.sectionTitle}>B2C (Small) Supplies</Text>
            </View>
            <Text style={styles.sectionSub}>Rate-wise summary of supplies to unregistered persons</Text>
          </View>
          <ScrollView horizontal={!isDesktop} showsHorizontalScrollIndicator={false}>
            <DataTable style={{ minWidth: 600 }}>
              <DataTable.Header style={styles.dataHeader}>
                <DataTable.Title style={{ flex: 0.6 }}><Text style={styles.colHead}>Rate (%)</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHead}>Taxable Value</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 0.8 }}><Text style={styles.colHead}>CGST</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 0.8 }}><Text style={styles.colHead}>SGST</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHead}>Total</Text></DataTable.Title>
              </DataTable.Header>
              {b2cSmallSupplies.length === 0 ? (
                <DataTable.Row>
                  <DataTable.Cell><Text>No B2C Supplies found.</Text></DataTable.Cell>
                </DataTable.Row>
              ) : (
                b2cSmallSupplies.map((row: any, i: number) => (
                  <DataTable.Row key={i} style={i % 2 === 0 ? styles.evenRow : undefined}>
                    <DataTable.Cell style={{ flex: 0.6 }}>
                      <View style={[styles.rateBadge, { backgroundColor: row.rate === 5 ? '#E8F5E9' : row.rate === 12 ? '#E3F2FD' : row.rate === 18 ? '#FFF3E0' : '#FFEBEE' }]}>
                        <Text style={{ fontWeight: '700', fontSize: 12, color: row.rate === 5 ? '#2E7D32' : row.rate === 12 ? '#1565C0' : row.rate === 18 ? '#E65100' : '#C62828' }}>{row.rate}%</Text>
                      </View>
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}><Text style={styles.cellText}>{fmt(row.taxableValue)}</Text></DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 0.8 }}><Text style={styles.cellText}>{fmt(row.cgst)}</Text></DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 0.8 }}><Text style={styles.cellText}>{fmt(row.sgst)}</Text></DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}><Text style={[styles.cellText, { fontWeight: '600' }]}>{fmt(row.total)}</Text></DataTable.Cell>
                  </DataTable.Row>
                ))
              )}
            </DataTable>
          </ScrollView>
        </Card.Content>
      </Card>

      {/* HSN Summary */}
      <Card style={[styles.card, { marginBottom: 20 }]} elevation={1}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.sectionBadge, { backgroundColor: appTheme.colors.surface }]}>
                <Text style={{ color: appTheme.colors.onSurface, fontWeight: 'bold', fontSize: 12 }}>12</Text>
              </View>
              <Text variant="titleMedium" style={styles.sectionTitle}>HSN Summary</Text>
            </View>
            <Text style={styles.sectionSub}>HSN-wise summary of outward supplies</Text>
          </View>
          <ScrollView horizontal={!isDesktop} showsHorizontalScrollIndicator={false}>
            <DataTable style={{ minWidth: 800 }}>
              <DataTable.Header style={styles.dataHeader}>
                <DataTable.Title style={{ flex: 0.6 }}><Text style={styles.colHead}>HSN Code</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 1.5 }}><Text style={styles.colHead}>Description</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 0.5 }}><Text style={styles.colHead}>Qty</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHead}>Taxable Value</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 0.7 }}><Text style={styles.colHead}>IGST</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 0.7 }}><Text style={styles.colHead}>CGST</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 0.7 }}><Text style={styles.colHead}>SGST</Text></DataTable.Title>
              </DataTable.Header>
              {hsnSummary.length === 0 ? (
                <DataTable.Row>
                  <DataTable.Cell><Text>No HSN Data found.</Text></DataTable.Cell>
                </DataTable.Row>
              ) : (
                hsnSummary.map((row: any, i: number) => (
                  <DataTable.Row key={i} style={i % 2 === 0 ? styles.evenRow : undefined}>
                    <DataTable.Cell style={{ flex: 0.6 }}><Text style={[styles.cellText, { fontFamily: 'monospace', fontWeight: '600' }]}>{row.hsn}</Text></DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1.5 }}><Text style={styles.cellText} numberOfLines={1}>{row.description}</Text></DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 0.5 }}><Text style={styles.cellText}>{row.qty}</Text></DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}><Text style={styles.cellText}>{fmt(row.taxableValue)}</Text></DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 0.7 }}><Text style={[styles.cellText, { color: appTheme.colors.onSurface }]}>{fmt(row.igst)}</Text></DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 0.7 }}><Text style={[styles.cellText, { color: appTheme.colors.onSurface }]}>{fmt(row.cgst)}</Text></DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 0.7 }}><Text style={[styles.cellText, { color: appTheme.colors.onSurface }]}>{fmt(row.sgst)}</Text></DataTable.Cell>
                  </DataTable.Row>
                ))
              )}
              {hsnSummary.length > 0 && (
                <DataTable.Row style={styles.totalRow}>
                  <DataTable.Cell style={{ flex: 0.6 }}><Text style={styles.totalText}>Total</Text></DataTable.Cell>
                  <DataTable.Cell style={{ flex: 1.5 }}><Text>—</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 0.5 }}><Text style={styles.totalText}>{hsnSummary.reduce((s, r) => s + r.totalQty, 0)}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 1 }}><Text style={styles.totalText}>{fmt(hsnSummary.reduce((s, r) => s + r.taxableValue, 0))}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 0.7 }}><Text style={styles.totalText}>{fmt(0)}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 0.7 }}><Text style={styles.totalText}>{fmt(hsnSummary.reduce((s, r) => s + r.cgst, 0))}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 0.7 }}><Text style={styles.totalText}>{fmt(hsnSummary.reduce((s, r) => s + r.sgst, 0))}</Text></DataTable.Cell>
                </DataTable.Row>
              )}
            </DataTable>
          </ScrollView>
        </Card.Content>
      </Card>
    </View>
  );

  const renderGSTR3B = () => (
    <View>
      {/* Period selector */}
      <Card style={[styles.card, { marginBottom: 20 }]} elevation={1}>
        <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Icon name="calendar-range" size={20} color="#5E35B1" />
          <Text style={{ fontWeight: '600', color: appTheme.colors.onSurface }}>Return Period:</Text>
          <TextInput
            value={returnPeriod}
            onChangeText={setReturnPeriod}
            mode="outlined"
            dense
            style={{ width: 180, backgroundColor: 'white' }}
          />
          <Button mode="contained-tonal" icon="download" onPress={handleDownloadGSTR3B}>
            Download JSON
          </Button>
          <Button mode="outlined" icon="printer" onPress={handlePrintGSTR3B}>
            Print Preview
          </Button>
        </Card.Content>
      </Card>

      {/* Table 3.1 - Outward Supplies */}
      <Card style={[styles.card, { marginBottom: 20 }]} elevation={1}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.sectionBadge, { backgroundColor: appTheme.colors.surface }]}>
                <Text style={{ color: appTheme.colors.onSurface, fontWeight: 'bold', fontSize: 11 }}>3.1</Text>
              </View>
              <Text variant="titleMedium" style={styles.sectionTitle}>Outward Supplies & Inward Supplies (Reverse Charge)</Text>
            </View>
            <Text style={styles.sectionSub}>Details of inter-state and intra-state supplies</Text>
          </View>
          <ScrollView horizontal={!isDesktop} showsHorizontalScrollIndicator={false}>
            <DataTable style={{ minWidth: 700 }}>
              <DataTable.Header style={styles.dataHeader}>
                <DataTable.Title style={{ flex: 2.5 }}><Text style={styles.colHead}>Nature of Supplies</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHead}>Taxable Value</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 0.7 }}><Text style={styles.colHead}>IGST</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 0.7 }}><Text style={styles.colHead}>CGST</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 0.7 }}><Text style={styles.colHead}>SGST</Text></DataTable.Title>
              </DataTable.Header>
              {outwardSupplies.map((row, i) => (
                <DataTable.Row key={i} style={i % 2 === 0 ? styles.evenRow : undefined}>
                  <DataTable.Cell style={{ flex: 2.5 }}><Text style={styles.cellText} numberOfLines={2}>{row.nature}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 1 }}><Text style={[styles.cellText, { fontWeight: '600' }]}>{fmt(row.taxable)}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 0.7 }}><Text style={[styles.cellText, { color: row.igst > 0 ? '#333' : '#CCC' }]}>{fmt(row.igst)}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 0.7 }}><Text style={[styles.cellText, { color: row.cgst > 0 ? '#E65100' : '#CCC' }]}>{fmt(row.cgst)}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 0.7 }}><Text style={[styles.cellText, { color: row.sgst > 0 ? '#1565C0' : '#CCC' }]}>{fmt(row.sgst)}</Text></DataTable.Cell>
                </DataTable.Row>
              ))}
              <DataTable.Row style={styles.totalRow}>
                <DataTable.Cell style={{ flex: 2.5 }}><Text style={styles.totalText}>Total Outward Supplies</Text></DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}><Text style={styles.totalText}>{fmt(outwardSupplies[0].taxable)}</Text></DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 0.7 }}><Text style={styles.totalText}>{fmt(outwardSupplies[0].igst)}</Text></DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 0.7 }}><Text style={styles.totalText}>{fmt(outwardSupplies[0].cgst)}</Text></DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 0.7 }}><Text style={styles.totalText}>{fmt(outwardSupplies[0].sgst)}</Text></DataTable.Cell>
              </DataTable.Row>
            </DataTable>
          </ScrollView>
        </Card.Content>
      </Card>

      {/* Table 4 - Eligible ITC */}
      <Card style={[styles.card, { marginBottom: 20 }]} elevation={1}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.sectionBadge, { backgroundColor: appTheme.colors.surface }]}>
                <Text style={{ color: appTheme.colors.onSurface, fontWeight: 'bold', fontSize: 12 }}>4</Text>
              </View>
              <Text variant="titleMedium" style={styles.sectionTitle}>Eligible ITC</Text>
            </View>
            <Text style={styles.sectionSub}>Details of eligible input tax credit</Text>
          </View>
          <ScrollView horizontal={!isDesktop} showsHorizontalScrollIndicator={false}>
            <DataTable style={{ minWidth: 600 }}>
              <DataTable.Header style={styles.dataHeader}>
                <DataTable.Title style={{ flex: 2 }}><Text style={styles.colHead}>Details</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 0.8 }}><Text style={styles.colHead}>IGST</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 0.8 }}><Text style={styles.colHead}>CGST</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 0.8 }}><Text style={styles.colHead}>SGST</Text></DataTable.Title>
              </DataTable.Header>
              {eligibleITC.map((row, i) => (
                <DataTable.Row key={i} style={i % 2 === 0 ? styles.evenRow : undefined}>
                  <DataTable.Cell style={{ flex: 2 }}><Text style={styles.cellText}>{row.nature}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 0.8 }}><Text style={[styles.cellText, { color: row.igst > 0 ? '#2E7D32' : '#CCC' }]}>{fmt(row.igst)}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 0.8 }}><Text style={[styles.cellText, { color: row.cgst > 0 ? '#2E7D32' : '#CCC' }]}>{fmt(row.cgst)}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 0.8 }}><Text style={[styles.cellText, { color: row.sgst > 0 ? '#2E7D32' : '#CCC' }]}>{fmt(row.sgst)}</Text></DataTable.Cell>
                </DataTable.Row>
              ))}
              <DataTable.Row style={[styles.totalRow, { backgroundColor: appTheme.colors.surface }]}>
                <DataTable.Cell style={{ flex: 2 }}><Text style={[styles.totalText, { color: appTheme.colors.onSurface }]}>Total ITC Available</Text></DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 0.8 }}><Text style={[styles.totalText, { color: appTheme.colors.onSurface }]}>{fmt(0)}</Text></DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 0.8 }}><Text style={[styles.totalText, { color: appTheme.colors.onSurface }]}>{fmt(0)}</Text></DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 0.8 }}><Text style={[styles.totalText, { color: appTheme.colors.onSurface }]}>{fmt(0)}</Text></DataTable.Cell>
              </DataTable.Row>
            </DataTable>
          </ScrollView>
        </Card.Content>
      </Card>

      {/* Table 6 - Payment of Tax */}
      <Card style={[styles.card, { marginBottom: 20 }]} elevation={1}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.sectionBadge, { backgroundColor: appTheme.colors.surface }]}>
                <Text style={{ color: appTheme.colors.onSurface, fontWeight: 'bold', fontSize: 12 }}>6</Text>
              </View>
              <Text variant="titleMedium" style={styles.sectionTitle}>Payment of Tax</Text>
            </View>
            <Text style={styles.sectionSub}>Tax payable and paid details</Text>
          </View>
          <ScrollView horizontal={!isDesktop} showsHorizontalScrollIndicator={false}>
            <DataTable style={{ minWidth: 700 }}>
              <DataTable.Header style={styles.dataHeader}>
                <DataTable.Title style={{ flex: 1 }}><Text style={styles.colHead}>Description</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHead}>Tax Payable</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHead}>Paid via ITC</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHead}>Paid via Cash</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHead}>Total Paid</Text></DataTable.Title>
              </DataTable.Header>
              {paymentOfTax.map((row: any, i: number) => (
                <DataTable.Row key={i} style={i % 2 === 0 ? styles.evenRow : undefined}>
                  <DataTable.Cell style={{ flex: 1 }}><Text style={[styles.cellText, { fontWeight: 'bold' }]}>{row.description}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 1 }}><Text style={styles.cellText}>{fmt(row.taxPayable)}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 1 }}><Text style={[styles.cellText, { color: appTheme.colors.onSurface }]}>{fmt(row.paidITC)}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 1 }}><Text style={[styles.cellText, { color: appTheme.colors.onSurface }]}>{fmt(row.paidCash)}</Text></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 1 }}><Text style={[styles.cellText, { fontWeight: '600' }]}>{fmt(row.total)}</Text></DataTable.Cell>
                </DataTable.Row>
              ))}
              <DataTable.Row style={[styles.totalRow, { backgroundColor: appTheme.colors.surface }]}>
                <DataTable.Cell style={{ flex: 1 }}><Text style={styles.totalText}>Grand Total</Text></DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}><Text style={styles.totalText}>{fmt(cgstTot + sgstTot)}</Text></DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}><Text style={styles.totalText}>{fmt(0)}</Text></DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}><Text style={styles.totalText}>{fmt(cgstTot + sgstTot)}</Text></DataTable.Cell>
                <DataTable.Cell numeric style={{ flex: 1 }}><Text style={styles.totalText}>{fmt(cgstTot + sgstTot)}</Text></DataTable.Cell>
              </DataTable.Row>
            </DataTable>
          </ScrollView>
        </Card.Content>
      </Card>

      {/* Payment Summary */}
      <Card style={[styles.card, { marginBottom: 20, backgroundColor: appTheme.colors.surface }]} elevation={1}>
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Icon name="information-outline" size={18} color="#5E35B1" />
            <Text style={{ fontWeight: '600', color: appTheme.colors.onSurface }}>Payment Summary for {returnPeriod}</Text>
          </View>
          <View style={[styles.paymentGrid, { flexDirection: isDesktop ? 'row' : 'column' }]}>
            {[
              { label: 'Total Tax Liability', amount: fmt(cgstTot + sgstTot), color: appTheme.colors.onSurface, icon: 'calculator' },
              { label: 'Utilized through ITC', amount: fmt(0), color: appTheme.colors.onSurface, icon: 'shield-check' },
              { label: 'Cash to be Paid', amount: fmt(cgstTot + sgstTot), color: appTheme.colors.onSurface, icon: 'cash' },
            ].map((item, i) => (
              <Surface key={i} style={styles.paymentCard} elevation={1}>
                <Icon name={item.icon} size={24} color={item.color} />
                <Text style={{ color: appTheme.colors.onSurface, fontSize: 12, marginTop: 8 }}>{item.label}</Text>
                <Text style={{ fontWeight: 'bold', fontSize: 18, color: item.color, marginTop: 4 }}>{item.amount}</Text>
              </Surface>
            ))}
          </View>
        </Card.Content>
      </Card>
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading GST Management...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load GST Management</Text>
          <Text style={{ marginTop: 8, color: 'gray', textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 24 }}>{error}</Text>
          <Button mode="contained" onPress={fetchSales} style={{ borderRadius: 10, width: '100%', backgroundColor: appTheme.colors.primary }}>
            Retry Sync
          </Button>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>GST Management & Returns</Text>
        <Text style={styles.headerSub}>GSTIN: {gstNumber}</Text>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabRow}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Icon name={tab.icon} size={18} color={activeTab === tab.key ? '#FFF' : '#5E35B1'} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'gstr1' && renderGSTR1()}
      {activeTab === 'gstr3b' && renderGSTR3B()}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { paddingTop: 24, paddingBottom: 8 },
  headerTitle: { fontWeight: 'bold', },
  headerSub: { fontSize: 13, marginTop: 4, fontFamily: 'monospace' },

  // Tabs
  tabRow: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 24, flexWrap: 'wrap' },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  tabBtnActive: { },
  tabText: { fontSize: 14, fontWeight: '600', },
  tabTextActive: { },

  // Layout
  contentRow: { gap: 24, flexWrap: 'wrap' },
  leftCol: { flex: 1, minWidth: 300 },
  rightCol: { flex: 1.5, minWidth: 400 },

  // Cards
  card: { backgroundColor: 'white', borderRadius: 12 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 0 },
  helperText: { color: 'gray', fontSize: 13, marginBottom: 20, marginTop: 4 },
  input: { marginBottom: 16, backgroundColor: 'white' },
  saveBtn: { borderRadius: 8, marginTop: 8, paddingVertical: 6 },

  // Stats
  statsGrid: { gap: 16, flexWrap: 'wrap' },
  statCard: {
    flex: 1,
    minWidth: 140,
    padding: 18,
    borderRadius: 12,
    backgroundColor: 'white',
    alignItems: 'center',
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },

  // Filing Status
  filingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },

  // Section Headers
  sectionHeader: { marginBottom: 14 },
  sectionBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionSub: { fontSize: 12, marginTop: 4, marginLeft: 36 },

  // Tables
  dataHeader: { },
  colHead: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  cellText: { fontSize: 13 },
  evenRow: { },
  totalRow: { },
  totalText: { fontSize: 13, fontWeight: 'bold', },

  // Rate badge
  rateBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },

  // Payment grid
  paymentGrid: { gap: 16 },
  paymentCard: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    backgroundColor: 'white',
    alignItems: 'center',
  },
});
