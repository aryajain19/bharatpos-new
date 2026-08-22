import { useAppTheme } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated, TextInput as RNTextInput, Platform, Linking, Modal } from 'react-native';
import { Text, Button, Divider, Surface, Chip, Portal, Dialog, SegmentedButtons, TextInput, useTheme, IconButton } from 'react-native-paper';
import { CameraView, Camera } from 'expo-camera';
import * as Print from 'expo-print';
import { useCart } from '../../providers/CartProvider';
import { db, isFirebaseConfigured, auth } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, increment } from '../../lib/firestore_adapter';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { cleanAndMapCategory } from '../../lib/ui_helpers';
import { useLocalSearchParams, router } from 'expo-router';
import { DS } from '../../constants/designTokens';
import POSAssistantModal from '../../components/POSAssistantModal';

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
  const { tenantId, loading: authLoading } = useAuth();

  const { cart, addToCart, removeFromCart, updateQty, getSubtotal, clearCart } = useCart();
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<RNTextInput>(null);
  
  const [products, setProducts] = useState<any[]>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const cached = window.localStorage.getItem('cachedProductsList');
        if (cached) return JSON.parse(cached);
      } catch (_) {}
    }
    return [];
  });
  // Weighing Scale Calculator States
  const [weighProduct, setWeighProduct] = useState<any>(null);
  const [weighWeight, setWeighWeight] = useState('1000');
  const [showWeighModal, setShowWeighModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [savedBillData, setSavedBillData] = useState<any>(null);
  const [savedDraftList, setSavedDraftList] = useState<any[]>([]);
  const [showAssistantModal, setShowAssistantModal] = useState(false);

  // Discount Modal States
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [discountInput, setDiscountInput] = useState('');

  // Phone Prompt Modal States
  const [showPhonePromptModal, setShowPhonePromptModal] = useState(false);
  const [phonePromptTarget, setPhonePromptTarget] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [phonePromptInput, setPhonePromptInput] = useState('');
  const [phonePromptBill, setPhonePromptBill] = useState<any>(null);

  // SMS Info Modal
  const [showSmsInfoModal, setShowSmsInfoModal] = useState(false);
  const [smsSentText, setSmsSentText] = useState('');
  const [smsSentPhone, setSmsSentPhone] = useState('');
  
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraScanned, setCameraScanned] = useState(false);

  const handleOpenScanner = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasCameraPermission(status === 'granted');
    if (status === 'granted') {
      setShowCameraScanner(true);
      setCameraScanned(false);
    } else {
      Alert.alert('Permission Denied', 'Camera permission is required to scan barcodes.');
    }
  };
  
  const params = useLocalSearchParams();
  const scanBarcodeParam = params.scanBarcode;
  
  useEffect(() => {
    if (!authLoading && tenantId) {
      fetchProducts();
    }
  }, [authLoading, tenantId]);

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
        if (!tenantId) return;
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
            stock_qty: p.stock_qty !== undefined ? p.stock_qty : (p.stock || 0),
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

  const [discount, setDiscount] = useState(0);
  const finalTotal = isGstRegistered
    ? Math.max(0, subtotal - discount + gstBreakdown.totalGst)
    : Math.max(0, subtotal - discount);

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

      if (!tenantId) return;
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
      if (!tenantId) {
        Alert.alert('Error', 'Tenant ID is missing. Please log in again.');
        return;
      }
      try {
        await addDoc(collection(db, 'sales'), {
          tenant_id: tenantId,
          vendor_id: auth.currentUser?.uid || 'owner',
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

        // Webhook Trigger
        const savedWebhookUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.localStorage.getItem('webhookUrl') : '';
        if (savedWebhookUrl) {
          fetch(savedWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'sale_completed',
              tenant_id: tenantId,
              bill_no: activeBillNo,
              total_amount: finalTotal,
              payment_method: payMethod,
              timestamp: dateObj.toISOString(),
              items: cart.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                qty: item.qty
              }))
            })
          }).catch(err => console.warn("Webhook delivery failed:", err));
        }

        // Low Stock Alert
        const checkLowStockSetting = Platform.OS === 'web' && typeof window !== 'undefined' ? window.localStorage.getItem('lowStockEmailNotif') !== 'false' : true;
        if (checkLowStockSetting) {
          const lowStockItems = cart.filter(item => {
            const currentProduct = products.find(p => p.id === item.id);
            if (currentProduct) {
              const remainingStock = currentProduct.stock_qty - item.qty;
              return remainingStock < 5;
            }
            return false;
          });
          if (lowStockItems.length > 0) {
            const itemNames = lowStockItems.map(item => `${item.name} (drops below 5)`).join(', ');
            setTimeout(() => {
              Alert.alert('Low Stock Automation Alert', `Stock is running low for: ${itemNames}. Reorder suggested.`);
            }, 800);
          }
        }
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

  const loadDrafts = () => {
    if (typeof window !== 'undefined') {
      try {
        const key = `saved_draft_bills_${tenantId || 'default'}`;
        const stored = window.localStorage.getItem(key);
        if (stored) {
          setSavedDraftList(JSON.parse(stored));
        } else {
          setSavedDraftList([]);
        }
      } catch (e) {
        setSavedDraftList([]);
      }
    }
  };

  useEffect(() => {
    loadDrafts();
  }, [tenantId]);

  const handlePrintPdf = async (customBill?: any) => {
    const items = customBill ? customBill.items : cart;
    const bNo = customBill ? customBill.billNo : activeBillNo;
    const bSubtotal = customBill ? customBill.subtotal : subtotal;
    const bDiscount = customBill ? customBill.discount : discount;
    const bFinalTotal = customBill ? customBill.finalTotal : finalTotal;
    const bCustName = customBill ? customBill.custName : custName;
    const bCustPhone = customBill ? customBill.custPhone : custPhone;
    const bCustGstin = customBill ? customBill.custGstin : custGstin;
    const bPayMethod = customBill ? customBill.payMethod : payMethod;

    if (!items || items.length === 0) {
      Alert.alert('Empty Cart', 'Please add products to the cart before printing.');
      return;
    }

    try {
      const itemsRows = items.map((item: any) => `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${item.name}</td>
          <td style="text-align: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">${item.qty}</td>
          <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">₹${Number(item.price).toFixed(2)}</td>
          <td style="text-align: right; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">₹${(Number(item.price) * Number(item.qty)).toFixed(2)}</td>
        </tr>
      `).join('');

      const gstRows = isGstRegistered ? `
        <div class="total-row"><span>CGST:</span> <span>₹${(Number(bFinalTotal) * 0.025).toFixed(2)}</span></div>
        <div class="total-row"><span>SGST:</span> <span>₹${(Number(bFinalTotal) * 0.025).toFixed(2)}</span></div>
      ` : '';

      const htmlString = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invoice ${bNo}</title>
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
                <div class="details-row"><span>Invoice No:</span> <strong>${bNo}</strong></div>
                <div class="details-row"><span>Date:</span> <span>${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span></div>
                <div class="details-row"><span>Customer Name:</span> <span>${bCustName || 'Walk-in Customer'}</span></div>
                ${bCustPhone ? `<div class="details-row"><span>Mobile No:</span> <span>+91 ${bCustPhone}</span></div>` : ''}
                ${bCustGstin ? `<div class="details-row"><span>Customer GSTIN:</span> <span>${bCustGstin}</span></div>` : ''}
                <div class="details-row"><span>Payment Mode:</span> <span>${bPayMethod || 'Cash'}</span></div>
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
                <div class="total-row"><span>Subtotal:</span> <span>₹${Number(bSubtotal).toFixed(2)}</span></div>
                ${Number(bDiscount) > 0 ? `<div class="total-row"><span>Discount:</span> <span>-₹${Number(bDiscount).toFixed(2)}</span></div>` : ''}
                ${gstRows}
                <div class="total-row grand-total"><span>GRAND TOTAL:</span> <span>₹${Number(bFinalTotal).toFixed(2)}</span></div>
              </div>
              <div class="footer">
                <p>Thank you for shopping with us!</p>
                <p style="font-size: 9px; color: #cbd5e1; margin-top: 8px;">Powered by BharatPOS</p>
              </div>
            </div>
          </body>
        </html>
      `;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlString);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 300);
          return;
        }
      }

      await Print.printAsync({ html: htmlString });
    } catch (e) {
      console.error(e);
      Alert.alert('Printing Error', 'Failed to generate invoice PDF.');
    }
  };

  const buildInvoiceUrl = (bill: any) => {
    const payload = {
      storeName: bill.storeName || storeName,
      storeAddress: bill.storeAddress || storeAddress,
      gstNum: bill.gstNum || gstNum,
      isGst: bill.isGst !== undefined ? bill.isGst : isGstRegistered,
      billNo: bill.billNo || activeBillNo,
      date: bill.date || new Date().toLocaleDateString('en-IN'),
      time: bill.time || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      payMethod: bill.payMethod || payMethod,
      custName: bill.custName || custName,
      custPhone: bill.custPhone || custPhone,
      custGstin: bill.custGstin || custGstin,
      items: (bill.items || cart).map((i: any) => ({ name: i.name, qty: i.qty, price: i.price })),
      subtotal: bill.subtotal !== undefined ? bill.subtotal : subtotal,
      discount: bill.discount !== undefined ? bill.discount : discount,
      finalTotal: bill.finalTotal !== undefined ? bill.finalTotal : finalTotal,
    };
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://bharatpos-new.vercel.app';
    return `${base}/invoice?id=${payload.billNo}&data=${encodeURIComponent(JSON.stringify(payload))}`;
  };

  const handleWhatsAppShare = (customBill?: any) => {
    const items = customBill ? customBill.items : cart;
    const bNo = customBill ? customBill.billNo : activeBillNo;
    const bSubtotal = customBill ? customBill.subtotal : subtotal;
    const bDiscount = customBill ? customBill.discount : discount;
    const bFinalTotal = customBill ? customBill.finalTotal : finalTotal;
    const bPhone = customBill ? customBill.custPhone : custPhone;
    const bPayMethod = customBill ? customBill.payMethod : payMethod;
    const bCustName = customBill ? customBill.custName : custName;
    const bCustGstin = customBill ? customBill.custGstin : custGstin;

    if (!items || items.length === 0) {
      Alert.alert('Empty Cart', 'Please add items before sharing via WhatsApp.');
      return;
    }

    if (!bPhone || !bPhone.trim()) {
      setPhonePromptBill(customBill || null);
      setPhonePromptTarget('whatsapp');
      setPhonePromptInput('');
      setShowPhonePromptModal(true);
      return;
    }

    const itemsText = items.map((item: any) => `• ${item.name} x${item.qty} - ₹${(item.price * item.qty).toFixed(0)}`).join('\n');
    const invoiceUrl = buildInvoiceUrl({
      billNo: bNo,
      items,
      subtotal: Number(bSubtotal),
      discount: Number(bDiscount),
      finalTotal: Number(bFinalTotal),
      custName: bCustName,
      custPhone: bPhone,
      custGstin: bCustGstin,
      payMethod: bPayMethod,
    });

    const message = `🧾 *TAX INVOICE — ${storeName}*\n━━━━━━━━━━━━━━━━━━━━\n*Invoice No:* ${bNo}\n*Date:* ${new Date().toLocaleDateString('en-IN')}\n*Payment Mode:* ${bPayMethod || 'Cash'}\n\n*Items Purchased:*\n${itemsText}\n\n*Subtotal:* ₹${Number(bSubtotal).toFixed(2)}\n${Number(bDiscount) > 0 ? `*Discount Savings:* -₹${Number(bDiscount).toFixed(2)}\n` : ''}*Grand Total:* *₹${Number(bFinalTotal).toFixed(2)}*\n\n📄 *Download / View Official PDF Invoice:*\n${invoiceUrl}\n\n🙏 Thank you for shopping with us!`;
    
    const cleanPhone = bPhone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Make sure WhatsApp is installed on your device to share invoices.');
      });
    }
  };

  const handleSmsShare = (customBill?: any) => {
    const items = customBill ? customBill.items : cart;
    const bNo = customBill ? customBill.billNo : activeBillNo;
    const bSubtotal = customBill ? customBill.subtotal : subtotal;
    const bDiscount = customBill ? customBill.discount : discount;
    const bFinalTotal = customBill ? customBill.finalTotal : finalTotal;
    const bPhone = customBill ? customBill.custPhone : custPhone;
    const bCustName = customBill ? customBill.custName : custName;
    const bCustGstin = customBill ? customBill.custGstin : custGstin;
    const bPayMethod = customBill ? customBill.payMethod : payMethod;

    if (!items || items.length === 0) {
      Alert.alert('Empty Cart', 'Please add items before sending SMS.');
      return;
    }

    if (!bPhone || !bPhone.trim()) {
      setPhonePromptBill(customBill || null);
      setPhonePromptTarget('sms');
      setPhonePromptInput('');
      setShowPhonePromptModal(true);
      return;
    }

    const invoiceUrl = buildInvoiceUrl({
      billNo: bNo,
      items,
      subtotal: Number(bSubtotal),
      discount: Number(bDiscount),
      finalTotal: Number(bFinalTotal),
      custName: bCustName,
      custPhone: bPhone,
      custGstin: bCustGstin,
      payMethod: bPayMethod,
    });

    const cleanPhone = bPhone.replace(/[^0-9]/g, '');
    const smsMessage = `Thank you for shopping at ${storeName}. Your Invoice #${bNo} for ₹${Number(bFinalTotal).toFixed(2)} is ready. Download / View PDF Invoice: ${invoiceUrl}`;
    
    setSmsSentText(smsMessage);
    setSmsSentPhone(cleanPhone);
    setShowSmsInfoModal(true);

    const url = Platform.OS === 'ios' ? `sms:${cleanPhone}&body=${encodeURIComponent(smsMessage)}` : `sms:${cleanPhone}?body=${encodeURIComponent(smsMessage)}`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  const handleApplyDiscount = () => {
    const val = parseFloat(discountInput);
    if (isNaN(val) || val <= 0) {
      setDiscount(0);
      setShowDiscountModal(false);
      return;
    }
    if (discountType === 'percent') {
      const discAmt = (subtotal * val) / 100;
      setDiscount(Math.min(subtotal, Math.round(discAmt * 100) / 100));
    } else {
      setDiscount(Math.min(subtotal, val));
    }
    setShowDiscountModal(false);
  };

  const handlePrint = () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add products to the cart before printing.');
      return;
    }
    handlePrintPdf();
  };

  const handleSave = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add products to the cart before saving.');
      return;
    }

    const draft = {
      id: 'draft_' + Date.now(),
      billNo: activeBillNo,
      date: new Date().toISOString(),
      displayDate: new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      items: [...cart],
      subtotal,
      discount,
      finalTotal,
      custName,
      custPhone,
      custGstin,
      payMethod
    };

    setSavedBillData(draft);

    if (typeof window !== 'undefined') {
      try {
        const key = `saved_draft_bills_${tenantId || 'default'}`;
        const stored = window.localStorage.getItem(key);
        const list = stored ? JSON.parse(stored) : [];
        list.unshift(draft);
        window.localStorage.setItem(key, JSON.stringify(list));
        setSavedDraftList(list);
      } catch (e) {}
    }

    if (isFirebaseConfigured && tenantId) {
      try {
        await addDoc(collection(db, 'saved_drafts'), {
          ...draft,
          tenant_id: tenantId,
          created_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Firebase draft save skipped:', e);
      }
    }

    setShowSavedModal(true);
  };

  const handleHoldBill = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Add items to the cart before putting a bill on hold.');
      return;
    }

    const draft = {
      id: 'draft_' + Date.now(),
      billNo: activeBillNo,
      date: new Date().toISOString(),
      displayDate: new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      items: [...cart],
      subtotal,
      discount,
      finalTotal,
      custName,
      custPhone,
      custGstin,
      payMethod
    };

    if (typeof window !== 'undefined') {
      try {
        const key = `saved_draft_bills_${tenantId || 'default'}`;
        const stored = window.localStorage.getItem(key);
        const list = stored ? JSON.parse(stored) : [];
        list.unshift(draft);
        window.localStorage.setItem(key, JSON.stringify(list));
        setSavedDraftList(list);
      } catch (e) {}
    }

    if (isFirebaseConfigured && tenantId) {
      try {
        await addDoc(collection(db, 'saved_drafts'), {
          ...draft,
          tenant_id: tenantId,
          created_at: new Date().toISOString()
        });
      } catch (e) {}
    }

    clearCart();
    Alert.alert('Bill on Hold', `Bill #${activeBillNo} (₹${finalTotal.toFixed(2)}) has been put on hold. You can resume it anytime from 'Active Session'.`);
  };

  const handleResumeDraft = (draft: any) => {
    clearCart();
    draft.items.forEach((item: any) => {
      addToCart(item);
    });
    setDiscount(draft.discount || 0);
    setCustName(draft.custName || '');
    setCustPhone(draft.custPhone || '');
    setCustGstin(draft.custGstin || '');
    if (draft.payMethod) setPayMethod(draft.payMethod);
    setShowSessionModal(false);
    Alert.alert('Bill Resumed', `Draft bill #${draft.billNo} has been restored to your cart.`);
  };

  const handleDeleteDraft = (draftId: string) => {
    if (typeof window !== 'undefined') {
      try {
        const key = `saved_draft_bills_${tenantId || 'default'}`;
        const updated = savedDraftList.filter(d => d.id !== draftId);
        window.localStorage.setItem(key, JSON.stringify(updated));
        setSavedDraftList(updated);
      } catch (e) {}
    }
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
            <Chip
              icon="robot"
              mode="flat"
              onPress={() => setShowAssistantModal(true)}
              textStyle={[styles.chipText, { color: '#0D9488', fontWeight: '700' }]}
              style={[styles.chip, { backgroundColor: isDarkMode ? 'rgba(13, 148, 136, 0.2)' : '#CCFBF1' }]}
            >
              AI Voice Copilot 🎙️
            </Chip>
            <Chip icon="receipt" mode="outlined" onPress={() => setShowSessionModal(true)} textStyle={styles.chipText} style={styles.chip}>
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
                placeholder="Scan barcode, type, or speak to AI..."
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
                right={
                  search ? (
                    <TextInput.Icon icon="close" color="#999" onPress={() => { setSearch(''); setShowSuggestions(false); }} />
                  ) : (
                    <TextInput.Icon icon="microphone" color="#0D9488" onPress={() => setShowAssistantModal(true)} />
                  )
                }
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

        <FadeIn delay={200} style={{ flex: 1 }}>
          <View style={styles.rightPane}>
            {/* Quick Customer Info Card */}
            <Surface style={{ borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: appTheme.colors.surface, borderWidth: 1, borderColor: '#E2E8F0' }} elevation={0}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="account-details" size={18} color="#10B981" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: appTheme.colors.onSurface }}>Customer (WhatsApp / SMS)</Text>
                </View>
                {custPhone ? (
                  <Chip compact textStyle={{ fontSize: 10, color: '#10B981', fontWeight: '700' }} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', height: 22 }}>
                    Ready
                  </Chip>
                ) : null}
              </View>
              <TextInput
                placeholder="Customer Mobile (10 digits)"
                value={custPhone}
                onChangeText={setCustPhone}
                keyboardType="phone-pad"
                mode="outlined"
                dense
                outlineColor="#E2E8F0"
                activeOutlineColor="#10B981"
                style={{ backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', fontSize: 13, marginBottom: 6 }}
                left={<TextInput.Icon icon="phone" size={18} color="#10B981" />}
                right={custPhone ? <TextInput.Icon icon="close-circle" size={16} onPress={() => setCustPhone('')} /> : undefined}
              />
              <TextInput
                placeholder="Customer Name (Optional)"
                value={custName}
                onChangeText={setCustName}
                mode="outlined"
                dense
                outlineColor="#E2E8F0"
                activeOutlineColor="#10B981"
                style={{ backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', fontSize: 13 }}
                left={<TextInput.Icon icon="account" size={18} color="#64748B" />}
              />
            </Surface>

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

              {/* Discount Row (Interactive for Store Owner) */}
              <View style={styles.summaryRow}>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  onPress={() => {
                    setDiscountInput(discount > 0 ? String(discount) : '');
                    setShowDiscountModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.summaryLabel, { color: discount > 0 ? '#10B981' : '#2563EB', fontWeight: '700' }]}>
                    Discount {discount > 0 ? `(Applied)` : `(+ Add % or ₹)`}
                  </Text>
                  <Icon name="pencil-circle-outline" size={16} color={discount > 0 ? '#10B981' : '#2563EB'} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setDiscountInput(discount > 0 ? String(discount) : '');
                    setShowDiscountModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.summaryValue, { color: discount > 0 ? '#10B981' : appTheme.colors.onSurface, fontWeight: discount > 0 ? '800' : '500' }]}>
                    - ₹{discount.toFixed(2)}
                  </Text>
                </TouchableOpacity>
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
                <TouchableOpacity style={styles.holdBtn} onPress={handleHoldBill} activeOpacity={0.7}>
                  <Icon name="pause-circle-outline" size={18} color="#10B981" />
                  <Text style={styles.holdBtnText}>Hold</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.clearBtn} onPress={() => {
                  if (cart.length === 0) {
                    Alert.alert('Empty Cart', 'Cart is already empty.');
                  } else {
                    clearCart();
                  }
                }} activeOpacity={0.7}>
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

              {/* Quick Bill Actions: Print, Save, WhatsApp, SMS */}
              <View style={{ marginTop: 12, gap: 8 }}>
                <View style={styles.secondaryActions}>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, cart.length === 0 && { opacity: 0.4 }]}
                    onPress={handlePrint}
                    disabled={cart.length === 0}
                    activeOpacity={0.7}
                  >
                    <Icon name="printer" size={16} color="#10B981" />
                    <Text style={styles.secondaryBtnText}>Print Bill</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, cart.length === 0 && { opacity: 0.4 }]}
                    onPress={handleSave}
                    disabled={cart.length === 0}
                    activeOpacity={0.7}
                  >
                    <Icon name="content-save-outline" size={16} color="#10B981" />
                    <Text style={[styles.secondaryBtnText, { color: appTheme.colors.onSurface }]}>Save Bill</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.secondaryActions}>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { backgroundColor: isDarkMode ? 'rgba(46, 125, 50, 0.2)' : '#E8F5E9' }, cart.length === 0 && { opacity: 0.4 }]}
                    onPress={() => handleWhatsAppShare()}
                    disabled={cart.length === 0}
                    activeOpacity={0.7}
                  >
                    <Icon name="whatsapp" size={16} color="#2E7D32" />
                    <Text style={[styles.secondaryBtnText, { color: '#2E7D32' }]}>WhatsApp</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { backgroundColor: isDarkMode ? 'rgba(2, 132, 199, 0.2)' : '#E0F2FE' }, cart.length === 0 && { opacity: 0.4 }]}
                    onPress={() => handleSmsShare()}
                    disabled={cart.length === 0}
                    activeOpacity={0.7}
                  >
                    <Icon name="message-text-outline" size={16} color="#0284C7" />
                    <Text style={[styles.secondaryBtnText, { color: '#0284C7' }]}>Send SMS</Text>
                  </TouchableOpacity>
                </View>
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
                Invoice Amount: ₹{finalTotal.toFixed(0)}
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
                onPress={handleSmsShare}
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

      {/* ── 3. BILL SAVED MODAL ─────────────────────────────── */}
      <Portal>
        <Dialog visible={showSavedModal} onDismiss={() => setShowSavedModal(false)} style={[styles.dialog, { maxWidth: 480, alignSelf: 'center', width: '90%' }]}>
          <Dialog.Title style={[styles.dialogTitle, { color: '#10B981' }]}>
            <Icon name="check-decagram" size={24} color="#10B981" style={{ marginRight: 8 }} />
            Bill Saved Successfully
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ fontSize: 13, color: appTheme.colors.onSurface, marginBottom: 12 }}>
              Invoice <Text style={{ fontWeight: '700' }}>#{savedBillData?.billNo || activeBillNo}</Text> has been saved to your drafts. You can print, download PDF, share via WhatsApp/SMS, or resume editing at any time.
            </Text>

            <Surface style={{ padding: 14, borderRadius: 10, backgroundColor: appTheme.colors.surface, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 12, color: '#64748B' }}>Total Amount:</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: appTheme.colors.onSurface }}>₹{Number(savedBillData?.finalTotal || finalTotal).toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 12, color: '#64748B' }}>Items Count:</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: appTheme.colors.onSurface }}>{(savedBillData?.items || cart).length} items</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: '#64748B' }}>Billed To:</Text>
                <Text style={{ fontSize: 12, color: appTheme.colors.onSurface }}>{savedBillData?.custName || custName || 'Walk-in Customer'}</Text>
              </View>
            </Surface>

            <Text style={[styles.dialogLabel, { marginBottom: 10 }]}>Instant Transfer & Print Options</Text>
            <View style={styles.sharingGrid}>
              <TouchableOpacity
                style={styles.shareOption}
                onPress={() => handleWhatsAppShare(savedBillData)}
              >
                <View style={[styles.shareIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Icon name="whatsapp" size={24} color="#2E7D32" />
                </View>
                <Text style={styles.shareText}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareOption}
                onPress={() => handleSmsShare(savedBillData)}
              >
                <View style={[styles.shareIcon, { backgroundColor: '#E0F2FE' }]}>
                  <Icon name="message-text" size={24} color="#0284C7" />
                </View>
                <Text style={styles.shareText}>Direct SMS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareOption}
                onPress={() => handlePrintPdf(savedBillData)}
              >
                <View style={[styles.shareIcon, { backgroundColor: '#FCE4EC' }]}>
                  <Icon name="printer-pos" size={24} color="#D81B60" />
                </View>
                <Text style={styles.shareText}>Print / PDF</Text>
              </TouchableOpacity>
            </View>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowSavedModal(false)} textColor="#64748B">
              Keep Editing
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                clearCart();
                setShowSavedModal(false);
              }}
              style={{ borderRadius: 8, backgroundColor: '#10B981' }}
            >
              Start New Bill
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── 4. SAVED DRAFTS & HELD BILLS DIALOG ─────────────── */}
      <Portal>
        <Dialog visible={showSessionModal} onDismiss={() => setShowSessionModal(false)} style={[styles.dialog, { maxWidth: 560, alignSelf: 'center', width: '92%' }]}>
          <Dialog.Title style={[styles.dialogTitle, { color: appTheme.colors.onSurface }]}>
            <Icon name="history" size={24} color="#5E35B1" style={{ marginRight: 8 }} />
            Saved Drafts & Held Bills ({savedDraftList.length})
          </Dialog.Title>
          <Dialog.Content style={{ maxHeight: 420 }}>
            {savedDraftList.length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 8 }}>
                <Icon name="file-document-outline" size={44} color="#9E9E9E" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: appTheme.colors.onSurface }}>No Saved Bills</Text>
                <Text style={{ fontSize: 12, color: '#757575', textAlign: 'center' }}>
                  Click 'Save Bill' or 'Hold' on the billing screen to store drafts here.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {savedDraftList.map((draft) => (
                  <Surface key={draft.id} style={{ padding: 12, borderRadius: 10, marginBottom: 10, backgroundColor: appTheme.colors.surface, borderWidth: 1, borderColor: '#E2E8F0' }} elevation={0}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: appTheme.colors.onSurface }}>Invoice #{draft.billNo}</Text>
                        <Text style={{ fontSize: 11, color: '#64748B' }}>{draft.displayDate || draft.date}</Text>
                        <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                          {draft.custName ? `Customer: ${draft.custName}` : 'Walk-in'} {draft.custPhone ? `(+91 ${draft.custPhone})` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#10B981' }}>₹{Number(draft.finalTotal).toFixed(2)}</Text>
                        <Text style={{ fontSize: 11, color: '#64748B' }}>{draft.items?.length || 0} item(s)</Text>
                      </View>
                    </View>

                    <Divider style={{ marginVertical: 8, backgroundColor: '#E2E8F0' }} />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Button
                        mode="contained-tonal"
                        compact
                        icon="refresh"
                        onPress={() => handleResumeDraft(draft)}
                        style={{ borderRadius: 6 }}
                      >
                        Resume
                      </Button>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <IconButton icon="printer" size={18} iconColor="#10B981" onPress={() => handlePrintPdf(draft)} />
                        <IconButton icon="whatsapp" size={18} iconColor="#2E7D32" onPress={() => handleWhatsAppShare(draft)} />
                        <IconButton icon="message-text" size={18} iconColor="#0284C7" onPress={() => handleSmsShare(draft)} />
                        <IconButton icon="delete-outline" size={18} iconColor="#EF4444" onPress={() => handleDeleteDraft(draft.id)} />
                      </View>
                    </View>
                  </Surface>
                ))}
              </ScrollView>
            )}
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowSessionModal(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── 5. STORE OWNER DISCOUNT CONTROLLER MODAL ────────── */}
      <Portal>
        <Dialog visible={showDiscountModal} onDismiss={() => setShowDiscountModal(false)} style={[styles.dialog, { maxWidth: 440, alignSelf: 'center', width: '90%' }]}>
          <Dialog.Title style={[styles.dialogTitle, { color: '#10B981' }]}>
            <Icon name="tag-outline" size={22} color="#10B981" style={{ marginRight: 8 }} />
            Apply Customer Discount
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ fontSize: 13, color: appTheme.colors.onSurface, marginBottom: 12 }}>
              Choose discount type and amount to offer your customer on this sale.
            </Text>

            {/* Mode Switcher */}
            <SegmentedButtons
              value={discountType}
              onValueChange={(val: any) => setDiscountType(val)}
              buttons={[
                { value: 'flat', label: 'Flat Amount (₹)' },
                { value: 'percent', label: 'Percentage (%)' }
              ]}
              style={{ marginBottom: 16 }}
            />

            {/* Quick Presets */}
            <Text style={[styles.dialogLabel, { marginBottom: 6 }]}>Quick Presets</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {discountType === 'percent' ? (
                  ['5', '10', '15', '20', '25'].map(pct => (
                    <Chip
                      key={pct}
                      mode="outlined"
                      selected={discountInput === pct}
                      onPress={() => setDiscountInput(pct)}
                      style={{ backgroundColor: discountInput === pct ? 'rgba(16, 185, 129, 0.15)' : 'transparent' }}
                      textStyle={{ fontWeight: '700', fontSize: 12, color: discountInput === pct ? '#10B981' : appTheme.colors.onSurface }}
                    >
                      {pct}%
                    </Chip>
                  ))
                ) : (
                  ['10', '20', '50', '100', '200'].map(amt => (
                    <Chip
                      key={amt}
                      mode="outlined"
                      selected={discountInput === amt}
                      onPress={() => setDiscountInput(amt)}
                      style={{ backgroundColor: discountInput === amt ? 'rgba(16, 185, 129, 0.15)' : 'transparent' }}
                      textStyle={{ fontWeight: '700', fontSize: 12, color: discountInput === amt ? '#10B981' : appTheme.colors.onSurface }}
                    >
                      ₹{amt}
                    </Chip>
                  ))
                )}
              </View>
            </ScrollView>

            {/* Custom Discount Input */}
            <TextInput
              label={discountType === 'percent' ? 'Discount Percentage (%)' : 'Discount Amount (₹)'}
              placeholder={discountType === 'percent' ? 'e.g. 10' : 'e.g. 50'}
              value={discountInput}
              onChangeText={setDiscountInput}
              keyboardType="numeric"
              mode="outlined"
              outlineColor="#E2E8F0"
              activeOutlineColor="#10B981"
              style={{ marginBottom: 12, backgroundColor: appTheme.colors.surface }}
              left={<TextInput.Icon icon={discountType === 'percent' ? 'percent' : 'currency-inr'} size={18} color="#10B981" />}
              right={discountInput ? <TextInput.Icon icon="close" size={16} onPress={() => setDiscountInput('')} /> : undefined}
            />

            {/* Live Calculation Preview */}
            <Surface style={{ padding: 12, borderRadius: 8, backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 12, color: '#64748B' }}>Cart Subtotal:</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: appTheme.colors.onSurface }}>₹{subtotal.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 12, color: '#10B981' }}>Discount to Apply:</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#10B981' }}>
                  - ₹{(discountType === 'percent' ? ((subtotal * (parseFloat(discountInput) || 0)) / 100) : (parseFloat(discountInput) || 0)).toFixed(2)}
                </Text>
              </View>
              <Divider style={{ marginVertical: 6 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: appTheme.colors.onSurface }}>New Estimated Total:</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#10B981' }}>
                  ₹{Math.max(0, subtotal - (discountType === 'percent' ? ((subtotal * (parseFloat(discountInput) || 0)) / 100) : (parseFloat(discountInput) || 0))).toFixed(2)}
                </Text>
              </View>
            </Surface>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              onPress={() => {
                setDiscount(0);
                setDiscountInput('');
                setShowDiscountModal(false);
              }}
              textColor="#EF4444"
            >
              Remove Discount
            </Button>
            <Button
              mode="contained"
              onPress={handleApplyDiscount}
              style={{ borderRadius: 8, backgroundColor: '#10B981' }}
            >
              Apply Discount
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── 6. PHONE NUMBER PROMPT MODAL FOR WHATSAPP/SMS ───── */}
      <Portal>
        <Dialog visible={showPhonePromptModal} onDismiss={() => setShowPhonePromptModal(false)} style={[styles.dialog, { maxWidth: 420, alignSelf: 'center', width: '90%' }]}>
          <Dialog.Title style={[styles.dialogTitle, { color: phonePromptTarget === 'whatsapp' ? '#2E7D32' : '#0284C7' }]}>
            <Icon name={phonePromptTarget === 'whatsapp' ? 'whatsapp' : 'message-text'} size={22} color={phonePromptTarget === 'whatsapp' ? '#2E7D32' : '#0284C7'} style={{ marginRight: 8 }} />
            Enter Customer Mobile Number
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ fontSize: 13, color: appTheme.colors.onSurface, marginBottom: 12 }}>
              Enter the customer's 10-digit mobile number to dispatch their digital invoice & PDF download link.
            </Text>
            <TextInput
              label="Customer Mobile (+91)"
              placeholder="e.g. 9876543210"
              value={phonePromptInput}
              onChangeText={setPhonePromptInput}
              keyboardType="phone-pad"
              mode="outlined"
              outlineColor="#E2E8F0"
              activeOutlineColor="#10B981"
              style={{ backgroundColor: appTheme.colors.surface }}
              left={<TextInput.Icon icon="phone" size={18} color="#10B981" />}
            />
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowPhonePromptModal(false)} textColor="#64748B">
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                const clean = phonePromptInput.trim();
                if (!clean) {
                  Alert.alert('Phone Required', 'Please enter a valid mobile number.');
                  return;
                }
                setCustPhone(clean);
                setShowPhonePromptModal(false);
                const targetBill = phonePromptBill ? { ...phonePromptBill, custPhone: clean } : null;
                if (phonePromptTarget === 'whatsapp') {
                  setTimeout(() => handleWhatsAppShare(targetBill || { custPhone: clean }), 100);
                } else {
                  setTimeout(() => handleSmsShare(targetBill || { custPhone: clean }), 100);
                }
              }}
              style={{ borderRadius: 8, backgroundColor: phonePromptTarget === 'whatsapp' ? '#2E7D32' : '#0284C7' }}
            >
              {phonePromptTarget === 'whatsapp' ? 'Send WhatsApp' : 'Send SMS'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── 7. SMS CONFIRMATION & COPY MODAL ────────────────── */}
      <Portal>
        <Dialog visible={showSmsInfoModal} onDismiss={() => setShowSmsInfoModal(false)} style={[styles.dialog, { maxWidth: 440, alignSelf: 'center', width: '90%' }]}>
          <Dialog.Title style={[styles.dialogTitle, { color: '#0284C7' }]}>
            <Icon name="message-check" size={22} color="#0284C7" style={{ marginRight: 8 }} />
            SMS Invoice Dispatched
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ fontSize: 13, color: appTheme.colors.onSurface, marginBottom: 8 }}>
              SMS invoice link sent to <Text style={{ fontWeight: '700' }}>+91 {smsSentPhone}</Text>.
            </Text>

            <Surface style={{ padding: 12, borderRadius: 8, backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', marginVertical: 8 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748B', marginBottom: 4 }}>DISPATCHED MESSAGE WITH PDF LINK:</Text>
              <Text style={{ fontSize: 12, color: appTheme.colors.onSurface, lineHeight: 16 }}>
                {smsSentText}
              </Text>
            </Surface>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              onPress={() => {
                if (typeof window !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(smsSentText);
                  Alert.alert('Copied', 'SMS message text copied to clipboard.');
                }
              }}
              icon="content-copy"
            >
              Copy Text
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                setShowSmsInfoModal(false);
              }}
              style={{ borderRadius: 8, backgroundColor: '#0284C7' }}
            >
              Done
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Camera Barcode Scanner Modal */}
      {showCameraScanner && (
        <Modal
          visible={showCameraScanner}
          animationType="slide"
          onRequestClose={() => setShowCameraScanner(false)}
        >
          <View style={styles.cameraModalContainer}>
            <View style={styles.cameraHeader}>
              <IconButton icon="close" iconColor="white" size={24} onPress={() => setShowCameraScanner(false)} />
              <Text style={styles.cameraHeaderTitle}>Scan Barcode</Text>
              <View style={{ width: 48 }} />
            </View>
            
            <View style={styles.cameraPreviewBox}>
              {hasCameraPermission ? (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  onBarcodeScanned={cameraScanned ? undefined : async ({ data }) => {
                    setCameraScanned(true);
                    if (data) {
                      let barcode = data;
                      if (data && typeof data === 'string' && data.includes('scanBarcode=')) {
                        const match = data.match(/[?&]scanBarcode=([^&]+)/);
                        if (match) {
                          barcode = match[1];
                        }
                      }
                      const cleanBarcode = barcode.trim().replace(/[\r\n]/g, '');
                      // Search locally in products first
                      const matchingProduct = products.find(p => p.barcode === cleanBarcode);
                      if (matchingProduct) {
                        handleAddProduct(matchingProduct);
                        setShowCameraScanner(false);
                      } else {
                        // Attempt database check if firebase is configured
                        if (isFirebaseConfigured) {
                          try {
                            const q = query(
                              collection(db, 'products'),
                              where('tenant_id', '==', tenantId || 'anonymous'),
                              where('barcode', '==', cleanBarcode)
                            );
                            const snapshot = await getDocs(q);
                            if (!snapshot.empty) {
                              const pId = snapshot.docs[0].id;
                              const pData = snapshot.docs[0].data();
                              const newProduct = {
                                id: pId,
                                name: pData.name,
                                price: pData.selling_price || pData.price || 0,
                                gst_pct: pData.gst_pct || 0,
                                hsn: pData.hsn || '',
                                image_url: pData.image_url,
                                barcode: pData.barcode || ''
                              };
                              setProducts(prev => [newProduct, ...prev]);
                              handleAddProduct(newProduct);
                              setShowCameraScanner(false);
                              return;
                            }
                          } catch (e) {
                            console.error(e);
                          }
                        }
                        Alert.alert('Not Found', `Product with barcode: ${cleanBarcode} not found in inventory.`, [
                          { text: 'OK', onPress: () => setCameraScanned(false) }
                        ]);
                      }
                    } else {
                      setCameraScanned(false);
                    }
                  }}
                  barcodeScannerSettings={{
                    barcodeTypes: ["qr", "ean13", "ean8", "code128"],
                  }}
                />
              ) : (
                <Text style={{ color: 'white' }}>Requesting camera permission...</Text>
              )}
              
              {/* Overlay Frame */}
              <View style={styles.cameraOverlayFrame}>
                <View style={[styles.cameraCorner, styles.cameraTopLeft]} />
                <View style={[styles.cameraCorner, styles.cameraTopRight]} />
                <View style={[styles.cameraCorner, styles.cameraBottomLeft]} />
                <View style={[styles.cameraCorner, styles.cameraBottomRight]} />
                <View style={styles.cameraLaser} />
              </View>
            </View>
            
            <Text style={styles.cameraInstruction}>Position barcode inside the frame</Text>
          </View>
        </Modal>
      )}

      {/* Floating AI Voice Copilot FAB */}
      <TouchableOpacity
        style={styles.floatingAiFab}
        onPress={() => setShowAssistantModal(true)}
        activeOpacity={0.85}
      >
        <Icon name="robot-happy" size={24} color="#FFFFFF" />
        <View style={styles.floatingAiPulse} />
      </TouchableOpacity>

      {/* POS Conversational AI Assistant Modal */}
      <POSAssistantModal
        visible={showAssistantModal}
        onClose={() => setShowAssistantModal(false)}
        products={products}
        onAddToCart={(item, qty) => {
          for (let i = 0; i < qty; i++) {
            addToCart({
              id: item.id,
              name: item.name,
              price: item.price || item.selling_price || 0,
              qty: 1,
              gst_pct: isGstRegistered ? (item.gst_pct || 0) : 0,
              hsn: item.hsn || '',
              image_url: item.image_url,
            });
          }
        }}
        onClearCart={clearCart}
        onApplyDiscount={(d) => {
          if (d.type === 'percent') {
            setDiscount((subtotal * d.value) / 100);
          } else {
            setDiscount(d.value);
          }
        }}
        onCheckout={(mode) => {
          if (['cash', 'upi', 'card', 'credit'].includes(mode)) {
            setPayMethod(mode.toUpperCase() as any);
          }
        }}
        contextData={{
          cartItems: cart,
        }}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, padding: DS.space.lg, backgroundColor: DS.colors.surfaceBg },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerIconBox: {
    width: 42, height: 42, borderRadius: DS.radius.md, alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  headerTitle: { fontSize: DS.font.h2.fontSize, fontWeight: DS.font.h2.fontWeight, color: DS.colors.text },
  headerSubtitle: { fontSize: 12, marginTop: 2, fontWeight: '500', color: DS.colors.textSecondary },
  headerRight: { flexDirection: 'row', gap: 8 },
  chip: { },
  chipText: { fontSize: 12, fontWeight: '600', },

  // Content
  contentRow: { flexDirection: 'row', gap: 24, flex: 1 },

  // Left Pane
  leftPane: { flex: 2, borderRadius: DS.radius.lg, padding: 20, borderWidth: 0, backgroundColor: DS.colors.cardBg, ...DS.shadow.sm },

  // Search
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  searchIconBox: {
    width: 44, height: 44, borderRadius: DS.radius.md, alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  searchInput: { flex: 1, height: 46, borderRadius: DS.radius.sm, fontSize: 14 },

  // Suggestions
  suggestionsDropdown: {
    position: 'absolute', top: 86, left: 20, right: 20, zIndex: 50,
    borderRadius: DS.radius.md, borderWidth: 0, backgroundColor: DS.colors.cardBg, ...DS.shadow.lg, overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: DS.colors.borderLight,
  },
  suggestionCategoryDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  suggestionInfo: { flex: 1 },
  suggestionName: { fontSize: 14, fontWeight: '600', color: DS.colors.text },
  suggestionMeta: { fontSize: 11, marginTop: 2, color: DS.colors.textSecondary },
  suggestionPrice: { fontSize: 15, fontWeight: '700', marginRight: 12, color: DS.colors.text },
  addIconCircle: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
  },

  // Cart Header
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 12 },
  cartHeaderTitle: { fontSize: 16, fontWeight: '700', color: DS.colors.text },
  cartItemCount: { fontSize: 12, color: DS.colors.textSecondary },

  // Column Headers
  columnHeaders: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, borderRadius: DS.radius.sm, marginBottom: 8, backgroundColor: DS.colors.surfaceBg },
  colHeader: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: DS.colors.textSecondary },

  // Cart List
  cartList: { flex: 1 },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: DS.radius.md, marginBottom: 4, backgroundColor: DS.colors.surfaceBg },
  itemName: { fontSize: 13, fontWeight: '700', color: DS.colors.text },
  itemSku: { fontSize: 10, marginTop: 2, color: DS.colors.textMuted },
  itemPrice: { fontSize: 13, fontWeight: '500', color: DS.colors.text },
  itemGst: { fontSize: 12, color: DS.colors.textSecondary },
  itemTotal: { fontSize: 13, fontWeight: '700', color: DS.colors.text },
  deleteBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },

  // Qty Controls
  qtyController: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 24, height: 24, borderRadius: DS.radius.xs, borderWidth: 1, borderColor: DS.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: DS.colors.cardBg },
  qtyBtnPlus: { },
  qtyDisplay: { minWidth: 20, alignItems: 'center' },
  qtyText: { fontSize: 12, fontWeight: '700', color: DS.colors.text },

  emptyCartContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyCartTitle: { fontSize: 16, fontWeight: '700', marginTop: 12, color: DS.colors.text },
  emptyCartSubtitle: { fontSize: 12, marginTop: 4, textAlign: 'center', maxWidth: 280, color: DS.colors.textSecondary },

  // Right Pane
  rightPane: { flex: 1, gap: 20 },
  summaryCard: { borderRadius: DS.radius.lg, padding: 20, borderWidth: 0, backgroundColor: DS.colors.cardBg, ...DS.shadow.sm },
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

  weighScaleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E65100', borderRadius: 10, paddingVertical: 12, gap: 8, marginBottom: 16 },
  weighScaleBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 10, marginTop: 12 },
  payBtnDisabled: { opacity: 0.7 },
  payBtnText: { fontSize: 15, fontWeight: '800', },

  secondaryActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38, borderRadius: 8, },
  secondaryBtnText: { fontSize: 12, fontWeight: '700', },

  // Quick Add
  quickAddCard: { borderRadius: DS.radius.lg, padding: 16, borderWidth: 0, backgroundColor: DS.colors.cardBg, ...DS.shadow.sm },
  quickAddTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12, color: DS.colors.text },
  quickAddGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickAddItem: { flexGrow: 1, flexBasis: '28%', padding: 10, borderRadius: DS.radius.sm, borderWidth: 1, borderColor: DS.colors.border, alignItems: 'center', backgroundColor: DS.colors.cardBg },
  quickAddDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 6 },
  quickAddName: { fontSize: 11, fontWeight: '600', color: DS.colors.text },
  quickAddPrice: { fontSize: 11, fontWeight: '700', marginTop: 2, color: DS.colors.textSecondary },

  // Dialog Modals
  dialog: { borderRadius: DS.radius.lg, backgroundColor: DS.colors.cardBg },
  dialogTitle: { fontSize: 18, fontWeight: '800', flexDirection: 'row', alignItems: 'center', color: DS.colors.text },
  dialogLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4, color: DS.colors.textSecondary },
  dialogActions: { paddingHorizontal: 16, paddingBottom: 16, justifyContent: 'space-between' },

  // Receipt Preview
  receiptPreview: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: DS.colors.border, borderRadius: DS.radius.sm,
    padding: 16, maxHeight: 300, marginBottom: 16, backgroundColor: DS.colors.surfaceBg
  },
  receiptHeader: { alignItems: 'center', marginBottom: 12 },
  receiptStoreName: { fontSize: 16, fontWeight: '800', color: DS.colors.text },
  receiptStoreMeta: { fontSize: 11, marginTop: 2, color: DS.colors.textSecondary },
  receiptCustomerBox: { marginTop: 8, padding: 8, borderRadius: DS.radius.xs, backgroundColor: DS.colors.cardBg },
  receiptCustomerText: { fontSize: 11, fontWeight: '600', color: DS.colors.text },
  receiptItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  receiptItemName: { fontSize: 12, flex: 1, color: DS.colors.text },
  receiptItemTotal: { fontSize: 12, fontWeight: '700', color: DS.colors.text },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  receiptLabel: { fontSize: 11, color: DS.colors.textSecondary },
  receiptValue: { fontSize: 11, color: DS.colors.text },
  receiptFooter: { alignItems: 'center', marginTop: 14 },
  receiptFooterText: { fontSize: 11, fontWeight: '700', color: DS.colors.text },
  smsAlertBox: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: DS.radius.xs },
  smsAlertText: { fontSize: 10, fontWeight: '700' },

  // Sharing Option row
  sharingGrid: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 8 },
  shareOption: { alignItems: 'center' },
  shareIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  shareText: { fontSize: 11, fontWeight: '600', color: DS.colors.textSecondary },

  // Camera Barcode Scanner styles
  cameraModalContainer: {
    flex: 1,
    backgroundColor: '#0D0F14',
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 16,
  },
  cameraHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  cameraPreviewBox: {
    width: 280,
    height: 280,
    alignSelf: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  cameraOverlayFrame: {
    width: 220,
    height: 170,
    position: 'absolute',
    justifyContent: 'center',
  },
  cameraCorner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#10B981',
  },
  cameraTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  cameraTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  cameraBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  cameraBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  cameraLaser: {
    height: 2,
    backgroundColor: '#EF4444',
    width: '100%',
    position: 'absolute',
  },
  cameraInstruction: {
    color: '#8891A8',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 40,
  },
  floatingAiFab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  floatingAiPulse: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
