import * as SQLite from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';
import type { LocalTask, LocalTab, SyncStatus, TaskCreate, TabCreate } from '../types';

const DB_NAME = 'taskmanager.db';

class LocalDatabase {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    this.db = await SQLite.openDatabaseAsync(DB_NAME);
    await this.createTables();
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      -- Tabs table
      CREATE TABLE IF NOT EXISTS tabs (
        id INTEGER PRIMARY KEY,
        client_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        order_index INTEGER DEFAULT 0,
        is_system INTEGER DEFAULT 0,
        tab_type TEXT DEFAULT 'custom',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_deleted INTEGER DEFAULT 0,
        sync_status TEXT DEFAULT 'pending',
        server_updated_at TEXT
      );

      -- Tasks table
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY,
        client_id TEXT UNIQUE NOT NULL,
        tab_id INTEGER,
        parent_task_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        is_completed INTEGER DEFAULT 0,
        due_date TEXT,
        due_time TEXT,
        depth INTEGER DEFAULT 0,
        order_index INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        is_deleted INTEGER DEFAULT 0,
        sync_status TEXT DEFAULT 'pending',
        server_updated_at TEXT,
        FOREIGN KEY (tab_id) REFERENCES tabs(id),
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id)
      );

      -- Sync metadata table
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_tasks_tab_id ON tasks(tab_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_task_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
      CREATE INDEX IF NOT EXISTS idx_tasks_sync_status ON tasks(sync_status);
      CREATE INDEX IF NOT EXISTS idx_tabs_sync_status ON tabs(sync_status);
    `);
  }

  // Sync metadata
  async getLastSyncTime(): Promise<string | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM sync_metadata WHERE key = ?',
      ['last_sync_at']
    );
    return result?.value || null;
  }

  async setLastSyncTime(timestamp: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(
      'INSERT OR REPLACE INTO sync_metadata (key, value) VALUES (?, ?)',
      ['last_sync_at', timestamp]
    );
  }

  async getDeviceId(): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM sync_metadata WHERE key = ?',
      ['device_id']
    );
    
    if (result?.value) {
      return result.value;
    }
    
    const deviceId = uuidv4();
    await this.db.runAsync(
      'INSERT INTO sync_metadata (key, value) VALUES (?, ?)',
      ['device_id', deviceId]
    );
    return deviceId;
  }

  // Tabs
  async getAllTabs(): Promise<LocalTab[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.getAllAsync<LocalTab>(
      'SELECT * FROM tabs WHERE is_deleted = 0 ORDER BY order_index'
    );
    return rows;
  }

  async createTab(tab: TabCreate): Promise<LocalTab> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO tabs (client_id, name, order_index, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [tab.client_id, tab.name, tab.order_index || 0, now, now]
    );
    
    const result = await this.db.getFirstAsync<LocalTab>(
      'SELECT * FROM tabs WHERE client_id = ?',
      [tab.client_id]
    );
    return result!;
  }

  async updateTab(clientId: string, data: Partial<LocalTab>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?', "sync_status = 'pending'"];
    const values: (string | number)[] = [now];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.order_index !== undefined) {
      updates.push('order_index = ?');
      values.push(data.order_index);
    }
    
    values.push(clientId);
    
    await this.db.runAsync(
      `UPDATE tabs SET ${updates.join(', ')} WHERE client_id = ?`,
      values
    );
  }

  async deleteTab(clientId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE tabs SET is_deleted = 1, updated_at = ?, sync_status = 'pending' WHERE client_id = ?`,
      [now, clientId]
    );
  }

  // Tasks
  async getAllTasks(): Promise<LocalTask[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.getAllAsync<LocalTask>(
      'SELECT * FROM tasks WHERE is_deleted = 0 ORDER BY depth, order_index'
    );
    return rows;
  }

  async getTasksByTab(tabId: number | null): Promise<LocalTask[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const query = tabId !== null
      ? 'SELECT * FROM tasks WHERE tab_id = ? AND is_deleted = 0 ORDER BY depth, order_index'
      : 'SELECT * FROM tasks WHERE is_deleted = 0 ORDER BY depth, order_index';
    
    const params = tabId !== null ? [tabId] : [];
    const rows = await this.db.getAllAsync<LocalTask>(query, params);
    return rows;
  }

  async getTodayTasks(): Promise<LocalTask[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const today = new Date().toISOString().split('T')[0];
    const rows = await this.db.getAllAsync<LocalTask>(
      `SELECT * FROM tasks 
       WHERE is_deleted = 0 
         AND is_completed = 0
         AND (due_date IS NULL OR due_date <= ?)
       ORDER BY due_date, order_index`,
      [today]
    );
    return rows;
  }

  async createTask(task: TaskCreate): Promise<LocalTask> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = new Date().toISOString();
    
    // Calculate depth based on parent
    let depth = 0;
    if (task.parent_task_id) {
      const parent = await this.db.getFirstAsync<{ depth: number }>(
        'SELECT depth FROM tasks WHERE id = ?',
        [task.parent_task_id]
      );
      if (parent) {
        depth = parent.depth + 1;
        if (depth > 2) {
          throw new Error('Maximum depth is 3 levels');
        }
      }
    }
    
    // Get max order_index for this level
    const maxOrder = await this.db.getFirstAsync<{ max_order: number }>(
      `SELECT COALESCE(MAX(order_index), 0) as max_order FROM tasks 
       WHERE COALESCE(parent_task_id, 0) = ? AND is_deleted = 0`,
      [task.parent_task_id || 0]
    );
    
    await this.db.runAsync(
      `INSERT INTO tasks (client_id, tab_id, parent_task_id, title, description, 
        due_date, due_time, depth, order_index, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        task.client_id,
        task.tab_id || null,
        task.parent_task_id || null,
        task.title,
        task.description || null,
        task.due_date || null,
        task.due_time || null,
        depth,
        (maxOrder?.max_order || 0) + 1,
        now,
        now,
      ]
    );
    
    const result = await this.db.getFirstAsync<LocalTask>(
      'SELECT * FROM tasks WHERE client_id = ?',
      [task.client_id]
    );
    return result!;
  }

  async updateTask(clientId: string, data: Partial<LocalTask>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?', "sync_status = 'pending'"];
    const values: (string | number | null)[] = [now];
    
    if (data.title !== undefined) {
      updates.push('title = ?');
      values.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.due_date !== undefined) {
      updates.push('due_date = ?');
      values.push(data.due_date || null);
    }
    if (data.due_time !== undefined) {
      updates.push('due_time = ?');
      values.push(data.due_time || null);
    }
    if (data.tab_id !== undefined) {
      updates.push('tab_id = ?');
      values.push(data.tab_id);
    }
    
    values.push(clientId);
    
    await this.db.runAsync(
      `UPDATE tasks SET ${updates.join(', ')} WHERE client_id = ?`,
      values
    );
  }

  async completeTask(clientId: string, isCompleted: boolean): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = new Date().toISOString();
    
    // Check for incomplete children
    if (isCompleted) {
      const task = await this.db.getFirstAsync<{ id: number }>(
        'SELECT id FROM tasks WHERE client_id = ?',
        [clientId]
      );
      
      if (task) {
        const incompleteChildren = await this.db.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) as count FROM tasks WHERE parent_task_id = ? AND is_completed = 0 AND is_deleted = 0',
          [task.id]
        );
        
        if (incompleteChildren && incompleteChildren.count > 0) {
          // Has incomplete children - just mark this task but it won't be archived
        }
      }
    }
    
    await this.db.runAsync(
      `UPDATE tasks SET is_completed = ?, completed_at = ?, updated_at = ?, sync_status = 'pending'
       WHERE client_id = ?`,
      [isCompleted ? 1 : 0, isCompleted ? now : null, now, clientId]
    );
    
    // If uncompleting, also uncomplete parent chain
    if (!isCompleted) {
      const task = await this.db.getFirstAsync<{ parent_task_id: number | null }>(
        'SELECT parent_task_id FROM tasks WHERE client_id = ?',
        [clientId]
      );
      
      if (task?.parent_task_id) {
        await this.uncompleteParentChain(task.parent_task_id);
      }
    }
    
    // If completing, check if all siblings are complete and auto-complete parent
    if (isCompleted) {
      const task = await this.db.getFirstAsync<{ parent_task_id: number | null }>(
        'SELECT parent_task_id FROM tasks WHERE client_id = ?',
        [clientId]
      );
      
      if (task?.parent_task_id) {
        await this.checkAndCompleteParent(task.parent_task_id);
      }
    }
  }

  private async uncompleteParentChain(parentId: number): Promise<void> {
    if (!this.db) return;
    
    const now = new Date().toISOString();
    
    // Get parent
    const parent = await this.db.getFirstAsync<{ id: number; parent_task_id: number | null }>(
      'SELECT id, parent_task_id FROM tasks WHERE id = ?',
      [parentId]
    );
    
    if (parent) {
      await this.db.runAsync(
        `UPDATE tasks SET is_completed = 0, completed_at = NULL, updated_at = ?, sync_status = 'pending'
         WHERE id = ?`,
        [now, parent.id]
      );
      
      if (parent.parent_task_id) {
        await this.uncompleteParentChain(parent.parent_task_id);
      }
    }
  }

  private async checkAndCompleteParent(parentId: number): Promise<void> {
    if (!this.db) return;
    
    const incompleteChildren = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM tasks WHERE parent_task_id = ? AND is_completed = 0 AND is_deleted = 0',
      [parentId]
    );
    
    if (!incompleteChildren || incompleteChildren.count === 0) {
      const now = new Date().toISOString();
      
      await this.db.runAsync(
        `UPDATE tasks SET is_completed = 1, completed_at = ?, updated_at = ?, sync_status = 'pending'
         WHERE id = ?`,
        [now, now, parentId]
      );
      
      // Check parent's parent
      const parent = await this.db.getFirstAsync<{ parent_task_id: number | null }>(
        'SELECT parent_task_id FROM tasks WHERE id = ?',
        [parentId]
      );
      
      if (parent?.parent_task_id) {
        await this.checkAndCompleteParent(parent.parent_task_id);
      }
    }
  }

  async deleteTask(clientId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = new Date().toISOString();
    
    // Get task id
    const task = await this.db.getFirstAsync<{ id: number }>(
      'SELECT id FROM tasks WHERE client_id = ?',
      [clientId]
    );
    
    if (task) {
      // Delete task and all children
      await this.deleteTaskAndChildren(task.id, now);
    }
  }

  private async deleteTaskAndChildren(taskId: number, now: string): Promise<void> {
    if (!this.db) return;
    
    // Get children
    const children = await this.db.getAllAsync<{ id: number }>(
      'SELECT id FROM tasks WHERE parent_task_id = ?',
      [taskId]
    );
    
    for (const child of children) {
      await this.deleteTaskAndChildren(child.id, now);
    }
    
    await this.db.runAsync(
      `UPDATE tasks SET is_deleted = 1, updated_at = ?, sync_status = 'pending' WHERE id = ?`,
      [now, taskId]
    );
  }

  // Sync helpers
  async getPendingChanges(): Promise<{ tabs: LocalTab[]; tasks: LocalTask[] }> {
    if (!this.db) throw new Error('Database not initialized');
    
    const tabs = await this.db.getAllAsync<LocalTab>(
      "SELECT * FROM tabs WHERE sync_status = 'pending'"
    );
    
    const tasks = await this.db.getAllAsync<LocalTask>(
      "SELECT * FROM tasks WHERE sync_status = 'pending'"
    );
    
    return { tabs, tasks };
  }

  async markAsSynced(entityType: 'tab' | 'task', clientId: string, serverUpdatedAt: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const table = entityType === 'tab' ? 'tabs' : 'tasks';
    
    await this.db.runAsync(
      `UPDATE ${table} SET sync_status = 'synced', server_updated_at = ? WHERE client_id = ?`,
      [serverUpdatedAt, clientId]
    );
  }

  async markAsConflict(entityType: 'tab' | 'task', clientId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const table = entityType === 'tab' ? 'tabs' : 'tasks';
    
    await this.db.runAsync(
      `UPDATE ${table} SET sync_status = 'conflict' WHERE client_id = ?`,
      [clientId]
    );
  }

  async upsertFromServer(entityType: 'tab' | 'task', data: LocalTab | LocalTask): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    if (entityType === 'tab') {
      const tab = data as LocalTab;
      await this.db.runAsync(
        `INSERT OR REPLACE INTO tabs 
         (id, client_id, name, order_index, is_system, tab_type, created_at, updated_at, is_deleted, sync_status, server_updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
        [tab.id, tab.client_id, tab.name, tab.order_index, tab.is_system ? 1 : 0, 
         tab.tab_type, tab.created_at, tab.updated_at, tab.is_deleted ? 1 : 0, tab.updated_at]
      );
    } else {
      const task = data as LocalTask;
      await this.db.runAsync(
        `INSERT OR REPLACE INTO tasks 
         (id, client_id, tab_id, parent_task_id, title, description, is_completed, 
          due_date, due_time, depth, order_index, created_at, updated_at, completed_at, 
          is_deleted, sync_status, server_updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
        [task.id, task.client_id, task.tab_id, task.parent_task_id, task.title,
         task.description, task.is_completed ? 1 : 0, task.due_date, task.due_time,
         task.depth, task.order_index, task.created_at, task.updated_at, task.completed_at,
         task.is_deleted ? 1 : 0, task.updated_at]
      );
    }
  }

  async getConflicts(): Promise<{ tabs: LocalTab[]; tasks: LocalTask[] }> {
    if (!this.db) throw new Error('Database not initialized');
    
    const tabs = await this.db.getAllAsync<LocalTab>(
      "SELECT * FROM tabs WHERE sync_status = 'conflict'"
    );
    
    const tasks = await this.db.getAllAsync<LocalTask>(
      "SELECT * FROM tasks WHERE sync_status = 'conflict'"
    );
    
    return { tabs, tasks };
  }
}

export const localDb = new LocalDatabase();
