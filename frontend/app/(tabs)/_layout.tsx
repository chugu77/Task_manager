import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useStore } from '../../src/store/useStore';
import { ConflictModal } from '../../src/components/ConflictModal';
import { config } from '../../src/config';

export default function TabsLayout() {
  const { tabs, conflicts, syncState, loadTabs, createTab, resolveConflict } = useStore();
  const [showAddTab, setShowAddTab] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [showConflicts, setShowConflicts] = useState(false);

  useEffect(() => {
    loadTabs();
  }, []);

  // Show conflicts modal when there are conflicts
  useEffect(() => {
    if (conflicts.length > 0) {
      setShowConflicts(true);
    }
  }, [conflicts]);

  const handleAddTab = async () => {
    if (newTabName.trim()) {
      await createTab(newTabName.trim());
      setNewTabName('');
      setShowAddTab(false);
    }
  };

  const customTabs = tabs.filter((t) => t.tab_type === 'custom');

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#3b82f6',
          tabBarInactiveTintColor: '#6b7280',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
          },
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerRight: () => (
            <View style={styles.headerRight}>
              {config.isMobile && (
                <View style={styles.syncIndicator}>
                  <Ionicons
                    name={
                      syncState === 'syncing'
                        ? 'sync'
                        : syncState === 'error'
                        ? 'alert-circle'
                        : 'checkmark-circle'
                    }
                    size={20}
                    color={
                      syncState === 'syncing'
                        ? '#f59e0b'
                        : syncState === 'error'
                        ? '#ef4444'
                        : '#10b981'
                    }
                  />
                </View>
              )}
              <TouchableOpacity
                onPress={() => setShowAddTab(true)}
                style={styles.addTabButton}
              >
                <Ionicons name="add-circle-outline" size={24} color="#3b82f6" />
              </TouchableOpacity>
            </View>
          ),
        }}
      >
        {/* Today Tab (System) */}
        <Tabs.Screen
          name="today"
          options={{
            title: 'დღეს',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="today-outline" size={size} color={color} />
            ),
          }}
        />

        {/* All Tasks Tab (System) */}
        <Tabs.Screen
          name="all"
          options={{
            title: 'ყველა',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="list-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Custom Tabs - We'll handle these dynamically */}
        <Tabs.Screen
          name="custom/[id]"
          options={{
            href: null, // Hide from tab bar, we'll show custom tabs separately
          }}
        />

        {/* Settings */}
        <Tabs.Screen
          name="settings"
          options={{
            title: 'პარამეტრები',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>

      {/* Add Tab Modal */}
      <Modal visible={showAddTab} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>ახალი ტაბი</Text>
            <TextInput
              style={styles.modalInput}
              value={newTabName}
              onChangeText={setNewTabName}
              placeholder="ტაბის სახელი"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowAddTab(false)}
              >
                <Text style={styles.modalButtonText}>გაუქმება</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleAddTab}
              >
                <Text style={styles.modalButtonTextPrimary}>დამატება</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Conflict Resolution Modal */}
      <ConflictModal
        visible={showConflicts}
        conflicts={conflicts}
        onResolve={resolveConflict}
        onClose={() => setShowConflicts(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    gap: 12,
  },
  syncIndicator: {
    padding: 4,
  },
  addTabButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  modalButtonPrimary: {
    backgroundColor: '#3b82f6',
  },
  modalButtonTextPrimary: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
