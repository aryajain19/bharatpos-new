import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, useWindowDimensions, ActivityIndicator } from 'react-native';
import { Text, useTheme, Button, Surface, TextInput, Checkbox } from 'react-native-paper';
import { auth, db, isFirebaseConfigured } from '../../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from '../../lib/firestore_adapter';
import { useAppTheme } from '../../providers/ThemeProvider';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function LoginScreen() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = isMounted && Platform.OS === 'web' && screenWidth > 992;

  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isSecure, setIsSecure] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setLoadingMessage('Verifying credentials...');
    setErrorMsg('');

    if (!isFirebaseConfigured) {
      setErrorMsg('Firebase is not configured. Please contact the administrator.');
      setLoading(false);
      return;
    }

    try {
      const email = mobile.includes('@') ? mobile : `${mobile}@pos.com`;
      const finalPassword = password || 'defaultpassword';
      
      const userCredential = await signInWithEmailAndPassword(auth, email, finalPassword);
      
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const dbPromise = getDoc(userDocRef);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('firestore-timeout')), 4000));
      
      let userSnap: any;
      try {
        userSnap = await Promise.race([dbPromise, timeoutPromise]);
      } catch (dbErr: any) {
        if (dbErr.code === 'permission-denied' || dbErr.message?.includes('PERMISSION_DENIED')) {
          console.warn("Database rules denied read access. Bypassing to owner dashboard.");
        } else if (dbErr.message === 'firestore-timeout') {
          console.warn("Database connection timed out. Bypassing to owner dashboard.");
        }
      }
      
      if (userSnap && userSnap.exists && userSnap.exists()) {
        const role = userSnap.data().role;
        if (role === 'admin') {
          setErrorMsg('Access Denied: Super Admins must log in through the dedicated Admin Portal (Port 8082).');
          await auth.signOut();
        } else if (role === 'owner') {
          router.replace('/(owner)' as any);
        } else {
          router.replace('/(vendor)/(tabs)' as any);
        }
      } else {
        router.replace('/(owner)' as any);
      }
    } catch (error: any) {
      let errorMessage = error.message;
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email or mobile number.';
      }
      setErrorMsg(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  const renderLoginForm = () => (
    <View style={styles.formWrapper}>
      {/* Brand Header */}
      <View style={styles.brandHeader}>
        <View style={styles.logoIconBg}>
          <Icon name="store" size={16} color="#FFFFFF" />
        </View>
        <Text style={styles.brandTitle}>SmartPOS</Text>
      </View>

      <Text style={styles.welcomeTitle}>Welcome Back</Text>
      <Text style={styles.welcomeSubtitle}>Sign in to access your SmartPOS account</Text>

      {/* Main Form Fields */}
      <View style={styles.fieldsContainer}>
        <Text style={styles.inputLabel}>Email or Mobile Number</Text>
        <TextInput
          value={mobile}
          onChangeText={setMobile}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="e.g. owner@shop.com"
          style={styles.input}
          mode="outlined"
          outlineColor="#E2E8F0"
          activeOutlineColor="#16A34A"
          left={<TextInput.Icon icon="account-outline" color="#64748B" />}
          dense
        />

        <Text style={styles.inputLabel}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry={isSecure}
          placeholder="Enter your password"
          style={styles.input}
          mode="outlined"
          outlineColor="#E2E8F0"
          activeOutlineColor="#16A34A"
          left={<TextInput.Icon icon="lock-outline" color="#64748B" />}
          right={<TextInput.Icon icon={isSecure ? "eye-outline" : "eye-off-outline"} color="#64748B" onPress={() => setIsSecure(!isSecure)} />}
          dense
        />

        {/* Remember me & Forgot Password */}
        <View style={styles.rememberForgotRow}>
          <TouchableOpacity 
            style={styles.rememberMeClick} 
            activeOpacity={0.8}
            onPress={() => setRememberMe(!rememberMe)}
          >
            <Checkbox.Android 
              status={rememberMe ? 'checked' : 'unchecked'} 
              color="#16A34A"
              onPress={() => setRememberMe(!rememberMe)}
            />
            <Text style={styles.rememberMeText}>Remember me</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => alert('Launching password reset helper...')}>
            <Text style={styles.forgotPassLink}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <Button
          mode="contained"
          onPress={handleLogin}
          loading={loading}
          disabled={loading}
          style={styles.primaryButton}
          contentStyle={styles.buttonPadding}
          labelStyle={styles.buttonLabel}
          buttonColor="#0B192C"
        >
          {loading ? 'Logging in...' : 'Login to Dashboard'}
        </Button>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google sign-in */}
        <Button
          mode="outlined"
          icon={() => <Icon name="google" size={18} color="#EA4335" />}
          style={styles.googleButton}
          labelStyle={styles.googleBtnLabel}
          onPress={() => alert('Starting Google OAuth sign-in...')}
        >
          Sign in with Google
        </Button>
      </View>

      {/* Register Promo Footer */}
      <View style={styles.registerFooter}>
        <Text style={styles.registerDescText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/signup' as any)}>
          <Text style={styles.registerLinkText}>Create Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.splitWrapper}>
        {/* LEFT PANEL: Branding & Highlights */}
        {isDesktop && (
          <View style={styles.leftBanner}>
            <View style={styles.bannerContent}>
              {/* Brand Logo Row */}
              <View style={styles.bannerBrandRow}>
                <View style={[styles.logoIconBg, { width: 32, height: 32, borderRadius: 8 }]}>
                  <Icon name="store" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.bannerBrandName}>SmartPOS</Text>
              </View>

              {/* Slogan */}
              <Text style={styles.bannerSlogan}>
                Manage Your Store{"\n"}Anywhere
              </Text>
              <Text style={styles.bannerSubTitle}>
                The complete cloud POS & inventory solution for modern Indian retailers.
              </Text>

              {/* Highlights list */}
              <View style={styles.highlightsList}>
                <View style={styles.highlightRow}>
                  <View style={styles.highlightIconWrap}>
                    <Icon name="flash-outline" size={16} color="#16A34A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.highlightTitle}>Lightning Fast Billing</Text>
                    <Text style={styles.highlightText}>Create bills in seconds with barcode scanning and quick product search.</Text>
                  </View>
                </View>

                <View style={styles.highlightRow}>
                  <View style={styles.highlightIconWrap}>
                    <Icon name="clipboard-list-outline" size={16} color="#16A34A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.highlightTitle}>Real-time Inventory</Text>
                    <Text style={styles.highlightText}>Track stock, get low stock alerts and manage multiple locations.</Text>
                  </View>
                </View>

                <View style={styles.highlightRow}>
                  <View style={styles.highlightIconWrap}>
                    <Icon name="file-document-outline" size={16} color="#16A34A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.highlightTitle}>GST Invoicing & Reports</Text>
                    <Text style={styles.highlightText}>Generate GST invoices, GSTR reports and downloadable ledgers.</Text>
                  </View>
                </View>

                <View style={styles.highlightRow}>
                  <View style={styles.highlightIconWrap}>
                    <Icon name="account-group-outline" size={16} color="#16A34A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.highlightTitle}>Staff & Customer Management</Text>
                    <Text style={styles.highlightText}>Manage staff access, customers, due payments and loyalty points.</Text>
                  </View>
                </View>
              </View>

              {/* Trust badge */}
              <View style={styles.bannerTrustBadge}>
                <Icon name="shield-check" size={16} color="#16A34A" />
                <Text style={styles.bannerTrustText}>Trusted by 15,000+ businesses across India</Text>
              </View>
            </View>
          </View>
        )}

        {/* RIGHT PANEL: Form Container */}
        <View style={[styles.rightPanel, { width: isDesktop ? '50%' : '100%' }]}>
          {isDesktop ? (
            <Surface style={styles.cardContainer} elevation={0}>
              {renderLoginForm()}
            </Surface>
          ) : (
            <ScrollView contentContainerStyle={styles.mobileScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.mobileFormContainer}>
                {renderLoginForm()}
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <Surface style={styles.loadingBox} elevation={5}>
            <ActivityIndicator size="large" color="#16A34A" style={{ marginBottom: 16 }} />
            <Text style={styles.loadingText}>{loadingMessage || 'Authenticating account...'}</Text>
          </Surface>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF',
    height: '100%',
    maxHeight: '100%',
    overflow: 'hidden'
  },
  splitWrapper: { 
    flex: 1, 
    flexDirection: 'row',
    height: '100%'
  },
  
  // Left Banner (Desktop)
  leftBanner: {
    width: '50%',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    paddingHorizontal: '7%',
    paddingVertical: 20,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0'
  },
  bannerContent: { 
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%'
  },
  bannerBrandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 8 },
  bannerBrandName: { fontSize: 18, fontWeight: '800', color: '#0F172A', fontFamily: 'Plus Jakarta Sans' },
  bannerSlogan: { fontSize: 26, lineHeight: 32, marginBottom: 6, fontWeight: '800', color: '#0F172A', fontFamily: 'Plus Jakarta Sans' },
  bannerSubTitle: { fontSize: 12.5, color: '#64748B', lineHeight: 18, marginBottom: 20, fontFamily: 'Plus Jakarta Sans' },
  highlightsList: { gap: 12 },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  highlightIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1
  },
  highlightTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 2, fontFamily: 'Plus Jakarta Sans' },
  highlightText: { fontSize: 11.5, color: '#475569', lineHeight: 16, fontFamily: 'Plus Jakarta Sans' },
  bannerTrustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#E8F5E9',
    alignSelf: 'flex-start',
    marginTop: 20
  },
  bannerTrustText: { fontSize: 11, fontWeight: '700', color: '#16A34A', fontFamily: 'Plus Jakarta Sans' },

  // Right Panel
  rightPanel: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: '5%'
  },
  cardContainer: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF'
  },
  mobileScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24
  },
  mobileFormContainer: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 20,
  },
  formWrapper: { width: '100%' },

  // Brand Header
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    ...Platform.select({
      web: { display: 'flex' },
      default: { display: 'none' }
    })
  },
  logoIconBg: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center'
  },
  brandTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', fontFamily: 'Plus Jakarta Sans' },
  welcomeTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 2, fontFamily: 'Plus Jakarta Sans' },
  welcomeSubtitle: { fontSize: 12.5, color: '#64748B', marginBottom: 18, fontFamily: 'Plus Jakarta Sans' },

  // Input Fields
  fieldsContainer: { width: '100%' },
  inputLabel: { fontSize: 11.5, fontWeight: '700', color: '#374151', marginBottom: 4, fontFamily: 'Plus Jakarta Sans' },
  input: { marginBottom: 12, backgroundColor: '#FFFFFF', height: 42, fontSize: 13 },

  rememberForgotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  rememberMeClick: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -8
  },
  rememberMeText: { fontSize: 11.5, color: '#475569', fontWeight: '500', fontFamily: 'Plus Jakarta Sans' },
  forgotPassLink: { fontSize: 11.5, fontWeight: '700', color: '#2563EB', fontFamily: 'Plus Jakarta Sans' },
  errorText: { color: '#EF4444', marginBottom: 10, fontSize: 11.5, fontWeight: '500', fontFamily: 'Plus Jakarta Sans' },

  primaryButton: { borderRadius: 6, marginVertical: 6 },
  buttonPadding: { paddingVertical: 4 },
  buttonLabel: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Plus Jakarta Sans' },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { marginHorizontal: 10, fontSize: 9.5, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Plus Jakarta Sans' },

  // Google button
  googleButton: { borderRadius: 6, borderColor: '#E2E8F0', height: 38, justifyContent: 'center' },
  googleBtnLabel: { fontSize: 11.5, fontWeight: '600', color: '#374151', fontFamily: 'Plus Jakarta Sans' },

  // Footer Register Link
  registerFooter: { flexDirection: 'row', justifyContent: 'center', marginTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  registerDescText: { fontSize: 12, color: '#475569', fontFamily: 'Plus Jakarta Sans' },
  registerLinkText: { fontWeight: '700', fontSize: 12, color: '#16A34A', fontFamily: 'Plus Jakarta Sans' },

  // Loading Overlay
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingBox: {
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    width: 260,
    backgroundColor: '#FFFFFF'
  },
  loadingText: { fontSize: 11.5, fontWeight: '700', color: '#475569', textAlign: 'center', fontFamily: 'Plus Jakarta Sans' },
});
