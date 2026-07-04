import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, useWindowDimensions, ActivityIndicator } from 'react-native';
import { Text, useTheme, Button, Surface, TextInput } from 'react-native-paper';
import { auth, db } from '../../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from '../../lib/firestore_adapter';
import { useAppTheme } from '../../providers/ThemeProvider';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function SignupScreen() {
  const { isDarkMode } = useAppTheme();
  const appTheme = useTheme();

  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && screenWidth > 992;

  // Step state simulation (1 = form, 2 = success page)
  const [currentStep, setCurrentStep] = useState(1);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [shopName, setShopName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [taxSetup, setTaxSetup] = useState('GST'); // 'GST' or 'NON-GST'
  const [operationMode, setOperationMode] = useState('Laptop + Mobile'); // 'Mobile Only' | 'Laptop + Mobile' | 'Large Shop'

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSignUpSubmit = async () => {
    setErrorMsg('');
    if (!fullName || !shopName || !mobileNumber || !email || !password || !confirmPassword) {
      setErrorMsg('Please fill in all the required fields.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Save details to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        role: 'owner',
        subscription_plan: 'free_trial',
        subscription_start_date: new Date(),
        subscription_end_date: new Date(new Date().setDate(new Date().getDate() + 30)),
        storeName: shopName,
        isGSTRegistered: taxSetup === 'GST',
        shopMode: operationMode,
        businessCategory: businessCategory || 'General Store',
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
        window.localStorage.setItem('isGstRegistered', String(taxSetup === 'GST'));
        window.localStorage.setItem('shopMode', operationMode);
        window.localStorage.setItem('businessCategory', businessCategory || 'General Store');
      }

      // Instead of instant redirect, show the Success Screen!
      setCurrentStep(2);
    } catch (error: any) {
      let message = error.message;
      if (error.code === 'auth/email-already-in-use') {
        message = 'This email address is already in use.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password must be at least 6 characters.';
      }
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleAutofillDemo = () => {
    setFullName('Rohan Sharma');
    setShopName('Sharma Supermart');
    setMobileNumber('9876543210');
    const randSuffix = Math.floor(100 + Math.random() * 900);
    setEmail(`rohan.${randSuffix}@sharmamart.com`);
    setPassword('sharma123');
    setConfirmPassword('sharma123');
    setBusinessCategory('Grocery');
    setTaxSetup('GST');
    setOperationMode('Laptop + Mobile');
  };

  const renderSignupForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.formTitle}>Start Your 30-Day Free Trial</Text>
      <Text style={styles.formSub}>Get instant access to all features. No credit card required.</Text>

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      <View style={styles.formGrid}>
        {/* Row 1 */}
        <View style={[styles.formRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
          <View style={styles.fieldBox}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              style={styles.input}
              mode="outlined"
              outlineColor="#E2E8F0"
              activeOutlineColor="#16A34A"
              dense
            />
          </View>
          <View style={styles.fieldBox}>
            <Text style={styles.inputLabel}>Shop / Business Name</Text>
            <TextInput
              value={shopName}
              onChangeText={setShopName}
              placeholder="Enter shop name"
              style={styles.input}
              mode="outlined"
              outlineColor="#E2E8F0"
              activeOutlineColor="#16A34A"
              dense
            />
          </View>
        </View>

        {/* Row 2 */}
        <View style={[styles.formRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
          <View style={styles.fieldBox}>
            <Text style={styles.inputLabel}>Mobile Number</Text>
            <View style={styles.phoneInputRow}>
              <View style={styles.countryCodeBox}>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>
              <TextInput
                value={mobileNumber}
                onChangeText={setMobileNumber}
                placeholder="Enter mobile number"
                keyboardType="phone-pad"
                style={[styles.input, { flex: 1 }]}
                mode="outlined"
                outlineColor="#E2E8F0"
                activeOutlineColor="#16A34A"
                dense
              />
            </View>
          </View>
          <View style={styles.fieldBox}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email address"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              mode="outlined"
              outlineColor="#E2E8F0"
              activeOutlineColor="#16A34A"
              dense
            />
          </View>
        </View>

        {/* Row 3 */}
        <View style={[styles.formRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
          <View style={styles.fieldBox}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Create a strong password"
              style={styles.input}
              mode="outlined"
              outlineColor="#E2E8F0"
              activeOutlineColor="#16A34A"
              dense
            />
          </View>
          <View style={styles.fieldBox}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="Confirm your password"
              style={styles.input}
              mode="outlined"
              outlineColor="#E2E8F0"
              activeOutlineColor="#16A34A"
              dense
            />
          </View>
        </View>

        {/* Category Dropdown */}
        <View style={styles.fieldBox}>
          <Text style={styles.inputLabel}>Business Category</Text>
          <TextInput
            value={businessCategory}
            onChangeText={setBusinessCategory}
            placeholder="Grocery, Garments, Electronics, General..."
            style={styles.input}
            mode="outlined"
            outlineColor="#E2E8F0"
            activeOutlineColor="#16A34A"
            dense
          />
        </View>

        {/* Tax Setup */}
        <Text style={styles.inputLabel}>Tax Setup</Text>
        <View style={[styles.cardGridRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
          <TouchableOpacity 
            style={[styles.taxCard, taxSetup === 'GST' && styles.selectedCard]}
            onPress={() => setTaxSetup('GST')}
            activeOpacity={0.9}
          >
            <Icon name={taxSetup === 'GST' ? "check-circle" : "checkbox-blank-circle-outline"} size={18} color={taxSetup === 'GST' ? "#16A34A" : "#94A3B8"} style={{ marginBottom: 4 }} />
            <Text style={styles.cardBtnTitle}>GST Registered</Text>
            <Text style={styles.cardBtnDesc}>My business is registered under GST</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.taxCard, taxSetup === 'NON-GST' && styles.selectedCard]}
            onPress={() => setTaxSetup('NON-GST')}
            activeOpacity={0.9}
          >
            <Icon name={taxSetup === 'NON-GST' ? "check-circle" : "checkbox-blank-circle-outline"} size={18} color={taxSetup === 'NON-GST' ? "#16A34A" : "#94A3B8"} style={{ marginBottom: 4 }} />
            <Text style={styles.cardBtnTitle}>Non-GST Business</Text>
            <Text style={styles.cardBtnDesc}>My business is not registered under GST</Text>
          </TouchableOpacity>
        </View>

        {/* Shop Operation Mode */}
        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Shop Operation Mode</Text>
        <View style={[styles.cardGridRow, { flexDirection: isDesktop ? 'row' : 'column', gap: 10 }]}>
          <TouchableOpacity 
            style={[styles.modeCard, operationMode === 'Mobile Only' && styles.selectedCard]}
            onPress={() => setOperationMode('Mobile Only')}
            activeOpacity={0.9}
          >
            <Icon name="cellphone" size={18} color={operationMode === 'Mobile Only' ? "#16A34A" : "#64748B"} style={{ marginBottom: 4 }} />
            <Text style={styles.cardBtnTitle}>Mobile Only</Text>
            <Text style={styles.cardBtnDesc}>I will use the app on mobile only</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.modeCard, operationMode === 'Laptop + Mobile' && styles.selectedCard]}
            onPress={() => setOperationMode('Laptop + Mobile')}
            activeOpacity={0.9}
          >
            <Icon name="laptop" size={18} color={operationMode === 'Laptop + Mobile' ? "#16A34A" : "#64748B"} style={{ marginBottom: 4 }} />
            <Text style={styles.cardBtnTitle}>Laptop + Mobile</Text>
            <Text style={styles.cardBtnDesc}>I will use both laptop and mobile</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.modeCard, operationMode === 'Large Shop' && styles.selectedCard]}
            onPress={() => setOperationMode('Large Shop')}
            activeOpacity={0.9}
          >
            <Icon name="storefront-outline" size={18} color={operationMode === 'Large Shop' ? "#16A34A" : "#64748B"} style={{ marginBottom: 4 }} />
            <Text style={styles.cardBtnTitle}>Large Shop</Text>
            <Text style={styles.cardBtnDesc}>I have multiple counters / devices</Text>
          </TouchableOpacity>
        </View>

        {/* CTA Buttons */}
        <View style={styles.actionsBox}>
          <Button 
            mode="outlined" 
            style={styles.autofillBtn}
            labelStyle={{ color: '#475569', fontSize: 11 }}
            onPress={handleAutofillDemo}
          >
            Autofill Demo
          </Button>

          <Button
            mode="contained"
            onPress={handleSignUpSubmit}
            loading={loading}
            disabled={loading}
            style={styles.submitBtn}
            contentStyle={{ paddingVertical: 4 }}
            labelStyle={{ fontWeight: 'bold' }}
            buttonColor="#0B192C"
            icon="arrow-right"
          >
            Create Free Account
          </Button>
        </View>
      </View>
    </View>
  );

  const renderSuccessPage = () => (
    <View style={styles.successWrapper}>
      {/* Top Header Row */}
      <View style={styles.successTopbar}>
        <View style={styles.logoRow}>
          <View style={styles.logoIconBg}>
            <Icon name="store" size={16} color="#FFFFFF" />
          </View>
          <Text style={styles.logoText}>SmartPOS</Text>
        </View>
        <Button 
          mode="outlined" 
          style={styles.headerBtnOutline}
          labelStyle={styles.btnLabelOutline}
          onPress={() => router.replace('/(owner)' as any)}
        >
          Go to Dashboard
        </Button>
      </View>

      <View style={styles.successMain}>
        <View style={styles.checkCircleBg}>
          <Icon name="check" size={48} color="#FFFFFF" />
        </View>
        
        <Text style={styles.successTitle}>Your Free Trial is Ready!</Text>
        <Text style={styles.successSub}>
          Welcome to SmartPOS family. Your account has been created successfully.{"\n"}Here's what you can do next:
        </Text>

        {/* Steps Grid */}
        <View style={[styles.successStepsRow, { flexDirection: isDesktop ? 'row' : 'column' }]}>
          <View style={styles.successStepCard}>
            <View style={styles.stepCircle}><Text style={styles.stepCircleText}>1</Text></View>
            <Text style={styles.stepHeader}>Verify Your Email</Text>
            <Text style={styles.stepDesc}>We've sent a verification link to your email address.</Text>
            <TouchableOpacity style={styles.stepLinkBtn} onPress={() => alert('Verification email resent!')}>
              <Text style={styles.stepLinkText}>Resend Email</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.successStepCard}>
            <View style={styles.stepCircle}><Text style={styles.stepCircleText}>2</Text></View>
            <Text style={styles.stepHeader}>Add Your Products</Text>
            <Text style={styles.stepDesc}>Import or add your products and set your inventory.</Text>
            <TouchableOpacity style={styles.stepLinkBtn} onPress={() => router.push('/(owner)/products_management' as any)}>
              <Text style={styles.stepLinkText}>Add Products</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.successStepCard}>
            <View style={styles.stepCircle}><Text style={styles.stepCircleText}>3</Text></View>
            <Text style={styles.stepHeader}>Start Billing</Text>
            <Text style={styles.stepDesc}>Create your first bill and grow your business.</Text>
            <TouchableOpacity style={styles.stepLinkBtn} onPress={() => router.push('/(owner)/pos_billing' as any)}>
              <Text style={styles.stepLinkText}>Create Bill</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.successActions}>
          <Button 
            mode="contained" 
            buttonColor="#0B192C" 
            style={styles.openDashboardBtn} 
            contentStyle={{ paddingVertical: 6 }} 
            labelStyle={{ fontWeight: 'bold' }} 
            icon="arrow-right"
            onPress={() => router.replace('/(owner)' as any)}
          >
            Open Dashboard
          </Button>

          <Button 
            mode="outlined" 
            style={styles.tutorialBtn} 
            contentStyle={{ paddingVertical: 6 }} 
            labelStyle={{ color: '#374151', fontWeight: 'bold' }} 
            icon="play-circle-outline"
            onPress={() => alert('Launching Quick Walkthrough Tutorial video player...')}
          >
            Watch Quick Tutorial
          </Button>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {currentStep === 2 ? (
          renderSuccessPage()
        ) : (
          <View style={[styles.splitWrapper, { flexDirection: isDesktop ? 'row' : 'column' }]}>
            {/* Left Tracker Panel (Desktop) */}
            {isDesktop && (
              <View style={styles.leftBanner}>
                <Text style={styles.bannerTitle}>Create Your Account</Text>
                
                <View style={styles.stepsTracker}>
                  <View style={styles.trackerRow}>
                    <View style={styles.trackerActiveBullet}>
                      <Icon name="check" size={14} color="#FFFFFF" />
                    </View>
                    <View>
                      <Text style={styles.trackerTitle}>Business Details</Text>
                      <Text style={styles.trackerDesc}>Tell us about your business</Text>
                    </View>
                  </View>

                  <View style={styles.trackerRow}>
                    <View style={styles.trackerBullet}><Text style={styles.trackerBulletText}>2</Text></View>
                    <View>
                      <Text style={[styles.trackerTitle, { color: '#64748B' }]}>Verification</Text>
                      <Text style={styles.trackerDesc}>Verify your email & phone</Text>
                    </View>
                  </View>

                  <View style={styles.trackerRow}>
                    <View style={styles.trackerBullet}><Text style={styles.trackerBulletText}>3</Text></View>
                    <View>
                      <Text style={[styles.trackerTitle, { color: '#64748B' }]}>Get Started</Text>
                      <Text style={styles.trackerDesc}>Set up your store</Text>
                    </View>
                  </View>
                </View>

                {/* Free trial badge */}
                <View style={styles.noCardBadge}>
                  <Icon name="credit-card-off-outline" size={18} color="#16A34A" />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={styles.noCardTitle}>No credit card required</Text>
                    <Text style={styles.noCardDescText}>Full access. Cancel anytime.</Text>
                  </View>
                </View>

                {/* Footer Login Promo */}
                <View style={styles.leftPromoFooter}>
                  <Text style={styles.promoText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => router.push('/login' as any)}>
                    <Text style={styles.promoLink}>Login</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.trackerRow, { marginTop: 12 }]}>
                  <Icon name="clock-outline" size={14} color="#64748B" />
                  <Text style={{ fontSize: 11, color: '#64748B', marginLeft: 4, fontFamily: 'Plus Jakarta Sans' }}>Setup takes less than 2 minutes</Text>
                </View>
              </View>
            )}

            {/* Right Form Panel */}
            <View style={[styles.rightPanel, { width: isDesktop ? '65%' : '100%', paddingVertical: isDesktop ? 40 : 20 }]}>
              {isDesktop ? (
                <Surface style={styles.formSurface} elevation={0}>
                  {renderSignupForm()}
                </Surface>
              ) : (
                <View style={styles.mobileFormContainer}>
                  {renderSignupForm()}
                  
                  {/* Mobile Back-to-login link */}
                  <View style={[styles.leftPromoFooter, { marginTop: 24, alignSelf: 'center' }]}>
                    <Text style={styles.promoText}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => router.push('/login' as any)}>
                      <Text style={styles.promoLink}>Login</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { flexGrow: 1 },
  splitWrapper: { flex: 1 },
  
  // Left Steps Tracker Panel
  leftBanner: {
    width: '35%',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 40,
    paddingVertical: 60,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB'
  },
  bannerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 40, fontFamily: 'Plus Jakarta Sans' },
  stepsTracker: { gap: 24, marginBottom: 50 },
  trackerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trackerActiveBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center'
  },
  trackerBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  trackerBulletText: { fontSize: 11, fontWeight: '700', color: '#64748B', fontFamily: 'Plus Jakarta Sans' },
  trackerTitle: { fontSize: 13, fontWeight: '700', color: '#16A34A', fontFamily: 'Plus Jakarta Sans' },
  trackerDesc: { fontSize: 11, color: '#64748B', fontFamily: 'Plus Jakarta Sans' },
  
  noCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    backgroundColor: '#F0FDF4',
    marginBottom: 40
  },
  noCardTitle: { fontSize: 11, fontWeight: '700', color: '#16A34A', fontFamily: 'Plus Jakarta Sans' },
  noCardDescText: { fontSize: 10, color: '#64748B', fontFamily: 'Plus Jakarta Sans' },
  leftPromoFooter: { flexDirection: 'row', marginTop: 12 },
  promoText: { fontSize: 12, color: '#475569', fontFamily: 'Plus Jakarta Sans' },
  promoLink: { fontSize: 12, fontWeight: '700', color: '#2563EB', fontFamily: 'Plus Jakarta Sans' },

  // Right Form Panel
  rightPanel: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  formSurface: {
    width: '100%',
    maxWidth: 680,
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF'
  },
  mobileFormContainer: {
    width: '100%',
    maxWidth: 480,
    paddingHorizontal: 20
  },
  formContainer: { width: '100%' },
  formTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 4, fontFamily: 'Plus Jakarta Sans' },
  formSub: { fontSize: 13, color: '#64748B', marginBottom: 28, fontFamily: 'Plus Jakarta Sans' },
  
  formGrid: { gap: 14 },
  formRow: { gap: 12 },
  fieldBox: { flex: 1 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#374151', marginBottom: 6, fontFamily: 'Plus Jakarta Sans' },
  input: { backgroundColor: '#FFFFFF', height: 40 },
  phoneInputRow: { flexDirection: 'row', gap: 6 },
  countryCodeBox: {
    width: 50,
    height: 40,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginTop: 6
  },
  countryCodeText: { fontSize: 12, color: '#334155', fontWeight: '700', fontFamily: 'Plus Jakarta Sans' },

  // Setup Cards (Tax Setup & Operation Mode)
  cardGridRow: { gap: 12 },
  taxCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'flex-start'
  },
  modeCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    padding: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'flex-start'
  },
  selectedCard: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4'
  },
  cardBtnTitle: { fontSize: 12, fontWeight: '700', color: '#0F172A', marginBottom: 2, fontFamily: 'Plus Jakarta Sans' },
  cardBtnDesc: { fontSize: 10, color: '#64748B', lineHeight: 14, fontFamily: 'Plus Jakarta Sans' },

  actionsBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20
  },
  autofillBtn: { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  submitBtn: { borderRadius: 6, width: 200 },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '500', marginBottom: 12, fontFamily: 'Plus Jakarta Sans' },

  // Success view layouts
  successWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingBottom: 60
  },
  successTopbar: {
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoIconBg: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center'
  },
  logoText: { fontSize: 15, fontWeight: '800', color: '#0F172A', fontFamily: 'Plus Jakarta Sans' },
  headerBtnOutline: { borderRadius: 6, borderColor: '#D1D5DB', height: 36, justifyContent: 'center' },
  btnLabelOutline: { fontSize: 12, color: '#374151', fontFamily: 'Plus Jakarta Sans' },

  successMain: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 24
  },
  checkCircleBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    // Pulse-like shadow simulated
    ...Platform.select({
      web: { boxShadow: '0 0 0 10px rgba(22, 163, 74, 0.1)' } as any,
      default: {}
    })
  },
  successTitle: { fontSize: 32, fontWeight: '800', color: '#0F172A', marginBottom: 8, fontFamily: 'Plus Jakarta Sans' },
  successSub: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 22, marginBottom: 40, fontFamily: 'Plus Jakarta Sans' },

  successStepsRow: {
    gap: 16,
    width: '100%',
    maxWidth: 960,
    justifyContent: 'center',
    marginBottom: 40
  },
  successStepCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    alignItems: 'center',
    minWidth: 260
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  stepCircleText: { fontSize: 11, fontWeight: '800', color: '#16A34A', fontFamily: 'Plus Jakarta Sans' },
  stepHeader: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 6, fontFamily: 'Plus Jakarta Sans' },
  stepDesc: { fontSize: 12, color: '#64748B', textAlign: 'center', lineHeight: 18, marginBottom: 14, fontFamily: 'Plus Jakarta Sans' },
  stepLinkBtn: { padding: 4 },
  stepLinkText: { fontSize: 12, fontWeight: '700', color: '#2563EB', fontFamily: 'Plus Jakarta Sans' },

  successActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center'
  },
  openDashboardBtn: { borderRadius: 6, width: 180 },
  tutorialBtn: { borderRadius: 6, borderColor: '#D1D5DB', width: 220 }
});
