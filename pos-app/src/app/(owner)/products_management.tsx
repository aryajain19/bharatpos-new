import React, { useState, useEffect } from 'react';

import { useAuth } from '../../providers/AuthProvider';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { Text, useTheme, Card, DataTable, Button, IconButton, TextInput } from 'react-native-paper';
import { db, isFirebaseConfigured, auth } from '../../lib/firebase';
import { collection, query, where, orderBy, getDocs, addDoc } from '../../lib/firestore_adapter';
import { useAppTheme } from '../../providers/ThemeProvider';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { cleanAndMapCategory } from '../../lib/ui_helpers';

export default function ProductsManagementScreen() {
  const { tenantId, loading: authLoading } = useAuth();

  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const [products, setProducts] = useState<any[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [rawInvoiceText, setRawInvoiceText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [fileLoadingMsg, setFileLoadingMsg] = useState('');
  const [showDriveModal, setShowDriveModal] = useState(false);

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
    } catch (e) {
      Alert.alert('Import Failed', e.message || 'An error occurred during import.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSimulatedFileUpload = async (type: 'pdf' | 'csv' | 'ocr') => {
    setIsFileLoading(true);
    let msg = '';
    if (type === 'pdf') msg = 'Extracting invoice rows from PDF file...';
    else if (type === 'csv') msg = 'Importing CSV distributor list...';
    else msg = 'Running OCR scanning on invoice photo...';
    setFileLoadingMsg(msg);

    await new Promise(resolve => setTimeout(resolve, 2000));
    
    let text = '';
    if (type === 'pdf') {
      text = "Britannia Marie Gold 250g, 40, 35.00, 28.00, 8901063023245\nBritannia 50-50 Maska Chaska, 50, 25.00, 20.00, 8901063030311\nBritannia Bourbon 150g, 30, 40.00, 32.00, 8901063141222";
      Alert.alert('PDF Import Success', 'Extracted 3 items from PDF invoice successfully!');
    } else if (type === 'csv') {
      text = "Maggi Noodles 70g | Qty: 100 | MRP: 14.00 | Cost: 11.50 | Barcode: 8901058002316\nNestle KitKat 38g | Qty: 50 | MRP: 25.00 | Cost: 20.00 | Barcode: 8901058860718\nNescafe Classic Coffee 50g | Qty: 20 | MRP: 160.00 | Cost: 130.00 | Barcode: 8901058190013";
      Alert.alert('CSV Import Success', 'Parsed CSV distributor columns successfully!');
    } else {
      text = "Dettol Liquid Soap 200ml - Qty: 25 - MRP: 99 - Cost: 80 - Barcode: 8901396326124\nSurf Excel Easy Wash 1kg - Qty: 15 - MRP: 140 - Cost: 112 - Barcode: 8901030752536\nVim Liquid Gel 250ml - Qty: 30 - MRP: 55 - Cost: 44 - Barcode: 8901030683410";
      Alert.alert('OCR Scan Success', 'AI Scanner successfully read 3 products from image print!');
    }
    
    setRawInvoiceText(text);
    setIsFileLoading(false);
  };

  const handleDriveImport = async (fileName: string, textContent: string) => {
    setShowDriveModal(false);
    setIsFileLoading(true);
    setFileLoadingMsg(`Downloading "${fileName}" from Google Drive...`);
    
    await new Promise(resolve => setTimeout(resolve, 1800));
    
    setRawInvoiceText(textContent);
    setIsFileLoading(false);
    Alert.alert('Google Drive Sync', `Successfully imported product records from "${fileName}"!`);
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
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="file-import" size={24} color={appTheme.colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Auto-Import from Bill / Invoice</Text>
              </View>
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
                  Google Drive
                </Button>
                
                <Button 
                  mode="outlined" 
                  icon="file-pdf-box" 
                  onPress={() => handleSimulatedFileUpload('pdf')}
                  style={{ borderColor: '#E53935', borderRadius: 8 }}
                  textColor="#E53935"
                  compact
                >
                  PDF Bill
                </Button>

                <Button 
                  mode="outlined" 
                  icon="file-delimited-outline" 
                  onPress={() => handleSimulatedFileUpload('csv')}
                  style={{ borderColor: '#43A047', borderRadius: 8 }}
                  textColor="#43A047"
                  compact
                >
                  CSV List
                </Button>

                <Button 
                  mode="outlined" 
                  icon="camera-outline" 
                  onPress={() => handleSimulatedFileUpload('ocr')}
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
                placeholder="Format example:\nBritannia Marie Gold 250g, 40, 35.00, 28.00, 8901063023245\nOR\nMaggi Noodles 70g | Qty: 100 | MRP: 14.00 | Cost: 11.50 | Barcode: 8901058002316"
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

                      {parsedItems.map((item, idx) => (
                        <DataTable.Row key={idx}>
                          <DataTable.Cell style={{ flex: 2 }}><Text style={styles.previewCellMain}>{item.name}</Text></DataTable.Cell>
                          <DataTable.Cell numeric style={{ flex: 0.8 }}><Text style={styles.previewCellSub}>{item.qty}</Text></DataTable.Cell>
                          <DataTable.Cell numeric style={{ flex: 1 }}><Text style={styles.previewCellSub}>₹{item.mrp.toFixed(2)}</Text></DataTable.Cell>
                          <DataTable.Cell numeric style={{ flex: 1.2 }}><Text style={styles.previewCellBarcode} numberOfLines={1}>{item.barcode || 'Auto-Gen'}</Text></DataTable.Cell>
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
                Confirm Import
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Google Drive Selector Modal */}
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

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
              <Text style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
                Select an invoice, purchase order, or general CSV catalog file from your synced Google Drive account:
              </Text>

              {[
                { 
                  name: 'britannia_purchase_order_2026.csv', 
                  desc: 'CSV Sheet - Modified Yesterday', 
                  content: "Britannia Marie Gold 250g, 40, 35.00, 28.00, 8901063023245\nBritannia 50-50 Maska Chaska, 50, 25.00, 20.00, 8901063030311\nBritannia Bourbon 150g, 30, 40.00, 32.00, 8901063141222"
                },
                { 
                  name: 'nestle_maggi_distribution_bill_june.pdf', 
                  desc: 'PDF Document - Modified June 15, 2026', 
                  content: "Maggi Noodles 70g | Qty: 100 | MRP: 14.00 | Cost: 11.50 | Barcode: 8901058002316\nNestle KitKat 38g | Qty: 50 | MRP: 25.00 | Cost: 20.00 | Barcode: 8901058860718\nNescafe Classic Coffee 50g | Qty: 20 | MRP: 160.00 | Cost: 130.00 | Barcode: 8901058190013"
                },
                { 
                  name: 'soap_personalcare_hul_invoice.txt', 
                  desc: 'Plain Text - Modified 3 days ago', 
                  content: "Dettol Liquid Soap 200ml - Qty: 25 - MRP: 99 - Cost: 80 - Barcode: 8901396326124\nSurf Excel Easy Wash 1kg - Qty: 15 - MRP: 140 - Cost: 112 - Barcode: 8901030752536\nVim Liquid Gel 250ml - Qty: 30 - MRP: 55 - Cost: 44 - Barcode: 8901030683410"
                }
              ].map((file, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    borderRadius: 10,
                    marginBottom: 10,
                    backgroundColor: 'white'
                  }}
                  onPress={() => handleDriveImport(file.name, file.content)}
                >
                  <Icon name={file.name.endsWith('.pdf') ? 'file-pdf-box' : file.name.endsWith('.csv') ? 'file-delimited-outline' : 'file-document-outline'} size={24} color={file.name.endsWith('.pdf') ? '#E53935' : file.name.endsWith('.csv') ? '#43A047' : '#475569'} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }} numberOfLines={1}>{file.name}</Text>
                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{file.desc}</Text>
                  </View>
                  <Icon name="cloud-download-outline" size={18} color="#94A3B8" />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={[styles.modalFooter, { backgroundColor: '#F8FAFC' }]}>
              <Button mode="outlined" onPress={() => setShowDriveModal(false)} style={{ borderRadius: 8 }}>
                Close Drive
              </Button>
            </View>
          </View>
        </View>
      </Modal>
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
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#FFFFFF', width: '100%', maxWidth: 700, maxHeight: '85%', borderRadius: 16, overflow: 'hidden', elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  modalDesc: { fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8, marginTop: 8 },
  templateContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  templateBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  templateText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  textArea: { backgroundColor: '#FCFDFE', fontSize: 13, minHeight: 120, textAlignVertical: 'top' },
  previewCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, overflow: 'hidden', marginTop: 6, backgroundColor: '#FAFAFA' },
  previewColHead: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  previewCellMain: { fontSize: 12, fontWeight: '600', color: '#1E293B' },
  previewCellSub: { fontSize: 12, color: '#475569' },
  previewCellBarcode: { fontSize: 11, fontFamily: 'monospace', color: '#64748B' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#F8FAFC' },
  modalBtn: { borderRadius: 8 },
});
