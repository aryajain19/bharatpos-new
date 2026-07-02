import { useAppTheme } from '../../providers/ThemeProvider';
import { DS } from '../../constants/designTokens';
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Dimensions } from 'react-native';
import { Text, Card, Button, useTheme, TextInput } from 'react-native-paper';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { doc, updateDoc } from '../../lib/firestore_adapter';
import { useAuth } from '../../providers/AuthProvider';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function UpgradeScreen() {
  const { isDarkMode, toggleTheme } = useAppTheme();
  const appTheme = useTheme();

  const { user, subscriptionPlan } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async (planName: string, years: number) => {
    if (!isFirebaseConfigured || !user) return;
    setLoading(true);

    const newEndDate = new Date();
    newEndDate.setFullYear(newEndDate.getFullYear() + years);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        subscription_plan: planName,
        subscription_end_date: newEndDate.toISOString()
      });

      Alert.alert('Success', `You are now upgraded to the ${planName} plan! Reloading app...`);
    } catch (error: any) {
      Alert.alert('Upgrade Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>Unlock Premium</Text>
        <Text style={styles.subtitle}>Current Plan: {subscriptionPlan === 'free_trial' ? '30-Day Free Trial' : subscriptionPlan?.toUpperCase()}</Text>
      </View>

      <View style={styles.pricingGrid}>
        
        {/* 1 Year Plan */}
        <Card style={styles.pricingCard}>
          <Card.Content style={styles.cardContent}>
            <Text style={styles.planName}>Small Vendor</Text>
            <Text style={styles.planPrice}>₹5,000<Text style={{fontSize:16, color:'gray'}}>/yr</Text></Text>
            
            <View style={styles.featureList}>
              <View style={styles.featureItem}><Icon name="check-circle" size={20} color="#4CAF50" /><Text style={styles.featureText}>2–3 Devices max</Text></View>
              <View style={styles.featureItem}><Icon name="check-circle" size={20} color="#4CAF50" /><Text style={styles.featureText}>Mobile Only (No Laptop)</Text></View>
              <View style={styles.featureItem}><Icon name="check-circle" size={20} color="#4CAF50" /><Text style={styles.featureText}>Lightning Billing Terminal</Text></View>
              <View style={styles.featureItem}><Icon name="check-circle" size={20} color="#4CAF50" /><Text style={styles.featureText}>Cloud Stock Sync</Text></View>
            </View>

            <Button mode="contained" loading={loading} disabled={loading} style={styles.upgradeBtn} onPress={() => handleUpgrade('paid_1_year', 1)}>
              Subscribe 1 Year
            </Button>
          </Card.Content>
        </Card>

        {/* 2 Year Plan (Popular) */}
        <Card style={[styles.pricingCard, styles.popularCard]}>
          <View style={styles.popularBadge}><Text style={styles.popularBadgeText}>RECOMMENDED</Text></View>
          <Card.Content style={styles.cardContent}>
            <Text style={styles.planName}>Medium Shop</Text>
            <Text style={styles.planPrice}>₹9,000<Text style={{fontSize:16, color:'gray'}}>/2 yrs</Text></Text>
            
            <View style={styles.featureList}>
              <View style={styles.featureItem}><Icon name="check-circle" size={20} color="#10B981" /><Text style={styles.featureText}>Up to 5 Devices max</Text></View>
              <View style={styles.featureItem}><Icon name="check-circle" size={20} color="#10B981" /><Text style={styles.featureText}>Mobile + Laptop screens</Text></View>
              <View style={styles.featureItem}><Icon name="check-circle" size={20} color="#10B981" /><Text style={styles.featureText}>Worker Phone Register Sync</Text></View>
              <View style={styles.featureItem}><Icon name="check-circle" size={20} color="#10B981" /><Text style={styles.featureText}>Save 10% on Billing</Text></View>
            </View>

            <Button mode="contained" loading={loading} disabled={loading} style={styles.popularBtn} onPress={() => handleUpgrade('paid_2_year', 2)}>
              Subscribe 2 Years
            </Button>
          </Card.Content>
        </Card>

        {/* 3 Year Plan */}
        <Card style={styles.pricingCard}>
          <Card.Content style={styles.cardContent}>
            <Text style={styles.planName}>Large Shop</Text>
            <Text style={styles.planPrice}>₹12,500<Text style={{fontSize:16, color:'gray'}}>/3 yrs</Text></Text>
            
            <View style={styles.featureList}>
              <View style={styles.featureItem}><Icon name="check-circle" size={20} color="#4CAF50" /><Text style={styles.featureText}>Unlimited synced devices</Text></View>
              <View style={styles.featureItem}><Icon name="check-circle" size={20} color="#4CAF50" /><Text style={styles.featureText}>Central Inventory control</Text></View>
              <View style={styles.featureItem}><Icon name="check-circle" size={20} color="#4CAF50" /><Text style={styles.featureText}>Custom Sales Analytics</Text></View>
              <View style={styles.featureItem}><Icon name="check-circle" size={20} color="#4CAF50" /><Text style={styles.featureText}>Dedicated Account Mgr</Text></View>
            </View>

            <Button mode="contained" loading={loading} disabled={loading} style={styles.upgradeBtn} onPress={() => handleUpgrade('paid_3_year', 3)}>
              Subscribe 3 Years
            </Button>
          </Card.Content>
        </Card>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, },
  header: { padding: 40, alignItems: 'center' },
  title: { fontWeight: 'bold', },
  subtitle: { fontSize: 16, color: 'gray', marginTop: 8 },
  pricingGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 24, paddingBottom: 60 },
  pricingCard: { width: 320, backgroundColor: DS.colors.cardBg, borderRadius: DS.radius.lg },
  popularCard: { borderWidth: 2, transform: [{ scale: 1.05 }] },
  popularBadge: { paddingVertical: 6, alignItems: 'center', borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  popularBadgeText: { color: 'white', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },
  cardContent: { padding: 30, alignItems: 'center' },
  planName: { fontSize: 18, color: 'gray', fontWeight: 'bold', marginBottom: 16 },
  planPrice: { fontSize: 40, fontWeight: 'bold', marginBottom: 30 },
  featureList: { width: '100%', marginBottom: 30 },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  featureText: { marginLeft: 12, fontSize: 15, },
  upgradeBtn: { width: '100%', borderRadius: DS.radius.sm, paddingVertical: 8, },
  popularBtn: { width: '100%', borderRadius: DS.radius.sm, paddingVertical: 8, },
});
