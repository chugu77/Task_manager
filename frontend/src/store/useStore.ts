import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { localDb } from '../services/localDb';
import { syncService } from '../services/syncService';
import { config } from '../config';
import type { User, Tab, Task, TaskCreate, TabCreate, ConflictData } from '../types';

interface AppState {
  // Auth
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Data
  tabs: Tab[];
  tasks: Task[];
  activeTabId: number | null;
  
  // Sync state (mobile only)
  syncState: 'idle' | 'syncing' | 'error';
  conflicts: ConflictData[];
  
  // Actions
  init: () => Promise<void>;
  login: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  
  // Tab actions
  loadTabs: () => Promise<void>;
  createTab: (name: string) => Promise<Tab>;
  updateTab: (tabId: number, name: string) => Promise<void>;
  deleteTab: (tabId: number) => Promise<void>;
  setActiveTab: (tabId: number | null) => void;
  
  // Task actions
  loadTasks: (tabType: 'today' | 'all' | 'custom', tabId?: number) => Promise<void>;
  createTask: (task: Omit<TaskCreate, 'client_id'>) => Promise<Task>;
  updateTask: (clientId: string, data: Partial<Task>) => Promise<void>;
  completeTask: (clientId: string, isCompleted: boolean) => Promise<void>;
  deleteTask: (clientId: string) => Promise<void>;
  
  // Sync actions (mobile only)
  triggerSync: () => Promise<void>;
  resolveConflict: (clientId: string, entityType: 'tab' | 'task', resolution: 'keep_server' | 'keep_client') => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  tabs: [],
  tasks: [],
  activeTabId: null,
  syncState: 'idle',
  conflicts: [],

  // Initialize app
  init: async () => {
    try {
      // Load token from storage
      const token = await AsyncStorage.getItem('auth_token');
      
      if (token) {
        api.setToken(token);
        
        try {
          const user = await api.getMe();
          set({ user, token, isAuthenticated: true });
          
          // Initialize sync service on mobile
          if (config.isMobile) {
            await syncService.init();
            
            // Listen for sync state changes
            syncService.addListener((state, conflicts) => {
              set({ syncState: state, conflicts: conflicts || [] });
            });
          }
          
          // Load initial data
          await get().loadTabs();
        } catch {
          // Token invalid, clear it
          await AsyncStorage.removeItem('auth_token');
          set({ token: null });
        }
      }
    } finally {
      set({ isLoading: false });
    }
  },

  // Auth
  login: async (idToken: string) => {
    const result = await api.googleAuth(idToken);
    
    api.setToken(result.access_token);
    await AsyncStorage.setItem('auth_token', result.access_token);
    
    set({
      user: result.user,
      token: result.access_token,
      isAuthenticated: true,
    });
    
    // Initialize sync service on mobile
    if (config.isMobile) {
      await syncService.init();
      syncService.addListener((state, conflicts) => {
        set({ syncState: state, conflicts: conflicts || [] });
      });
    }
    
    // Load initial data
    await get().loadTabs();
  },

  logout: async () => {
    api.setToken(null);
    await AsyncStorage.removeItem('auth_token');
    
    if (config.isMobile) {
      syncService.cleanup();
    }
    
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      tabs: [],
      tasks: [],
      activeTabId: null,
    });
  },

  // Tabs
  loadTabs: async () => {
    if (config.isMobile) {
      // Load from local database
      const tabs = await localDb.getAllTabs();
      set({ tabs: tabs as unknown as Tab[] });
    } else {
      // Load from server
      const tabs = await api.getTabs();
      set({ tabs });
    }
  },

  createTab: async (name: string) => {
    const clientId = uuidv4();
    
    if (config.isMobile) {
      const tab = await localDb.createTab({ client_id: clientId, name });
      set((state) => ({ tabs: [...state.tabs, tab as unknown as Tab] }));
      return tab as unknown as Tab;
    } else {
      const tab = await api.createTab({ client_id: clientId, name });
      set((state) => ({ tabs: [...state.tabs, tab] }));
      return tab;
    }
  },

  updateTab: async (tabId: number, name: string) => {
    if (config.isMobile) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (tab) {
        await localDb.updateTab(tab.client_id, { name });
        set((state) => ({
          tabs: state.tabs.map((t) => 
            t.id === tabId ? { ...t, name } : t
          ),
        }));
      }
    } else {
      const updated = await api.updateTab(tabId, { name });
      set((state) => ({
        tabs: state.tabs.map((t) => (t.id === tabId ? updated : t)),
      }));
    }
  },

  deleteTab: async (tabId: number) => {
    if (config.isMobile) {
      const tab = get().tabs.find((t) => t.id === tabId);
      if (tab) {
        await localDb.deleteTab(tab.client_id);
        set((state) => ({
          tabs: state.tabs.filter((t) => t.id !== tabId),
        }));
      }
    } else {
      await api.deleteTab(tabId);
      set((state) => ({
        tabs: state.tabs.filter((t) => t.id !== tabId),
      }));
    }
  },

  setActiveTab: (tabId: number | null) => {
    set({ activeTabId: tabId });
  },

  // Tasks
  loadTasks: async (tabType: 'today' | 'all' | 'custom', tabId?: number) => {
    if (config.isMobile) {
      let tasks;
      if (tabType === 'today') {
        tasks = await localDb.getTodayTasks();
      } else if (tabType === 'all') {
        tasks = await localDb.getAllTasks();
      } else if (tabId !== undefined) {
        tasks = await localDb.getTasksByTab(tabId);
      } else {
        tasks = await localDb.getAllTasks();
      }
      set({ tasks: tasks as unknown as Task[] });
    } else {
      let tasks;
      if (tabType === 'today') {
        tasks = await api.getTodayTasks();
      } else if (tabType === 'all') {
        tasks = await api.getAllTasks();
      } else if (tabId !== undefined) {
        tasks = await api.getTasksByTab(tabId);
      } else {
        tasks = await api.getAllTasks();
      }
      set({ tasks });
    }
  },

  createTask: async (taskData: Omit<TaskCreate, 'client_id'>) => {
    const clientId = uuidv4();
    const task: TaskCreate = { ...taskData, client_id: clientId };
    
    if (config.isMobile) {
      const created = await localDb.createTask(task);
      set((state) => ({ tasks: [...state.tasks, created as unknown as Task] }));
      return created as unknown as Task;
    } else {
      const created = await api.createTask(task);
      set((state) => ({ tasks: [...state.tasks, created] }));
      return created;
    }
  },

  updateTask: async (clientId: string, data: Partial<Task>) => {
    if (config.isMobile) {
      await localDb.updateTask(clientId, data);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.client_id === clientId ? { ...t, ...data } : t
        ),
      }));
    } else {
      const task = get().tasks.find((t) => t.client_id === clientId);
      if (task) {
        const updated = await api.updateTask(task.id, data);
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === task.id ? updated : t)),
        }));
      }
    }
  },

  completeTask: async (clientId: string, isCompleted: boolean) => {
    if (config.isMobile) {
      await localDb.completeTask(clientId, isCompleted);
      // Reload tasks to get updated hierarchy
      const { activeTabId, tabs } = get();
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (activeTab) {
        await get().loadTasks(activeTab.tab_type as 'today' | 'all' | 'custom', activeTabId || undefined);
      }
    } else {
      const task = get().tasks.find((t) => t.client_id === clientId);
      if (task) {
        const updated = await api.completeTask(task.id, isCompleted);
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === task.id ? updated : t)),
        }));
      }
    }
  },

  deleteTask: async (clientId: string) => {
    if (config.isMobile) {
      await localDb.deleteTask(clientId);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.client_id !== clientId),
      }));
    } else {
      const task = get().tasks.find((t) => t.client_id === clientId);
      if (task) {
        await api.deleteTask(task.id);
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== task.id),
        }));
      }
    }
  },

  // Sync
  triggerSync: async () => {
    if (config.isMobile) {
      await syncService.manualSync();
    }
  },

  resolveConflict: async (clientId: string, entityType: 'tab' | 'task', resolution: 'keep_server' | 'keep_client') => {
    if (config.isMobile) {
      await syncService.resolveConflict(clientId, entityType, resolution);
      
      // Reload data
      await get().loadTabs();
      const { activeTabId, tabs } = get();
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (activeTab) {
        await get().loadTasks(activeTab.tab_type as 'today' | 'all' | 'custom', activeTabId || undefined);
      }
    }
  },
}));
