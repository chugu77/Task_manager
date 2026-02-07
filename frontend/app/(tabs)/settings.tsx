import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import { config } from '../../src/config';

export default function SettingsScreen() {
  const { user, logout, syncState, triggerSync } = useStore();

  const handleLogout = () => {
    Alert.alert(
      'გამოსვლა',
      'ნამდვილად გსურთ გამოსვლა?',
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'გამოსვლა',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const handleManualSync = async () => {
    await triggerSync();
    Alert.alert('სინქრონიზაცია', 'სინქრონიზაცია დასრულდა');
  };

  return (
    <ScrollView style={styles.container}>
      {/* User Profile */}
      <View style={styles.profileSection}>
        {user?.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={32} color="#9ca3af" />
          </View>
        )}
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      {/* Sync Section (Mobile Only) */}
      {config.isMobile && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>სინქრონიზაცია</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons
                name={
                  syncState === 'syncing'
                    ? 'sync'
                    : syncState === 'error'
                    ? 'alert-circle'
                    : 'checkmark-circle'
                }
                size={24}
                color={
                  syncState === 'syncing'
                    ? '#f59e0b'
                    : syncState === 'error'
                    ? '#ef4444'
                    : '#10b981'
                }
              />
              <View>
                <Text style={styles.settingLabel}>სტატუსი</Text>
                <Text style={styles.settingValue}>
                  {syncState === 'syncing'
                    ? 'მიმდინარეობს...'
                    : syncState === 'error'
                    ? 'შეცდომა'
                    : 'სინქრონიზებული'}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.settingItem} onPress={handleManualSync}>
            <View style={styles.settingInfo}>
              <Ionicons name="refresh" size={24} color="#3b82f6" />
              <View>
                <Text style={styles.settingLabel}>სინქრონიზაცია</Text>
                <Text style={styles.settingValue}>ხელით სინქრონიზაცია</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#6b7280" />
            <Text style={styles.infoText}>
              აპლიკაცია ავტომატურად სინქრონდება ყოველ {config.syncIntervalMinutes} წუთში
              და აპლიკაციიდან გასვლისას.
            </Text>
          </View>
        </View>
      )}

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>აპლიკაციის შესახებ</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="information-circle-outline" size={24} color="#6b7280" />
            <View>
              <Text style={styles.settingLabel}>ვერსია</Text>
              <Text style={styles.settingValue}>1.0.0</Text>
            </View>
          </View>
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="phone-portrait-outline" size={24} color="#6b7280" />
            <View>
              <Text style={styles.settingLabel}>პლატფორმა</Text>
              <Text style={styles.settingValue}>
                {config.isWeb ? 'Web' : config.isMobile ? 'Mobile' : 'Unknown'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
          <Text style={styles.logoutText}>გამოსვლა</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#1f2937',
  },
  settingValue: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '500',
  },
});
