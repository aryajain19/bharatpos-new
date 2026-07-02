import React, { useState, useEffect, useRef } from 'react';
import { DS } from '../../constants/designTokens';
import { View, StyleSheet, ScrollView, Alert, Platform, Share } from 'react-native';
import { Text, Card, Button, Switch, useTheme, SegmentedButtons, TextInput, Portal, Dialog } from 'react-native-paper';
import { auth, isFirebaseConfigured, db } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { useAppTheme } from '../../providers/ThemeProvider';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { doc, updateDoc, collection, getDocs, query, where, setDoc } from '../../lib/firestore_adapter';
import { useAuth } from '../../providers/AuthProvider';

export default function AdminSettingsScreen() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const theme = useTheme();

  const [storeName, setStoreName] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem('storeName') || '';
    }
    return '';
  });
  const [address, setAddress] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem('storeAddress') || '';
    }
    return '';
  });
  const [gstNumber, setGstNumber] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem('gstNumber') || '';
    }
    return '';
  });
  const [businessType, setBusinessType] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const storedType = window.localStorage.getItem('isGstRegistered');
      if (storedType !== null) {
        return storedType === 'false' ? 'NON-GST' : 'GST';
      }
    }
    return 'GST';
  });
  const [shopMode, setShopMode] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem('shopMode') || 'Mobile Only';
    }
    return 'Mobile Only';
  });
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [lowStockNotif, setLowStockNotif] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const val = window.localStorage.getItem('lowStockEmailNotif');
      return val !== 'false';
    }
    return true;
  });
  const [webhookUrl, setWebhookUrl] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem('webhookUrl') || '';
    }
    return '';
  });
  const [autoOutOfStock, setAutoOutOfStock] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const val = window.localStorage.getItem('autoOutOfStock');
      return val !== 'false';
    }
    return true;
  });
  
  const { tenantId } = useAuth();
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoreText, setRestoreText] = useState('');
  const fileInputRef = useRef<any>(null);

  const handleCreateBackup = async () => {
    if (!isFirebaseConfigured) {
      Alert.alert('Demo Mode', 'Database operations are disabled in demo mode.');
      return;
    }
    setBackupLoading(true);
    try {
      const resolvedTenant = tenantId;
      
      // Fetch products
      const prodSnap = await getDocs(query(collection(db, 'products'), where('tenant_id', '==', resolvedTenant)));
      const products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Fetch sales
      const salesSnap = await getDocs(query(collection(db, 'sales'), where('tenant_id', '==', resolvedTenant)));
      const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Fetch transactions
      const transSnap = await getDocs(query(collection(db, 'transactions'), where('tenant_id', '==', resolvedTenant)));
      const transactions = transSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const backupData = {
        backup_version: "1.0",
        timestamp: new Date().toISOString(),
        tenant_id: resolvedTenant,
        products,
        sales,
        transactions
      };

      const jsonString = JSON.stringify(backupData, null, 2);

      if (Platform.OS === 'web') {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bharatpos_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Alert.alert('Success', 'Backup JSON file downloaded successfully.');
      } else {
        await Share.share({
          message: jsonString,
          title: 'BharatPOS Backup'
        });
      }
    } catch (err: any) {
      console.error("Backup failed:", err);
      Alert.alert('Backup Failed', err.message || 'An error occurred during backup.');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackup = async (jsonText: string) => {
    if (!isFirebaseConfigured) {
      Alert.alert('Demo Mode', 'Database operations are disabled.');
      return;
    }
    setRestoreLoading(true);
    try {
      const data = JSON.parse(jsonText);
      if (!data.products || !data.sales || !data.transactions) {
        throw new Error("Invalid backup format. Backup must contain products, sales, and transactions.");
      }

      const resolvedTenant = tenantId;
      
      // Restore products
      for (const p of data.products) {
        const pId = p.id;
        const pData = { ...p };
        delete pData.id;
        pData.tenant_id = resolvedTenant;
        await setDoc(doc(db, 'products', pId), pData);
      }

      // Restore sales
      for (const s of data.sales) {
        const sId = s.id;
        const sData = { ...s };
        delete sData.id;
        sData.tenant_id = resolvedTenant;
        await setDoc(doc(db, 'sales', sId), sData);
      }

      // Restore transactions
      for (const t of data.transactions) {
        const tId = t.id;
        const tData = { ...t };
        delete tData.id;
        tData.tenant_id = resolvedTenant;
        await setDoc(doc(db, 'transactions', tId), tData);
      }

      Alert.alert('Restore Success', `Successfully restored:\n- ${data.products.length} Products\n- ${data.sales.length} Sales\n- ${data.transactions.length} Transactions.\nApp configuration updated.`);
      setShowRestoreDialog(false);
      setRestoreText('');
      router.replace('/(owner)' as any);
    } catch (err: any) {
      console.error("Restore failed:", err);
      Alert.alert('Restore Failed', err.message || 'Failed to parse or write restore data.');
    } finally {
      setRestoreLoading(false);
    }
  };

  const triggerFileSelect = () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
    } else {
      setShowRestoreDialog(true);
    }
  };

  const handleFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        Alert.alert(
          'Confirm Restore',
          'Warning: Restoring this backup will merge or overwrite your current store data. Are you sure you want to proceed?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Proceed', onPress: () => handleRestoreBackup(text) }
          ]
        );
      }
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem('storeName', storeName);
      window.localStorage.setItem('storeAddress', address);
      window.localStorage.setItem('gstNumber', gstNumber);
      window.localStorage.setItem('isGstRegistered', String(businessType === 'GST'));
      window.localStorage.setItem('shopMode', shopMode);
      window.localStorage.setItem('lowStockEmailNotif', String(lowStockNotif));
      window.localStorage.setItem('webhookUrl', webhookUrl);
      window.localStorage.setItem('autoOutOfStock', String(autoOutOfStock));
      
      // Dispatch custom event to notify other components (e.g. sidebar)
      window.dispatchEvent(new Event('storeNameUpdated'));
    }

    if (isFirebaseConfigured && auth.currentUser) {
      try {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userDocRef, {
          store_name: storeName,
          store_address: address,
          gst_number: gstNumber,
          is_gst_registered: businessType === 'GST',
          shop_mode: shopMode,
          low_stock_notif: lowStockNotif,
          webhook_url: webhookUrl,
          auto_out_of_stock: autoOutOfStock
        });
      } catch (err) {
        console.error("Error updating user profile in Firestore:", err);
      }
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert('Shop settings have been saved and applied.');
    } else {
      Alert.alert('Saved Successfully', 'Shop settings have been saved and applied.');
    }
  };

  const handleLogout = async () => {
    if (isFirebaseConfigured) {
      await signOut(auth);
    }
    router.replace('/(auth)/login');
  };

  const handleSeedCatalog = async () => {
    if (!isFirebaseConfigured) {
      Alert.alert('Demo Mode', 'Database operations are disabled in demo mode.');
      return;
    }
    if (!tenantId) {
      Alert.alert('Error', 'Tenant ID is missing. Please log in again.');
      return;
    }

    setSeedLoading(true);
    try {
      const { collection, getDocs, query, where } = await import('../../lib/firestore_adapter');
      const existingSnap = await getDocs(query(collection(db, 'products'), where('tenant_id', '==', tenantId)));
      if (existingSnap.docs.length > 5) {
        Alert.alert(
          'Catalog Exists',
          'You already have products in your catalog. Seeding will add additional FMCG items. Do you want to proceed?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setSeedLoading(false) },
            { text: 'Proceed', onPress: () => performSeeding() }
          ]
        );
        return;
      }
      await performSeeding();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Seeding Failed', err.message);
      setSeedLoading(false);
    }
  };

  const performSeeding = async () => {
    try {
      const { collection, addDoc } = await import('../../lib/firestore_adapter');
      const fmcgProducts = [
        { name: 'Tata Salt 1kg', category: 'Staples', barcode: '8901058002316', mrp: 28, selling_price: 26, cost_price: 21, stock_qty: 120, gst_pct: 0 },
        { name: 'Aashirvaad Chakki Atta 5kg', category: 'Staples', barcode: '8901725181223', mrp: 290, selling_price: 275, cost_price: 240, stock_qty: 45, gst_pct: 0 },
        { name: 'Fortune Mustard Oil 1L', category: 'Oils', barcode: '8906007281324', mrp: 185, selling_price: 172, cost_price: 155, stock_qty: 60, gst_pct: 5 },
        { name: 'Amul Butter 100g', category: 'Dairy', barcode: '8901262010015', mrp: 58, selling_price: 56, cost_price: 51, stock_qty: 80, gst_pct: 12 },
        { name: 'Maggi Noodles 70g', category: 'Snacks', barcode: '8901058895642', mrp: 14, selling_price: 13, cost_price: 10.5, stock_qty: 150, gst_pct: 18 },
        { name: 'Surf Excel Easy Wash 1kg', category: 'Detergent', barcode: '8901030753083', mrp: 140, selling_price: 130, cost_price: 110, stock_qty: 35, gst_pct: 18 },
        { name: 'Dettol Liquid Soap 200ml', category: 'Personal Care', barcode: '8901396326525', mrp: 99, selling_price: 92, cost_price: 78, stock_qty: 45, gst_pct: 18 },
        { name: 'Colgate MaxFresh 150g', category: 'Personal Care', barcode: '8901314311022', mrp: 110, selling_price: 99, cost_price: 82, stock_qty: 50, gst_pct: 18 },
        { name: 'Vim Liquid Gel 250ml', category: 'Cleaning', barcode: '8901030704283', mrp: 55, selling_price: 51, cost_price: 42, stock_qty: 70, gst_pct: 18 },
        { name: 'Haldiram Bhujia Sev 150g', category: 'Snacks', barcode: '8904063200171', mrp: 40, selling_price: 37, cost_price: 31, stock_qty: 80, gst_pct: 12 },
        { name: 'Tata Tea Premium 250g', category: 'Beverages', barcode: '8901052005085', mrp: 120, selling_price: 112, cost_price: 95, stock_qty: 65, gst_pct: 5 },
        { name: 'Britannia Marie Gold 250g', category: 'Snacks', barcode: '8901063142274', mrp: 35, selling_price: 32, cost_price: 26, stock_qty: 90, gst_pct: 18 }
      ];

      for (const p of fmcgProducts) {
        await addDoc(collection(db, 'products'), {
          tenant_id: tenantId,
          created_at: new Date().toISOString(),
          ...p
        });
      }
      
      Alert.alert('Catalog Seeded', 'Successfully added 12 FMCG products to your catalog database!');
      setSeedLoading(false);
      router.replace('/(owner)/products_management' as any);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Seeding Failed', err.message);
      setSeedLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>Settings</Text>
      </View>

      <View style={styles.contentRow}>
        {/* Store Details Card */}
        <Card style={styles.card} elevation={0}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.iconTitleBox}>
                <Icon name="storefront-outline" size={20} color="#10B981" />
                <Text style={styles.sectionTitle}>Shop Details</Text>
              </View>
            </View>

            <TextInput
              label="Store Name"
              value={storeName}
              onChangeText={setStoreName}
              mode="outlined"
              style={styles.input}
              outlineColor="#EEF0F6"
              activeOutlineColor="#10B981"
             
            />
            <TextInput
              label="Store Address"
              value={address}
              onChangeText={setAddress}
              mode="outlined"
              style={styles.input}
              outlineColor="#EEF0F6"
              activeOutlineColor="#10B981"
             
            />

            <Text style={styles.label}>Business GST Registration Type</Text>
            <SegmentedButtons
              value={businessType}
              onValueChange={setBusinessType}
              buttons={[
                { value: 'GST', label: 'GST Registered', showSelectedCheck: true },
                { value: 'NON-GST', label: 'Non-GST Local Shop', showSelectedCheck: true }
              ]}
              style={styles.segmentedBtn}
            />

            {businessType === 'GST' && (
              <TextInput
                label="GSTIN (GST Identification Number)"
                value={gstNumber}
                onChangeText={setGstNumber}
                mode="outlined"
                style={styles.input}
                outlineColor="#EEF0F6"
                activeOutlineColor="#10B981"
               
                placeholder="e.g. 08AAPCS1081A1Z5"
              />
            )}

            <Text style={styles.label}>Shop Operation Mode</Text>
            <SegmentedButtons
              value={shopMode}
              onValueChange={setShopMode}
              buttons={[
                { value: 'Mobile Only', label: 'Mobile Only', showSelectedCheck: true },
                { value: 'Laptop + Mobile', label: 'Laptop + Mobile', showSelectedCheck: true },
                { value: 'Large Shop', label: 'Large Shop', showSelectedCheck: true }
              ]}
              style={styles.segmentedBtn}
            />

            <Button mode="contained" onPress={handleSave} buttonColor="#10B981" style={styles.saveBtn}>
              Save Shop Profile
            </Button>
          </Card.Content>
        </Card>

        {/* Preferences Card */}
        <Card style={styles.card} elevation={0}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.iconTitleBox}>
                <Icon name="cog-outline" size={20} color="#64748B" />
                <Text style={styles.sectionTitle}>Preferences & System</Text>
              </View>
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.switchLabel}>Receive Daily Email Reports</Text>
                <Text style={styles.switchDesc}>Get sales and inventory updates in your mailbox every evening.</Text>
              </View>
              <Switch value={emailNotifs} onValueChange={setEmailNotifs} color="#10B981" />
            </View>

            <View style={styles.divider} />

            <View style={styles.sectionHeaderRow}>
              <View style={styles.iconTitleBox}>
                <Icon name="lightning-bolt-outline" size={20} color="#F59E0B" />
                <Text style={styles.sectionTitle}>Workflow Automations (Zoho POS)</Text>
              </View>
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.switchLabel}>Low Stock Alerts</Text>
                <Text style={styles.switchDesc}>Get real-time alerts when catalog stock falls below 5 units.</Text>
              </View>
              <Switch value={lowStockNotif} onValueChange={setLowStockNotif} color="#10B981" />
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.switchLabel}>Auto Out-of-Stock Lock</Text>
                <Text style={styles.switchDesc}>Automatically prevent billing checkout of products when stock drops to 0.</Text>
              </View>
              <Switch value={autoOutOfStock} onValueChange={setAutoOutOfStock} color="#10B981" />
            </View>

            <TextInput
              label="Real-time Sales Webhook URL"
              value={webhookUrl}
              onChangeText={setWebhookUrl}
              mode="outlined"
              style={styles.input}
              outlineColor="#EEF0F6"
              activeOutlineColor="#10B981"
              placeholder="e.g. https://api.mycompany.com/sales-sync"
            />

            <View style={styles.divider} />

            <View style={styles.iconTitleBox}>
              <Icon name="alert-circle-outline" size={20} color="#EF4444" />
              <Text style={[styles.sectionTitle, { color: appTheme.colors.onSurface }]}>Danger Zone</Text>
            </View>
            <Text style={styles.switchDesc}>Sign out of this owner dashboard console session.</Text>
            <Button
              mode="outlined"
              icon="logout"
              textColor="#EF4444"
              onPress={handleLogout}
              style={styles.logoutBtn}
            >
              Logout Account
            </Button>
          </Card.Content>
        </Card>

        {/* FMCG Catalog Seeding Card */}
        <Card style={styles.card} elevation={0}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.iconTitleBox}>
                <Icon name="archive-arrow-down-outline" size={20} color="#E65100" />
                <Text style={styles.sectionTitle}>FMCG Catalog Quick-Start</Text>
              </View>
            </View>
            <Text style={styles.switchDesc}>
              Pre-load your inventory with 12 popular Indian FMCG/Kirana brands (Tata, Amul, Maggi, Britannia, Surf Excel) to skip manual item registration.
            </Text>
            <Button
              mode="contained"
              icon="database-import"
              loading={seedLoading}
              disabled={seedLoading}
              onPress={handleSeedCatalog}
              buttonColor="#E65100"
              style={{ borderRadius: 10 }}
            >
              Preload Grocery SKUs
            </Button>
          </Card.Content>
        </Card>

        {/* Backup & Recovery Card */}
        <Card style={styles.card} elevation={0}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.iconTitleBox}>
                <Icon name="database-sync-outline" size={20} color="#10B981" />
                <Text style={styles.sectionTitle}>Database Backup & Recovery</Text>
              </View>
            </View>

            <Text style={styles.switchDesc}>
              Export your inventory database, sales reports, and ledger transactions into a portable JSON file to secure store backups.
            </Text>

            <Button
              mode="contained"
              icon="cloud-download-outline"
              loading={backupLoading}
              disabled={backupLoading}
              onPress={handleCreateBackup}
              buttonColor="#10B981"
              style={{ borderRadius: 10, marginBottom: 16 }}
            >
              Export JSON Backup
            </Button>

            <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 12 }} />

            <Text style={styles.switchDesc}>
              Restore products, stock balances, sales logs, and accounting transactions from a previously exported backup file.
            </Text>

            {Platform.OS === 'web' && (
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
                accept=".json"
              />
            )}

            <Button
              mode="outlined"
              icon="cloud-upload-outline"
              loading={restoreLoading}
              disabled={restoreLoading}
              onPress={triggerFileSelect}
              textColor="#10B981"
              style={{ borderRadius: 10, borderColor: '#10B981', marginTop: 4 }}
            >
              {Platform.OS === 'web' ? 'Upload & Restore File' : 'Restore from Text Paste'}
            </Button>
          </Card.Content>
        </Card>
      </View>

      <Portal>
        <Dialog visible={showRestoreDialog} onDismiss={() => setShowRestoreDialog(false)} style={{ maxWidth: 500, alignSelf: 'center', width: '90%' }}>
          <Dialog.Title>Restore from JSON text</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 12, fontSize: 13, color: '#64748B' }}>
              Paste the raw JSON backup text below to restore your store's products and transactions database.
            </Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={8}
              value={restoreText}
              onChangeText={setRestoreText}
              placeholder='{"backup_version": "1.0", ...}'
              style={{ backgroundColor: 'white', fontSize: 12 }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowRestoreDialog(false)}>Cancel</Button>
            <Button 
              mode="contained" 
              buttonColor="#10B981"
              loading={restoreLoading}
              disabled={restoreLoading || !restoreText.trim()}
              onPress={() => {
                Alert.alert(
                  'Confirm Restore',
                  'Restoring this backup will merge or overwrite current products and sales. Continue?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Proceed', onPress: () => handleRestoreBackup(restoreText) }
                  ]
                );
              }}
            >
              Restore Data
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, backgroundColor: DS.colors.surfaceBg },
  header: { paddingVertical: 24 },
  title: { fontWeight: '800', color: '#1E293B' },
  contentRow: { flexDirection: 'row', gap: 24, flexWrap: 'wrap', marginBottom: 40 },
  card: { flex: 1, minWidth: 320, backgroundColor: DS.colors.cardBg, borderRadius: DS.radius.lg, borderWidth: 0, ...DS.shadow.sm, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  cardContent: { padding: 24 },
  sectionHeaderRow: { marginBottom: 20 },
  iconTitleBox: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontWeight: '700', fontSize: 16, color: '#1E293B' },
  input: { marginBottom: 16, backgroundColor: DS.colors.cardBg },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8, marginTop: 4 },
  segmentedBtn: { marginBottom: 20 },
  saveBtn: { borderRadius: DS.radius.md, marginTop: 12, paddingVertical: 4 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  switchLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  switchDesc: { fontSize: 12, color: '#64748B', marginTop: 3, lineHeight: 18, marginBottom: 14 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 24 },
  logoutBtn: { borderRadius: DS.radius.md, marginTop: 8, borderColor: '#EF4444' },
});
