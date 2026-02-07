import { AppState, AppStateStatus } from 'react-native';
import { api } from './api';
import { localDb } from './localDb';
import { config } from '../config';
import type { ConflictData, LocalTab, LocalTask, SyncPushRequest } from '../types';

export type SyncState = 'idle' | 'syncing' | 'error';

type SyncListener = (state: SyncState, conflicts?: ConflictData[]) => void;

class SyncService {
  private intervalId: NodeJS.Timeout | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private listeners: Set<SyncListener> = new Set();
  private currentState: SyncState = 'idle';
  private pendingConflicts: ConflictData[] = [];

  /**
   * Initialize sync service (call on app start after authentication)
   */
  async init(): Promise<void> {
    // Only initialize on mobile
    if (!config.isMobile) return;

    // Initialize local database
    await localDb.init();

    // Set up periodic sync
    this.startPeriodicSync();

    // Set up app state listener for exit sync
    this.setupAppStateListener();
  }

  /**
   * Add listener for sync state changes
   */
  addListener(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => 
      listener(this.currentState, this.pendingConflicts)
    );
  }

  private setState(state: SyncState, conflicts?: ConflictData[]): void {
    this.currentState = state;
    if (conflicts) {
      this.pendingConflicts = conflicts;
    }
    this.notifyListeners();
  }

  /**
   * Start periodic sync (every X minutes)
   */
  private startPeriodicSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    const intervalMs = config.syncIntervalMinutes * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.sync();
    }, intervalMs);
  }

  /**
   * Set up app state listener for syncing when app goes to background
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  private async handleAppStateChange(nextState: AppStateStatus): Promise<void> {
    // Sync when app goes to background or becomes inactive
    if (nextState === 'background' || nextState === 'inactive') {
      await this.sync();
    }
  }

  /**
   * Perform full sync (pull then push)
   */
  async sync(): Promise<void> {
    if (this.currentState === 'syncing') {
      return; // Already syncing
    }

    this.setState('syncing');

    try {
      // Step 1: Pull changes from server
      await this.pull();

      // Step 2: Push local changes
      await this.push();

      this.setState('idle');
    } catch (error) {
      console.error('Sync error:', error);
      this.setState('error');
    }
  }

  /**
   * Pull changes from server
   */
  async pull(): Promise<void> {
    const deviceId = await localDb.getDeviceId();
    const lastSyncAt = await localDb.getLastSyncTime();

    const response = await api.syncPull({
      device_id: deviceId,
      last_sync_at: lastSyncAt || undefined,
    });

    // Apply server changes to local database
    for (const tab of response.tabs) {
      await localDb.upsertFromServer('tab', tab as unknown as LocalTab);
    }

    for (const task of response.tasks) {
      await localDb.upsertFromServer('task', task as unknown as LocalTask);
    }

    // Update last sync time
    await localDb.setLastSyncTime(response.sync_timestamp);
  }

  /**
   * Push local changes to server
   */
  async push(): Promise<void> {
    const { tabs, tasks } = await localDb.getPendingChanges();
    const deviceId = await localDb.getDeviceId();

    const conflicts: ConflictData[] = [];

    // Push tabs
    for (const tab of tabs) {
      const request: SyncPushRequest = {
        device_id: deviceId,
        client_id: tab.client_id,
        entity_type: 'tab',
        data: {
          name: tab.name,
          order_index: tab.order_index,
          is_deleted: tab.is_deleted,
        },
        client_updated_at: tab.updated_at,
      };

      const result = await api.syncPush(request);
      
      if (result.has_conflict) {
        conflicts.push(result);
        await localDb.markAsConflict('tab', tab.client_id);
      } else {
        await localDb.markAsSynced('tab', tab.client_id, new Date().toISOString());
      }
    }

    // Push tasks
    for (const task of tasks) {
      const request: SyncPushRequest = {
        device_id: deviceId,
        client_id: task.client_id,
        entity_type: 'task',
        data: {
          tab_id: task.tab_id,
          parent_task_id: task.parent_task_id,
          title: task.title,
          description: task.description,
          is_completed: task.is_completed,
          due_date: task.due_date,
          due_time: task.due_time,
          is_deleted: task.is_deleted,
        },
        client_updated_at: task.updated_at,
      };

      const result = await api.syncPush(request);
      
      if (result.has_conflict) {
        conflicts.push(result);
        await localDb.markAsConflict('task', task.client_id);
      } else {
        await localDb.markAsSynced('task', task.client_id, new Date().toISOString());
      }
    }

    // If there are conflicts, notify listeners
    if (conflicts.length > 0) {
      this.pendingConflicts = conflicts;
      this.notifyListeners();
    }
  }

  /**
   * Resolve a single conflict
   */
  async resolveConflict(
    clientId: string,
    entityType: 'tab' | 'task',
    resolution: 'keep_server' | 'keep_client'
  ): Promise<void> {
    if (resolution === 'keep_server') {
      // Re-pull the server data
      await this.pull();
    } else {
      // Push client data with force
      const result = await api.resolveConflict({
        client_id: clientId,
        entity_type: entityType,
        resolution,
      });

      if (result.success) {
        await localDb.markAsSynced(entityType, clientId, new Date().toISOString());
      }
    }

    // Remove from pending conflicts
    this.pendingConflicts = this.pendingConflicts.filter(
      (c) => c.client_id !== clientId
    );
    this.notifyListeners();
  }

  /**
   * Get current sync state
   */
  getState(): { state: SyncState; conflicts: ConflictData[] } {
    return {
      state: this.currentState,
      conflicts: this.pendingConflicts,
    };
  }

  /**
   * Cleanup (call on logout or app unmount)
   */
  cleanup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.listeners.clear();
  }

  /**
   * Manual sync trigger
   */
  async manualSync(): Promise<void> {
    await this.sync();
  }
}

export const syncService = new SyncService();
