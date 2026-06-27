import { useAppTheme } from '../../providers/ThemeProvider';

import { useAuth } from '../../providers/AuthProvider';
import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Text, Card, Avatar, useTheme, ProgressBar, TextInput, Button } from 'react-native-paper';
import { db, isFirebaseConfigured, auth } from '../../lib/firebase';
import { collection, getDocs, query, orderBy, where } from '../../lib/firestore_adapter';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function VendorPerformanceScreen() {
  const { tenantId, loading: authLoading } = useAuth();

  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const theme = useTheme();

  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSales = async () => {
    if (!isFirebaseConfigured) {
      setSalesData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!tenantId) return;
      const q = query(collection(db, 'sales'), where('tenant_id', '==', tenantId));
      const snapshot = await getDocs(q);
      setSalesData(snapshot.docs.map(doc => doc.data()));
    } catch (err: any) {
      console.error('Error fetching sales for vendors:', err);
      setError(err.message || "Failed to load sales data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && tenantId) {
      fetchSales();
    }
  }, [authLoading, tenantId]);

  const vendors = useMemo(() => {
    const stats: Record<string, { id: string, name: string, sales: number, color: string, initials: string }> = {};
    const colors = ['#10B981', '#2196F3', '#4CAF50', '#FF9800', '#F44336', '#9C27B0'];
    let colorIdx = 0;
    let maxSales = 1000; // default safe max
    
    salesData.forEach(sale => {
      const vendorName = sale.served_by || 'Unknown';
      if (!stats[vendorName]) {
        const parts = vendorName.split(' ');
        const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : vendorName.substring(0, 2).toUpperCase();
        stats[vendorName] = { 
          id: vendorName, 
          name: vendorName, 
          sales: 0, 
          color: colors[colorIdx % colors.length], 
          initials 
        };
        colorIdx++;
      }
      stats[vendorName].sales += (parseFloat(sale.total_amount) || 0);
    });

    const list = Object.values(stats).sort((a, b) => b.sales - a.sales);
    if (list.length > 0 && list[0].sales > maxSales) {
      maxSales = list[0].sales;
    }
    
    return list.map((v: any) => ({ ...v, max: maxSales }));
  }, [salesData]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Vendor Performance...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Performance</Text>
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
        <Text variant="headlineSmall" style={styles.title}>Vendor Performance</Text>
      </View>

      <Card style={styles.card} elevation={1}>
        <Card.Content>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 20 }}>Top Vendors (This Month)</Text>
          
          {vendors.length === 0 ? (
            <Text style={{ color: 'gray' }}>No sales data available to calculate performance.</Text>
          ) : (
            vendors.map((vendor) => (
              <View key={vendor.id} style={styles.vendorRow}>
                <Avatar.Text size={40} label={vendor.initials} style={{ backgroundColor: vendor.color }} />
                
                <View style={styles.infoCol}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{vendor.name}</Text>
                    <Text style={styles.sales}>₹{vendor.sales.toFixed(2)}</Text>
                  </View>
                  
                  <ProgressBar 
                    progress={vendor.max > 0 ? vendor.sales / vendor.max : 0} 
                    color={vendor.color} 
                    style={styles.progressBar} 
                  />
                </View>
              </View>
            ))
          )}
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
  vendorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  infoCol: { flex: 1, marginLeft: 16 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  name: { fontWeight: 'bold', },
  sales: { fontWeight: 'bold', color: 'gray' },
  progressBar: { height: 8, borderRadius: 4, },
});
