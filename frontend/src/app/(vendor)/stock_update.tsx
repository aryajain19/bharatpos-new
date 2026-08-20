import React, { useState } from 'react';
import { DS } from '../../constants/designTokens';
import { View, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { Text, Button, useTheme, Surface, TextInput } from 'react-native-paper';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from '../../lib/firestore_adapter';
import { useAppTheme } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { router } from 'expo-router';

export default function StockUpdateScreen() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const [barcode, setBarcode] = useState('');
  const [product, setProduct] = useState<any>(null);
  const [updateType, setUpdateType] = useState('Add Stock');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { tenantId } = useAuth();
  const theme = useTheme();

  const handleSearch = async () => {
    if (!barcode) return;
    if (!isFirebaseConfigured) {
      Alert.alert('Error', 'Firebase is not configured.');
      return;
    }
    setLoading(true);
    try {
      const q = query(
        collection(db, 'products'), 
        where('barcode', '==', barcode),
        where('tenant_id', '==', tenantId || 'anonymous')
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setProduct({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        Alert.alert('Error', 'Product not found.');
      }
    } catch(err: any) {
      console.error(err);
      Alert.alert('Search Error', err.message || 'Failed to search product by barcode.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!product || !quantity) return;
    if (!isFirebaseConfigured) {
      Alert.alert('Error', 'Firebase is not configured.');
      return;
    }
    setLoading(true);
    try {
      const productRef = doc(db, 'products', product.id);
      await updateDoc(productRef, {
        stock_qty: product.stock_qty + parseInt(quantity)
      });
      Alert.alert('Success', 'Stock updated successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Update Error', err.message || 'Failed to update product stock.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        
        {!product ? (
          <View>
            <Text style={styles.label}>Scan Barcode to update stock</Text>
            <TextInput 
              value={barcode} 
              onChangeText={setBarcode} 
              style={styles.input} 
              mode="outlined" 
              placeholder="Enter or scan barcode"
              right={<TextInput.Icon icon="magnify" onPress={handleSearch} />}
            />

          </View>
        ) : (
          <View>
            <Surface style={styles.productCard} elevation={1}>
              {product.image_url ? (
                <Image source={{ uri: product.image_url }} style={styles.productImage} />
              ) : (
                <View style={[styles.productImage, { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ fontSize: 18 }}>📦</Text>
                </View>
              )}
              <View>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productStock}>Current Stock: {product.stock_qty} PCS</Text>
              </View>
            </Surface>

            <Text style={styles.label}>Update Type</Text>
            <TextInput value={updateType} onChangeText={setUpdateType} style={styles.input} mode="outlined" />

            <Text style={styles.label}>Quantity</Text>
            <TextInput value={quantity} onChangeText={setQuantity} keyboardType="numeric" style={styles.input} mode="outlined" placeholder="Enter quantity" />

            <Text style={styles.label}>Reason (Optional)</Text>
            <TextInput value={reason} onChangeText={setReason} style={styles.input} mode="outlined" placeholder="Enter reason" />
          </View>
        )}

      </ScrollView>

      {product && (
        <View style={styles.bottomSection}>
          <Button mode="contained" onPress={handleUpdate} loading={loading} disabled={loading} style={styles.saveBtn} contentStyle={{ paddingVertical: 8 }}>
            UPDATE STOCK
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, },
  scroll: { padding: 20, paddingBottom: 100 },
  label: { fontSize: 13, color: 'gray', marginBottom: 4, marginTop: 12 },
  input: { backgroundColor: DS.colors.cardBg, marginBottom: 8, height: 45 },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: DS.colors.cardBg,
    borderRadius: DS.radius.sm,
    marginBottom: 20,
  },
  productImage: { width: 40, height: 40, marginRight: 16, borderRadius: 4 },
  productName: { fontWeight: 'bold', fontSize: 14, },
  productStock: { fontSize: 12, color: 'gray', marginTop: 4 },
  bottomSection: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 16,
    borderTopWidth: 1,
    },
  saveBtn: { borderRadius: DS.radius.sm },
});
