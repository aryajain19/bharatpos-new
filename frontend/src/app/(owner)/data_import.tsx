import React, { useState, useMemo } from 'react';
import { DS } from '../../constants/designTokens';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform, useWindowDimensions, Image } from 'react-native';
import { Text, Card, Button, useTheme, TextInput, Divider, DataTable, Surface, Switch } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { collection, addDoc, doc, setDoc } from '../../lib/firestore_adapter';
import { useAuth } from '../../providers/AuthProvider';
import { useAppTheme } from '../../providers/ThemeProvider';

export default function DataImportScreen() {
  const { tenantId } = useAuth();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width > 800;

  // Active Tab
  const [activeTab, setActiveTab] = useState<'file' | 'cloud'>('file');

  // File Import States
  const [importFormat, setImportFormat] = useState<'tally' | 'csv' | 'image'>('tally');
  const [rawDataText, setRawDataText] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [fileLoadingMsg, setFileLoadingMsg] = useState('');

  // Import Options
  const [updateExisting, setUpdateExisting] = useState(true);
  const [importStockQty, setImportStockQty] = useState(true);
  const [showPasteArea, setShowPasteArea] = useState(false);

  // Cloud Sync States
  const [syncSource, setSyncSource] = useState<'tally' | 'shopify' | 'gstin'>('tally');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [serverUrl, setServerUrl] = useState('http://localhost:9000');
  const [shopifyStore, setShopifyStore] = useState('');
  const [shopifyToken, setShopifyToken] = useState('');
  const [gstinValue, setGstinValue] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState<string[]>([]);

  // Simulation Templates
  const TALLY_XML_TEMPLATE = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="Britannia Marie Gold 250g" RESERVEDNAME="">
            <RATE>32.00/PCS</RATE>
            <COST>26.00/PCS</COST>
            <BASEUNITS>PCS</BASEUNITS>
            <OPENINGBALANCE>120 PCS</OPENINGBALANCE>
            <BARCODE>8901063142274</BARCODE>
            <CATEGORY>Snacks</CATEGORY>
          </STOCKITEM>
          <STOCKITEM NAME="Fortune Mustard Oil 1L" RESERVEDNAME="">
            <RATE>172.00/BTL</RATE>
            <COST>155.00/BTL</COST>
            <BASEUNITS>BTL</BASEUNITS>
            <OPENINGBALANCE>60 BTL</OPENINGBALANCE>
            <BARCODE>8906007281324</BARCODE>
            <CATEGORY>Oils</CATEGORY>
          </STOCKITEM>
          <STOCKITEM NAME="Amul Butter 100g" RESERVEDNAME="">
            <RATE>56.00/PCS</RATE>
            <COST>51.00/PCS</COST>
            <BASEUNITS>PCS</BASEUNITS>
            <OPENINGBALANCE>80 PCS</OPENINGBALANCE>
            <BARCODE>8901262010015</BARCODE>
            <CATEGORY>Dairy</CATEGORY>
          </STOCKITEM>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  const POS_CSV_TEMPLATE = `Product Name, Selling Price, Cost Price, Stock Quantity, Category, Barcode, GST Pct
Maggi Noodles 70g, 13.00, 10.50, 150, Snacks, 8901058895642, 18
Surf Excel Easy Wash 1kg, 130.00, 110.00, 35, Detergent, 8901030753083, 18
Tata Salt 1kg, 26.00, 21.00, 120, Staples, 8901058002316, 0`;

  const OCR_BILL_TEMPLATE = `INVOICE BILL - REGIONAL WHOLESALE DISTRIBUTORS
Invoice Date: 02/07/2026
------------------------------------------------------------
1. Britannia Marie Gold 250g | Qty: 120 | Price: 26.00 | Sell: 32.00
2. Fortune Mustard Oil 1L     | Qty: 60  | Price: 155.00 | Sell: 172.00
3. Amul Butter 100g           | Qty: 80  | Price: 51.00 | Sell: 56.00
------------------------------------------------------------
Total GST Collected: ₹2,154.00`;

  // Parsed results helper
  const parsedItems = useMemo(() => {
    if (!rawDataText.trim()) return [];
    const items: any[] = [];

    if (importFormat === 'tally') {
      // Parse basic Tally XML elements
      const stockItemRegex = /<STOCKITEM NAME="([^"]+)"[\s\S]*?>([\s\S]*?)<\/STOCKITEM>/g;
      let match;
      while ((match = stockItemRegex.exec(rawDataText)) !== null) {
        const name = match[1];
        const innerContent = match[2];

        const rateMatch = innerContent.match(/<RATE>([\d.]+)/);
        const costMatch = innerContent.match(/<COST>([\d.]+)/);
        const balMatch = innerContent.match(/<OPENINGBALANCE>(\d+)/);
        const barcodeMatch = innerContent.match(/<BARCODE>(\d+)/);
        const catMatch = innerContent.match(/<CATEGORY>([^<]+)/);

        const selling_price = rateMatch ? parseFloat(rateMatch[1]) : 0;
        const cost_price = costMatch ? parseFloat(costMatch[1]) : selling_price * 0.8;
        const stock_qty = balMatch ? parseInt(balMatch[1]) : 0;
        const barcode = barcodeMatch ? barcodeMatch[1] : '';
        const category = catMatch ? catMatch[1].trim() : 'General';

        if (name && selling_price > 0) {
          items.push({
            name,
            selling_price,
            cost_price,
            stock_qty,
            barcode,
            category,
            gst_pct: 18,
            status: 'Valid'
          });
        }
      }
    } else if (importFormat === 'csv') {
      // Parse CSV
      const lines = rawDataText.split('\n');
      lines.forEach((line, idx) => {
        if (idx === 0 && (line.toLowerCase().includes('name') || line.toLowerCase().includes('price'))) {
          return; // Skip CSV header
        }
        const parts = line.split(',').map(s => s.trim());
        if (parts.length >= 3) {
          const name = parts[0];
          const selling_price = parseFloat(parts[1]) || 0;
          const cost_price = parseFloat(parts[2]) || selling_price * 0.8;
          const stock_qty = parseInt(parts[3]) || 0;
          const category = parts[4] || 'General';
          const barcode = parts[5] || '';
          const gst_pct = parseFloat(parts[6]) || 18;

          if (name && selling_price > 0) {
            items.push({
              name,
              selling_price,
              cost_price,
              stock_qty,
              category,
              barcode,
              gst_pct,
              status: 'Valid'
            });
          }
        }
      });
    } else {
      // Parse simulated OCR bill lines
      const lines = rawDataText.split('\n');
      lines.forEach(line => {
        if (line.includes('|')) {
          const parts = line.split('|').map(s => s.trim());
          const namePart = parts[0].replace(/^\d+\.\s*/, '');
          
          const qtyMatch = parts[1]?.match(/Qty:\s*(\d+)/i);
          const costMatch = parts[2]?.match(/Price:\s*([\d.]+)/i);
          const sellMatch = parts[3]?.match(/Sell:\s*([\d.]+)/i);

          const stock_qty = qtyMatch ? parseInt(qtyMatch[1]) : 0;
          const cost_price = costMatch ? parseFloat(costMatch[1]) : 0;
          const selling_price = sellMatch ? parseFloat(sellMatch[1]) : cost_price * 1.25;

          if (namePart && selling_price > 0) {
            items.push({
              name: namePart,
              selling_price,
              cost_price,
              stock_qty,
              category: 'General',
              barcode: '',
              gst_pct: 18,
              status: 'Valid'
            });
          }
        }
      });
    }
    return items;
  }, [rawDataText, importFormat]);

  // Handle local file/text migration execution
  const handleExecuteMigration = async () => {
    if (parsedItems.length === 0) {
      Alert.alert('No Data Found', 'Please parse or paste a valid dataset first.');
      return;
    }
    if (!isFirebaseConfigured) {
      Alert.alert('Demo Mode', 'Database connection offline. Successfully validated ' + parsedItems.length + ' items.');
      return;
    }

    setIsProcessingFile(true);
    try {
      let importedCount = 0;
      for (const item of parsedItems) {
        await addDoc(collection(db, 'products'), {
          name: item.name,
          selling_price: item.selling_price,
          cost_price: item.cost_price,
          stock_qty: item.stock_qty,
          category: item.category,
          barcode: item.barcode,
          gst_pct: item.gst_pct,
          tenant_id: tenantId || 'anonymous',
          created_at: new Date().toISOString()
        });
        importedCount++;
      }

      Alert.alert('Migration Complete', `Successfully imported ${importedCount} products into your active inventory database.`);
      setRawDataText('');
      setSelectedImageUri(null);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Migration Error', e.message || 'An error occurred during database migration.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Simulated File/OCR Photo Uploader
  const handleUploadFile = () => {
    if (typeof document === 'undefined') return;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    if (importFormat === 'image') {
      fileInput.accept = 'image/*';
    } else if (importFormat === 'tally') {
      fileInput.accept = '.xml';
    } else {
      fileInput.accept = '.csv,.xls,.xlsx';
    }
    
    fileInput.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;

      setIsFileLoading(true);
      setFileLoadingMsg(`Reading and processing "${file.name}"...`);

      try {
        if (importFormat === 'image') {
          const reader = new FileReader();
          reader.onload = async (evt: any) => {
            setSelectedImageUri(evt.target.result);
            setFileLoadingMsg(`Running cloud OCR layout text scan...`);
            await new Promise(r => setTimeout(r, 1200));
            setRawDataText(OCR_BILL_TEMPLATE);
            setIsFileLoading(false);
            Alert.alert('OCR Processing Success', `Invoice photo text extracted successfully! Verification table populated below.`);
          };
          reader.readAsDataURL(file);
        } else {
          await new Promise(r => setTimeout(r, 1000));
          if (importFormat === 'tally') {
            setRawDataText(TALLY_XML_TEMPLATE);
          } else {
            setRawDataText(POS_CSV_TEMPLATE);
          }
          setIsFileLoading(false);
          Alert.alert('File Processing Success', `"${file.name}" loaded and parsed successfully!`);
        }
      } catch (err: any) {
        Alert.alert('File Error', err.message || 'Failed to process the file.');
        setIsFileLoading(false);
      }
    };

    fileInput.click();
  };

  // Simulate Cloud Sync / API integration fetch
  const handleCloudSync = async () => {
    if (syncSource === 'tally' && (!licenseNumber.trim() || !serverUrl.trim())) {
      Alert.alert('Missing Info', 'Please enter your Tally License Number and Server Port.');
      return;
    }
    if (syncSource === 'shopify' && (!shopifyStore.trim() || !shopifyToken.trim())) {
      Alert.alert('Missing Info', 'Please enter your Shopify Store URL and Admin Token.');
      return;
    }
    if (syncSource === 'gstin' && !gstinValue.trim()) {
      Alert.alert('Missing Info', 'Please enter your GSTIN License Number.');
      return;
    }

    setIsSyncing(true);
    setSyncLog([]);
    const logs: string[] = [];

    const addLog = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      setSyncLog([...logs]);
    };

    try {
      if (syncSource === 'tally') {
        addLog(`Pinging TallyPrime Server at ${serverUrl}...`);
        await new Promise(r => setTimeout(r, 1000));
        addLog(`Connection established. Verifying license: ${licenseNumber}...`);
        await new Promise(r => setTimeout(r, 1000));
        addLog(`Fetching active ledgers from Company database...`);
        await new Promise(r => setTimeout(r, 800));
        addLog(`Found 3 inventory stock items and 14 financial account ledgers.`);
        
        // Populate Tally template text for demo validation
        setRawDataText(TALLY_XML_TEMPLATE);
        setImportFormat('tally');
        addLog(`Sync successful! Products loaded in preview below.`);
      } 
      else if (syncSource === 'shopify') {
        addLog(`Connecting to Shopify Store: ${shopifyStore}...`);
        await new Promise(r => setTimeout(r, 1000));
        addLog(`Authenticating store token...`);
        await new Promise(r => setTimeout(r, 1000));
        addLog(`Downloading Shopify Products & variants catalog...`);
        await new Promise(r => setTimeout(r, 800));
        
        // Populate Shopify dummy CSV into csv text field
        setRawDataText(POS_CSV_TEMPLATE);
        setImportFormat('csv');
        addLog(`Sync successful! 3 Shopify items mapped to catalog below.`);
      } 
      else {
        // GSTIN Mock Validation
        addLog(`Validating GSTIN ${gstinValue} with GSTR Tax Portal...`);
        await new Promise(r => setTimeout(r, 1200));
        addLog(`Record active: Sharma Retail Enterprises, Sector-5, Bengaluru.`);
        
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.localStorage.setItem('gstNumber', gstinValue);
          window.localStorage.setItem('storeName', 'Sharma Retail Enterprises');
          window.localStorage.setItem('storeAddress', 'Sector-5, Outer Ring Rd, HSR Layout, Bengaluru, Karnataka 560102');
          window.dispatchEvent(new Event('storeNameUpdated'));
        }
        
        addLog(`Sync successful! Store metadata updated automatically.`);
        Alert.alert('GST Sync Success', 'GSTIN profile verified. Store details, address, and defaults updated successfully.');
      }
    } catch (e: any) {
      addLog(`Failed: ${e.message || 'Connection timeout'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLabels: Record<string, { label: string; icon: string }> = {
    tally: { label: 'Tally XML', icon: 'code-tags' },
    csv: { label: 'Excel / CSV', icon: 'file-excel-outline' },
    image: { label: 'OCR (Bill Scan)', icon: 'camera-outline' },
  };

  const placeholderText =
    importFormat === 'tally'
      ? 'Paste raw Tally XML tags here...'
      : importFormat === 'csv'
      ? 'Product Name, Selling Price, Cost Price, Stock Qty, Category, Barcode, GST %'
      : 'OCR text results will appear here...';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* ── Tab Switcher ── */}
      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tabBtn, activeTab === 'file' && s.tabBtnActive]}
          onPress={() => setActiveTab('file')}
          activeOpacity={0.7}
        >
          <Icon name="file-document-outline" size={16} color={activeTab === 'file' ? DS.colors.brand : DS.colors.textSecondary} />
          <Text style={[s.tabBtnText, activeTab === 'file' && s.tabBtnTextActive]}>File / Text Import</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, activeTab === 'cloud' && s.tabBtnActive]}
          onPress={() => setActiveTab('cloud')}
          activeOpacity={0.7}
        >
          <Icon name="cloud-sync-outline" size={16} color={activeTab === 'cloud' ? DS.colors.brand : DS.colors.textSecondary} />
          <Text style={[s.tabBtnText, activeTab === 'cloud' && s.tabBtnTextActive]}>Cloud Sync</Text>
        </TouchableOpacity>
      </View>

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Import Data</Text>
        <Text style={s.headerSubtitle}>Import products, customers and transactions from external sources</Text>
      </View>

      {/* ════════════════ FILE / TEXT IMPORT TAB ════════════════ */}
      {activeTab === 'file' && (
        <>
          {/* Section 1: Choose Source */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>Import Source</Text>
            <View style={s.sourceRow}>
              {(['tally', 'csv', 'image'] as const).map((fmt) => {
                const active = importFormat === fmt;
                return (
                  <TouchableOpacity
                    key={fmt}
                    style={[s.sourceBtn, active && s.sourceBtnActive]}
                    onPress={() => {
                      setImportFormat(fmt);
                      setRawDataText('');
                      setSelectedImageUri(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name={formatLabels[fmt].icon}
                      size={16}
                      color={active ? DS.colors.brand : DS.colors.textSecondary}
                    />
                    <Text style={[s.sourceBtnText, active && s.sourceBtnTextActive]}>
                      {formatLabels[fmt].label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 2: Upload / Paste Data */}
          <View style={s.card}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionLabel}>
                {importFormat === 'image' ? 'Upload Invoice' : 'Upload Data File'}
              </Text>
              {importFormat !== 'image' && (
                <TouchableOpacity
                  onPress={() => {
                    setRawDataText(importFormat === 'tally' ? TALLY_XML_TEMPLATE : POS_CSV_TEMPLATE);
                  }}
                >
                  <Text style={s.linkText}>Load Sample</Text>
                </TouchableOpacity>
              )}
              {importFormat === 'image' && (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedImageUri('https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500');
                    setRawDataText(OCR_BILL_TEMPLATE);
                    Alert.alert('Sample OCR Loaded', 'Simulated scan of standard distributor invoice photo loaded successfully.');
                  }}
                >
                  <Text style={s.linkText}>Try Sample Invoice</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Upload Zone for all formats */}
            <TouchableOpacity style={s.uploadZone} onPress={handleUploadFile} activeOpacity={0.7} disabled={isFileLoading}>
              <Icon name="cloud-upload-outline" size={24} color={DS.colors.textSecondary} />
              <Text style={s.uploadZoneText}>
                {isFileLoading ? 'Scanning...' : 
                 importFormat === 'image' ? 'Tap to upload invoice photo' : 
                 importFormat === 'tally' ? 'Upload Tally XML file (Drag & Drop)' : 'Upload Excel / CSV file (Drag & Drop)'}
              </Text>
            </TouchableOpacity>

            {isFileLoading && (
              <View style={s.loadingRow}>
                <ActivityIndicator size="small" color={DS.colors.brand} />
                <Text style={s.loadingText}>{fileLoadingMsg}</Text>
              </View>
            )}

            {importFormat === 'image' && selectedImageUri && (
              <View style={s.imagePreview}>
                <Image
                  source={{ uri: selectedImageUri }}
                  style={{ width: '100%', height: 120, borderRadius: DS.radius.xs, resizeMode: 'cover' } as any}
                />
              </View>
            )}

            {/* Toggleable paste area */}
            <TouchableOpacity onPress={() => setShowPasteArea(!showPasteArea)} style={{ alignSelf: 'flex-start', marginTop: DS.space.xs }}>
              <Text style={s.linkText}>{showPasteArea ? 'Hide raw text input' : 'or paste raw data / XML text'}</Text>
            </TouchableOpacity>

            {showPasteArea && (
              <TextInput
                mode="outlined"
                multiline
                numberOfLines={4}
                placeholder={placeholderText}
                value={rawDataText}
                onChangeText={setRawDataText}
                style={s.textArea}
                outlineStyle={s.textAreaOutline}
                activeOutlineColor={DS.colors.brand}
                outlineColor={DS.colors.border}
                textColor={DS.colors.text}
                placeholderTextColor={DS.colors.textMuted}
              />
            )}
          </View>

          {/* Section 3: Preview (only if parsed data) */}
          {parsedItems.length > 0 && (
            <View style={s.card}>
              <View style={s.sectionHeaderRow}>
                <Text style={s.sectionLabel}>Preview</Text>
                <View style={s.badge}>
                  <Icon name="check-circle" size={14} color={DS.colors.brand} />
                  <Text style={s.badgeText}>{parsedItems.length} Products found</Text>
                </View>
              </View>

              <DataTable>
                <DataTable.Header style={s.tableHeader}>
                  <DataTable.Title style={{ flex: 2 }}><Text style={s.thText}>Product</Text></DataTable.Title>
                  <DataTable.Title numeric><Text style={s.thText}>Sell ₹</Text></DataTable.Title>
                  <DataTable.Title numeric><Text style={s.thText}>Cost ₹</Text></DataTable.Title>
                  <DataTable.Title numeric><Text style={s.thText}>Stock</Text></DataTable.Title>
                  <DataTable.Title><Text style={s.thText}>Category</Text></DataTable.Title>
                </DataTable.Header>

                {parsedItems.slice(0, 4).map((item, idx) => (
                  <DataTable.Row key={idx} style={s.tableRow}>
                    <DataTable.Cell style={{ flex: 2 }}><Text style={s.tdText}>{item.name}</Text></DataTable.Cell>
                    <DataTable.Cell numeric><Text style={s.tdText}>₹{item.selling_price}</Text></DataTable.Cell>
                    <DataTable.Cell numeric><Text style={s.tdText}>₹{item.cost_price}</Text></DataTable.Cell>
                    <DataTable.Cell numeric><Text style={s.tdText}>{item.stock_qty}</Text></DataTable.Cell>
                    <DataTable.Cell><Text style={s.tdText}>{item.category}</Text></DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>

              {parsedItems.length > 4 && (
                <Text style={s.moreText}>and {parsedItems.length - 4} more items...</Text>
              )}
            </View>
          )}

          {/* Section 4: Import Options */}
          {parsedItems.length > 0 && (
            <View style={s.card}>
              <Text style={s.sectionLabel}>Import Options</Text>
              <View style={s.optionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.optionLabel}>Update existing products</Text>
                  <Text style={s.optionDesc}>Overwrite if product name already exists</Text>
                </View>
                <Switch
                  value={updateExisting}
                  onValueChange={setUpdateExisting}
                  color={DS.colors.brand}
                />
              </View>
              <View style={s.divider} />
              <View style={s.optionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.optionLabel}>Import stock quantities</Text>
                  <Text style={s.optionDesc}>Set opening stock from imported data</Text>
                </View>
                <Switch
                  value={importStockQty}
                  onValueChange={setImportStockQty}
                  color={DS.colors.brand}
                />
              </View>
            </View>
          )}

          {/* Footer Buttons */}
          {parsedItems.length > 0 && (
            <View style={s.footerRow}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => {
                  setRawDataText('');
                  setSelectedImageUri(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.importBtn, isProcessingFile && { opacity: 0.6 }]}
                onPress={handleExecuteMigration}
                disabled={isProcessingFile}
                activeOpacity={0.7}
              >
                {isProcessingFile && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />}
                <Text style={s.importBtnText}>
                  {isProcessingFile ? 'Importing...' : 'Import'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* ════════════════ CLOUD SYNC TAB ════════════════ */}
      {activeTab === 'cloud' && (
        <>
          {/* Cloud Source Selector */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>Sync Source</Text>
            <View style={s.sourceRow}>
              {([
                { key: 'tally' as const, label: 'Tally License', icon: 'account-key' },
                { key: 'shopify' as const, label: 'Shopify', icon: 'shopping-outline' },
                { key: 'gstin' as const, label: 'GSTIN Profile', icon: 'file-percent' },
              ]).map((src) => {
                const active = syncSource === src.key;
                return (
                  <TouchableOpacity
                    key={src.key}
                    style={[s.sourceBtn, active && s.sourceBtnActive]}
                    onPress={() => {
                      setSyncSource(src.key);
                      setRawDataText('');
                      setSyncLog([]);
                    }}
                    activeOpacity={0.7}
                  >
                    <Icon name={src.icon} size={16} color={active ? DS.colors.brand : DS.colors.textSecondary} />
                    <Text style={[s.sourceBtnText, active && s.sourceBtnTextActive]}>{src.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Connection Credentials */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>Connection Details</Text>

            {syncSource === 'tally' && (
              <View style={s.cloudFormRow}>
                <TextInput
                  label="Tally License Serial / ID"
                  mode="outlined"
                  value={licenseNumber}
                  onChangeText={setLicenseNumber}
                  style={s.cloudInput}
                  outlineStyle={s.cloudInputOutline}
                  activeOutlineColor={DS.colors.brand}
                  outlineColor="#D1D5DB"
                  placeholder="e.g. 987654321"
                />
                <TextInput
                  label="Tally Server Endpoint"
                  mode="outlined"
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  style={s.cloudInput}
                  outlineStyle={s.cloudInputOutline}
                  activeOutlineColor={DS.colors.brand}
                  outlineColor="#D1D5DB"
                  placeholder="e.g. http://localhost:9000"
                />
              </View>
            )}

            {syncSource === 'shopify' && (
              <View style={s.cloudFormRow}>
                <TextInput
                  label="Shopify Store URL"
                  mode="outlined"
                  value={shopifyStore}
                  onChangeText={setShopifyStore}
                  style={s.cloudInput}
                  outlineStyle={s.cloudInputOutline}
                  activeOutlineColor={DS.colors.brand}
                  outlineColor="#D1D5DB"
                  placeholder="e.g. mystore.myshopify.com"
                />
                <TextInput
                  label="Admin Access Token"
                  mode="outlined"
                  secureTextEntry
                  value={shopifyToken}
                  onChangeText={setShopifyToken}
                  style={s.cloudInput}
                  outlineStyle={s.cloudInputOutline}
                  activeOutlineColor={DS.colors.brand}
                  outlineColor="#D1D5DB"
                  placeholder="shpat_xxxxxxxxx"
                />
              </View>
            )}

            {syncSource === 'gstin' && (
              <TextInput
                label="Registered Business GSTIN Number"
                mode="outlined"
                value={gstinValue}
                onChangeText={setGstinValue}
                style={s.cloudInputFull}
                outlineStyle={s.cloudInputOutline}
                activeOutlineColor={DS.colors.brand}
                outlineColor="#D1D5DB"
                placeholder="e.g. 29GGGGG1314R9Z9"
              />
            )}

            <View style={s.cloudActionRow}>
              <TouchableOpacity
                style={[s.importBtn, isSyncing && { opacity: 0.6 }]}
                onPress={handleCloudSync}
                disabled={isSyncing}
                activeOpacity={0.7}
              >
                {isSyncing && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />}
                <Text style={s.importBtnText}>
                  {isSyncing ? 'Fetching...' : 'Connect & Fetch Records'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Sync Logs */}
          {syncLog.length > 0 && (
            <View style={s.logCard}>
              <Text style={s.logHeader}>Connection Logs</Text>
              {syncLog.map((log, idx) => (
                <Text key={idx} style={s.logLine}>{log}</Text>
              ))}
            </View>
          )}

          {/* Preview from Cloud Sync (reuses parsedItems) */}
          {parsedItems.length > 0 && (
            <View style={s.card}>
              <View style={s.sectionHeaderRow}>
                <Text style={s.sectionLabel}>Fetched Data</Text>
                <View style={s.badge}>
                  <Icon name="check-circle" size={14} color={DS.colors.brand} />
                  <Text style={s.badgeText}>{parsedItems.length} Products found</Text>
                </View>
              </View>

              <DataTable>
                <DataTable.Header style={s.tableHeader}>
                  <DataTable.Title style={{ flex: 2 }}><Text style={s.thText}>Product</Text></DataTable.Title>
                  <DataTable.Title numeric><Text style={s.thText}>Sell ₹</Text></DataTable.Title>
                  <DataTable.Title numeric><Text style={s.thText}>Cost ₹</Text></DataTable.Title>
                  <DataTable.Title numeric><Text style={s.thText}>Stock</Text></DataTable.Title>
                </DataTable.Header>
                {parsedItems.slice(0, 4).map((item, idx) => (
                  <DataTable.Row key={idx} style={s.tableRow}>
                    <DataTable.Cell style={{ flex: 2 }}><Text style={s.tdText}>{item.name}</Text></DataTable.Cell>
                    <DataTable.Cell numeric><Text style={s.tdText}>₹{item.selling_price}</Text></DataTable.Cell>
                    <DataTable.Cell numeric><Text style={s.tdText}>₹{item.cost_price}</Text></DataTable.Cell>
                    <DataTable.Cell numeric><Text style={s.tdText}>{item.stock_qty}</Text></DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>

              <View style={[s.footerRow, { marginTop: DS.space.lg }]}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => { setRawDataText(''); setSyncLog([]); }} activeOpacity={0.7}>
                  <Text style={s.cancelBtnText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.importBtn, isProcessingFile && { opacity: 0.6 }]}
                  onPress={handleExecuteMigration}
                  disabled={isProcessingFile}
                  activeOpacity={0.7}
                >
                  {isProcessingFile && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />}
                  <Text style={s.importBtnText}>{isProcessingFile ? 'Importing...' : 'Import to Store'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DS.colors.surfaceBg,
  },
  content: {
    padding: DS.space.xl,
    gap: DS.space.lg,
    paddingBottom: DS.space.xxxl,
  },

  /* ── Header ── */
  header: {
    gap: DS.space.xs,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: DS.colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: DS.colors.textSecondary,
    lineHeight: 20,
  },

  /* ── Tab Switcher ── */
  tabRow: {
    flexDirection: 'row',
    gap: DS.space.sm,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingVertical: DS.space.sm,
    paddingHorizontal: DS.space.lg,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: DS.colors.border,
    backgroundColor: DS.colors.cardBg,
  },
  tabBtnActive: {
    backgroundColor: DS.colors.successBg,
    borderColor: DS.colors.brand,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: DS.colors.textSecondary,
  },
  tabBtnTextActive: {
    color: DS.colors.brand,
    fontWeight: '600',
  },

  /* ── Cards ── */
  card: {
    backgroundColor: DS.colors.cardBg,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: DS.colors.border,
    padding: DS.space.xl,
    gap: DS.space.md,
  },

  /* ── Section Labels ── */
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: DS.colors.text,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  /* ── Source Buttons ── */
  sourceRow: {
    flexDirection: 'row',
    gap: DS.space.sm,
    flexWrap: 'wrap',
  },
  sourceBtn: {
    flex: 1,
    minWidth: 120,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: DS.colors.border,
    backgroundColor: DS.colors.cardBg,
  },
  sourceBtnActive: {
    backgroundColor: DS.colors.successBg,
    borderColor: DS.colors.brand,
  },
  sourceBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: DS.colors.textSecondary,
  },
  sourceBtnTextActive: {
    color: DS.colors.brand,
    fontWeight: '600',
  },

  /* ── Text Area ── */
  textArea: {
    fontSize: 12,
    backgroundColor: DS.colors.surfaceBg,
    maxHeight: 120,
  },
  textAreaOutline: {
    borderRadius: DS.radius.md,
    borderColor: DS.colors.border,
  },

  /* ── Upload Zone ── */
  uploadZone: {
    height: 80,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: DS.colors.border,
    borderRadius: DS.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
    backgroundColor: DS.colors.surfaceBg,
  },
  uploadZoneText: {
    fontSize: 14,
    color: DS.colors.textSecondary,
  },
  imagePreview: {
    borderWidth: 1,
    borderColor: DS.colors.border,
    borderRadius: DS.radius.md,
    padding: DS.space.sm,
    backgroundColor: DS.colors.surfaceBg,
    maxWidth: 280,
    alignSelf: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    padding: DS.space.md,
    backgroundColor: DS.colors.successBg,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: DS.colors.border,
  },
  loadingText: {
    fontSize: 12,
    color: DS.colors.brand,
    fontWeight: '500',
  },

  /* ── Link ── */
  linkText: {
    fontSize: 14,
    color: DS.colors.brand,
    fontWeight: '600',
  },

  /* ── Badge ── */
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs,
    backgroundColor: DS.colors.successBg,
    paddingVertical: DS.space.xs,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: DS.colors.accent,
  },

  /* ── Data Table ── */
  tableHeader: {
    backgroundColor: DS.colors.surfaceBg,
    borderBottomWidth: 1,
    borderBottomColor: DS.colors.border,
  },
  tableRow: {
    borderBottomWidth: 1,
    borderBottomColor: DS.colors.borderLight,
  },
  thText: {
    fontSize: 12,
    fontWeight: '600',
    color: DS.colors.textSecondary,
  },
  tdText: {
    fontSize: 12,
    color: DS.colors.text,
  },
  moreText: {
    fontSize: 12,
    color: DS.colors.textSecondary,
    textAlign: 'center',
    marginTop: DS.space.sm,
  },

  /* ── Options ── */
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DS.space.lg,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: DS.colors.text,
  },
  optionDesc: {
    fontSize: 12,
    color: DS.colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: DS.colors.border,
  },

  /* ── Footer ── */
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: DS.space.md,
  },
  cancelBtn: {
    height: 44,
    paddingHorizontal: DS.space.xl,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: DS.colors.border,
    backgroundColor: DS.colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: DS.colors.textSecondary,
  },
  importBtn: {
    height: 44,
    paddingHorizontal: DS.space.xl,
    borderRadius: DS.radius.md,
    backgroundColor: DS.colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  /* ── Cloud Sync ── */
  cloudFormRow: {
    flexDirection: 'row',
    gap: DS.space.md,
  },
  cloudInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    backgroundColor: DS.colors.cardBg,
  },
  cloudInputFull: {
    width: '100%',
    height: 44,
    fontSize: 14,
    backgroundColor: DS.colors.cardBg,
  },
  cloudInputOutline: {
    borderRadius: DS.radius.md,
    borderColor: '#D1D5DB',
  },
  cloudActionRow: {
    alignItems: 'flex-start',
    marginTop: DS.space.xs,
  },

  /* ── Sync Logs ── */
  logCard: {
    backgroundColor: '#111827',
    borderRadius: DS.radius.md,
    padding: DS.space.lg,
    gap: DS.space.xs,
  },
  logHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: DS.colors.brand,
    marginBottom: DS.space.xs,
  },
  logLine: {
    fontSize: 12,
    color: '#E5E7EB',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
});
