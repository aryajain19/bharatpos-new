import { useAppTheme } from '../../../providers/ThemeProvider';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Animated, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { Text, Surface, useTheme, TextInput, Card, Button } from 'react-native-paper';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { collection, getDocs } from '../../../lib/firestore_adapter';
import { useCart } from '../../../providers/CartProvider';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, router } from 'expo-router';
import { useAuth } from '../../../providers/AuthProvider';

// --- Categories with icons ---
const CATEGORIES = [
  { key: 'All', icon: 'view-grid', label: 'All' },
  { key: 'Grocery', icon: 'basket', label: 'Grocery' },
  { key: 'Dairy', icon: 'cheese', label: 'Dairy' },
  { key: 'Beverages', icon: 'cup', label: 'Beverages' },
  { key: 'Snacks', icon: 'food-croissant', label: 'Snacks' },
  { key: 'Personal Care', icon: 'face-man-shimmer', label: 'Personal Care' },
];

// --- Category icon map for product cards ---
const CATEGORY_ICONS: Record<string, string> = {
  Grocery: 'basket',
  Dairy: 'cheese',
  Beverages: 'cup',
  Snacks: 'food-croissant',
  'Personal Care': 'face-man-shimmer',
};

// --- 18 Realistic Indian products ---
const DEMO_PRODUCTS: any[] = [];

export default function ProductsScreen() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const theme = useTheme();
  const { cart, addToCart, removeFromCart, updateQty } = useCart();
  const navigation = useNavigation();
  const { tenantId } = useAuth();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  // Animated search border
  const searchBorderAnim = useRef(new Animated.Value(0)).current;

  // Fade-in for list
  const listFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchProducts();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchProducts();
    });
    Animated.timing(listFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    return unsubscribe;
  }, [navigation]);

  const fetchProducts = async () => {
    let baseProducts: any[] = [];
    if (!isFirebaseConfigured) {
      setProducts(DEMO_PRODUCTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { query, where, collection } = await import('../../../lib/firestore_adapter');
      const q = query(
        collection(db, 'products'),
        where('tenant_id', '==', tenantId || 'anonymous')
      );
      const snapshot = await getDocs(q);
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (productsData.length > 0) {
        baseProducts = productsData.map((p: any) => ({
          id: p.id,
          name: p.name,
          selling_price: p.selling_price || p.price,
          stock_qty: p.stock_qty !== undefined ? p.stock_qty : (p.stock || 15),
          category: p.category || 'Grocery',
          gst_pct: p.gst_pct || 0,
          hsn: p.hsn || '',
          image_url: p.image_url || '',
        }));
      }
    } catch (err: any) {
      console.error("Error fetching vendor products:", err);
      setError(err.message || "Failed to load products list.");
    } finally {
      setLoading(false);
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      baseProducts.forEach((p: any) => {
        window.localStorage.setItem(`stock_${p.id}`, String(p.stock_qty));
      });
    }
    setProducts(baseProducts);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProducts();
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handleSearchFocus = () => {
    setSearchFocused(true);
    Animated.timing(searchBorderAnim, { toValue: 1, duration: 250, useNativeDriver: false }).start();
  };

  const handleSearchBlur = () => {
    setSearchFocused(false);
    Animated.timing(searchBorderAnim, { toValue: 0, duration: 250, useNativeDriver: false }).start();
  };

  const searchBorderColor = searchBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E8E8E8', '#10B981'],
  });

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const renderProduct = ({ item, index }: any) => {
    const cartItem = cart.find(c => c.id === item.id);
    const qty = cartItem ? cartItem.qty : 0;
    const categoryIcon = CATEGORY_ICONS[item.category] || 'package-variant-closed';

    const handleMinus = () => {
      if (qty > 1) updateQty(item.id, -1);
      else if (qty === 1) removeFromCart(item.id);
    };

    const handlePlus = () => {
      addToCart({
        id: item.id,
        name: item.name,
        price: item.selling_price,
        qty: 1,
        gst_pct: item.gst_pct,
        hsn: item.hsn || '',
        image_url: item.image_url,
      });
    };

    const isLowStock = item.stock_qty <= 20;

    return (
      <Surface style={styles.productCard} elevation={1}>
        <View style={styles.cardContent}>
          {/* Icon placeholder instead of image */}
          <View style={[styles.productIconBg, { backgroundColor: qty > 0 ? '#D1FAE5' : '#F5F6FA' }]}>
            <MaterialCommunityIcons name={categoryIcon} size={28} color={qty > 0 ? '#10B981' : '#78909C'} />
          </View>

          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.productMeta}>
              <Text style={styles.productPrice}>₹{item.selling_price.toFixed(2)}</Text>
              {item.gst_pct > 0 && (
                <View style={styles.gstBadge}>
                  <Text style={styles.gstText}>{item.gst_pct}% GST</Text>
                </View>
              )}
            </View>
            <View style={styles.stockRow}>
              <MaterialCommunityIcons
                name={isLowStock ? 'alert-circle' : 'check-circle'}
                size={12}
                color={isLowStock ? '#FF9800' : '#4CAF50'}
              />
              <Text style={[styles.stockText, isLowStock && { color: appTheme.colors.onSurface }]}>
                {isLowStock ? `Low: ${item.stock_qty} left` : `In Stock: ${item.stock_qty}`}
              </Text>
            </View>
          </View>

          <View style={styles.rightActions}>
            {qty === 0 ? (
              <TouchableOpacity style={styles.addButton} onPress={handlePlus} activeOpacity={0.7}>
                <MaterialCommunityIcons name="plus" size={20} color="white" />
              </TouchableOpacity>
            ) : (
              <View style={styles.qtyController}>
                <TouchableOpacity onPress={handleMinus} style={styles.qtyBtn} activeOpacity={0.6}>
                  <MaterialCommunityIcons name="minus" size={16} color="#10B981" />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{qty}</Text>
                <TouchableOpacity onPress={handlePlus} style={[styles.qtyBtn, styles.qtyBtnPlus]} activeOpacity={0.6}>
                  <MaterialCommunityIcons name="plus" size={16} color="white" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Surface>
    );
  };

  const totalInCart = cart.reduce((sum, c) => sum + c.qty, 0);
  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Products...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Products</Text>
          <Text style={{ marginTop: 8, color: 'gray', textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 24 }}>{error}</Text>
          <Button mode="contained" onPress={fetchProducts} style={{ borderRadius: 10, width: '100%', backgroundColor: appTheme.colors.primary }}>
            Retry Sync
          </Button>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Products</Text>
        <Text style={styles.headerSubtitle}>{filteredProducts.length} items available</Text>

        {/* Animated Search Bar */}
        <Animated.View style={[styles.searchWrapper, { borderColor: searchBorderColor }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={searchFocused ? '#10B981' : '#999'} style={{ marginLeft: 14 }} />
          <TextInput
            placeholder="Search by product name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            mode="flat"
            style={styles.searchInput}
            underlineColor="transparent"
            activeUnderlineColor="transparent"
            placeholderTextColor="#AAA"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginRight: 10 }}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#CCC" />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Category Filter Chips */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={item => item.key}
          style={styles.categoryRow}
          renderItem={({ item }) => {
            const isActive = activeCategory === item.key;
            return (
              <TouchableOpacity
                style={[styles.categoryChip, isActive && styles.activeChip]}
                onPress={() => setActiveCategory(item.key)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={14}
                  color={isActive ? 'white' : '#666'}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.chipText, isActive && styles.activeChip]}>{item.label}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Product List */}
      <Animated.View style={{ flex: 1, opacity: listFade }}>
        <FlatList
          data={filteredProducts}
          keyExtractor={item => item.id}
          renderItem={renderProduct}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10B981']} tintColor="#10B981" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="package-variant-closed" size={52} color="#CCC" />
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your search or category filter</Text>
            </View>
          }
        />
      </Animated.View>

      {/* Floating Cart Summary */}
      {totalInCart > 0 && (
        <Surface style={styles.cartFloat} elevation={4}>
          <View style={styles.cartFloatLeft}>
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{totalInCart}</Text>
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.cartItemsText}>{totalInCart} item{totalInCart > 1 ? 's' : ''} in cart</Text>
              <Text style={styles.cartTotalText}>₹{cartTotal.toFixed(2)}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.cartViewBtn} activeOpacity={0.8} onPress={() => router.push('/(vendor)/cart')}>
            <Text style={styles.cartViewBtnText}>View Cart</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color="white" />
          </TouchableOpacity>
        </Surface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, },

  // --- Header ---
  header: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12, backgroundColor: 'white', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 2 },
  headerSubtitle: { fontSize: 13, marginBottom: 16 },

  // --- Search ---
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    height: 48,
    marginBottom: 14,
  },
  searchInput: { flex: 1, backgroundColor: 'transparent', height: 46, fontSize: 14, paddingHorizontal: 10 },

  // --- Category Chips ---
  categoryRow: { marginBottom: 6 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    },
  activeChip: { },
  chipText: { fontSize: 12, fontWeight: '600' },
  activeChipText: { color: 'white' },

  // --- Product List ---
  listContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },

  // --- Product Card ---
  productCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#10B981',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  cardContent: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  productIconBg: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  productInfo: { flex: 1 },
  productName: { fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  productMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  productPrice: { fontWeight: 'bold', fontSize: 15 },
  gstBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  gstText: { fontSize: 9, fontWeight: '700' },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stockText: { fontSize: 11, fontWeight: '500' },

  // --- Right Actions ---
  rightActions: { alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  qtyController: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, overflow: 'hidden' },
  qtyBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  qtyBtnPlus: { borderRadius: 8, margin: 2 },
  qtyText: { width: 28, textAlign: 'center', fontWeight: 'bold', fontSize: 14, },

  // --- Empty State ---
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 16 },
  emptySubtitle: { fontSize: 13, marginTop: 4 },

  // --- Floating Cart ---
  cartFloat: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#10B981',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cartFloatLeft: { flexDirection: 'row', alignItems: 'center' },
  cartBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  cartBadgeText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  cartItemsText: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },
  cartTotalText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  cartViewBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, gap: 4 },
  cartViewBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },
});
