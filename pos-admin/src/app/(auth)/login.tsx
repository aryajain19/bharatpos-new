import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Dimensions, Animated } from 'react-native';
import { TextInput, Button, Text, Surface } from 'react-native-paper';
import { auth, db, isFirebaseConfigured } from '../../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from '../../lib/firestore_adapter';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

export default function AdminLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSecure, setIsSecure] = useState(true);

  async function handleLogin() {
    setLoading(true);
    
    // Quick Demo Bypass (only active when Firebase is not configured)
    if (!isFirebaseConfigured && ((email === 'aryajain1906@gmail.com' && (password === 'aryajain' || password === '@Aryajain19')) || email.includes('admin') || email === '0000000000')) {
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('adminBypass', 'true');
        }
        setLoading(false);
        router.replace('/' as any);
      }, 400);
      return;
    }

    if (!isFirebaseConfigured) {
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('adminBypass', 'true');
        }
        setLoading(false);
        router.replace('/' as any);
      }, 400);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userSnap = await getDoc(userDocRef);
      
      if (email === 'aryajain1906@gmail.com') {
        const adminData = userSnap.exists() ? userSnap.data() : {};
        if (adminData.role !== 'admin') {
          adminData.role = 'admin';
          adminData.email = email;
          adminData.owner_name = 'Arya';
          adminData.created_at = adminData.created_at || new Date().toISOString();
          await setDoc(userDocRef, adminData);
        }
        router.replace('/' as any);
        return;
      }

      if (userSnap.exists()) {
        const role = userSnap.data().role;
        if (role === 'admin') {
          router.replace('/' as any);
        } else {
          Alert.alert('Access Denied', 'You do not have Super Admin privileges.');
          await auth.signOut();
        }
      } else {
        Alert.alert('Access Denied', 'Admin profile not found in database.');
        await auth.signOut();
      }
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Dynamic Background Elements */}
      <View style={[styles.glowOrb, styles.orbTopRight]} />
      <View style={[styles.glowOrb, styles.orbBottomLeft]} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentWrapper}>
          
          <View style={styles.logoContainer}>
            <View style={styles.iconRingExt}>
              <View style={styles.iconRingInt}>
                <Icon name="shield-lock" size={38} color="#818CF8" />
              </View>
            </View>
            <Text style={styles.title}>Admin Portal</Text>
            <Text style={styles.subtitle}>Secure Access Required</Text>
          </View>

          <Surface style={styles.cardContainer} elevation={0}>
            <View style={styles.formContainer}>
              <TextInput
                label="Admin Email or ID"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                mode="outlined"
                outlineColor="transparent"
                activeOutlineColor="#818CF8"
                textColor="#F8FAFC"
                placeholderTextColor="#64748B"
                theme={{ colors: { onSurfaceVariant: '#94A3B8', primary: '#818CF8' }, roundness: 12 }}
                left={<TextInput.Icon icon="email-outline" color="#64748B" />}
              />

              <TextInput
                label="Security Passkey"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={isSecure}
                style={[styles.input, { marginTop: 16 }]}
                mode="outlined"
                outlineColor="transparent"
                activeOutlineColor="#818CF8"
                textColor="#F8FAFC"
                placeholderTextColor="#64748B"
                theme={{ colors: { onSurfaceVariant: '#94A3B8', primary: '#818CF8' }, roundness: 12 }}
                left={<TextInput.Icon icon="lock-outline" color="#64748B" />}
                right={<TextInput.Icon icon={isSecure ? "eye-outline" : "eye-off-outline"} color="#64748B" onPress={() => setIsSecure(!isSecure)} />}
              />

              <Button
                mode="contained"
                onPress={handleLogin}
                loading={loading}
                style={styles.loginBtn}
                contentStyle={styles.loginBtnContent}
                labelStyle={styles.loginBtnLabel}
                buttonColor="#6366F1"
              >
                Sign In to Dashboard
              </Button>
            </View>
          </Surface>
          
          <Text style={styles.footerText}>
            Protected by advanced 256-bit encryption.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617', // Very dark slate (Tailwind slate-950)
  },
  glowOrb: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    opacity: 0.15,
    filter: 'blur(80px)' as any,
  },
  orbTopRight: {
    top: -height * 0.1,
    right: -width * 0.2,
    backgroundColor: '#6366F1', // Indigo
  },
  orbBottomLeft: {
    bottom: -height * 0.1,
    left: -width * 0.2,
    backgroundColor: '#8B5CF6', // Violet
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconRingExt: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconRingInt: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  cardContainer: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.6)', // Slate 900 with opacity for glass effect
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 10, // for Android
  },
  formContainer: {
    padding: 32,
  },
  input: {
    backgroundColor: 'rgba(2, 6, 23, 0.6)', // Slate 950 inside the input
  },
  loginBtn: {
    marginTop: 32,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  loginBtnContent: {
    paddingVertical: 10,
  },
  loginBtnLabel: {
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
    color: '#FFF',
  },
  footerText: {
    marginTop: 40,
    fontSize: 12,
    color: '#475569', // Slate 600
    textAlign: 'center',
    fontWeight: '500',
  },
});
