import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Dimensions, TouchableOpacity, Text as RNText } from 'react-native';
import { TextInput, Button, Text, Surface } from 'react-native-paper';
import { Link, router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

export default function SignupScreen() {
  const [formData, setFormData] = useState({
    fullName: '',
    shopName: '',
    mobile: '',
    email: '',
    password: '',
    confirmPassword: '',
    category: '',
    taxSetup: 'gst', // 'gst' | 'non-gst'
    operationMode: 'laptop-mobile' // 'mobile' | 'laptop-mobile' | 'large'
  });

  const [loading, setLoading] = useState(false);
  const [isSecure, setIsSecure] = useState(true);
  const [isSecureConfirm, setIsSecureConfirm] = useState(true);

  const handleSignup = async () => {
    setLoading(true);
    // TODO: Connect to your backend /api/create-owner or Firebase
    setTimeout(() => {
      setLoading(false);
      router.push('/(auth)/success' as any);
    }, 1000);
  };

  const updateForm = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const StepIndicator = ({ step, title, desc, active = false }: { step: string, title: string, desc: string, active?: boolean }) => (
    <View style={styles.stepItem}>
      <View style={[styles.stepCircle, active ? styles.stepCircleActive : styles.stepCircleInactive]}>
        <Text style={[styles.stepNumber, active ? styles.stepNumberActive : styles.stepNumberInactive]}>{step}</Text>
      </View>
      <View>
        <Text style={[styles.stepTitle, active ? styles.stepTitleActive : styles.stepTitleInactive]}>{title}</Text>
        <Text style={styles.stepDesc}>{desc}</Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.splitLayout}>
          
          {/* Left Panel: Stepper & Info */}
          <View style={styles.leftPanel}>
            <Text style={styles.leftTitle}>Create Your Account</Text>
            
            <View style={styles.stepperContainer}>
              <StepIndicator step="1" title="Business Details" desc="Tell us about your business" active={true} />
              <View style={styles.stepLine} />
              <StepIndicator step="2" title="Verification" desc="Verify your email & phone" active={false} />
              <View style={styles.stepLine} />
              <StepIndicator step="3" title="Get Started" desc="Set up your store" active={false} />
            </View>

            <View style={{ flex: 1 }} />

            <View style={styles.guaranteeBox}>
              <Icon name="shield-check" size={24} color="#10B981" />
              <View style={styles.guaranteeTextCont}>
                <Text style={styles.guaranteeTitle}>No credit card required</Text>
                <Text style={styles.guaranteeDesc}>Full access. Cancel anytime.</Text>
              </View>
            </View>

            <View style={styles.loginLinkRow}>
              <Text style={styles.hasAccountText}>Already have an account? </Text>
              <Link href="/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.loginLink}>Login</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>

          {/* Right Panel: Form */}
          <View style={styles.rightPanel}>
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Start Your 30-Day Free Trial</Text>
              <Text style={styles.formSubtitle}>Get instant access to all features. No credit card required.</Text>

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    mode="outlined"
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChangeText={(val) => updateForm('fullName', val)}
                    style={styles.input}
                    theme={inputTheme}
                    outlineColor="#E2E8F0"
                    activeOutlineColor="#10B981"
                  />
                </View>
                <View style={styles.colSpace} />
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Shop / Business Name</Text>
                  <TextInput
                    mode="outlined"
                    placeholder="Enter shop name"
                    value={formData.shopName}
                    onChangeText={(val) => updateForm('shopName', val)}
                    style={styles.input}
                    theme={inputTheme}
                    outlineColor="#E2E8F0"
                    activeOutlineColor="#10B981"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Mobile Number</Text>
                  <View style={styles.phoneInputRow}>
                    <View style={styles.countryCode}>
                      <Text style={styles.countryCodeText}>+91</Text>
                      <Icon name="chevron-down" size={16} color="#64748B" />
                    </View>
                    <TextInput
                      mode="outlined"
                      placeholder="Enter mobile number"
                      value={formData.mobile}
                      onChangeText={(val) => updateForm('mobile', val)}
                      style={[styles.input, { flex: 1 }]}
                      theme={inputTheme}
                      outlineColor="#E2E8F0"
                      activeOutlineColor="#10B981"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
                <View style={styles.colSpace} />
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput
                    mode="outlined"
                    placeholder="Enter email address"
                    value={formData.email}
                    onChangeText={(val) => updateForm('email', val)}
                    style={styles.input}
                    theme={inputTheme}
                    outlineColor="#E2E8F0"
                    activeOutlineColor="#10B981"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <TextInput
                    mode="outlined"
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChangeText={(val) => updateForm('password', val)}
                    secureTextEntry={isSecure}
                    style={styles.input}
                    theme={inputTheme}
                    outlineColor="#E2E8F0"
                    activeOutlineColor="#10B981"
                    right={<TextInput.Icon icon={isSecure ? "eye-outline" : "eye-off-outline"} onPress={() => setIsSecure(!isSecure)} color="#94A3B8" />}
                  />
                </View>
                <View style={styles.colSpace} />
                <View style={styles.col}>
                  <Text style={styles.inputLabel}>Confirm Password</Text>
                  <TextInput
                    mode="outlined"
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChangeText={(val) => updateForm('confirmPassword', val)}
                    secureTextEntry={isSecureConfirm}
                    style={styles.input}
                    theme={inputTheme}
                    outlineColor="#E2E8F0"
                    activeOutlineColor="#10B981"
                    right={<TextInput.Icon icon={isSecureConfirm ? "eye-outline" : "eye-off-outline"} onPress={() => setIsSecureConfirm(!isSecureConfirm)} color="#94A3B8" />}
                  />
                </View>
              </View>

              <View style={styles.fullRow}>
                <Text style={styles.inputLabel}>Business Category</Text>
                <TextInput
                  mode="outlined"
                  placeholder="Select category"
                  value={formData.category}
                  onChangeText={(val) => updateForm('category', val)}
                  style={styles.input}
                  theme={inputTheme}
                  outlineColor="#E2E8F0"
                  activeOutlineColor="#10B981"
                  right={<TextInput.Icon icon="chevron-down" color="#94A3B8" />}
                />
              </View>

              <View style={styles.fullRow}>
                <Text style={styles.inputLabel}>Tax Setup</Text>
                <View style={styles.cardRow}>
                  <TouchableOpacity 
                    style={[styles.taxCard, formData.taxSetup === 'gst' && styles.taxCardActive]}
                    onPress={() => updateForm('taxSetup', 'gst')}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.iconBox, formData.taxSetup === 'gst' ? styles.iconBoxActive : {}]}>
                      <Icon name="file-document-outline" size={20} color={formData.taxSetup === 'gst' ? '#10B981' : '#94A3B8'} />
                    </View>
                    <View style={styles.cardTextCont}>
                      <Text style={styles.cardTitle}>GST Registered</Text>
                      <Text style={styles.cardDesc}>My business is registered under GST</Text>
                    </View>
                  </TouchableOpacity>
                  
                  <View style={{ width: 16 }} />

                  <TouchableOpacity 
                    style={[styles.taxCard, formData.taxSetup === 'non-gst' && styles.taxCardActive]}
                    onPress={() => updateForm('taxSetup', 'non-gst')}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.iconBox, formData.taxSetup === 'non-gst' ? styles.iconBoxActive : {}]}>
                      <Icon name="file-document-remove-outline" size={20} color={formData.taxSetup === 'non-gst' ? '#10B981' : '#94A3B8'} />
                    </View>
                    <View style={styles.cardTextCont}>
                      <Text style={styles.cardTitle}>Non-GST Business</Text>
                      <Text style={styles.cardDesc}>My business is not registered under GST</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fullRow}>
                <Text style={styles.inputLabel}>Shop Operation Mode</Text>
                <View style={styles.cardRow}>
                  <TouchableOpacity 
                    style={[styles.modeCard, formData.operationMode === 'mobile' && styles.taxCardActive]}
                    onPress={() => updateForm('operationMode', 'mobile')}
                    activeOpacity={0.8}
                  >
                    <Icon name="cellphone" size={24} color={formData.operationMode === 'mobile' ? '#10B981' : '#94A3B8'} style={{ marginBottom: 8 }} />
                    <Text style={styles.modeTitle}>Mobile Only</Text>
                    <Text style={styles.modeDesc}>I will use the app on mobile only</Text>
                  </TouchableOpacity>
                  
                  <View style={{ width: 16 }} />

                  <TouchableOpacity 
                    style={[styles.modeCard, formData.operationMode === 'laptop-mobile' && styles.taxCardActive]}
                    onPress={() => updateForm('operationMode', 'laptop-mobile')}
                    activeOpacity={0.8}
                  >
                    <Icon name="laptop-account" size={24} color={formData.operationMode === 'laptop-mobile' ? '#10B981' : '#94A3B8'} style={{ marginBottom: 8 }} />
                    <Text style={styles.modeTitle}>Laptop + Mobile</Text>
                    <Text style={styles.modeDesc}>I will use both laptop and mobile</Text>
                  </TouchableOpacity>

                  <View style={{ width: 16 }} />

                  <TouchableOpacity 
                    style={[styles.modeCard, formData.operationMode === 'large' && styles.taxCardActive]}
                    onPress={() => updateForm('operationMode', 'large')}
                    activeOpacity={0.8}
                  >
                    <Icon name="storefront-outline" size={24} color={formData.operationMode === 'large' ? '#10B981' : '#94A3B8'} style={{ marginBottom: 8 }} />
                    <Text style={styles.modeTitle}>Large Shop</Text>
                    <Text style={styles.modeDesc}>I have multiple counters / devices</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Footer Actions */}
              <View style={styles.footerActions}>
                <View style={styles.timeBox}>
                  <Icon name="clock-outline" size={16} color="#64748B" />
                  <Text style={styles.timeText}>Setup takes less than 2 minutes</Text>
                </View>

                <Button
                  mode="contained"
                  onPress={handleSignup}
                  loading={loading}
                  style={styles.submitBtn}
                  contentStyle={[styles.btnContent, { flexDirection: 'row-reverse' }]}
                  labelStyle={styles.btnLabel}
                  buttonColor="#1E293B"
                  icon="arrow-right"
                >
                  Create Free Account
                </Button>
              </View>

            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const inputTheme = { roundness: 8, colors: { background: '#FFFFFF' } };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  splitLayout: {
    flex: 1,
    flexDirection: width > 900 ? 'row' : 'column',
  },
  leftPanel: {
    width: width > 900 ? 320 : '100%',
    backgroundColor: '#FFFFFF',
    padding: 40,
    borderRightWidth: width > 900 ? 1 : 0,
    borderRightColor: '#E2E8F0',
    borderBottomWidth: width > 900 ? 0 : 1,
    borderBottomColor: '#E2E8F0',
  },
  leftTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 40,
  },
  stepperContainer: {
    marginBottom: 40,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    marginTop: 2,
  },
  stepCircleActive: {
    backgroundColor: '#10B981',
  },
  stepCircleInactive: {
    backgroundColor: '#F1F5F9',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepNumberInactive: {
    color: '#94A3B8',
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  stepTitleActive: {
    color: '#10B981',
  },
  stepTitleInactive: {
    color: '#475569',
  },
  stepDesc: {
    fontSize: 13,
    color: '#64748B',
  },
  stepLine: {
    width: 2,
    height: 40,
    backgroundColor: '#F1F5F9',
    marginLeft: 13,
    marginVertical: 4,
  },
  guaranteeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 8,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  guaranteeTextCont: {
    marginLeft: 12,
  },
  guaranteeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  guaranteeDesc: {
    fontSize: 12,
    color: '#64748B',
  },
  loginLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hasAccountText: {
    fontSize: 14,
    color: '#64748B',
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3B82F6',
  },
  rightPanel: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: width > 900 ? 60 : 20,
    alignItems: 'center',
  },
  formContainer: {
    width: '100%',
    maxWidth: 700,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 15,
    color: '#475569',
    marginBottom: 40,
  },
  row: {
    flexDirection: width > 700 ? 'row' : 'column',
    marginBottom: 24,
  },
  col: {
    flex: 1,
  },
  colSpace: {
    width: 24,
    height: 24, // for mobile spacing
  },
  fullRow: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    height: 48,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    marginRight: 8,
    backgroundColor: '#F8FAFC',
    marginTop: 6, // to align with TextInput which has built in top padding for label
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    marginRight: 4,
  },
  cardRow: {
    flexDirection: width > 700 ? 'row' : 'column',
  },
  taxCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginBottom: width > 700 ? 0 : 16,
  },
  taxCardActive: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconBoxActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#A7F3D0',
  },
  cardTextCont: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  modeCard: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginBottom: width > 700 ? 0 : 16,
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  modeDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  footerActions: {
    flexDirection: width > 600 ? 'row' : 'column-reverse',
    justifyContent: 'space-between',
    alignItems: width > 600 ? 'center' : 'stretch',
    marginTop: 20,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: width > 600 ? 0 : 20,
    justifyContent: width > 600 ? 'flex-start' : 'center',
  },
  timeText: {
    fontSize: 13,
    color: '#64748B',
    marginLeft: 6,
  },
  submitBtn: {
    borderRadius: 8,
  },
  btnContent: {
    height: 48,
    paddingHorizontal: 24,
  },
  btnLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
