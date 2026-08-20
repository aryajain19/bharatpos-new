import { useAppTheme } from '../../providers/ThemeProvider';
import { DS } from '../../constants/designTokens';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Text, Card, Button, useTheme, TextInput, DataTable, IconButton, Checkbox, Portal, Dialog, Searchbar, HelperText, SegmentedButtons } from 'react-native-paper';
import { useAuth } from '../../providers/AuthProvider';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Rect } from 'react-native-svg';
import * as Print from 'expo-print';
import { db, isFirebaseConfigured, auth } from '../../lib/firebase';
import { collection, getDocs, query, where, doc, updateDoc, addDoc, getDoc } from '../../lib/firestore_adapter';
import { useNavigation } from 'expo-router';
import { cleanAndMapCategory } from '../../lib/ui_helpers';
import { toQR } from 'toqr';

// Code 128 Lookup Table for Barcode Generation
const CODE128_WIDTHS = [
  [2, 1, 2, 2, 2, 2], [2, 2, 2, 1, 2, 2], [2, 2, 2, 2, 2, 1], [1, 2, 1, 2, 2, 3], [1, 2, 1, 3, 2, 2],
  [1, 3, 1, 2, 2, 2], [1, 2, 2, 2, 1, 3], [1, 2, 2, 3, 1, 2], [1, 3, 2, 2, 1, 2], [2, 2, 1, 2, 1, 3],
  [2, 2, 1, 3, 1, 2], [2, 3, 1, 2, 1, 2], [1, 1, 2, 2, 3, 2], [1, 2, 2, 1, 3, 2], [1, 2, 2, 2, 3, 1],
  [1, 1, 3, 2, 2, 2], [1, 2, 3, 1, 2, 2], [1, 2, 3, 2, 2, 1], [2, 2, 3, 2, 1, 1], [2, 2, 1, 1, 3, 2],
  [2, 2, 1, 2, 3, 1], [2, 1, 3, 2, 1, 2], [2, 2, 3, 1, 1, 2], [3, 1, 2, 1, 3, 1], [3, 1, 1, 2, 2, 2],
  [3, 2, 1, 1, 2, 2], [3, 2, 1, 2, 2, 1], [3, 1, 2, 2, 1, 2], [3, 2, 2, 1, 1, 2], [3, 2, 2, 2, 1, 1],
  [2, 1, 2, 1, 2, 3], [2, 1, 2, 3, 2, 1], [2, 3, 2, 1, 2, 1], [1, 1, 1, 3, 2, 3], [1, 3, 1, 1, 2, 3],
  [1, 3, 1, 3, 2, 1], [1, 1, 2, 3, 1, 3], [1, 3, 2, 1, 1, 3], [1, 3, 2, 3, 1, 1], [2, 1, 1, 3, 1, 3],
  [2, 3, 1, 1, 1, 3], [2, 3, 1, 3, 1, 1], [1, 1, 2, 1, 3, 3], [1, 1, 2, 3, 3, 1], [1, 3, 2, 1, 3, 1],
  [1, 1, 3, 1, 2, 3], [1, 1, 3, 3, 2, 1], [1, 3, 3, 1, 2, 1], [3, 1, 3, 1, 2, 1], [2, 1, 1, 3, 3, 1],
  [2, 3, 1, 1, 3, 1], [2, 1, 3, 1, 1, 3], [2, 1, 3, 3, 1, 1], [2, 1, 3, 1, 3, 1], [3, 1, 1, 1, 2, 3],
  [3, 1, 1, 3, 2, 1], [3, 3, 1, 1, 2, 1], [3, 1, 2, 1, 1, 3], [3, 1, 2, 3, 1, 1], [3, 3, 2, 1, 1, 1],
  [3, 1, 4, 1, 1, 1], [2, 2, 1, 4, 1, 1], [4, 3, 1, 1, 1, 1], [1, 1, 1, 2, 2, 4], [1, 1, 1, 4, 2, 2],
  [1, 2, 1, 1, 2, 4], [1, 2, 1, 4, 2, 1], [1, 4, 1, 1, 2, 2], [1, 4, 1, 2, 2, 1], [1, 1, 2, 2, 1, 4],
  [1, 1, 2, 4, 1, 2], [1, 2, 2, 1, 1, 4], [1, 2, 2, 4, 1, 1], [1, 4, 2, 1, 1, 2], [1, 4, 2, 2, 1, 1],
  [2, 4, 1, 2, 1, 1], [2, 2, 1, 1, 1, 4], [4, 1, 3, 1, 1, 1], [2, 4, 1, 1, 1, 2], [1, 3, 4, 1, 1, 1],
  [1, 1, 1, 2, 4, 2], [1, 2, 1, 1, 4, 2], [1, 2, 1, 2, 4, 1], [1, 1, 4, 2, 1, 2], [1, 2, 4, 1, 1, 2],
  [1, 2, 4, 2, 1, 1], [4, 1, 1, 2, 1, 2], [4, 2, 1, 1, 1, 2], [4, 2, 1, 2, 1, 1], [2, 1, 2, 1, 4, 1],
  [2, 1, 4, 1, 2, 1], [4, 1, 2, 1, 2, 1], [1, 1, 1, 1, 4, 3], [1, 1, 1, 3, 4, 1], [1, 3, 1, 1, 4, 1],
  [1, 1, 4, 1, 1, 3], [1, 1, 4, 3, 1, 1], [4, 1, 1, 1, 1, 3], [4, 1, 1, 3, 1, 1], [1, 1, 3, 1, 4, 1],
  [1, 1, 4, 1, 3, 1], [3, 1, 1, 1, 4, 1], [4, 1, 1, 1, 3, 1], [2, 1, 1, 4, 1, 2], [2, 1, 1, 2, 1, 4],
  [2, 1, 1, 2, 3, 2], [2, 3, 3, 1, 1, 1, 2]
];

// Vector Barcode Render component
function VectorBarcode({ value, width = 1.3, height = 60 }: { value: string; width?: number; height?: number }) {
  const startCode = 104;
  const stopCode = 106;
  const indices: number[] = [];
  let sum = startCode;
  
  for (let i = 0; i < value.length; i++) {
    const charCode = value.charCodeAt(i);
    let val = charCode - 32;
    if (val < 0 || val > 95) val = 0;
    indices.push(val);
    sum += (i + 1) * val;
  }
  
  const checkDigit = sum % 103;
  const symbols = [startCode, ...indices, checkDigit, stopCode];
  
  let currentX = 0;
  const rects: React.ReactNode[] = [];
  
  symbols.forEach((symbolIndex, sIdx) => {
    const widths = CODE128_WIDTHS[symbolIndex];
    if (widths) {
      widths.forEach((w, idx) => {
        const isBar = idx % 2 === 0;
        if (isBar) {
          rects.push(
            <Rect
              key={`bar-${sIdx}-${idx}-${currentX}`}
              x={currentX}
              y={0}
              width={w * width}
              height={height}
              fill="black"
            />
          );
        }
        currentX += w * width;
      });
    }
  });
  
  return (
    <View style={{ alignItems: 'center', marginVertical: 2 }}>
      <Svg width={currentX} height={height}>
        {rects}
      </Svg>
    </View>
  );
}

// Vector QR Code Render component
function VectorQRCode({ value, size = 60 }: { value: string; size?: number }) {
  try {
    const matrix = toQR(value);
    const n = Math.sqrt(matrix.length);
    const cellSize = size / n;
    const rects: React.ReactNode[] = [];
    
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (matrix[r * n + c] === 1) {
          rects.push(
            <Rect
              key={`qr-${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill="black"
            />
          );
        }
      }
    }
    
    return (
      <View 
        style={{ 
          width: size, 
          height: size, 
          minWidth: size, 
          minHeight: size, 
          maxWidth: size, 
          maxHeight: size, 
          flexShrink: 0, 
          flexGrow: 0,
          aspectRatio: 1,
          alignItems: 'center', 
          justifyContent: 'center', 
          marginVertical: 2 
        }}
      >
        <Svg 
          width={size} 
          height={size} 
          viewBox={`0 0 ${size} ${size}`} 
          style={{ 
            width: size, 
            height: size, 
            minWidth: size, 
            minHeight: size, 
            maxWidth: size, 
            maxHeight: size, 
            flexShrink: 0, 
            flexGrow: 0,
            aspectRatio: 1
          }}
        >
          {rects}
        </Svg>
      </View>
    );
  } catch (error) {
    console.error("Error generating QR code:", error);
    return null;
  }
}

const getScanUrl = (barcode: string) => {
  const defaultOrigin = 'https://bharatpos-new.vercel.app';
  let origin = defaultOrigin;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    origin = window.location.origin;
  }
  return `${origin}/pos_billing?scanBarcode=${barcode}`;
};

export default function BarcodeGeneratorScreen() {
  const { tenantId, loading: authLoading } = useAuth();

  const { isDarkMode } = useAppTheme();
  const appTheme = useTheme();
  const { permissions, role } = useAuth();
  const navigation = useNavigation();
  
  const [codeType, setCodeType] = useState<'barcode' | 'qrcode'>('barcode');
  
  // Real inventory lists
  const [products, setProducts] = useState<any[]>([]);
  const [shopName, setShopName] = useState('BharatPOS Store');

  // Print Queue Cart
  const [printQueue, setPrintQueue] = useState<any[]>([]);

  // Input creation tabs
  const [inputTab, setInputTab] = useState<'inventory' | 'manual' | 'variants'>('inventory');

  // Manual entry states
  const [productName, setProductName] = useState("Men's Suit Black");
  const [category, setCategory] = useState("Suits");
  const [barcodeValue, setBarcodeValue] = useState("8901234567890");
  const [copiesCount, setCopiesCount] = useState("24");
  const [singlePrice, setSinglePrice] = useState("999");
  
  // Inventory Picker dialog states
  const [showInventoryDialog, setShowInventoryDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductCopies, setSelectedProductCopies] = useState<Record<string, string>>({});
  const [selectedProductChecks, setSelectedProductChecks] = useState<Record<string, boolean>>({});

  // Variant fashion builder states
  const [variantBaseProductId, setVariantBaseProductId] = useState('');
  const [variantManualName, setVariantManualName] = useState('');
  const [variantSizes, setVariantSizes] = useState<Record<string, boolean>>({ S: false, M: true, L: true, XL: false, XXL: false });
  const [customSizes, setCustomSizes] = useState('');
  const [variantColors, setVariantColors] = useState('Black, Blue');
  const [variantCopies, setVariantCopies] = useState('12');
  const [variantSaveToDb, setVariantSaveToDb] = useState(false);
  
  // Layout Options
  const [barcodesPerPage, setBarcodesPerPage] = useState('24'); // '12' | '24' | '30' | '40' | '50' | '80' | 'custom'
  const [customCols, setCustomCols] = useState('3');
  const [customRows, setCustomRows] = useState('8');

  // Label Design toggles
  const [showName, setShowName] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showSKU, setShowSKU] = useState(true);
  const [showMRP, setShowMRP] = useState(true);
  const [showCategory, setShowCategory] = useState(false);
  const [showShopName, setShowShopName] = useState(false);

  // Template lists
  const [templateName, setTemplateName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Preview Paginations
  const [previewPageIdx, setPreviewPageIdx] = useState(0);

  useEffect(() => {
    if (!authLoading && tenantId) {
      fetchProducts();
      fetchShopName();
      loadTemplates();
      loadPrintQueue();
    }
  }, [authLoading, tenantId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadPrintQueue();
      fetchProducts();
    });
    return unsubscribe;
  }, [navigation]);

  const loadPrintQueue = () => {
    if (typeof window !== 'undefined') {
      const q = window.localStorage.getItem('barcode_print_queue');
      if (q) {
        setPrintQueue(JSON.parse(q));
      }
    }
  };

  const savePrintQueue = (q: any[]) => {
    setPrintQueue(q);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('barcode_print_queue', JSON.stringify(q));
    }
    setPreviewPageIdx(0);
  };

  const loadTemplates = () => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('barcode_templates');
      if (saved) {
        setSavedTemplates(JSON.parse(saved));
      }
    }
  };

  const fetchShopName = async () => {
    if (!isFirebaseConfigured) return;
    try {
      const uid = tenantId;
      if (uid) {
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists && userSnap.exists()) {
          const d = userSnap.data();
          setShopName(d.storeName || d.store_name || 'BharatPOS Store');
        }
      }
    } catch (e) {
      console.warn("Failed to fetch shop name:", e);
    }
  };

  const fetchProducts = async () => {
    if (!isFirebaseConfigured) return;
    try {
      if (!tenantId) return '';
      const q = query(collection(db, 'products'), where('tenant_id', '==', tenantId));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name || 'Unnamed Product',
          barcode: d.barcode || '',
          category: d.category || 'N/A',
          mrp: d.mrp || d.price || 0,
          selling_price: d.selling_price || d.price || 0,
          stock_qty: d.stock_qty !== undefined ? Number(d.stock_qty) : (d.stock !== undefined ? Number(d.stock) : 15),
        };
      });
      setProducts(list);
    } catch (e) {
      console.error("Error fetching products:", e);
    }
  };

  const generateAutoBarcodeValue = () => {
    if (!tenantId) return '';
    let hash = 0;
    for (let i = 0; i < tenantId.length; i++) {
      hash = (hash + tenantId.charCodeAt(i)) % 10000;
    }
    const storePrefix = hash.toString().padStart(4, '0');
    const randomDigits = Math.floor(10000 + Math.random() * 90000).toString(); // 5 digits
    const prefix = '890'; // India prefix
    const base = prefix + storePrefix + randomDigits; // 12 digits
    
    // Calculate EAN-13 check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(base.charAt(i)) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return base + checkDigit;
  };

  const handleAutoGenerateBarcode = async (prodId: string, prodName: string) => {
    if (!isFirebaseConfigured) return;
    const newBarcode = generateAutoBarcodeValue();
    try {
      await updateDoc(doc(db, 'products', prodId), { barcode: newBarcode });
      alert(`Barcode "${newBarcode}" generated and saved for ${prodName}.`);
      fetchProducts(); // Refresh products list
    } catch (e) {
      console.error(e);
      alert("Failed to write generated barcode to database.");
    }
  };

  const handleQueueQuantityChange = (idx: number, val: number) => {
    const q = [...printQueue];
    q[idx].copies = Math.max(1, (q[idx].copies || 1) + val);
    savePrintQueue(q);
  };

  const handleQueueRemove = (idx: number) => {
    const q = printQueue.filter((_, i) => i !== idx);
    savePrintQueue(q);
  };

  const handleQueueClear = () => {
    savePrintQueue([]);
  };

  const getGridConfig = (template: string) => {
    switch (template) {
      case '12': return { cols: 3, rows: 4, perPage: 12 };
      case '24': return { cols: 3, rows: 8, perPage: 24 };
      case '30': return { cols: 3, rows: 10, perPage: 30 };
      case '40': return { cols: 4, rows: 10, perPage: 40 };
      case '50': return { cols: 5, rows: 10, perPage: 50 };
      case '80': return { cols: 5, rows: 16, perPage: 80 };
      case 'custom': return { 
        cols: parseInt(customCols) || 3, 
        rows: parseInt(customRows) || 8, 
        perPage: (parseInt(customCols) || 3) * (parseInt(customRows) || 8) 
      };
      default: return { cols: 3, rows: 8, perPage: 24 };
    }
  };

  const getItemsToPrint = () => {
    const items: { name: string; barcode: string; category?: string; price?: string }[] = [];
    printQueue.forEach(qItem => {
      const count = qItem.copies || 24;
      for (let i = 0; i < count; i++) {
        items.push({ 
          name: qItem.name, 
          barcode: qItem.barcode, 
          category: qItem.category, 
          price: qItem.price 
        });
      }
    });
    return items;
  };

  const handleAddManualToQueue = () => {
    if (!productName.trim() || !barcodeValue.trim()) {
      alert("Name and Barcode are required.");
      return;
    }
    const newItem = {
      id: 'manual_' + Date.now(),
      name: productName,
      barcode: barcodeValue,
      category: category || 'N/A',
      price: singlePrice,
      copies: parseInt(copiesCount) || 24
    };
    savePrintQueue([...printQueue, newItem]);
    alert("Manual item added to queue!");
  };

  const handleAddSelectedInventory = async () => {
    const itemsToAdd: any[] = [];
    const prodIds = Object.keys(selectedProductChecks).filter(id => selectedProductChecks[id]);

    if (prodIds.length === 0) {
      alert("No products selected.");
      return;
    }

    for (const id of prodIds) {
      const prod = products.find(p => p.id === id);
      if (prod) {
        let activeBarcode = prod.barcode;
        
        // Auto create barcode if not available
        if (!activeBarcode) {
          activeBarcode = generateAutoBarcodeValue();
          try {
            await updateDoc(doc(db, 'products', id), { barcode: activeBarcode });
          } catch (e) {
            console.error("Failed to save barcode on bulk add:", e);
          }
        }

        const copies = parseInt(selectedProductCopies[id]) || 24;
        itemsToAdd.push({
          id: prod.id,
          name: prod.name,
          barcode: activeBarcode,
          category: prod.category || 'N/A',
          price: String(prod.selling_price || prod.mrp || 0),
          copies
        });
      }
    }

    savePrintQueue([...printQueue, ...itemsToAdd]);
    fetchProducts(); // refresh products list
    setShowInventoryDialog(false);
    setSelectedProductChecks({});
    setSelectedProductCopies({});
    alert(`${itemsToAdd.length} products added to barcode queue!`);
  };

  const handleAddVariantsToQueue = async () => {
    let baseProdName = '';
    let baseBarcode = '';
    let baseCategory = 'Variants';
    let basePrice = 0;
    
    if (variantBaseProductId) {
      const baseProd = products.find(p => p.id === variantBaseProductId);
      if (baseProd) {
        baseProdName = baseProd.name;
        baseCategory = baseProd.category || 'Variants';
        basePrice = Number(baseProd.selling_price) || Number(baseProd.mrp) || 0;
        baseBarcode = baseProd.barcode;
        
        if (!baseBarcode) {
          baseBarcode = generateAutoBarcodeValue();
          try {
            await updateDoc(doc(db, 'products', baseProd.id), { barcode: baseBarcode });
          } catch (e) {
            console.error("Failed to update base product barcode:", e);
          }
        }
      }
    }

    if (!baseProdName && variantManualName.trim()) {
      baseProdName = variantManualName.trim();
      baseBarcode = generateAutoBarcodeValue();
    }

    if (!baseProdName) {
      alert("Please select a base product from inventory or enter a manual product name.");
      return;
    }

    // Colors parsing
    const colors = variantColors.split(',').map(c => c.trim()).filter(c => c.length > 0);
    if (colors.length === 0) colors.push('');

    // Sizes parsing
    const sizes = Object.keys(variantSizes).filter(s => variantSizes[s]);
    const customSizesList = customSizes.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const allSizes = [...sizes, ...customSizesList];
    if (allSizes.length === 0) allSizes.push('');

    const variantsToCreate: { name: string; barcode: string }[] = [];
    allSizes.forEach(size => {
      colors.forEach(color => {
        let nameSuffix = '';
        let codeSuffix = '';
        if (color) { nameSuffix += ` ${color}`; codeSuffix += `-${color.substring(0, 3).toUpperCase()}`; }
        if (size) { nameSuffix += ` - ${size}`; codeSuffix += `-${size}`; }

        variantsToCreate.push({
          name: `${baseProdName}${nameSuffix}`,
          barcode: `${baseBarcode}${codeSuffix}`
        });
      });
    });

    const itemsToAdd: any[] = [];
    const copies = parseInt(variantCopies) || 12;

    for (const v of variantsToCreate) {
      let finalId = 'variant_' + Date.now() + '_' + Math.random().toString(36).substring(7);
      
      if (variantSaveToDb && isFirebaseConfigured) {
        try {
          const docRef = await addDoc(collection(db, 'products'), {
            name: v.name,
            barcode: v.barcode,
            category: baseCategory,
            mrp: basePrice,
            selling_price: basePrice,
            stock_qty: 0,
            tenant_id: tenantId,
            created_at: new Date().toISOString()
          });
          finalId = docRef.id;
        } catch (e) {
          console.error("Failed to save variant product:", e);
        }
      }

      itemsToAdd.push({
        id: finalId,
        name: v.name,
        barcode: v.barcode,
        category: baseCategory,
        price: String(basePrice),
        copies
      });
    }

    savePrintQueue([...printQueue, ...itemsToAdd]);
    fetchProducts(); // refresh products list
    setVariantBaseProductId('');
    setVariantManualName('');
    alert(`Successfully generated and queued ${itemsToAdd.length} size/color variants!`);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      alert("Please enter a template name");
      return;
    }
    const newTemplate = {
      id: Date.now().toString(),
      name: templateName,
      barcodesPerPage,
      customCols,
      customRows,
      showName,
      showCategory,
      showSKU,
      showMRP,
      showBarcode,
      showShopName,
      codeType
    };
    const updated = [...savedTemplates, newTemplate];
    setSavedTemplates(updated);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('barcode_templates', JSON.stringify(updated));
    }
    setTemplateName('');
    setShowSaveDialog(false);
    alert(`Template "${newTemplate.name}" saved!`);
  };

  const handleLoadTemplate = (tpl: any) => {
    setBarcodesPerPage(tpl.barcodesPerPage);
    setCustomCols(tpl.customCols || '3');
    setCustomRows(tpl.customRows || '8');
    setShowName(tpl.showName);
    setShowCategory(tpl.showCategory);
    setShowSKU(tpl.showSKU);
    setShowMRP(tpl.showMRP);
    setShowBarcode(tpl.showBarcode);
    setShowShopName(tpl.showShopName !== undefined ? tpl.showShopName : false);
    setCodeType(tpl.codeType || 'barcode');
    alert(`Loaded template style "${tpl.name}"`);
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(updated);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('barcode_templates', JSON.stringify(updated));
    }
  };

  const downloadSingleBarcodePNG = () => {
    if (Platform.OS !== 'web') {
      alert("PNG Export is only supported in web environments");
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const val = barcodeValue;
      const startCode = 104;
      const stopCode = 106;
      const indices: number[] = [];
      let sum = startCode;
      for (let i = 0; i < val.length; i++) {
        const charCode = val.charCodeAt(i);
        let v = charCode - 32;
        if (v < 0 || v > 95) v = 0;
        indices.push(v);
        sum += (i + 1) * v;
      }
      const checkDigit = sum % 103;
      const symbols = [startCode, ...indices, checkDigit, stopCode];

      let totalWidth = 0;
      symbols.forEach(symbolIndex => {
        const widths = CODE128_WIDTHS[symbolIndex];
        if (widths) {
          widths.forEach(w => {
            totalWidth += w * 2.2;
          });
        }
      });

      canvas.width = totalWidth + 60;
      canvas.height = 140;

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'black';
      let currentX = 30;
      symbols.forEach(symbolIndex => {
        const widths = CODE128_WIDTHS[symbolIndex];
        if (widths) {
          widths.forEach((w, idx) => {
            const isBar = idx % 2 === 0;
            if (isBar) {
              ctx.fillRect(currentX, 15, w * 2.2, 85);
            }
            currentX += w * 2.2;
          });
        }
      });

      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';
      ctx.fillText(val, canvas.width / 2, 122);

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${productName.replace(/\s+/g, '_')}_barcode.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert("Failed to export PNG barcode.");
    }
  };

  const handlePrint = async () => {
    const itemsToPrint = getItemsToPrint();
    if (itemsToPrint.length === 0) {
      alert("No barcodes in queue for printing!");
      return;
    }

    const config = getGridConfig(barcodesPerPage);
    const perPage = config.perPage;
    const pagesCount = Math.ceil(itemsToPrint.length / perPage);
    const labelFontSize = config.perPage > 50 ? '7px' : (config.perPage > 30 ? '8px' : '10px');
    const shopNameFontSize = config.perPage > 50 ? '6px' : (config.perPage > 30 ? '7px' : '9px');
    const barcodeHeight = config.perPage > 50 ? '16px' : (config.perPage > 30 ? '24px' : '34px');
    const labelPadding = config.perPage > 50 ? '2px' : (config.perPage > 30 ? '4px' : '6px');
    const qrSize = config.perPage > 50 ? 24 : (config.perPage > 30 ? 36 : 48);

    let htmlContent = `
      <html>
        <head>
          <style>
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box;
            }
            @page {
              size: A4;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background: white;
            }
            .page {
              width: 210mm;
              height: 297mm;
              padding: 12mm;
              box-sizing: border-box;
              page-break-after: always;
            }
            .grid {
              display: grid;
              grid-gap: 4mm;
              height: 273mm;
              box-sizing: border-box;
              grid-template-columns: repeat(${config.cols}, 1fr);
              grid-template-rows: repeat(${config.rows}, 1fr);
            }
            .label {
              border: 1px dashed #CBD5E1;
              border-radius: 4px;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              padding: ${labelPadding};
              text-align: center;
              box-sizing: border-box;
              overflow: hidden;
              background: white;
            }
            .shop-name {
              font-size: ${shopNameFontSize};
              font-weight: 800;
              text-transform: uppercase;
              color: #475569;
              margin-bottom: 1px;
              white-space: nowrap;
              width: 100%;
              overflow: hidden;
            }
            .prod-name {
              font-size: ${labelFontSize};
              font-weight: bold;
              margin-bottom: 2px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              width: 100%;
              color: #1E293B;
            }
            .category {
              font-size: 7px;
              color: #64748B;
              margin-bottom: 2px;
              white-space: nowrap;
              width: 100%;
              overflow: hidden;
            }
            .barcode-container {
              display: flex;
              justify-content: center;
              align-items: center;
              height: ${codeType === 'qrcode' ? `${qrSize}px` : barcodeHeight};
              width: 100%;
              margin: 2px 0;
            }
            .barcode-container svg {
              width: ${codeType === 'qrcode' ? `${qrSize}px` : 'auto'};
              height: ${codeType === 'qrcode' ? `${qrSize}px` : 'auto'};
            }
            .barcode-val {
              font-size: 8px;
              letter-spacing: 2px;
              margin-top: 2px;
              font-family: monospace;
              color: #475569;
            }
            .price {
              font-size: 9px;
              font-weight: bold;
              color: #1E293B;
              margin-top: 2px;
            }
          </style>
        </head>
        <body>
    `;

    const getBarcodeBarsHTML = (val: string) => {
      const startCode = 104;
      const stopCode = 106;
      const idxs: number[] = [];
      let sum = startCode;
      
      for (let i = 0; i < val.length; i++) {
        const charCode = val.charCodeAt(i);
        let v = charCode - 32;
        if (v < 0 || v > 95) v = 0;
        idxs.push(v);
        sum += (i + 1) * v;
      }
      
      const checkDigit = sum % 103;
      const symbols = [startCode, ...idxs, checkDigit, stopCode];
      
      let html = '<div class="barcode-container">';
      symbols.forEach((symIdx) => {
        const widths = CODE128_WIDTHS[symIdx];
        if (widths) {
          widths.forEach((w, idx) => {
            const isBar = idx % 2 === 0;
            const bg = isBar ? 'black' : 'transparent';
            html += `<div style="background-color:${bg} !important; width:${w * 1.1}px; height:${barcodeHeight}; flex-shrink: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>`;
          });
        }
      });
      html += '</div>';
      return html;
    };

    const getQRCodeHTML = (val: string, sizePx: number) => {
      try {
        const matrix = toQR(val);
        const n = Math.sqrt(matrix.length);
        const cellSize = sizePx / n;
        let rects = '';
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (matrix[r * n + c] === 1) {
              rects += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="black" />`;
            }
          }
        }
        return `
          <div class="barcode-container">
            <svg width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}">
              ${rects}
            </svg>
          </div>
        `;
      } catch (e) {
        console.error("QR HTML generation error", e);
        return '<div>Error QR</div>';
      }
    };

    for (let pageIdx = 0; pageIdx < pagesCount; pageIdx++) {
      htmlContent += `<div class="page"><div class="grid">`;
      
      for (let i = 0; i < perPage; i++) {
        const itemIdx = pageIdx * perPage + i;
        if (itemIdx < itemsToPrint.length) {
          const item = itemsToPrint[itemIdx];
          const barsHTML = codeType === 'qrcode'
            ? getQRCodeHTML(getScanUrl(item.barcode), qrSize)
            : getBarcodeBarsHTML(item.barcode);
          htmlContent += `
            <div class="label">
              ${showShopName ? `<div class="shop-name">${shopName}</div>` : ''}
              ${showName ? `<div class="prod-name">${item.name}</div>` : ''}
              ${showCategory && item.category ? `<div class="category">${item.category}</div>` : ''}
              ${showBarcode ? barsHTML : ''}
              ${showSKU ? `<div class="barcode-val">${item.barcode}</div>` : ''}
              ${showMRP && item.price ? `<div class="price">₹${item.price}</div>` : ''}
            </div>
          `;
        } else {
          htmlContent += '<div class="label" style="border:none;"></div>';
        }
      }
      
      htmlContent += '</div></div>';
    }

    htmlContent += `
        </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
        
        const docObj = iframe.contentWindow?.document || iframe.contentDocument;
        if (docObj) {
          docObj.open();
          docObj.write(htmlContent);
          docObj.close();
          
          setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            document.body.removeChild(iframe);
          }, 300);
        }
      } catch (e) {
        console.error("Web print failed:", e);
        alert("Failed to print barcodes on web.");
      }
      return;
    }

    try {
      await Print.printAsync({ html: htmlContent });
    } catch (e) {
      console.error("Print failed:", e);
      alert("Failed to open print options dialog.");
    }
  };

  if (role !== 'admin' && role !== 'owner' && permissions && !permissions.barcode_generation) {
    return (
      <View style={styles.accessDenied}>
        <Icon name="lock" size={64} color="#666" />
        <Text style={styles.deniedTitle}>Access Denied</Text>
        <Text style={styles.deniedText}>You do not have permission to generate barcodes.</Text>
      </View>
    );
  }

  const itemsToPrint = getItemsToPrint();
  const gridConfig = getGridConfig(barcodesPerPage);
  const totalPages = Math.max(1, Math.ceil(itemsToPrint.length / gridConfig.perPage));
  
  // Get items for currently navigated preview page
  const startIdx = previewPageIdx * gridConfig.perPage;
  const endIdx = startIdx + gridConfig.perPage;
  const previewItems = [];
  for (let i = startIdx; i < endIdx; i++) {
    if (i < itemsToPrint.length) {
      previewItems.push(itemsToPrint[i]);
    } else {
      previewItems.push(null);
    }
  }

  const chunkedRows = [];
  for (let r = 0; r < gridConfig.rows; r++) {
    const rowItems = previewItems.slice(r * gridConfig.cols, (r + 1) * gridConfig.cols);
    chunkedRows.push(rowItems);
  }

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.barcode || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>SmartPOS Barcode Workspace</Text>
        <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
          Bulk-select products, generate clothing size variants, organize print queues, and auto-arrange labels on A4 sheets.
        </Text>
      </View>

      <View style={styles.contentRow}>
        {/* Left Pane - Options, Add Options & Print Queue */}
        <View style={styles.leftPane}>
          {/* Card 1: Configuration */}
          <Card style={styles.card} elevation={0}>
            <Card.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Icon name="grid" size={20} color="#2563EB" style={{ marginRight: 8 }} />
                <Text style={styles.sectionHeading}>A4 Sheet Template Grid</Text>
              </View>
              <View style={styles.templatesGrid}>
                {['12', '24', '30', '40', '50', '80', 'custom'].map(t => {
                  const label = t === 'custom' ? 'Custom' : `${t} Labels`;
                  const isSelected = barcodesPerPage === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.templateChip, isSelected && styles.templateChipSelected]}
                      onPress={() => {
                        setBarcodesPerPage(t);
                        setPreviewPageIdx(0);
                      }}
                    >
                      <Text style={[styles.templateChipText, isSelected && styles.templateChipTextSelected]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {barcodesPerPage === 'custom' && (
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 4, marginBottom: 12 }}>
                  <TextInput 
                    label="Columns" 
                    value={customCols} 
                    onChangeText={(val) => { setCustomCols(val); setPreviewPageIdx(0); }} 
                    keyboardType="numeric" 
                    mode="outlined" 
                    left={<TextInput.Icon icon="table-column" />}
                    style={{ flex: 1, backgroundColor: 'white' }} 
                  />
                  <TextInput 
                    label="Rows" 
                    value={customRows} 
                    onChangeText={(val) => { setCustomRows(val); setPreviewPageIdx(0); }} 
                    keyboardType="numeric" 
                    mode="outlined" 
                    left={<TextInput.Icon icon="table-row" />}
                    style={{ flex: 1, backgroundColor: 'white' }} 
                  />
                </View>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
                <Icon name="qrcode-scan" size={16} color="#64748B" style={{ marginRight: 6 }} />
                <Text style={styles.labelTitle}>Code Format Type</Text>
              </View>
              <SegmentedButtons
                value={codeType}
                onValueChange={(val: any) => setCodeType(val)}
                buttons={[
                  { value: 'barcode', label: '1D Barcode' },
                  { value: 'qrcode', label: '2D QR Code' }
                ]}
                style={{ marginBottom: 12 }}
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 6 }}>
                <Icon name="tag-multiple" size={16} color="#64748B" style={{ marginRight: 6 }} />
                <Text style={styles.labelTitle}>Label Fields & Details</Text>
              </View>
              <View style={styles.checkboxGrid}>
                <View style={styles.checkboxItem}>
                  <Checkbox.Android status={showShopName ? 'checked' : 'unchecked'} onPress={() => setShowShopName(!showShopName)} color="#2563EB" />
                  <Text style={styles.checkboxLabel}>Shop Name</Text>
                </View>
                <View style={styles.checkboxItem}>
                  <Checkbox.Android status={showName ? 'checked' : 'unchecked'} onPress={() => setShowName(!showName)} color="#2563EB" />
                  <Text style={styles.checkboxLabel}>Product Name</Text>
                </View>
                <View style={styles.checkboxItem}>
                  <Checkbox.Android status={showBarcode ? 'checked' : 'unchecked'} onPress={() => setShowBarcode(!showBarcode)} color="#2563EB" />
                  <Text style={styles.checkboxLabel}>Barcode Stripes</Text>
                </View>
                <View style={styles.checkboxItem}>
                  <Checkbox.Android status={showSKU ? 'checked' : 'unchecked'} onPress={() => setShowSKU(!showSKU)} color="#2563EB" />
                  <Text style={styles.checkboxLabel}>Barcode/SKU Text</Text>
                </View>
                <View style={styles.checkboxItem}>
                  <Checkbox.Android status={showMRP ? 'checked' : 'unchecked'} onPress={() => setShowMRP(!showMRP)} color="#2563EB" />
                  <Text style={styles.checkboxLabel}>MRP Price</Text>
                </View>
                <View style={styles.checkboxItem}>
                  <Checkbox.Android status={showCategory ? 'checked' : 'unchecked'} onPress={() => setShowCategory(!showCategory)} color="#2563EB" />
                  <Text style={styles.checkboxLabel}>Category</Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Card 2: Add Items Workspace */}
          <Card style={[styles.card, { marginTop: 16 }]} elevation={0}>
            <Card.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Icon name="printer-pos" size={20} color="#2563EB" style={{ marginRight: 8 }} />
                <Text style={styles.sectionHeading}>Add Products to Printing Queue</Text>
              </View>
              <View style={styles.segmentedButtonsContainer}>
                {['inventory', 'manual', 'variants'].map(tab => {
                  const isSelected = inputTab === tab;
                  const label = tab === 'inventory' ? 'From Inventory' : (tab === 'manual' ? 'Add Manual' : 'Fashion Variants');
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.segmentedTab, isSelected && styles.segmentedTabActive]}
                      onPress={() => setInputTab(tab as any)}
                    >
                      <Text style={[styles.segmentedTabText, isSelected && styles.segmentedTabTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {inputTab === 'inventory' && (
                <View style={{ paddingVertical: 8 }}>
                  <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>
                    Quickly query your Firestore inventory to select items, specify tag quantities, and bulk-load items.
                  </Text>
                  <Button mode="contained" buttonColor="#2563EB" icon="database-search" onPress={() => { setShowInventoryDialog(true); fetchProducts(); }} style={{ borderRadius: 8 }}>
                    Generate From Inventory
                  </Button>
                </View>
              )}

              {inputTab === 'manual' && (
                <View>
                  <TextInput label="Product Name" value={productName} onChangeText={setProductName} mode="outlined" left={<TextInput.Icon icon="package-variant-closed" />} style={styles.input} activeOutlineColor="#2563EB" />
                  <TextInput label="Category" value={category} onChangeText={setCategory} mode="outlined" left={<TextInput.Icon icon="shape" />} style={styles.input} activeOutlineColor="#2563EB" />
                  <TextInput label="Barcode Value / SKU" value={barcodeValue} onChangeText={setBarcodeValue} mode="outlined" left={<TextInput.Icon icon="barcode" />} style={styles.input} activeOutlineColor="#2563EB" />
                  <TextInput label="MRP Price (₹)" value={singlePrice} onChangeText={setSinglePrice} mode="outlined" left={<TextInput.Icon icon="currency-inr" />} style={styles.input} activeOutlineColor="#2563EB" />
                  <TextInput label="Quantity (Copies)" value={copiesCount} onChangeText={setCopiesCount} mode="outlined" keyboardType="numeric" left={<TextInput.Icon icon="layers-plus" />} style={styles.input} activeOutlineColor="#2563EB" />
                  
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <Button mode="contained" icon="plus" onPress={handleAddManualToQueue} buttonColor="#2563EB" style={{ flex: 1.2, borderRadius: 8 }}>
                      Add to Queue
                    </Button>
                    <Button mode="outlined" icon="download" onPress={downloadSingleBarcodePNG} textColor="#2563EB" style={{ flex: 1, borderColor: '#2563EB', borderRadius: 8 }}>
                      Save PNG
                    </Button>
                  </View>
                </View>
              )}

              {inputTab === 'variants' && (
                <View>
                  <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                    Define individual sizes/colors for a base stock item. The system auto-generates separate child barcodes.
                  </Text>
                  
                  <Text style={styles.labelTitle}>Select Base Product</Text>
                  <View style={styles.dropdownContainerSelect}>
                    <ScrollView style={{ maxHeight: 110, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 4 }}>
                      {products.map(p => {
                        const isSelected = variantBaseProductId === p.id;
                        return (
                          <TouchableOpacity
                            key={p.id}
                            style={[styles.dropdownItemSelect, isSelected && styles.dropdownItemSelectActive]}
                            onPress={() => setVariantBaseProductId(p.id)}
                          >
                            <Text style={{ fontSize: 12, fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? '#2563EB' : '#1E293B' }}>
                              {p.name} {p.barcode ? `(SKU: ${p.barcode})` : '(No Barcode)'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      {products.length === 0 && (
                        <Text style={{ padding: 8, fontSize: 12, fontStyle: 'italic', color: '#64748B' }}>No products available in inventory</Text>
                      )}
                    </ScrollView>
                  </View>

                  <Text style={[styles.labelTitle, { marginTop: 12 }]}>OR Manual Base Name</Text>
                  <TextInput 
                    label="Manual Product Name" 
                    value={variantManualName} 
                    onChangeText={(val) => {
                      setVariantManualName(val);
                      if (val) setVariantBaseProductId(''); // clear selection if manual is typed
                    }} 
                    mode="outlined" 
                    left={<TextInput.Icon icon="pencil" />}
                    style={[styles.input, { marginBottom: 16 }]} 
                    activeOutlineColor="#2563EB" 
                  />

                  <Text style={[styles.labelTitle, { marginTop: 10 }]}>Select Sizes</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {['S', 'M', 'L', 'XL', 'XXL'].map(size => {
                      const active = variantSizes[size];
                      return (
                        <TouchableOpacity
                          key={size}
                          style={[styles.variantSizeBox, active && styles.variantSizeBoxActive]}
                          onPress={() => setVariantSizes(prev => ({ ...prev, [size]: !prev[size] }))}
                        >
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: active ? 'white' : '#475569' }}>{size}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  
                  <TextInput 
                    label="Custom Sizes (e.g. 32, 34, 36)" 
                    value={customSizes} 
                    onChangeText={setCustomSizes} 
                    mode="outlined" 
                    left={<TextInput.Icon icon="ruler" />}
                    style={styles.input} 
                    activeOutlineColor="#2563EB" 
                  />

                  <TextInput 
                    label="Colors (comma separated)" 
                    value={variantColors} 
                    onChangeText={setVariantColors} 
                    mode="outlined" 
                    left={<TextInput.Icon icon="palette" />}
                    style={styles.input} 
                    activeOutlineColor="#2563EB" 
                  />

                  <TextInput 
                    label="Print Qty per Variant" 
                    value={variantCopies} 
                    onChangeText={setVariantCopies} 
                    mode="outlined" 
                    keyboardType="numeric" 
                    left={<TextInput.Icon icon="content-copy" />}
                    style={styles.input} 
                    activeOutlineColor="#2563EB" 
                  />

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Checkbox.Android 
                      status={variantSaveToDb ? 'checked' : 'unchecked'} 
                      onPress={() => setVariantSaveToDb(!variantSaveToDb)} 
                      color="#2563EB" 
                    />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>
                      Save generated variants back to Firebase master inventory
                    </Text>
                  </View>

                  <Button mode="contained" icon="family-tree" onPress={handleAddVariantsToQueue} buttonColor="#2563EB" style={{ borderRadius: 8 }}>
                    Generate & Queue Variants
                  </Button>
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Card 3: Printing Queue Cart */}
          <Card style={[styles.card, { marginTop: 16 }]} elevation={0}>
            <Card.Content>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon name="tray-full" size={20} color="#2563EB" style={{ marginRight: 8 }} />
                    <Text style={styles.sectionHeading}>Barcode Queue</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Total labels queued: {itemsToPrint.length}</Text>
                </View>
                {printQueue.length > 0 && (
                  <Button mode="text" compact textColor="#EF4444" onPress={handleQueueClear} labelStyle={{ fontWeight: 'bold', fontSize: 11 }}>
                    Clear Queue
                  </Button>
                )}
              </View>

              {printQueue.length === 0 ? (
                <Text style={{ fontSize: 12, fontStyle: 'italic', color: '#64748B', textAlign: 'center', paddingVertical: 16 }}>
                  No Data Available (Queue is empty)
                </Text>
              ) : (
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title style={{ flex: 3 }}><Text style={styles.colHeader}>Product</Text></DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHeader}>Price</Text></DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 2.2 }}><Text style={styles.colHeader}>Copies</Text></DataTable.Title>
                  </DataTable.Header>

                  {printQueue.map((item, idx) => (
                    <DataTable.Row key={item.id || idx}>
                      <DataTable.Cell style={{ flex: 3 }}>
                        <View>
                          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: 'bold' }}>{item.name}</Text>
                          <Text style={{ fontSize: 10, color: '#64748B' }}>{item.barcode}</Text>
                        </View>
                      </DataTable.Cell>
                      <DataTable.Cell numeric style={{ flex: 1 }}><Text style={{ fontSize: 12 }}>₹{item.price}</Text></DataTable.Cell>
                      <DataTable.Cell numeric style={{ flex: 2.2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <IconButton icon="minus" size={12} style={{ margin: 0 }} onPress={() => handleQueueQuantityChange(idx, -1)} />
                          <Text style={{ width: 18, textAlign: 'center', fontSize: 12, fontWeight: 'bold' }}>{item.copies}</Text>
                          <IconButton icon="plus" size={12} style={{ margin: 0 }} onPress={() => handleQueueQuantityChange(idx, 1)} />
                          <IconButton icon="close-circle" iconColor="#EF4444" size={14} style={{ margin: 0, marginLeft: 4 }} onPress={() => handleQueueRemove(idx)} />
                        </View>
                      </DataTable.Cell>
                    </DataTable.Row>
                  ))}
                </DataTable>
              )}
            </Card.Content>
          </Card>
        </View>

        {/* Right Pane - Live A4 Page Preview & Printing */}
        <View style={styles.rightPane}>
          <Card style={styles.card} elevation={0}>
            <Card.Content style={{ alignItems: 'center' }}>
              <View style={styles.previewHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="file-document-outline" size={20} color="#2563EB" style={{ marginRight: 8 }} />
                  <Text style={styles.sectionHeading}>Live A4 Preview</Text>
                </View>
                {totalPages > 1 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <IconButton icon="chevron-left" size={16} disabled={previewPageIdx === 0} onPress={() => setPreviewPageIdx(previewPageIdx - 1)} />
                    <Text style={{ fontSize: 12, fontWeight: 'bold' }}>Page {previewPageIdx + 1} of {totalPages}</Text>
                    <IconButton icon="chevron-right" size={16} disabled={previewPageIdx >= totalPages - 1} onPress={() => setPreviewPageIdx(previewPageIdx + 1)} />
                  </View>
                )}
              </View>

              {itemsToPrint.length === 0 ? (
                <View style={styles.noPreviewBox}>
                  <Icon name="barcode" size={48} color="#94A3B8" />
                  <Text style={{ color: '#64748B', fontWeight: '600', marginTop: 12 }}>No Data Available</Text>
                  <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 4, textAlign: 'center' }}>
                    Add inventory products, manual tags, or size variants to display the printable sheets.
                  </Text>
                </View>
              ) : (
                <View style={styles.previewA4Page}>
                  <View style={styles.previewGrid}>
                    {chunkedRows.map((row, rIdx) => (
                      <View key={rIdx} style={styles.previewRow}>
                        {row.map((item, cIdx) => (
                          <View key={cIdx} style={styles.previewCol}>
                            {item ? (
                              <View style={styles.previewLabel}>
                                {showShopName && <Text style={styles.previewLabelShop} numberOfLines={1}>{shopName}</Text>}
                                {showName && <Text style={styles.previewLabelName} numberOfLines={1}>{item.name}</Text>}
                                {showCategory && <Text style={styles.previewLabelCategory} numberOfLines={1}>{cleanAndMapCategory(item.category || '').cleanName}</Text>}
                                {showBarcode && (
                                  <View style={styles.previewBarcodeContainer}>
                                    {codeType === 'qrcode' ? (
                                      <VectorQRCode 
                                        value={getScanUrl(item.barcode)} 
                                        size={gridConfig.perPage > 50 ? 24 : (gridConfig.perPage > 30 ? 36 : 48)} 
                                      />
                                    ) : (
                                      <VectorBarcode value={item.barcode} height={gridConfig.perPage > 50 ? 12 : 24} width={0.7} />
                                    )}
                                  </View>
                                )}
                                {showSKU && <Text style={styles.previewLabelSKU}>{item.barcode}</Text>}
                                {showMRP && <Text style={styles.previewLabelPrice}>₹{item.price || '0'}</Text>}
                              </View>
                            ) : (
                              <View style={styles.previewLabelEmpty} />
                            )}
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={{ flexDirection: 'row', width: '100%', gap: 12, marginTop: 16 }}>
                <Button mode="contained" icon="printer" onPress={handlePrint} buttonColor="#10B981" style={{ flex: 1, borderRadius: 8 }} contentStyle={{ paddingVertical: 6 }}>
                  Direct Print
                </Button>
                <Button mode="outlined" icon="file-pdf-box" onPress={handlePrint} textColor="#2563EB" style={{ flex: 1, borderRadius: 8, borderColor: '#2563EB' }} contentStyle={{ paddingVertical: 6 }}>
                  Export PDF
                </Button>
              </View>
            </Card.Content>
          </Card>

          {/* Card 4: Layout Templates */}
          <Card style={[styles.card, { marginTop: 16 }]} elevation={0}>
            <Card.Content>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="content-save-all" size={20} color="#2563EB" style={{ marginRight: 8 }} />
                  <Text style={styles.sectionHeading}>Saved Layout Templates</Text>
                </View>
                <Button mode="contained" buttonColor="#2563EB" icon="content-save" onPress={() => setShowSaveDialog(true)} style={{ borderRadius: 8 }} labelStyle={{ fontSize: 11, marginVertical: 4 }}>
                  Save Current
                </Button>
              </View>

              {savedTemplates.length === 0 ? (
                <Text style={{ fontSize: 12, fontStyle: 'italic', color: '#64748B', textAlign: 'center', paddingVertical: 8 }}>
                  No custom templates saved
                </Text>
              ) : (
                savedTemplates.map(t => (
                  <View key={t.id} style={styles.savedTemplateItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 13 }}>{t.name}</Text>
                      <Text style={{ fontSize: 11, color: '#64748B' }}>Grid: {t.barcodesPerPage} labels</Text>
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                      <IconButton icon="folder-open" iconColor="#2563EB" size={18} onPress={() => handleLoadTemplate(t)} />
                      <IconButton icon="delete" iconColor="#EF4444" size={18} onPress={() => handleDeleteTemplate(t.id)} />
                    </View>
                  </View>
                ))
              )}
            </Card.Content>
          </Card>
        </View>
      </View>

      {/* Inventory Picker Dialog */}
      <Portal>
        <Dialog visible={showInventoryDialog} onDismiss={() => setShowInventoryDialog(false)} style={{ backgroundColor: 'white', maxHeight: '85%' }}>
          <Dialog.Title>Select Products From Inventory</Dialog.Title>
          <Dialog.Content style={{ paddingHorizontal: 16 }}>
            <Searchbar
              placeholder="Search by name, SKU, or category..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={{ marginBottom: 12, backgroundColor: '#F8FAFC' }}
              inputStyle={{ fontSize: 13 }}
            />
            
            <ScrollView style={{ maxHeight: 300 }}>
              {filteredProducts.length === 0 ? (
                <Text style={{ color: '#64748B', fontStyle: 'italic', paddingVertical: 24, textAlign: 'center' }}>No products found</Text>
              ) : (
                <DataTable>
                  <DataTable.Header>
                    <DataTable.Title style={{ flex: 0.4 }}><Text style={styles.colHeader}>Select</Text></DataTable.Title>
                    <DataTable.Title style={{ flex: 2.2 }}><Text style={styles.colHeader}>Product</Text></DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.colHeader}>Stock</Text></DataTable.Title>
                    <DataTable.Title numeric style={{ flex: 1.8 }}><Text style={styles.colHeader}>Copies</Text></DataTable.Title>
                  </DataTable.Header>

                  {filteredProducts.map(p => {
                    const checked = !!selectedProductChecks[prodIdKey(p.id)];
                    const hasBarcode = !!p.barcode;
                    
                    return (
                      <DataTable.Row key={p.id}>
                        <DataTable.Cell style={{ flex: 0.4 }}>
                          <Checkbox.Android
                            status={checked ? 'checked' : 'unchecked'}
                            onPress={() => setSelectedProductChecks(prev => ({ ...prev, [prodIdKey(p.id)]: !prev[prodIdKey(p.id)] }))}
                            color="#2563EB"
                          />
                        </DataTable.Cell>
                        <DataTable.Cell style={{ flex: 2.2 }}>
                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: 'bold' }}>{p.name}</Text>
                            {hasBarcode ? (
                              <Text style={{ fontSize: 10, color: '#64748B' }}>SKU: {p.barcode}</Text>
                            ) : (
                              <TouchableOpacity onPress={() => handleAutoGenerateBarcode(p.id, p.name)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                <Icon name="barcode-plus" size={12} color="#EF4444" />
                                <Text style={{ fontSize: 9, color: '#EF4444', fontWeight: 'bold', marginLeft: 4 }}>Auto Generate Barcode</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </DataTable.Cell>
                        <DataTable.Cell numeric style={{ flex: 1 }}><Text style={{ fontSize: 12 }}>{p.stock_qty}</Text></DataTable.Cell>
                        <DataTable.Cell numeric style={{ flex: 1.8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                            <IconButton 
                              icon="minus" 
                              size={12} 
                              style={{ margin: 0 }} 
                              onPress={() => {
                                const current = parseInt(selectedProductCopies[prodIdKey(p.id)] || '24');
                                setSelectedProductCopies(prev => ({ ...prev, [prodIdKey(p.id)]: String(Math.max(1, current - 1)) }));
                              }} 
                            />
                            <Text style={{ width: 22, textAlign: 'center', fontSize: 11, fontWeight: 'bold' }}>
                              {selectedProductCopies[prodIdKey(p.id)] || '24'}
                            </Text>
                            <IconButton 
                              icon="plus" 
                              size={12} 
                              style={{ margin: 0 }} 
                              onPress={() => {
                                const current = parseInt(selectedProductCopies[prodIdKey(p.id)] || '24');
                                setSelectedProductCopies(prev => ({ ...prev, [prodIdKey(p.id)]: String(current + 1) }));
                              }} 
                            />
                          </View>
                        </DataTable.Cell>
                      </DataTable.Row>
                    );
                  })}
                </DataTable>
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Button onPress={() => setShowInventoryDialog(false)} textColor="#64748B">Cancel</Button>
            <Button mode="contained" onPress={handleAddSelectedInventory} buttonColor="#2563EB" style={{ borderRadius: 8 }}>
              Add Selected to Queue
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Save Template Dialog */}
      <Portal>
        <Dialog visible={showSaveDialog} onDismiss={() => setShowSaveDialog(false)}>
          <Dialog.Title>Save Template Configuration</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Template Name"
              value={templateName}
              onChangeText={setTemplateName}
              mode="outlined"
              activeOutlineColor="#2563EB"
              placeholder="e.g. My Custom 24 Label Pack"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowSaveDialog(false)} textColor="#64748B">Cancel</Button>
            <Button onPress={handleSaveTemplate} textColor="#2563EB" labelStyle={{ fontWeight: 'bold' }}>Save Template</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  function prodIdKey(id: string) {
    return id;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { paddingVertical: 24 },
  title: { fontWeight: '800' },
  contentRow: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  leftPane: { flex: 1, minWidth: 340 },
  rightPane: { flex: 1.1, minWidth: 360 },
  card: { backgroundColor: DS.colors.cardBg, borderRadius: DS.radius.lg, borderWidth: 0, ...DS.shadow.sm },
  sectionHeading: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  labelTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: '#64748B', marginBottom: 6, letterSpacing: 0.5 },
  input: { marginBottom: 12, backgroundColor: DS.colors.cardBg, height: 45 },
  colHeader: { fontWeight: 'bold', fontSize: 11, color: '#64748B' },
  
  // Templates Grid
  templatesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginBottom: 4 },
  templateChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: DS.radius.sm, borderWidth: 0, ...DS.shadow.sm, backgroundColor: DS.colors.surfaceBg },
  templateChipSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  templateChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  templateChipTextSelected: { color: '#2563EB' },
  
  // Checkbox Grid
  checkboxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  checkboxItem: { flexDirection: 'row', alignItems: 'center', width: '45%' },
  checkboxLabel: { fontSize: 12, fontWeight: '500', color: '#475569', marginLeft: 4 },

  // Segmented Buttons
  segmentedButtonsContainer: { flexDirection: 'row', borderWidth: 0, ...DS.shadow.sm, borderRadius: DS.radius.sm, padding: 3, backgroundColor: DS.colors.surfaceBg, marginBottom: 16 },
  segmentedTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: DS.radius.sm },
  segmentedTabActive: { backgroundColor: DS.colors.cardBg, ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }, default: { elevation: 1 } }) },
  segmentedTabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  segmentedTabTextActive: { color: '#2563EB', fontWeight: '700' },

  // Saved Template Row
  savedTemplateItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },

  // Variants selectors
  dropdownContainerSelect: { marginVertical: 4 },
  dropdownItemSelect: { padding: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', borderRadius: 4 },
  dropdownItemSelectActive: { backgroundColor: '#EFF6FF' },
  variantSizeBox: { width: 34, height: 34, borderRadius: DS.radius.sm, borderWidth: 0, ...DS.shadow.sm, backgroundColor: DS.colors.surfaceBg, justifyContent: 'center', alignItems: 'center' },
  variantSizeBoxActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },

  // A4 Preview
  previewHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 12 },
  noPreviewBox: { width: '100%', height: 620, backgroundColor: DS.colors.surfaceBg, borderRadius: DS.radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', padding: 24 },
  previewA4Page: {
    width: 440,
    height: 620,
    backgroundColor: DS.colors.cardBg,
    borderWidth: 0, ...DS.shadow.sm,
    padding: 12,
    alignSelf: 'center',
    justifyContent: 'space-between',
    gap: 4,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      default: {
        elevation: 2,
      }
    })
  },
  previewGrid: { flex: 1, justifyContent: 'space-between', gap: 4 },
  previewRow: { flexDirection: 'row', flex: 1, gap: 4 },
  previewCol: { flex: 1 },
  previewLabelEmpty: { flex: 1, borderStyle: 'dashed', borderWidth: 0, ...DS.shadow.sm, borderRadius: 4 },
  previewLabel: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA'
  },
  previewLabelShop: { fontSize: 7, fontWeight: '800', textTransform: 'uppercase', color: '#475569', textAlign: 'center', marginBottom: 1 },
  previewLabelName: { fontSize: 8, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  previewLabelCategory: { fontSize: 6, color: '#64748B', textAlign: 'center', marginBottom: 2 },
  previewBarcodeContainer: { width: '100%', alignItems: 'center' },
  previewLabelSKU: { fontSize: 7, fontFamily: 'monospace', color: '#475569', letterSpacing: 1, marginTop: 1 },
  previewLabelPrice: { fontSize: 8, fontWeight: '800', color: '#1E293B', marginTop: 1 },

  accessDenied: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  deniedTitle: { fontSize: 24, fontWeight: 'bold', marginTop: 16 },
  deniedText: { fontSize: 16, color: 'gray', textAlign: 'center', marginTop: 8 },
});
