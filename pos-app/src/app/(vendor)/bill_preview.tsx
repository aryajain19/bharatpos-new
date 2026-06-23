import React from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, useTheme, IconButton, TextInput } from 'react-native-paper';
import * as Print from 'expo-print';
import { useAppTheme } from '../../providers/ThemeProvider';
import { router, useLocalSearchParams } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function BillPreviewScreen() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const { total, custPhone, custName } = useLocalSearchParams();
  const totalAmount = typeof total === 'string' ? total : '2,516.85';
  const phone = typeof custPhone === 'string' ? custPhone : '';
  const name = typeof custName === 'string' ? custName : '';

  const invoiceId = Math.floor(10000 + Math.random() * 90000);
  const shareMsg = `Thank you for shopping at Sharma Fashion.\nInvoice Amount: ₹${parseFloat(totalAmount.replace(/,/g, '')).toFixed(0)}\nDownload Bill: secure-link.com/invoice/${invoiceId}`;

  const handlePrint = async () => {
    try {
      const htmlString = `
        <html>
          <body style="font-family: monospace; padding: 20px;">
            <h2 style="text-align: center;">Smart POS</h2>
            <hr />
            <p><strong>Total Paid:</strong> ₹${totalAmount}</p>
            <p><strong>Method:</strong> UPI</p>
            <hr />
            <p style="text-align: center;">Thank You!</p>
          </body>
        </html>
      `;
      await Print.printAsync({ html: htmlString });
    } catch (e) {
      Alert.alert('Error', 'Printing failed');
    }
  };

  const handleShare = () => {
    Alert.alert(
      'Share Receipt',
      `Select delivery method below.\n\nSimulated Message Preview:\n"${shareMsg}"`,
      [
        { 
          text: 'WhatsApp', 
          onPress: () => Alert.alert('WhatsApp Dispatch', `Invoice text message successfully sent to customer (+91 ${phone || 'N/A'}) via WhatsApp.`) 
        },
        { 
          text: 'SMS Bill', 
          onPress: () => Alert.alert('SMS Dispatch', `SMS bill link successfully dispatched to +91 ${phone || 'customer'}.`) 
        },
        { 
          text: 'PDF Download', 
          onPress: () => Alert.alert('PDF Generated', `PDF bill saved for ${name || 'Customer'}. Saved to local downloads folder.`) 
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
