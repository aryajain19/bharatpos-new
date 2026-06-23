import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
const firebaseConfig = {
  apiKey: "AIzaSyCVzDbGT9ygO8mG0lcaRzyK0aAMci7JUrM",
  authDomain: "smartpos-476ce.firebaseapp.com",
  projectId: "smartpos-476ce",
  storageBucket: "smartpos-476ce.firebasestorage.app",
  messagingSenderId: "3153307994",
  appId: "1:3153307994:web:d49dec5c5e96ae9ba7eb63",
  databaseURL: "https://smartpos-476ce-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
export const db = getDatabase(app);

// Secondary App for User Provisioning
const secondaryApp = getApps().find(a => a.name === 'admin-provisioning') || initializeApp(firebaseConfig, 'admin-provisioning');
const secondaryAuth = getAuth(secondaryApp);

// Use a mock flag to determine if we should actually call Firebase in demo mode
export const isFirebaseConfigured = firebaseConfig.apiKey !== undefined && firebaseConfig.apiKey !== "mock-api-key";

export { app, auth, secondaryAuth };

// Alert.alert Web Polyfill
import { Alert, Platform } from 'react-native';
if (Platform.OS === 'web') {
  Alert.alert = (title, message, buttons) => {
    let msg = title || '';
    if (message) msg += (msg ? '\n\n' : '') + message;
    
    if (buttons && buttons.length > 0) {
      const hasCancel = buttons.some(b => b.style === 'cancel');
      if (hasCancel) {
        const confirmed = window.confirm(msg);
        const button = buttons.find(b => confirmed ? b.style !== 'cancel' : b.style === 'cancel') || buttons[0];
        if (button && typeof button.onPress === 'function') {
          button.onPress();
        }
      } else {
        window.alert(msg);
        const firstButton = buttons[0];
        if (firstButton && typeof firstButton.onPress === 'function') {
          firstButton.onPress();
        }
      }
    } else {
      window.alert(msg);
    }
  };
}


