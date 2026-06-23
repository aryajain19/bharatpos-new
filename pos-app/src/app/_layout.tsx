import { Stack } from 'expo-router';
import { AuthProvider } from '../providers/AuthProvider';
import { CartProvider } from '../providers/CartProvider';
import { ThemeProvider } from '../providers/ThemeProvider';
import { Platform } from 'react-native';

// Filter harmless library warnings/errors on Web to prevent blocking development error overlays
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
  }
  
  #web-print-section {
    display: none !important;
  }

  @media print {
    #root, .react-native-root, body > div:not(#web-print-section) {
      display: none !important;
    }

    html, body {
      background: white !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 210mm !important;
      height: 297mm !important;
    }

    #web-print-section {
      display: block !important;
      position: absolute;
      left: 0;
      top: 0;
      width: 210mm !important;
      height: 297mm !important;
      background: white !important;
      padding: 12mm !important;
      box-sizing: border-box !important;
      margin: 0 !important;
    }

    .print-page {
      width: 186mm;
      height: 273mm;
      page-break-after: always !important;
      break-after: page !important;
      box-sizing: border-box !important;
    }

    .print-page-break {
      page-break-before: always !important;
      break-before: page !important;
    }

    .print-grid {
      display: grid !important;
      grid-gap: 5mm !important;
      height: 273mm !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .grid-12 {
      grid-template-columns: repeat(3, 1fr) !important;
      grid-template-rows: repeat(4, 1fr) !important;
    }

    .grid-24 {
      grid-template-columns: repeat(3, 1fr) !important;
      grid-template-rows: repeat(8, 1fr) !important;
    }

    .grid-30 {
      grid-template-columns: repeat(3, 1fr) !important;
      grid-template-rows: repeat(10, 1fr) !important;
    }

    .grid-40 {
      grid-template-columns: repeat(4, 1fr) !important;
      grid-template-rows: repeat(10, 1fr) !important;
    }

    .print-label {
      border: 1px dashed #CBD5E1 !important;
      border-radius: 6px !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: center !important;
      align-items: center !important;
      padding: 8px !important;
      text-align: center !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      background: white !important;
    }

    .print-prod-name {
      font-size: 10px !important;
      font-weight: bold !important;
      margin-bottom: 5px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      width: 100% !important;
      color: #1E293B !important;
    }

    .print-barcode-container {
      display: flex !important;
      justify-content: center !important;
      align-items: flex-end !important;
      height: 38px !important;
      width: 100% !important;
    }

    .print-barcode-val {
      font-size: 8px !important;
      letter-spacing: 2px !important;
      margin-top: 5px !important;
      font-family: monospace !important;
      color: #475569 !important;
    }
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

// Theme is now managed by ThemeProvider in src/providers/ThemeProvider.tsx

export default function RootLayout() {
  return (
    <AuthProvider>
      <CartProvider>
        <ThemeProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(owner)" />
            <Stack.Screen name="(vendor)" />
          </Stack>
        </ThemeProvider>
      </CartProvider>
    </AuthProvider>
  );
}
