import { Platform } from 'react-native';

// API configuration
const API_URL_DEV = Platform.select({
  web: 'http://localhost:8000',
  default: 'http://10.0.2.2:8000', // Android emulator localhost
});

export const config = {
  // API
  apiUrl: process.env.EXPO_PUBLIC_API_URL || API_URL_DEV,
  
  // Google OAuth
  googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
  googleClientIdWeb: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '',
  googleClientIdIOS: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '',
  googleClientIdAndroid: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || '',
  
  // Sync settings
  syncIntervalMinutes: 5,
  
  // Platform detection
  isWeb: Platform.OS === 'web',
  isMobile: Platform.OS === 'ios' || Platform.OS === 'android',
};
