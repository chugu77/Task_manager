import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../src/store/useStore';
import { config } from '../src/config';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { login } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: config.googleClientIdWeb,
    iosClientId: config.googleClientIdIOS,
    androidClientId: config.googleClientIdAndroid,
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleResponse(response.params.id_token);
    } else if (response?.type === 'error') {
      setError('Google ავტორიზაცია ვერ მოხერხდა');
      setIsLoading(false);
    }
  }, [response]);

  const handleGoogleResponse = async (idToken: string) => {
    try {
      await login(idToken);
      router.replace('/(tabs)/today');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ავტორიზაცია ვერ მოხერხდა');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    setError(null);
    promptAsync();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Icon */}
        <View style={styles.logoContainer}>
          <Ionicons name="checkbox-outline" size={80} color="#3b82f6" />
        </View>

        <Text style={styles.title}>Task Manager</Text>
        <Text style={styles.subtitle}>პერსონალური ტასკების მენეჯერი</Text>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.feature}>
            <Ionicons name="today-outline" size={24} color="#3b82f6" />
            <Text style={styles.featureText}>დღის ტასკები</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="git-branch-outline" size={24} color="#3b82f6" />
            <Text style={styles.featureText}>ქვეტასკები</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="sync-outline" size={24} color="#3b82f6" />
            <Text style={styles.featureText}>სინქრონიზაცია</Text>
          </View>
        </View>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Google Sign In Button */}
        <TouchableOpacity
          style={[styles.googleButton, !request && styles.googleButtonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={!request || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color="#fff" />
              <Text style={styles.googleButtonText}>Google-ით შესვლა</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 40,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 24,
    marginBottom: 48,
  },
  feature: {
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 12,
    color: '#6b7280',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 12,
    minWidth: 200,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
      },
    }),
  },
  googleButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
