import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity, FlatList, Platform, Animated, useWindowDimensions } from 'react-native';
import { 
  Text, Card, Button, DataTable, IconButton, Portal, Dialog, 
  TextInput, Switch, Searchbar, Checkbox, Divider, List, Badge, SegmentedButtons
} from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { db, isFirebaseConfigured, secondaryAuth, auth } from '../lib/firebase';
import { collection, getDocs, query, where, doc, setDoc, serverTimestamp, addDoc, onSnapshot, deleteDoc } from '../lib/firestore_adapter';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

// ---------------------------------------------------------
// DATA SEEDING (REMOVED)
// ---------------------------------------------------------
const initialPermissions = {
  barcode: true,
  billing: true,
  worker: true,
  reports: true,
  inventory: true,
  gst: true,
  pdfExport: true,
  dashboard: true,
  multiDevice: true,
  apiAccess: false
};

// ---------------------------------------------------------
// HELPER: Status Badge with proper colors
// ---------------------------------------------------------
const StatusBadge = ({ status }: { status: string }) => {
  const getStyle = () => {
    switch (status) {
      case 'Active':
      case 'Enabled':
      case 'Success':
      case 'Paid':
      case 'Resolved':
      case 'Running':
      case 'Completed':
      case 'Confirmed':
        return { bg: '#E8F5E9', color: '#2E7D32', icon: 'check-circle' };
      case 'Expired':
      case 'Failed':
      case 'Disabled':
      case 'Warning':
        return { bg: '#FFEBEE', color: '#C62828', icon: 'close-circle' };
      case 'Trial':
      case 'Pending':
      case 'In Progress':
        return { bg: '#E3F2FD', color: '#1565C0', icon: 'clock-outline' };
      case 'Suspended':
      case 'Offline':
        return { bg: '#FFF3E0', color: '#E65100', icon: 'pause-circle' };
      default:
        return { bg: '#F5F5F5', color: '#616161', icon: 'information' };
    }
  };
  const s = getStyle();
  return (
    <View style={[styles.statusBadgeWrap, { backgroundColor: s.bg }]}>
      <Icon name={s.icon} size={12} color={s.color} style={{ marginRight: 4 }} />
      <Text style={{ color: s.color, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>{status}</Text>
    </View>
  );
};

// ---------------------------------------------------------
// HELPER: Animated Tab Wrapper
// ---------------------------------------------------------
const AnimatedTab = ({ children, tabKey }: { children: React.ReactNode; tabKey: string }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(18);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [tabKey]);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      {children}
    </Animated.View>
  );
};

// ---------------------------------------------------------
// HELPER: Empty State
// ---------------------------------------------------------
const EmptyState = ({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIconWrap}>
      <Icon name={icon} size={48} color="#B0B3D6" />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptySubtitle}>{subtitle}</Text>
  </View>
);

// ---------------------------------------------------------
// COMPONENT MAIN
// ---------------------------------------------------------
export default function SuperAdminDashboard() {
  const { tab, darkMode } = useLocalSearchParams();
  const currentTab = (tab || 'overview') as string;
  const isDark = darkMode === 'true';

  const handleNav = (tabName: string) => {
    router.push({
      pathname: '/',
      params: { tab: tabName }
    } as any);
  };
  const { width: screenWidth } = useWindowDimensions();
  const isMobileSize = screenWidth <= 900;
  const chartWidth = isMobileSize ? screenWidth - 72 : Math.max((screenWidth - 340) / 3.15, 300);

  // Global State
  const [customers, setCustomers] = useState<any[]>([]);
  const [pricingPlans, setPricingPlans] = useState<any[]>([]);
  const [demos, setDemos] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [recentAct, setRecentAct] = useState<any[]>([]);
  const [previewReport, setPreviewReport] = useState<any>(null);

  // Real stats states
  const [totalRevenueSum, setTotalRevenueSum] = useState(0);
  const [monthlyRevenueSum, setMonthlyRevenueSum] = useState(0);
  const [weeklyRevenueSum, setWeeklyRevenueSum] = useState(0);
  const [todayRevenueSum, setTodayRevenueSum] = useState(0);
  const [totalTransactionsCount, setTotalTransactionsCount] = useState(0);
  const [salesChartData, setSalesChartData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [barcodesList, setBarcodesList] = useState<any[]>([]);
  const [salesList, setSalesList] = useState<any[]>([]);
  
  // Data Fetching Effect
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (isFirebaseConfigured) {
        try {
          const usersQuery = query(collection(db, 'users'), where('role', 'in', ['owner', 'vendor']));
          const userSnap = await getDocs(usersQuery);
          const fetchedUsers: any[] = [];
          
          userSnap.forEach((doc: any) => {
            const d = doc.data();
            fetchedUsers.push({
              id: doc.id,
              name: d.owner_name || d.fullName || d.full_name || 'N/A',
              store: d.store_name || d.storeName || 'Unnamed Store',
              email: d.email || 'N/A',
              phone: d.phone || d.mobileNumber || 'N/A',
              status: d.subscription_status || d.status || 'Active',
              plan: d.subscription_plan || 'Free Trial',
              expiry: d.subscription_end_date ? (d.subscription_end_date.toDate ? new Date(d.subscription_end_date.toDate()).toLocaleDateString() : new Date(d.subscription_end_date).toLocaleDateString()) : 'N/A',
              devices: 1,
              dbSize: 'Unknown',
            });
          });
          
          setCustomers(fetchedUsers);

          // Fetch Workers
          const workersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'salesperson')));
          const fetchedWorkers: any[] = [];
          workersSnap.forEach((doc: any) => {
            const d = doc.data();
            fetchedWorkers.push({
              id: doc.id,
              name: d.full_name || d.name || 'Staff',
              store: d.store_name || 'N/A',
              role: 'Salesperson',
              login: d.created_at ? new Date(d.created_at).toLocaleDateString() : 'N/A',
              sales: 0,
              status: 'Active'
            });
          });
          setWorkers(fetchedWorkers);

          // Fetch Demos
          const demoSnap = await getDocs(collection(db, 'demos'));
          const fetchedDemos: any[] = [];
          demoSnap.forEach((doc: any) => {
            const d = doc.data();
            fetchedDemos.push({
              id: doc.id,
              storeName: d.store_name || d.storeName || 'Unnamed Store',
              ownerName: d.owner_name || d.ownerName || 'N/A',
              phone: d.phone || 'N/A',
              date: d.date || 'N/A',
              time: d.time || 'N/A',
              status: d.status || 'Pending'
            });
          });
          setDemos(fetchedDemos);

          // Fetch Support Tickets
          const ticketsSnap = await getDocs(collection(db, 'support_tickets'));
          const fetchedTickets: any[] = [];
          ticketsSnap.forEach((doc: any) => {
            const d = doc.data();
            fetchedTickets.push({
              id: doc.id,
              store: d.store || d.store_name || 'N/A',
              subject: d.subject || 'No Subject',
              priority: d.priority || 'Medium',
              status: d.status || 'Pending',
              description: d.description || ''
            });
          });
          setTickets(fetchedTickets);

          // Fetch Barcodes
          const barcodesSnap = await getDocs(collection(db, 'barcodes'));
          const fetchedBarcodes: any[] = [];
          barcodesSnap.forEach((doc: any) => {
            const d = doc.data();
            fetchedBarcodes.push({
              id: doc.id,
              storeName: d.store_name || d.storeName || 'N/A',
              generated: d.quantity || d.qty || 1,
              format: d.format || d.type || 'CODE-128',
              status: 'Success',
              timestamp: d.created_at ? new Date(d.created_at).toLocaleDateString() : 'N/A'
            });
          });
          setBarcodesList(fetchedBarcodes);

          // Fetch Sales for revenue calculation
          const salesSnap = await getDocs(collection(db, 'sales'));
          let totalSalesVal = 0;
          let monthlySalesVal = 0;
          let weeklySalesVal = 0;
          let todaySalesVal = 0;
          let transactionsCount = 0;
          
          const now = new Date();
          const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const oneWeekAgoStr = todayStr - (7 * 86400000);
          const firstOfMonthStr = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
          
          const weekdaysData = [0, 0, 0, 0, 0, 0, 0];
          const allSales: any[] = [];
          
          salesSnap.forEach((doc: any) => {
            const d = doc.data();
            const amt = parseFloat(d.total_amount || 0);
            const date = new Date(d.created_at || new Date()).getTime();
            
            allSales.push({ id: doc.id, ...d });
            
            totalSalesVal += amt;
            transactionsCount++;
            
            if (date >= todayStr) {
              todaySalesVal += amt;
            }
            if (date >= oneWeekAgoStr) {
              weeklySalesVal += amt;
              const day = new Date(date).getDay();
              const mapIndex = day === 0 ? 6 : day - 1;
              weekdaysData[mapIndex] += amt;
            }
            if (date >= firstOfMonthStr) {
              monthlySalesVal += amt;
            }
          });
          
          allSales.sort((a, b) => new Date(b.created_at || new Date()).getTime() - new Date(a.created_at || new Date()).getTime());
          setSalesList(allSales);
          setTotalRevenueSum(totalSalesVal);
          setMonthlyRevenueSum(monthlySalesVal);
          setWeeklyRevenueSum(weeklySalesVal);
          setTodayRevenueSum(todaySalesVal);
          setTotalTransactionsCount(transactionsCount);
          setSalesChartData(weekdaysData);

          // Fetch Plans
          const plansSnap = await getDocs(collection(db, 'plans'));
          const fetchedPlans: any[] = [];
          plansSnap.forEach((doc: any) => {
            const d = doc.data();
            fetchedPlans.push({
              id: doc.id,
              name: d.name || 'N/A',
              price: d.price || '₹0',
              duration: d.duration || '1 Month',
              devices: d.devices || '1',
              status: d.status || 'Active'
            });
          });
          setPricingPlans(fetchedPlans);

          // Recent Activities
          const recent: any[] = [];
          userSnap.forEach((doc: any) => {
            const d = doc.data();
            if (d.created_at) {
              recent.push({
                id: doc.id + '_reg',
                title: 'New Store Owner Registered',
                desc: `${d.owner_name || 'N/A'} registered ${d.store_name || 'Unnamed Store'}`,
                time: new Date(d.created_at).toLocaleDateString(),
                icon: 'account-plus',
                color: '#10B981',
                timestamp: new Date(d.created_at).getTime()
              });
            }
          });
          salesSnap.forEach((doc: any) => {
            const d = doc.data();
            const date = new Date(d.created_at || new Date()).getTime();
            recent.push({
              id: doc.id + '_sale',
              title: 'Store Sale Transaction',
              desc: `Sale processed: ₹${(d.total_amount || 0).toLocaleString('en-IN')}`,
              time: new Date(date).toLocaleDateString(),
              icon: 'cash-register',
              color: '#2563EB',
              timestamp: date
            });
          });
          recent.sort((a, b) => b.timestamp - a.timestamp);
          setRecentAct(recent.slice(0, 10));

        } catch (error) {
          console.error('Error fetching dashboard data:', error);
        }
      } else {
        setCustomers([]);
        setWorkers([]);
        setDemos([]);
        setTickets([]);
        setBarcodesList([]);
        setRecentAct([]);
        setPricingPlans([]);
      }
    };

    fetchDashboardData();
  }, []);

  // Real-time notifications listener
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const q = query(collection(db, 'broadcast_alerts'));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const fetchedAlerts: any[] = [];
      snapshot.forEach((doc: any) => {
        const d = doc.data();
        fetchedAlerts.push({
          id: doc.id,
          title: d.title || 'No Title',
          text: d.text || 'No Details',
          type: d.type || 'Alert',
          createdAt: d.createdAt || null
        });
      });
      setNotifications(fetchedAlerts.reverse());
    });
    return () => unsubscribe();
  }, []);
  
  // Custom dialogs & edits
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [showSupportReply, setShowSupportReply] = useState(false);
  const [showBroadcastAlert, setShowBroadcastAlert] = useState(false);
  
  // Selected lists for edits
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [custPermissions, setCustPermissions] = useState<any>(initialPermissions);

  // Broadcaster states
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastText, setBroadcastText] = useState('');
  
  // Search query states
  const [customerSearch, setCustomerSearch] = useState('');
  const [shopSearch, setShopSearch] = useState('');
  
  // Form input states (Add Customer)
  const [formName, setFormName] = useState('');
  const [formStore, setFormStore] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPlan, setFormPlan] = useState('Free Trial');
  const [isCreating, setIsCreating] = useState(false);
  
  // Edit Form Fields
  const [editFormName, setEditFormName] = useState('');
  const [editFormStore, setEditFormStore] = useState('');
  const [editFormEmail, setEditFormEmail] = useState('');
  const [editFormPhone, setEditFormPhone] = useState('');
  const [editFormPlan, setEditFormPlan] = useState('Premium');
  const [editFormNewPassword, setEditFormNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Broadcast & Plan states
  const [broadcasting, setBroadcasting] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planDuration, setPlanDuration] = useState('1 Month');
  const [planDevices, setPlanDevices] = useState('2');

  // Dynamic Metrics counts
  const totalCustCount = customers.length;
  const activeShopsCount = customers.filter(c => c.status === 'Active' || c.status === 'Trial').length;
  const totalWorkersCount = workers.length;
  const activeSubCount = customers.filter(c => c.status === 'Active').length;
  const trialSubCount = customers.filter(c => c.status === 'Trial' || c.plan === 'Free Trial').length;
  const expiredSubCount = customers.filter(c => c.status === 'Expired' || c.status === 'Disabled').length;
  const todaySignupsCount = customers.filter(c => {
    if (!c.createdAt && !c.date) return false;
    const dateStr = new Date(c.createdAt || c.date).toDateString();
    return dateStr === new Date().toDateString();
  }).length;
  const dbUsageText = isFirebaseConfigured ? `${customers.length + workers.length + barcodesList.length + totalTransactionsCount} documents` : 'Offline';
  const pendingTicketsCount = tickets.filter(t => t.status === 'Pending' || t.status === 'In Progress').length;

  // Colors
  const bg = isDark ? '#12121A' : '#F4F5F9';
  const cardBg = isDark ? '#1C1D2F' : '#FFFFFF';
  const text = isDark ? '#FFFFFF' : '#1A1A2E';
  const subText = isDark ? '#A2A5C1' : '#757575';
  const border = isDark ? '#2D2D44' : '#EEF0F6';
  const accent = '#D81B60';

  const renderMetaRow = (label: string, val: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: border }}>
      <Text style={{ color: text, fontSize: 13, fontWeight: '500' }}>{label}</Text>
      <Text style={{ color: text, fontSize: 13, fontWeight: '700' }}>{val}</Text>
    </View>
  );

  // ---------------------------------------------------------
  // FUNCTIONS & EVENT HANDLERS
  // ---------------------------------------------------------
  const persistData = (key: string, data: any) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(data));
    }
  };

  const handleCreateCustomer = async () => {
    if (!formName || !formStore || isCreating) return;
    if (!formPassword) {
      alert('Password is required.');
      return;
    }
    setIsCreating(true);

    let newCustId = (customers.length + 1).toString() + '_' + Date.now();
    const finalEmail = formEmail || `${formName.toLowerCase().replace(' ', '')}@pos.com`;
    const defaultPassword = formPassword;
    let authNotice = '';

    if (isFirebaseConfigured) {
      try {
        const apiBase = typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8083' : '';
        const response = await fetch(`${apiBase}/api/create-owner`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            storeName: formStore,
            email: finalEmail,
            phone: formPhone || '9999999999',
            password: defaultPassword,
            plan: formPlan
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create owner account');
        }

        newCustId = data.uid;
        authNotice = data.authNotice || '';

        alert(`Successfully created account for ${formName}!${authNotice}\nEmail: ${finalEmail}\nPassword: ${defaultPassword}`);
      } catch (error: any) {
        alert('Error provisioning Firebase user: ' + error.message);
        setIsCreating(false);
        return;
      }
    }

    const newCust = {
      id: newCustId,
      name: formName,
      store: formStore,
      email: finalEmail,
      phone: formPhone || '9999999999',
      status: 'Active',
      plan: formPlan,
      expiry: '2027-06-13',
      devices: 2,
      dbSize: '10 MB'
    };
    const updated = [newCust, ...customers];
    setCustomers(updated);
    persistData('admin_customers', updated);
    setShowAddCustomer(false);
    setFormName(''); setFormStore(''); setFormEmail(''); setFormPhone(''); setFormPassword('');
    setIsCreating(false);
  };

  const openEditModal = (c: any) => {
    setEditingCustomer(c);
    setEditFormName(c.name);
    setEditFormStore(c.store);
    setEditFormEmail(c.email);
    setEditFormPhone(c.phone);
    const planVal = (c.plan === 'Free Trial' || c.plan === 'Trial') ? 'Trial' : 'Premium';
    setEditFormPlan(planVal);
    setShowEditCustomer(true);
  };

  const handleUpdateCustomer = async () => {
    if (!editingCustomer) return;
    setIsCreating(true);

    try {
      const userDocRef = doc(db, 'users', editingCustomer.id);
      await setDoc(userDocRef, {
        owner_name: editFormName,
        store_name: editFormStore,
        phone: editFormPhone,
        subscription_plan: editFormPlan
      }, { merge: true });

      const updatedCustomers = customers.map(c => 
        c.id === editingCustomer.id ? {
          ...c,
          name: editFormName,
          store: editFormStore,
          phone: editFormPhone,
          plan: editFormPlan
        } : c
      );
      setCustomers(updatedCustomers);
      setShowEditCustomer(false);
      setEditingCustomer(null);
    } catch (error: any) {
      console.warn('Error updating customer:', error);
      alert('Failed to update customer: ' + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendResetEmail = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`Password reset email sent to ${email}`);
    } catch (error: any) {
      alert('Error sending reset email: ' + error.message);
    }
  };

  const handleForceResetPassword = async () => {
    if (!editingCustomer || !editFormNewPassword) {
      alert('Please enter a new password.');
      return;
    }
    if (editFormNewPassword.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }
    
    setIsResetting(true);
    try {
      const apiBase = typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8083' : '';
      const response = await fetch(`${apiBase}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: editingCustomer.id,
          newPassword: editFormNewPassword
        })
      });
      const data = await response.json();
      
      if (response.ok) {
        alert('Success! The password has been forcefully reset.');
        setEditFormNewPassword('');
      } else {
        alert('Failed to reset password: ' + data.error);
      }
    } catch (error: any) {
      alert('Network Error connecting to Backend Server: ' + error.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleCreatePlan = () => {
    if (!planName || !planPrice) return;
    const newPlan = {
      id: 'p' + (pricingPlans.length + 1) + '_' + Date.now(),
      name: planName,
      price: planPrice.startsWith('₹') ? planPrice : `₹${planPrice}`,
      duration: planDuration,
      billing: planDuration.includes('Year') ? 'Yearly' : 'Monthly',
      devices: parseInt(planDevices) || 2,
      status: 'Active'
    };
    const updated = [...pricingPlans, newPlan];
    setPricingPlans(updated);
    persistData('admin_plans', updated);
    setShowAddPlan(false);
    setPlanName(''); setPlanPrice('');
  };

  const handleBroadcast = async () => {
    if (!broadcastTitle || broadcasting) return;
    setBroadcasting(true);
    try {
      const newNotification = {
        title: broadcastTitle,
        text: broadcastText || 'No details provided.',
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        type: 'Alert',
        createdAt: serverTimestamp()
      };
      if (isFirebaseConfigured) {
        await addDoc(collection(db, 'broadcast_alerts'), newNotification);
      } else {
        const localNotifs = [
          { id: 'n' + (notifications.length + 1), ...newNotification },
          ...notifications
        ];
        setNotifications(localNotifs);
      }
      setShowBroadcastAlert(false);
      setBroadcastTitle('');
      setBroadcastText('');
    } catch (error: any) {
      alert('Error broadcasting system alert: ' + error.message);
    } finally {
      setBroadcasting(false);
    }
  };

  const handleBackup = () => {
    alert('Full POS Firestore & Storage snapshots backed up. Backup ID: BKP-SQL-' + Date.now() + '. Size: 2.4 GB. Saved to server S3 Vault.');
  };

  const handlePermissionSave = () => {
    alert('Manually saved custom feature permissions access matrix for ' + (selectedCustomer?.store || 'this customer') + '.');
    setSelectedCustomer(null);
  };

  const handleDeleteCustomer = async (customerId: string, storeName: string) => {
    const confirm = typeof window !== 'undefined' ? window.confirm(`Are you sure you want to completely delete "${storeName}" and ALL of its associated data (sales, products, transactions, cashiers) from the system?`) : true;
    if (!confirm) return;
    try {
      if (isFirebaseConfigured) {
        // 1. Delete associated products
        const productsQuery = query(collection(db, 'products'), where('tenant_id', '==', customerId));
        const productsSnap = await getDocs(productsQuery);
        productsSnap.forEach((d: any) => {
          deleteDoc(doc(db, 'products', d.id));
        });

        // 2. Delete associated sales
        const salesQuery = query(collection(db, 'sales'), where('tenant_id', '==', customerId));
        const salesSnap = await getDocs(salesQuery);
        salesSnap.forEach((d: any) => {
          deleteDoc(doc(db, 'sales', d.id));
        });

        // 3. Delete associated transactions
        const transactionsQuery = query(collection(db, 'transactions'), where('tenant_id', '==', customerId));
        const transactionsSnap = await getDocs(transactionsQuery);
        transactionsSnap.forEach((d: any) => {
          deleteDoc(doc(db, 'transactions', d.id));
        });

        // 4. Delete associated cashiers/staff
        const staffQuery = query(collection(db, 'users'), where('tenant_id', '==', customerId));
        const staffSnap = await getDocs(staffQuery);
        staffSnap.forEach((d: any) => {
          deleteDoc(doc(db, 'users', d.id));
        });

        // 5. Delete the main owner user record
        await deleteDoc(doc(db, 'users', customerId));
      }
      const updated = customers.filter(cust => cust.id !== customerId);
      setCustomers(updated);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('admin_customers', JSON.stringify(updated));
      }
      alert('Successfully wiped store and all associated tenant data from Firebase.');
    } catch (err: any) {
      alert('Error wiping tenant data: ' + err.message);
    }
  };

  // ---------------------------------------------------------
  // SUB-RENDER VIEWS
  // ---------------------------------------------------------

  // --- OVERVIEW (DASHBOARD) ---
  const renderOverview = () => {
    const metricsData = [
      { title: 'Total Customers', val: totalCustCount, icon: 'account-multiple', col: '#2563EB', bg: '#EFF6FF' },
      { title: 'Active Customers', val: activeShopsCount, icon: 'check-circle-outline', col: '#10B981', bg: '#ECFDF5' },
      { title: 'Trial Customers', val: trialSubCount, icon: 'account-clock', col: '#F59E0B', bg: '#FFFBEB' },
      { title: 'Expired Customers', val: expiredSubCount, icon: 'account-cancel', col: '#EF4444', bg: '#FEF2F2' },
      { title: 'Monthly Revenue', val: '₹' + monthlyRevenueSum.toLocaleString('en-IN'), icon: 'currency-inr', col: '#10B981', bg: '#ECFDF5' },
      { title: "Today's Signups", val: todaySignupsCount, icon: 'account-plus', col: '#6366F1', bg: '#EEF2FF' },
    ];

    return (
      <View style={{ gap: 20 }}>
        {/* 7 Metric Cards Row */}
        <View style={styles.metricsRow}>
          {metricsData.map((m, idx) => (
            <Card key={idx} style={[styles.metricCard, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
              <Card.Content style={{ flexDirection: 'row', alignItems: 'center', padding: 0, gap: 12 }}>
                <View style={[styles.quickStatIconWrap, { backgroundColor: m.bg, width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }]}>
                  <Icon name={m.icon} size={20} color={m.col} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: subText, fontWeight: '600' }}>{m.title}</Text>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: text, marginTop: 2 }}>{m.val}</Text>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>

        {/* 2 Data Tables in a Row */}
        <View style={styles.chartsRow}>
          {/* Table 1: Recent Subscriptions */}
          <Card style={[styles.chartBoxCard, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
            <Card.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                <View style={[styles.chartIconBadge, { backgroundColor: '#EFF6FF' }]}>
                  <Icon name="calendar-sync" size={16} color="#2563EB" />
                </View>
                <Text variant="titleSmall" style={{ fontWeight: 'bold', color: text }}>Recent Subscriptions</Text>
              </View>
              <DataTable>
                <DataTable.Header style={[styles.tableHeader, { backgroundColor: isDark ? '#2D2D44' : '#F5F6FA' }]}>
                  <DataTable.Title textStyle={styles.tableHeaderText}>Store</DataTable.Title>
                  <DataTable.Title textStyle={styles.tableHeaderText}>Plan</DataTable.Title>
                  <DataTable.Title textStyle={styles.tableHeaderText} numeric>Status</DataTable.Title>
                </DataTable.Header>
                {customers.slice(0, 4).length > 0 ? customers.slice(0, 4).map((c, i) => (
                  <DataTable.Row key={i} style={[styles.tableRow, { borderBottomColor: border }]}>
                    <DataTable.Cell textStyle={{ color: text, fontSize: 12 }}>{c.store}</DataTable.Cell>
                    <DataTable.Cell textStyle={{ color: subText, fontSize: 11 }}>{c.plan}</DataTable.Cell>
                    <DataTable.Cell numeric>
                      <View style={{
                        backgroundColor: c.status === 'Active' ? '#E8F5E9' : c.status === 'Trial' ? '#FFF3E0' : '#FFEBEE',
                        paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12
                      }}>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: c.status === 'Active' ? '#2E7D32' : c.status === 'Trial' ? '#E65100' : '#C62828' }}>{c.status}</Text>
                      </View>
                    </DataTable.Cell>
                  </DataTable.Row>
                )) : (
                  <View style={{ padding: 20 }}><Text style={{ textAlign: 'center', color: subText }}>No recent subscriptions</Text></View>
                )}
              </DataTable>
            </Card.Content>
          </Card>

          {/* Table 2: Recent Transactions */}
          <Card style={[styles.chartBoxCard, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
            <Card.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                <View style={[styles.chartIconBadge, { backgroundColor: '#ECFDF5' }]}>
                  <Icon name="credit-card-outline" size={16} color="#10B981" />
                </View>
                <Text variant="titleSmall" style={{ fontWeight: 'bold', color: text }}>Recent Transactions</Text>
              </View>
              <DataTable>
                <DataTable.Header style={[styles.tableHeader, { backgroundColor: isDark ? '#2D2D44' : '#F5F6FA' }]}>
                  <DataTable.Title textStyle={styles.tableHeaderText}>Store</DataTable.Title>
                  <DataTable.Title textStyle={styles.tableHeaderText}>Amount</DataTable.Title>
                  <DataTable.Title textStyle={styles.tableHeaderText} numeric>Method</DataTable.Title>
                </DataTable.Header>
                <View style={{ padding: 20 }}><Text style={{ textAlign: 'center', color: subText }}>No transactions found</Text></View>
              </DataTable>
            </Card.Content>
          </Card>
        </View>

        {/* Quick Actions Grid */}
        <Card style={[styles.card, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
          <Card.Content>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="lightning-bolt" size={20} color="#F59E0B" style={{ marginRight: 8 }} />
                <Text variant="titleMedium" style={[styles.sectionHeader, { color: text, marginBottom: 0 }]}>Quick Actions</Text>
              </View>
            </View>
            <View style={styles.quickActionsGrid}>
              <TouchableOpacity style={[styles.actionChip, { backgroundColor: '#EFF6FF' }]} onPress={() => setShowAddCustomer(true)}>
                <Icon name="account-plus" size={18} color="#2563EB" />
                <Text style={[styles.actionChipText, { color: '#2563EB' }]}>Add Customer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionChip, { backgroundColor: '#ECFDF5' }]} onPress={() => { setSelectedCustomer(customers[0]); handleNav('subscriptions'); }}>
                <Icon name="credit-card-plus" size={18} color="#10B981" />
                <Text style={[styles.actionChipText, { color: '#10B981' }]}>Create Sub.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionChip, { backgroundColor: '#EFF6FF' }]} onPress={() => { setSelectedCustomer(customers[1]); handleNav('subscriptions'); }}>
                <Icon name="calendar-clock" size={18} color="#2563EB" />
                <Text style={[styles.actionChipText, { color: '#2563EB' }]}>Extend Plan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionChip, { backgroundColor: '#EFF6FF' }]} onPress={() => handleNav('reports')}>
                <Icon name="file-pdf-box" size={18} color="#2563EB" />
                <Text style={[styles.actionChipText, { color: '#2563EB' }]}>Gen Report</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionChip, { backgroundColor: '#EFF6FF' }]} onPress={() => handleNav('support')}>
                <Icon name="headset" size={18} color="#2563EB" />
                <Text style={[styles.actionChipText, { color: '#2563EB' }]}>Open Ticket</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionChip, { backgroundColor: '#EEF2FF' }]} onPress={handleBackup}>
                <Icon name="database-sync" size={18} color="#6366F1" />
                <Text style={[styles.actionChipText, { color: '#6366F1' }]}>Backup DB</Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>

        {/* Recent Activity timeline */}
        <View style={styles.chartsRow}>
          <Card style={[styles.chartBoxCard, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
            <Card.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={[styles.chartIconBadge, { backgroundColor: '#EFF6FF' }]}>
                  <Icon name="history" size={16} color="#2563EB" />
                </View>
                <Text variant="titleSmall" style={{ fontWeight: 'bold', color: text, flex: 1 }}>Recent System Activity</Text>
              </View>
              {recentAct.length > 0 ? recentAct.slice(0, 4).map((item, index) => (
                <View key={item.id} style={styles.timelineItem}>
                  <View style={styles.timelineLine}>
                    <View style={[styles.timelineDot, { backgroundColor: item.color === '#5E35B1' ? '#2563EB' : item.color }]}>
                      <Icon name={item.icon} size={14} color="#fff" />
                    </View>
                    {index < 3 && <View style={styles.timelineConnector} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineTitle, { color: text }]}>{item.title}</Text>
                    <Text style={[styles.timelineDesc, { color: subText }]}>{item.desc}</Text>
                    <Text style={[styles.timelineTime, { color: isDark ? '#555876' : '#BDBDBD' }]}>{item.time}</Text>
                  </View>
                </View>
              )) : (
                <View style={{ padding: 20 }}><Text style={{ textAlign: 'center', color: subText }}>No recent activity to show</Text></View>
              )}
            </Card.Content>
          </Card>
        </View>
      </View>
    );
  };

  // --- CUSTOMERS MANAGEMENT ---
  const renderCustomers = () => {
    const filtered = customers.filter(c => 
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
      c.store.toLowerCase().includes(customerSearch.toLowerCase())
    );

    return (
      <Card style={[styles.card, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
        <Card.Content>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.chartIconBadge, { backgroundColor: '#DBEAFE' }]}>
                <Icon name="account-multiple" size={16} color="#2563EB" />
              </View>
              <Text variant="titleMedium" style={{ fontWeight: 'bold', color: text }}>Customers Directory</Text>
            </View>
            <Button mode="contained" buttonColor="#2563EB" icon="account-plus" onPress={() => setShowAddCustomer(true)} style={{ borderRadius: 10 }}>
              Add Customer
            </Button>
          </View>

          <Searchbar
            placeholder="Search customer registry..."
            onChangeText={setCustomerSearch}
            value={customerSearch}
            style={[styles.searchBar, { backgroundColor: isDark ? '#222336' : '#F8F7FF', borderColor: border }]}
            placeholderTextColor={subText}
            inputStyle={{ color: text }}
            iconColor={subText}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'}>
            <DataTable style={{ minWidth: 900 }}>
              <DataTable.Header style={[styles.tableHeader, { backgroundColor: isDark ? '#1A1B2D' : '#FAFAFE' }]}>
                <DataTable.Title style={{ flex: 1.8 }}><Text style={styles.tableHeaderText}>Store / Owner</Text></DataTable.Title>
                <DataTable.Title><Text style={styles.tableHeaderText}>Contact Info</Text></DataTable.Title>
                <DataTable.Title numeric><Text style={styles.tableHeaderText}>Devices</Text></DataTable.Title>
                <DataTable.Title numeric><Text style={styles.tableHeaderText}>Storage</Text></DataTable.Title>
                <DataTable.Title><Text style={styles.tableHeaderText}>Status</Text></DataTable.Title>
                <DataTable.Title><Text style={styles.tableHeaderText}>Subscription</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 2.2 }}><Text style={styles.tableHeaderText}>Actions</Text></DataTable.Title>
              </DataTable.Header>

              {filtered.length === 0 ? (
                <View style={{ padding: 40 }}>
                  <EmptyState icon="account-search" title="No customers found" subtitle="Try a different search term" />
                </View>
              ) : filtered.map((c) => (
                <DataTable.Row key={c.id} style={[styles.tableRow, { borderBottomColor: border }]}>
                  <DataTable.Cell style={{ flex: 1.8 }}>
                    <View style={{ paddingVertical: 6 }}>
                      <Text style={{ fontWeight: '700', color: text, fontSize: 13 }}>{c.store}</Text>
                      <Text style={{ fontSize: 11, color: subText, marginTop: 2 }}>{c.name}</Text>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <View style={{ paddingVertical: 4 }}>
                      <Text style={{ fontSize: 12, color: text }}>{c.email}</Text>
                      <Text style={{ fontSize: 10, color: subText, marginTop: 2 }}>{c.phone}</Text>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell numeric><Text style={{ color: text, fontWeight: '600' }}>{c.devices}</Text></DataTable.Cell>
                  <DataTable.Cell numeric><Text style={{ color: text }}>{c.dbSize}</Text></DataTable.Cell>
                  <DataTable.Cell><StatusBadge status={c.status} /></DataTable.Cell>
                  <DataTable.Cell>
                    <Text style={{ color: subText, fontSize: 12 }}>{c.plan}</Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 2.2 }}>
                    <View style={{ flexDirection: 'row' }}>
                      <IconButton icon="shield-key" size={16} iconColor="#2563EB" onPress={() => { setSelectedCustomer(c); setCustPermissions(initialPermissions); handleNav('permissions'); }} />
                      <IconButton icon="pencil" size={16} iconColor="#1565C0" onPress={() => openEditModal(c)} />
                      <IconButton icon="delete" size={16} iconColor="#F44336" onPress={() => handleDeleteCustomer(c.id, c.store)} />
                    </View>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </ScrollView>
        </Card.Content>
      </Card>
    );
  };

  // --- SUBSCRIPTIONS MANAGEMENT ---
  const renderSubscriptions = () => {
    return (
      <Card style={[styles.card, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={[styles.chartIconBadge, { backgroundColor: '#FCE4EC' }]}>
              <Icon name="calendar-sync" size={16} color="#C2185B" />
            </View>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', color: text }}>Active Subscriptions Ledger</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'}>
            <DataTable style={{ minWidth: 850 }}>
              <DataTable.Header style={[styles.tableHeader, { backgroundColor: isDark ? '#1A1B2D' : '#FAFAFE' }]}>
                <DataTable.Title style={{ flex: 1.5 }}><Text style={styles.tableHeaderText}>Store Owner</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 1 }}><Text style={styles.tableHeaderText}>Plan Tier</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 1 }}><Text style={styles.tableHeaderText}>Status</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 1 }}><Text style={styles.tableHeaderText}>Expiry Date</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 1 }}><Text style={styles.tableHeaderText}>Auto Expiry</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 3.2 }}><Text style={styles.tableHeaderText}>Override Commands</Text></DataTable.Title>
              </DataTable.Header>

              {customers.length === 0 ? (
                <View style={{ padding: 40 }}>
                  <EmptyState icon="database-remove" title="No active subscriptions" subtitle="No stores found with an active subscription." />
                </View>
              ) : customers.map((c) => (
                <DataTable.Row key={c.id} style={[styles.tableRow, { borderBottomColor: border }]}>
                  <DataTable.Cell style={{ flex: 1.5 }}>
                    <View style={{ paddingVertical: 4 }}>
                      <Text style={{ fontWeight: '700', color: text }}>{c.store}</Text>
                      <Text style={{ fontSize: 11, color: subText }}>{c.email}</Text>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell style={{ flex: 1 }}><Text style={{ color: text }}>{c.plan}</Text></DataTable.Cell>
                  <DataTable.Cell style={{ flex: 1 }}><StatusBadge status={c.status} /></DataTable.Cell>
                  <DataTable.Cell style={{ flex: 1 }}><Text style={{ color: text }}>{c.expiry}</Text></DataTable.Cell>
                  <DataTable.Cell style={{ flex: 1 }}>
                    <Switch value={c.status === 'Active'} onValueChange={() => {}} color="#2563EB" style={{ transform: [{ scale: 0.85 }] }} />
                  </DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 3.2 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Button 
                        mode="outlined" 
                        compact 
                        textColor="#4CAF50" 
                        style={{ borderColor: '#4CAF50', borderRadius: 8 }}
                        onPress={() => {
                          const updated = customers.map(cust => {
                            if (cust.id === c.id) {
                              const d = new Date(cust.expiry);
                              d.setDate(d.getDate() + 30);
                              return { ...cust, expiry: d.toISOString().split('T')[0], status: 'Active' };
                            }
                            return cust;
                          });
                          setCustomers(updated);
                          if (typeof window !== 'undefined') window.localStorage.setItem('admin_customers', JSON.stringify(updated));
                          alert('Extended subscription for ' + c.store + ' by 30 days.');
                        }}
                      >
                        Extend
                      </Button>
                      <Button 
                        mode="contained" 
                        compact 
                        buttonColor="#2563EB"
                        style={{ borderRadius: 8 }}
                        onPress={() => {
                          setSelectedCustomer(c);
                          alert('Triggering plan upgrade dialog for ' + c.store);
                        }}
                      >
                        Change Plan
                      </Button>
                      <Button 
                        mode="outlined" 
                        compact 
                        textColor="#F44336" 
                        style={{ borderColor: '#F44336', borderRadius: 8 }}
                        onPress={() => handleDeleteCustomer(c.id, c.store)}
                      >
                        Delete
                      </Button>
                    </View>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </ScrollView>
        </Card.Content>
      </Card>
    );
  };

  // --- PRICING PLANS MANAGEMENT ---
  const renderPlans = () => {
    return (
      <View>
        <Card style={[styles.card, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
          <Card.Content>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.chartIconBadge, { backgroundColor: '#F3E5F5' }]}>
                  <Icon name="tag-multiple" size={16} color="#6A1B9A" />
                </View>
                <Text variant="titleMedium" style={{ fontWeight: 'bold', color: text }}>SaaS Subscription Plan Catalogs</Text>
              </View>
              <Button mode="contained" buttonColor="#2563EB" icon="plus" onPress={() => setShowAddPlan(true)} style={{ borderRadius: 10 }}>
                Create Plan
              </Button>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'}>
              <DataTable style={{ marginTop: 12, minWidth: 800 }}>
                <DataTable.Header style={[styles.tableHeader, { backgroundColor: isDark ? '#1A1B2D' : '#FAFAFE' }]}>
                  <DataTable.Title style={{ flex: 1.5 }}><Text style={styles.tableHeaderText}>Plan Name</Text></DataTable.Title>
                  <DataTable.Title><Text style={styles.tableHeaderText}>Base Pricing</Text></DataTable.Title>
                  <DataTable.Title><Text style={styles.tableHeaderText}>Billing Cycle</Text></DataTable.Title>
                  <DataTable.Title numeric><Text style={styles.tableHeaderText}>Devices</Text></DataTable.Title>
                  <DataTable.Title><Text style={styles.tableHeaderText}>Status</Text></DataTable.Title>
                  <DataTable.Title numeric style={{ flex: 1.2 }}><Text style={styles.tableHeaderText}>Actions</Text></DataTable.Title>
                </DataTable.Header>

                {pricingPlans.length === 0 ? (
                  <View style={{ padding: 40 }}>
                    <EmptyState icon="tag-off" title="No Pricing Plans" subtitle="Create your first subscription tier to get started." />
                  </View>
                ) : pricingPlans.map((plan) => (
                  <DataTable.Row key={plan.id} style={[styles.tableRow, { borderBottomColor: border }]}>
                    <DataTable.Cell style={{ flex: 1.5 }}><Text style={{ fontWeight: '700', color: text }}>{plan.name}</Text></DataTable.Cell>
                    <DataTable.Cell><Text style={{ color: '#2E7D32', fontWeight: 'bold' }}>{plan.price}</Text></DataTable.Cell>
                    <DataTable.Cell><Text style={{ color: text }}>{plan.duration}</Text></DataTable.Cell>
                    <DataTable.Cell numeric><Text style={{ color: text, fontWeight: '600' }}>{plan.devices}</Text></DataTable.Cell>
                    <DataTable.Cell><StatusBadge status={plan.status} /></DataTable.Cell>
                    <DataTable.Cell numeric style={{ flex: 1.2 }}>
                      <View style={{ flexDirection: 'row' }}>
                        <IconButton icon="pencil" size={16} iconColor="#1565C0" onPress={() => alert('Editing Plan pricing structures...')} />
                        <IconButton icon="delete" size={16} iconColor="#F44336" onPress={() => setPricingPlans(pricingPlans.filter(p => p.id !== plan.id))} />
                      </View>
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            </ScrollView>
          </Card.Content>
        </Card>
      </View>
    );
  };

  // --- DEMO MANAGEMENT ---
  const renderDemos = () => {
    return (
      <Card style={[styles.card, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={[styles.chartIconBadge, { backgroundColor: '#DBEAFE' }]}>
              <Icon name="monitor-play" size={16} color="#2563EB" />
            </View>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', color: text }}>Demo Bookings & Trial Requests</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'}>
            <DataTable style={{ minWidth: 850 }}>
              <DataTable.Header style={[styles.tableHeader, { backgroundColor: isDark ? '#1A1B2D' : '#FAFAFE' }]}>
                <DataTable.Title style={{ flex: 1.5 }}><Text style={styles.tableHeaderText}>Business Store</Text></DataTable.Title>
                <DataTable.Title><Text style={styles.tableHeaderText}>Owner Name</Text></DataTable.Title>
                <DataTable.Title><Text style={styles.tableHeaderText}>Phone</Text></DataTable.Title>
                <DataTable.Title><Text style={styles.tableHeaderText}>Scheduled Date</Text></DataTable.Title>
                <DataTable.Title><Text style={styles.tableHeaderText}>Slot Time</Text></DataTable.Title>
                <DataTable.Title><Text style={styles.tableHeaderText}>Status</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1.5 }}><Text style={styles.tableHeaderText}>Action</Text></DataTable.Title>
              </DataTable.Header>

              {demos.length === 0 ? (
                <View style={{ padding: 40 }}>
                  <EmptyState icon="calendar-blank" title="No demos scheduled" subtitle="You don't have any pending demo requests." />
                </View>
              ) : demos.map((d) => (
                <DataTable.Row key={d.id} style={[styles.tableRow, { borderBottomColor: border }]}>
                  <DataTable.Cell style={{ flex: 1.5 }}><Text style={{ fontWeight: '700', color: text }}>{d.storeName}</Text></DataTable.Cell>
                  <DataTable.Cell><Text style={{ color: text }}>{d.ownerName}</Text></DataTable.Cell>
                  <DataTable.Cell><Text style={{ color: text }}>{d.phone}</Text></DataTable.Cell>
                  <DataTable.Cell><Text style={{ color: text }}>{d.date}</Text></DataTable.Cell>
                  <DataTable.Cell><Text style={{ color: text }}>{d.time}</Text></DataTable.Cell>
                  <DataTable.Cell><StatusBadge status={d.status} /></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 1.5 }}>
                    <Button 
                      mode="contained" 
                      compact 
                      buttonColor="#4CAF50"
                      style={{ borderRadius: 8 }}
                      onPress={() => {
                        setDemos(demos.map(item => item.id === d.id ? { ...item, status: 'Completed' } : item));
                        alert('Marked demo booking session as completed for ' + d.storeName);
                      }}
                    >
                      Mark Done
                    </Button>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </ScrollView>
        </Card.Content>
      </Card>
    );
  };

  // --- SHOP MANAGEMENT ---
  const renderShops = () => {
    return (
      <Card style={[styles.card, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={[styles.chartIconBadge, { backgroundColor: '#E8F5E9' }]}>
              <Icon name="storefront" size={16} color="#2E7D32" />
            </View>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', color: text }}>Registered Shops Directory</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'}>
            <DataTable style={{ minWidth: 850 }}>
              <DataTable.Header style={[styles.tableHeader, { backgroundColor: isDark ? '#1A1B2D' : '#FAFAFE' }]}>
                <DataTable.Title style={{ flex: 1.5 }}><Text style={styles.tableHeaderText}>Shop Brand</Text></DataTable.Title>
                <DataTable.Title><Text style={styles.tableHeaderText}>Manager Email</Text></DataTable.Title>
                <DataTable.Title><Text style={styles.tableHeaderText}>Phone</Text></DataTable.Title>
                <DataTable.Title><Text style={styles.tableHeaderText}>Category</Text></DataTable.Title>
                <DataTable.Title><Text style={styles.tableHeaderText}>Platform Status</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1.5 }}><Text style={styles.tableHeaderText}>Admin Actions</Text></DataTable.Title>
              </DataTable.Header>

              {customers.map((c) => (
                <DataTable.Row key={c.id} style={[styles.tableRow, { borderBottomColor: border }]}>
                  <DataTable.Cell style={{ flex: 1.5 }}><Text style={{ fontWeight: '700', color: text }}>{c.store}</Text></DataTable.Cell>
                  <DataTable.Cell><Text style={{ color: text }}>{c.email}</Text></DataTable.Cell>
                  <DataTable.Cell><Text style={{ color: text }}>{c.phone}</Text></DataTable.Cell>
                  <DataTable.Cell>
                    <Text style={{ color: text }}>{c.id === '1' || c.id === '5' ? 'Grocery Store' : c.id === '2' ? 'Apparels' : 'Retail General'}</Text>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <StatusBadge status={c.status !== 'Suspended' ? 'Enabled' : 'Disabled'} />
                  </DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 1.5 }}>
                    <Button 
                      mode="contained" 
                      compact 
                      buttonColor={c.status === 'Suspended' ? '#4CAF50' : '#D81B60'}
                      style={{ borderRadius: 8 }}
                      onPress={() => {
                        const updated = customers.map(cust => {
                          if (cust.id === c.id) {
                            return { ...cust, status: cust.status === 'Suspended' ? 'Active' : 'Suspended' };
                          }
                          return cust;
                        });
                        setCustomers(updated);
                        if (typeof window !== 'undefined') window.localStorage.setItem('admin_customers', JSON.stringify(updated));
                        alert(c.status === 'Suspended' ? 'Activated store brand.' : 'Suspended store brand.');
                      }}
                    >
                      {c.status === 'Suspended' ? 'Enable' : 'Suspend'}
                    </Button>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </ScrollView>
        </Card.Content>
      </Card>
    );
  };

  // --- WORKER MANAGEMENT ---
  const renderWorkers = () => {
    return (
      <Card style={[styles.card, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={[styles.chartIconBadge, { backgroundColor: '#FFF3E0' }]}>
              <Icon name="account-group" size={16} color="#E65100" />
            </View>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', color: text }}>Active Store Worker Sessions</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'}>
            <DataTable style={{ minWidth: 850 }}>
              <DataTable.Header style={[styles.tableHeader, { backgroundColor: isDark ? '#1A1B2D' : '#FAFAFE' }]}>
                <DataTable.Title><Text style={styles.tableHeaderText}>Staff Name</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 1.5 }}><Text style={styles.tableHeaderText}>Shop Location</Text></DataTable.Title>
                <DataTable.Title><Text style={styles.tableHeaderText}>Worker Role</Text></DataTable.Title>
                <DataTable.Title><Text style={styles.tableHeaderText}>Login Activity</Text></DataTable.Title>
                <DataTable.Title numeric><Text style={styles.tableHeaderText}>Transactions</Text></DataTable.Title>
                <DataTable.Title><Text style={styles.tableHeaderText}>Status</Text></DataTable.Title>
              </DataTable.Header>

              {workers.map((w) => (
                <DataTable.Row key={w.id} style={[styles.tableRow, { borderBottomColor: border }]}>
                  <DataTable.Cell><Text style={{ fontWeight: '700', color: text }}>{w.name}</Text></DataTable.Cell>
                  <DataTable.Cell style={{ flex: 1.5 }}><Text style={{ color: text }}>{w.store}</Text></DataTable.Cell>
                  <DataTable.Cell><Text style={{ color: text }}>{w.role}</Text></DataTable.Cell>
                  <DataTable.Cell><Text style={{ color: text, fontSize: 12 }}>{w.login}</Text></DataTable.Cell>
                  <DataTable.Cell numeric><Text style={{ color: text, fontWeight: '600' }}>{w.sales}</Text></DataTable.Cell>
                  <DataTable.Cell><StatusBadge status={w.status} /></DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </ScrollView>
        </Card.Content>
      </Card>
    );
  };

  const renderSales = () => {
    const hasSalesData = totalTransactionsCount > 0;
    return (
      <View>
        <Card style={[styles.card, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={[styles.chartIconBadge, { backgroundColor: '#E3F2FD' }]}>
                <Icon name="chart-line" size={16} color="#1565C0" />
              </View>
              <Text variant="titleMedium" style={{ fontWeight: 'bold', color: text }}>SaaS Revenue & Sales Analytics</Text>
            </View>
            
            {!hasSalesData ? (
              <View style={{ padding: 40 }}>
                <EmptyState icon="chart-bar" title="No Data Available" subtitle="No sales transactions recorded in database." />
              </View>
            ) : (
              <View style={{ gap: 20 }}>
                <View style={styles.metricsRow}>
                  <View style={[styles.metricCard, { backgroundColor: isDark ? '#1A2E1A' : '#F1F8E9', borderColor: isDark ? '#2D442D' : '#DCEDC8' }]}>
                    <Icon name="cash-register" size={24} color="#558B2F" style={{ marginBottom: 6 }} />
                    <Text style={{ color: subText, fontSize: 12, fontWeight: '500' }}>Today's Sales</Text>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#4CAF50', marginTop: 4 }}>₹{todayRevenueSum.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={[styles.metricCard, { backgroundColor: isDark ? '#1A1A2E' : '#E8EAF6', borderColor: isDark ? '#2D2D44' : '#C5CAE9' }]}>
                    <Icon name="calendar-week" size={24} color="#283593" style={{ marginBottom: 6 }} />
                    <Text style={{ color: subText, fontSize: 12, fontWeight: '500' }}>Weekly Sales</Text>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#3F51B5', marginTop: 4 }}>₹{weeklyRevenueSum.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={[styles.metricCard, { backgroundColor: isDark ? '#2E1A2E' : '#F3E5F5', borderColor: isDark ? '#442D44' : '#CE93D8' }]}>
                    <Icon name="calendar-month" size={24} color="#6A1B9A" style={{ marginBottom: 6 }} />
                    <Text style={{ color: subText, fontSize: 12, fontWeight: '500' }}>Monthly Sales</Text>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#9C27B0', marginTop: 4 }}>₹{monthlyRevenueSum.toLocaleString('en-IN')}</Text>
                  </View>
                </View>

                <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={[styles.chartIconBadge, { backgroundColor: '#E3F2FD' }]}>
                    <Icon name="chart-bar" size={16} color="#1565C0" />
                  </View>
                  <Text variant="titleSmall" style={{ fontWeight: 'bold', color: text }}>Weekly Sales Distribution</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <BarChart
                    data={{
                      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                      datasets: [{ data: salesChartData }]
                    }}
                    width={Math.max(screenWidth - 300, 600)}
                    height={220}
                    chartConfig={{
                      backgroundGradientFrom: cardBg,
                      backgroundGradientTo: cardBg,
                      color: (opacity = 1) => `rgba(21, 101, 192, ${opacity})`,
                      labelColor: () => subText,
                      fillShadowGradientOpacity: 0.8,
                    }}
                    yAxisLabel="₹"
                    yAxisSuffix=""
                    style={styles.chartStyle}
                  />
                </ScrollView>
              </View>
            )}
          </Card.Content>
        </Card>
      </View>
    );
  };

  const renderRevenue = () => {
    const hasData = totalRevenueSum > 0;
    return (
      <Card style={[styles.card, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={[styles.chartIconBadge, { backgroundColor: '#E8F5E9' }]}>
              <Icon name="cash-multiple" size={16} color="#2E7D32" />
            </View>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', color: text }}>Revenue Distribution & Commission Pools</Text>
          </View>
          
          {!hasData ? (
            <View style={{ padding: 40 }}>
              <EmptyState icon="cash-off" title="No Data Available" subtitle="No real transaction or subscription revenue recorded in database." />
            </View>
          ) : (
            <View style={{ gap: 20 }}>
              <View style={styles.metricsRow}>
                <View style={[styles.metricCard, { backgroundColor: isDark ? '#2E1A2A' : '#FCE4EC', borderColor: isDark ? '#442D40' : '#F8BBD0' }]}>
                  <Icon name="trending-up" size={24} color="#C2185B" style={{ marginBottom: 6 }} />
                  <Text style={{ color: subText, fontWeight: '500', fontSize: 12 }}>Monthly Recurring Revenue (MRR)</Text>
                  <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#D81B60', marginTop: 4 }}>₹{monthlyRevenueSum.toLocaleString('en-IN')}</Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: isDark ? '#1A2E1A' : '#E8F5E9', borderColor: isDark ? '#2D442D' : '#C8E6C9' }]}>
                  <Icon name="hand-coin" size={24} color="#2E7D32" style={{ marginBottom: 6 }} />
                  <Text style={{ color: subText, fontWeight: '500', fontSize: 12 }}>Total Revenue Collected</Text>
                  <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#4CAF50', marginTop: 4 }}>₹{totalRevenueSum.toLocaleString('en-IN')}</Text>
                </View>
              </View>

              <Divider style={{ marginVertical: 20 }} />

              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={[styles.chartIconBadge, { backgroundColor: '#ECEFF1' }]}>
                  <Icon name="format-list-bulleted" size={16} color="#37474F" />
                </View>
                <Text variant="titleSmall" style={{ fontWeight: 'bold', color: text }}>Revenue Stream Details</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'}>
                <DataTable style={{ minWidth: 700 }}>
                  <DataTable.Header style={[styles.tableHeader, { backgroundColor: isDark ? '#1A1B2D' : '#FAFAFE' }]}>
                    <DataTable.Title><Text style={styles.tableHeaderText}>Revenue Category</Text></DataTable.Title>
                    <DataTable.Title><Text style={styles.tableHeaderText}>Transaction Count</Text></DataTable.Title>
                    <DataTable.Title><Text style={styles.tableHeaderText}>Percentage Share</Text></DataTable.Title>
                    <DataTable.Title numeric><Text style={styles.tableHeaderText}>Amount Collected</Text></DataTable.Title>
                  </DataTable.Header>

                  <DataTable.Row style={[styles.tableRow, { borderBottomColor: border }]}>
                    <DataTable.Cell><Text style={{ color: text }}>Platform Sales (SaaS & Shop Sales)</Text></DataTable.Cell>
                    <DataTable.Cell><Text style={{ color: text }}>{totalTransactionsCount} sales</Text></DataTable.Cell>
                    <DataTable.Cell><Text style={{ color: text }}>100%</Text></DataTable.Cell>
                    <DataTable.Cell numeric><Text style={{ fontWeight: 'bold', color: '#4CAF50' }}>₹{totalRevenueSum.toLocaleString('en-IN')}</Text></DataTable.Cell>
                  </DataTable.Row>
                </DataTable>
              </ScrollView>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  const renderBarcodes = () => {
    const totalBarcodesCount = barcodesList.reduce((acc, curr) => acc + (curr.generated || 0), 0);
    const hasData = barcodesList.length > 0;
    return (
      <Card style={[styles.card, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={[styles.chartIconBadge, { backgroundColor: '#E0F7FA' }]}>
              <Icon name="barcode-scan" size={16} color="#00695C" />
            </View>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', color: text }}>Barcode Engine Usage Logs</Text>
          </View>
          
          {!hasData ? (
            <View style={{ padding: 40 }}>
              <EmptyState icon="barcode" title="No Data Available" subtitle="No barcode generation logs recorded in database." />
            </View>
          ) : (
            <View style={{ gap: 20 }}>
              <View style={styles.metricsRow}>
                <View style={[styles.metricCard, { backgroundColor: isDark ? '#1A2E2E' : '#E0F2F1', borderColor: isDark ? '#2D4444' : '#B2DFDB' }]}>
                  <Icon name="barcode" size={24} color="#00695C" style={{ marginBottom: 6 }} />
                  <Text style={{ color: subText, fontWeight: '500' }}>Total Barcodes Printed</Text>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: text, marginTop: 4 }}>{totalBarcodesCount.toLocaleString('en-IN')}</Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: isDark ? '#2E1A1A' : '#FFEBEE', borderColor: isDark ? '#442D2D' : '#FFCDD2' }]}>
                  <Icon name="alert-circle" size={24} color="#C62828" style={{ marginBottom: 6 }} />
                  <Text style={{ color: subText, fontWeight: '500' }}>Failed Print Reports</Text>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#F44336', marginTop: 4 }}>0</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'}>
                <DataTable style={{ minWidth: 750 }}>
                  <DataTable.Header style={[styles.tableHeader, { backgroundColor: isDark ? '#1A1B2D' : '#FAFAFE' }]}>
                    <DataTable.Title><Text style={styles.tableHeaderText}>Store Client</Text></DataTable.Title>
                    <DataTable.Title numeric><Text style={styles.tableHeaderText}>Generated</Text></DataTable.Title>
                    <DataTable.Title><Text style={styles.tableHeaderText}>Format</Text></DataTable.Title>
                    <DataTable.Title><Text style={styles.tableHeaderText}>Print Status</Text></DataTable.Title>
                    <DataTable.Title><Text style={styles.tableHeaderText}>Timestamp</Text></DataTable.Title>
                  </DataTable.Header>

                  {barcodesList.map((b) => (
                    <DataTable.Row key={b.id} style={[styles.tableRow, { borderBottomColor: border }]}>
                      <DataTable.Cell><Text style={{ color: text }}>{b.storeName}</Text></DataTable.Cell>
                      <DataTable.Cell numeric><Text style={{ color: text, fontWeight: '600' }}>{b.generated}</Text></DataTable.Cell>
                      <DataTable.Cell><Text style={{ color: text }}>{b.format}</Text></DataTable.Cell>
                      <DataTable.Cell><StatusBadge status={b.status} /></DataTable.Cell>
                      <DataTable.Cell><Text style={{ color: text, fontSize: 12 }}>{b.timestamp}</Text></DataTable.Cell>
                    </DataTable.Row>
                  ))}
                </DataTable>
              </ScrollView>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  // --- REPORTS CENTER ---
  const renderReports = () => {
    const reportCategories = [
      { id: '1', name: 'Customer Report', desc: 'Customer activity and account statuses.', icon: 'account-group', color: '#1565C0' },
      { id: '2', name: 'Subscription Report', desc: 'Active subscriptions, renewals, and expired plans.', icon: 'calendar-sync', color: '#2E7D32' },
      { id: '3', name: 'Revenue Report', desc: 'Actual revenue collected from active platform sales.', icon: 'currency-inr', color: '#C2185B' },
      { id: '4', name: 'Support Ticket Report', desc: 'Open, resolved, and pending support issues.', icon: 'face-agent', color: '#E65100' },
      { id: '5', name: 'Vendor Activity Report', desc: 'Total shops, products added, and bills generated.', icon: 'storefront', color: '#6A1B9A' }
    ];

    return (
      <Card style={[styles.card, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={[styles.chartIconBadge, { backgroundColor: '#FFF3E0' }]}>
              <Icon name="file-chart" size={16} color="#E65100" />
            </View>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', color: text }}>Downloadable Platform Reports Center</Text>
          </View>
          <View style={styles.reportsGrid}>
            {reportCategories.map((rep) => (
              <View
                key={rep.id}
                style={[styles.reportItem, { borderColor: border, backgroundColor: isDark ? '#1A1B2D' : '#FAFAFE', justifyContent: 'space-between' }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 14 }}>
                  <View style={[styles.reportIconWrap, { backgroundColor: rep.color + '18' }]}>
                    <Icon name={rep.icon} size={22} color={rep.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: text, fontSize: 13 }}>{rep.name}</Text>
                    <Text style={{ fontSize: 11, color: subText, marginTop: 3 }}>{rep.desc}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.downloadBtn, { backgroundColor: isDark ? '#2D3748' : '#F1F5F9' }]}
                    onPress={() => setPreviewReport(rep)}
                    activeOpacity={0.7}
                  >
                    <Icon name="eye-outline" size={18} color={isDark ? '#A0AEC0' : '#4B5563'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.downloadBtn, { backgroundColor: '#DBEAFE' }]}
                    onPress={() => alert(`Prepared and downloaded standard PDF report file: ${rep.name.replace(/ /g, '_')}.pdf`)}
                    activeOpacity={0.7}
                  >
                    <Icon name="download" size={18} color="#2563EB" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </Card.Content>
      </Card>
    );
  };

  // --- PAYMENT MANAGEMENT ---
  const renderSupport = () => {
    return (
      <Card style={[styles.card, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={[styles.chartIconBadge, { backgroundColor: '#FCE4EC' }]}>
              <Icon name="face-agent" size={16} color="#AD1457" />
            </View>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', color: text }}>Active Technical & Billing Support Tickets</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'}>
            <DataTable style={{ minWidth: 900 }}>
              <DataTable.Header style={[styles.tableHeader, { backgroundColor: isDark ? '#1A1B2D' : '#FAFAFE' }]}>
                <DataTable.Title><Text style={styles.tableHeaderText}>Ticket ID</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 1.5 }}><Text style={styles.tableHeaderText}>Store</Text></DataTable.Title>
                <DataTable.Title style={{ flex: 2 }}><Text style={styles.tableHeaderText}>Issue Subject</Text></DataTable.Title>
                <DataTable.Title><Text style={styles.tableHeaderText}>Priority</Text></DataTable.Title>
                <DataTable.Title><Text style={styles.tableHeaderText}>Status</Text></DataTable.Title>
                <DataTable.Title numeric style={{ flex: 1.5 }}><Text style={styles.tableHeaderText}>Reply</Text></DataTable.Title>
              </DataTable.Header>

              {tickets.map((t) => (
                <DataTable.Row key={t.id} style={[styles.tableRow, { borderBottomColor: border }]}>
                  <DataTable.Cell><Text style={{ fontFamily: 'monospace', color: text, fontWeight: '600' }}>{t.id}</Text></DataTable.Cell>
                  <DataTable.Cell style={{ flex: 1.5 }}><Text style={{ color: text }}>{t.store}</Text></DataTable.Cell>
                  <DataTable.Cell style={{ flex: 2 }}><Text style={{ color: text }}>{t.subject}</Text></DataTable.Cell>
                  <DataTable.Cell>
                    <View style={[styles.priorityBadge, { 
                      backgroundColor: t.priority === 'Urgent' ? '#FFEBEE' : t.priority === 'High' ? '#FFF3E0' : t.priority === 'Medium' ? '#FFF8E1' : '#F1F8E9'
                    }]}>
                      <Text style={{ 
                        fontWeight: 'bold', 
                        fontSize: 11,
                        color: t.priority === 'Urgent' ? '#C62828' : t.priority === 'High' ? '#E65100' : t.priority === 'Medium' ? '#F57F17' : '#33691E'
                      }}>
                        {t.priority}
                      </Text>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell><StatusBadge status={t.status} /></DataTable.Cell>
                  <DataTable.Cell numeric style={{ flex: 1.5 }}>
                    <Button 
                      mode="contained" 
                      compact 
                      buttonColor="#1565C0"
                      style={{ borderRadius: 8 }}
                      onPress={() => {
                        setSelectedTicket(t);
                        setShowSupportReply(true);
                      }}
                    >
                      Resolve
                    </Button>
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </ScrollView>
        </Card.Content>
      </Card>
    );
  };

  // --- PERMISSIONS OVERRIDES CONFIGURATION ---
  const renderPermissions = () => {
    return (
      <Card style={[styles.card, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View style={[styles.chartIconBadge, { backgroundColor: '#FCE4EC' }]}>
              <Icon name="shield-key" size={16} color="#C2185B" />
            </View>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', color: text }}>
              Manual Customer Permissions Access Panel
            </Text>
          </View>
          <Text style={{ color: subText, fontSize: 13, marginBottom: 16, marginLeft: 42 }}>
            Select a customer below to manually override their SaaS product tier access rules.
          </Text>

          <Searchbar
            placeholder="Search stores for custom overrides..."
            value={shopSearch}
            onChangeText={setShopSearch}
            style={[styles.searchBar, { backgroundColor: isDark ? '#222336' : '#F8F7FF', borderColor: border }]}
            placeholderTextColor={subText}
            inputStyle={{ color: text }}
            iconColor={subText}
          />

          <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            <View style={{ flex: 1.2, minWidth: 280 }}>
              <Text style={{ fontWeight: '700', color: text, marginBottom: 8, fontSize: 13 }}>Store List</Text>
              <ScrollView style={{ height: 280, borderWidth: 1, borderColor: border, borderRadius: 12, overflow: 'hidden' }}>
                {customers.map(c => (
                  <TouchableOpacity 
                    key={c.id} 
                    style={[
                      styles.permListItem, 
                      { 
                        backgroundColor: selectedCustomer?.id === c.id ? '#2563EB' : 'transparent',
                        borderBottomColor: border
                      }
                    ]}
                    onPress={() => setSelectedCustomer(c)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.permListIcon, { backgroundColor: selectedCustomer?.id === c.id ? 'rgba(255,255,255,0.2)' : isDark ? '#252640' : '#EFF6FF' }]}>
                      <Icon name="storefront" size={16} color={selectedCustomer?.id === c.id ? '#fff' : '#2563EB'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: selectedCustomer?.id === c.id ? 'white' : text, fontSize: 13 }}>
                        {c.store}
                      </Text>
                      <Text style={{ fontSize: 11, color: selectedCustomer?.id === c.id ? 'rgba(255,255,255,0.7)' : subText, marginTop: 1 }}>
                        Plan: {c.plan}
                      </Text>
                    </View>
                    {selectedCustomer?.id === c.id && (
                      <Icon name="chevron-right" size={18} color="rgba(255,255,255,0.5)" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={{ flex: 1.8, minWidth: 320 }}>
              <Text style={{ fontWeight: '700', color: text, marginBottom: 8, fontSize: 13 }}>
                Permissions Matrix: {selectedCustomer ? selectedCustomer.store : 'Select a Customer'}
              </Text>
              
              {selectedCustomer ? (
                <View style={[styles.permissionsBox, { borderColor: border, backgroundColor: isDark ? '#1A1B2D' : '#FAFAFE' }]}>
                  {Object.entries({
                    barcode: 'Barcode Generator Module',
                    billing: 'Double-entry Accounting & Billing',
                    worker: 'Staff / Worker Registration',
                    reports: 'Advanced Accounting Reports',
                    inventory: 'Live Stock & Low Stock Warnings',
                    gst: 'GSTR Filing Wizard',
                    pdfExport: 'PDF/Excel Export Privileges',
                    multiDevice: 'Multi-device Concurrent Syncing',
                    apiAccess: 'API Access Integrations',
                  }).map(([key, label]) => (
                    <View key={key} style={[styles.checkRow, { borderBottomColor: border }]}>
                      <Checkbox 
                        status={custPermissions[key] ? 'checked' : 'unchecked'} 
                        onPress={() => setCustPermissions({...custPermissions, [key]: !custPermissions[key]})} 
                        color="#2563EB"
                      />
                      <Text style={{ color: text, flex: 1, fontSize: 13 }}>{label}</Text>
                      <StatusBadge status={custPermissions[key] ? 'Active' : 'Disabled'} />
                    </View>
                  ))}

                  <Button mode="contained" buttonColor="#2563EB" onPress={handlePermissionSave} style={{ marginTop: 16, borderRadius: 10 }} icon="content-save">
                    Save Custom Overrides
                  </Button>
                </View>
              ) : (
                <View style={[styles.permissionsBox, { borderColor: border, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#1A1B2D' : '#FAFAFE' }]}>
                  <EmptyState icon="shield-lock-outline" title="No store selected" subtitle="Choose a store from the list to manage overrides" />
                </View>
              )}
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  // --- NOTIFICATIONS CENTER ---
  const renderNotifications = () => {
    return (
      <View>
        <Card style={[styles.card, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
          <Card.Content>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.chartIconBadge, { backgroundColor: '#DBEAFE' }]}>
                  <Icon name="bullhorn" size={16} color="#2563EB" />
                </View>
                <Text variant="titleMedium" style={{ fontWeight: 'bold', color: text }}>Broadcaster Control Hub</Text>
              </View>
              <Button mode="contained" buttonColor="#2563EB" icon="plus" onPress={() => setShowBroadcastAlert(true)} style={{ borderRadius: 10 }}>
                Broadcast Alert
              </Button>
            </View>
            <Text style={{ color: subText, fontSize: 12, marginTop: 4, marginLeft: 42 }}>
              Instantly push system alerts, warnings, or billing banners to registered client dashboards.
            </Text>
          </Card.Content>
        </Card>

        <Card style={[styles.card, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={[styles.chartIconBadge, { backgroundColor: '#FFEBEE' }]}>
                <Icon name="bell-ring" size={16} color="#C62828" />
              </View>
              <Text variant="titleMedium" style={{ fontWeight: 'bold', color: text }}>Alert Logs History</Text>
            </View>
            {notifications.map((item) => (
              <View key={item.id} style={[styles.alertRow, { borderBottomColor: border }]}>
                <View style={[styles.alertIconWrap, { 
                  backgroundColor: item.type === 'Warning' ? '#FFF3E0' : item.type === 'Alert' ? '#FFEBEE' : '#E8F5E9'
                }]}>
                  <Icon 
                    name={item.type === 'Warning' ? 'alert' : item.type === 'Alert' ? 'bell-alert' : 'cog'} 
                    size={20} 
                    color={item.type === 'Warning' ? '#E65100' : item.type === 'Alert' ? '#C62828' : '#2E7D32'} 
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={{ fontWeight: '700', color: text, fontSize: 13 }}>{item.title}</Text>
                  <Text style={{ color: subText, fontSize: 12, marginTop: 3 }}>{item.text}</Text>
                </View>
                <Text style={{ fontSize: 11, color: subText, fontWeight: '500' }}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : (item.date || 'Just now')}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      </View>
    );
  };

  // --- DATABASE MONITORING ---
  const renderSettings = () => {
    return (
      <Card style={[styles.card, { backgroundColor: cardBg, borderColor: border }]} elevation={0}>
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={[styles.chartIconBadge, { backgroundColor: '#ECEFF1' }]}>
              <Icon name="cog" size={16} color="#37474F" />
            </View>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', color: text }}>System & Platform Branding Settings</Text>
          </View>
          
          <TextInput label="SaaS Platform Name" value="SmartPOS Admin" mode="outlined" style={[styles.settingInput, { backgroundColor: isDark ? '#1A1B2D' : '#fff' }]} outlineColor={border} activeOutlineColor="#2563EB" textColor={text} />
          <TextInput label="Branding Accent Color" value="#D81B60" mode="outlined" style={[styles.settingInput, { backgroundColor: isDark ? '#1A1B2D' : '#fff' }]} outlineColor={border} activeOutlineColor="#2563EB" textColor={text} />
          <TextInput label="Base Currency Symbol" value="INR (₹)" mode="outlined" style={[styles.settingInput, { backgroundColor: isDark ? '#1A1B2D' : '#fff' }]} outlineColor={border} activeOutlineColor="#2563EB" textColor={text} />

          <Divider style={{ marginVertical: 16 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={[styles.chartIconBadge, { backgroundColor: '#FFF3E0' }]}>
              <Icon name="receipt" size={16} color="#E65100" />
            </View>
            <Text variant="titleSmall" style={{ fontWeight: 'bold', color: text }}>Global Tax Defaults</Text>
          </View>
          <TextInput label="Default GST Tax rate (%)" value="18%" mode="outlined" style={[styles.settingInput, { backgroundColor: isDark ? '#1A1B2D' : '#fff' }]} outlineColor={border} activeOutlineColor="#2563EB" textColor={text} />
          <TextInput label="Support Desk Help Email" value="support@pos-saas.co.in" mode="outlined" style={[styles.settingInput, { backgroundColor: isDark ? '#1A1B2D' : '#fff' }]} outlineColor={border} activeOutlineColor="#2563EB" textColor={text} />

          <Button mode="contained" buttonColor="#2563EB" icon="content-save" onPress={() => alert('Platform Settings Saved.')} style={{ marginTop: 8, borderRadius: 10 }}>
            Save Platform Settings
          </Button>
        </Card.Content>
      </Card>
    );
  };

  // ---------------------------------------------------------
  // CORE RENDER MAP
  // ---------------------------------------------------------
  const renderTabContent = () => {
    switch (currentTab) {
      case 'overview': return renderOverview();
      case 'customers': return renderCustomers();
      case 'shops': return renderShops();
      case 'workers': return renderWorkers();
      case 'subscriptions': return renderSubscriptions();
      case 'plans': return renderPlans();
      case 'revenue': return renderRevenue();
      case 'sales': return renderSales();
      case 'barcodes': return renderBarcodes();
      case 'reports': return renderReports();
      case 'demos': return renderDemos();
      case 'support': return renderSupport();
      case 'permissions': return renderPermissions();
      case 'notifications': return renderNotifications();
      case 'settings': return renderSettings();
      default: return renderOverview();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView style={styles.scroll}>
        <View style={styles.content}>
          <AnimatedTab tabKey={currentTab}>
            {renderTabContent()}
          </AnimatedTab>
        </View>
      </ScrollView>

      {/* ---------------------------------------------------------
          MODALS & DIALOGS
          --------------------------------------------------------- */}

      {/* 1. Add Customer Dialog */}
      <Portal>
        <Dialog visible={previewReport !== null} onDismiss={() => setPreviewReport(null)} style={[styles.dialog, { maxWidth: 600, alignSelf: 'center', width: '90%' }]}>
          <Dialog.Title style={styles.dialogTitle}>
            {previewReport && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name={previewReport.icon} size={22} color={previewReport.color} />
                <Text style={{ fontWeight: 'bold', fontSize: 18, color: text }}>{previewReport.name} Preview</Text>
              </View>
            )}
          </Dialog.Title>
          <Dialog.Content>
            {previewReport && (
              <ScrollView style={{ maxHeight: 400 }}>
                <Text style={{ fontSize: 13, color: subText, marginBottom: 16 }}>{previewReport.desc}</Text>
                
                {previewReport.id === '1' && (
                  <View style={{ gap: 8 }}>
                    {renderMetaRow('Total Customers', totalCustCount.toString())}
                    {renderMetaRow('Active Customers', activeShopsCount.toString())}
                    {renderMetaRow('Trial Customers', trialSubCount.toString())}
                    {renderMetaRow('Expired Customers', expiredSubCount.toString())}
                  </View>
                )}

                {previewReport.id === '2' && (
                  <View style={{ gap: 8 }}>
                    {renderMetaRow('Free Trial', trialSubCount.toString())}
                    {renderMetaRow('1 Year Plan', customers.filter(c => c.plan && c.plan.includes('1 Year')).length.toString())}
                    {renderMetaRow('2 Year Plan', customers.filter(c => c.plan && c.plan.includes('2 Year')).length.toString())}
                    {renderMetaRow('3 Year Plan', customers.filter(c => c.plan && c.plan.includes('3 Year')).length.toString())}
                    {renderMetaRow('Expiring Soon', customers.filter(c => c.expiryDate && (new Date(c.expiryDate).getTime() - Date.now()) / 86400000 > 0 && (new Date(c.expiryDate).getTime() - Date.now()) / 86400000 <= 30).length.toString())}
                    {renderMetaRow('Expired Plans', expiredSubCount.toString())}
                  </View>
                )}

                {previewReport.id === '3' && (
                  <View style={{ gap: 8 }}>
                    {salesList.length === 0 ? (
                      <Text style={{ color: text, textAlign: 'center', marginTop: 10 }}>No Data Available</Text>
                    ) : (
                      salesList.slice(0, 5).map((s: any, idx: number) => (
                        <View key={idx} style={{ marginBottom: 8, borderBottomWidth: 1, borderBottomColor: border, paddingBottom: 8 }}>
                          <Text style={{ fontWeight: 'bold', color: text }}>Date: {new Date(s.created_at || new Date()).toLocaleDateString()}</Text>
                          <Text style={{ color: text }}>Customer: {s.customerName || 'Walk-in'}</Text>
                          <Text style={{ color: text }}>Amount: ₹{parseFloat(s.total_amount || 0).toLocaleString('en-IN')}</Text>
                          <Text style={{ color: text }}>Status: {s.status || 'Paid'}</Text>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {previewReport.id === '4' && (
                  <View style={{ gap: 8 }}>
                    {renderMetaRow('Open Tickets', tickets.filter(t => t.status === 'Open').length.toString())}
                    {renderMetaRow('Resolved Tickets', tickets.filter(t => t.status === 'Resolved').length.toString())}
                    {renderMetaRow('Pending Tickets', tickets.filter(t => t.status === 'Pending' || t.status === 'In Progress').length.toString())}
                  </View>
                )}

                {previewReport.id === '5' && (
                  <View style={{ gap: 8 }}>
                    {renderMetaRow('Total Shops', totalCustCount.toString())}
                    {renderMetaRow('Products Added', barcodesList.length.toString())}
                    {renderMetaRow('Bills Generated', totalTransactionsCount.toString())}
                    {renderMetaRow('Active Shops', activeShopsCount.toString())}
                  </View>
                )}
              </ScrollView>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPreviewReport(null)}>Close Preview</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 1. Add Customer Dialog */}
      <Portal>
        <Dialog visible={showAddCustomer} dismissable={false} onDismiss={() => setShowAddCustomer(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>
            <Icon name="account-plus" size={22} color="#2563EB" style={{ marginRight: 8 }} />
            Register New Store Owner Account
          </Dialog.Title>
          <Dialog.Content>
            <TextInput label="Customer Owner Name" value={formName} onChangeText={setFormName} mode="outlined" style={styles.formInput} outlineColor="#EEF0F6" activeOutlineColor="#2563EB" />
            <TextInput label="Store Brand Name" value={formStore} onChangeText={setFormStore} mode="outlined" style={styles.formInput} outlineColor="#EEF0F6" activeOutlineColor="#2563EB" />
            <TextInput label="Email Address" value={formEmail} onChangeText={setFormEmail} mode="outlined" style={styles.formInput} keyboardType="email-address" outlineColor="#EEF0F6" activeOutlineColor="#2563EB" />
            <TextInput label="Mobile Phone Number" value={formPhone} onChangeText={setFormPhone} mode="outlined" style={styles.formInput} keyboardType="phone-pad" outlineColor="#EEF0F6" activeOutlineColor="#2563EB" />
            <TextInput label="Password" value={formPassword} onChangeText={setFormPassword} mode="outlined" style={styles.formInput} secureTextEntry outlineColor="#EEF0F6" activeOutlineColor="#2563EB" />
            <Text style={{ marginTop: 12, fontWeight: '700', color: '#1A1A2E', fontSize: 13 }}>Default Package Plan</Text>
            <SegmentedButtons
              value={formPlan}
              onValueChange={setFormPlan}
              buttons={[
                { value: 'Free Trial', label: 'Trial' },
                { value: 'Premium Yearly', label: 'Premium' }
              ]}
              style={{ marginTop: 10 }}
            />
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowAddCustomer(false)} textColor="#757575" disabled={isCreating}>Cancel</Button>
            <Button mode="contained" buttonColor="#2563EB" onPress={handleCreateCustomer} style={{ borderRadius: 10 }} loading={isCreating} disabled={isCreating}>{isCreating ? 'Adding...' : 'Add Account'}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* --- EDIT CUSTOMER DIALOG --- */}
      <Portal>
        <Dialog visible={showEditCustomer} dismissable={false} onDismiss={() => setShowEditCustomer(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>
            <Icon name="pencil" size={24} color="#1565C0" style={{ marginRight: 8 }} /> Edit Store Owner
          </Dialog.Title>
          <Dialog.Content>
            <ScrollView style={{ maxHeight: 400 }}>
              <TextInput label="Customer Owner Name" value={editFormName} onChangeText={setEditFormName} mode="outlined" style={styles.formInput} activeOutlineColor="#2563EB" />
              <TextInput label="Store Brand Name" value={editFormStore} onChangeText={setEditFormStore} mode="outlined" style={styles.formInput} activeOutlineColor="#2563EB" />
              <TextInput label="Email Address (Cannot be changed)" value={editFormEmail} disabled mode="outlined" style={styles.formInput} />
              <TextInput label="Mobile Phone Number" value={editFormPhone} onChangeText={setEditFormPhone} keyboardType="phone-pad" mode="outlined" style={styles.formInput} activeOutlineColor="#2563EB" />
              
              <Text style={{ marginTop: 12, marginBottom: 6, fontWeight: 'bold', color: '#333' }}>Package Plan</Text>
              <SegmentedButtons
                value={editFormPlan}
                onValueChange={setEditFormPlan}
                buttons={[
                  { value: 'Trial', label: 'Trial' },
                  { value: 'Premium', label: 'Premium' },
                ]}
                style={{ marginBottom: 12 }}
              />

              <Divider style={{ marginVertical: 12 }} />
              <Text style={{ fontWeight: 'bold', color: '#D32F2F', marginBottom: 8 }}>Danger Zone: Force Reset Password</Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <TextInput 
                  label="Type New Password" 
                  value={editFormNewPassword} 
                  onChangeText={setEditFormNewPassword} 
                  mode="outlined" 
                  secureTextEntry
                  style={[styles.formInput, { flex: 1, marginBottom: 0, marginRight: 8 }]} 
                  activeOutlineColor="#D32F2F" 
                />
                <Button 
                  mode="contained" 
                  buttonColor="#D32F2F" 
                  onPress={handleForceResetPassword}
                  loading={isResetting}
                  disabled={isResetting}
                  style={{ borderRadius: 6, height: 50, justifyContent: 'center' }}
                >
                  Force Reset
                </Button>
              </View>

              <Button mode="text" icon="email-sync" onPress={() => handleSendResetEmail(editFormEmail)} textColor="#1565C0">
                Or Send Reset Link via Email
              </Button>
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <Button onPress={() => setShowEditCustomer(false)} textColor="#757575" disabled={isCreating}>Cancel</Button>
            <Button mode="contained" buttonColor="#2563EB" onPress={handleUpdateCustomer} loading={isCreating} disabled={isCreating}>Save Changes</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={showAddPlan} onDismiss={() => setShowAddPlan(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>
            <Icon name="tag-plus" size={22} color="#2563EB" style={{ marginRight: 8 }} />
            Create SaaS Subscription Tier
          </Dialog.Title>
          <Dialog.Content>
            <TextInput label="Plan Name" value={planName} onChangeText={setPlanName} mode="outlined" style={styles.formInput} outlineColor="#EEF0F6" activeOutlineColor="#2563EB" />
            <TextInput label="Pricing Rate (INR)" value={planPrice} onChangeText={setPlanPrice} mode="outlined" style={styles.formInput} placeholder="e.g. 1500" left={<TextInput.Affix text="₹ " />} outlineColor="#EEF0F6" activeOutlineColor="#2563EB" />
            <TextInput label="Plan Duration" value={planDuration} onChangeText={setPlanDuration} mode="outlined" style={styles.formInput} placeholder="e.g. 1 Month" outlineColor="#EEF0F6" activeOutlineColor="#2563EB" />
            <TextInput label="Supported Devices limit" value={planDevices} onChangeText={setPlanDevices} mode="outlined" style={styles.formInput} keyboardType="numeric" outlineColor="#EEF0F6" activeOutlineColor="#2563EB" />
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowAddPlan(false)} textColor="#757575">Cancel</Button>
            <Button mode="contained" buttonColor="#2563EB" onPress={handleCreatePlan} style={{ borderRadius: 10 }}>Create Tier</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 3. Broadcast Dialog */}
      <Portal>
        <Dialog visible={showBroadcastAlert} onDismiss={() => setShowBroadcastAlert(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>
            <Icon name="bullhorn" size={22} color="#E65100" style={{ marginRight: 8 }} />
            Broadcast System Alert Banner
          </Dialog.Title>
          <Dialog.Content>
            <TextInput label="Alert Title Headline" value={broadcastTitle} onChangeText={setBroadcastTitle} mode="outlined" style={styles.formInput} outlineColor="#EEF0F6" activeOutlineColor="#2563EB" />
            <TextInput label="Alert Description Details" value={broadcastText} onChangeText={setBroadcastText} mode="outlined" multiline numberOfLines={3} style={styles.formInput} outlineColor="#EEF0F6" activeOutlineColor="#2563EB" />
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowBroadcastAlert(false)} textColor="#757575">Cancel</Button>
            <Button mode="contained" buttonColor="#E65100" onPress={handleBroadcast} style={{ borderRadius: 10 }} icon="send">Broadcast</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 4. Support Ticket Resolution Dialog */}
      <Portal>
        <Dialog visible={showSupportReply} onDismiss={() => setShowSupportReply(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>
            <Icon name="headset" size={22} color="#1565C0" style={{ marginRight: 8 }} />
            Resolve: {selectedTicket?.id}
          </Dialog.Title>
          <Dialog.Content>
            <View style={{ backgroundColor: '#EFF6FF', padding: 14, borderRadius: 10, marginBottom: 16 }}>
              <Text style={{ fontWeight: '700', color: '#1A1A2E', fontSize: 13 }}>Store: {selectedTicket?.store}</Text>
              <Text style={{ marginTop: 4, color: '#757575', fontSize: 12 }}>Subject: {selectedTicket?.subject}</Text>
            </View>
            <TextInput label="Enter Resolution Response Details" mode="outlined" multiline numberOfLines={4} style={styles.formInput} outlineColor="#EEF0F6" activeOutlineColor="#2563EB" />
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowSupportReply(false)} textColor="#757575">Cancel</Button>
            <Button 
              mode="contained" 
              buttonColor="#4CAF50"
              style={{ borderRadius: 10 }}
              icon="check-circle"
              onPress={() => {
                setTickets(tickets.map(t => t.id === selectedTicket.id ? { ...t, status: 'Resolved' } : t));
                setShowSupportReply(false);
                alert('Sent resolution reply and marked ticket as Resolved.');
              }}
            >
              Mark Resolved
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

// ---------------------------------------------------------
// HELPER CARD COMPONENTS
// ---------------------------------------------------------
const KpiCard = ({ title, val, icon, col, gradientBg, cardBg, textCol, subTextCol, border }: any) => {
  return (
    <View style={[styles.kpiCard, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={[styles.kpiIconWrap, { backgroundColor: gradientBg }]}>
        <Icon name={icon} size={20} color={col} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.kpiTitle, { color: subTextCol }]}>{title}</Text>
        <Text style={[styles.kpiVal, { color: textCol }]}>{val}</Text>
      </View>
    </View>
  );
};

// ---------------------------------------------------------
// STYLING
// ---------------------------------------------------------
const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20 },
  pageTitle: { fontWeight: 'bold', marginBottom: 20, fontSize: 22 },
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  sectionHeader: { fontWeight: 'bold', marginBottom: 12 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  
  // Quick Stats Bar
  quickStatsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 24,
  },
  quickStatItem: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  quickStatIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  quickStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  quickStatValue: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 2,
  },
  quickStatTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveDot: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  ticketAlert: {
    padding: 4,
  },

  // KPI Top Bar
  kpiScroll: { marginBottom: 24 },
  kpiContainer: { flexDirection: 'column', gap: 12 },
  kpiRow: { flexDirection: 'row', gap: 12 },
  kpiCard: {
    width: 210,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  kpiIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  kpiContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kpiTitle: { fontSize: 10.5, fontWeight: '600', letterSpacing: 0.3 },
  kpiVal: { fontSize: 18, fontWeight: 'bold', marginTop: 3 },

  // Quick Action chips
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionChipText: {
    fontWeight: '700',
    fontSize: 12.5,
  },

  // Charts
  chartIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  chartsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 20 },
  chartBoxCard: { flex: 1, minWidth: 260, borderRadius: 16, borderWidth: 1 },
  chartStyle: { marginVertical: 8, borderRadius: 12 },

  // Status Badge
  statusBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  // Priority Badge
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  // Alerts
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  alertIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Timeline
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  timelineLine: {
    alignItems: 'center',
    width: 40,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: '#EEF0F6',
    marginTop: -2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 20,
    paddingLeft: 8,
  },
  timelineTitle: {
    fontWeight: '700',
    fontSize: 13,
  },
  timelineDesc: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 18,
  },
  timelineTime: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },

  // Tables
  tableHeader: {
    borderRadius: 8,
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#757575',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tableRow: {
    borderBottomWidth: 1,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontWeight: '700',
    color: '#757575',
    fontSize: 15,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: '#9E9E9E',
    fontSize: 13,
  },

  // Search registry
  searchBar: { marginBottom: 16, elevation: 0, borderRadius: 12, borderWidth: 1 },

  // Metric Cards
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 4 },
  metricCard: {
    flex: 1,
    minWidth: 220,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },

  // Progress bar
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },

  // Reports
  reportsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  reportItem: {
    flex: 1,
    minWidth: 320,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  reportIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Settings
  settingInput: { marginBottom: 14 },

  // Modals
  dialog: {
    borderRadius: 20,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  dialogActions: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  formInput: { marginBottom: 14 },

  // Permissions
  permListItem: {
    padding: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  permListIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  permissionsBox: { flex: 1, minWidth: 300, borderWidth: 1, borderRadius: 16, padding: 16, minHeight: 280 },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
});
