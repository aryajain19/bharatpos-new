import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert, Modal, Platform, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text, Card, DataTable, Button, useTheme, IconButton, Switch, TextInput, SegmentedButtons } from 'react-native-paper';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, setDoc, addDoc, getDoc } from '../../lib/firestore_adapter';
import { useAuth } from '../../providers/AuthProvider';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../../providers/ThemeProvider';
import { router } from 'expo-router';

// ─── Types ────────────────────────────────────────────────────────────
interface AttendanceLog {
  id?: string;
  date: string;
  status: Record<string, 'present' | 'absent' | 'halfday'>;
}

export default function VendorManagementScreen() {
  const { isDarkMode } = useAppTheme();
  const appTheme = useTheme();
  const theme = useTheme();
  const { subscriptionPlan, tenantId, loading: authLoading } = useAuth();
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'directory' | 'attendance' | 'payroll'>('directory');

  // Core state
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

  // Attendance states
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
  });
  const [attendanceSheet, setAttendanceSheet] = useState<Record<string, 'present' | 'absent' | 'halfday'>>({});
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Payroll states
  const [editingWageId, setEditingWageId] = useState<string | null>(null);
  const [tempWage, setTempWage] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const [showPayslip, setShowPayslip] = useState(false);

  // Device Limit Logic
  const getDeviceLimit = () => {
    return 9999; // Unlimited worker registration
  };

  const deviceLimit = getDeviceLimit();
  const workerLimit = deviceLimit === 9999 ? 9999 : Math.max(0, deviceLimit - 1);
  const workerCount = vendors.length;
  const isLimitReached = workerCount >= workerLimit;

  useEffect(() => {
    if (!authLoading && tenantId) {
      fetchVendorsAndLogs();
    }
  }, [authLoading, tenantId, activeTab]);

  const fetchVendorsAndLogs = async () => {
    if (!isFirebaseConfigured || !tenantId) {
      setVendors([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    
    try {
      // 1. Fetch salespersons
      const q = query(
        collection(db, 'users'), 
        where('role', '==', 'salesperson'),
        where('tenant_id', '==', tenantId)
      );
      const snapshot = await getDocs(q);
      const vendorsData = snapshot.docs.map(doc => {
        const d = doc.data();
        return { 
          id: doc.id, 
          ...d,
          daily_wage: d.daily_wage || 600 // Default wage is ₹600/day
        };
      });
      setVendors(vendorsData);

      // 2. Fetch Attendance logs
      const attQ = query(
        collection(db, 'attendance'),
        where('tenant_id', '==', tenantId)
      );
      const attSnap = await getDocs(attQ);
      const logs: AttendanceLog[] = attSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceLog));
      setAttendanceLogs(logs);

      // Populate current date checklist if logs exist
      const todayLog = logs.find(l => l.date === selectedDate);
      const initialSheet: Record<string, 'present' | 'absent' | 'halfday'> = {};
      vendorsData.forEach(v => {
        initialSheet[v.id] = todayLog?.status[v.id] || 'present';
      });
      setAttendanceSheet(initialSheet);
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
      Alert.alert('Device Limit Reached', 'Please upgrade your plan to register more cashier devices.');
      return;
    }

    const newPermissions = {
      pos_access: true,
      stock_management: true,
      barcode_generation: true,
      reporting: true
    };

    setLoading(true);
    try {
      const finalEmail = phone.includes('@') ? phone : `${phone}@pos.com`;
      const isWeb = Platform.OS === 'web';
      const apiHost = isWeb ? '' : 'https://bharatpos-new.vercel.app';

      const response = await fetch(`${apiHost}/api/create-worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          phone,
          email: finalEmail,
          password,
          tenantId,
          permissions: newPermissions,
          subscriptionPlan: subscriptionPlan || 'free_trial'
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to register worker');
      }

      Alert.alert('Success', `Worker ${fullName} successfully registered!`);
      setPhone('');
      setPassword('');
      setFullName('');
      fetchVendorsAndLogs();
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

  const handleDeleteVendor = async (vendorId: string, name: string) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete worker ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { deleteDoc } = await import('../../lib/firestore_adapter');
              await deleteDoc(doc(db, 'users', vendorId));
              Alert.alert('Success', 'Worker successfully deleted.');
              fetchVendorsAndLogs();
            } catch (err: any) {
              Alert.alert('Error deleting worker', err.message);
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const savePermissions = async () => {
    if (!editingVendor) return;
    try {
      const userRef = doc(db, 'users', editingVendor.id);
      await updateDoc(userRef, { permissions });
      Alert.alert('Success', 'Permissions updated!');
      setModalVisible(false);
      fetchVendorsAndLogs();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // Attendance checklist handlers
  const handleSaveAttendance = async () => {
    setSavingAttendance(true);
    try {
      const todayLog = attendanceLogs.find(l => l.date === selectedDate);
      if (todayLog?.id) {
        const attRef = doc(db, 'attendance', todayLog.id);
        await updateDoc(attRef, { status: attendanceSheet });
      } else {
        const attCol = collection(db, 'attendance');
        await addDoc(attCol, {
          tenant_id: tenantId,
          date: selectedDate,
          status: attendanceSheet
        });
      }
      Alert.alert('Success', `Attendance for ${selectedDate} saved successfully!`);
      fetchVendorsAndLogs();
    } catch (e: any) {
      Alert.alert('Error', 'Failed to save attendance: ' + e.message);
    } finally {
      setSavingAttendance(false);
    }
  };

  // Payroll calculations & handlers
  const payrollData = useMemo(() => {
    const currentMonthStr = selectedDate.substring(0, 7); // YYYY-MM
    return vendors.map(v => {
      let presentCount = 0;
      let absentCount = 0;
      let halfdayCount = 0;

      attendanceLogs.forEach(log => {
        if (log.date.startsWith(currentMonthStr)) {
          const status = log.status[v.id];
          if (status === 'present') presentCount++;
          else if (status === 'absent') absentCount++;
          else if (status === 'halfday') halfdayCount++;
        }
      });

      const totalDays = presentCount + (halfdayCount * 0.5);
      const calculatedSalary = totalDays * (v.daily_wage || 600);

      return {
        ...v,
        present: presentCount,
        absent: absentCount,
        halfday: halfdayCount,
        workingDays: totalDays,
        salary: calculatedSalary
      };
    });
  }, [vendors, attendanceLogs, selectedDate]);

  const handleUpdateWage = async (vendorId: string) => {
    const wageNum = parseFloat(tempWage);
    if (isNaN(wageNum) || wageNum <= 0) {
      Alert.alert('Error', 'Please enter a valid daily wage rate.');
      return;
    }
    try {
      const userRef = doc(db, 'users', vendorId);
      await updateDoc(userRef, { daily_wage: wageNum });
      Alert.alert('Success', 'Wage rate updated successfully!');
      setEditingWageId(null);
      setTempWage('');
      fetchVendorsAndLogs();
    } catch (e: any) {
      Alert.alert('Error', 'Failed to update wage rate: ' + e.message);
    }
  };

  if (loading && vendors.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appTheme.colors.background }}>
        <ActivityIndicator size="large" color={appTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: appTheme.colors.onSurfaceVariant, fontWeight: '600' }}>Loading Staff Dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <View>
            <Text variant="headlineSmall" style={styles.title}>Staff Payroll & Attendance</Text>
            <Text style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>Attendance checklists, payslips, and daily wage records</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <SegmentedButtons
        value={activeTab}
        onValueChange={setActiveTab as any}
        buttons={[
          { value: 'directory', label: 'Staff Directory', icon: 'account-multiple-outline' },
          { value: 'attendance', label: 'Daily Attendance', icon: 'checkbox-marked-circle-outline' },
          { value: 'payroll', label: 'Monthly Payroll', icon: 'currency-inr' },
        ]}
        style={{ marginBottom: 24 }}
        theme={{ colors: { primary: '#10B981' } }}
      />

      {/* DIRECTORY TAB */}
      {activeTab === 'directory' && (
        <>
          <Card style={{ backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#10B981', borderRadius: 12, marginBottom: 20 }} elevation={0}>
            <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <Icon name="cellphone-link-variant" size={24} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E40AF' }}>
                  Workers Registered: {workerCount} / Unlimited
                </Text>
                <Text style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>
                  Assign devices to your cashier salespeople and customize their features access.
                </Text>
              </View>
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
                />
                <Button 
                  mode="contained" 
                  onPress={handleAddVendor} 
                  style={styles.addBtn} 
                  contentStyle={{ paddingVertical: 8 }}
                >
                  REGISTER DEVICE
                </Button>
              </View>
            </Card.Content>
          </Card>

          <Card style={styles.card} elevation={0}>
            <Card.Content style={{ padding: 0 }}>
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title style={{ flex: 2 }}><Text style={styles.colHeader}>Worker Name</Text></DataTable.Title>
                  <DataTable.Title style={{ flex: 1.5 }}><Text style={styles.colHeader}>Mobile Phone</Text></DataTable.Title>
                  <DataTable.Title style={{ flex: 2 }}><Text style={styles.colHeader}>Base Daily Wage</Text></DataTable.Title>
                  <DataTable.Title style={{ flex: 2 }}><Text style={styles.colHeader}>Worker Permissions</Text></DataTable.Title>
                  <DataTable.Title numeric><Text style={styles.colHeader}>Actions</Text></DataTable.Title>
                </DataTable.Header>

                {vendors.map((vendor) => (
                  <DataTable.Row key={vendor.id}>
                    <DataTable.Cell style={{ flex: 2 }}>
                      <Text style={{ fontWeight: 'bold', color: appTheme.colors.onSurface }}>{vendor.full_name || 'Unnamed'}</Text>
                    </DataTable.Cell>
                    <DataTable.Cell style={{ flex: 1.5 }}>
                      <Text style={{ color: appTheme.colors.onSurface }}>+91 {vendor.phone || 'N/A'}</Text>
                    </DataTable.Cell>
                    <DataTable.Cell style={{ flex: 2 }}>
                      <Text style={{ color: '#475569', fontWeight: 'bold' }}>₹{vendor.daily_wage}/day</Text>
                    </DataTable.Cell>
                    <DataTable.Cell style={{ flex: 2 }}>
                      <Button mode="text" onPress={() => openPermissionsModal(vendor)}>Configure Access</Button>
                    </DataTable.Cell>
                    <DataTable.Cell numeric>
                      <IconButton icon="delete-outline" size={20} iconColor="#EF4444" onPress={() => handleDeleteVendor(vendor.id, vendor.full_name || 'Unnamed')} />
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}

                {vendors.length === 0 && (
                  <DataTable.Row>
                    <DataTable.Cell><Text style={{ fontStyle: 'italic', color: '#94A3B8' }}>No registered staff members found.</Text></DataTable.Cell>
                  </DataTable.Row>
                )}
              </DataTable>
            </Card.Content>
          </Card>
        </>
      )}

      {/* ATTENDANCE TAB */}
      {activeTab === 'attendance' && (
        <Card style={styles.card} elevation={0}>
          <Card.Content>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Icon name="calendar-month-outline" size={22} color="#10B981" />
                <Text style={{ fontSize: 16, fontWeight: '700' }}>Attendance Sheet: {selectedDate}</Text>
              </View>
              <Button 
                mode="contained" 
                icon="check-bold" 
                onPress={handleSaveAttendance} 
                loading={savingAttendance}
                style={{ backgroundColor: '#10B981', borderRadius: 8 }}
              >
                Save Attendance
              </Button>
            </View>

            <DataTable>
              <DataTable.Header>
                <DataTable.Title style={{ flex: 2 }}><Text style={styles.colHeader}>Worker Name</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 4 }}><Text style={styles.colHeader}>Attendance Status</Text></DataTable.Title>
              </DataTable.Header>

              {vendors.map(vendor => {
                const currentStatus = attendanceSheet[vendor.id] || 'present';
                return (
                  <DataTable.Row key={vendor.id} style={{ minHeight: 60 }}>
                    <DataTable.Cell style={{ flex: 2 }}>
                      <Text style={{ fontWeight: 'bold' }}>{vendor.full_name}</Text>
                    </DataTable.Cell>
                    <DataTable.Cell style={{ flex: 4 }}>
                      <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 8 }}>
                        <Button 
                          mode={currentStatus === 'present' ? 'contained' : 'outlined'}
                          onPress={() => setAttendanceSheet({ ...attendanceSheet, [vendor.id]: 'present' })}
                          style={{ borderRadius: 6, borderColor: '#10B981' }}
                          buttonColor={currentStatus === 'present' ? '#10B981' : undefined}
                          textColor={currentStatus === 'present' ? 'white' : '#10B981'}
                          compact
                          labelStyle={{ fontSize: 11 }}
                        >
                          Present
                        </Button>
                        <Button 
                          mode={currentStatus === 'halfday' ? 'contained' : 'outlined'}
                          onPress={() => setAttendanceSheet({ ...attendanceSheet, [vendor.id]: 'halfday' })}
                          style={{ borderRadius: 6, borderColor: '#F59E0B' }}
                          buttonColor={currentStatus === 'halfday' ? '#F59E0B' : undefined}
                          textColor={currentStatus === 'halfday' ? 'white' : '#F59E0B'}
                          compact
                          labelStyle={{ fontSize: 11 }}
                        >
                          Half-Day
                        </Button>
                        <Button 
                          mode={currentStatus === 'absent' ? 'contained' : 'outlined'}
                          onPress={() => setAttendanceSheet({ ...attendanceSheet, [vendor.id]: 'absent' })}
                          style={{ borderRadius: 6, borderColor: '#EF4444' }}
                          buttonColor={currentStatus === 'absent' ? '#EF4444' : undefined}
                          textColor={currentStatus === 'absent' ? 'white' : '#EF4444'}
                          compact
                          labelStyle={{ fontSize: 11 }}
                        >
                          Absent
                        </Button>
                      </View>
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}

              {vendors.length === 0 && (
                <DataTable.Row>
                  <DataTable.Cell>Register salesperson devices first to record daily attendance sheets.</DataTable.Cell>
                </DataTable.Row>
              )}
            </DataTable>
          </Card.Content>
        </Card>
      )}

      {/* PAYROLL TAB */}
      {activeTab === 'payroll' && (
        <Card style={styles.card} elevation={0}>
          <Card.Content style={{ padding: 0 }}>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title style={{ flex: 2 }}><Text style={styles.colHeader}>Worker Name</Text></DataTable.Title>
                <DataTable.Title numeric><Text style={styles.colHeader}>Base Wage</Text></DataTable.Title>
                <DataTable.Title numeric><Text style={styles.colHeader}>Present Days</Text></DataTable.Title>
                <DataTable.Title numeric><Text style={styles.colHeader}>Half-Days</Text></DataTable.Title>
                <DataTable.Title numeric><Text style={styles.colHeader}>Calculated Salary</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1.5 }}><Text style={styles.colHeader}>Action</Text></DataTable.Title>
              </DataTable.Header>

              {payrollData.map(v => (
                <DataTable.Row key={v.id} style={{ minHeight: 60 }}>
                  <DataTable.Cell style={{ flex: 2 }}>
                    <Text style={{ fontWeight: 'bold' }}>{v.full_name}</Text>
                  </DataTable.Cell>
                  
                  <DataTable.Cell numeric>
                    {editingWageId === v.id ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <TextInput
                          value={tempWage}
                          onChangeText={setTempWage}
                          keyboardType="numeric"
                          dense
                          style={{ width: 60, height: 32, backgroundColor: 'white' }}
                          mode="outlined"
                          activeOutlineColor="#10B981"
                        />
                        <IconButton icon="check-bold" size={16} iconColor="#10B981" onPress={() => handleUpdateWage(v.id)} />
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => { setEditingWageId(v.id); setTempWage(String(v.daily_wage)); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontWeight: '600' }}>₹{v.daily_wage}</Text>
                        <Icon name="pencil" size={12} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </DataTable.Cell>

                  <DataTable.Cell numeric>{v.present}</DataTable.Cell>
                  <DataTable.Cell numeric>{v.halfday}</DataTable.Cell>
                  
                  <DataTable.Cell numeric>
                    <Text style={{ fontWeight: 'bold', color: '#10B981' }}>₹{v.salary.toLocaleString('en-IN')}</Text>
                  </DataTable.Cell>

                  <DataTable.Cell numeric style={{ flex: 1.5 }}>
                    <Button 
                      mode="contained" 
                      compact 
                      style={{ borderRadius: 6, backgroundColor: '#6366F1' }}
                      onPress={() => {
                        setSelectedPayslip(v);
                        setShowPayslip(true);
                      }}
                      labelStyle={{ fontSize: 11 }}
                    >
                      Payslip
                    </Button>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}

              {payrollData.length === 0 && (
                <DataTable.Row>
                  <DataTable.Cell>No staff payroll records to display.</DataTable.Cell>
                </DataTable.Row>
              )}
            </DataTable>
          </Card.Content>
        </Card>
      )}

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
              <Button mode="contained" onPress={savePermissions} style={{ flex: 1, backgroundColor: '#10B981' }}>Save Changes</Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Salary Payslip Modal */}
      <Modal visible={showPayslip} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: 500, padding: 24 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B' }}>Monthly Salary Payslip</Text>
              <IconButton icon="close" size={20} onPress={() => setShowPayslip(false)} />
            </View>

            {selectedPayslip && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ gap: 16 }}>
                <View style={styles.slipCard}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#6366F1', textAlign: 'center', marginBottom: 4 }}>BHARATPOS SYSTEMS</Text>
                  <Text style={{ fontSize: 11, color: '#64748B', textAlign: 'center', marginBottom: 12 }}>Merchant Retail & Accounting Statement</Text>
                  
                  <Divider style={{ marginBottom: 12 }} />

                  {/* Employee Details */}
                  <View style={{ gap: 4, marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700' }}>Name: <Text style={{ fontWeight: '500' }}>{selectedPayslip.full_name}</Text></Text>
                    <Text style={{ fontSize: 13, fontWeight: '700' }}>Role: <Text style={{ fontWeight: '500' }}>Salesperson / Cashier</Text></Text>
                    <Text style={{ fontSize: 13, fontWeight: '700' }}>Mobile: <Text style={{ fontWeight: '500' }}>+91 {selectedPayslip.phone}</Text></Text>
                    <Text style={{ fontSize: 13, fontWeight: '700' }}>Month: <Text style={{ fontWeight: '500' }}>{new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text></Text>
                  </View>

                  <Divider style={{ marginBottom: 12 }} />

                  {/* Attendance Details */}
                  <View style={{ gap: 6, marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#475569', marginBottom: 4 }}>Attendance Summary</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: '#475569' }}>Present Days:</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700' }}>{selectedPayslip.present}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: '#475569' }}>Half-Days:</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700' }}>{selectedPayslip.halfday}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: '#475569' }}>Absent Days:</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700' }}>{selectedPayslip.absent}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 6, marginTop: 4 }}>
                      <Text style={{ fontSize: 13, color: '#1E293B', fontWeight: '700' }}>Total Paid Days:</Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#6366F1' }}>{selectedPayslip.workingDays} Days</Text>
                    </View>
                  </View>

                  <Divider style={{ marginBottom: 12 }} />

                  {/* Salary Calculations */}
                  <View style={{ gap: 6, marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#475569', marginBottom: 4 }}>Earnings & Wages</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: '#475569' }}>Base Daily Rate:</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700' }}>₹{selectedPayslip.daily_wage.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 8, marginTop: 4 }}>
                      <Text style={{ fontSize: 14, color: '#1E293B', fontWeight: '800' }}>Net Salary Paid:</Text>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#10B981' }}>₹{selectedPayslip.salary.toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                </View>

                <Button 
                  mode="contained" 
                  icon="printer" 
                  onPress={() => Alert.alert('Print Statement', 'Payslip formatted and sent to receipt printer.')}
                  style={{ backgroundColor: '#6366F1', borderRadius: 8, marginTop: 12 }}
                >
                  Print Payslip Receipt
                </Button>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { paddingVertical: 24 },
  title: { fontWeight: 'bold', fontSize: 22 },
  card: { backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#EEF0F6' },
  colHeader: { fontWeight: 'bold', color: '#475569' },
  formRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' },
  input: { flex: 1, minWidth: 200, backgroundColor: 'white' },
  addBtn: { borderRadius: 8, backgroundColor: '#10B981' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', padding: 30, borderRadius: 16, width: 400, maxWidth: '90%' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  switchLabel: { fontSize: 16, },
  modalActions: { flexDirection: 'row', marginTop: 30 },

  slipCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16
  }
});
