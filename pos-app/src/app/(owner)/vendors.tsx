import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Modal, Platform, ActivityIndicator } from 'react-native';
import { Text, Card, DataTable, Button, useTheme, IconButton, Switch, TextInput } from 'react-native-paper';
import { db, isFirebaseConfigured, auth, secondaryAuth } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, setDoc } from '../../lib/firestore_adapter';
import { useAuth } from '../../providers/AuthProvider';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../../providers/ThemeProvider';
import { router } from 'expo-router';

export default function VendorManagementScreen() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const theme = useTheme();
  const { subscriptionPlan, tenantId, loading: authLoading } = useAuth();
  
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New vendor form
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Edit Permissions Modal
  const [editingVendor, setEditingVendor] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [permissions, setPermissions] = useState({
    pos_access: true,
    stock_management: true,
    barcode_generation: true,
    reporting: true
  });

  // Device Limit Logic
  const getDeviceLimit = () => {
    if (subscriptionPlan === 'free_trial') return 1; // 1 device only
    if (subscriptionPlan === 'paid_1_year') return 3; // Small Vendor: 3 devices (2 workers + 1 owner)
    if (subscriptionPlan === 'paid_2_year') return 5; // Medium Shop: 5 devices (4 workers + 1 owner)
    if (subscriptionPlan === 'paid_3_year') return 9999; // Large Shop: Unlimited
    return 3; // Default Small Vendor
  };

  const deviceLimit = getDeviceLimit();
  const workerLimit = deviceLimit === 9999 ? 9999 : Math.max(0, deviceLimit - 1); // subtract 1 for owner device
  const workerCount = vendors.length;
  const isLimitReached = workerCount >= workerLimit;

  useEffect(() => {
    if (!authLoading) {
      fetchVendors();
    }
  }, [authLoading, tenantId]);

  const fetchVendors = async () => {
    if (!isFirebaseConfigured) {
      setVendors([]);
      setLoading(false);
      return;
    }
    if (!tenantId) {
      setVendors([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    
    try {
      const q = query(
        collection(db, 'users'), 
        where('role', '==', 'salesperson'),
        where('tenant_id', '==', tenantId)
      );
      const snapshot = await getDocs(q);
      const vendorsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVendors(vendorsData);
    } catch (err: any) {
      console.error("Error fetching vendors:", err);
      setError(err.message || "Failed to load vendors.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddVendor = async () => {
    if (!phone || !password || !fullName) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    if (isLimitReached) {
      Alert.alert('Device Limit Reached', 'Please upgrade your subscription plan to add more worker devices.');
      return;
    }

    // New worker default permissions based on Small Vendor vs other plans
    const isSmallVendor = false;
    const newPermissions = isSmallVendor ? {
      pos_access: true,
      stock_management: false,
      barcode_generation: false,
      reporting: false
    } : {
      pos_access: true,
      stock_management: true,
      barcode_generation: true,
      reporting: true
    };

    if (!isFirebaseConfigured) {
      Alert.alert('Error', 'Vendor addition requires backend functions.');
      setPhone('');
      setPassword('');
      setFullName('');
      return;
    }

    if (!tenantId) {
      Alert.alert('Error', 'Tenant ID is missing. Please log in again.');
      return;
    }

    setLoading(true);
    try {
      const finalEmail = phone.includes('@') ? phone : `${phone}@pos.com`;
      const defaultPassword = password;

      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, finalEmail, defaultPassword);
      const workerUid = userCredential.user.uid;

      await setDoc(doc(db, 'users', workerUid), {
        full_name: fullName,
        phone: phone,
        email: finalEmail,
        role: 'salesperson',
        tenant_id: tenantId,
        permissions: newPermissions,
        subscription_plan: subscriptionPlan || 'free_trial',
        created_at: new Date().toISOString()
      });

      Alert.alert('Success', `Worker ${fullName} successfully registered!\nLogin Phone/Email: ${phone}\nPassword: ${password}`);
      setPhone('');
      setPassword('');
      setFullName('');
      fetchVendors();
    } catch (error: any) {
      Alert.alert('Error registering worker', error.message);
    } finally {
      setLoading(false);
    }
  };

  const openPermissionsModal = (vendor: any) => {
    setEditingVendor(vendor);
    if (vendor.permissions) {
      setPermissions(vendor.permissions);
    } else {
      setPermissions({ pos_access: true, stock_management: true, barcode_generation: true, reporting: true });
    }
    setModalVisible(true);
  };

  const savePermissions = async () => {
    if (!editingVendor) return;

    if (!isFirebaseConfigured) {
      Alert.alert('Error', 'Vendor addition requires backend functions which are currently simulated in this demo. For a real app, this would create an Auth user and a Firestore document.');
      setModalVisible(false);
      return;
    }
    
    try {
      const userRef = doc(db, 'users', editingVendor.id);
      await updateDoc(userRef, { permissions });
      
      Alert.alert('Success', 'Permissions updated!');
      setModalVisible(false);
      fetchVendors();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Users & Workers...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: appTheme.colors.background }}>
        <Card style={{ padding: 32, borderRadius: 16, width: '90%', maxWidth: 500, alignItems: 'center', borderWidth: 1, borderColor: appTheme.colors.outlineVariant, backgroundColor: 'white' }} elevation={1}>
          <Icon name="alert-circle-outline" size={48} color={appTheme.colors.error} style={{ marginBottom: 10 }} />
          <Text variant="titleMedium" style={{ marginTop: 8, fontWeight: 'bold', color: appTheme.colors.onSurface, textAlign: 'center' }}>Unable to Load Users & Workers</Text>
          <Text style={{ marginTop: 8, color: 'gray', textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 24 }}>{error}</Text>
          <Button mode="contained" onPress={fetchVendors} style={{ borderRadius: 10, width: '100%', backgroundColor: appTheme.colors.primary }}>
            Retry Sync
          </Button>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>User Management & Permissions</Text>
      </View>

      {/* Subscription device limit warning banner */}
      <Card style={{ backgroundColor: isLimitReached ? '#FFFBEB' : '#ECFDF5', borderWidth: 1, borderColor: isLimitReached ? '#F59E0B' : '#10B981', borderRadius: 12, marginBottom: 20 }} elevation={0}>
        <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
          <Icon name="cellphone-link-variant" size={24} color={isLimitReached ? '#D97706' : '#10B981'} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: isLimitReached ? '#92400E' : '#1E40AF' }}>
              Workers Registered: {workerCount} / {workerLimit === 9999 ? 'Unlimited' : workerLimit}
            </Text>
            <Text style={{ fontSize: 11, color: isLimitReached ? '#B45309' : '#059669', marginTop: 2 }}>
              {isLimitReached 
                ? "You have reached your worker limit. Upgrade subscription plan to register more cashier phones."
                : workerCount === 0 
                  ? `No workers registered yet. Your plan allows up to ${workerLimit} worker devices.`
                  : `Your current plan allows registering up to ${workerLimit} worker devices.`}
            </Text>
          </View>
          {isLimitReached && (
            <Button mode="contained" labelStyle={{ fontSize: 11, fontWeight: 'bold' }} style={{ borderRadius: 8 }} onPress={() => router.push('/(owner)/upgrade' as any)}>
              UPGRADE
            </Button>
          )}
        </Card.Content>
      </Card>

      <Card style={[styles.card, { marginBottom: 24 }]} elevation={0}>
        <Card.Content>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 16 }}>Add Worker Device</Text>
          <View style={styles.formRow}>
            <TextInput 
              label="Worker Full Name" 
              value={fullName} 
              onChangeText={setFullName} 
              mode="outlined" 
              style={styles.input} 
              outlineColor="#EEF0F6"
              activeOutlineColor="#10B981"
              disabled={isLimitReached}
            />
            <TextInput 
              label="Worker Mobile Number" 
              value={phone} 
              onChangeText={setPhone} 
              mode="outlined" 
              style={styles.input} 
              keyboardType="phone-pad"
              outlineColor="#EEF0F6"
              activeOutlineColor="#10B981"
              disabled={isLimitReached}
            />
            <TextInput 
              label="Device Login Password" 
              value={password} 
              onChangeText={setPassword} 
              mode="outlined" 
              style={styles.input} 
              secureTextEntry 
              outlineColor="#EEF0F6"
              activeOutlineColor="#10B981"
              disabled={isLimitReached}
            />
            <Button 
              mode="contained" 
              onPress={handleAddVendor} 
              style={[styles.addBtn, isLimitReached && { backgroundColor: appTheme.colors.surface }]} 
              disabled={isLimitReached}
              contentStyle={{ paddingVertical: 8 }}
            >
              REGISTER DEVICE
            </Button>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card} elevation={0}>
        <Card.Content>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 16 }}>Registered Cashier Devices</Text>
          
          <ScrollView horizontal>
            <View style={{ minWidth: 900 }}>
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title style={{ flex: 2 }}><Text style={styles.colHeader}>Worker Name</Text></DataTable.Title>
                  <DataTable.Title style={{ flex: 1.5 }}><Text style={styles.colHeader}>Mobile Phone</Text></DataTable.Title>
                  <DataTable.Title style={{ flex: 2 }}><Text style={styles.colHeader}>Device Plan</Text></DataTable.Title>
                  <DataTable.Title style={{ flex: 2 }}><Text style={styles.colHeader}>Worker Permissions</Text></DataTable.Title>
                  <DataTable.Title numeric><Text style={styles.colHeader}>Actions</Text></DataTable.Title>
                </DataTable.Header>

                {vendors.map((vendor) => {
                  const isSmallPlan = false;
                  
                  const handleMockDelete = () => {
                    setVendors(vendors.filter((v: any) => v.id !== vendor.id));
                    Alert.alert('Deleted', 'Vendor removed (simulated).');
                  };

                  return (
                    <DataTable.Row key={vendor.id}>
                      <DataTable.Cell style={{ flex: 2 }}><Text style={{ fontWeight: 'bold', color: appTheme.colors.onSurface }}>{vendor.full_name || 'Unnamed'}</Text></DataTable.Cell>
                      <DataTable.Cell style={{ flex: 1.5 }}><Text style={{ color: appTheme.colors.onSurface }}>+91 {vendor.phone || 'N/A'}</Text></DataTable.Cell>
                      <DataTable.Cell style={{ flex: 2 }}>
                        <Text style={{ color: isSmallPlan ? '#D81B60' : '#10B981', fontWeight: 'bold' }}>
                          {isSmallPlan ? 'Small Shop (Mobile)' : 'Pro Terminal'}
                        </Text>
                      </DataTable.Cell>
                      <DataTable.Cell style={{ flex: 2 }}>
                        {isSmallPlan ? (
                          <View style={{ backgroundColor: appTheme.colors.surface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                            <Text style={{ color: appTheme.colors.onSurface, fontSize: 11, fontWeight: 'bold' }}> Billing Only (Locked)</Text>
                          </View>
                        ) : (
                          <Button mode="text" onPress={() => openPermissionsModal(vendor)}>Configure Access</Button>
                        )}
                      </DataTable.Cell>
                      <DataTable.Cell numeric>
                        <IconButton icon="delete-outline" size={20} iconColor="#EF4444" onPress={handleMockDelete} />
                      </DataTable.Cell>
                    </DataTable.Row>
                  );
                })}
                
                {vendors.length === 0 && !loading && (
                  <DataTable.Row>
                    <DataTable.Cell>No registered devices found.</DataTable.Cell>
                  </DataTable.Row>
                )}
              </DataTable>
            </View>
          </ScrollView>
        </Card.Content>
      </Card>

      {/* Permissions Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text variant="titleLarge" style={{ fontWeight: 'bold', marginBottom: 20 }}>
              Edit Permissions: {editingVendor?.full_name}
            </Text>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>POS Access (Selling)</Text>
              <Switch value={permissions.pos_access} onValueChange={(v: any) => setPermissions({...permissions, pos_access: v})} color="#10B981" />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Stock Management</Text>
              <Switch value={permissions.stock_management} onValueChange={(v: any) => setPermissions({...permissions, stock_management: v})} color="#10B981" />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Barcode Generation</Text>
              <Switch value={permissions.barcode_generation} onValueChange={(v: any) => setPermissions({...permissions, barcode_generation: v})} color="#10B981" />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Full Reporting</Text>
              <Switch value={permissions.reporting} onValueChange={(v: any) => setPermissions({...permissions, reporting: v})} color="#10B981" />
            </View>

            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={() => setModalVisible(false)} style={{ flex: 1, marginRight: 8 }}>Cancel</Button>
              <Button mode="contained" onPress={savePermissions} style={{ flex: 1, backgroundColor: appTheme.colors.surface }}>Save Changes</Button>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { paddingVertical: 24 },
  title: { fontWeight: 'bold', },
  card: { backgroundColor: 'white', borderRadius: 12 },
  colHeader: { fontWeight: 'bold', color: 'gray' },
  formRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' },
  input: { flex: 1, minWidth: 200, backgroundColor: 'white' },
  addBtn: { borderRadius: 8, },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', padding: 30, borderRadius: 16, width: 400, maxWidth: '90%' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  switchLabel: { fontSize: 16, },
  modalActions: { flexDirection: 'row', marginTop: 30 },
});
