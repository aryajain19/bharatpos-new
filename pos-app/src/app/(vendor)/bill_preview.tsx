import React from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Platform, Linking } from 'react-native';
import { Text, useTheme, IconButton, TextInput } from 'react-native-paper';
import * as Print from 'expo-print';
import { useAppTheme } from '../../providers/ThemeProvider';
import { router, useLocalSearchParams } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function BillPreviewScreen() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const params = useLocalSearchParams();
  const totalAmount = typeof params.total === 'string' ? params.total : '0.00';
  const phone = typeof params.custPhone === 'string' ? params.custPhone : '';
  const name = typeof params.custName === 'string' ? params.custName : '';
  const custGstin = typeof params.custGstin === 'string' ? params.custGstin : '';
  const billNo = typeof params.billNo === 'string' ? params.billNo : ('BILL-' + Date.now().toString().slice(-6));
  const subtotal = typeof params.subtotal === 'string' ? parseFloat(params.subtotal) : 0;
  const discount = typeof params.discount === 'string' ? parseFloat(params.discount) : 0;
  const gstAmount = typeof params.gstAmount === 'string' ? parseFloat(params.gstAmount) : 0;
  const payMethod = typeof params.payMethod === 'string' ? params.payMethod : 'UPI';

  const [storeName, setStoreName] = React.useState('BharatPOS');
  const [address, setAddress] = React.useState('');
  const [gstNum, setGstNum] = React.useState('');
  const [isGstRegistered, setIsGstRegistered] = React.useState(true);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setStoreName(window.localStorage.getItem('storeName') || 'BharatPOS');
      setAddress(window.localStorage.getItem('storeAddress') || '');
      setGstNum(window.localStorage.getItem('gstNumber') || '');
      setIsGstRegistered(window.localStorage.getItem('isGstRegistered') !== 'false');
    }
  }, []);

  const parsedItems = React.useMemo(() => {
    try {
      if (typeof params.itemsJson === 'string') {
        return JSON.parse(params.itemsJson);
      }
    } catch (e) {
      console.warn("Failed to parse items json:", e);
    }
    return [];
  }, [params.itemsJson]);

  const handlePrint = async () => {
    try {
      const itemsRows = parsedItems.map((item: any) => `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${item.name}</td>
          <td style="text-align: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${item.qty}</td>
          <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">₹${parseFloat(item.price).toFixed(2)}</td>
          <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">₹${(parseFloat(item.price) * item.qty).toFixed(2)}</td>
        </tr>
      `).join('');

      const gstRows = isGstRegistered ? `
        <div class="total-row"><span>CGST (2.5%):</span> <span>₹${(gstAmount / 2).toFixed(2)}</span></div>
        <div class="total-row"><span>SGST (2.5%):</span> <span>₹${(gstAmount / 2).toFixed(2)}</span></div>
      ` : '';

      const htmlString = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invoice ${billNo}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #334155; background-color: #f8fafc; margin: 0; }
              .receipt-box { max-width: 450px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
              .header { text-align: center; margin-bottom: 24px; }
              .store-name { font-size: 24px; font-weight: 800; margin: 0; color: #0f172a; letter-spacing: -0.5px; }
              .store-subtitle { font-size: 13px; color: #64748b; margin: 4px 0 0 0; }
              .gstin { font-size: 11px; color: #94a3b8; font-weight: 600; margin-top: 6px; }
              .invoice-details { margin: 20px 0; border-top: 1px dashed #e2e8f0; border-bottom: 1px dashed #e2e8f0; padding: 12px 0; font-size: 13px; color: #475569; }
              .details-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
              .items-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
              .items-table th { border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; }
              .totals-section { margin-top: 24px; border-top: 2px solid #f1f5f9; padding-top: 12px; font-size: 13px; color: #475569; }
              .total-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
              .grand-total { font-size: 18px; font-weight: 800; color: #0f172a; border-top: 1px dashed #e2e8f0; padding-top: 10px; margin-top: 10px; }
              .footer { text-align: center; margin-top: 32px; font-size: 11px; color: #94a3b8; font-weight: 500; }
              @media print {
                body { padding: 0; background-color: #ffffff; }
                .receipt-box { border: none; box-shadow: none; padding: 0; max-width: 100%; }
              }
            </style>
          </head>
          <body>
            <div class="receipt-box">
              <div class="header">
                <h1 class="store-name">${storeName}</h1>
                <p class="store-subtitle">${address || ''}</p>
                ${isGstRegistered && gstNum ? `<div class="gstin">GSTIN: ${gstNum}</div>` : ''}
              </div>
              <div class="invoice-details">
                <div class="details-row"><span>Invoice No:</span> <strong>${billNo}</strong></div>
                <div class="details-row"><span>Date:</span> <span>${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span></div>
                <div class="details-row"><span>Customer Name:</span> <span>${name || 'Walk-in Customer'}</span></div>
                ${phone ? `<div class="details-row"><span>Mobile No:</span> <span>+91 ${phone}</span></div>` : ''}
                ${custGstin ? `<div class="details-row"><span>Customer GSTIN:</span> <span>${custGstin}</span></div>` : ''}
                <div class="details-row"><span>Payment Mode:</span> <span>${payMethod}</span></div>
              </div>
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="text-align: left; width: 45%;">Item Description</th>
                    <th style="text-align: center; width: 10%;">Qty</th>
                    <th style="text-align: right; width: 20%;">Rate</th>
                    <th style="text-align: right; width: 25%;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRows}
                </tbody>
              </table>
              <div class="totals-section">
                <div class="total-row"><span>Subtotal:</span> <span>₹${subtotal.toFixed(2)}</span></div>
                <div class="total-row"><span>Discount (5%):</span> <span>-₹${discount.toFixed(2)}</span></div>
                ${gstRows}
                <div class="total-row grand-total"><span>GRAND TOTAL:</span> <span>₹${parseFloat(totalAmount).toFixed(2)}</span></div>
              </div>
              <div class="footer">
                <p>Thank you for shopping with us!</p>
                <p style="font-size: 9px; color: #cbd5e1; margin-top: 8px;">Powered by BharatPOS POS billing software</p>
              </div>
            </div>
          </body>
        </html>
      `;
      await Print.printAsync({ html: htmlString });
    } catch (e) {
      console.error(e);
      Alert.alert('Printing Failed', 'Failed to generate receipt PDF.');
    }
  };

  const handleShare = () => {
    const itemsText = parsedItems.map((item: any) => `• ${item.name} x${item.qty} - ₹${(parseFloat(item.price) * item.qty).toFixed(0)}`).join('\n');
    const message = `Thank you for shopping at *${storeName}*!\n\n*Invoice No:* ${billNo}\n*Date:* ${new Date().toLocaleDateString('en-IN')}\n*Payment Mode:* ${payMethod}\n\n*Items:*\n${itemsText}\n\n*Subtotal:* ₹${subtotal.toFixed(2)}\n*Discount:* ₹${discount.toFixed(2)}\n${isGstRegistered ? `*GST:* ₹${gstAmount.toFixed(2)}\n` : ''}*Grand Total:* *₹${parseFloat(totalAmount).toFixed(2)}*\n\nWe look forward to serving you again!`;
    const smsMessage = `Thank you for shopping at ${storeName}. Invoice: ${billNo}, Amount: ₹${parseFloat(totalAmount).toFixed(0)}.`;

    Alert.alert(
      'Share Receipt',
      `Deliver receipt to customer via options below.`,
      [
        { 
          text: 'WhatsApp', 
          onPress: () => {
            let url = '';
            if (phone) {
              const cleanPhone = phone.replace(/[^0-9]/g, '');
              url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
            } else {
              url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
            }
            Linking.openURL(url).catch(() => {
              Alert.alert('Error', 'WhatsApp could not be opened.');
            });
          }
        },
        { 
          text: 'SMS Bill', 
          onPress: () => {
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            const url = Platform.OS === 'ios' ? `sms:${cleanPhone}&body=${encodeURIComponent(smsMessage)}` : `sms:${cleanPhone}?body=${encodeURIComponent(smsMessage)}`;
            Linking.openURL(url).catch(() => {
              Alert.alert('Error', 'SMS composer could not be opened.');
            });
          }
        },
        { 
          text: 'PDF Print / Save', 
          onPress: handlePrint
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  return (

    <View style={styles.container}>
      {/* Dark Purple Header */}
      <View style={styles.header}>
        <IconButton icon="menu" iconColor="white" size={24} onPress={() => {}} style={{ marginLeft: -10 }} />
        <Text style={styles.headerTitle}>Payment</Text>
        <IconButton icon="tune" iconColor="white" size={24} onPress={() => {}} style={{ marginRight: -10 }} />
      </View>

      <View style={styles.content}>
        {/* White Receipt Card */}
        <View style={styles.receiptCard}>
          <Text style={styles.totalLabel}>Total Paid</Text>
          <Text style={styles.totalValue}>₹{totalAmount}</Text>

          <View style={styles.methodRow}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.methodText}>UPI</Text>
          </View>

          {phone ? (
            <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: appTheme.colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 6 }}>
              <Icon name="message-text-outline" size={14} color="#1565C0" />
              <Text style={{ fontSize: 11, color: appTheme.colors.onSurface, fontWeight: 'bold' }}>SMS sent to +91 {phone}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionBtn, styles.leftBtn]} onPress={handleShare}>
          <Icon name="share-variant" size={20} color="white" style={styles.btnIcon} />
          <Text style={styles.btnText}>Share</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.actionBtn, styles.rightBtn]} onPress={handlePrint}>
          <Icon name="printer" size={20} color="white" style={styles.btnIcon} />
          <Text style={styles.btnText}>Print</Text>
        </TouchableOpacity>
      </View>
      
      {/* Return to Dashboard */}
      <TouchableOpacity onPress={() => router.replace('/(vendor)/(tabs)')} style={styles.homeLink}>
         <Text style={styles.homeLinkText}>Return to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 20, },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  content: { padding: 24, alignItems: 'center', marginTop: 40 },
  receiptCard: {
    backgroundColor: 'white',
    width: '100%',
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  totalLabel: { color: 'gray', fontSize: 14, marginBottom: 8 },
  totalValue: { fontSize: 32, fontWeight: 'bold', marginBottom: 40 },
  methodRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  methodText: { fontSize: 16, marginLeft: 10, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 20 },
  actionBtn: { flex: 1, flexDirection: 'row', paddingVertical: 16, justifyContent: 'center', alignItems: 'center' },
  leftBtn: { borderTopLeftRadius: 12, borderBottomLeftRadius: 12, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.2)' },
  rightBtn: { borderTopRightRadius: 12, borderBottomRightRadius: 12 },
  btnIcon: { marginRight: 8 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  homeLink: { alignItems: 'center', marginBottom: 40 },
  homeLinkText: { fontWeight: 'bold' },
});
