import { useAppTheme } from '../../providers/ThemeProvider';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, Image, ActivityIndicator } from 'react-native';
import { Text, Button, Surface, useTheme, TextInput, Card } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { collection, query, where, getDocs } from '../../lib/firestore_adapter';
import { useCart } from '../../providers/CartProvider';
import { useAuth } from '../../providers/AuthProvider';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function ProductDetailsScreen() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const { barcode } = useLocalSearchParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToCart } = useCart();
  const { tenantId } = useAuth();
  const theme = useTheme();

  useEffect(() => {
    if (barcode) fetchProduct(barcode as string);
  }, [barcode]);

  const fetchProduct = async (code: string) => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, 'products'), 
        where('barcode', '==', code),
        where('tenant_id', '==', tenantId || 'anonymous')
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        Alert.alert('Not Found', 'Product not found.');
        router.back();
      } else {
        setProduct({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load product details.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (product) {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.selling_price,
        qty: 1,
        gst_pct: product.gst_pct,
        hsn: product.hsn || '',
        image_url: product.image_url,
      });
      router.push('/(vendor)/cart');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Product Details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Product</Text>
          <Text style={{ marginTop: 8, color: 'gray', textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 24 }}>{error}</Text>
          <Button mode="contained" onPress={() => barcode && fetchProduct(barcode as string)} style={{ borderRadius: 10, width: '100%', backgroundColor: appTheme.colors.primary }}>
            Retry Sync
          </Button>
        </Card>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <Text style={{ color: appTheme.colors.onSurfaceVariant }}>Product not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.imageContainer} elevation={1}>
        <Image 
          source={{ uri: product.image_url || 'https://via.placeholder.com/150' }} 
          style={styles.image} 
          resizeMode="contain"
        />
      </Surface>

      <View style={styles.detailsContainer}>
        <Text variant="titleLarge" style={styles.title}>{product.name}</Text>
        <Text variant="bodyMedium" style={styles.variant}>{product.variant || 'Standard'}</Text>
        <Text variant="bodySmall" style={styles.barcode}>Barcode: {product.barcode}</Text>

        <View style={styles.row}>
          <View>
            <Text variant="bodySmall" style={styles.label}>MRP</Text>
            <Text variant="titleMedium" style={styles.strikethrough}>₹{product.mrp}</Text>
          </View>
        </View>

        <View style={[styles.row, { marginTop: 10 }]}>
          <View>
            <Text variant="bodySmall" style={styles.label}>Selling Price</Text>
            <Text variant="headlineSmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
              ₹{product.selling_price}
            </Text>
          </View>
          <Button icon="pencil" mode="text" onPress={() => {}}>Edit Price</Button>
        </View>

        <View style={styles.divider} />

        <Text variant="bodySmall" style={styles.label}>GST</Text>
        <Text variant="bodyLarge" style={styles.value}>{product.gst_pct}%</Text>

        <Text variant="bodySmall" style={[styles.label, { marginTop: 10 }]}>Stock Available</Text>
        <Text variant="bodyLarge" style={styles.value}>{product.stock_qty} PCS</Text>
      </View>

      <Button 
        mode="contained" 
        style={styles.bottomButton} 
        contentStyle={styles.buttonContent}
        onPress={handleAddToCart}
      >
        ADD TO CART
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    },
  image: { width: 150, height: 150 },
  detailsContainer: { padding: 20 },
  title: { fontWeight: 'bold' },
  variant: { color: 'gray', marginBottom: 8 },
  barcode: { color: 'gray', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: 'gray' },
  strikethrough: { textDecorationLine: 'line-through', color: 'gray' },
  divider: { height: 1, marginVertical: 16 },
  value: { fontWeight: 'bold' },
  bottomButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 8,
  },
  buttonContent: { paddingVertical: 8 },
});
