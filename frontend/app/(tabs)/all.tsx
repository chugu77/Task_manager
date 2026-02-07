import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../src/store/useStore';
import { TaskItem } from '../../src/components/TaskItem';
import { AddTaskInput } from '../../src/components/AddTaskInput';
import type { Task } from '../../src/types';

export default function AllTasksScreen() {
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
  const [showCompleted, setShowCompleted] = useState(true);
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<number | null>(null);

  useEffect(() => {
    loadTasks('all');
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await triggerSync();
    await loadTasks('all');
    setRefreshing(false);
  };

  const handleAddTask = async (title: string, dueDate?: string) => {
    await createTask({
      title,
      due_date: dueDate,
      parent_task_id: addingSubtaskTo || undefined,
    });
    setAddingSubtaskTo(null);
    await loadTasks('all');
  };

  const handleToggleComplete = async (clientId: string, isCompleted: boolean) => {
    await completeTask(clientId, isCompleted);
    await loadTasks('all');
  };

  const handleDelete = async (clientId: string) => {
    await deleteTask(clientId);
    await loadTasks('all');
  };

  const handleEdit = async (clientId: string, title: string) => {
    await updateTask(clientId, { title });
  };

  const handleAddSubtask = (parentTaskId: number) => {
    setAddingSubtaskTo(parentTaskId);
  };

  // Build tree and flatten
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

  const activeTasks = buildTaskTree(tasks.filter((t) => !t.is_completed));
  const completedTasks = buildTaskTree(tasks.filter((t) => t.is_completed));

  const sections = [
    { title: 'აქტიური', data: activeTasks },
    ...(showCompleted ? [{ title: 'შესრულებული', data: completedTasks }] : []),
  ];

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
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
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>ყველა ტასკი</Text>
            <TouchableOpacity
              style={styles.toggleCompleted}
              onPress={() => setShowCompleted(!showCompleted)}
            >
              <Ionicons
                name={showCompleted ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#6b7280"
              />
              <Text style={styles.toggleText}>
                {showCompleted ? 'დამალე' : 'აჩვენე'} შესრულებული
              </Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>ტასკები არ არის</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        stickySectionHeadersEnabled={false}
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
  },
  toggleCompleted: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  toggleText: {
    fontSize: 14,
    color: '#6b7280',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  sectionCount: {
    fontSize: 14,
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
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
