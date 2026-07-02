import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { Text, useTheme, IconButton, RadioButton, TextInput } from 'react-native-paper';
import { useCart } from '../../providers/CartProvider';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { collection, addDoc, doc, updateDoc, increment } from '../../lib/firestore_adapter';
import { useAuth } from '../../providers/AuthProvider';
import { useAppTheme } from '../../providers/ThemeProvider';
import { router } from 'expo-router';

export default function PaymentScreen() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const { cart, getSubtotal, getGST, clearCart } = useCart();
  const { user, tenantId } = useAuth();
  
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const [isGstRegistered, setIsGstRegistered] = useState(true);
  const [custPhone, setCustPhone] = useState('');
  const [custName, setCustName] = useState('');
  const [custGstin, setCustGstin] = useState('');

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const val = window.localStorage.getItem('isGstRegistered');
      setIsGstRegistered(val !== 'false');
    }
  }, []);

  const subtotal = getSubtotal();
  const discount = subtotal * 0.05;
  const gstAmount = isGstRegistered ? getGST() : 0;
  const total = subtotal - discount + gstAmount;
  const change = receivedAmount ? Math.max(0, parseFloat(receivedAmount) - total) : 0;

  const handlePayment = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    const billNo = 'BILL-' + Date.now().toString().slice(-6);
    const itemsJson = JSON.stringify(cart.map(item => ({
      name: item.name,
      price: item.price,
      qty: item.qty,
      gst_pct: item.gst_pct !== undefined ? item.gst_pct : 5
    })));

    if (isFirebaseConfigured && user) {
      try {
        const dateObj = new Date();
        const dateStr = dateObj.toISOString().split('T')[0];
        const timeStr = dateObj.toTimeString().split(' ')[0].substring(0, 5);

        const saleRef = await addDoc(collection(db, 'sales'), {
          tenant_id: tenantId || 'anonymous',
          vendor_id: user.uid,
          bill_no: billNo,
          customer_name: custName || 'Walk-in Customer',
          customer_phone: custPhone || '',
          customer_gstin: custGstin || '',
          total_amount: total,
          payment_method: paymentMethod,
          created_at: dateObj.toISOString(),
          gst_collected: gstAmount,
          subtotal: subtotal,
          discount: discount,
          items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            qty: item.qty,
            gst_pct: item.gst_pct || 0,
            hsn: (item as any).hsn || ''
          }))
        });

        const saleItems = cart.map(item => ({
          sale_id: saleRef.id,
          product_id: item.id,
          qty: item.qty,
          price: item.price,
          total_amount: item.qty * item.price,
        }));
        
        for (const item of saleItems) {
          await addDoc(collection(db, 'sale_items'), item);
        }

        await addDoc(collection(db, 'transactions'), {
          tenant_id: tenantId || 'anonymous',
          dateTime: `${dateStr} ${timeStr}`,
          created_at: dateObj.toISOString(),
          voucherType: 'Sales',
          voucherNo: billNo,
          partyName: custName || 'Walk-in Customer',
          debit: total,
          credit: 0,
          paymentMethod: paymentMethod,
          gstAmount: gstAmount,
          taxableValue: subtotal - discount,
        });
      } catch (error) {
        console.error("Error inserting sale to Firebase:", error);
        Alert.alert("Error", "Failed to save sale. Please try again.");
        setLoading(false);
        return;
      }
    }

    await Promise.all(cart.map(async (item) => {
      // Deduct in Firestore
      if (isFirebaseConfigured) {
        try {
          const productRef = doc(db, 'products', item.id);
          await updateDoc(productRef, {
            stock_qty: increment(-item.qty)
          });
        } catch (error) {
          console.error("Failed to update Firestore stock for item", item.id, error);
        }
      }

      // Deduct in localStorage (web-only backup/mock catalog support)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const currentStockStr = window.localStorage.getItem(`stock_${item.id}`);
        const currentStock = currentStockStr ? parseInt(currentStockStr) : 0;
        window.localStorage.setItem(`stock_${item.id}`, String(Math.max(0, currentStock - item.qty)));
      }
    }));

    // Webhook Trigger
    const savedWebhookUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.localStorage.getItem('webhookUrl') : '';
    if (savedWebhookUrl) {
      fetch(savedWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'sale_completed',
          tenant_id: tenantId,
          bill_no: billNo,
          total_amount: total,
          payment_method: paymentMethod,
          timestamp: new Date().toISOString(),
          items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            qty: item.qty
          }))
        })
      }).catch(err => console.warn("Webhook delivery failed:", err));
    }

    // Low Stock Alert
    const checkLowStockSetting = Platform.OS === 'web' && typeof window !== 'undefined' ? window.localStorage.getItem('lowStockEmailNotif') !== 'false' : true;
    if (checkLowStockSetting) {
      const lowStockItems = cart.filter(item => {
        const currentStockStr = window.localStorage.getItem(`stock_${item.id}`);
        const currentStock = currentStockStr ? parseInt(currentStockStr) : 0;
        const remainingStock = currentStock - item.qty;
        return remainingStock < 5;
      });
      if (lowStockItems.length > 0) {
        const itemNames = lowStockItems.map(item => `${item.name}`).join(', ');
        setTimeout(() => {
          Alert.alert('Low Stock Automation Alert', `Stock is running low for: ${itemNames}. Reorder suggested.`);
        }, 800);
      }
    }

    const totalAmountString = total.toFixed(2);
    setLoading(false);
    clearCart();
    router.replace({
      pathname: '/(vendor)/bill_preview',
      params: { 
        total: totalAmountString,
        custPhone: custPhone,
        custName: custName,
        custGstin: custGstin,
        billNo: billNo,
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        itemsJson: JSON.stringify(cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          qty: item.qty,
          gst_pct: item.gst_pct,
          hsn: (item as any).hsn || ''
        })))
      }
    } as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" size={24} onPress={() => router.back()} style={{ marginLeft: -10 }} />
        <Text style={styles.headerTitle}>Payment</Text>
        <IconButton icon="file-document-outline" size={24} onPress={() => {}} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>

          <Text style={styles.sectionTitle}>Payment Method</Text>
          <RadioButton.Group onValueChange={value => setPaymentMethod(value)} value={paymentMethod}>
            <View style={styles.radioRow}>
              <RadioButton value="Cash" color="#2196F3" />
              <Text style={styles.radioText}>Cash</Text>
            </View>
            <View style={styles.radioRow}>
              <RadioButton value="UPI" color="#2196F3" />
              <Text style={styles.radioText}>UPI</Text>
            </View>
            <View style={styles.radioRow}>
              <RadioButton value="Card" color="#2196F3" />
              <Text style={styles.radioText}>Card</Text>
            </View>
            <View style={styles.radioRow}>
              <RadioButton value="Credit" color="#2196F3" />
              <Text style={styles.radioText}>Credit</Text>
            </View>
          </RadioButton.Group>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Received Amount</Text>
          <TextInput
            mode="outlined"
            value={receivedAmount}
            onChangeText={setReceivedAmount}
            keyboardType="numeric"
            style={styles.input}
            placeholder={`₹${total.toFixed(2)}`}
            outlineStyle={{ borderRadius: 8, borderColor: appTheme.colors.outline }}
          />

          <View style={styles.changeRow}>
            <Text style={styles.changeLabel}>Change</Text>
            <Text style={styles.changeValue}>₹{change.toFixed(2)}</Text>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Customer Details (Optional)</Text>
          <TextInput
            label="Customer Mobile Number"
            mode="outlined"
            value={custPhone}
            onChangeText={setCustPhone}
            keyboardType="phone-pad"
            style={styles.input}
            placeholder="Enter 10-digit number"
            outlineStyle={{ borderRadius: 8, borderColor: appTheme.colors.outline }}
          />
          <TextInput
            label="Customer Name"
            mode="outlined"
            value={custName}
            onChangeText={setCustName}
            style={styles.input}
            placeholder="Enter customer name"
            outlineStyle={{ borderRadius: 8, borderColor: appTheme.colors.outline }}
          />
          <TextInput
            label="Customer GSTIN (Optional)"
            mode="outlined"
            value={custGstin}
            onChangeText={setCustGstin}
            style={styles.input}
            placeholder="Enter customer GSTIN"
            outlineStyle={{ borderRadius: 8, borderColor: appTheme.colors.outline }}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.payButton} onPress={handlePayment} disabled={loading}>
          <Text style={styles.payButtonText}>{loading ? 'Processing...' : 'Complete Payment'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 10, backgroundColor: 'white' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: { padding: 24 },
  totalLabel: { color: 'gray', fontSize: 13, marginBottom: 4 },
  totalValue: { fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  radioRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  radioText: { fontSize: 14, marginLeft: 8 },
  input: { height: 45, marginBottom: 20 },
  changeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  changeLabel: { color: 'gray', fontSize: 14 },
  changeValue: { fontWeight: 'bold', fontSize: 16, },
  footer: { padding: 20 },
  payButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  payButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
