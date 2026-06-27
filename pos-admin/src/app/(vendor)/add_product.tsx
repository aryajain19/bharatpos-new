import React, { useState } from 'react';

import { useAuth } from '../../providers/AuthProvider';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, useTheme, TextInput } from 'react-native-paper';
import { db, isFirebaseConfigured, auth } from '../../lib/firebase';
import { collection, addDoc } from '../../lib/firestore_adapter';
import { useAppTheme } from '../../providers/ThemeProvider';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function AddProductVendorScreen() {
  const { tenantId, loading: authLoading } = useAuth();

  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [barcode, setBarcode] = useState('');
  const [mrp, setMrp] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [gstPct, setGstPct] = useState('5');
  const [stockQty, setStockQty] = useState('');
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

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
      await addDoc(collection(db, 'products'), {
        name,
        category,
        barcode,
        mrp: parseFloat(mrp) || parseFloat(sellingPrice),
        selling_price: parseFloat(sellingPrice),
        stock_qty: parseInt(stockQty) || 0,
        gst_pct: parseFloat(gstPct) || 0,
        tenant_id: tenantId || 'anonymous',
        created_at: new Date().toISOString()
      });
      setLoading(false);
      Alert.alert('Success', 'Product added successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      setLoading(false);
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.imageUpload}>
          <Icon name="camera" size={40} color="gray" />
          <Text style={{ color: 'gray', marginTop: 8 }}>Upload Image</Text>
        </View>

        <Text style={styles.label}>Product Name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} mode="outlined" placeholder="Enter product name" />

        <Text style={styles.label}>Category</Text>
        <TextInput value={category} onChangeText={setCategory} style={styles.input} mode="outlined" placeholder="Select category" />

        <Text style={styles.label}>Barcode</Text>
        <TextInput 
          value={barcode} 
          onChangeText={setBarcode} 
          style={styles.input} 
          mode="outlined" 
          placeholder="Generate / Scan"
          right={<TextInput.Icon icon="barcode-scan" onPress={generateBarcode} />}
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>MRP</Text>
            <TextInput value={mrp} onChangeText={setMrp} keyboardType="numeric" style={styles.input} mode="outlined" placeholder="Enter MRP" />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Selling Price</Text>
            <TextInput value={sellingPrice} onChangeText={setSellingPrice} keyboardType="numeric" style={styles.input} mode="outlined" placeholder="Enter selling price" />
          </View>
        </View>

        <Text style={styles.label}>GST (%)</Text>
        <TextInput value={gstPct} onChangeText={setGstPct} keyboardType="numeric" style={styles.input} mode="outlined" placeholder="Select GST" />

        <Text style={styles.label}>Stock Quantity</Text>
        <TextInput value={stockQty} onChangeText={setStockQty} keyboardType="numeric" style={styles.input} mode="outlined" placeholder="Enter stock" />
      </ScrollView>

      <View style={styles.bottomSection}>
        <Button mode="contained" onPress={handleSave} loading={loading} disabled={loading} style={styles.saveBtn} contentStyle={{ paddingVertical: 8 }}>
          SAVE PRODUCT
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, },
  scroll: { padding: 20, paddingBottom: 100 },
  imageUpload: {
    alignSelf: 'center',
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    },
  label: { fontSize: 12, color: 'gray', marginBottom: 4 },
  input: { backgroundColor: 'white', marginBottom: 16, height: 45 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  half: { width: '48%' },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
    },
  saveBtn: { borderRadius: 8 },
});
