import { useAppTheme } from '../../providers/ThemeProvider';

import { useAuth } from '../../providers/AuthProvider';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { Text, Card, DataTable, useTheme, TextInput, Button } from 'react-native-paper';
import { db, isFirebaseConfigured, auth } from '../../lib/firebase';
import { collection, getDocs, query, orderBy, where } from '../../lib/firestore_adapter';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from 'expo-router';



export default function InventoryManagementScreen() {
  const { tenantId, loading: authLoading } = useAuth();

  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const theme = useTheme();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation();

  useEffect(() => {
    if (!authLoading && tenantId) {
      fetchProducts();
    }
    const unsubscribe = navigation.addListener('focus', () => {
      if (!authLoading && tenantId) {
        fetchProducts();
      }
    });
    return unsubscribe;
  }, [navigation, authLoading, tenantId]);

  const fetchProducts = async () => {
    let baseProducts: any[] = [];
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!tenantId) return;
      const q = query(
        collection(db, 'products'),
        where('tenant_id', '==', tenantId),
        orderBy('stock_qty', 'asc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (data.length > 0) {
        baseProducts = data.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.selling_price || p.price,
          barcode: p.barcode || '',
          category: p.category || '',
          gst_pct: p.gst_pct || 0,
          hsn: p.hsn || '',
          stock_qty: p.stock_qty !== undefined ? p.stock_qty : (p.stock || 0),
        }));
      }
    } catch (err: any) {
      console.error("Error fetching inventory:", err);
      setError(err.message || "Failed to load inventory products.");
    } finally {
      setLoading(false);
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      baseProducts.forEach((p: any) => {
        window.localStorage.setItem(`stock_${p.id}`, String(p.stock_qty));
      });
    }
    baseProducts.sort((a, b) => a.stock_qty - b.stock_qty);
    setProducts(baseProducts);
  };

  const totalProducts = products.length;
  const inStock = products.filter(p => p.stock_qty > 5).length;
  const lowStock = products.filter(p => p.stock_qty > 0 && p.stock_qty <= 5).length;
  const outOfStock = products.filter(p => p.stock_qty <= 0).length;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Inventory...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Inventory</Text>
          <Text style={{ marginTop: 8, color: 'gray', textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 24 }}>{error}</Text>
          <Button mode="contained" onPress={fetchProducts} style={{ borderRadius: 10, width: '100%', backgroundColor: appTheme.colors.primary }}>
            Retry Sync
          </Button>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>Inventory Management</Text>
      </View>

      <View style={styles.metricsRow}>
        <MetricCard title="Total Products" value={totalProducts} icon="package-variant-closed" color="#10B981" bgColor="#ECFDF5" />
        <MetricCard title="In Stock" value={inStock} icon="check-circle-outline" color="#10B981" bgColor="#ECFDF5" />
        <MetricCard title="Low Stock" value={lowStock} icon="alert-outline" color="#F59E0B" bgColor="#FFFBEB" />
        <MetricCard title="Out of Stock" value={outOfStock} icon="close-circle-outline" color="#EF4444" bgColor="#FEF2F2" />
      </View>

      <Card style={styles.card} elevation={0}>
        <Card.Content>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title style={{ flex: 3 }}><Text style={styles.colHeader}>Product</Text></DataTable.Title>
              <DataTable.Title numeric><Text style={styles.colHeader}>Stock</Text></DataTable.Title>
              <DataTable.Title numeric><Text style={styles.colHeader}>Min. Stock</Text></DataTable.Title>
              <DataTable.Title style={{ flex: 1.5, justifyContent: 'center' }}><Text style={styles.colHeader}>Status</Text></DataTable.Title>
            </DataTable.Header>

            {products.map((item) => {
              const statusColor = item.stock_qty <= 0 ? '#EF4444' : (item.stock_qty <= 5 ? '#F59E0B' : '#10B981');
              const statusText = item.stock_qty <= 0 ? 'Out of Stock' : (item.stock_qty <= 5 ? 'Low Stock' : 'In Stock');

              return (
                <DataTable.Row key={item.id}>
                  <DataTable.Cell style={{ flex: 3 }}><Text style={{ fontWeight: 'bold', color: appTheme.colors.onSurface }}>{item.name}</Text></DataTable.Cell>
                  <DataTable.Cell numeric>{item.stock_qty}</DataTable.Cell>
                  <DataTable.Cell numeric>{item.min_stock || 0}</DataTable.Cell>
                  <DataTable.Cell style={{ flex: 1.5, justifyContent: 'center' }}>
                    <Text style={{ color: statusColor, fontWeight: '700' }}>{statusText}</Text>
                  </DataTable.Cell>
                </DataTable.Row>
              );
            })}

            {products.length === 0 && (
              <DataTable.Row>
                <DataTable.Cell><Text style={{ fontStyle: 'italic', color: '#94A3B8' }}>No Data Available</Text></DataTable.Cell>
              </DataTable.Row>
            )}
          </DataTable>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const MetricCard = ({ title, value, icon, color, bgColor }: any) => (
  <Card style={styles.metricCard} elevation={0}>
    <Card.Content style={styles.metricCardContent}>
      <View style={styles.metricCardTop}>
        <View style={[styles.iconWrapper, { backgroundColor: bgColor }]}>
          <Icon name={icon} size={20} color={color} />
        </View>
        <Icon name="dots-horizontal" size={20} color="#94A3B8" />
      </View>
      <View>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel}>{title}</Text>
      </View>
    </Card.Content>
  </Card>
);

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { paddingVertical: 24 },
  title: { fontWeight: '800', },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  metricCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    },
  metricCardContent: { padding: 16, minHeight: 120, justifyContent: 'space-between' },
  metricCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  metricLabel: { fontSize: 13, marginTop: 4, fontWeight: '600' },
  card: { backgroundColor: 'white', borderRadius: 16, borderWidth: 1, marginBottom: 40 },
  colHeader: { fontWeight: 'bold', },
});
