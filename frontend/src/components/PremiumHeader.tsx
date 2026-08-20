import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DS } from '../constants/designTokens';

interface PremiumHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
  rightAction?: React.ReactNode;
}

export function PremiumHeader({ title, subtitle, icon, rightAction }: PremiumHeaderProps) {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          {icon && (
            <View style={styles.iconContainer}>
              <Icon name={icon} size={24} color={DS.colors.brand} />
            </View>
          )}
          <View>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>
        
        {rightAction && (
          <View style={styles.headerRight}>
            {rightAction}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingVertical: DS.space.xl,
    paddingHorizontal: DS.space.xl,
    backgroundColor: DS.colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: DS.colors.border,
    marginBottom: DS.space.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: DS.radius.md,
    backgroundColor: DS.colors.brandLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: DS.font.h2.fontSize,
    fontWeight: DS.font.h2.fontWeight,
    color: DS.colors.text,
    letterSpacing: DS.font.h2.letterSpacing,
  },
  subtitle: {
    fontSize: DS.font.bodyMedium.fontSize,
    color: DS.colors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
  },
});
