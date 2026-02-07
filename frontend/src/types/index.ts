// User types
export interface User {
  id: number;
  email: string;
  name: string;
  avatar_url?: string;
}

// Tab types
export type TabType = 'today' | 'all_tasks' | 'custom';

export interface Tab {
  id: number;
  client_id: string;
  name: string;
  order_index: number;
  is_system: boolean;
  tab_type: TabType;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
}

export interface TabCreate {
  client_id: string;
  name: string;
  order_index?: number;
}

// Task types
export interface Task {
  id: number;
  client_id: string;
  tab_id: number | null;
  parent_task_id: number | null;
  title: string;
  description?: string;
  is_completed: boolean;
  due_date?: string;
  due_time?: string;
  depth: number;
  order_index: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  is_deleted?: boolean;
  has_incomplete_children?: boolean;
}

export interface TaskCreate {
  client_id: string;
  tab_id?: number;
  parent_task_id?: number;
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  tab_id?: number;
}

// Task with children (tree structure)
export interface TaskWithChildren extends Task {
  children: TaskWithChildren[];
}

// Sync types
export type SyncStatus = 'synced' | 'pending' | 'conflict';

export interface LocalTask extends Task {
  sync_status: SyncStatus;
  server_updated_at?: string;
}

export interface LocalTab extends Tab {
  sync_status: SyncStatus;
  server_updated_at?: string;
}

export interface SyncPullRequest {
  device_id: string;
  last_sync_at?: string;
}

export interface SyncPushRequest {
  device_id: string;
  client_id: string;
  entity_type: 'tab' | 'task';
  data: Record<string, unknown>;
  client_updated_at: string;
}

export interface ConflictData {
  has_conflict: boolean;
  entity_id?: number;
  client_id: string;
  entity_type: 'tab' | 'task';
  server_updated_at?: string;
  client_updated_at: string;
  server_data?: Task | Tab;
  client_data?: Task | Tab;
}

export interface SyncResponse {
  tabs: Tab[];
  tasks: Task[];
  sync_timestamp: string;
  conflicts: ConflictData[];
}

// Auth types
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Notification types
export interface AppNotification {
  id: number;
  task_id?: number;
  title: string;
  message?: string;
  notification_type: 'reminder' | 'due_soon' | 'overdue';
  scheduled_at: string;
  is_read: boolean;
}
