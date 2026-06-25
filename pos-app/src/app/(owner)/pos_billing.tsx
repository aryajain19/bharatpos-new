import { useAppTheme } from '../../providers/ThemeProvider';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated, TextInput as RNTextInput, Platform, Linking } from 'react-native';
import { Text, Button, Divider, Surface, Chip, Portal, Dialog, SegmentedButtons, TextInput, useTheme } from 'react-native-paper';
import * as Print from 'expo-print';
import { useCart } from '../../providers/CartProvider';
import { db, isFirebaseConfigured, auth } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, increment } from '../../lib/firestore_adapter';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { cleanAndMapCategory } from '../../lib/ui_helpers';
import { useLocalSearchParams, router } from 'expo-router';

// ── Category colors ────────────────────────────────────────────────────
const categoryColors: Record<string, string> = {
  Beverages: '#10B981', Staples: '#2E7D32', Oils: '#E65100', Dairy: '#1565C0',
  Snacks: '#D81B60', Detergent: '#00838F', 'Personal Care': '#AD1457', Cleaning: '#00695C',
};

// ── FadeIn Wrapper ─────────────────────────────────────────────────────
const FadeIn = ({ delay = 0, style, children }: { delay?: number; style?: any; children: React.ReactNode }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }).start();
  }, []);
  return <Animated.View style={[{ opacity }, style]}>{children}</Animated.View>;
};

// ── Main POS Billing Screen ────────────────────────────────────────────
export default function POSBillingScreen() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const { cart, addToCart, removeFromCart, updateQty, getSubtotal, clearCart } = useCart();
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<RNTextInput>(null);
  
  const [products, setProducts] = useState<any[]>([]);
  
  const params = useLocalSearchParams();
  const scanBarcodeParam = params.scanBarcode;
  
  useEffect(() => {
    fetchProducts();
  }, []);

  // Handle incoming deep link barcode scans on mount / parameter changes
  useEffect(() => {
    if (products.length > 0 && scanBarcodeParam) {
      const barcodeStr = Array.isArray(scanBarcodeParam) ? scanBarcodeParam[0] : scanBarcodeParam;
      if (barcodeStr) {
        const cleanBarcode = barcodeStr.trim().replace(/[\r\n]/g, '');
        const matchingProduct = products.find(p => p.barcode === cleanBarcode);
        if (matchingProduct) {
          handleAddProduct(matchingProduct);
          // Clear query parameters
          router.setParams({ scanBarcode: undefined });
        } else {
          Alert.alert('Not Found', `Product with barcode: ${cleanBarcode} not found in inventory.`);
          router.setParams({ scanBarcode: undefined });
        }
      }
    }
  }, [scanBarcodeParam, products]);

  const fetchProducts = async () => {
    if (isFirebaseConfigured) {
      try {
        const tenantId = auth.currentUser?.uid || 'anonymous';
        const q = query(
          collection(db, 'products'),
          where('tenant_id', '==', tenantId)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (data.length > 0) {
          const formatted = data.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: p.selling_price || p.price,
            barcode: p.barcode || '',
            category: p.category || '',
            gst_pct: p.gst_pct || 0,
            hsn: p.hsn || '',
            stock_qty: p.stock_qty !== undefined ? p.stock_qty : (p.stock || 15),
            image_url: p.image_url
          }));
          setProducts(formatted);
        }
      } catch (error) {
        console.error("Error fetching inventory:", error);
      }
    }
  };

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.barcode.includes(search)
    );
  }, [search, products]);

  const handleAddProduct = (product: any) => {
    addToCart({
      id: product.id, 
      name: product.name,
      price: product.price, 
      qty: 1,
      gst_pct: isGstRegistered ? product.gst_pct : 0, 
      hsn: product.hsn || '',
      image_url: product.image_url,
    });
    setSearch('');
    setShowSuggestions(false);
  };

  const getProductStock = (id: string) => {
    const p = products.find(p => p.id === id);
    return p ? p.stock_qty : 0;
  };
  // Dynamic GST vs Non-GST shop configurations
  const [isGstRegistered, setIsGstRegistered] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const gstVal = window.localStorage.getItem('isGstRegistered');
      return gstVal !== 'false';
    }
    return true;
  });
  const [storeName, setStoreName] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem('storeName') || 'BharatPOS';
    }
    return 'BharatPOS';
  });
  const [gstNum, setGstNum] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem('gstNumber') || '';
    }
    return '';
  });
  const [storeAddress, setStoreAddress] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem('storeAddress') || '';
    }
    return '';
  });

  // Checkout & sharing states
  const [showCheckout, setShowCheckout] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custGstin, setCustGstin] = useState('');
  const [payMethod, setPayMethod] = useState('UPI'); // 'Cash' | 'UPI' | 'Card'
  const [showReceipt, setShowReceipt] = useState(false);
  const [activeBillNo, setActiveBillNo] = useState('');

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const gstVal = window.localStorage.getItem('isGstRegistered');
      setIsGstRegistered(gstVal !== 'false');
      
      const nameVal = window.localStorage.getItem('storeName');
      if (nameVal) setStoreName(nameVal);
      
      const numVal = window.localStorage.getItem('gstNumber');
      if (numVal) setGstNum(numVal);

      const addrVal = window.localStorage.getItem('storeAddress');
      if (addrVal) setStoreAddress(addrVal);
    }
  }, []);

  const subtotal = getSubtotal();

  // Calculate GST breakdown per item (only if GST registered business)
  const gstBreakdown = useMemo(() => {
    let cgst = 0; let sgst = 0; let totalGst = 0;
    if (!isGstRegistered) return { cgst, sgst, totalGst };
    cart.forEach(item => {
      const itemTotal = item.price * item.qty;
      const gstPct = item.gst_pct !== undefined ? item.gst_pct : 5;
      const gstAmount = itemTotal * (gstPct / 100);
      totalGst += gstAmount;
      cgst += gstAmount / 2;
      sgst += gstAmount / 2;
    });
    return { cgst, sgst, totalGst };
  }, [cart, isGstRegistered]);

  const discount = 0; // Configurable discount can be implemented later
  const finalTotal = isGstRegistered
    ? (subtotal - discount + gstBreakdown.totalGst)
    : (subtotal - discount);

  const handleSearchSubmitWithText = async (barcodeText: string) => {
    if (!barcodeText.trim()) return;
    
    if (!isFirebaseConfigured) {
      Alert.alert('Configuration Error', 'Firebase must be configured to fetch products.');
      return;
    }

    try {
      // 1. If scanned text is a deep link URL, parse the barcode out of it
      let barcode = barcodeText;
      if (barcodeText.includes('scanBarcode=')) {
        const match = barcodeText.match(/[?&]scanBarcode=([^&]+)/);
        if (match) {
          barcode = match[1];
        }
      }
      
      const cleanBarcode = barcode.trim().replace(/[\r\n]/g, '');
      if (!cleanBarcode) return;

      const tenantId = auth.currentUser?.uid || 'anonymous';
      const q = query(
        collection(db, 'products'), 
        where('tenant_id', '==', tenantId), 
        where('barcode', '==', cleanBarcode)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        addToCart({
          id: docSnap.id, 
          name: data.name,
          price: data.selling_price || data.price, 
          qty: 1,
          gst_pct: isGstRegistered ? data.gst_pct : 0, 
          hsn: data.hsn || '',
          image_url: data.image_url,
        });
        setSearch('');
        setShowSuggestions(false);
      } else {
        Alert.alert('Not Found', `Product not found with barcode: ${cleanBarcode}`);
      }
    } catch (error) {
      console.error("Error searching product:", error);
    }
  };

  const handleSearchSubmit = async () => {
    await handleSearchSubmitWithText(search);
  };

  const handlePay = () => {
    if (cart.length === 0) return;
    setActiveBillNo('INV-' + Date.now());
    setShowCheckout(true);
  };

  const handleCompleteSale = async (sendInvoice: boolean) => {
    const dateObj = new Date();
    const dateStr = dateObj.toISOString().split('T')[0];
    const timeStr = dateObj.toTimeString().split(' ')[0].substring(0, 5);


    // 3. Save to Firebase Firestore if enabled
    if (isFirebaseConfigured) {
      const tenantId = auth.currentUser?.uid || 'anonymous';
      try {
        await addDoc(collection(db, 'sales'), {
          tenant_id: tenantId,
          vendor_id: auth.currentUser?.uid,
          bill_no: activeBillNo,
          created_at: dateObj.toISOString(),
          customer_name: custName || 'Walk-in Customer',
          customer_phone: custPhone || '',
          customer_gstin: custGstin || '',
          payment_method: payMethod,
          subtotal: subtotal,
          discount: discount,
          gst_collected: gstBreakdown.totalGst,
          total_amount: finalTotal,
          items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            qty: item.qty,
            gst_pct: item.gst_pct || 0,
            hsn: (item as any).hsn || ''
          }))
        });

        await addDoc(collection(db, 'transactions'), {
          tenant_id: tenantId,
          dateTime: `${dateStr} ${timeStr}`,
          created_at: dateObj.toISOString(),
          voucherType: 'Sales',
          voucherNo: activeBillNo,
          partyName: custName || 'Walk-in Customer',
          debit: finalTotal,
          credit: 0,
          paymentMethod: payMethod,
          gstAmount: gstBreakdown.totalGst,
          taxableValue: subtotal - discount,
        });

        // Deduct stock in Firestore
        await Promise.all(cart.map(async (item) => {
          try {
            const productRef = doc(db, 'products', item.id);
            await updateDoc(productRef, {
              stock_qty: increment(-item.qty)
            });
          } catch (error) {
            console.error("Failed to update stock for item", item.id, error);
          }
        }));
      } catch (err) {
        console.error("Firestore sale write error:", err);
        Alert.alert("Error", "Failed to complete sale. Please try again.");
        return; // Don't proceed to success screen
      }
    }

    setShowCheckout(false);
    if (sendInvoice) {
      setShowReceipt(true);
    } else {
      Alert.alert('Payment Successful', `Sale completed successfully.\nBill No: ${activeBillNo}`);
      clearCart();
      setCustName('');
      setCustPhone('');
      setCustGstin('');
    }
  };

  const handleResetCheckout = () => {
    setShowReceipt(false);
    clearCart();
    setCustName('');
    setCustPhone('');
    setCustGstin('');
  };

  const handlePrintPdf = async () => {
    try {
      const itemsRows = cart.map(item => `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${item.name}</td>
          <td style="text-align: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${item.qty}</td>
          <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">₹${item.price.toFixed(2)}</td>
          <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">₹${(item.price * item.qty).toFixed(2)}</td>
        </tr>
      `).join('');

      const gstRows = isGstRegistered ? `
        <div class="total-row"><span>CGST:</span> <span>₹${gstBreakdown.cgst.toFixed(2)}</span></div>
        <div class="total-row"><span>SGST:</span> <span>₹${gstBreakdown.sgst.toFixed(2)}</span></div>
      ` : '';

      const htmlString = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invoice ${activeBillNo}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #334155; background-color: #f8fafc; margin: 0; }
              .receipt-box { max-width: 450px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
              .header { text-align: center; margin-bottom: 24px; }
              .store-name { font-size: 24px; font-weight: 800; margin: 0; color: #0f172a; letter-spacing: -0.5px; }
              .store-subtitle { font-size: 13px; color: #64748b; margin: 4px 0 0 0; }
              .gstin { font-size: 11px; color: #94a3b8; font-weight: 600; margin-top: 6px; }
              .invoice-details { margin: 20px 0; border-top: 1px dashed #e2e8f0; border-bottom: 1px dashed #e2e8f0; padding: 12px 0; font-size: 13px; color: #475569; }
              .details-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
              .items-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
              .items-table th { border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; }
              .totals-section { margin-top: 24px; border-top: 2px solid #f1f5f9; padding-top: 12px; font-size: 13px; color: #475569; }
              .total-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
              .grand-total { font-size: 18px; font-weight: 800; color: #0f172a; border-top: 1px dashed #e2e8f0; padding-top: 10px; margin-top: 10px; }
              .footer { text-align: center; margin-top: 32px; font-size: 11px; color: #94a3b8; font-weight: 500; }
              @media print {
                body { padding: 0; background-color: #ffffff; }
                .receipt-box { border: none; box-shadow: none; padding: 0; max-width: 100%; }
              }
            </style>
          </head>
          <body>
            <div class="receipt-box">
              <div class="header">
                <h1 class="store-name">${storeName}</h1>
                <p class="store-subtitle">${storeAddress || 'BharatPOS Merchant Store'}</p>
                ${isGstRegistered && gstNum ? `<div class="gstin">GSTIN: ${gstNum}</div>` : ''}
              </div>
              <div class="invoice-details">
                <div class="details-row"><span>Invoice No:</span> <strong>${activeBillNo}</strong></div>
                <div class="details-row"><span>Date:</span> <span>${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span></div>
                <div class="details-row"><span>Customer Name:</span> <span>${custName || 'Walk-in Customer'}</span></div>
                ${custPhone ? `<div class="details-row"><span>Mobile No:</span> <span>+91 ${custPhone}</span></div>` : ''}
                ${custGstin ? `<div class="details-row"><span>Customer GSTIN:</span> <span>${custGstin}</span></div>` : ''}
                <div class="details-row"><span>Payment Mode:</span> <span>${payMethod}</span></div>
              </div>
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="text-align: left; width: 45%;">Item Description</th>
                    <th style="text-align: center; width: 10%;">Qty</th>
                    <th style="text-align: right; width: 20%;">Rate</th>
                    <th style="text-align: right; width: 25%;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRows}
                </tbody>
              </table>
              <div class="totals-section">
                <div class="total-row"><span>Subtotal:</span> <span>₹${subtotal.toFixed(2)}</span></div>
                ${discount > 0 ? `<div class="total-row"><span>Discount:</span> <span>-₹${discount.toFixed(2)}</span></div>` : ''}
                ${gstRows}
                <div class="total-row grand-total"><span>GRAND TOTAL:</span> <span>₹${finalTotal.toFixed(2)}</span></div>
              </div>
              <div class="footer">
                <p>Thank you for shopping with us!</p>
                <p style="font-size: 9px; color: #cbd5e1; margin-top: 8px;">Powered by BharatPOS POS billing software</p>
              </div>
            </div>
          </body>
        </html>
      `;
      await Print.printAsync({ html: htmlString });
    } catch (e) {
      console.error(e);
      Alert.alert('Printing Error', 'Failed to generate invoice PDF.');
    }
  };

  const handleWhatsAppShare = () => {
    const itemsText = cart.map(item => `• ${item.name} x${item.qty} - ₹${(item.price * item.qty).toFixed(0)}`).join('\n');
    const message = `Thank you for shopping at *${storeName}*!\n\n*Invoice No:* ${activeBillNo}\n*Date:* ${new Date().toLocaleDateString('en-IN')}\n*Payment Mode:* ${payMethod}\n\n*Items:*\n${itemsText}\n\n*Subtotal:* ₹${subtotal.toFixed(2)}\n*Discount:* ₹${discount.toFixed(2)}\n${isGstRegistered ? `*GST:* ₹${gstBreakdown.totalGst.toFixed(2)}\n` : ''}*Grand Total:* *₹${finalTotal.toFixed(2)}*\n\nWe look forward to serving you again!`;
    
    let url = '';
    if (custPhone) {
      const cleanPhone = custPhone.replace(/[^0-9]/g, '');
      url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    }

    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Make sure WhatsApp is installed on your device to share invoices.');
    });
  };

  const handlePrint = () => {
    if (cart.length === 0) return;
    Alert.alert('Thermal Printer', 'Bill sent to local thermal printer.');
  };

  const handleSave = () => {
    if (cart.length === 0) return;
    Alert.alert('Bill Saved', 'Bill saved as draft. You can resume later.');
  };

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <View style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <FadeIn>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconBox}>
              <Icon name="cash-register" size={20} color="#10B981" />
            </View>
            <View>
              <Text style={styles.headerTitle}>POS Billing</Text>
              <Text style={styles.headerSubtitle}>{storeName} · {isGstRegistered ? 'GST Registered' : 'Non-GST Mode'}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Chip icon="receipt" mode="outlined" textStyle={styles.chipText} style={styles.chip}>
              Active Session
            </Chip>
            <Chip icon="cart" mode="flat" textStyle={[styles.chipText, { color: appTheme.colors.onSurface }]} style={[styles.chip, { backgroundColor: appTheme.colors.surface }]}>
              {totalItems} items
            </Chip>
          </View>
        </View>
      </FadeIn>

      <View style={styles.contentRow}>
        {/* ── Left Pane: Search + Cart ────────────────────────── */}
        <FadeIn delay={100} style={{ flex: 2 }}>
          <View style={styles.leftPane}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <View style={styles.searchIconBox}>
                <Icon name="barcode-scan" size={20} color="#10B981" />
              </View>
              <TextInput
                mode="flat"
                placeholder="Scan barcode or type product name..."
                value={search}
                onChangeText={(text: any) => { 
                  const cleaned = text.replace(/[\r\n]/g, '');
                  setSearch(cleaned); 
                  setShowSuggestions(true); 
                  if (text.includes('\n') || text.includes('\r')) {
                    handleSearchSubmitWithText(cleaned);
                  }
                }}
                onSubmitEditing={handleSearchSubmit}
                onFocus={() => setShowSuggestions(true)}
                style={styles.searchInput}
                underlineColor="transparent"
                activeUnderlineColor="#10B981"
                placeholderTextColor="#aaa"
                left={<TextInput.Icon icon="magnify" color="#999" />}
                right={search ? <TextInput.Icon icon="close" color="#999" onPress={() => { setSearch(''); setShowSuggestions(false); }} /> : undefined}
              />
            </View>

            {/* Search Suggestions Dropdown */}
            {showSuggestions && filteredProducts.length > 0 && (
              <Surface style={styles.suggestionsDropdown} elevation={3}>
                <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
                  {filteredProducts.map((product) => (
                    <TouchableOpacity
                      key={product.id}
                      style={styles.suggestionItem}
                      onPress={() => handleAddProduct(product)}
                      activeOpacity={0.6}
                    >
                      <View style={[styles.suggestionCategoryDot, { backgroundColor: categoryColors[cleanAndMapCategory(product.category || '').cleanName] || '#666' }]} />
                      <View style={styles.suggestionInfo}>
                        <Text style={styles.suggestionName}>{product.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Icon name={cleanAndMapCategory(product.category || '').icon} size={12} color="#64748B" style={{ marginRight: 4 }} />
                          <Text style={styles.suggestionMeta} numberOfLines={1}>
                            {cleanAndMapCategory(product.category || '').cleanName} {isGstRegistered ? `· HSN: ${product.hsn} · GST: ${product.gst_pct}%` : ''} · Qty: {getProductStock(product.id)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.suggestionPrice}>₹{product.price}</Text>
                      <View style={styles.addIconCircle}>
                        <Icon name="plus" size={16} color="#10B981" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Surface>
            )}

            {/* Cart Header */}
            <View style={styles.cartHeader}>
              <Text style={styles.cartHeaderTitle}>Cart Items</Text>
              {cart.length > 0 && (
                <Text style={styles.cartItemCount}>{cart.length} product{cart.length !== 1 ? 's' : ''} · {totalItems} unit{totalItems !== 1 ? 's' : ''}</Text>
              )}
            </View>

            {/* Column Headers */}
            {cart.length > 0 && (
              <View style={styles.columnHeaders}>
                <Text style={[styles.colHeader, { flex: 2.5 }]}>PRODUCT</Text>
                <Text style={[styles.colHeader, { flex: 0.8, textAlign: 'center' }]}>PRICE</Text>
                <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>QTY</Text>
                {isGstRegistered && <Text style={[styles.colHeader, { flex: 0.6, textAlign: 'center' }]}>GST</Text>}
                <Text style={[styles.colHeader, { flex: 1, textAlign: 'right' }]}>TOTAL</Text>
                <View style={{ width: 36 }} />
              </View>
            )}

            {/* Cart Items */}
            <ScrollView style={styles.cartList} showsVerticalScrollIndicator={false}>
              {cart.map((item, idx) => {
                const itemGst = isGstRegistered ? ((item.price * item.qty) * ((item.gst_pct || 0) / 100)) : 0;
                const itemTotal = (item.price * item.qty) + itemGst;
                return (
                  <View key={item.id} style={[styles.cartItem, idx % 2 === 0 && { backgroundColor: appTheme.colors.surface }]}>
                    {/* Product */}
                    <View style={{ flex: 2.5 }}>
                      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.itemSku}>SKU: {item.id.toUpperCase()}</Text>
                    </View>

                    {/* Price */}
                    <Text style={[styles.itemPrice, { flex: 0.8, textAlign: 'center' }]}>₹{item.price}</Text>

                    {/* Qty Controls */}
                    <View style={[styles.qtyController, { flex: 1, justifyContent: 'center' }]}>
                      <TouchableOpacity
                        onPress={() => updateQty(item.id, -1)}
                        style={styles.qtyBtn}
                        activeOpacity={0.6}
                      >
                        <Icon name="minus" size={14} color="#10B981" />
                      </TouchableOpacity>
                      <View style={styles.qtyDisplay}>
                        <Text style={styles.qtyText}>{item.qty}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => updateQty(item.id, 1)}
                        style={[styles.qtyBtn, styles.qtyBtnPlus]}
                        activeOpacity={0.6}
                      >
                        <Icon name="plus" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>

                    {/* GST */}
                    {isGstRegistered && <Text style={[styles.itemGst, { flex: 0.6, textAlign: 'center' }]}>{item.gst_pct || 0}%</Text>}

                    {/* Total */}
                    <Text style={[styles.itemTotal, { flex: 1, textAlign: 'right' }]}>₹{itemTotal.toFixed(0)}</Text>

                    {/* Delete */}
                    <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.deleteBtn} activeOpacity={0.6}>
                      <Icon name="trash-can-outline" size={16} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {cart.length === 0 && (
                <View style={styles.emptyCartContainer}>
                  <Icon name="cart-off" size={56} color="#D0D0D0" />
                  <Text style={styles.emptyCartTitle}>Cart is empty</Text>
                  <Text style={styles.emptyCartSubtitle}>Scan a barcode or search products to begin billing</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </FadeIn>

        {/* ── Right Pane: Summary + Actions ─────────────────────── */}
        <FadeIn delay={200} style={{ flex: 1 }}>
          <View style={styles.rightPane}>
            {/* Payment Summary Card */}
            <Surface style={styles.summaryCard} elevation={0}>
              <View style={styles.summaryHeader}>
                <Icon name="receipt" size={20} color="#10B981" />
                <Text style={styles.summaryTitle}>Payment Summary</Text>
              </View>

              <Divider style={styles.summaryDivider} />

              {/* Subtotal */}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>₹{subtotal.toFixed(2)}</Text>
              </View>

              {/* Discount */}
              <View style={styles.summaryRow}>
                <View style={styles.labelWithBadge}>
                  <Text style={styles.summaryLabel}>Discount</Text>
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>5%</Text>
                  </View>
                </View>
                <Text style={[styles.summaryValue, { color: appTheme.colors.onSurface }]}>- ₹{discount.toFixed(2)}</Text>
              </View>

              {isGstRegistered && (
                <>
                  <Divider style={styles.summaryDividerLight} />

                  {/* GST Breakdown Header */}
                  <View style={styles.gstHeader}>
                    <Icon name="bank" size={14} color="#888" />
                    <Text style={styles.gstHeaderText}>GST Breakdown</Text>
                  </View>

                  {/* CGST */}
                  <View style={styles.summaryRow}>
                    <Text style={styles.gstLabel}>CGST</Text>
                    <Text style={styles.gstValue}>₹{gstBreakdown.cgst.toFixed(2)}</Text>
                  </View>

                  {/* SGST */}
                  <View style={styles.summaryRow}>
                    <Text style={styles.gstLabel}>SGST</Text>
                    <Text style={styles.gstValue}>₹{gstBreakdown.sgst.toFixed(2)}</Text>
                  </View>

                  {/* Total GST */}
                  <View style={styles.summaryRow}>
                    <Text style={[styles.gstLabel, { fontWeight: '700' }]}>Total GST</Text>
                    <Text style={[styles.gstValue, { fontWeight: '700', color: appTheme.colors.onSurface }]}>₹{gstBreakdown.totalGst.toFixed(2)}</Text>
                  </View>
                </>
              )}

              <Divider style={styles.summaryDivider} />

              {/* Grand Total */}
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>Grand Total</Text>
                <Text style={styles.grandTotalValue}>₹{finalTotal.toFixed(2)}</Text>
              </View>

              {/* Savings Callout */}
              {discount > 0 && (
                <View style={styles.savingsCallout}>
                  <Icon name="tag-heart" size={14} color="#10B981" />
                  <Text style={styles.savingsText}>You save ₹{discount.toFixed(2)} on this order!</Text>
                </View>
              )}

              <Divider style={styles.summaryDividerLight} />

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.holdBtn} onPress={() => Alert.alert('Held', 'Bill put on hold.')} activeOpacity={0.7}>
                  <Icon name="pause-circle-outline" size={18} color="#10B981" />
                  <Text style={styles.holdBtnText}>Hold</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.clearBtn} onPress={clearCart} activeOpacity={0.7}>
                  <Icon name="delete-outline" size={18} color="#EF4444" />
                  <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
              </View>

              {/* Pay Button */}
              <TouchableOpacity
                style={[styles.payBtn, cart.length === 0 && styles.payBtnDisabled]}
                onPress={handlePay}
                disabled={cart.length === 0}
                activeOpacity={0.8}
              >
                <Icon name="credit-card-check-outline" size={22} color="#fff" />
                <Text style={styles.payBtnText}>Pay ₹{finalTotal.toFixed(2)}</Text>
              </TouchableOpacity>

              {/* Print & Save */}
              <View style={styles.secondaryActions}>
                <TouchableOpacity
                  style={[styles.secondaryBtn, cart.length === 0 && { opacity: 0.4 }]}
                  onPress={handlePrint}
                  disabled={cart.length === 0}
                  activeOpacity={0.7}
                >
                  <Icon name="printer" size={18} color="#10B981" />
                  <Text style={styles.secondaryBtnText}>Print Bill</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryBtn, cart.length === 0 && { opacity: 0.4 }]}
                  onPress={handleSave}
                  disabled={cart.length === 0}
                  activeOpacity={0.7}
                >
                  <Icon name="content-save-outline" size={18} color="#10B981" />
                  <Text style={[styles.secondaryBtnText, { color: appTheme.colors.onSurface }]}>Save Bill</Text>
                </TouchableOpacity>
              </View>
            </Surface>

            {/* Quick Add Products */}
            <Surface style={styles.quickAddCard} elevation={0}>
              <Text style={styles.quickAddTitle}>Quick Add</Text>
              <View style={styles.quickAddGrid}>
                {products.slice(0, 6).map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.quickAddItem}
                    onPress={() => handleAddProduct(p)}
                    activeOpacity={0.6}
                  >
                    <View style={[styles.quickAddDot, { backgroundColor: categoryColors[cleanAndMapCategory(p.category || '').cleanName] || '#666' }]} />
                    <Text style={styles.quickAddName} numberOfLines={1}>{p.name.split(' ').slice(0, 2).join(' ')}</Text>
                    <Text style={styles.quickAddPrice}>₹{p.price}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Surface>
          </View>
        </FadeIn>
      </View>

      {/* ── 1. CHECKOUT PAYMENT DETAILS DIALOG ──────────────── */}
      <Portal>
        <Dialog visible={showCheckout} onDismiss={() => setShowCheckout(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>
            <Icon name="credit-card-plus-outline" size={22} color="#10B981" style={{ marginRight: 8 }} />
            Checkout Payment Details
          </Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogLabel}>Payment Method</Text>
            <SegmentedButtons
              value={payMethod}
              onValueChange={setPayMethod}
              buttons={[
                { value: 'Cash', label: 'Cash Payment' },
                { value: 'UPI', label: 'UPI / Scan QR' },
                { value: 'Card', label: 'Card Swipe' }
              ]}
              style={{ marginBottom: 16 }}
            />

            <Text style={styles.dialogLabel}>Customer Details (Optional)</Text>
            <TextInput
              label="Customer Mobile Number"
              value={custPhone}
              onChangeText={setCustPhone}
              keyboardType="phone-pad"
              mode="outlined"
              outlineColor="#EEF0F6"
              activeOutlineColor="#10B981"
              style={{ marginBottom: 12 }}
              left={<TextInput.Icon icon="phone" color="#999" />}
            />
            <TextInput
              label="Customer Name"
              value={custName}
              onChangeText={setCustName}
              mode="outlined"
              outlineColor="#EEF0F6"
              activeOutlineColor="#10B981"
              left={<TextInput.Icon icon="account" color="#999" />}
            />
            <TextInput
              label="Customer GSTIN (Optional)"
              value={custGstin}
              onChangeText={setCustGstin}
              mode="outlined"
              outlineColor="#EEF0F6"
              activeOutlineColor="#10B981"
              left={<TextInput.Icon icon="bank" color="#999" />}
              style={{ marginTop: 12 }}
            />
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => handleCompleteSale(false)}>
              Skip & Complete
            </Button>
            <Button mode="contained" onPress={() => handleCompleteSale(true)} style={{ borderRadius: 10 }}>
              Send Bill & Complete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── 2. PREMIUM RECEIPT & SHARING DIALOG ────────────── */}
      <Portal>
        <Dialog visible={showReceipt} onDismiss={handleResetCheckout} style={[styles.dialog, { maxWidth: 500, alignSelf: 'center', width: '90%' }]}>
          <Dialog.Title style={[styles.dialogTitle, { color: appTheme.colors.onSurface }]}>
            <Icon name="check-circle-outline" size={24} color="#10B981" style={{ marginRight: 8 }} />
            Invoice Shared Successfully
          </Dialog.Title>
          <Dialog.Content>
            {/* Live Bill Receipt Preview */}
            <ScrollView style={styles.receiptPreview} showsVerticalScrollIndicator={false}>
              <View style={styles.receiptHeader}>
                <Text style={styles.receiptStoreName}>{storeName}</Text>
                <Text style={styles.receiptStoreMeta}>GSTIN: {isGstRegistered ? gstNum : 'None'}</Text>
                <Text style={styles.receiptStoreMeta}>Date: {new Date().toLocaleDateString('en-IN')}</Text>
                <Text style={styles.receiptStoreMeta}>Bill No: {activeBillNo}</Text>
                <Text style={styles.receiptStoreMeta}>Payment: {payMethod}</Text>
              </View>

              {custPhone ? (
                <View style={styles.receiptCustomerBox}>
                  <Text style={styles.receiptCustomerText}>Billed To: {custName || 'Walk-in Customer'}</Text>
                  <Text style={styles.receiptCustomerText}>Phone: +91 {custPhone}</Text>
                </View>
              ) : null}

              <Divider style={{ marginVertical: 10, backgroundColor: appTheme.colors.surface }} />

              {cart.map((item) => (
                <View key={item.id} style={styles.receiptItemRow}>
                  <Text style={styles.receiptItemName} numberOfLines={1}>{item.name} x{item.qty}</Text>
                  <Text style={styles.receiptItemTotal}>₹{(item.price * item.qty).toFixed(0)}</Text>
                </View>
              ))}

              <Divider style={{ marginVertical: 10, backgroundColor: appTheme.colors.surface }} />

              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Subtotal</Text>
                <Text style={styles.receiptValue}>₹{subtotal.toFixed(2)}</Text>
              </View>
              {isGstRegistered && (
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>GST Tax</Text>
                  <Text style={styles.receiptValue}>₹{gstBreakdown.totalGst.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { fontWeight: 'bold' }]}>Grand Total</Text>
                <Text style={[styles.receiptValue, { fontWeight: 'bold', fontSize: 16 }]}>₹{finalTotal.toFixed(2)}</Text>
              </View>

              <View style={styles.receiptFooter}>
                <Text style={styles.receiptFooterText}>Thank you for shopping!</Text>
                {custPhone ? (
                  <View style={styles.smsAlertBox}>
                    <Icon name="message-text-outline" size={14} color="#1565C0" />
                    <Text style={styles.smsAlertText}>SMS receipt link sent to +91 {custPhone}</Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            {/* Dispatched Message Preview Box */}
            <View style={{ backgroundColor: appTheme.colors.surface, padding: 12, borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#10B981', marginVertical: 8 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: appTheme.colors.onSurface, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Dispatched Message Preview</Text>
              <Text style={{ fontSize: 12, color: appTheme.colors.onSurface, lineHeight: 17, fontStyle: 'italic' }}>
                "Thank you for shopping at {storeName}.{"\n"}
                Invoice Amount: ₹{finalTotal.toFixed(0)}{"\n"}
                Download Bill: secure-link.com/invoice/{activeBillNo.replace('INV-', '')}"
              </Text>
            </View>

            {/* Sharing Options row */}
            <View style={styles.sharingGrid}>
              <TouchableOpacity
                style={styles.shareOption}
                onPress={handleWhatsAppShare}
              >
                <View style={[styles.shareIcon, { backgroundColor: appTheme.colors.surface }]}>
                  <Icon name="whatsapp" size={24} color="#4CAF50" />
                </View>
                <Text style={styles.shareText}>WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareOption}
                onPress={() => Alert.alert(
                  'SMS Shared',
                  `SMS Bill link dispatched to customer:\n\nThank you for shopping at ${storeName}.\nInvoice Amount: ₹${finalTotal.toFixed(0)}\nDownload Bill: secure-link.com/invoice/${activeBillNo.replace('INV-', '')}`
                )}
              >
                <View style={[styles.shareIcon, { backgroundColor: appTheme.colors.surface }]}>
                  <Icon name="message-text" size={24} color="#10B981" />
                </View>
                <Text style={styles.shareText}>Send SMS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareOption}
                onPress={handlePrintPdf}
              >
                <View style={[styles.shareIcon, { backgroundColor: appTheme.colors.surface }]}>
                  <Icon name="file-pdf-box" size={24} color="#D81B60" />
                </View>
                <Text style={styles.shareText}>PDF Invoice</Text>
              </TouchableOpacity>
            </View>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button mode="contained" onPress={handleResetCheckout} style={{ borderRadius: 10, flex: 1 }}>
              Start New Bill
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerIconBox: {
    width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', },
  headerSubtitle: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  headerRight: { flexDirection: 'row', gap: 8 },
  chip: { },
  chipText: { fontSize: 12, fontWeight: '600', },

  // Content
  contentRow: { flexDirection: 'row', gap: 24, flex: 1 },

  // Left Pane
  leftPane: { flex: 2, borderRadius: 16, padding: 20, borderWidth: 1, },

  // Search
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  searchIconBox: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  searchInput: { flex: 1, height: 46, borderRadius: 10, fontSize: 14 },

  // Suggestions
  suggestionsDropdown: {
    position: 'absolute', top: 86, left: 20, right: 20, zIndex: 50,
    borderRadius: 12, borderWidth: 1, overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F8F9FC',
  },
  suggestionCategoryDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  suggestionInfo: { flex: 1 },
  suggestionName: { fontSize: 14, fontWeight: '600', },
  suggestionMeta: { fontSize: 11, marginTop: 2 },
  suggestionPrice: { fontSize: 15, fontWeight: '700', marginRight: 12 },
  addIconCircle: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
  },

  // Cart Header
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 12 },
  cartHeaderTitle: { fontSize: 16, fontWeight: '700', },
  cartItemCount: { fontSize: 12, },

  // Column Headers
  columnHeaders: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginBottom: 8 },
  colHeader: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  // Cart List
  cartList: { flex: 1 },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, marginBottom: 4 },
  itemName: { fontSize: 13, fontWeight: '700', },
  itemSku: { fontSize: 10, marginTop: 2 },
  itemPrice: { fontSize: 13, fontWeight: '500' },
  itemGst: { fontSize: 12, },
  itemTotal: { fontSize: 13, fontWeight: '700', },
  deleteBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },

  // Qty Controls
  qtyController: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center', },
  qtyBtnPlus: { },
  qtyDisplay: { minWidth: 20, alignItems: 'center' },
  qtyText: { fontSize: 12, fontWeight: '700', },

  emptyCartContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyCartTitle: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptyCartSubtitle: { fontSize: 12, marginTop: 4, textAlign: 'center', maxWidth: 280 },

  // Right Pane
  rightPane: { flex: 1, gap: 20 },
  summaryCard: { borderRadius: 16, padding: 20, borderWidth: 1, },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryTitle: { fontSize: 16, fontWeight: '700', },
  summaryDivider: { marginVertical: 16 },
  summaryDividerLight: { marginVertical: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  summaryLabel: { fontSize: 13, },
  summaryValue: { fontSize: 14, fontWeight: '700', },

  labelWithBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  discountBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  discountBadgeText: { fontSize: 10, fontWeight: '700', },

  // GST Breakdown
  gstHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 6 },
  gstHeaderText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  gstLabel: { fontSize: 12, },
  gstValue: { fontSize: 12, },

  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grandTotalLabel: { fontSize: 15, fontWeight: '800', },
  grandTotalValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },

  savingsCallout: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10, marginTop: 12 },
  savingsText: { fontSize: 12, fontWeight: '700' },

  // Action Buttons
  actionButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  holdBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 10, borderWidth: 1, },
  holdBtnText: { fontSize: 13, fontWeight: '700', },
  clearBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 10, borderWidth: 1, },
  clearBtnText: { fontSize: 13, fontWeight: '700', },

  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 10, marginTop: 12 },
  payBtnDisabled: { opacity: 0.7 },
  payBtnText: { fontSize: 15, fontWeight: '800', },

  secondaryActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38, borderRadius: 8, },
  secondaryBtnText: { fontSize: 12, fontWeight: '700', },

  // Quick Add
  quickAddCard: { borderRadius: 16, padding: 16, borderWidth: 1, },
  quickAddTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  quickAddGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickAddItem: { flexGrow: 1, flexBasis: '28%', padding: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  quickAddDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 6 },
  quickAddName: { fontSize: 11, fontWeight: '600', },
  quickAddPrice: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  // Dialog Modals
  dialog: { borderRadius: 20, backgroundColor: 'white' },
  dialogTitle: { fontSize: 18, fontWeight: '800', flexDirection: 'row', alignItems: 'center' },
  dialogLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  dialogActions: { paddingHorizontal: 16, paddingBottom: 16, justifyContent: 'space-between' },

  // Receipt Preview
  receiptPreview: {
    borderWidth: 1, borderStyle: 'dashed', borderRadius: 12,
    padding: 16, maxHeight: 300, marginBottom: 16
  },
  receiptHeader: { alignItems: 'center', marginBottom: 12 },
  receiptStoreName: { fontSize: 16, fontWeight: '800', },
  receiptStoreMeta: { fontSize: 11, marginTop: 2 },
  receiptCustomerBox: { marginTop: 8, padding: 8, borderRadius: 8 },
  receiptCustomerText: { fontSize: 11, fontWeight: '600' },
  receiptItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  receiptItemName: { fontSize: 12, flex: 1 },
  receiptItemTotal: { fontSize: 12, fontWeight: '700' },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  receiptLabel: { fontSize: 11, },
  receiptValue: { fontSize: 11, },
  receiptFooter: { alignItems: 'center', marginTop: 14 },
  receiptFooterText: { fontSize: 11, fontWeight: '700', },
  smsAlertBox: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  smsAlertText: { fontSize: 10, fontWeight: '700' },

  // Sharing Option row
  sharingGrid: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 8 },
  shareOption: { alignItems: 'center' },
  shareIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  shareText: { fontSize: 11, fontWeight: '600', }
});
