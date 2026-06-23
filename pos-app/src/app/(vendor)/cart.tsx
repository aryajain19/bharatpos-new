import React from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { Text, useTheme, IconButton, TextInput } from 'react-native-paper';
import { useCart } from '../../providers/CartProvider';
import { useAppTheme } from '../../providers/ThemeProvider';
import { router } from 'expo-router';

export default function CartScreen() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const { cart, removeFromCart, updateQty, getSubtotal, getTotal, clearCart } = useCart();

  const renderCartItem = ({ item }: any) => (
    <View style={styles.cartItem}>
      <Image 
        source={{ uri: item.image_url || 'https://via.placeholder.com/50' }} 
        style={styles.itemImage} 
      />
      <View style={styles.itemDetails}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemMeta}>Size: {item.size || 'M'}</Text>
        <View style={styles.qtyController}>
          <TouchableOpacity onPress={() => updateQty(item.id, -1)} style={styles.qtyBtn}>
            <Text style={styles.qtyBtnText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.qtyText}>{item.qty}</Text>
          <TouchableOpacity onPress={() => updateQty(item.id, 1)} style={styles.qtyBtn}>
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.itemPrice}>₹{(item.price * item.qty).toFixed(2)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton icon="arrow-left" size={24} onPress={() => router.back()} style={{ marginLeft: -10 }} />
          <Text style={styles.headerTitle}>Cart ({cart.length})</Text>
        </View>
        <TouchableOpacity onPress={clearCart}>
          <Text style={styles.clearText}>Clear Cart</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={cart}
        keyExtractor={item => item.id}
        renderItem={renderCartItem}
        contentContainerStyle={styles.listContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text style={styles.emptyText}>Cart is empty</Text>}
      />

      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>₹{getSubtotal().toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Discount (5%)</Text>
          <Text style={styles.summaryValue}>-₹{(getSubtotal() * 0.05).toFixed(2)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>₹{(getTotal() - (getSubtotal() * 0.05)).toFixed(2)}</Text>
        </View>

        <TouchableOpacity 
          style={[styles.payButton, cart.length === 0 && { opacity: 0.5 }]} 
          disabled={cart.length === 0}
          onPress={() => router.push('/(vendor)/billing')}
        >
          <Text style={styles.payButtonText}>Proceed to Pay</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 10, backgroundColor: 'white' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  clearText: { fontWeight: 'bold', fontSize: 12 },
  listContainer: { padding: 16 },
  separator: { height: 1, marginVertical: 12 },
  emptyText: { textAlign: 'center', marginTop: 40, color: 'gray' },
  cartItem: { flexDirection: 'row', alignItems: 'center' },
  itemImage: { width: 50, height: 50, borderRadius: 8, marginRight: 16 },
  itemDetails: { flex: 1 },
  itemName: { fontWeight: 'bold', fontSize: 14, },
  itemMeta: { color: 'gray', fontSize: 10, marginTop: 2, marginBottom: 8 },
  qtyController: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 6, width: 80, alignSelf: 'flex-start' },
  qtyBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 14, fontWeight: 'bold' },
  qtyText: { flex: 1, textAlign: 'center', fontWeight: 'bold', fontSize: 12 },
  itemRight: { justifyContent: 'flex-start', height: '100%' },
  itemPrice: { fontWeight: 'bold', fontSize: 13 },
  summaryContainer: { padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { color: 'gray', fontSize: 13 },
  summaryValue: { fontSize: 13, fontWeight: '600' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: 12, marginTop: 4 },
  totalLabel: { fontWeight: 'bold', fontSize: 16, },
  totalValue: { fontWeight: 'bold', fontSize: 16, },
  payButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  payButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
