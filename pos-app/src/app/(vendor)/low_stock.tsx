import { useAppTheme } from '../../providers/ThemeProvider';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, useTheme, Divider, TextInput, Card, Button } from 'react-native-paper';
import { isFirebaseConfigured } from '../../lib/firebase';
import { useAuth } from '../../providers/AuthProvider';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Real implementation fetches from DB where stock_qty < threshold

export default function LowStockScreen() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { tenantId } = useAuth();
  const theme = useTheme();

  useEffect(() => {
    fetchLowStock();
  }, []);

  const fetchLowStock = async () => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { collection, getDocs, query, where } = await import('../../lib/firestore_adapter');
      const { db } = await import('../../lib/firebase');
      const q = query(collection(db, 'products'), where('tenant_id', '==', tenantId || 'anonymous'));
      const snapshot = await getDocs(q);
      const lowStock = snapshot.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .filter((p: any) => (p.stock_qty || 0) < 5);
      setProducts(lowStock);
    } catch (err: any) {
      console.error('Error fetching low stock:', err);
      setError(err.message || "Failed to load low stock products.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Low Stock Products...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Low Stock</Text>
          <Text style={{ marginTop: 8, color: 'gray', textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 24 }}>{error}</Text>
          <Button mode="contained" onPress={fetchLowStock} style={{ borderRadius: 10, width: '100%', backgroundColor: appTheme.colors.primary }}>
            Retry Sync
          </Button>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.productRow}>
            <Image source={{ uri: item.image_url }} style={styles.productImage} />
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{item.name}</Text>
              <View style={styles.stockRow}>
                <Icon name="alert-circle" size={14} color="#FF9800" style={{ marginRight: 4 }} />
                <Text style={styles.productStock}>Stock: {item.stock_qty} PCS</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={24} color="gray" />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <Divider />}
        contentContainerStyle={{ paddingVertical: 8 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, },
  productRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14, 
    paddingHorizontal: 16 
  },
  productImage: { width: 40, height: 40, borderRadius: 8, marginRight: 16 },
  productInfo: { flex: 1 },
  productName: { fontWeight: 'bold', fontSize: 14, },
  stockRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  productStock: { fontSize: 12, fontWeight: 'bold' },
});
