import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Platform, Dimensions, Animated } from 'react-native';
import { Text, Divider, useTheme, IconButton, Avatar, Surface, PaperProvider, MD3LightTheme as DefaultTheme, Badge } from 'react-native-paper';
import { Slot, router, usePathname, useLocalSearchParams, useSegments } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { auth, isFirebaseConfigured, db } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { AuthProvider, useAuth } from '../providers/AuthProvider';
import { collection, query, onSnapshot } from '../lib/firestore_adapter';

// Filter harmless library warnings/errors on Web
if (Platform.OS === 'web' && typeof console !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const msg = args.map(arg => typeof arg === 'string' ? arg : String(arg)).join(' ');
    if (
      msg.includes('onPressIn') || 
      msg.includes('onPressOut') ||
      msg.includes('pointerEvents') || 
      msg.includes('shadow*') ||
      msg.includes('absoluteFillObject') ||
      msg.includes('React does not recognize') ||
      msg.includes('DOM element') ||
      msg.includes('useNativeDriver') ||
      msg.includes('strokeDasharray') ||
      msg.includes('strokeWidth') ||
      msg.includes('fillShadowGradient') ||
      msg.includes('Invalid prop') ||
      msg.includes('prop type') ||
      msg.includes('onResponder') ||
      msg.includes('onStartShouldSet') ||
      msg.includes('Responder') ||
      msg.includes('onPress')
    ) {
      return;
    }
    originalError(...args);
  };

  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const msg = args.map(arg => typeof arg === 'string' ? arg : String(arg)).join(' ');
    if (
      msg.includes('onPressIn') || 
      msg.includes('onPressOut') ||
      msg.includes('pointerEvents') || 
      msg.includes('shadow*') ||
      msg.includes('absoluteFillObject') ||
      msg.includes('React does not recognize') ||
      msg.includes('DOM element') ||
      msg.includes('useNativeDriver') ||
      msg.includes('strokeDasharray') ||
      msg.includes('strokeWidth') ||
      msg.includes('fillShadowGradient') ||
      msg.includes('Invalid prop') ||
      msg.includes('prop type') ||
      msg.includes('onResponder') ||
      msg.includes('onStartShouldSet') ||
      msg.includes('Responder') ||
      msg.includes('onPress')
    ) {
      return;
    }
    originalWarn(...args);
  };
}

// Inject MaterialCommunityIcons font for React Native Web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css';
  document.head.appendChild(link);

  const iconFontStyles = `@font-face {
    font-family: "MaterialCommunityIcons";
    src: url("https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/fonts/materialdesignicons-webfont.woff2") format("woff2"),
         url("https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/fonts/materialdesignicons-webfont.ttf") format("truetype");
    font-display: swap;
  }`;

  const style = document.createElement('style');
  style.type = 'text/css';
  if ((style as any).styleSheet) {
    (style as any).styleSheet.cssText = iconFontStyles;
  } else {
    style.appendChild(document.createTextNode(iconFontStyles));
  }
  document.head.appendChild(style);
}

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#2563EB',
    primaryContainer: '#DBEAFE',
    secondary: '#00B0FF',
    background: '#F5F6FA',
    surface: '#FFFFFF',
  },
};

const menuSections = [
  {
    label: 'Platform Control',
    items: [
      { name: 'Dashboard', icon: 'view-dashboard', tab: 'overview' },
      { name: 'Customers', icon: 'account-multiple', tab: 'customers' },
      { name: 'Subscriptions', icon: 'calendar-sync', tab: 'subscriptions' },
      { name: 'Support Tickets', icon: 'face-agent', tab: 'support' },
      { name: 'Revenue', icon: 'file-chart', tab: 'reports' },
      { name: 'Settings', icon: 'cog', tab: 'settings' },
    ]
  }
];

// Animated sidebar menu item component
const SidebarMenuItem = ({ item, isActive, onPress }: { item: any; isActive: boolean; onPress: () => void }) => {
  const hoverAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
  };

  const handleHoverIn = () => {
    if (!isActive) {
      Animated.timing(hoverAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
    }
  };

  const handleHoverOut = () => {
    Animated.timing(hoverAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const bgColor = hoverAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', 'rgba(255,255,255,0.06)'],
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        // @ts-ignore - web hover events
        onMouseEnter={handleHoverIn}
        onMouseLeave={handleHoverOut}
        activeOpacity={0.8}
      >
        <Animated.View style={[
          styles.menuItem,
          isActive && styles.menuItemActive,
          !isActive && { backgroundColor: bgColor },
        ]}>
          {isActive && <View style={styles.activeIndicatorDot} />}
          <View style={[styles.menuIconWrap, isActive && styles.menuIconWrapActive]}>
            <Icon name={item.icon} size={17} color={isActive ? '#fff' : '#8B8FAD'} />
          </View>
          <Text style={[styles.menuText, isActive && styles.menuTextActive]}>{item.name}</Text>
          {isActive && (
            <View style={styles.activeChevron}>
              <Icon name="chevron-right" size={14} color="rgba(255,255,255,0.5)" />
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

function AdminLayout() {
  const pathname = usePathname();
  const { tab } = useLocalSearchParams();
  const currentTab = tab || 'overview';
  const rTheme = useTheme();
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(Dimensions.get('window').width > 900);
  const [currentTime, setCurrentTime] = useState(new Date());
  const sidebarAnim = useRef(new Animated.Value(Dimensions.get('window').width > 900 ? 1 : 0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Animated sidebar open/close
  useEffect(() => {
    const isMobile = Dimensions.get('window').width <= 900;
    Animated.parallel([
      Animated.spring(sidebarAnim, {
        toValue: isSidebarOpen ? 1 : 0,
        useNativeDriver: false,
        friction: 12,
        tension: 65,
      }),
      Animated.timing(overlayAnim, {
        toValue: isSidebarOpen && isMobile ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isSidebarOpen]);

  const handleLogout = async () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('adminBypass');
      }
      if (isFirebaseConfigured) {
        await signOut(auth);
      }
    } catch (error) {
      console.error("Firebase logout error:", error);
    }
    router.replace('/(auth)/login' as any);
  };

  const handleNav = (tabName: string) => {
    router.push({
      pathname: '/',
      params: { tab: tabName }
    } as any);
    
    if (Dimensions.get('window').width <= 900) {
      setIsSidebarOpen(false);
    }
  };

  const sidebarBg = isDarkMode ? '#0D0E1A' : '#0F1021';
  const mainBg = isDarkMode ? '#1E1E2F' : '#F4F5F9';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#1A1A2E';

  const sidebarWidth = sidebarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 270],
  });

  const overlayOpacity = overlayAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const q = query(collection(db, 'broadcast_alerts'));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      setNotificationCount(snapshot.docs.length);
    });
    return () => unsubscribe();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: mainBg }]}>
      {/* Animated Overlay */}
      {isSidebarOpen && Dimensions.get('window').width <= 900 && (
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setIsSidebarOpen(false)} />
        </Animated.View>
      )}

      {/* Animated Sidebar */}
      <Animated.View style={[
        styles.sidebar,
        { backgroundColor: sidebarBg, width: sidebarWidth },
        Dimensions.get('window').width <= 900 ? { position: 'absolute', zIndex: 100, height: '100%' } : {},
      ]}>
        <View style={styles.sidebarInner}>
          {/* Logo Area */}
          <View style={styles.logoContainer}>
            <View style={styles.logoTextWrap}>
              <Text style={styles.logoText}>SmartPOS</Text>
              <Text style={styles.logoSubText}>Admin Control</Text>
            </View>
          </View>

          <View style={styles.sidebarDivider} />

          <ScrollView style={styles.sidebarMenu} showsVerticalScrollIndicator={false}>
            {menuSections.map((section, sIdx) => (
              <View key={sIdx} style={{ marginBottom: 6 }}>
                {/* Section Label */}
                <View style={styles.sectionLabelContainer}>
                  <Text style={styles.sectionLabel}>{section.label.toUpperCase()}</Text>
                  <View style={styles.sectionLine} />
                </View>

                {/* Section Items */}
                {section.items.map((item, iIdx) => (
                  <SidebarMenuItem
                    key={iIdx}
                    item={item}
                    isActive={currentTab === item.tab}
                    onPress={() => handleNav(item.tab)}
                  />
                ))}
              </View>
            ))}
            <View style={{ height: 20 }} />
          </ScrollView>
          
          <View style={styles.sidebarDivider} />
          
          <View style={styles.sidebarFooter}>


            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
              <View style={styles.logoutIconWrap}>
                <Icon name="logout-variant" size={16} color="#FF6B6B" />
              </View>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <View style={styles.main}>
        {/* Premium Top Bar */}
        <Surface style={[styles.topBar, { backgroundColor: isDarkMode ? '#1A1B2D' : '#FFFFFF', borderBottomColor: isDarkMode ? '#2D2D44' : '#EEF0F6' }]} elevation={0}>
          <View style={styles.topBarLeft}>
            <TouchableOpacity 
              style={styles.menuToggle}
              onPress={() => setIsSidebarOpen(!isSidebarOpen)}
              activeOpacity={0.7}
            >
              <Icon name={isSidebarOpen ? "menu-open" : "menu"} size={22} color={isDarkMode ? '#B0B3D6' : '#5E35B1'} />
            </TouchableOpacity>
            <View style={styles.topBarTitleWrap}>
              <Text style={[styles.topBarTitle, { color: textPrimary }]}>
                Super Admin Control
              </Text>
              <View style={styles.topBarDateRow}>
                <Icon name="clock-outline" size={12} color={isDarkMode ? '#6B6F96' : '#9E9E9E'} />
                <Text style={[styles.topBarDate, { color: isDarkMode ? '#6B6F96' : '#9E9E9E' }]}>
                  {formatDate(currentTime)} · {formatTime(currentTime)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.topBarRight}>
            {/* Search */}
            <TouchableOpacity style={[styles.topBarAction, { backgroundColor: isDarkMode ? '#252640' : '#F5F3FF' }]}>
              <Icon name="magnify" size={19} color={isDarkMode ? '#8B8FAD' : '#7E57C2'} />
            </TouchableOpacity>

            {/* Notification Bell with Badge */}
            <TouchableOpacity 
              style={[styles.topBarAction, { backgroundColor: isDarkMode ? '#252640' : '#F5F3FF' }]}
              onPress={() => handleNav('notifications')}
            >
              <Icon name="bell-outline" size={19} color={isDarkMode ? '#8B8FAD' : '#7E57C2'} />
              {notificationCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{notificationCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Security */}
            <TouchableOpacity 
              style={[styles.topBarAction, { backgroundColor: isDarkMode ? '#252640' : '#F5F3FF' }]}
              onPress={() => handleNav('security')}
            >
              <Icon name="shield-check-outline" size={19} color={isDarkMode ? '#8B8FAD' : '#7E57C2'} />
            </TouchableOpacity>

            {/* Divider */}
            <View style={[styles.topBarDivider, { backgroundColor: isDarkMode ? '#2D2D44' : '#EEF0F6' }]} />

            {/* User Avatar Area */}
            <TouchableOpacity style={styles.userSection} activeOpacity={0.7}>
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: textPrimary }]}>Arya</Text>
                <Text style={[styles.userRole, { color: isDarkMode ? '#6B6F96' : '#9E9E9E' }]}>Super Admin</Text>
              </View>
              <View style={styles.avatarWrap}>
                <Avatar.Text size={36} label="A" style={styles.avatar} labelStyle={styles.avatarLabel} />
                <View style={styles.onlineDot} />
              </View>
              <Icon name="chevron-down" size={16} color={isDarkMode ? '#6B6F96' : '#9E9E9E'} />
            </TouchableOpacity>
          </View>
        </Surface>
        <View style={[styles.content, { backgroundColor: isDarkMode ? '#141522' : '#F4F5F9' }]}>
          <Slot />
        </View>
      </View>
    </View>
  );
}

function AuthGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  
  // Track bypass state
  const [isDemoBypass, setIsDemoBypass] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const bypass = window.localStorage.getItem('adminBypass') === 'true';
      setIsDemoBypass(bypass);
    }
  }, [segments]);
  
  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup && !isDemoBypass) {
      router.replace('/(auth)/login' as any);
    } else if ((user || isDemoBypass) && inAuthGroup) {
      router.replace('/' as any);
    }
  }, [user, loading, segments, isDemoBypass]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0D0E1A', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 16 }}>Loading Command Center...</Text>
      </View>
    );
  }

  const inAuthGroup = segments[0] === '(auth)';
  if (inAuthGroup || (!user && !isDemoBypass)) {
    return <Slot />;
  }

  return <AdminLayout />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PaperProvider theme={theme}>
        <AuthGuard />
      </PaperProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, flexDirection: 'column' },
  sidebar: {
    height: '100%',
    overflow: 'hidden',
  },
  sidebarInner: {
    width: 270,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 99,
  },
  logoContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,215,0,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoTextWrap: {
    flex: 1,
  },
  logoText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 17,
    letterSpacing: 0.3,
  },
  logoSubText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    marginTop: 1,
    letterSpacing: 0.5,
  },
  envBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(76,175,80,0.08)',
  },
  envDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  envText: {
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  sidebarMenu: { flex: 1, paddingTop: 4 },
  sectionLabelContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    marginTop: 14, 
    marginBottom: 4 
  },
  sectionLabel: { 
    color: 'rgba(255,255,255,0.22)', 
    fontSize: 9.5, 
    fontWeight: 'bold', 
    letterSpacing: 1.4,
    marginRight: 10,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16,
    marginHorizontal: 10,
    marginBottom: 2,
    borderRadius: 10,
    position: 'relative',
  },
  menuItemActive: {
    backgroundColor: 'rgba(37,99,235,0.25)',
  },
  activeIndicatorDot: {
    position: 'absolute',
    left: 0,
    width: 4,
    height: 24,
    borderRadius: 2,
    backgroundColor: '#2563EB',
  },
  menuIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  menuIconWrapActive: {
    backgroundColor: 'rgba(37,99,235,0.3)',
  },
  menuText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12.5,
    flex: 1,
    fontWeight: '500',
  },
  menuTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  activeChevron: {
    marginLeft: 4,
  },
  sidebarFooter: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 12,
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 4,
  },
  themeToggleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  footerText: {
    color: '#8B8FAD',
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  toggleSwitch: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: 'rgba(37,99,235,0.4)',
  },
  toggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#8B8FAD',
  },
  toggleKnobActive: {
    backgroundColor: '#2563EB',
    alignSelf: 'flex-end',
  },
  logoutButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 10, 
    paddingHorizontal: 8, 
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,107,0.06)',
  },
  logoutIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: 'rgba(255,107,107,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoutText: {
    color: '#FF6B6B',
    fontWeight: '600',
    fontSize: 12.5,
  },
  topBar: { 
    height: 64, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center' },
  menuToggle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  topBarTitleWrap: {
    justifyContent: 'center',
  },
  topBarTitle: {
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  topBarDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  topBarDate: {
    fontSize: 11,
    marginLeft: 4,
    fontWeight: '500',
  },
  topBarRight: { flexDirection: 'row', alignItems: 'center' },
  topBarAction: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  topBarDivider: {
    width: 1,
    height: 30,
    marginHorizontal: 14,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    marginRight: 10,
    alignItems: 'flex-end',
  },
  userName: {
    fontWeight: '700',
    fontSize: 13,
  },
  userRole: {
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 1,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 6,
  },
  avatar: {
    backgroundColor: '#2563EB',
  },
  avatarLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  content: { flex: 1, overflow: 'hidden' },
});
