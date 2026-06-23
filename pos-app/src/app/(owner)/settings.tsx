import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { Text, Card, Button, Switch, useTheme, SegmentedButtons, TextInput } from 'react-native-paper';
import { auth, isFirebaseConfigured } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { useAppTheme } from '../../providers/ThemeProvider';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function AdminSettingsScreen() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const theme = useTheme();

  const [storeName, setStoreName] = useState('Sharma Fashion Store');
  const [address, setAddress] = useState('Main Market, Block C, Jaipur');
  const [gstNumber, setGstNumber] = useState('08AAPCS1081A1Z5');
  const [businessType, setBusinessType] = useState('GST'); // 'GST' or 'NON-GST'
  const [shopMode, setShopMode] = useState('Mobile Only'); // 'Mobile Only' | 'Laptop + Mobile' | 'Large Shop'
  const [emailNotifs, setEmailNotifs] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const storedName = window.localStorage.getItem('storeName');
      if (storedName) setStoreName(storedName);
      
      const storedAddress = window.localStorage.getItem('storeAddress');
      if (storedAddress) setAddress(storedAddress);

      const storedGstNum = window.localStorage.getItem('gstNumber');
      if (storedGstNum) setGstNumber(storedGstNum);

      const storedType = window.localStorage.getItem('isGstRegistered');
      if (storedType !== null) {
        setBusinessType(storedType === 'false' ? 'NON-GST' : 'GST');
      }

      const storedMode = window.localStorage.getItem('shopMode');
      if (storedMode !== null) {
        setShopMode(storedMode);
      }
    }
  }, []);

  const handleSave = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem('storeName', storeName);
      window.localStorage.setItem('storeAddress', address);
      window.localStorage.setItem('gstNumber', gstNumber);
      window.localStorage.setItem('isGstRegistered', String(businessType === 'GST'));
      window.localStorage.setItem('shopMode', shopMode);
    }
    Alert.alert('Saved Successfully', 'Shop settings have been saved and applied.');
  };

  const handleLogout = async () => {
    if (isFirebaseConfigured) {
      await signOut(auth);
    }
    router.replace('/(auth)/login');
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

            <Button mode="contained" onPress={handleSave} style={styles.saveBtn}>
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

            <View style={styles.iconTitleBox}>
              <Icon name="alert-circle-outline" size={20} color="#EF4444" />
              <Text style={[styles.sectionTitle, { color: appTheme.colors.onSurface }]}>Danger Zone</Text>
            </View>
            <Text style={styles.switchDesc}>Sign out of this owner dashboard console session.</Text>
            <Button
              mode="outlined"
              icon="logout"
              onPress={handleLogout}
             
              style={styles.logoutBtn}
            >
              Logout Account
            </Button>
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { paddingVertical: 24 },
  title: { fontWeight: '800', },
  contentRow: { flexDirection: 'row', gap: 20, flexWrap: 'wrap', marginBottom: 40 },
  card: { flex: 1, minWidth: 320, backgroundColor: 'white', borderRadius: 16, borderWidth: 1, },
  cardContent: { padding: 20 },
  sectionHeaderRow: { marginBottom: 16 },
  iconTitleBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontWeight: '700', fontSize: 15, },
  input: { marginBottom: 16, backgroundColor: 'white' },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  segmentedBtn: { marginBottom: 16 },
  saveBtn: { borderRadius: 10, marginTop: 8, paddingVertical: 4 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  switchLabel: { fontSize: 13, fontWeight: '700', },
  switchDesc: { fontSize: 11, marginTop: 3, lineHeight: 16, marginBottom: 14 },
  divider: { height: 1, marginVertical: 20 },
  logoutBtn: { borderRadius: 10, marginTop: 8 },
});
