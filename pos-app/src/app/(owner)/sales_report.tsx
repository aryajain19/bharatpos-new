import { useAppTheme } from '../../providers/ThemeProvider';

import { useAuth } from '../../providers/AuthProvider';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Text, Card, useTheme, Button } from 'react-native-paper';
import { BarChart } from 'react-native-chart-kit';
import { db, isFirebaseConfigured, auth } from '../../lib/firebase';
import { collection, getDocs, query, where } from '../../lib/firestore_adapter';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';


export default function SalesReportScreen() {
  const { tenantId, loading: authLoading } = useAuth();

  const { width } = useWindowDimensions();
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const [totalSales, setTotalSales] = useState(0);
  const [chartData, setChartData] = useState<number[]>([]);
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!tenantId) return;
      const q = query(collection(db, 'sales'), where('tenant_id', '==', tenantId));
      const snapshot = await getDocs(q);

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const dayMillis = 86400000;

      // Prepare last 7 days labels and initial amounts
      const labels: string[] = [];
      const dataPoints: number[] = [0, 0, 0, 0, 0, 0, 0];
      const dateBuckets: Record<string, number> = {};

      for (let i = 6; i >= 0; i--) {
        const d = new Date(todayStart - i * dayMillis);
        const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        labels.push(label);
        dateBuckets[label] = 0;
      }

      let total = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const amt = parseFloat(data.total_amount || 0);
        const date = new Date(data.created_at || new Date()).getTime();

        // Check if sale is in last 7 days
        const saleDateStr = new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        if (dateBuckets[saleDateStr] !== undefined) {
          dateBuckets[saleDateStr] += amt;
          total += amt;
        }
      });

      const dataValues = labels.map(lbl => dateBuckets[lbl]);

      setTotalSales(total);
      setChartLabels(labels);
      setChartData(dataValues);
    } catch (e: any) {
      console.error("Error fetching sales report data:", e);
      setError(e.message || "Failed to load sales report data.");
    } finally {
      setLoading(false);
    }
  };

  const hasSales = chartData.some(val => val > 0);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Sales Report...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Sales Report</Text>
          <Text style={{ marginTop: 8, color: 'gray', textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 24 }}>{error}</Text>
          <Button mode="contained" onPress={fetchSalesData} style={{ borderRadius: 10, width: '100%', backgroundColor: appTheme.colors.primary }}>
            Retry Sync
          </Button>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>Sales Report</Text>
      </View>

      <Card style={styles.chartCard} elevation={1}>
        <Card.Content>
          <View style={styles.chartHeader}>
            <View>
              <Text style={{ color: 'gray', marginBottom: 4 }}>Last 7 Days Performance</Text>
              <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Total Sales (Last 7 Days)</Text>
              <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
                ₹{totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
          
          {hasSales ? (
            <BarChart
              data={{
                labels: chartLabels,
                datasets: [
                  {
                    data: chartData
                  }
                ]
              }}
              width={width > 800 ? width - 350 : width - 50}
              height={300}
              yAxisLabel="₹"
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: "#ffffff",
                backgroundGradientFrom: "#ffffff",
                backgroundGradientTo: "#ffffff",
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                barPercentage: 0.5,
              }}
              style={{ marginVertical: 8, borderRadius: 16 }}
              withInnerLines={false}
              showBarTops={false}
            />
          ) : (
            <View style={{ height: 300, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <Icon name="chart-bar" size={64} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={{ color: '#64748B', fontSize: 14, fontWeight: '500' }}>No sales transactions found for the last 7 days.</Text>
            </View>
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
  chartCard: { backgroundColor: 'white', borderRadius: 12 },
  chartHeader: { marginBottom: 20 },
});
