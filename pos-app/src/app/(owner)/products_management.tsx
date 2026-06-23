import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, useTheme, Card, DataTable, Button, IconButton, TextInput } from 'react-native-paper';
import { db, isFirebaseConfigured, auth } from '../../lib/firebase';
import { collection, query, where, orderBy, getDocs } from '../../lib/firestore_adapter';
import { useAppTheme } from '../../providers/ThemeProvider';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { cleanAndMapCategory } from '../../lib/ui_helpers';

export default function ProductsManagementScreen() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    if (!isFirebaseConfigured) return;
    try {
      const tenantId = auth.currentUser?.uid || 'anonymous';
      const q = query(
        collection(db, 'products'),
        where('tenant_id', '==', tenantId),
        orderBy('created_at', 'desc')
      );
      const snapshot = await getDocs(q);
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(productsData);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Products</Text>
        <Button 
          mode="contained" 
          onPress={() => router.push('/(vendor)/add_product')} 
          style={styles.addBtn}
          contentStyle={{ paddingHorizontal: 8 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="plus" size={16} color="white" style={{ marginRight: 4 }} />
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>Add Product</Text>
          </View>
        </Button>
      </View>

      <Card style={styles.card} elevation={1}>
        <ScrollView horizontal>
          <View style={{ minWidth: 1000, width: '100%' }}>
            <DataTable>
              <DataTable.Header style={styles.tableHeader}>
                <DataTable.Title style={{ flex: 3 }}><Text style={styles.colHeader}>Product</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 2 }}><Text style={styles.colHeader}>Category</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1.5 }}><Text style={styles.colHeader}>MRP</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1.5 }}><Text style={styles.colHeader}>Selling Price</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHeader}>Stock</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 1.5, justifyContent: 'center' }}><Text style={styles.colHeader}>Status</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHeader}>Action</Text></DataTable.Title>
              </DataTable.Header>

              {products.map((item) => {
                const isOutOfStock = item.stock_qty <= 0;
                return (
                  <DataTable.Row key={item.id} style={styles.tableRow}>
                    <DataTable.Cell style={{ flex: 3 }}>
                      <Text style={styles.cellMainText}>{item.name}</Text>
                    </DataTable.Cell>
                      <DataTable.Cell style={{ flex: 2, justifyContent: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Icon name={cleanAndMapCategory(item.category || '').icon} size={14} color="#64748B" style={{ marginRight: 6 }} />
                          <Text style={styles.cellSubText}>{cleanAndMapCategory(item.category || '').cleanName}</Text>
                        </View>
                      </DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1.5 }}>
                      <Text style={styles.cellSubText}>₹{item.mrp.toFixed(2)}</Text>
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1.5 }}>
                      <Text style={styles.cellMainText}>₹{item.selling_price.toFixed(2)}</Text>
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}>
                      <Text style={styles.cellSubText}>{item.stock_qty}</Text>
                    </DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1.5, justifyContent: 'center' }}>
                      <View style={styles.statusContainer}>
                        <Icon 
                          name={isOutOfStock ? "close-circle-outline" : "check-circle-outline"} 
                          size={14} 
                          color={isOutOfStock ? '#F44336' : '#4CAF50'} 
                        />
                        <Text style={[styles.statusText, { color: isOutOfStock ? '#F44336' : '#4CAF50' }]}>
                          {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                        </Text>
                      </View>
                    </DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1 }}>
                      <View style={styles.actionIcons}>
                        <TouchableOpacity style={{ marginRight: 12 }}>
                          <Icon name="pencil-outline" size={18} color="#2196F3" />
                        </TouchableOpacity>
                        <TouchableOpacity>
                          <Icon name="trash-can-outline" size={18} color="#F44336" />
                        </TouchableOpacity>
                      </View>
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}

              {products.length === 0 && (
                <View style={{ padding: 40, alignItems: 'center', width: '100%' }}>
                  <Text style={{ color: 'gray', fontStyle: 'italic' }}>No Data Available</Text>
                </View>
              )}
            </DataTable>
          </View>
        </ScrollView>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 16, fontWeight: 'bold', },
  addBtn: { borderRadius: 6, },
  card: { backgroundColor: 'white', borderRadius: 12, overflow: 'hidden', borderWidth: 1, },
  tableHeader: { borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  colHeader: { fontWeight: 'bold', color: 'gray', fontSize: 12 },
  tableRow: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  cellMainText: { fontWeight: '600', fontSize: 13 },
  cellSubText: { color: 'gray', fontSize: 13 },
  statusContainer: { flexDirection: 'row', alignItems: 'center' },
  statusText: { fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  actionIcons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', width: '100%' },
});
