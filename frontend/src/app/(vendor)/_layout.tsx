import React from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '../../providers/AuthProvider';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function VendorLayout() {
  const { isTrialExpired } = useAuth();

  return (
    <View style={{ flex: 1 }}>
      {isTrialExpired && (
        <View style={styles.expiryBanner}>
          <Icon name="alert-circle" size={20} color="white" />
          <Text style={styles.expiryText}>Your subscription has expired. Access is limited. Contact Admin to upgrade.</Text>
        </View>
      )}
      <Stack screenOptions={{ 
        headerStyle: { backgroundColor: '#10B981' }, 
        headerTintColor: '#fff',
        headerTitleAlign: 'center',
      }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="product_details" options={{ title: 'Product Details' }} />
        <Stack.Screen name="cart" options={{ title: 'Cart' }} />
        <Stack.Screen name="billing" options={{ title: 'Billing' }} />
        <Stack.Screen name="bill_preview" options={{ title: 'Bill Preview' }} />
        <Stack.Screen name="add_product" options={{ title: 'Add Product' }} />
        <Stack.Screen name="stock_update" options={{ title: 'Stock Update' }} />
        <Stack.Screen name="low_stock" options={{ title: 'Low Stock' }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  expiryBanner: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingTop: 50, // accommodate safe area
  },
  expiryText: { color: 'white', fontWeight: 'bold', fontSize: 13, marginLeft: 8, flexShrink: 1 },
});
