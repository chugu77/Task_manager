import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useStore } from '../../src/store/useStore';
import { TaskItem } from '../../src/components/TaskItem';
import { AddTaskInput } from '../../src/components/AddTaskInput';
import type { Task } from '../../src/types';

export default function TodayScreen() {
  const {
    tasks,
    loadTasks,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    triggerSync,
  } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<number | null>(null);

  useEffect(() => {
    loadTasks('today');
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await triggerSync();
    await loadTasks('today');
    setRefreshing(false);
  };

  const handleAddTask = async (title: string, dueDate?: string) => {
    const today = new Date().toISOString().split('T')[0];
    await createTask({
      title,
      due_date: dueDate || today, // Default to today for this view
      parent_task_id: addingSubtaskTo || undefined,
    });
    setAddingSubtaskTo(null);
    await loadTasks('today');
  };

  const handleToggleComplete = async (clientId: string, isCompleted: boolean) => {
    await completeTask(clientId, isCompleted);
  };

  const handleDelete = async (clientId: string) => {
    await deleteTask(clientId);
    await loadTasks('today');
  };

  const handleEdit = async (clientId: string, title: string) => {
    await updateTask(clientId, { title });
  };

  const handleAddSubtask = (parentTaskId: number) => {
    setAddingSubtaskTo(parentTaskId);
  };

  // Build tree structure for display
  const buildTaskTree = (tasks: Task[]): Task[] => {
    const taskMap = new Map<number, Task & { children?: Task[] }>();
    const rootTasks: Task[] = [];

    // First pass: create map
    tasks.forEach((task) => {
      taskMap.set(task.id, { ...task, children: [] });
    });

    // Second pass: build tree
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

    // Flatten tree for FlatList (preserving hierarchy via depth)
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

  const displayTasks = buildTaskTree(tasks.filter((t) => !t.is_completed));
  const completedTasks = tasks.filter((t) => t.is_completed);

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
            <Text style={styles.title}>დღეს</Text>
            <Text style={styles.subtitle}>
              {displayTasks.length} ტასკი
              {completedTasks.length > 0 && ` • ${completedTasks.length} შესრულებული`}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>დღეს ტასკები არ გაქვთ</Text>
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
          placeholder={addingSubtaskTo ? 'ქვეტასკის დამატება...' : 'ახალი ტასკი დღეისთვის...'}
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
