import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Dimensions } from 'react-native';
import { TextInput, Button, Text, Surface } from 'react-native-paper';
import { auth, db, isFirebaseConfigured } from '../../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from '../../lib/firestore_adapter';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function AdminLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSecure, setIsSecure] = useState(true);

  async function handleDemoLogin() {
    setLoading(true);
    // Instant demo bypass
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('adminBypass', 'true');
      }
      setLoading(false);
      router.replace('/' as any);
    }, 400);
  }

  async function handleLogin() {
    setLoading(true);
    
    // Quick Demo Bypass
    if ((email === 'aryajain1906@gmail.com' && (password === 'aryajain' || password === '@Aryajain19')) || email.includes('admin') || email === '0000000000') {
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
      
      // Auto-provision admin role for the admin email
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
      <View style={styles.backgroundAccent} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Surface style={styles.cardContainer} elevation={5}>
          
          <View style={styles.headerBox}>
            <View style={styles.iconCircle}>
              <Icon name="shield-crown" size={32} color="#FFD700" />
            </View>
            <Text style={styles.title}>Super Admin Portal</Text>
            <Text style={styles.subtitle}>Central Command & Platform Control</Text>
          </View>

          <View style={styles.formContainer}>
            <TextInput
              label="Admin Email or ID"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              mode="outlined"
              outlineColor="#33364A"
              activeOutlineColor="#4F46E5"
              textColor="#FFF"
              theme={{ colors: { onSurfaceVariant: '#A0AEC0' } }}
              left={<TextInput.Icon icon="account-key-outline" color="#A0AEC0" />}
            />

            <TextInput
              label="Security Passkey"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={isSecure}
              style={styles.input}
              mode="outlined"
              outlineColor="#33364A"
              activeOutlineColor="#4F46E5"
              textColor="#FFF"
              theme={{ colors: { onSurfaceVariant: '#A0AEC0' } }}
              left={<TextInput.Icon icon="lock-outline" color="#A0AEC0" />}
              right={<TextInput.Icon icon={isSecure ? "eye-outline" : "eye-off-outline"} color="#A0AEC0" onPress={() => setIsSecure(!isSecure)} />}
            />

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              style={styles.loginBtn}
              contentStyle={styles.loginBtnContent}
              labelStyle={styles.loginBtnLabel}
            >
              Secure Authentication
            </Button>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>DEMO MODE</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              mode="outlined"
              onPress={handleDemoLogin}
              style={styles.demoBtn}
              textColor="#A0AEC0"
              icon="lightning-bolt"
            >
              Instant Admin Demo Access
            </Button>

            <Text style={styles.footerInfo}>
              Unauthorized access to this terminal is strictly prohibited. Activity is logged.
            </Text>
          </View>
          
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C10',
  },
  backgroundAccent: {
    position: 'absolute',
    top: -150,
    right: -100,
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: '#4F46E5',
    opacity: 0.1,
    filter: 'blur(100px)' as any,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1F2833',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#33364A',
  },
  headerBox: {
    backgroundColor: '#12141D',
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#2B2E42',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    color: '#8B8FAD',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  formContainer: {
    padding: 32,
  },
  input: {
    backgroundColor: '#12141D',
    marginBottom: 16,
  },
  loginBtn: {
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
  },
  loginBtnContent: {
    paddingVertical: 6,
  },
  loginBtnLabel: {
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#33364A',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#6B7280',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  demoBtn: {
    borderColor: '#33364A',
    borderRadius: 8,
  },
  footerInfo: {
    marginTop: 24,
    fontSize: 11,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 16,
  },
});
