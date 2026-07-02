import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Platform, useWindowDimensions, ActivityIndicator } from 'react-native';
import { Text, Button, Card, Divider, useTheme, Avatar, Portal, Dialog, TextInput, SegmentedButtons } from 'react-native-paper';
import { useAppTheme } from '../providers/ThemeProvider';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../providers/AuthProvider';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from '../lib/firestore_adapter';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function Index() {
  const { isDarkMode } = useAppTheme();
  const appTheme = useTheme();

  const { user, loading, role } = useAuth();
  const { signup } = useLocalSearchParams();
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  // Local state
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoVideoPlaying, setDemoVideoPlaying] = useState(false);
  
  // Interactive Demo Tab selection
  const [activeDemoTab, setActiveDemoTab] = useState('billing');
  // Interactive Screenshots Tab selection
  const [activeScreenTab, setActiveScreenTab] = useState('owner');
  // FAQs expanded state
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  
  // Pricing toggle (monthly/yearly)
  const [billingCycle, setBillingCycle] = useState('yearly');

  const scrollRef = React.useRef<ScrollView>(null);
  const [offsets, setOffsets] = useState<Record<string, number>>({});

  const handleLayout = (section: string, e: any) => {
    const y = e.nativeEvent.layout.y;
    setOffsets(prev => ({ ...prev, [section]: y }));
  };

  const scrollToSection = (section: string) => {
    const y = offsets[section];
    if (y !== undefined && scrollRef.current) {
      scrollRef.current.scrollTo({ y, animated: true });
    }
  };

  React.useEffect(() => {
    if (signup === 'true') {
      setShowSignupModal(true);
    }
  }, [signup]);

  React.useEffect(() => {
    if (!loading) {
      if (user) {
        if (role === 'admin') router.replace('/(admin)' as any);
        else if (role === 'owner') router.replace('/(owner)' as any);
        else router.replace('/(vendor)/(tabs)' as any);
      } else {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const hostname = window.location.hostname;
          if (hostname.includes('pos-admin') || hostname.includes('admin')) {
            router.replace('/(auth)/login' as any);
          }
        }
      }
    }
  }, [user, loading, role]);

  const toggleFaq = (idx: number) => {
    setExpandedFaq(expandedFaq === idx ? null : idx);
  };

  // Signup form fields
  const [fullName, setFullName] = useState('');
  const [shopName, setShopName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [gstType, setGstType] = useState('GST'); // 'GST' or 'NON-GST'
  const [operationMode, setOperationMode] = useState('Mobile Only'); // 'Mobile Only' | 'Laptop + Mobile' | 'Large Shop'

  // Contact form fields
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMsg, setContactMsg] = useState('');

  const handleCTA = () => {
    if (user) {
      if (role === 'admin') router.push('/(admin)' as any);
      else if (role === 'owner') router.push('/(owner)' as any);
      else router.push('/(vendor)/(tabs)' as any);
    } else {
      setShowSignupModal(true);
    }
  };

  const handleSignUpSubmit = async () => {
    if (!fullName || !shopName || !mobileNumber || !email || !password) {
      alert('Please fill in all the required fields.');
      return;
    }
    
    try {
      // Create real Firebase Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Save details to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        role: 'owner',
        subscription_plan: 'free_trial',
        subscription_start_date: new Date(),
        subscription_end_date: new Date(new Date().setDate(new Date().getDate() + 30)),
        storeName: shopName,
        isGstRegistered: gstType === 'GST',
        shopMode: operationMode,
        businessCategory: businessType,
        fullName,
        mobileNumber,
        email,
        permissions: {
          pos_access: true,
          stock_management: true,
          barcode_generation: true,
          reporting: true
        }
      });

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.setItem('storeName', shopName);
        window.localStorage.setItem('isGstRegistered', String(gstType === 'GST'));
        window.localStorage.setItem('shopMode', operationMode);
        window.localStorage.setItem('businessCategory', businessType);
      }
      
      alert(`Thank you, ${fullName}! Your 30-Day Free Trial for "${shopName}" is now active. Redirecting to your dashboard...`);
      setShowSignupModal(false);
      router.replace('/(owner)' as any);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use' || error.message?.includes('email-already-in-use')) {
        try {
          await signInWithEmailAndPassword(auth, email, password);
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.localStorage.setItem('storeName', shopName);
            window.localStorage.setItem('isGstRegistered', String(gstType === 'GST'));
            window.localStorage.setItem('shopMode', operationMode);
            window.localStorage.setItem('businessCategory', businessType);
          }
          alert(`Welcome back, ${fullName}! Logging you in...`);
          setShowSignupModal(false);
          router.replace('/(owner)' as any);
        } catch (signInError: any) {
          alert(`Email is already registered. Login failed: ${signInError.message}`);
        }
      } else {
        alert(`Signup Failed: ${error.message}`);
      }
    }
  };

  const handleDemoBooking = () => {
    try {
      const isWeb = Platform.OS === 'web';
      const apiHost = isWeb ? '' : 'https://bharatpos-new.vercel.app';
      fetch(`${apiHost}/api/send-support-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'support@bharatpos.systems',
          message: 'Requesting product walkthrough demo from BharatPOS landing page.',
          type: 'demo'
        })
      });
    } catch (e) {
      console.warn("Mail dispatch error:", e);
    }
    alert('Thank you! Our retail product experts will reach out to you within 2 hours to set up your personal walkthrough.');
    setShowDemoModal(false);
  };

  const faqs = [
    { q: "How does the barcode scanner work with the software?", a: "Our POS is plug-and-play with any standard USB or Bluetooth barcode scanner. Simply plug it into your laptop or tablet, click the scanning input, and items are scanned and added to the cart instantly. On mobile, you can use the built-in device camera as a high-speed scanner." },
    { q: "Can cashiers/workers use the mobile app while I use the laptop?", a: "Yes, absolutely! Our system supports real-time multi-device concurrent sync. Your workers can check out customers on their mobile phones while you oversee analytics and ledgers live on your laptop." },
    { q: "Can I run this on my laptop as well?", a: "Yes, our POS is fully web-responsive and optimized for desktops, laptops, tablets, and mobile viewports. You can open it in any web browser." },
    { q: "Is GST calculation included in bills?", a: "Yes, the POS auto-computes SGST, CGST, and IGST according to your custom default rates. Tax is itemized on prints, and you can export audit CSVs for easy GSTR filing." },
    { q: "Can I download PDF reports?", a: "Yes. Day Books, Ledgers, GST Returns summaries, P&L reports, and invoice logs can all be exported as formatted PDF tables or downloaded in CSV spreadsheet formats." },
    { q: "What happens after my subscription expires?", a: "Your billing terminal locks temporarily but your data is preserved safely on our Firestore servers. You can renew your subscription plan at any time to resume terminal access." },
    { q: "Can I upgrade or renew my plan anytime?", a: "Yes. You can upgrade, renew, or add devices to your active plan from the 'Upgrade' screen in your Owner Settings menu instantly." }
  ];

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('pos-admin') || hostname.includes('admin')) {
      if (loading) {
        return (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={{ marginTop: 12, color: 'gray', fontSize: 14 }}>Loading Business Portal...</Text>
          </View>
        );
      }
      if (!user) {
        return (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={{ marginTop: 12, color: 'gray', fontSize: 14 }}>Redirecting to Login...</Text>
          </View>
        );
      }
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: appTheme.colors.background }]}>
      {/* 1. STICKY HEADER/NAVBAR */}
      <View style={[styles.header, { backgroundColor: appTheme.colors.surface, borderBottomColor: appTheme.colors.outlineVariant }]}>
        <View style={styles.logoRow}>
          <View style={{ marginLeft: 6 }}>
            <Text style={styles.logoText}>SmartPOS</Text>
            <Text style={styles.logoSubtitle}>Billing Simplified</Text>
          </View>
        </View>

        {screenWidth > 950 && (
          <View style={styles.navLinks}>
            <TouchableOpacity onPress={() => scrollToSection('home')}><Text style={styles.navLink}>Home</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => scrollToSection('features')}><Text style={styles.navLink}>Features</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => scrollToSection('demo')}><Text style={styles.navLink}>Demo</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => scrollToSection('pricing')}><Text style={styles.navLink}>Pricing</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => scrollToSection('solutions')}><Text style={styles.navLink}>Solutions</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => scrollToSection('faq')}><Text style={styles.navLink}>FAQ</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => scrollToSection('contact')}><Text style={styles.navLink}>Contact</Text></TouchableOpacity>
          </View>
        )}

        <View style={styles.headerRight}>
          <Button 
            mode="outlined" 
            style={[styles.headerBtn, { borderColor: appTheme.colors.outline }]} 
            labelStyle={styles.btnLabel}
            onPress={() => router.push('/(auth)/login' as any)}
          >
            Login
          </Button>
          <Button 
            mode="contained" 
            
            
            style={styles.headerBtn} 
            labelStyle={styles.btnLabel}
            onPress={() => setShowSignupModal(true)}
          >
            Sign Up
          </Button>
          {screenWidth > 700 && (
            <Button 
              mode="contained-tonal" 
              
              
              style={styles.headerBtn}
              labelStyle={styles.btnLabel}
              onPress={() => setShowDemoModal(true)}
            >
              Book Demo
            </Button>
          )}
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* 2. HERO SECTION */}
        <View style={styles.heroSection} onLayout={(e) => handleLayout('home', e)}>
          <Text style={styles.heroTitle}>
            Manage Your Entire Shop with <Text style={{ color: appTheme.colors.onSurface }}>Smart POS & Inventory Software</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            Barcode billing, stock management, GST reports, worker tracking, mobile billing, and real-time analytics — all in one simple system.
          </Text>

          <View style={styles.trustChips}>
            <View style={styles.trustChip}><Icon name="checkbox-marked-circle-outline" size={16} color="#10B981" /><Text style={styles.trustChipText}>Easy to Use</Text></View>
            <View style={styles.trustChip}><Icon name="shield-check-outline" size={16} color="#10B981" /><Text style={styles.trustChipText}>Secure & Reliable</Text></View>
            <View style={styles.trustChip}><Icon name="cloud-check-outline" size={16} color="#10B981" /><Text style={styles.trustChipText}>Cloud Based</Text></View>
          </View>

          <View style={styles.heroCTAButtons}>
            <Button mode="contained" style={styles.heroBtn} contentStyle={styles.btnPadding} onPress={() => setShowSignupModal(true)}>
              Start Free Trial 
            </Button>
            <Button mode="outlined" style={[styles.heroBtn, { borderColor: appTheme.colors.outline }]} contentStyle={styles.btnPadding} onPress={() => setShowDemoModal(true)}>
              Book Live Demo
            </Button>
            <Button mode="text" style={styles.heroBtnPlay} icon="play-circle" onPress={() => setDemoVideoPlaying(true)}>
              Watch Demo
            </Button>
          </View>

          {/* HERO VISUAL MOCKUPS */}
          <View style={styles.visualContainer}>
            {/* Laptop Mockup */}
            <Card style={[styles.laptopMock, { width: screenWidth < 768 ? '100%' : '82%' }]} elevation={5}>
              <Card.Content style={styles.mockContent}>
                <View style={styles.mockHeader}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <View style={[styles.dotCircle, { backgroundColor: appTheme.colors.surface }]} />
                    <View style={[styles.dotCircle, { backgroundColor: appTheme.colors.surface }]} />
                    <View style={[styles.dotCircle, { backgroundColor: appTheme.colors.surface }]} />
                  </View>
                  <Text style={{ fontSize: 10, color: appTheme.colors.onSurface }}>app.smartpos.in/dashboard</Text>
                </View>
                <View style={{ padding: 16 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 14, color: appTheme.colors.onSurface }}>Store Analytics Dashboard</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <View style={[styles.miniCard, { backgroundColor: appTheme.colors.surface }]}>
                      <Text style={{ fontSize: 9, color: appTheme.colors.onSurface }}>Sales Today</Text>
                      <Text style={{ fontWeight: 'bold', fontSize: 12, color: appTheme.colors.onSurface }}>₹48,250.00</Text>
                    </View>
                    <View style={[styles.miniCard, { backgroundColor: appTheme.colors.surface }]}>
                      <Text style={{ fontSize: 9, color: appTheme.colors.onSurface }}>Stock Alerts</Text>
                      <Text style={{ fontWeight: 'bold', fontSize: 12, color: appTheme.colors.onSurface }}>2 Low Stock</Text>
                    </View>
                    <View style={[styles.miniCard, { backgroundColor: appTheme.colors.surface }]}>
                      <Text style={{ fontSize: 9, color: appTheme.colors.onSurface }}>Active Tills</Text>
                      <Text style={{ fontWeight: 'bold', fontSize: 12, color: appTheme.colors.onSurface }}>4 Terminals</Text>
                    </View>
                  </View>
                  {/* Graph visual representation */}
                  <View style={styles.mockGraph}>
                    <View style={[styles.graphBar, { height: 25 }]} />
                    <View style={[styles.graphBar, { height: 40 }]} />
                    <View style={[styles.graphBar, { height: 65 }]} />
                    <View style={[styles.graphBar, { height: 45 }]} />
                    <View style={[styles.graphBar, { height: 85, backgroundColor: appTheme.colors.surface }]} />
                  </View>
                </View>
              </Card.Content>
            </Card>

            {/* Mobile Mockup */}
            {screenWidth >= 580 && (
              <Card style={styles.phoneMock} elevation={5}>
              <Card.Content style={{ padding: 0 }}>
                <View style={styles.phoneNotch} />
                <View style={{ padding: 8 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 9, color: appTheme.colors.onSurface }}>MOBILE TERMINAL</Text>
                  <View style={{ borderWidth: 1, borderColor: appTheme.colors.outline, borderStyle: 'dashed', height: 55, marginTop: 6, justifyContent: 'center', alignItems: 'center', borderRadius: 4 }}>
                    <Icon name="barcode-scan" size={20} color="#10B981" />
                    <Text style={{ fontSize: 7, color: appTheme.colors.onSurface, fontWeight: 'bold', marginTop: 2 }}>Built-in Scan Camera</Text>
                  </View>
                  <Divider style={{ marginVertical: 6 }} />
                  <Text style={{ fontSize: 8, fontWeight: 'bold' }}>Cart (3 items)</Text>
                  <Text style={{ fontSize: 7, color: appTheme.colors.onSurface }}>- Cadbury Silk (₹80)</Text>
                  <Text style={{ fontSize: 7, color: appTheme.colors.onSurface }}>- Basmati Rice 1kg (₹110)</Text>
                  <Button mode="contained" style={{ marginTop: 8, height: 18 }} labelStyle={{ fontSize: 7, lineHeight: 8 }}>
                    Pay ₹190
                  </Button>
                </View>
              </Card.Content>
            </Card>
            )}
          </View>
        </View>

        {/* 3. FEATURES GRID (12 Features) */}
        <View style={styles.section} onLayout={(e) => handleLayout('features', e)}>
          <Text style={styles.sectionTitle}>Powerful Features to Grow Your Business</Text>
          <Text style={styles.sectionSubtitle}>Everything you need to automate billing, control stock, and audit store accounting in real-time.</Text>

          <View style={styles.featureGrid}>
            <FeatureCard title="Barcode Billing" icon="barcode-scan" col="#3B82F6" bg="#ECFDF5" desc="Fast billing with barcode scanner and quick search. Connect any USB/BT barcode reader." />
            <FeatureCard title="Inventory Management" icon="clipboard-list-outline" col="#10B981" bg="#ECFDF5" desc="Track stock in real-time and get live stock alerts. Track batches and expiry dates." />
            <FeatureCard title="GST Calculation" icon="calculator" col="#EF4444" bg="#FEF2F2" desc="Automatically calculate GST & generate GSTR reports. Audit-ready logs exportable in CSV." />
            <FeatureCard title="Mobile Billing" icon="cellphone" col="#8B5CF6" bg="#ECFDF5" desc="Bill from mobile anywhere, anytime. Works flawlessly on Android, iOS and Web browsers." />
            <FeatureCard title="Multi-worker Support" icon="account-group-outline" col="#F59E0B" bg="#FFFBEB" desc="Add unlimited workers & manage custom roles and access permissions securely." />
            <FeatureCard title="Subscription Management" icon="card-bulleted-settings-outline" col="#EC4899" bg="#FDF2F8" desc="Flexible plans, auto-expiry locks, and transparent billing renewal management." />
            <FeatureCard title="Sales Analytics" icon="chart-timeline-variant" col="#06B6D4" bg="#ECFEFF" desc="Detailed sales reports, MRR progress, store performance analysis, and business insights." />
            <FeatureCard title="PDF Reports" icon="file-pdf-box" col="#14B8A6" bg="#F0FDF4" desc="Download formatted PDF invoices, P&L logs, Day Books, and GST statements." />
            <FeatureCard title="Real-time Sync" icon="sync" col="#6366F1" bg="#EEF2FF" desc="All data syncs in real-time across devices. Offline capability backups billing terminals." />
            <FeatureCard title="Admin Dashboard" icon="monitor-dashboard" col="#1E293B" bg="#F8FAFC" desc="Complete super-admin overview, platform settings, customer modifiers, and broadcast alerts." />
            <FeatureCard title="Customer Management" icon="card-account-details-outline" col="#84CC16" bg="#F7FEE7" desc="Manage customer dues, balance books, purchase logs, and custom loyalty tiers." />
            <FeatureCard title="Worker Tracking" icon="clock-check-outline" col="#64748B" bg="#F1F5F9" desc="Track worker shifts, log activities, auditable check-ins, and specific cashier sales metrics." />
          </View>
        </View>

        {/* 4. HOW IT WORKS SECTION */}
        <View style={[styles.section, { backgroundColor: appTheme.colors.surface }]} onLayout={(e) => handleLayout('solutions', e)}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <Text style={styles.sectionSubtitle}>Start in minutes, grow your business faster. No complex setups needed.</Text>

          <View style={styles.stepsFlow}>
            <StepItem num="1" title="Create Account" desc="Sign up and create your shop account in seconds with basic business details." />
            <StepItem num="2" title="Choose Plan" desc="Select the best subscription plan that suits your team size and terminal seats." />
            <StepItem num="3" title="Add Products" desc="Add your products, set pricing, scan UPCs, or import stock lists via CSV." />
            <StepItem num="4" title="Start Billing" desc="Your workers start billing immediately from mobile, tablet, or laptop terminals." />
            <StepItem num="5" title="Track & Grow" desc="Track sales, stock movements, cashier performance, and PDF tax reports live." />
          </View>
        </View>

        {/* 5. SCREENSHOTS SECTION */}
        <View style={styles.section} onLayout={(e) => handleLayout('demo', e)}>
          <Text style={styles.sectionTitle}>See SmartPOS in Action</Text>
          <Text style={styles.sectionSubtitle}>Explore the premium terminal interfaces tailored for maximum speed.</Text>

          <View style={styles.screenToggleGrid}>
            <TouchableOpacity onPress={() => setActiveScreenTab('owner')} style={[styles.screenTab, activeScreenTab === 'owner' && styles.screenTabActive]}>
              <Text style={[styles.screenTabText, activeScreenTab === 'owner' && styles.screenTabActive]}>Billing Screen</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveScreenTab('inventory')} style={[styles.screenTab, activeScreenTab === 'inventory' && styles.screenTabActive]}>
              <Text style={[styles.screenTabText, activeScreenTab === 'inventory' && styles.screenTabActive]}>Inventory Management</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveScreenTab('charts')} style={[styles.screenTab, activeScreenTab === 'charts' && styles.screenTabActive]}>
              <Text style={[styles.screenTabText, activeScreenTab === 'charts' && styles.screenTabActive]}>Sales Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveScreenTab('reports')} style={[styles.screenTab, activeScreenTab === 'reports' && styles.screenTabActive]}>
              <Text style={[styles.screenTabText, activeScreenTab === 'reports' && styles.screenTabActive]}>Reports & Analytics</Text>
            </TouchableOpacity>
          </View>

          {/* Screenshot Card representation */}
          <Card style={styles.screenshotMock} elevation={4}>
            <Card.Content style={{ height: 260, justifyContent: 'center', alignItems: 'center' }}>
              <Icon 
                name={
                  activeScreenTab === 'owner' ? 'cash-register' :
                  activeScreenTab === 'inventory' ? 'package-variant-closed' :
                  activeScreenTab === 'charts' ? 'chart-bar' : 'file-chart'
                } 
                size={56} 
                color="#10B981" 
              />
              <Text variant="titleMedium" style={{ fontWeight: 'bold', marginTop: 12, color: appTheme.colors.onSurface }}>
                {
                  activeScreenTab === 'owner' ? 'Ultra-Fast POS Billing Interface' :
                  activeScreenTab === 'inventory' ? 'Advanced Stock Control & Batches' :
                  activeScreenTab === 'charts' ? 'Interactive Sales Metrics & Charts' : 'GST Audit & Ledger PDF Exporters'
                }
              </Text>
              <Text style={{ fontSize: 13, color: appTheme.colors.onSurface, marginTop: 6, textAlign: 'center', maxWidth: 500 }}>
                {
                  activeScreenTab === 'owner' ? 'Designed for quick barcode scanning, keyboard navigation, discount addition, and receipt printing in under 3 seconds.' :
                  activeScreenTab === 'inventory' ? 'Monitor stock quantities, define automated low-stock threshold points, track batch barcodes and item expiry dates.' :
                  activeScreenTab === 'charts' ? 'Live line and bar charts tracking daily income, cashier performance targets, MRR figures, and popular products.' :
                  'Generate detailed financial statements, GST filings spreadsheets, balance sheets, and cashier log sheets with standard PDF exporting.'
                }
              </Text>
            </Card.Content>
          </Card>
        </View>

        {/* 6. PRICING SECTION */}
        <View style={[styles.section, { backgroundColor: appTheme.colors.surface }]} onLayout={(e) => handleLayout('pricing', e)}>
          <Text style={styles.sectionTitle}>Choose the Perfect Plan for Your Business</Text>
          <Text style={styles.sectionSubtitle}>Simple subscription models with zero onboarding fees. Cancel or upgrade anytime.</Text>

          <View style={styles.pricingCycleToggle}>
            <TouchableOpacity onPress={() => setBillingCycle('monthly')} style={[styles.toggleBtn, billingCycle === 'monthly' && styles.toggleBtnActive]}>
              <Text style={[styles.toggleBtnText, billingCycle === 'monthly' && styles.toggleBtnActive]}>Monthly</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setBillingCycle('yearly')} style={[styles.toggleBtn, billingCycle === 'yearly' && styles.toggleBtnActive]}>
              <Text style={[styles.toggleBtnText, billingCycle === 'yearly' && styles.toggleBtnActive]}>Yearly (Save 20%)</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pricingGrid}>
            {/* Free Trial */}
            <Card style={styles.priceCard} elevation={1}>
              <Card.Content style={{ alignItems: 'center', paddingHorizontal: 16 }}>
                <Text style={styles.priceTier}>Free Trial</Text>
                <Text style={styles.priceAmount}>₹0</Text>
                <Text style={styles.priceDesc}>30 Days Free trial access</Text>
                <Divider style={styles.priceDivider} />
                <View style={styles.priceInc}><Icon name="check" color="#10B981" size={14} /><Text style={styles.priceIncText}>All Basic Features</Text></View>
                <View style={styles.priceInc}><Icon name="check" color="#10B981" size={14} /><Text style={styles.priceIncText}>Up to 100 Products</Text></View>
                <View style={styles.priceInc}><Icon name="check" color="#10B981" size={14} /><Text style={styles.priceIncText}>Basic Reports</Text></View>
                <View style={styles.priceInc}><Icon name="check" color="#10B981" size={14} /><Text style={styles.priceIncText}>Email Support</Text></View>
                <Button mode="outlined" style={[styles.priceBtn, { borderColor: appTheme.colors.outline }]} onPress={() => setShowSignupModal(true)}>
                  Start Free Trial
                </Button>
              </Card.Content>
            </Card>

            {/* Basic Plan */}
            <Card style={styles.priceCard} elevation={1}>
              <Card.Content style={{ alignItems: 'center', paddingHorizontal: 16 }}>
                <Text style={styles.priceTier}>Basic Plan</Text>
                <Text style={styles.priceAmount}>
                  {billingCycle === 'yearly' ? '₹4,999' : '₹499'}
                  <Text style={{ fontSize: 12, color: appTheme.colors.onSurface }}>/{billingCycle === 'yearly' ? 'Year' : 'Month'}</Text>
                </Text>
                <Text style={styles.priceDesc}>1 Year Plan duration</Text>
                <Divider style={styles.priceDivider} />
                <View style={styles.priceInc}><Icon name="check" color="#10B981" size={14} /><Text style={styles.priceIncText}>All Basic Features</Text></View>
                <View style={styles.priceInc}><Icon name="check" color="#10B981" size={14} /><Text style={styles.priceIncText}>Unlimited Products</Text></View>
                <View style={styles.priceInc}><Icon name="check" color="#10B981" size={14} /><Text style={styles.priceIncText}>PDF Reports</Text></View>
                <View style={styles.priceInc}><Icon name="check" color="#10B981" size={14} /><Text style={styles.priceIncText}>Priority Support</Text></View>
                <Button mode="contained" style={styles.priceBtn} onPress={handleCTA}>
                  Buy Now
                </Button>
              </Card.Content>
            </Card>

            {/* Professional Plan */}
            <Card style={[styles.priceCard, { borderColor: appTheme.colors.outline, borderWidth: 2 }]} elevation={4}>
              <View style={styles.pricePopular}><Text style={styles.pricePopularText}>POPULAR</Text></View>
              <Card.Content style={{ alignItems: 'center', paddingHorizontal: 16 }}>
                <Text style={[styles.priceTier, { color: appTheme.colors.onSurface }]}>Professional Plan</Text>
                <Text style={styles.priceAmount}>
                  {billingCycle === 'yearly' ? '₹8,999' : '₹899'}
                  <Text style={{ fontSize: 12, color: appTheme.colors.onSurface }}>/{billingCycle === 'yearly' ? '2 Yrs' : 'Month'}</Text>
                </Text>
                <Text style={styles.priceDesc}>2 Years Plan duration</Text>
                <Divider style={styles.priceDivider} />
                <View style={styles.priceInc}><Icon name="check" color="#10B981" size={14} /><Text style={styles.priceIncText}>All Basic + Premium Features</Text></View>
                <View style={styles.priceInc}><Icon name="check" color="#10B981" size={14} /><Text style={styles.priceIncText}>Advanced Reports</Text></View>
                <View style={styles.priceInc}><Icon name="check" color="#10B981" size={14} /><Text style={styles.priceIncText}>Multi-worker Support</Text></View>
                <View style={styles.priceInc}><Icon name="check" color="#10B981" size={14} /><Text style={styles.priceIncText}>Automated Cloud Backup</Text></View>
                <Button mode="contained" style={styles.priceBtn} onPress={handleCTA}>
                  Buy Now
                </Button>
              </Card.Content>
            </Card>

            {/* Enterprise Plan */}
            <Card style={styles.priceCard} elevation={1}>
              <Card.Content style={{ alignItems: 'center', paddingHorizontal: 16 }}>
                <Text style={styles.priceTier}>Enterprise Plan</Text>
                <Text style={styles.priceAmount}>
                  {billingCycle === 'yearly' ? '₹12,999' : '₹1,299'}
                  <Text style={{ fontSize: 12, color: appTheme.colors.onSurface }}>/{billingCycle === 'yearly' ? '3 Yrs' : 'Month'}</Text>
                </Text>
                <Text style={styles.priceDesc}>3 Years Plan duration</Text>
                <Divider style={styles.priceDivider} />
                <View style={styles.priceInc}><Icon name="check" color="#10B981" size={14} /><Text style={styles.priceIncText}>All Premium Features</Text></View>
                <View style={styles.priceInc}><Icon name="check" color="#10B981" size={14} /><Text style={styles.priceIncText}>Dedicated Support Agent</Text></View>
                <View style={styles.priceInc}><Icon name="check" color="#10B981" size={14} /><Text style={styles.priceIncText}>Custom Permissions Editor</Text></View>
                <View style={styles.priceInc}><Icon name="check" color="#10B981" size={14} /><Text style={styles.priceIncText}>Advanced Analytics Engine</Text></View>
                <Button mode="contained" style={styles.priceBtn} onPress={handleCTA}>
                  Buy Now
                </Button>
              </Card.Content>
            </Card>
          </View>
        </View>

        {/* 8. CTA BANNER */}
        <View style={styles.ctaBanner}>
          <Text style={styles.ctaBannerTitle}>Ready to Grow Your Business?</Text>
          <Text style={styles.ctaBannerSubtitle}>Join over 15,000+ businesses digitizing their billing terminals and ledger audits today.</Text>
          <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center' }}>
            <Button mode="contained" style={styles.ctaBannerBtn} onPress={() => setShowSignupModal(true)}>
              Start Free Trial
            </Button>
            <Button mode="outlined" style={[styles.ctaBannerBtn, { borderColor: appTheme.colors.outline }]} onPress={() => setShowDemoModal(true)}>
              Book Live Demo
            </Button>
          </View>
        </View>

        {/* 9. FAQ ACCORDION SECTION */}
        <View style={[styles.section, { backgroundColor: appTheme.colors.surface }]} onLayout={(e) => handleLayout('faq', e)}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <Text style={styles.sectionSubtitle}>Answers to common questions about setting up your terminal.</Text>

          <View style={styles.faqList}>
            {faqs.map((faq, idx) => (
              <TouchableOpacity key={idx} style={styles.faqItem} onPress={() => toggleFaq(idx)}>
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{faq.q}</Text>
                  <Icon name={expandedFaq === idx ? "chevron-up" : "chevron-down"} size={18} color="#10B981" />
                </View>
                {expandedFaq === idx && (
                  <Text style={styles.faqAnswer}>{faq.a}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 10. CONTACT SECTION */}
        <View style={styles.section} onLayout={(e) => handleLayout('contact', e)}>
          <Text style={styles.sectionTitle}>Get In Touch With Us</Text>
          <Text style={styles.sectionSubtitle}>Need assistance with barcode scanner integrations or custom GST setups? Contact our desk.</Text>

          <View style={styles.contactContainer}>
            {/* Contact details */}
            <View style={{ flex: 1, minWidth: 260, gap: 16 }}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold', color: appTheme.colors.onSurface }}>Support Desk Contacts</Text>
              
              <TouchableOpacity style={styles.contactRow} onPress={() => alert('Launching WhatsApp Support chat...')}>
                <Icon name="whatsapp" size={24} color="#25D366" />
                <View>
                  <Text style={{ fontWeight: 'bold', color: appTheme.colors.onSurface }}>WhatsApp Support</Text>
                  <Text style={{ color: appTheme.colors.onSurface, fontSize: 13 }}>+91 98765 43210 (Mon-Sat, 9AM-8PM)</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.contactRow}>
                <Icon name="phone" size={22} color="#10B981" />
                <View>
                  <Text style={{ fontWeight: 'bold', color: appTheme.colors.onSurface }}>Phone Hotlines</Text>
                  <Text style={{ color: appTheme.colors.onSurface, fontSize: 13 }}>1800 208 4050 (Toll Free)</Text>
                </View>
              </View>

              <View style={styles.contactRow}>
                <Icon name="email-outline" size={22} color="#10B981" />
                <View>
                  <Text style={{ fontWeight: 'bold', color: appTheme.colors.onSurface }}>Technical Support</Text>
                  <Text style={{ color: appTheme.colors.onSurface, fontSize: 13 }}>support@smartpos.in</Text>
                </View>
              </View>
            </View>

            {/* Contact Form */}
            <Card style={{ flex: 1.5, minWidth: 320, backgroundColor: appTheme.colors.surface, borderWidth: 1, borderColor: appTheme.colors.outline }} elevation={1}>
              <Card.Content>
                <Text style={{ fontWeight: 'bold', marginBottom: 12, color: appTheme.colors.onSurface }}>Send a Quick Message</Text>
                <TextInput label="Your Full Name" value={contactName} onChangeText={setContactName} mode="outlined" style={styles.contactInput} activeOutlineColor="#10B981" />
                <TextInput label="Email Address" value={contactEmail} onChangeText={setContactEmail} mode="outlined" style={styles.contactInput} keyboardType="email-address" activeOutlineColor="#10B981" />
                <TextInput label="Message Details" value={contactMsg} onChangeText={setContactMsg} mode="outlined" multiline numberOfLines={3} style={styles.contactInput} activeOutlineColor="#10B981" />
                <Button 
                  mode="contained" 
                  
                  onPress={() => {
                    if (!contactName || !contactEmail) { alert('Please enter your name and email.'); return; }
                    try {
                      const isWeb = Platform.OS === 'web';
                      const apiHost = isWeb ? '' : 'https://bharatpos-new.vercel.app';
                      fetch(`${apiHost}/api/send-support-email`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: contactName,
                          email: contactEmail,
                          message: contactMsg || 'No message provided',
                          type: 'support'
                        })
                      });
                    } catch (e) {
                      console.warn("Mail dispatch error:", e);
                    }
                    alert('Message received! Our customer success team will email you at ' + contactEmail + ' shortly.');
                    setContactName(''); setContactEmail(''); setContactMsg('');
                  }}
                >
                  Send Message
                </Button>
              </Card.Content>
            </Card>
          </View>
        </View>

        {/* 11. FOOTER */}
        <View style={styles.footer}>
          <View style={styles.footerContainer}>
            <View style={styles.footerCol1}>
              <View style={styles.footerLogo}>
                <Icon name="crown-outline" size={24} color="#FFFFFF" />
                <Text style={styles.footerLogoText}>SmartPOS</Text>
              </View>
              <Text style={styles.footerDesc}>High-speed retail billing terminal and live cloud inventory control system tailored for Indian shopkeepers.</Text>
              <View style={styles.socialRow}>
                <Icon name="facebook" size={20} color="#94A3B8" style={{ marginRight: 12 }} />
                <Icon name="twitter" size={20} color="#94A3B8" style={{ marginRight: 12 }} />
                <Icon name="instagram" size={20} color="#94A3B8" style={{ marginRight: 12 }} />
                <Icon name="youtube" size={20} color="#94A3B8" />
              </View>
            </View>

            <View style={styles.footerCol}>
              <Text style={styles.footerColTitle}>Product</Text>
              <Text style={styles.footerLink}>Features</Text>
              <Text style={styles.footerLink}>Pricing</Text>
              <Text style={styles.footerLink}>Demo Tour</Text>
              <Text style={styles.footerLink}>Mobile App</Text>
              <Text style={styles.footerLink}>Desktop App</Text>
            </View>

            <View style={styles.footerCol}>
              <Text style={styles.footerColTitle}>Company</Text>
              <Text style={styles.footerLink}>About Us</Text>
              <Text style={styles.footerLink}>Careers</Text>
              <Text style={styles.footerLink}>Blog</Text>
              <Text style={styles.footerLink}>Privacy Policy</Text>
              <Text style={styles.footerLink}>Terms of Service</Text>
            </View>

            <View style={styles.footerCol}>
              <Text style={styles.footerColTitle}>Support</Text>
              <Text style={styles.footerLink}>Help Center</Text>
              <Text style={styles.footerLink}>Contact Us</Text>
              <Text style={styles.footerLink}>WhatsApp Desk</Text>
              <Text style={styles.footerLink}>System Status</Text>
              <Text style={styles.footerLink}>Docs & Guides</Text>
            </View>
          </View>
          
          <Divider style={{ backgroundColor: appTheme.colors.surface, width: '100%', marginVertical: 20 }} />
          
          <Text style={styles.footerCopy}>© 2026 SmartPOS. All rights reserved. Designed for Indian Businesses.</Text>
        </View>

      </ScrollView>

      {/* ---------------------------------------------------------
          MODALS & DIALOGS
          --------------------------------------------------------- */}

      {/* 1. SIGNUP MODAL */}
      <Portal>
        <Dialog visible={showSignupModal} onDismiss={() => setShowSignupModal(false)} style={styles.dialogStyle}>
          <Dialog.Title style={{ color: appTheme.colors.onSurface, fontWeight: 'bold' }}>Start Your 30-Day Free Trial</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 12, color: appTheme.colors.onSurface, marginBottom: 12 }}>
                Get instant access to POS billing, stock management, double-entry accounting ledgers, and barcode generation. No credit card required.
              </Text>
              <TextInput label="Full Name" value={fullName} onChangeText={setFullName} mode="outlined" style={styles.formInput} activeOutlineColor="#10B981" />
              <TextInput label="Shop Name" value={shopName} onChangeText={setShopName} mode="outlined" style={styles.formInput} activeOutlineColor="#10B981" />
              <TextInput label="Mobile Number" value={mobileNumber} onChangeText={setMobileNumber} mode="outlined" style={styles.formInput} keyboardType="phone-pad" activeOutlineColor="#10B981" />
              <TextInput label="Email Address" value={email} onChangeText={setEmail} mode="outlined" style={styles.formInput} keyboardType="email-address" activeOutlineColor="#10B981" />
              <TextInput label="Password" value={password} onChangeText={setPassword} secureTextEntry mode="outlined" style={styles.formInput} activeOutlineColor="#10B981" />
              
              <TextInput 
                label="Business Category" 
                value={businessType} 
                onChangeText={setBusinessType} 
                mode="outlined" 
                style={styles.formInput} 
                placeholder="e.g. Grocery, Garments, Electronics" 
                activeOutlineColor="#10B981" 
              />

              <Text style={{ fontWeight: 'bold', color: appTheme.colors.onSurface, fontSize: 13 }}>Tax Setup</Text>
              <SegmentedButtons
                value={gstType}
                onValueChange={setGstType}
                buttons={[
                  { value: 'GST', label: 'GST Registered' },
                  { value: 'NON-GST', label: 'Non-GST Business' }
                ]}
                style={{ marginTop: 8, marginBottom: 12 }}
              />

              <Text style={{ fontWeight: 'bold', color: appTheme.colors.onSurface, fontSize: 13 }}>Shop Operation Mode</Text>
              <SegmentedButtons
                value={operationMode}
                onValueChange={setOperationMode}
                buttons={[
                  { value: 'Mobile Only', label: 'Mobile Only' },
                  { value: 'Laptop + Mobile', label: 'Laptop + Mobile' },
                  { value: 'Large Shop', label: 'Large Shop' }
                ]}
                style={{ marginTop: 8, marginBottom: 8 }}
              />
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions style={{ justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 }}>
            <Button 
              mode="outlined" 
              
              style={{ borderColor: appTheme.colors.outline, marginRight: 'auto' }} 
              onPress={() => {
                setFullName('Rohan Sharma');
                setShopName('Sharma Supermart');
                setMobileNumber('9876543210');
                const randSuffix = Math.floor(100 + Math.random() * 900);
                setEmail(`rohan.${randSuffix}@sharmamart.com`);
                setPassword('sharma123');
                setBusinessType('Grocery');
                setGstType('GST');
                setOperationMode('Laptop + Mobile');
              }}
            >
              Autofill Demo
            </Button>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button onPress={() => setShowSignupModal(false)}>Cancel</Button>
              <Button mode="contained" onPress={handleSignUpSubmit}>
                Create Trial Account
              </Button>
            </View>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 2. DEMO BOOKING MODAL */}
      <Portal>
        <Dialog visible={showDemoModal} onDismiss={() => setShowDemoModal(false)} style={styles.dialogStyle}>
          <Dialog.Title style={{ color: appTheme.colors.onSurface, fontWeight: 'bold' }}>Book A Personal Demo Walkthrough</Dialog.Title>
          <Dialog.Content>
            <Text style={{ fontSize: 12, color: appTheme.colors.onSurface, marginBottom: 12 }}>
              Schedule a 1-on-1 video call walkthrough with our POS experts. We will show you barcode scanner integration, ledger auditing, and GSTR-3B filings.
            </Text>
            <TextInput label="Your Full Name" mode="outlined" style={styles.formInput} activeOutlineColor="#10B981" />
            <TextInput label="Mobile Number" mode="outlined" style={styles.formInput} keyboardType="phone-pad" activeOutlineColor="#10B981" />
            <TextInput label="Date Preference" placeholder="YYYY-MM-DD" mode="outlined" style={styles.formInput} activeOutlineColor="#10B981" />
            <TextInput label="Time Slot Preference" placeholder="e.g. 11:30 AM" mode="outlined" style={styles.formInput} activeOutlineColor="#10B981" />
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
            <Button onPress={() => setShowDemoModal(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleDemoBooking}>
              Schedule Demo Call
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 3. VIDEO DEMO MODAL */}
      <Portal>
        <Dialog visible={demoVideoPlaying} onDismiss={() => setDemoVideoPlaying(false)} style={styles.dialogStyle}>
          <Dialog.Title style={{ color: appTheme.colors.onSurface, fontWeight: 'bold' }}>SmartPOS Walkthrough Video</Dialog.Title>
          <Dialog.Content style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Icon name="play-circle-outline" size={72} color="#10B981" />
            <Text style={{ fontWeight: 'bold', marginTop: 16, color: appTheme.colors.onSurface }}>Simulated Product Demonstration</Text>
            <Text style={{ fontSize: 12, color: appTheme.colors.onSurface, textAlign: 'center', marginTop: 6, maxWidth: 320 }}>
              Playing overview video... barcode integrations, invoice scanning, cashier shift logs setup, and financial Day Book walkthroughs.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
            <Button onPress={() => setDemoVideoPlaying(false)}>Close Player</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

// ---------------------------------------------------------
// REUSABLE SUB-COMPONENTS
// ---------------------------------------------------------
const FeatureCard = ({ title, icon, col, bg, desc }: any) => (
  <Card style={styles.featureCard} elevation={1}>
    <Card.Content>
      <View style={[styles.featureIconWrap, { backgroundColor: bg }]}>
        <Icon name={icon} size={22} color={col} />
      </View>
      <Text style={styles.featureHeader}>{title}</Text>
      <Text style={styles.featureText}>{desc}</Text>
    </Card.Content>
  </Card>
);

const StepItem = ({ num, title, desc }: any) => (
  <View style={styles.stepItem}>
    <View style={styles.stepBadge}><Text style={styles.stepNumText}>{num}</Text></View>
    <Text style={styles.stepTitle}>{title}</Text>
    <Text style={styles.stepDesc}>{desc}</Text>
  </View>
);

// STYLES
const styles = StyleSheet.create({
  container: { flex: 1, },
  scroll: { flex: 1 },
  header: {
    height: 68,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    ...Platform.select({
      web: { position: 'sticky', top: 0, zIndex: 1000 } as any,
      default: {}
    })
  },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logoText: { fontWeight: '800', fontSize: 16, lineHeight: 18 },
  logoSubtitle: { fontSize: 9, fontWeight: '600', marginTop: -2 },
  navLinks: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  navLink: { fontSize: 13, fontWeight: '600', transitionProperty: 'color', transitionDuration: '0.2s' } as any,
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: { borderRadius: 8 },
  btnLabel: { fontSize: 12, fontWeight: 'bold' },

  // Hero Section
  heroSection: {
    paddingTop: 50,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 20
  },
  heroBadgeText: { fontSize: 11, fontWeight: 'bold' },
  heroTitle: {
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 44,
    marginBottom: 16,
    maxWidth: 850
  },
  heroSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 680,
    marginBottom: 20
  },
  trustChips: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 28,
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  trustChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    },
  trustChipText: { fontSize: 11, fontWeight: 'bold', },
  heroCTAButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 16
  },
  heroBtn: {
    borderRadius: 8,
    minWidth: 160,
  },
  heroBtnPlay: {
    minWidth: 120,
  },
  btnPadding: { paddingVertical: 8 },

  // Visual mockups
  visualContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 40,
    width: '100%',
    position: 'relative',
    height: 290,
    maxWidth: 750
  },
  laptopMock: {
    width: '82%',
    height: 260,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden'
  },
  mockContent: { padding: 0 },
  mockHeader: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  dotCircle: { width: 6, height: 6, borderRadius: 3 },
  miniCard: { flex: 1, padding: 8, borderRadius: 6, alignItems: 'center' },
  mockGraph: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
    height: 75,
    marginTop: 14,
    paddingHorizontal: 20
  },
  graphBar: { flex: 1, borderRadius: 4, height: 10 },
  phoneMock: {
    width: 145,
    height: 210,
    position: 'absolute',
    bottom: -15,
    right: -5,
    borderRadius: 16,
    borderWidth: 4,
    overflow: 'hidden',
    zIndex: 10
  },
  phoneNotch: {
    height: 10,
    width: 55,
    alignSelf: 'center',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 40,
    paddingVertical: 32,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    width: '100%',
    alignSelf: 'center'
  },
  statBox: { alignItems: 'center', minWidth: 150 },
  statNumber: { fontSize: 30, fontWeight: '900', },
  statLabel: { fontSize: 11, fontWeight: 'bold', marginTop: 4 },

  // Sections
  section: { paddingVertical: 56, paddingHorizontal: 24, alignItems: 'center', width: '100%' },
  sectionTitle: { fontSize: 26, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  sectionSubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 44, maxWidth: 580, lineHeight: 20 },

  // Feature Grid
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 1100
  },
  featureCard: {
    width: 250,
    borderRadius: 10,
    borderWidth: 1,
    },
  featureIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  featureHeader: { fontWeight: 'bold', fontSize: 14, marginBottom: 6 },
  featureText: { fontSize: 12, lineHeight: 18 },

  // Steps Flow
  stepsFlow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, justifyContent: 'center', width: '100%', maxWidth: 1000 },
  stepItem: { flex: 1, minWidth: 170, alignItems: 'center', padding: 8 },
  stepBadge: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  stepNumText: { fontWeight: 'bold', fontSize: 14 },
  stepTitle: { fontWeight: 'bold', fontSize: 14, marginBottom: 6, },
  stepDesc: { fontSize: 12, textAlign: 'center', lineHeight: 18 },

  // Screenshots Tabs
  screenToggleGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 24, maxWidth: 800 },
  screenTab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, },
  screenTabActive: { },
  screenTabText: { fontSize: 12, fontWeight: 'bold' },
  screenTabTextActive: { },
  screenshotMock: { width: '100%', maxWidth: 800, borderRadius: 12, borderWidth: 1, },

  // Pricing
  pricingCycleToggle: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 3,
    marginBottom: 32,
    width: 200,
    justifyContent: 'center'
  },
  toggleBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 18 },
  toggleBtnActive: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  toggleBtnText: { fontSize: 11, fontWeight: 'bold', },
  toggleBtnTextActive: { },

  pricingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, justifyContent: 'center', width: '100%', maxWidth: 1050 },
  priceCard: { width: 235, borderRadius: 12, paddingVertical: 16, position: 'relative', overflow: 'hidden', borderWidth: 1, },
  pricePopular: { position: 'absolute', top: 10, right: -32, paddingVertical: 4, paddingHorizontal: 32, transform: [{ rotate: '45deg' }] },
  pricePopularText: { fontWeight: 'bold', fontSize: 8, letterSpacing: 0.5 },
  priceTier: { fontSize: 15, fontWeight: 'bold', },
  priceAmount: { fontSize: 32, fontWeight: '800', marginVertical: 8 },
  priceDesc: { fontSize: 11, },
  priceDivider: { width: '90%', marginVertical: 14, },
  priceInc: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, marginBottom: 8 },
  priceIncText: { fontSize: 11, flex: 1 },
  priceBtn: { width: '90%', marginTop: 12, borderRadius: 8 },

  // Testimonials
  testGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, justifyContent: 'center', width: '100%', maxWidth: 950 },
  testCard: { width: 290, borderRadius: 12, borderWidth: 1, },
  testText: { fontSize: 12, fontStyle: 'italic', lineHeight: 18, marginTop: 6 },

  // CTA Banner
  ctaBanner: {
    width: '100%',
    paddingVertical: 56,
    paddingHorizontal: 24,
    alignItems: 'center',
    textAlign: 'center'
  },
  ctaBannerTitle: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  ctaBannerSubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 28, maxWidth: 550 },
  ctaBannerBtn: { borderRadius: 8, minWidth: 150 },

  // FAQs
  faqList: { width: '100%', maxWidth: 720, gap: 4 },
  faqItem: { borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 14 },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { fontWeight: 'bold', fontSize: 14, flex: 0.95 },
  faqAnswer: { fontSize: 13, marginTop: 8, lineHeight: 18 },

  // Contact section
  contactContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, width: '100%', maxWidth: 850, marginTop: 12 },
  contactRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  contactInput: { marginBottom: 12, },

  // Footer
  footer: { paddingVertical: 48, paddingHorizontal: 24, alignItems: 'center', width: '100%' },
  footerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 32, justifyContent: 'space-between', width: '100%', maxWidth: 1000 },
  footerCol1: { width: 280, gap: 12 },
  footerLogo: { flexDirection: 'row', alignItems: 'center' },
  footerLogoText: { fontWeight: '800', fontSize: 16, marginLeft: 6 },
  footerDesc: { fontSize: 12, lineHeight: 18 },
  socialRow: { flexDirection: 'row', marginTop: 8 },
  footerCol: { width: 140, gap: 8 },
  footerColTitle: { fontWeight: 'bold', fontSize: 13, marginBottom: 4 },
  footerLink: { fontSize: 12, transitionProperty: 'color', transitionDuration: '0.2s' } as any,
  footerCopy: { fontSize: 11, textAlign: 'center', marginTop: 8 },

  // Form layouts
  formInput: { marginBottom: 8 },
  dialogStyle: { borderRadius: 12, }
});
