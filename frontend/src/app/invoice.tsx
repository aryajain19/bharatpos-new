import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { Text, Surface, Divider, Button } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams } from 'expo-router';

export default function PublicInvoiceScreen() {
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isDesktop = width > 700;

  const invoiceData = useMemo(() => {
    if (params.data && typeof params.data === 'string') {
      try {
        return JSON.parse(decodeURIComponent(params.data));
      } catch (e) {
        try {
          return JSON.parse(params.data);
        } catch (_) {}
      }
    }
    return {
      storeName: (params.storeName as string) || 'BharatPOS Merchant Store',
      storeAddress: (params.storeAddress as string) || '',
      gstNum: (params.gstNum as string) || '',
      isGst: params.isGst === 'true' || Boolean(params.isGst),
      billNo: (params.id as string) || (params.billNo as string) || 'INV-' + Date.now().toString().slice(-6),
      date: (params.date as string) || new Date().toLocaleDateString('en-IN'),
      time: (params.time as string) || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      payMethod: (params.payMethod as string) || 'Cash / Digital',
      custName: (params.custName as string) || 'Valued Customer',
      custPhone: (params.custPhone as string) || '',
      custGstin: (params.custGstin as string) || '',
      items: params.items ? (typeof params.items === 'string' ? JSON.parse(params.items) : params.items) : [
        { name: 'Standard Item', qty: 1, price: Number(params.total) || 0 }
      ],
      subtotal: Number(params.subtotal) || Number(params.total) || 0,
      discount: Number(params.discount) || 0,
      finalTotal: Number(params.total) || Number(params.finalTotal) || 0,
    };
  }, [params]);

  const handlePrint = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleWhatsAppShare = () => {
    const text = 'Here is your official tax invoice #' + invoiceData.billNo + ' from ' + invoiceData.storeName + ' for ₹' + Number(invoiceData.finalTotal).toFixed(2) + '.\n\nView & Download Invoice: ' + (typeof window !== 'undefined' ? window.location.href : '');
    const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  return (
    <View style={styles.pageContainer}>
      {/* Top Floating Action Bar (Hidden during Print) */}
      <View style={styles.topBar}>
        <View style={styles.brandBadge}>
          <Icon name="check-decagram" size={20} color="#10B981" />
          <Text style={styles.brandBadgeText}>BharatPOS Verified Invoice</Text>
        </View>
        <View style={styles.topActions}>
          <Button
            mode="contained"
            icon="printer"
            onPress={handlePrint}
            style={styles.printBtn}
            buttonColor="#10B981"
          >
            Download PDF / Print
          </Button>
          <Button
            mode="outlined"
            icon="whatsapp"
            onPress={handleWhatsAppShare}
            style={styles.shareBtn}
            textColor="#2E7D32"
          >
            Share
          </Button>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Printable Tax Invoice Container */}
        <Surface style={[styles.invoiceCard, isDesktop && styles.invoiceCardDesktop]} elevation={2}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.storeTitle}>{invoiceData.storeName}</Text>
            {invoiceData.storeAddress ? (
              <Text style={styles.storeSubtitle}>{invoiceData.storeAddress}</Text>
            ) : null}
            {invoiceData.isGst && invoiceData.gstNum ? (
              <Text style={styles.gstinText}>GSTIN: {invoiceData.gstNum}</Text>
            ) : null}
            <View style={styles.taxInvoicePill}>
              <Text style={styles.taxInvoiceText}>TAX INVOICE / DIGITAL RECEIPT</Text>
            </View>
          </View>

          <Divider style={styles.dividerDashed} />

          {/* Invoice & Customer Meta */}
          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Invoice No:</Text>
              <Text style={styles.metaValueBold}>{invoiceData.billNo}</Text>
              <Text style={styles.metaLabel}>Date & Time:</Text>
              <Text style={styles.metaValue}>{invoiceData.date} {invoiceData.time}</Text>
              <Text style={styles.metaLabel}>Payment Mode:</Text>
              <Text style={styles.metaValue}>{invoiceData.payMethod}</Text>
            </View>
            <View style={[styles.metaCol, { alignItems: 'flex-end' }]}>
              <Text style={styles.metaLabel}>Billed To:</Text>
              <Text style={styles.metaValueBold}>{invoiceData.custName || 'Walk-in Customer'}</Text>
              {invoiceData.custPhone ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.metaLabel}>Mobile No:</Text>
                  <Text style={styles.metaValue}>+91 {invoiceData.custPhone}</Text>
                </View>
              ) : null}
              {invoiceData.custGstin ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.metaLabel}>Customer GSTIN:</Text>
                  <Text style={styles.metaValue}>{invoiceData.custGstin}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <Divider style={styles.dividerSolid} />

          {/* Items Table */}
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, { flex: 2, textAlign: 'left' }]}>Item Description</Text>
            <Text style={[styles.thText, { flex: 0.6, textAlign: 'center' }]}>Qty</Text>
            <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>Rate (₹)</Text>
            <Text style={[styles.thText, { flex: 1.2, textAlign: 'right' }]}>Amount (₹)</Text>
          </View>
          <Divider style={styles.dividerThin} />

          {invoiceData.items && invoiceData.items.map((item: any, idx: number) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.tdText, { flex: 2, textAlign: 'left', fontWeight: '600' }]}>{item.name}</Text>
              <Text style={[styles.tdText, { flex: 0.6, textAlign: 'center' }]}>{item.qty}</Text>
              <Text style={[styles.tdText, { flex: 1, textAlign: 'right' }]}>₹{Number(item.price).toFixed(2)}</Text>
              <Text style={[styles.tdText, { flex: 1.2, textAlign: 'right', fontWeight: '700' }]}>
                ₹{(Number(item.price) * Number(item.qty)).toFixed(2)}
              </Text>
            </View>
          ))}

          <Divider style={styles.dividerSolid} />

          {/* Totals Section */}
          <View style={styles.totalsContainer}>
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalVal}>₹{Number(invoiceData.subtotal).toFixed(2)}</Text>
            </View>

            {Number(invoiceData.discount) > 0 ? (
              <View style={styles.totalLine}>
                <Text style={[styles.totalLabel, { color: '#10B981' }]}>Discount Savings:</Text>
                <Text style={[styles.totalVal, { color: '#10B981' }]}>-₹{Number(invoiceData.discount).toFixed(2)}</Text>
              </View>
            ) : null}

            {invoiceData.isGst ? (
              <View>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>CGST (2.5%):</Text>
                  <Text style={styles.totalVal}>₹{(Number(invoiceData.finalTotal) * 0.025).toFixed(2)}</Text>
                </View>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>SGST (2.5%):</Text>
                  <Text style={styles.totalVal}>₹{(Number(invoiceData.finalTotal) * 0.025).toFixed(2)}</Text>
                </View>
              </View>
            ) : null}

            <Divider style={styles.dividerDashed} />

            <View style={styles.grandTotalLine}>
              <Text style={styles.grandTotalLabel}>GRAND TOTAL:</Text>
              <Text style={styles.grandTotalVal}>₹{Number(invoiceData.finalTotal).toFixed(2)}</Text>
            </View>
          </View>

          {/* Footer Note */}
          <View style={styles.footer}>
            <Text style={styles.thankYouText}>Thank you for shopping with us!</Text>
            <Text style={styles.footerBrand}>Generated via BharatPOS Cloud Billing Network</Text>
          </View>
        </Surface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  topBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 12,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
  },
  printBtn: {
    borderRadius: 8,
  },
  shareBtn: {
    borderRadius: 8,
    borderColor: '#2E7D32',
  },
  scrollContent: {
    padding: 16,
    alignItems: 'center',
  },
  invoiceCard: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginVertical: 12,
  },
  invoiceCardDesktop: {
    padding: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  storeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  storeSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  gstinText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginTop: 4,
  },
  taxInvoicePill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 10,
  },
  taxInvoiceText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
  },
  dividerDashed: {
    marginVertical: 12,
    backgroundColor: '#E2E8F0',
  },
  dividerSolid: {
    marginVertical: 12,
    backgroundColor: '#E2E8F0',
  },
  dividerThin: {
    marginVertical: 6,
    backgroundColor: '#F1F5F9',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  metaValue: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  metaValueBold: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  thText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  tdText: {
    fontSize: 12,
    color: '#1E293B',
  },
  totalsContainer: {
    marginVertical: 8,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  totalLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  totalVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  grandTotalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  grandTotalVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10B981',
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  thankYouText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  footerBrand: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
  },
});
