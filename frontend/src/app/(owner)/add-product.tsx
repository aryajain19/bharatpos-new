import React, { useState } from 'react';
import { DS } from '../../constants/designTokens';

import { useAuth } from '../../providers/AuthProvider';
import { StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, useTheme, Button, Surface, TextInput } from 'react-native-paper';
import { db, isFirebaseConfigured, auth } from '../../lib/firebase';
import { collection, addDoc } from '../../lib/firestore_adapter';
import { useAppTheme } from '../../providers/ThemeProvider';
import { router } from 'expo-router';

export default function AddProductScreen() {
  const { tenantId, loading: authLoading } = useAuth();

  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [barcode, setBarcode] = useState('');
  const [mrp, setMrp] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [gstPct, setGstPct] = useState('0');
  const [loading, setLoading] = useState(false);

  // Generate unique EAN-13 barcode with merchant prefix to prevent cross-merchant collisions
  const generateBarcode = () => {
    if (!tenantId) return;
    let hash = 0;
    for (let i = 0; i < tenantId.length; i++) {
      hash = (hash + tenantId.charCodeAt(i)) % 10000;
    }
    const storePrefix = hash.toString().padStart(4, '0');
    const randomDigits = Math.floor(10000 + Math.random() * 90000).toString(); // 5 digits
    const prefix = '890'; // India prefix
    const base = prefix + storePrefix + randomDigits; // 12 digits
    
    // Calculate EAN-13 check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(base.charAt(i)) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    
    setBarcode(base + checkDigit);
  };

  const handleSave = async () => {
    if (!name || !barcode || !sellingPrice) {
      Alert.alert('Validation Error', 'Name, Barcode, and Selling Price are required.');
      return;
    }
    if (!isFirebaseConfigured) return;

    setLoading(true);
    try {
      if (!tenantId) return;
      await addDoc(collection(db, 'products'), {
        tenant_id: tenantId,
        name,
        category,
        barcode,
        mrp: parseFloat(mrp) || parseFloat(sellingPrice),
        selling_price: parseFloat(sellingPrice),
        stock_qty: parseInt(stockQty) || 0,
        gst_pct: parseFloat(gstPct) || 0,
        created_at: new Date().toISOString()
      });
      setLoading(false);
      Alert.alert('Success', 'Product added successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      setLoading(false);
      Alert.alert('Error adding product', error.message);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Surface style={styles.surface} elevation={2}>
          <TextInput label="Product Name *" value={name} onChangeText={setName} style={styles.input} mode="outlined" />
          <TextInput label="Category" value={category} onChangeText={setCategory} style={styles.input} mode="outlined" />
          
          <TextInput 
            label="Barcode *" 
            value={barcode} 
            onChangeText={setBarcode} 
            style={styles.input} 
            mode="outlined" 
            right={<TextInput.Icon icon="barcode" onPress={generateBarcode} />}
          />
          
          <TextInput label="MRP" value={mrp} onChangeText={setMrp} keyboardType="numeric" style={styles.input} mode="outlined" />
          <TextInput label="Selling Price *" value={sellingPrice} onChangeText={setSellingPrice} keyboardType="numeric" style={styles.input} mode="outlined" />
          <TextInput label="Initial Stock Qty" value={stockQty} onChangeText={setStockQty} keyboardType="numeric" style={styles.input} mode="outlined" />
          <TextInput label="GST %" value={gstPct} onChangeText={setGstPct} keyboardType="numeric" style={styles.input} mode="outlined" />

          <Button mode="contained" onPress={handleSave} loading={loading} disabled={loading} style={styles.button}>
            Save Product
          </Button>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    },
  scroll: {
    padding: 16,
  },
  surface: {
    padding: 20,
    borderRadius: DS.radius.sm,
    backgroundColor: DS.colors.cardBg,
  },
  input: {
    marginBottom: 12,
  },
  button: {
    marginTop: 16,
    paddingVertical: 6,
  },
});
