import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AddTaskInputProps {
  onAdd: (title: string, dueDate?: string) => void;
  placeholder?: string;
}

export function AddTaskInput({ onAdd, placeholder = 'ახალი ტასკი...' }: AddTaskInputProps) {
  const [text, setText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();

  const handleSubmit = () => {
    if (text.trim()) {
      onAdd(text.trim(), selectedDate);
      setText('');
      setSelectedDate(undefined);
    }
  };

  const handleSetToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    setShowDatePicker(false);
  };

  const handleSetTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow.toISOString().split('T')[0]);
    setShowDatePicker(false);
  };

  const handleClearDate = () => {
    setSelectedDate(undefined);
    setShowDatePicker(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
        />

        <TouchableOpacity
          style={[styles.iconButton, selectedDate && styles.iconButtonActive]}
          onPress={() => setShowDatePicker(!showDatePicker)}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={selectedDate ? '#3b82f6' : '#6b7280'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.addButton, !text.trim() && styles.addButtonDisabled]}
          onPress={handleSubmit}
          disabled={!text.trim()}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <View style={styles.dateOptions}>
          <TouchableOpacity style={styles.dateOption} onPress={handleSetToday}>
            <Ionicons name="today-outline" size={16} color="#6b7280" />
            <TextInput style={styles.dateOptionText} editable={false}>
              დღეს
            </TextInput>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dateOption} onPress={handleSetTomorrow}>
            <Ionicons name="arrow-forward-outline" size={16} color="#6b7280" />
            <TextInput style={styles.dateOptionText} editable={false}>
              ხვალ
            </TextInput>
          </TouchableOpacity>

          {selectedDate && (
            <TouchableOpacity style={styles.dateOption} onPress={handleClearDate}>
              <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
              <TextInput style={[styles.dateOptionText, { color: '#ef4444' }]} editable={false}>
                გაუქმება
              </TextInput>
            </TouchableOpacity>
          )}
        </View>
      )}

      {selectedDate && (
        <View style={styles.selectedDateBadge}>
          <Ionicons name="calendar" size={14} color="#3b82f6" />
          <TextInput style={styles.selectedDateText} editable={false}>
            {new Date(selectedDate).toLocaleDateString('ka-GE')}
          </TextInput>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
    }),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    paddingVertical: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
  },
  iconButtonActive: {
    backgroundColor: '#eff6ff',
  },
  addButton: {
    backgroundColor: '#3b82f6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  dateOptions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  dateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  dateOptionText: {
    fontSize: 14,
    color: '#6b7280',
  },
  selectedDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  selectedDateText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
  },
});
