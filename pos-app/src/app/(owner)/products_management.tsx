import React, { useState, useEffect } from 'react';

import { useAuth } from '../../providers/AuthProvider';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { Text, useTheme, Card, DataTable, Button, IconButton, TextInput } from 'react-native-paper';
import { db, isFirebaseConfigured, auth } from '../../lib/firebase';
import { collection, query, where, orderBy, getDocs, addDoc, doc, updateDoc, deleteDoc } from '../../lib/firestore_adapter';
import { useAppTheme } from '../../providers/ThemeProvider';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { cleanAndMapCategory } from '../../lib/ui_helpers';
import { DS } from '../../constants/designTokens';

export default function ProductsManagementScreen() {
  const { tenantId, loading: authLoading } = useAuth();

  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const [products, setProducts] = useState<any[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [rawInvoiceText, setRawInvoiceText] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [fileLoadingMsg, setFileLoadingMsg] = useState('');
  const [showDriveModal, setShowDriveModal] = useState(false);

  // Editing state
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editMrp, setEditMrp] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [editStockQty, setEditStockQty] = useState('');
  const [editGstPct, setEditGstPct] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Preloaded Templates for testing
  const INVOICE_TEMPLATES = [
    {
      name: "Britannia Wholesaler Invoice (3 SKUs)",
      text: "Britannia Marie Gold 250g, 40, 35.00, 28.00, 8901063023245\nBritannia 50-50 Maska Chaska, 50, 25.00, 20.00, 8901063030311\nBritannia Bourbon 150g, 30, 40.00, 32.00, 8901063141222"
    },
    {
      name: "Maggi & Nestle Invoice (3 SKUs)",
      text: "Maggi Noodles 70g | Qty: 100 | MRP: 14.00 | Cost: 11.50 | Barcode: 8901058002316\nNestle KitKat 38g | Qty: 50 | MRP: 25.00 | Cost: 20.00 | Barcode: 8901058860718\nNescafe Classic Coffee 50g | Qty: 20 | MRP: 160.00 | Cost: 130.00 | Barcode: 8901058190013"
    },
    {
      name: "HUL Soap & Detergents Invoice (3 SKUs)",
      text: "Dettol Liquid Soap 200ml - Qty: 25 - MRP: 99 - Cost: 80 - Barcode: 8901396326124\nSurf Excel Easy Wash 1kg - Qty: 15 - MRP: 140 - Cost: 112 - Barcode: 8901030752536\nVim Liquid Gel 250ml - Qty: 30 - MRP: 55 - Cost: 44 - Barcode: 8901030683410"
    }
  ];

  // Real-time parsing helper
  const parsedItems = React.useMemo(() => {
    if (!rawInvoiceText.trim()) return [];
    const lines = rawInvoiceText.split('\n');
    const items: any[] = [];
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      // Try CSV format: Name, Qty, MRP, Cost, Barcode
      const csvParts = trimmed.split(',').map(s => s.trim());
      if (csvParts.length >= 3 && !isNaN(parseFloat(csvParts[1]))) {
        const name = csvParts[0];
        const qty = parseInt(csvParts[1]) || 0;
        const mrp = parseFloat(csvParts[2]) || 0;
        const cost = csvParts[3] ? parseFloat(csvParts[3]) : mrp * 0.8;
        const barcode = csvParts[4] || '';
        if (name && qty > 0 && mrp > 0) {
          items.push({ name, qty, mrp, cost, barcode });
          return;
        }
      }
      
      // Try Key-Value/Regex parse formats
      const barcodeMatch = trimmed.match(/\b(890\d{10}|\d{8,14})\b/);
      const barcode = barcodeMatch ? barcodeMatch[0] : '';
      
      const qtyMatch = trimmed.match(/(?:qty|quantity|units|items|pcs|x)\s*[:\-\s]*\s*(\d+)/i) || trimmed.match(/,\s*(\d+)\s*,/);
      const qty = qtyMatch ? parseInt(qtyMatch[1]) : 10;
      
      const mrpMatch = trimmed.match(/(?:mrp|selling|price|m\.r\.p\.)\s*[:\-\s]*\s*(\d+(?:\.\d+)?)/i);
      const mrp = mrpMatch ? parseFloat(mrpMatch[1]) : 50;
      
      const costMatch = trimmed.match(/(?:cost|purchase|rate|wholesale)\s*[:\-\s]*\s*(\d+(?:\.\d+)?)/i);
      const cost = costMatch ? parseFloat(costMatch[1]) : mrp * 0.8;
      
      let name = trimmed
        .replace(barcode, '')
        .replace(/(?:qty|quantity|units|items|pcs|x)\s*[:\-\s]*\s*\d+/i, '')
        .replace(/(?:mrp|selling|price|m\.r\.p\.)\s*[:\-\s]*\s*\d+(?:\.\d+)?/i, '')
        .replace(/(?:cost|purchase|rate|wholesale)\s*[:\-\s]*\s*\d+(?:\.\d+)?/i, '')
        .replace(/[|\-,;]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
        
      if (name.length > 2) {
        items.push({ name, qty, mrp, cost, barcode });
      }
    });
    return items;
  }, [rawInvoiceText]);

  const handleImportSubmit = async () => {
    if (parsedItems.length === 0) {
      Alert.alert('No Items Found', 'Please enter or select a valid item list to import.');
      return;
    }
    
    setIsImporting(true);
    try {
      for (const item of parsedItems) {
        // Map category dynamically based on name
        let category = 'Grocery';
        const nameLower = item.name.toLowerCase();
        if (nameLower.includes('tea') || nameLower.includes('coffee') || nameLower.includes('juice') || nameLower.includes('drink')) {
          category = 'Beverages';
        } else if (nameLower.includes('biscuit') || nameLower.includes('cookie') || nameLower.includes('chips') || nameLower.includes('noodles') || nameLower.includes('bhujia') || nameLower.includes('snacks')) {
          category = 'Snacks';
        } else if (nameLower.includes('soap') || nameLower.includes('wash') || nameLower.includes('paste') || nameLower.includes('shampoo') || nameLower.includes('gel')) {
          category = 'Personal Care';
        } else if (nameLower.includes('detergent') || nameLower.includes('clean') || nameLower.includes('vim') || nameLower.includes('surf')) {
          category = 'Cleaning';
        } else if (nameLower.includes('butter') || nameLower.includes('milk') || nameLower.includes('cheese')) {
          category = 'Dairy';
        }

        // Generate EAN-13 barcode if missing
        let finalBarcode = item.barcode;
        if (!finalBarcode) {
          let hash = 0;
          const seedStr = tenantId || 'random';
          for (let i = 0; i < seedStr.length; i++) {
            hash = (hash + seedStr.charCodeAt(i)) % 10000;
          }
          const storePrefix = hash.toString().padStart(4, '0');
          const randomDigits = Math.floor(10000 + Math.random() * 90000).toString();
          const base = '890' + storePrefix + randomDigits;
          let sum = 0;
          for (let i = 0; i < 12; i++) {
            sum += parseInt(base.charAt(i)) * (i % 2 === 0 ? 1 : 3);
          }
          const checkDigit = (10 - (sum % 10)) % 10;
          finalBarcode = base + checkDigit;
        }

        await addDoc(collection(db, 'products'), {
          name: item.name,
          category: category,
          barcode: finalBarcode,
          mrp: item.mrp,
          selling_price: item.mrp, // Default selling price to MRP
          stock_qty: item.qty,
          gst_pct: 18, // Default 18% GST for imported invoice items
          tenant_id: tenantId || 'anonymous',
          created_at: new Date().toISOString()
        });
      }
      
      Alert.alert('Import Successful', `Successfully imported ${parsedItems.length} items to your product list!`);
      setShowImportModal(false);
      setRawInvoiceText('');
      fetchProducts();
    } catch (e: any) {
      Alert.alert('Import Failed', e.message || 'An error occurred during import.');
    } finally {
      setIsImporting(false);
    }
  };

  // Dynamic PDF.js worker loading for real PDF parsing
  const loadPdfJS = () => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Window is not defined.'));
        return;
      }
      if ((window as any).pdfjsLib) {
        resolve((window as any).pdfjsLib);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        resolve(pdfjsLib);
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js script.'));
      document.body.appendChild(script);
    });
  };

  const handleRealFileUpload = async (accept: string) => {
    if (typeof document === 'undefined') return;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = accept;
    
    fileInput.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;

      setIsFileLoading(true);
      setFileLoadingMsg(`Reading file "${file.name}"...`);

      try {
        if (file.name.toLowerCase().endsWith('.pdf')) {
          setFileLoadingMsg(`Parsing PDF text content...`);
          const reader = new FileReader();
          reader.onload = async (evt: any) => {
            try {
              const arrayBuffer = evt.target.result as ArrayBuffer;
              const pdfjsLib: any = await loadPdfJS();
              const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
              
              let extractedText = '';
              for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');
                extractedText += pageText + '\n';
              }

              if (!extractedText.trim()) {
                throw new Error('No readable text found in PDF. Make sure it is not a scanned image.');
              }

              setRawInvoiceText(extractedText);
              Alert.alert('PDF Parsing Success', `Extracted text from "${file.name}" successfully!`);
            } catch (err: any) {
              Alert.alert('PDF Parsing Error', err.message || 'Failed to extract text from the PDF file.');
            } finally {
              setIsFileLoading(false);
            }
          };
          reader.readAsArrayBuffer(file);
        } else {
          // Standard CSV / Text files
          const reader = new FileReader();
          reader.onload = (evt: any) => {
            const text = evt.target.result;
            setRawInvoiceText(text);
            setIsFileLoading(false);
            Alert.alert('File Upload Success', `Loaded "${file.name}" successfully!`);
          };
          reader.readAsText(file);
        }
      } catch (err: any) {
        Alert.alert('File Upload Error', err.message || 'Failed to read the file.');
        setIsFileLoading(false);
      }
    };

    fileInput.click();
  };

  const handleDriveImport = async (driveUrl: string) => {
    if (!driveUrl.trim()) {
      Alert.alert('Error', 'Please enter a valid Google Drive file/sheet share link.');
      return;
    }

    let fileId = '';
    const sheetMatch = driveUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const idMatch = driveUrl.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (sheetMatch) {
      fileId = sheetMatch[1];
    } else if (idMatch) {
      fileId = idMatch[1];
    } else {
      fileId = driveUrl.trim(); // assume direct file ID
    }

    setShowDriveModal(false);
    setIsFileLoading(true);
    setFileLoadingMsg(`Downloading file from Google Drive...`);

    try {
      // 1. Try fetching as exported Google Sheet (CSV format)
      const exportUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`;
      const response = await fetch(exportUrl);
      if (!response.ok) {
        // 2. Fallback to direct raw file download
        const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        const resp2 = await fetch(directUrl);
        if (!resp2.ok) {
          throw new Error('Failed to retrieve Google Drive file. Ensure the file is shared publicly as "Anyone with link".');
        }
        const text = await resp2.text();
        setRawInvoiceText(text);
      } else {
        const csvText = await response.text();
        setRawInvoiceText(csvText);
      }
      Alert.alert('Google Drive Sync Success', 'Successfully fetched and imported file content!');
    } catch (e: any) {
      Alert.alert('Google Drive Error', e.message || 'Failed to fetch the file.');
    } finally {
      setIsFileLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && tenantId) {
      fetchProducts();
    }
  }, [authLoading, tenantId]);

  const fetchProducts = async () => {
    if (!isFirebaseConfigured) return;
    try {
      if (!tenantId) return;
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

  const handleDeleteProduct = (product: any) => {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to delete ${product.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'products', product.id));
              Alert.alert("Success", "Product deleted successfully");
              fetchProducts();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete product");
            }
          }
        }
      ]
    );
  };

  const openEditModal = (product: any) => {
    setEditingProduct(product);
    setEditName(product.name || '');
    setEditCategory(product.category || '');
    setEditBarcode(product.barcode || '');
    setEditMrp(String(product.mrp || ''));
    setEditSellingPrice(String(product.selling_price || ''));
    setEditStockQty(String(product.stock_qty || '0'));
    setEditGstPct(String(product.gst_pct || '0'));
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    if (!editName.trim() || !editSellingPrice.trim()) {
      Alert.alert("Validation Error", "Product Name and Selling Price are required");
      return;
    }
    setSavingEdit(true);
    try {
      await updateDoc(doc(db, 'products', editingProduct.id), {
        name: editName,
        category: editCategory,
        barcode: editBarcode,
        mrp: parseFloat(editMrp) || parseFloat(editSellingPrice),
        selling_price: parseFloat(editSellingPrice),
        stock_qty: parseInt(editStockQty) || 0,
        gst_pct: parseFloat(editGstPct) || 0
      });
      Alert.alert("Success", "Product updated successfully");
      setEditingProduct(null);
      fetchProducts();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update product");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Products</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button 
            mode="outlined" 
            onPress={() => setShowImportModal(true)} 
            style={[styles.addBtn, { borderColor: appTheme.colors.primary }]}
            contentStyle={{ paddingHorizontal: 8 }}
            textColor={appTheme.colors.primary}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="file-import-outline" size={16} color={appTheme.colors.primary} style={{ marginRight: 4 }} />
              <Text style={{ color: appTheme.colors.primary, fontWeight: 'bold', fontSize: 13 }}>Import from Bill</Text>
            </View>
          </Button>
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
                         <TouchableOpacity style={{ marginRight: 12 }} onPress={() => openEditModal(item)}>
                           <Icon name="pencil-outline" size={18} color="#2196F3" />
                         </TouchableOpacity>
                         <TouchableOpacity onPress={() => handleDeleteProduct(item)}>
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

      {/* Auto-Import from Purchase Bill / Invoice Dialog */}
      <Modal
        visible={showImportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Auto-Import Product List</Text>
              <IconButton icon="close" size={20} onPress={() => setShowImportModal(false)} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
              <Text style={styles.modalDesc}>
                Paste your distributor's item list, bill details, or purchase log below. BharatPOS will automatically parse name, quantity, price, and barcode.
              </Text>

              {/* Multi-Input Options */}
              <Text style={styles.sectionLabel}>Select Input Source / Import Option:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <Button 
                  mode="outlined" 
                  icon="google-drive" 
                  onPress={() => setShowDriveModal(true)}
                  style={{ borderColor: '#34A853', borderRadius: 8 }}
                  textColor="#34A853"
                  compact
                >
                  Google Drive Link
                </Button>
                <Button 
                  mode="outlined" 
                  icon="file-pdf-box" 
                  onPress={() => handleRealFileUpload('.pdf')}
                  style={{ borderColor: '#E53935', borderRadius: 8 }}
                  textColor="#E53935"
                  compact
                >
                  PDF Bill
                </Button>
                <Button 
                  mode="outlined" 
                  icon="file-delimited-outline" 
                  onPress={() => handleRealFileUpload('.csv,.txt')}
                  style={{ borderColor: '#43A047', borderRadius: 8 }}
                  textColor="#43A047"
                  compact
                >
                  CSV List
                </Button>
                <Button 
                  mode="outlined" 
                  icon="camera-outline" 
                  onPress={() => handleRealFileUpload('image/*')}
                  style={{ borderColor: '#F57C00', borderRadius: 8 }}
                  textColor="#F57C00"
                  compact
                >
                  Scan Photo (OCR)
                </Button>
              </View>

              {/* Templates */}
              <Text style={styles.sectionLabel}>Select Sample Distributor Template:</Text>
              <View style={styles.templateContainer}>
                {INVOICE_TEMPLATES.map((tmpl, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.templateBadge}
                    onPress={() => setRawInvoiceText(tmpl.text)}
                  >
                    <Text style={styles.templateText}>{tmpl.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* File Loading Feedback */}
              {isFileLoading && (
                <Card style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, marginBottom: 14 }} elevation={0}>
                  <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
                    <ActivityIndicator size="small" color="#10B981" />
                    <Text style={{ fontSize: 13, color: '#475569', fontWeight: '500' }}>{fileLoadingMsg}</Text>
                  </Card.Content>
                </Card>
              )}

              {/* Input text area */}
              <TextInput
                label="Invoice Bill / Purchase List Raw Content"
                value={rawInvoiceText}
                onChangeText={setRawInvoiceText}
                mode="outlined"
                multiline
                numberOfLines={6}
                style={styles.textArea}
                placeholder={"Format example:\nBritannia Marie Gold 250g, 40, 35.00, 28.00, 8901063023245\nOR\nMaggi Noodles 70g | Qty: 100 | MRP: 14.00 | Cost: 11.50 | Barcode: 8901058002316"}
              />

              {/* Parser Real-time Preview */}
              {parsedItems.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.sectionLabel}>Parsed Items Preview ({parsedItems.length} found):</Text>
                  <Card style={styles.previewCard} elevation={0}>
                    <DataTable>
                      <DataTable.Header>
                        <DataTable.Title style={{ flex: 2 }}><Text style={styles.previewColHead}>Name</Text></DataTable.Title>
                        <DataTable.Title numeric style={{ flex: 0.8 }}><Text style={styles.previewColHead}>Qty</Text></DataTable.Title>
                        <DataTable.Title numeric style={{ flex: 1 }}><Text style={styles.previewColHead}>MRP</Text></DataTable.Title>
                        <DataTable.Title numeric style={{ flex: 1.2 }}><Text style={styles.previewColHead}>Barcode</Text></DataTable.Title>
                      </DataTable.Header>

                      {parsedItems.map((pItem, idx) => (
                        <DataTable.Row key={idx}>
                          <DataTable.Cell style={{ flex: 2 }}><Text style={styles.previewCellMain}>{pItem.name}</Text></DataTable.Cell>
                          <DataTable.Cell numeric style={{ flex: 0.8 }}><Text style={styles.previewCellSub}>{pItem.qty}</Text></DataTable.Cell>
                          <DataTable.Cell numeric style={{ flex: 1 }}><Text style={styles.previewCellSub}>₹{pItem.mrp.toFixed(2)}</Text></DataTable.Cell>
                          <DataTable.Cell numeric style={{ flex: 1.2 }}><Text style={styles.previewCellBarcode} numberOfLines={1}>{pItem.barcode || 'Auto-Gen'}</Text></DataTable.Cell>
                        </DataTable.Row>
                      ))}
                    </DataTable>
                  </Card>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                mode="outlined"
                onPress={() => { setShowImportModal(false); setRawInvoiceText(''); }}
                style={[styles.modalBtn, { marginRight: 8 }]}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleImportSubmit}
                loading={isImporting}
                disabled={isImporting || parsedItems.length === 0}
                style={styles.modalBtn}
              >
                Add {parsedItems.length} Products to Catalog
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Google Drive Link Input Modal */}
      <Modal
        visible={showDriveModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDriveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxWidth: 500 }]}>
            <View style={[styles.modalHeader, { backgroundColor: '#F0FDF4' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="google-drive" size={24} color="#34A853" style={{ marginRight: 8 }} />
                <Text style={[styles.modalTitle, { color: '#166534' }]}>Import from Google Drive</Text>
              </View>
              <IconButton icon="close" size={20} onPress={() => setShowDriveModal(false)} />
            </View>

            <View style={{ padding: 20 }}>
              <Text style={{ fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 12 }}>
                Enter the shareable link of a public Google Spreadsheet or text file. Make sure the file is set to "Anyone with link" can view.
              </Text>

              <TextInput
                label="Public Google Drive Share Link / File ID"
                placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                value={driveUrl}
                onChangeText={setDriveUrl}
                mode="outlined"
                style={{ marginBottom: 16 }}
              />

              <Button 
                mode="contained" 
                onPress={() => handleDriveImport(driveUrl)}
                loading={isFileLoading}
                disabled={isFileLoading || !driveUrl.trim()}
                style={{ borderRadius: 8, backgroundColor: '#34A853', paddingVertical: 4 }}
                contentStyle={{ height: 44 }}
              >
                Sync & Download
              </Button>
            </View>

            <View style={[styles.modalFooter, { backgroundColor: '#F8FAFC' }]}>
              <Button mode="outlined" onPress={() => setShowDriveModal(false)} style={{ borderRadius: 8 }}>
                Cancel
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Product Modal */}
      <Modal
        visible={editingProduct !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditingProduct(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxWidth: 500 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Product</Text>
              <IconButton icon="close" size={20} onPress={() => setEditingProduct(null)} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ padding: 20 }}>
              <TextInput
                label="Product Name"
                value={editName}
                onChangeText={setEditName}
                mode="outlined"
                style={{ marginBottom: 12 }}
              />
              <TextInput
                label="Category"
                value={editCategory}
                onChangeText={setEditCategory}
                mode="outlined"
                style={{ marginBottom: 12 }}
              />
              <TextInput
                label="Barcode"
                value={editBarcode}
                onChangeText={setEditBarcode}
                mode="outlined"
                style={{ marginBottom: 12 }}
              />
              <TextInput
                label="MRP"
                value={editMrp}
                onChangeText={setEditMrp}
                keyboardType="numeric"
                mode="outlined"
                style={{ marginBottom: 12 }}
              />
              <TextInput
                label="Selling Price"
                value={editSellingPrice}
                onChangeText={setEditSellingPrice}
                keyboardType="numeric"
                mode="outlined"
                style={{ marginBottom: 12 }}
              />
              <TextInput
                label="Stock Quantity"
                value={editStockQty}
                onChangeText={setEditStockQty}
                keyboardType="numeric"
                mode="outlined"
                style={{ marginBottom: 12 }}
              />
              <TextInput
                label="GST Percentage"
                value={editGstPct}
                onChangeText={setEditGstPct}
                keyboardType="numeric"
                mode="outlined"
                style={{ marginBottom: 20 }}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                mode="outlined"
                onPress={() => setEditingProduct(null)}
                style={[styles.modalBtn, { marginRight: 8 }]}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSaveEdit}
                loading={savingEdit}
                disabled={savingEdit}
                style={styles.modalBtn}
              >
                Save Changes
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: DS.space.lg, backgroundColor: DS.colors.surfaceBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.space.md },
  title: { fontSize: 18, fontWeight: 'bold', color: DS.colors.text },
  addBtn: { borderRadius: DS.radius.sm },
  card: { backgroundColor: DS.colors.cardBg, borderRadius: DS.radius.lg, overflow: 'hidden', borderWidth: 0, ...DS.shadow.sm },
  tableHeader: { borderBottomWidth: 1, borderBottomColor: DS.colors.border },
  colHeader: { fontWeight: 'bold', color: DS.colors.textSecondary, fontSize: 12 },
  tableRow: { borderBottomWidth: 1, borderBottomColor: DS.colors.borderLight },
  cellMainText: { fontWeight: '600', fontSize: 13, color: DS.colors.text },
  cellSubText: { color: DS.colors.textSecondary, fontSize: 13 },
  statusContainer: { flexDirection: 'row', alignItems: 'center' },
  statusText: { fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  actionIcons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', width: '100%' },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: DS.colors.cardBg, width: '100%', maxWidth: 700, maxHeight: '85%', borderRadius: DS.radius.lg, overflow: 'hidden', ...DS.shadow.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: DS.colors.border },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: DS.colors.text },
  modalDesc: { fontSize: 13, color: DS.colors.textSecondary, lineHeight: 18, marginBottom: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: DS.colors.text, marginBottom: 8, marginTop: 8 },
  templateContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  templateBadge: { backgroundColor: DS.colors.borderLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: DS.colors.border },
  templateText: { fontSize: 11, fontWeight: '600', color: DS.colors.textSecondary },
  textArea: { backgroundColor: DS.colors.surfaceBg, fontSize: 13, minHeight: 120, textAlignVertical: 'top' },
  previewCard: { borderWidth: 1, borderColor: DS.colors.border, borderRadius: DS.radius.sm, overflow: 'hidden', marginTop: 6, backgroundColor: DS.colors.surfaceBg },
  previewColHead: { fontSize: 11, fontWeight: '700', color: DS.colors.textSecondary },
  previewCellMain: { fontSize: 12, fontWeight: '600', color: DS.colors.text },
  previewCellSub: { fontSize: 12, color: DS.colors.textSecondary },
  previewCellBarcode: { fontSize: 11, fontFamily: 'monospace', color: DS.colors.textMuted },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, borderTopWidth: 1, borderTopColor: DS.colors.border, backgroundColor: DS.colors.surfaceBg },
  modalBtn: { borderRadius: DS.radius.sm },
});
