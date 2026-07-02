import { useAppTheme } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Platform, ActivityIndicator, TouchableOpacity, useWindowDimensions, Alert } from 'react-native';
import { Text, Card, DataTable, useTheme, TextInput, Button, SegmentedButtons, Dialog, Portal } from 'react-native-paper';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { collection, getDocs, query, orderBy, where, doc, getDoc, setDoc, updateDoc } from '../../lib/firestore_adapter';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from 'expo-router';

// ─── Types ────────────────────────────────────────────────────────────
interface Product {
  id: string;
  name: string;
  price: number;
  barcode: string;
  category: string;
  gst_pct: number;
  hsn: string;
  stock_qty: number;
  min_stock?: number;
  location_stocks: Record<string, number>;
}

export default function InventoryManagementScreen() {
  const { tenantId, loading: authLoading } = useAuth();
  const { isDarkMode } = useAppTheme();
  const appTheme = useTheme();
  const navigation = useNavigation();

  // ── State ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'stock' | 'locations' | 'transfers'>('stock');
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<string[]>(['Main Shop']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Location modal state
  const [showAddLoc, setShowAddLoc] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [savingLoc, setSavingLoc] = useState(false);

  // Transfer stock modal state
  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedProd, setSelectedProd] = useState<Product | null>(null);
  const [fromLoc, setFromLoc] = useState('Main Shop');
  const [toLoc, setToLoc] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [savingTransfer, setSavingTransfer] = useState(false);

  useEffect(() => {
    if (!authLoading && tenantId) {
      fetchData();
    }
    const unsubscribe = navigation.addListener('focus', () => {
      if (!authLoading && tenantId) {
        fetchData();
      }
    });
    return unsubscribe;
  }, [navigation, authLoading, tenantId]);

  const fetchData = async () => {
    if (!isFirebaseConfigured || !tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Locations list (fail silently if permission denied)
      try {
        const locRef = doc(db, 'settings', tenantId);
        const locSnap = await getDoc(locRef);
        if (locSnap.exists() && locSnap.data()?.locations) {
          setLocations(locSnap.data().locations);
        } else {
          setLocations(['Main Shop']);
        }
      } catch (locErr) {
        console.warn("Could not fetch inventory locations, using defaults:", locErr);
        setLocations(['Main Shop']);
      }

      // 2. Fetch Products (tenant filter only; sorting done client-side)
      const q = query(
        collection(db, 'products'),
        where('tenant_id', '==', tenantId)
      );
      const snapshot = await getDocs(q);
      const fetchedProds: Product[] = snapshot.docs.map(dSnap => {
        const p = dSnap.data();
        const stockVal = p.stock_qty !== undefined ? p.stock_qty : (p.stock || 0);
        return {
          id: dSnap.id,
          name: p.name || 'Unnamed Product',
          price: p.selling_price || p.price || 0,
          barcode: p.barcode || '',
          category: p.category || '',
          gst_pct: p.gst_pct || 0,
          hsn: p.hsn || '',
          stock_qty: stockVal,
          min_stock: p.min_stock || 0,
          location_stocks: p.location_stocks || { 'Main Shop': stockVal }
        };
      });
      // Client-side sort by stock_qty ascending
      fetchedProds.sort((a, b) => a.stock_qty - b.stock_qty);
      setProducts(fetchedProds);
    } catch (err: any) {
      console.error("Error fetching inventory data:", err);
      setError(err.message || "Failed to load inventory details.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = async () => {
    if (!tenantId) return;
    if (!newLocName.trim()) {
      Alert.alert('Error', 'Please enter a valid warehouse/godown name.');
      return;
    }
    if (locations.includes(newLocName.trim())) {
      Alert.alert('Error', 'Location name already exists.');
      return;
    }
    setSavingLoc(true);
    try {
      const updated = [...locations, newLocName.trim()];
      const locRef = doc(db, 'settings', tenantId);
      await setDoc(locRef, { locations: updated }, { merge: true });
      setLocations(updated);
      setNewLocName('');
      setShowAddLoc(false);
      Alert.alert('Success', `Warehouse "${newLocName.trim()}" registered successfully!`);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to add warehouse: ' + e.message);
    } finally {
      setSavingLoc(false);
    }
  };

  const handleTransferStock = async () => {
    if (!selectedProd || !fromLoc || !toLoc || !transferQty) {
      Alert.alert('Error', 'Please fill all details.');
      return;
    }
    if (fromLoc === toLoc) {
      Alert.alert('Error', 'Source and destination locations cannot be the same.');
      return;
    }
    const qty = parseInt(transferQty);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Error', 'Please enter a valid transfer quantity.');
      return;
    }
    const fromStock = selectedProd.location_stocks[fromLoc] || 0;
    if (qty > fromStock) {
      Alert.alert('Error', `Insufficient stock in ${fromLoc}. Available: ${fromStock}`);
      return;
    }

    setSavingTransfer(true);
    try {
      const updatedStocks = { ...selectedProd.location_stocks };
      updatedStocks[fromLoc] = fromStock - qty;
      updatedStocks[toLoc] = (updatedStocks[toLoc] || 0) + qty;

      const totalQty = Object.values(updatedStocks).reduce((sum, v) => sum + v, 0);

      const prodRef = doc(db, 'products', selectedProd.id);
      await updateDoc(prodRef, {
        location_stocks: updatedStocks,
        stock_qty: totalQty
      });

      Alert.alert('Success', `Transferred ${qty} units of "${selectedProd.name}" from ${fromLoc} to ${toLoc}.`);
      setShowTransfer(false);
      setTransferQty('');
      fetchData();
    } catch (e: any) {
      Alert.alert('Error', 'Failed to transfer stock: ' + e.message);
    } finally {
      setSavingTransfer(false);
    }
  };

  // Metrics calculations
  const totalProducts = products.length;
  const inStock = products.filter(p => p.stock_qty > 5).length;
  const lowStock = products.filter(p => p.stock_qty > 0 && p.stock_qty <= 5).length;
  const outOfStock = products.filter(p => p.stock_qty <= 0).length;

  // Filtered lists for rendering
  const locationStats = useMemo(() => {
    return locations.map(loc => {
      let totalStockVal = 0;
      let itemsCount = 0;
      products.forEach(p => {
        const st = p.location_stocks[loc] || 0;
        if (st > 0) {
          totalStockVal += st;
          itemsCount++;
        }
      });
      return { name: loc, totalStock: totalStockVal, uniqueItems: itemsCount };
    });
  }, [locations, products]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Inventory Data...</Text>
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
          <Button mode="contained" onPress={fetchData} style={{ borderRadius: 10, width: '100%', backgroundColor: appTheme.colors.primary }}>
            Retry Sync
          </Button>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <View>
            <Text variant="headlineSmall" style={styles.title}>Inventory & Godowns</Text>
            <Text style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>Multi-location stock allocations & transfer logs</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button 
              mode="outlined" 
              icon="plus" 
              onPress={() => setShowAddLoc(true)}
              style={{ borderColor: '#E2E8F0', borderRadius: 8 }}
              textColor="#475569"
            >
              Add Godown
            </Button>
            <Button 
              mode="contained" 
              icon="swap-horizontal" 
              onPress={() => setShowTransfer(true)}
              style={{ borderRadius: 8, backgroundColor: '#10B981' }}
            >
              Transfer Stock
            </Button>
          </View>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <MetricCard title="Total Products" value={totalProducts} icon="package-variant-closed" color="#10B981" bgColor="#ECFDF5" />
        <MetricCard title="In Stock" value={inStock} icon="check-circle-outline" color="#10B981" bgColor="#ECFDF5" />
        <MetricCard title="Low Stock" value={lowStock} icon="alert-outline" color="#F59E0B" bgColor="#FFFBEB" />
        <MetricCard title="Out of Stock" value={outOfStock} icon="close-circle-outline" color="#EF4444" bgColor="#FEF2F2" />
      </View>

      {/* Tabs */}
      <SegmentedButtons
        value={activeTab}
        onValueChange={setActiveTab as any}
        buttons={[
          { value: 'stock', label: 'Stock Overview', icon: 'format-list-bulleted' },
          { value: 'locations', label: 'Warehouse / Godowns', icon: 'storefront-outline' },
        ]}
        style={{ marginBottom: 24 }}
        theme={{ colors: { primary: '#10B981' } }}
      />

      {activeTab === 'stock' && (
        <Card style={styles.card} elevation={0}>
          <Card.Content style={{ padding: 0 }}>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title style={{ flex: 3 }}><Text style={styles.colHeader}>Product</Text></DataTable.Title>
                <DataTable.Title numeric><Text style={styles.colHeader}>Total Stock</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 3 }}><Text style={styles.colHeader}>Godown Breakdown</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 1.5, justifyContent: 'center' }}><Text style={styles.colHeader}>Status</Text></DataTable.Title>
              </DataTable.Header>

              {products.map((item) => {
                const statusColor = item.stock_qty <= 0 ? '#EF4444' : (item.stock_qty <= 5 ? '#F59E0B' : '#10B981');
                const statusText = item.stock_qty <= 0 ? 'Out of Stock' : (item.stock_qty <= 5 ? 'Low Stock' : 'In Stock');

                // Generate breakdown string
                const breakdown = Object.entries(item.location_stocks)
                  .filter(([_, qty]) => qty > 0)
                  .map(([loc, qty]) => `${loc}: ${qty}`)
                  .join(' | ') || 'No Stock';

                return (
                  <DataTable.Row key={item.id} style={{ minHeight: 60 }}>
                    <DataTable.Cell style={{ flex: 3 }}>
                      <View style={{ paddingVertical: 8 }}>
                        <Text style={{ fontWeight: 'bold', color: appTheme.colors.onSurface }}>{item.name}</Text>
                        <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{item.barcode || 'No Barcode'}</Text>
                      </View>
                    </DataTable.Cell>
                    <DataTable.Cell numeric>{item.stock_qty}</DataTable.Cell>
                    <DataTable.Cell style={{ flex: 3 }}>
                      <Text style={{ fontSize: 12, color: '#475569' }} numberOfLines={2}>{breakdown}</Text>
                    </DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1.5, justifyContent: 'center' }}>
                      <Text style={{ color: statusColor, fontWeight: '700' }}>{statusText}</Text>
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}

              {products.length === 0 && (
                <DataTable.Row>
                  <DataTable.Cell><Text style={{ fontStyle: 'italic', color: '#94A3B8' }}>No Products Registered</Text></DataTable.Cell>
                </DataTable.Row>
              )}
            </DataTable>
          </Card.Content>
        </Card>
      )}

      {activeTab === 'locations' && (
        <View style={{ gap: 16, marginBottom: 40 }}>
          {locationStats.map((loc, idx) => (
            <Card key={idx} style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#EEF0F6' }} elevation={0}>
              <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
                <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="storefront" size={20} color="#10B981" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>{loc.name}</Text>
                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{loc.uniqueItems} distinct products currently stocked</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: '#10B981' }}>{loc.totalStock}</Text>
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '600' }}>Total Quantity</Text>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}

      {/* Portal Dialogs */}
      <Portal>
        {/* Add Location Modal */}
        <Dialog visible={showAddLoc} onDismiss={() => setShowAddLoc(false)} style={{ backgroundColor: 'white', borderRadius: 16, maxWidth: 500, alignSelf: 'center', width: '90%' }}>
          <Dialog.Title><Text style={{ fontWeight: 'bold' }}>Register New Warehouse/Godown</Text></Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: '#64748B', marginBottom: 16, fontSize: 13 }}>Create a new storage location to track stock levels separately.</Text>
            <TextInput
              label="Location / Godown Name"
              value={newLocName}
              onChangeText={setNewLocName}
              mode="outlined"
              activeOutlineColor="#10B981"
              style={{ backgroundColor: 'white' }}
              placeholder="e.g. Godown Sector 5"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowAddLoc(false)} textColor="#64748B">Cancel</Button>
            <Button 
              mode="contained" 
              onPress={handleAddLocation} 
              loading={savingLoc} 
              buttonColor="#10B981"
              style={{ borderRadius: 8 }}
            >
              Add Location
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Transfer Stock Modal */}
        <Dialog visible={showTransfer} onDismiss={() => setShowTransfer(false)} style={{ backgroundColor: 'white', borderRadius: 16, maxWidth: 600, alignSelf: 'center', width: '90%' }}>
          <Dialog.Title><Text style={{ fontWeight: 'bold' }}>Stock Transfer Voucher</Text></Dialog.Title>
          <Dialog.Content style={{ gap: 16 }}>
            <Text style={{ color: '#64748B', fontSize: 13 }}>Move items between warehouses or transfer stock to the main billing counter.</Text>
            
            {/* Product Selector */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>Select Product</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8 }}>
                {products.map(p => (
                  <TouchableOpacity 
                    key={p.id}
                    onPress={() => {
                      setSelectedProd(p);
                      // Default fromLoc to first location with stock
                      const firstWithStock = Object.keys(p.location_stocks).find(k => p.location_stocks[k] > 0) || 'Main Shop';
                      setFromLoc(firstWithStock);
                    }}
                    style={[
                      styles.transferProductCard,
                      selectedProd?.id === p.id && { borderColor: '#10B981', backgroundColor: '#F0FDF4' }
                    ]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{p.name}</Text>
                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Total: {p.stock_qty} qty</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {selectedProd && (
              <>
                {/* Locations Selectors */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>Source (From)</Text>
                    <ScrollView style={{ maxHeight: 120, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 4 }}>
                      {locations.map(loc => {
                        const stockAmt = selectedProd.location_stocks[loc] || 0;
                        return (
                          <TouchableOpacity 
                            key={loc}
                            onPress={() => setFromLoc(loc)}
                            style={[
                              styles.locSelectItem,
                              fromLoc === loc && { backgroundColor: '#F1F5F9' }
                            ]}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '600' }}>{loc}</Text>
                            <Text style={{ fontSize: 11, color: '#64748B' }}>({stockAmt} in stock)</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>Destination (To)</Text>
                    <ScrollView style={{ maxHeight: 120, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 4 }}>
                      {locations.map(loc => {
                        const stockAmt = selectedProd.location_stocks[loc] || 0;
                        return (
                          <TouchableOpacity 
                            key={loc}
                            onPress={() => setToLoc(loc)}
                            style={[
                              styles.locSelectItem,
                              toLoc === loc && { backgroundColor: '#F1F5F9' }
                            ]}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '600' }}>{loc}</Text>
                            <Text style={{ fontSize: 11, color: '#64748B' }}>({stockAmt} in stock)</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>

                {/* Transfer Quantity */}
                <TextInput
                  label="Transfer Quantity"
                  value={transferQty}
                  onChangeText={setTransferQty}
                  keyboardType="numeric"
                  mode="outlined"
                  activeOutlineColor="#10B981"
                  style={{ backgroundColor: 'white' }}
                  placeholder={`Max: ${selectedProd.location_stocks[fromLoc] || 0}`}
                />
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowTransfer(false)} textColor="#64748B">Cancel</Button>
            <Button 
              mode="contained" 
              onPress={handleTransferStock} 
              loading={savingTransfer} 
              disabled={!selectedProd}
              buttonColor="#10B981"
              style={{ borderRadius: 8 }}
            >
              Confirm Transfer
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  title: { fontWeight: '800', fontSize: 22 },
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
  colHeader: { fontWeight: 'bold', color: '#475569' },
  transferProductCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    width: 140,
    backgroundColor: 'white'
  },
  locSelectItem: {
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 6,
    marginVertical: 2
  }
});
