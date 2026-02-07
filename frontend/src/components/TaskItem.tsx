import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Task } from '../types';

interface TaskItemProps {
  task: Task;
  onToggleComplete: (clientId: string, isCompleted: boolean) => void;
  onDelete: (clientId: string) => void;
  onAddSubtask: (parentTaskId: number) => void;
  onEdit: (clientId: string, title: string) => void;
}

export function TaskItem({
  task,
  onToggleComplete,
  onDelete,
  onAddSubtask,
  onEdit,
}: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.title);
  const [showActions, setShowActions] = useState(false);

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onEdit(task.client_id, editText.trim());
    }
    setIsEditing(false);
  };

  const canAddSubtask = task.depth < 2; // Max 3 levels (0, 1, 2)
  const indent = task.depth * 24;

  const formatDueDate = (date?: string) => {
    if (!date) return null;
    const d = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const isToday = d.toDateString() === today.toDateString();
    const isOverdue = d < today;
    
    if (isToday) return { text: 'დღეს', color: '#f59e0b' };
    if (isOverdue) return { text: 'ვადაგასული', color: '#ef4444' };
    return { text: d.toLocaleDateString('ka-GE'), color: '#6b7280' };
  };

  const dueInfo = formatDueDate(task.due_date);

  return (
    <TouchableOpacity
      style={[styles.container, { marginLeft: indent }]}
      onPress={() => setShowActions(!showActions)}
      activeOpacity={0.7}
    >
      <View style={styles.mainRow}>
        {/* Checkbox */}
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => onToggleComplete(task.client_id, !task.is_completed)}
        >
          <Ionicons
            name={task.is_completed ? 'checkbox' : 'square-outline'}
            size={24}
            color={task.is_completed ? '#10b981' : '#6b7280'}
          />
        </TouchableOpacity>

        {/* Task content */}
        <View style={styles.content}>
          {isEditing ? (
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              onBlur={handleSaveEdit}
              onSubmitEditing={handleSaveEdit}
              autoFocus
            />
          ) : (
            <Text
              style={[
                styles.title,
                task.is_completed && styles.completedText,
              ]}
            >
              {task.title}
            </Text>
          )}

          {/* Due date badge */}
          {dueInfo && !task.is_completed && (
            <View style={[styles.dueBadge, { backgroundColor: dueInfo.color + '20' }]}>
              <Ionicons name="calendar-outline" size={12} color={dueInfo.color} />
              <Text style={[styles.dueText, { color: dueInfo.color }]}>
                {dueInfo.text}
              </Text>
            </View>
          )}
        </View>

        {/* Has incomplete children indicator */}
        {task.has_incomplete_children && (
          <View style={styles.childrenIndicator}>
            <Ionicons name="git-branch-outline" size={16} color="#f59e0b" />
          </View>
        )}
      </View>

      {/* Action buttons (shown on tap) */}
      {showActions && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setIsEditing(true)}
          >
            <Ionicons name="pencil" size={18} color="#6b7280" />
          </TouchableOpacity>

          {canAddSubtask && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onAddSubtask(task.id)}
            >
              <Ionicons name="add-circle-outline" size={18} color="#6b7280" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onDelete(task.client_id)}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      },
    }),
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    color: '#1f2937',
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  editInput: {
    fontSize: 16,
    color: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#3b82f6',
    paddingVertical: 2,
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  dueText: {
    fontSize: 12,
    fontWeight: '500',
  },
  childrenIndicator: {
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 16,
  },
  actionButton: {
    padding: 4,
  },
});
