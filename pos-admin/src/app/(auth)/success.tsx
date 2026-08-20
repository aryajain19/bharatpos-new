import React from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { Button, Text, Surface } from 'react-native-paper';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

export default function SuccessScreen() {

  const StepCard = ({ number, title, desc, linkText, onPress }: { number: string, title: string, desc: string, linkText: string, onPress: () => void }) => (
    <Surface style={styles.stepCard} elevation={1}>
      <View style={styles.stepHeader}>
        <View style={styles.stepNumberCircle}>
           <Text style={styles.stepNumberText}>{number}</Text>
        </View>
        <Text style={styles.stepTitle}>{title}</Text>
      </View>
      <Text style={styles.stepDesc}>{desc}</Text>
      <TouchableOpacity onPress={onPress}>
        <Text style={styles.stepLink}>{linkText}</Text>
      </TouchableOpacity>
    </Surface>
  );

  return (
    <View style={styles.container}>
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
           <Icon name="cash-register" size={24} color="#10B981" />
           <Text style={styles.logoText}>SmartPOS</Text>
        </View>
        <Button
          mode="outlined"
          onPress={() => router.push('/' as any)}
          style={styles.goDashboardBtn}
          textColor="#1E293B"
          theme={{ roundness: 2 }}
        >
          Go to Dashboard
        </Button>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.centerContent}>
          
          {/* Success Icon & Confetti (Simulated) */}
          <View style={styles.iconWrapper}>
             <View style={styles.confettiDot1} />
             <View style={styles.confettiDot2} />
             <View style={styles.confettiDot3} />
             <View style={styles.confettiDot4} />
             <View style={styles.confettiDot5} />
             <View style={styles.confettiDot6} />
             <View style={styles.successCircle}>
               <Icon name="check" size={56} color="#FFFFFF" />
             </View>
          </View>

          <Text style={styles.mainTitle}>Your Free Trial is Ready!</Text>
          <Text style={styles.subtitle}>Welcome to SmartPOS family. Your account has been created successfully.</Text>
          <Text style={styles.nextText}>Here's what you can do next:</Text>

          {/* Next Steps Cards */}
          <View style={styles.cardsRow}>
            <StepCard 
              number="1"
              title="Verify Your Email"
              desc="We've sent a verification link to your email address."
              linkText="Resend Email"
              onPress={() => alert('Verification email resent')}
            />
            <View style={styles.cardSpace} />
            <StepCard 
              number="2"
              title="Add Your Products"
              desc="Import or add your products and set your inventory."
              linkText="Add Products"
              onPress={() => router.push('/inventory' as any)}
            />
            <View style={styles.cardSpace} />
            <StepCard 
              number="3"
              title="Start Billing"
              desc="Create your first bill and grow your business."
              linkText="Create Bill"
              onPress={() => router.push('/billing' as any)}
            />
          </View>

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            <Button
              mode="contained"
              onPress={() => router.push('/' as any)}
              style={styles.primaryBtn}
              contentStyle={[styles.primaryBtnContent, { flexDirection: 'row-reverse', height: 48, paddingHorizontal: 16 }]}
              labelStyle={styles.btnLabel}
              buttonColor="#1E293B"
              icon="arrow-right"
            >
              Open Dashboard
            </Button>
            
            <View style={{ width: 16, height: 16 }} />
            
            <Button
              mode="outlined"
              onPress={() => alert('Playing tutorial...')}
              style={styles.secondaryBtn}
              contentStyle={styles.secondaryBtnContent}
              labelStyle={styles.btnLabelSec}
              textColor="#1E293B"
              icon="play-circle-outline"
            >
              Watch Quick Tutorial
            </Button>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA', // Slightly off-white
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: width > 700 ? 40 : 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginLeft: 8,
  },
  goDashboardBtn: {
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  centerContent: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
  },
  iconWrapper: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  confettiDot1: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6', top: 20, left: 20 },
  confettiDot2: { position: 'absolute', width: 12, height: 6, backgroundColor: '#F59E0B', top: 40, right: 20, transform: [{ rotate: '45deg' }] },
  confettiDot3: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444', bottom: 30, left: 30 },
  confettiDot4: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', bottom: 40, right: 30 },
  confettiDot5: { position: 'absolute', width: 14, height: 4, backgroundColor: '#8B5CF6', top: 10, right: 60, transform: [{ rotate: '-20deg' }] },
  confettiDot6: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#F43F5E', bottom: 10, left: 70 },
  
  mainTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 4,
  },
  nextText: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 40,
  },
  cardsRow: {
    flexDirection: width > 768 ? 'row' : 'column',
    width: '100%',
    marginBottom: 48,
  },
  stepCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardSpace: {
    width: 24,
    height: 24,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNumberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 14,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  stepDesc: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 20,
    minHeight: 40,
  },
  stepLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3B82F6',
  },
  bottomActions: {
    flexDirection: width > 500 ? 'row' : 'column',
    alignItems: 'center',
  },
  primaryBtn: {
    borderRadius: 8,
    width: width > 500 ? 'auto' : '100%',
  },
  primaryBtnContent: {
    height: 48,
    paddingHorizontal: 24,
  },
  secondaryBtn: {
    borderRadius: 8,
    borderColor: '#CBD5E1',
    borderWidth: 1,
    width: width > 500 ? 'auto' : '100%',
  },
  secondaryBtnContent: {
    height: 48,
    paddingHorizontal: 24,
  },
  btnLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnLabelSec: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
});
