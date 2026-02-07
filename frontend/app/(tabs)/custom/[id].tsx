import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../../src/store/useStore';
import { TaskItem } from '../../../src/components/TaskItem';
import { AddTaskInput } from '../../../src/components/AddTaskInput';
import type { Task } from '../../../src/types';

export default function CustomTabScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tabId = parseInt(id, 10);

  const {
    tabs,
    tasks,
    loadTasks,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    deleteTab,
    triggerSync,
  } = useStore();

  const [refreshing, setRefreshing] = useState(false);
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<number | null>(null);

  const tab = tabs.find((t) => t.id === tabId);

  useEffect(() => {
    if (tabId) {
      loadTasks('custom', tabId);
    }
  }, [tabId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await triggerSync();
    await loadTasks('custom', tabId);
    setRefreshing(false);
  };

  const handleAddTask = async (title: string, dueDate?: string) => {
    await createTask({
      title,
      due_date: dueDate,
      tab_id: tabId,
      parent_task_id: addingSubtaskTo || undefined,
    });
    setAddingSubtaskTo(null);
    await loadTasks('custom', tabId);
  };

  const handleToggleComplete = async (clientId: string, isCompleted: boolean) => {
    await completeTask(clientId, isCompleted);
  };

  const handleDelete = async (clientId: string) => {
    await deleteTask(clientId);
    await loadTasks('custom', tabId);
  };

  const handleEdit = async (clientId: string, title: string) => {
    await updateTask(clientId, { title });
  };

  const handleAddSubtask = (parentTaskId: number) => {
    setAddingSubtaskTo(parentTaskId);
  };

  const handleDeleteTab = () => {
    Alert.alert(
      'ტაბის წაშლა',
      `ნამდვილად გსურთ "${tab?.name}" ტაბის წაშლა? ტასკები გადავა "ყველა" ტაბში.`,
      [
        { text: 'გაუქმება', style: 'cancel' },
        {
          text: 'წაშლა',
          style: 'destructive',
          onPress: async () => {
            await deleteTab(tabId);
            router.replace('/(tabs)/all');
          },
        },
      ]
    );
  };

  // Build tree structure
  const buildTaskTree = (tasks: Task[]): Task[] => {
    const taskMap = new Map<number, Task & { children?: Task[] }>();
    const rootTasks: Task[] = [];

    tasks.forEach((task) => {
      taskMap.set(task.id, { ...task, children: [] });
    });

    tasks.forEach((task) => {
      const taskWithChildren = taskMap.get(task.id)!;
      if (task.parent_task_id) {
        const parent = taskMap.get(task.parent_task_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(taskWithChildren);
        } else {
          rootTasks.push(taskWithChildren);
        }
      } else {
        rootTasks.push(taskWithChildren);
      }
    });

    const flattenTree = (tasks: Task[], result: Task[] = []): Task[] => {
      tasks.forEach((task) => {
        result.push(task);
        if ((task as any).children?.length > 0) {
          flattenTree((task as any).children, result);
        }
      });
      return result;
    };

    return flattenTree(rootTasks);
  };

  const tabTasks = tasks.filter((t) => t.tab_id === tabId);
  const displayTasks = buildTaskTree(tabTasks.filter((t) => !t.is_completed));

  if (!tab) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>ტაბი ვერ მოიძებნა</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={displayTasks}
        keyExtractor={(item) => item.client_id}
        renderItem={({ item }) => (
          <TaskItem
            task={item}
            onToggleComplete={handleToggleComplete}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onAddSubtask={handleAddSubtask}
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{tab.name}</Text>
              <TouchableOpacity onPress={handleDeleteTab}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>{displayTasks.length} ტასკი</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>ტასკები არ არის</Text>
            <Text style={styles.emptySubtext}>დაამატეთ ახალი ტასკი ქვემოთ</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      <View style={styles.inputContainer}>
        <AddTaskInput
          onAdd={handleAddTask}
          placeholder={addingSubtaskTo ? 'ქვეტასკის დამატება...' : 'ახალი ტასკი...'}
        />
        {addingSubtaskTo && (
          <Text
            style={styles.cancelSubtask}
            onPress={() => setAddingSubtaskTo(null)}
          >
            გაუქმება
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 48,
  },
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  cancelSubtask: {
    textAlign: 'center',
    color: '#ef4444',
    marginTop: 8,
    fontSize: 14,
  },
});
