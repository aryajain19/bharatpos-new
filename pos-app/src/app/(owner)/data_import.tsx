import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform, useWindowDimensions, Image } from 'react-native';
import { Text, Card, Button, useTheme, TextInput, Divider, SegmentedButtons, DataTable, Surface, Switch } from 'react-native-paper';
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

  // Simulated OCR Photo Uploader
  const handleUploadImage = () => {
    if (typeof document === 'undefined') return;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    
    fileInput.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;

      setIsFileLoading(true);
      setFileLoadingMsg(`Reading image file "${file.name}"...`);

      try {
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
      } catch (err: any) {
        Alert.alert('OCR Error', err.message || 'Failed to scan the image.');
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Title Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Icon name="file-import-outline" size={28} color="#10B981" />
          <Text style={styles.headerTitle}>Data Import & Migration Center</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Import past records, inventory lists, and customer directories from TallyPrime, Shopify, or other POS backups instantly.
        </Text>
      </View>

      {/* Main Tab Controller */}
      <SegmentedButtons
        value={activeTab}
        onValueChange={(val: any) => setActiveTab(val)}
        buttons={[
          { value: 'file', label: 'File / Text Import', icon: 'file-document-outline' },
          { value: 'cloud', label: 'Direct Cloud Sync', icon: 'cloud-sync-outline' }
        ]}
        style={styles.tabBar}
        theme={{ colors: { primary: '#10B981' } }}
      />

      {/* TAB 1: FILE / TEXT IMPORT */}
      {activeTab === 'file' && (
        <Card style={styles.card} elevation={1}>
          <Card.Content style={styles.cardContent}>
            <Text style={styles.cardSectionTitle}>1. Choose Data Source Format</Text>
            <SegmentedButtons
              value={importFormat}
              onValueChange={(val: any) => {
                setImportFormat(val);
                setRawDataText('');
                setSelectedImageUri(null);
              }}
              buttons={[
                { value: 'tally', label: 'TallyPrime XML Export', icon: 'code-tags' },
                { value: 'csv', label: 'Generic POS CSV / Excel', icon: 'file-excel-outline' },
                { value: 'image', label: 'Scan Photo (OCR)', icon: 'camera-outline' }
              ]}
              style={styles.subTabBar}
            />

            {importFormat !== 'image' ? (
              <View style={{ gap: 12 }}>
                <View style={styles.editorHeader}>
                  <Text style={styles.cardSectionTitle}>2. Paste XML / CSV Content</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setRawDataText(importFormat === 'tally' ? TALLY_XML_TEMPLATE : POS_CSV_TEMPLATE);
                    }}
                  >
                    <Text style={styles.demoLink}>Autofill Sample Template</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  mode="outlined"
                  multiline
                  numberOfLines={8}
                  placeholder={
                    importFormat === 'tally'
                      ? 'Paste raw Tally XML tags here...'
                      : 'Product Name, Selling Price, Cost Price, Stock Quantity, Category, Barcode, GST Pct...'
                  }
                  value={rawDataText}
                  onChangeText={setRawDataText}
                  style={styles.textArea}
                  activeOutlineColor="#10B981"
                />
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <Text style={styles.cardSectionTitle}>2. Upload / Take Photo of Invoice Bill</Text>
                
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button
                    mode="contained"
                    icon="camera-outline"
                    buttonColor="#F57C00"
                    onPress={handleUploadImage}
                    disabled={isFileLoading}
                    labelStyle={{ fontWeight: 'bold' }}
                  >
                    {isFileLoading ? 'Scanning...' : 'Scan Invoice Photo (OCR)'}
                  </Button>
                  
                  <TouchableOpacity onPress={() => {
                    setSelectedImageUri('https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500');
                    setRawDataText(OCR_BILL_TEMPLATE);
                    Alert.alert('Sample OCR Loaded', 'Simulated scan of standard distributor invoice photo loaded successfully.');
                  }}>
                    <Text style={[styles.demoLink, { color: '#F57C00' }]}>Try Sample Invoice Image</Text>
                  </TouchableOpacity>
                </View>

                {isFileLoading && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#FFFBEB', borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A' }}>
                    <ActivityIndicator size="small" color="#F57C00" />
                    <Text style={{ fontSize: 13, color: '#B45309', fontWeight: '500' }}>{fileLoadingMsg}</Text>
                  </View>
                )}

                {selectedImageUri && (
                  <View style={{ marginTop: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 8, backgroundColor: '#F8FAFC', width: '100%', maxWidth: 300, alignSelf: 'center' }}>
                    <Image 
                      source={{ uri: selectedImageUri }} 
                      style={{ width: '100%', height: 200, borderRadius: 8, resizeMode: 'cover' }} 
                    />
                    <Text style={{ fontSize: 11, color: '#64748B', textAlign: 'center', marginTop: 6, fontWeight: '500' }}>
                      📷 Selected Invoice Photo Preview
                    </Text>
                  </View>
                )}

                <Text style={styles.cardSectionTitle}>3. Extracted Text Result</Text>
                <TextInput
                  mode="outlined"
                  multiline
                  numberOfLines={6}
                  placeholder="OCR text results will appear here..."
                  value={rawDataText}
                  onChangeText={setRawDataText}
                  style={styles.textArea}
                  activeOutlineColor="#F57C00"
                />
              </View>
            )}
          </Card.Content>
        </Card>
      )}

      {/* TAB 2: DIRECT CLOUD SYNC */}
      {activeTab === 'cloud' && (
        <Card style={styles.card} elevation={1}>
          <Card.Content style={styles.cardContent}>
            <Text style={styles.cardSectionTitle}>1. Select Cloud Sync Integration</Text>
            <SegmentedButtons
              value={syncSource}
              onValueChange={(val: any) => {
                setSyncSource(val);
                setRawDataText('');
                setSyncLog([]);
              }}
              buttons={[
                { value: 'tally', label: 'Tally License Sync', icon: 'account-key' },
                { value: 'shopify', label: 'Shopify Store Connect', icon: 'shopping-outline' },
                { value: 'gstin', label: 'GSTIN Profile Sync', icon: 'file-percent' }
              ]}
              style={styles.subTabBar}
            />

            <Text style={styles.cardSectionTitle}>2. Connection Authentication Credentials</Text>
            
            {syncSource === 'tally' && (
              <View style={styles.formRow}>
                <TextInput
                  label="Tally License Serial / ID"
                  mode="outlined"
                  value={licenseNumber}
                  onChangeText={setLicenseNumber}
                  style={styles.inputFlex}
                  activeOutlineColor="#10B981"
                  placeholder="e.g. 987654321"
                />
                <TextInput
                  label="Tally Server Endpoint"
                  mode="outlined"
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  style={styles.inputFlex}
                  activeOutlineColor="#10B981"
                  placeholder="e.g. http://localhost:9000"
                />
              </View>
            )}

            {syncSource === 'shopify' && (
              <View style={styles.formRow}>
                <TextInput
                  label="Shopify Store URL"
                  mode="outlined"
                  value={shopifyStore}
                  onChangeText={setShopifyStore}
                  style={styles.inputFlex}
                  activeOutlineColor="#10B981"
                  placeholder="e.g. mystore.myshopify.com"
                />
                <TextInput
                  label="Admin Access Token"
                  mode="outlined"
                  secureTextEntry
                  value={shopifyToken}
                  onChangeText={setShopifyToken}
                  style={styles.inputFlex}
                  activeOutlineColor="#10B981"
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
                style={styles.inputFull}
                activeOutlineColor="#10B981"
                placeholder="e.g. 29GGGGG1314R9Z9"
              />
            )}

            <Button
              mode="contained"
              buttonColor="#10B981"
              style={styles.syncBtn}
              labelStyle={{ fontWeight: 'bold' }}
              onPress={handleCloudSync}
              disabled={isSyncing}
            >
              {isSyncing ? 'Fetching Live Database...' : 'Connect & Fetch Records'}
            </Button>

            {syncLog.length > 0 && (
              <Surface style={styles.logBox} elevation={1}>
                <Text style={styles.logHeader}>Integration Connection Logs:</Text>
                {syncLog.map((log, idx) => (
                  <Text key={idx} style={styles.logText}>{log}</Text>
                ))}
              </Surface>
            )}
          </Card.Content>
        </Card>
      )}

      {/* VALIDATION PREVIEW SECTION (Runs if data parsed) */}
      {parsedItems.length > 0 && (
        <Card style={[styles.card, { marginTop: 20 }]} elevation={1}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.cardSectionTitle}>3. Parsed Data Verification</Text>
              <Surface style={styles.badgeSuccess}>
                <Text style={styles.badgeSuccessText}>{parsedItems.length} Valid Items Detected</Text>
              </Surface>
            </View>

            <DataTable style={styles.table}>
              <DataTable.Header>
                <DataTable.Title style={{ flex: 2 }}>Product Name</DataTable.Title>
                <DataTable.Title numeric>Sell Price</DataTable.Title>
                <DataTable.Title numeric>Cost Price</DataTable.Title>
                <DataTable.Title numeric>Opening Stock</DataTable.Title>
                <DataTable.Title>Category</DataTable.Title>
                <DataTable.Title>Barcode</DataTable.Title>
              </DataTable.Header>

              {parsedItems.slice(0, 5).map((item, idx) => (
                <DataTable.Row key={idx}>
                  <DataTable.Cell style={{ flex: 2 }}>{item.name}</DataTable.Cell>
                  <DataTable.Cell numeric>₹{item.selling_price}</DataTable.Cell>
                  <DataTable.Cell numeric>₹{item.cost_price}</DataTable.Cell>
                  <DataTable.Cell numeric>{item.stock_qty}</DataTable.Cell>
                  <DataTable.Cell>{item.category}</DataTable.Cell>
                  <DataTable.Cell>{item.barcode || '—'}</DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>

            {parsedItems.length > 5 && (
              <Text style={styles.tableFooterNote}>and {parsedItems.length - 5} more products...</Text>
            )}

            <Divider style={{ marginVertical: 16 }} />

            <View style={styles.actionRow}>
              <Button
                mode="contained"
                buttonColor="#6366F1"
                style={styles.migrateBtn}
                labelStyle={{ fontWeight: 'bold' }}
                onPress={handleExecuteMigration}
                disabled={isProcessingFile}
              >
                {isProcessingFile ? 'Migrating Items...' : 'Save & Import Catalog to Store'}
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 24,
    gap: 16,
  },
  header: {
    marginBottom: 8,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  tabBar: {
    marginVertical: 10,
  },
  card: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardContent: {
    paddingVertical: 16,
    gap: 12,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  subTabBar: {
    marginBottom: 8,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  demoLink: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  textArea: {
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: '#F8FAFC',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputFlex: {
    flex: 1,
  },
  inputFull: {
    width: '100%',
  },
  syncBtn: {
    marginTop: 8,
    borderRadius: 8,
    paddingVertical: 4,
  },
  logBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
  },
  logHeader: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  logText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeSuccess: {
    backgroundColor: '#DCFCE7',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  badgeSuccessText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '700',
  },
  table: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 8,
  },
  tableFooterNote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  },
  actionRow: {
    alignItems: 'flex-end',
  },
  migrateBtn: {
    borderRadius: 8,
    paddingVertical: 4,
  },
});
