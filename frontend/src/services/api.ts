import { config } from '../config';
import type {
  User,
  Tab,
  TabCreate,
  Task,
  TaskCreate,
  TaskUpdate,
  SyncPullRequest,
  SyncPushRequest,
  SyncResponse,
  ConflictData,
  ConflictResolution,
} from '../types';

const API_URL = config.apiUrl;

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async googleAuth(idToken: string): Promise<{ access_token: string; user: User }> {
    return this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
    });
  }

  async getMe(): Promise<User> {
    return this.request('/auth/me');
  }

  // Tabs
  async getTabs(): Promise<Tab[]> {
    return this.request('/tabs');
  }

  async createTab(tab: TabCreate): Promise<Tab> {
    return this.request('/tabs', {
      method: 'POST',
      body: JSON.stringify(tab),
    });
  }

  async updateTab(tabId: number, data: Partial<TabCreate>): Promise<Tab> {
    return this.request(`/tabs/${tabId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTab(tabId: number): Promise<void> {
    return this.request(`/tabs/${tabId}`, {
      method: 'DELETE',
    });
  }

  // Tasks
  async getTodayTasks(): Promise<Task[]> {
    return this.request('/tasks/today');
  }

  async getAllTasks(includeCompleted = true): Promise<Task[]> {
    return this.request(`/tasks/all?include_completed=${includeCompleted}`);
  }

  async getTasksByTab(tabId: number, includeCompleted = false): Promise<Task[]> {
    return this.request(`/tasks/tab/${tabId}?include_completed=${includeCompleted}`);
  }

  async createTask(task: TaskCreate): Promise<Task> {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async updateTask(taskId: number, data: TaskUpdate): Promise<Task> {
    return this.request(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async completeTask(taskId: number, isCompleted: boolean): Promise<Task> {
    return this.request(`/tasks/${taskId}/complete`, {
      method: 'PUT',
      body: JSON.stringify({ is_completed: isCompleted }),
    });
  }

  async deleteTask(taskId: number): Promise<void> {
    return this.request(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  async moveTask(taskId: number, newTabId: number): Promise<Task> {
    return this.request(`/tasks/${taskId}/move?new_tab_id=${newTabId}`, {
      method: 'PUT',
    });
  }

  // Sync (for mobile)
  async syncPull(request: SyncPullRequest): Promise<SyncResponse> {
    return this.request('/sync/pull', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async syncPush(request: SyncPushRequest): Promise<ConflictData> {
    return this.request('/sync/push', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async syncBatchPush(items: SyncPushRequest[]): Promise<{
    synced_count: number;
    synced_ids: string[];
    conflicts: ConflictData[];
  }> {
    return this.request('/sync/batch-push', {
      method: 'POST',
      body: JSON.stringify(items),
    });
  }

  async resolveConflict(resolution: ConflictResolution): Promise<{ success: boolean }> {
    return this.request('/sync/resolve', {
      method: 'POST',
      body: JSON.stringify(resolution),
    });
  }
}

export const api = new ApiService();

// Type for conflict resolution
interface ConflictResolution {
  client_id: string;
  entity_type: 'tab' | 'task';
  resolution: 'keep_server' | 'keep_client';
  client_data?: Record<string, unknown>;
}
