import { useAppTheme } from '../../providers/ThemeProvider';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { Text, Card, DataTable, useTheme, Surface, Button } from 'react-native-paper';
import { db, isFirebaseConfigured, auth } from '../../lib/firebase';
import { collection, getDocs, query, where } from '../../lib/firestore_adapter';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, router } from 'expo-router';
import { cleanAndMapCategory } from '../../lib/ui_helpers';

export default function ReorderProductsScreen() {
  const { isDarkMode } = useAppTheme();
  const appTheme = useTheme();
  const navigation = useNavigation();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReorderItems();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchReorderItems();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchReorderItems = async () => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tenantId = auth.currentUser?.uid || 'anonymous';
      const q = query(
        collection(db, 'products'),
        where('tenant_id', '==', tenantId)
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name || 'Unnamed Product',
          barcode: d.barcode || '',
          category: d.category || 'N/A',
          mrp: d.mrp || d.price || 0,
          selling_price: d.selling_price || d.price || 0,
          stock_qty: d.stock_qty !== undefined ? Number(d.stock_qty) : (d.stock !== undefined ? Number(d.stock) : 15),
        };
      });

      // Filter only items with stock_qty < 5
      const reorderList = list.filter(p => p.stock_qty < 5);
      // Sort: out of stock first, then by stock quantity ascending
      reorderList.sort((a, b) => a.stock_qty - b.stock_qty);
      setProducts(reorderList);
    } catch (err: any) {
      console.error("Error fetching reorder products:", err);
      setError(err.message || "Failed to load reorder items.");
    } finally {
      setLoading(false);
    }
  };

  const addToPrintQueue = (prod: any) => {
    if (typeof window === 'undefined') return;
    try {
      const existingQueueStr = window.localStorage.getItem('barcode_print_queue');
      let queue: any[] = [];
      if (existingQueueStr) {
        queue = JSON.parse(existingQueueStr);
      }

      // Check if product is already in the queue
      const existingItemIdx = queue.findIndex(item => item.id === prod.id);
      if (existingItemIdx > -1) {
        queue[existingItemIdx].copies = (queue[existingItemIdx].copies || 0) + 24;
      } else {
        queue.push({
          id: prod.id,
          name: prod.name,
          barcode: prod.barcode || `AUTO-${prod.id.substring(0, 8).toUpperCase()}`,
          category: prod.category,
          price: String(prod.selling_price || prod.mrp || 0),
          copies: 24
        });
      }

      window.localStorage.setItem('barcode_print_queue', JSON.stringify(queue));
      alert(`"${prod.name}" x24 labels added to Barcode Print Queue!`);
    } catch (e) {
      console.error(e);
      alert("Failed to update print queue.");
    }
  };

  const totalProducts = products.length;
  const outOfStockCount = products.filter(p => p.stock_qty <= 0).length;
  const lowStockCount = products.filter(p => p.stock_qty > 0 && p.stock_qty < 5).length;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Reorder List...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Reorder List</Text>
          <Text style={{ marginTop: 8, color: 'gray', textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 24 }}>{error}</Text>
          <Button mode="contained" onPress={fetchReorderItems} style={{ borderRadius: 10, width: '100%', backgroundColor: appTheme.colors.primary }}>
            Retry Sync
          </Button>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>Reorder Products List</Text>
        <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
          Monitor depleted inventory, track low stock alert levels, and quickly queue labels for restocking.
        </Text>
      </View>

      <View style={styles.metricsRow}>
        <MetricCard title="Items to Reorder" value={totalProducts} icon="alert-decagram-outline" color="#EF4444" bgColor="#FEF2F2" />
        <MetricCard title="Out of Stock (Stock = 0)" value={outOfStockCount} icon="close-circle-outline" color="#EF4444" bgColor="#FEF2F2" />
        <MetricCard title="Low Stock (Stock < 5)" value={lowStockCount} icon="alert-outline" color="#F59E0B" bgColor="#FFFBEB" />
      </View>

      <Card style={styles.card} elevation={0}>
        <Card.Content>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#1E293B' }}>Restock Queue Recommendations</Text>
            {totalProducts > 0 && (
              <Button mode="contained" buttonColor="#2563EB" icon="barcode" onPress={() => router.push('/(owner)/barcode_generator' as any)} style={{ borderRadius: 8 }}>
                Go to Barcode Workspace
              </Button>
            )}
          </View>

          {loading ? (
            <Text style={styles.infoText}>Loading reorder candidates...</Text>
          ) : products.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="check-circle" size={48} color="#10B981" />
              <Text style={styles.emptyText}>All stock levels healthy!</Text>
              <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                No products are currently under the warning threshold of 5 units.
              </Text>
            </View>
          ) : (
            <DataTable>
              <DataTable.Header>
                <DataTable.Title style={{ flex: 2.5 }}><Text style={styles.colHeader}>Product</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 1.5 }}><Text style={styles.colHeader}>Category</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHeader}>Stock</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 1.5, justifyContent: 'center' }}><Text style={styles.colHeader}>Alert Status</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 1.5, justifyContent: 'flex-end' }}><Text style={styles.colHeader}>Action</Text></DataTable.Title>
              </DataTable.Header>

              {products.map((item) => {
                const isOutOfStock = item.stock_qty <= 0;
                const statusColor = isOutOfStock ? '#EF4444' : '#F59E0B';
                const statusBg = isOutOfStock ? '#FEF2F2' : '#FFFBEB';
                const statusText = isOutOfStock ? 'Out Of Stock' : 'Low Stock';

                return (
                  <DataTable.Row key={item.id}>
                    <DataTable.Cell style={{ flex: 2.5 }}>
                      <View>
                        <Text style={{ fontWeight: 'bold', fontSize: 13, color: appTheme.colors.onSurface }}>{item.name}</Text>
                        <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                          {item.barcode ? `SKU: ${item.barcode}` : 'No Barcode'}
                        </Text>
                      </View>
                    </DataTable.Cell>
                      <DataTable.Cell style={{ flex: 1.5, justifyContent: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Icon name={cleanAndMapCategory(item.category || '').icon} size={14} color="#64748B" style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 12, color: '#475569' }}>{cleanAndMapCategory(item.category || '').cleanName}</Text>
                        </View>
                      </DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}><Text style={{ fontWeight: 'bold' }}>{item.stock_qty}</Text></DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1.5, justifyContent: 'center' }}>
                      <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                        <Text style={{ color: statusColor, fontWeight: '700', fontSize: 11 }}>{statusText}</Text>
                      </View>
                    </DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1.5, justifyContent: 'flex-end' }}>
                      <Button 
                        mode="outlined" 
                        onPress={() => addToPrintQueue(item)} 
                        textColor="#2563EB"
                        style={{ borderColor: '#2563EB', borderRadius: 6 }}
                        contentStyle={{ height: 32 }}
                        labelStyle={{ fontSize: 11, marginHorizontal: 8, marginVertical: 0 }}
                      >
                        Queue Tag
                      </Button>
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}
            </DataTable>
          )}
        </Card.Content>
      </Card>
      
      <View style={{ height: 40 }} />
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
  title: { fontWeight: '800' },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  metricCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF0F6'
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
  metricLabel: { fontSize: 13, marginTop: 4, fontWeight: '600', color: '#64748B' },
  card: { backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#EEF0F6', marginBottom: 40 },
  colHeader: { fontWeight: 'bold', fontSize: 11, color: '#64748B' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  infoText: { textAlign: 'center', color: '#64748B', fontStyle: 'italic', paddingVertical: 24 },
  emptyState: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontWeight: '700', fontSize: 15, color: '#10B981', marginTop: 12 },
});
