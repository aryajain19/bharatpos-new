import { useAppTheme } from '../../providers/ThemeProvider';

import { useAuth } from '../../providers/AuthProvider';
import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Text, Card, DataTable, useTheme, TextInput, Button } from 'react-native-paper';
import { db, isFirebaseConfigured, auth } from '../../lib/firebase';
import { collection, getDocs, query, orderBy, where } from '../../lib/firestore_adapter';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { cleanAndMapCategory } from '../../lib/ui_helpers';

export default function TopSellingProductsScreen() {
  const { tenantId, loading: authLoading } = useAuth();

  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const theme = useTheme();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSales = async () => {
    if (!isFirebaseConfigured) {
      setSales([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!tenantId) return;
      const q = query(collection(db, 'sales'), where('tenant_id', '==', tenantId));
      const snapshot = await getDocs(q);
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err: any) {
      console.error('Error fetching sales for top selling:', err);
      setError(err.message || "Failed to load sales data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const topProducts = useMemo(() => {
    const productStats: Record<string, { id: string, name: string, category: string, sold: number, revenue: number }> = {};
    sales.forEach(sale => {
      const items = sale.items || [];
      items.forEach((item: any) => {
        if (!productStats[item.id]) {
          productStats[item.id] = { id: item.id, name: item.name, category: item.category || 'General', sold: 0, revenue: 0 };
        }
        productStats[item.id].sold += item.qty;
        productStats[item.id].revenue += (item.qty * item.price);
      });
    });
    return Object.values(productStats).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [sales]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Top Selling Products...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Top Selling Products</Text>
          <Text style={{ marginTop: 8, color: 'gray', textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 24 }}>{error}</Text>
          <Button mode="contained" onPress={fetchSales} style={{ borderRadius: 10, width: '100%', backgroundColor: appTheme.colors.primary }}>
            Retry Sync
          </Button>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>Top Selling Products</Text>
      </View>

      <Card style={styles.card} elevation={1}>
        <Card.Content>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 600 }}>
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title style={{ flex: 3 }}><Text style={styles.colHeader}>Product Name</Text></DataTable.Title>
                  <DataTable.Title style={{ flex: 2 }}><Text style={styles.colHeader}>Category</Text></DataTable.Title>
                  <DataTable.Title numeric><Text style={styles.colHeader}>Qty Sold</Text></DataTable.Title>
                  <DataTable.Title numeric><Text style={styles.colHeader}>Revenue</Text></DataTable.Title>
                </DataTable.Header>

                {topProducts.length === 0 ? (
                  <DataTable.Row>
                    <DataTable.Cell><Text>No sales data available yet.</Text></DataTable.Cell>
                  </DataTable.Row>
                ) : (
                  topProducts.map((item) => (
                    <DataTable.Row key={item.id}>
                      <DataTable.Cell style={{ flex: 3 }}>
                        <Text style={{ fontWeight: 'bold', color: appTheme.colors.onSurface }}>{item.name}</Text>
                      </DataTable.Cell>
                      <DataTable.Cell style={{ flex: 2 }}>
                        <Text style={{ color: 'gray' }}>{item.category}</Text>
                      </DataTable.Cell>
                      <DataTable.Cell numeric>{item.sold}</DataTable.Cell>
                      <DataTable.Cell numeric style={{ paddingRight: 0 }}>
                        <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>₹{item.revenue.toFixed(2)}</Text>
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))
                )}
              </DataTable>
            </View>
          </ScrollView>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { paddingVertical: 24 },
  title: { fontWeight: 'bold' },
  card: { backgroundColor: 'white', borderRadius: 12 },
  colHeader: { fontWeight: 'bold', color: 'gray' },
});
