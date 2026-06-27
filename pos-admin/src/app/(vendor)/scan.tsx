import React, { useState, useEffect } from 'react';

import { useAuth } from '../../providers/AuthProvider';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, useTheme, IconButton, TextInput } from 'react-native-paper';
import { Camera, CameraView } from 'expo-camera';
import { useAppTheme } from '../../providers/ThemeProvider';
import { router } from 'expo-router';
import { useCart } from '../../providers/CartProvider';
import { db, isFirebaseConfigured, auth } from '../../lib/firebase';
import { collection, query, where, getDocs } from '../../lib/firestore_adapter';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function ScanScreen() {
  const { tenantId, loading: authLoading } = useAuth();

  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const { addToCart } = useCart();

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ type, data }: any) => {
    if (scanned) return;
    setScanned(true);
    
    if (isFirebaseConfigured) {
      try {
        // 1. If scanned text is a deep link URL, parse the barcode out of it
        let barcode = data;
        if (data && typeof data === 'string' && data.includes('scanBarcode=')) {
          const match = data.match(/[?&]scanBarcode=([^&]+)/);
          if (match) {
            barcode = match[1];
          }
        }
        
        const cleanBarcode = barcode.trim().replace(/[\r\n]/g, '');
        if (!cleanBarcode) {
          Alert.alert('Invalid Scan', 'Scanned barcode data is empty.');
          return;
        }

        if (!tenantId) return;
        const q = query(
          collection(db, 'products'),
          where('tenant_id', '==', tenantId),
          where('barcode', '==', cleanBarcode)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const productData = snapshot.docs[0].data();
          addToCart({
            id: snapshot.docs[0].id,
            name: productData.name,
            price: productData.selling_price || productData.price,
            qty: 1,
            gst_pct: productData.gst_pct || 0,
            hsn: productData.hsn || '',
            image_url: productData.image_url,
          });
          router.replace('/(vendor)/cart');
          return;
        } else {
          Alert.alert('Not Found', `No product found with barcode: ${cleanBarcode}`);
        }
      } catch (error: any) {
        console.error("Scan error", error);
        Alert.alert('Scan Error', error.message || 'Failed to search product barcode.');
      } finally {
        setTimeout(() => setScanned(false), 2000);
      }
    } else {
      setTimeout(() => setScanned(false), 2000);
    }
  };

  if (hasPermission === null) return <View style={styles.container} />;
  if (hasPermission === false) return <View style={styles.container}><Text style={{color: 'white', textAlign: 'center', marginTop: 100}}>No access to camera</Text></View>;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" iconColor="white" size={24} onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Scan Barcode</Text>
        <IconButton icon="image-outline" iconColor="white" size={24} onPress={() => {}} />
      </View>

      {/* Camera Preview */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFill}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr", "ean13", "ean8", "code128"],
          }}
        />
        
        {/* Overlay frame matching the blueprint exactly */}
        <View style={styles.overlayFrame}>
          {/* Top Left Corner */}
          <View style={[styles.corner, styles.topLeftCorner]} />
          {/* Top Right Corner */}
          <View style={[styles.corner, styles.topRightCorner]} />
          {/* Bottom Left Corner */}
          <View style={[styles.corner, styles.bottomLeftCorner]} />
          {/* Bottom Right Corner */}
          <View style={[styles.corner, styles.bottomRightCorner]} />
          
          {/* Mock Red Laser Line */}
          <View style={styles.laserLine} />
        </View>
      </View>

      <Text style={styles.instructionText}>Align barcode inside the frame</Text>

      {/* Bottom Floating Action Buttons */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.floatingButton}>
          <Icon name="flashlight" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.floatingButton}>
          <Icon name="cog-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, }, // Exact Purple background
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 50, paddingHorizontal: 8 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  cameraContainer: {
    width: 250,
    height: 250,
    alignSelf: 'center',
    marginTop: 60,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayFrame: {
    width: 200,
    height: 150,
    position: 'absolute',
    justifyContent: 'center',
  },
  corner: { position: 'absolute', width: 30, height: 30, }, // purple corners matching the mock
  topLeftCorner: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  topRightCorner: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  bottomLeftCorner: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  bottomRightCorner: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  laserLine: { height: 2, backgroundColor: 'red', width: '100%', position: 'absolute' },
  instructionText: { color: 'white', textAlign: 'center', marginTop: 30, fontSize: 14 },
  bottomActions: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: 60, paddingHorizontal: 60 },
  floatingButton: { width: 50, height: 50, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
});
