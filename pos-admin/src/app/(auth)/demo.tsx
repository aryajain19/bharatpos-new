import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Dimensions, TouchableOpacity, Image } from 'react-native';
import { TextInput, Button, Text, Surface } from 'react-native-paper';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

export default function BookDemoScreen() {
  const [formData, setFormData] = useState({
    fullName: '',
    mobile: '',
    businessType: '',
    date: '',
    time: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);

  const handleBookDemo = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // For now just go back or show alert
      alert('Demo request submitted successfully!');
      router.back();
    }, 1000);
  };

  const updateForm = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.cardContainer}>
          <View style={styles.splitLayout}>
            
            {/* Left Panel: Illustration & Copy */}
            <View style={styles.leftPanel}>
              
              <View style={styles.illustrationCont}>
                <Image source={require('../../../assets/demo_illustration.png')} style={styles.illustration} resizeMode="contain" />
              </View>

              <View style={styles.quoteBox}>
                <Icon name="format-quote-open" size={32} color="#10B981" style={styles.quoteIcon} />
                <Text style={styles.quoteTitle}>See how SmartPOS can simplify your billing and grow your business.</Text>
                <Text style={styles.quoteDesc}>Our experts will walk you through everything.</Text>
              </View>

              <View style={styles.benefitsRow}>
                <View style={styles.benefitItem}>
                  <View style={styles.benefitIconBox}>
                     <Icon name="monitor-dashboard" size={16} color="#10B981" />
                  </View>
                  <Text style={styles.benefitText}>Live Product Demo</Text>
                </View>
                <View style={styles.benefitItem}>
                  <View style={styles.benefitIconBox}>
                     <Icon name="chat-question-outline" size={16} color="#10B981" />
                  </View>
                  <Text style={styles.benefitText}>All Your Questions</Text>
                </View>
                <View style={styles.benefitItem}>
                  <View style={styles.benefitIconBox}>
                     <Icon name="check-decagram-outline" size={16} color="#10B981" />
                  </View>
                  <Text style={styles.benefitText}>No Commitment</Text>
                </View>
              </View>

            </View>

            {/* Right Panel: Booking Form */}
            <View style={styles.rightPanel}>
              <View style={styles.formContainer}>
                <Text style={styles.formTitle}>Book A Personal Demo</Text>
                <Text style={styles.formSubtitle}>Schedule a 1-on-1 demo with our POS experts.</Text>

                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <TextInput
                      mode="outlined"
                      placeholder="Enter your name"
                      value={formData.fullName}
                      onChangeText={(val) => updateForm('fullName', val)}
                      style={styles.input}
                      theme={inputTheme}
                      outlineColor="#E2E8F0"
                      activeOutlineColor="#1E293B"
                    />
                  </View>
                  <View style={styles.colSpace} />
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
                        activeOutlineColor="#1E293B"
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.fullRow}>
                  <Text style={styles.inputLabel}>Business Type</Text>
                  <TextInput
                    mode="outlined"
                    placeholder="Select business type"
                    value={formData.businessType}
                    onChangeText={(val) => updateForm('businessType', val)}
                    style={styles.input}
                    theme={inputTheme}
                    outlineColor="#E2E8F0"
                    activeOutlineColor="#1E293B"
                    right={<TextInput.Icon icon="chevron-down" color="#94A3B8" />}
                  />
                </View>

                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={styles.inputLabel}>Preferred Date</Text>
                    <TextInput
                      mode="outlined"
                      placeholder="Select date"
                      value={formData.date}
                      onChangeText={(val) => updateForm('date', val)}
                      style={styles.input}
                      theme={inputTheme}
                      outlineColor="#E2E8F0"
                      activeOutlineColor="#1E293B"
                      left={<TextInput.Icon icon="calendar-blank-outline" color="#94A3B8" />}
                    />
                  </View>
                  <View style={styles.colSpace} />
                  <View style={styles.col}>
                    <Text style={styles.inputLabel}>Preferred Time</Text>
                    <TextInput
                      mode="outlined"
                      placeholder="Select time"
                      value={formData.time}
                      onChangeText={(val) => updateForm('time', val)}
                      style={styles.input}
                      theme={inputTheme}
                      outlineColor="#E2E8F0"
                      activeOutlineColor="#1E293B"
                      left={<TextInput.Icon icon="clock-outline" color="#94A3B8" />}
                    />
                  </View>
                </View>

                <View style={styles.fullRow}>
                  <Text style={styles.inputLabel}>Additional Notes (Optional)</Text>
                  <TextInput
                    mode="outlined"
                    placeholder="Write anything you'd like us to know..."
                    value={formData.notes}
                    onChangeText={(val) => updateForm('notes', val)}
                    style={[styles.input, styles.textArea]}
                    theme={inputTheme}
                    outlineColor="#E2E8F0"
                    activeOutlineColor="#1E293B"
                    multiline
                    numberOfLines={4}
                  />
                </View>

                <Button
                  mode="contained"
                  onPress={handleBookDemo}
                  loading={loading}
                  style={styles.submitBtn}
                  contentStyle={styles.btnContent}
                  labelStyle={styles.btnLabel}
                  buttonColor="#1E293B"
                  icon="calendar-check"
                >
                  Schedule Live Demo
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
    backgroundColor: '#F1F5F9', // Very light blue/gray matching the outer background of the modal
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: width > 900 ? 40 : 16,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 1100,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
  },
  splitLayout: {
    flexDirection: width > 900 ? 'row' : 'column',
  },
  leftPanel: {
    flex: 1.1,
    backgroundColor: '#F8FAFC',
    padding: width > 700 ? 40 : 20,
    justifyContent: 'center',
    borderRightWidth: width > 900 ? 1 : 0,
    borderRightColor: '#E2E8F0',
    borderBottomWidth: width > 900 ? 0 : 1,
    borderBottomColor: '#E2E8F0',
  },
  illustrationCont: {
    width: '100%',
    height: 280,
    marginBottom: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustration: {
    width: '100%',
    height: '100%',
  },
  quoteBox: {
    padding: 24,
    marginBottom: 32,
  },
  quoteIcon: {
    marginBottom: 8,
    marginLeft: -4,
  },
  quoteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 26,
    marginBottom: 8,
  },
  quoteDesc: {
    fontSize: 14,
    color: '#64748B',
  },
  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  benefitItem: {
    alignItems: 'center',
    flex: 1,
  },
  benefitIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  benefitText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  rightPanel: {
    flex: 1.3,
    backgroundColor: '#FFFFFF',
    padding: width > 700 ? 48 : 24,
    justifyContent: 'center',
  },
  formContainer: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  formTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 32,
  },
  row: {
    flexDirection: width > 600 ? 'row' : 'column',
    marginBottom: 20,
  },
  col: {
    flex: 1,
  },
  colSpace: {
    width: 20,
    height: 20,
  },
  fullRow: {
    marginBottom: 20,
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
  textArea: {
    height: 100,
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
    marginTop: 6, 
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    marginRight: 4,
  },
  submitBtn: {
    borderRadius: 8,
    marginTop: 12,
  },
  btnContent: {
    height: 52,
  },
  btnLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
