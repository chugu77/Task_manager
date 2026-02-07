import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ConflictData } from '../types';

interface ConflictModalProps {
  visible: boolean;
  conflicts: ConflictData[];
  onResolve: (clientId: string, entityType: 'tab' | 'task', resolution: 'keep_server' | 'keep_client') => void;
  onClose: () => void;
}

export function ConflictModal({
  visible,
  conflicts,
  onResolve,
  onClose,
}: ConflictModalProps) {
  if (conflicts.length === 0) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="alert-circle" size={24} color="#f59e0b" />
            </View>
            <Text style={styles.title}>სინქრონიზაციის კონფლიქტი</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            ზოგიერთი ელემენტი შეიცვალა როგორც ამ მოწყობილობაზე, ასევე სერვერზე.
            გთხოვთ აირჩიოთ რომელი ვერსია შეინახოთ.
          </Text>

          <ScrollView style={styles.conflictList}>
            {conflicts.map((conflict) => (
              <View key={conflict.client_id} style={styles.conflictItem}>
                <View style={styles.conflictInfo}>
                  <Ionicons
                    name={conflict.entity_type === 'tab' ? 'folder-outline' : 'checkbox-outline'}
                    size={20}
                    color="#6b7280"
                  />
                  <Text style={styles.conflictType}>
                    {conflict.entity_type === 'tab' ? 'ტაბი' : 'ტასკი'}
                  </Text>
                </View>

                <View style={styles.conflictActions}>
                  <TouchableOpacity
                    style={[styles.resolveButton, styles.serverButton]}
                    onPress={() => onResolve(conflict.client_id, conflict.entity_type, 'keep_server')}
                  >
                    <Ionicons name="cloud-outline" size={16} color="#3b82f6" />
                    <Text style={styles.serverButtonText}>სერვერის</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.resolveButton, styles.localButton]}
                    onPress={() => onResolve(conflict.client_id, conflict.entity_type, 'keep_client')}
                  >
                    <Ionicons name="phone-portrait-outline" size={16} color="#10b981" />
                    <Text style={styles.localButtonText}>ლოკალური</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerIcon: {
    marginRight: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  conflictList: {
    maxHeight: 400,
  },
  conflictItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  conflictInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  conflictType: {
    fontSize: 14,
    color: '#6b7280',
  },
  conflictActions: {
    flexDirection: 'row',
    gap: 8,
  },
  resolveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  serverButton: {
    backgroundColor: '#eff6ff',
  },
  serverButtonText: {
    color: '#3b82f6',
    fontWeight: '500',
  },
  localButton: {
    backgroundColor: '#ecfdf5',
  },
  localButtonText: {
    color: '#10b981',
    fontWeight: '500',
  },
});
