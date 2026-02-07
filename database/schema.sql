-- Task Manager Database Schema
-- MSSQL Server

-- =============================================
-- Users Table
-- =============================================
CREATE TABLE Users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    google_id NVARCHAR(255) NOT NULL UNIQUE,
    email NVARCHAR(255) NOT NULL,
    name NVARCHAR(255) NOT NULL,
    avatar_url NVARCHAR(500) NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Users_GoogleId ON Users(google_id);
CREATE INDEX IX_Users_Email ON Users(email);

-- =============================================
-- Tabs Table
-- =============================================
CREATE TABLE Tabs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    client_id NVARCHAR(36) NOT NULL UNIQUE,  -- UUID generated on client
    user_id INT NOT NULL,
    name NVARCHAR(255) NOT NULL,
    order_index INT NOT NULL DEFAULT 0,
    is_system BIT NOT NULL DEFAULT 0,        -- True for "Today" and "AllTasks"
    tab_type NVARCHAR(50) NOT NULL DEFAULT 'custom', -- 'today', 'all_tasks', 'custom'
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    is_deleted BIT NOT NULL DEFAULT 0,
    
    CONSTRAINT FK_Tabs_Users FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE INDEX IX_Tabs_UserId ON Tabs(user_id);
CREATE INDEX IX_Tabs_ClientId ON Tabs(client_id);
CREATE INDEX IX_Tabs_UpdatedAt ON Tabs(updated_at);

-- =============================================
-- Tasks Table
-- =============================================
CREATE TABLE Tasks (
    id INT IDENTITY(1,1) PRIMARY KEY,
    client_id NVARCHAR(36) NOT NULL UNIQUE,  -- UUID generated on client
    user_id INT NOT NULL,
    tab_id INT NULL,                          -- NULL for tasks visible in Today/AllTasks only
    parent_task_id INT NULL,                  -- NULL for root tasks
    title NVARCHAR(1000) NOT NULL,
    description NVARCHAR(MAX) NULL,
    is_completed BIT NOT NULL DEFAULT 0,
    due_date DATE NULL,                       -- Optional due date
    due_time TIME NULL,                       -- Optional due time for reminders
    depth INT NOT NULL DEFAULT 0,             -- 0, 1, or 2 (max 3 levels: 0-2)
    order_index INT NOT NULL DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    completed_at DATETIME2 NULL,
    is_deleted BIT NOT NULL DEFAULT 0,
    
    CONSTRAINT FK_Tasks_Users FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT FK_Tasks_Tabs FOREIGN KEY (tab_id) REFERENCES Tabs(id) ON DELETE NO ACTION,
    CONSTRAINT FK_Tasks_ParentTask FOREIGN KEY (parent_task_id) REFERENCES Tasks(id) ON DELETE NO ACTION,
    CONSTRAINT CK_Tasks_Depth CHECK (depth >= 0 AND depth <= 2)
);

CREATE INDEX IX_Tasks_UserId ON Tasks(user_id);
CREATE INDEX IX_Tasks_TabId ON Tasks(tab_id);
CREATE INDEX IX_Tasks_ParentTaskId ON Tasks(parent_task_id);
CREATE INDEX IX_Tasks_ClientId ON Tasks(client_id);
CREATE INDEX IX_Tasks_DueDate ON Tasks(due_date);
CREATE INDEX IX_Tasks_UpdatedAt ON Tasks(updated_at);
CREATE INDEX IX_Tasks_IsCompleted ON Tasks(is_completed);

-- =============================================
-- SyncLog Table - Track sync history per device
-- =============================================
CREATE TABLE SyncLog (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    device_id NVARCHAR(255) NOT NULL,
    last_sync_at DATETIME2 NOT NULL,
    sync_type NVARCHAR(50) NOT NULL,  -- 'pull', 'push', 'full'
    items_synced INT NOT NULL DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_SyncLog_Users FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE INDEX IX_SyncLog_UserId_DeviceId ON SyncLog(user_id, device_id);

-- =============================================
-- Notifications Table - In-app notifications
-- =============================================
CREATE TABLE Notifications (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    task_id INT NULL,
    title NVARCHAR(255) NOT NULL,
    message NVARCHAR(1000) NULL,
    notification_type NVARCHAR(50) NOT NULL,  -- 'reminder', 'due_soon', 'overdue'
    scheduled_at DATETIME2 NOT NULL,
    is_read BIT NOT NULL DEFAULT 0,
    is_sent BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_Notifications_Users FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT FK_Notifications_Tasks FOREIGN KEY (task_id) REFERENCES Tasks(id) ON DELETE NO ACTION
);

CREATE INDEX IX_Notifications_UserId ON Notifications(user_id);
CREATE INDEX IX_Notifications_ScheduledAt ON Notifications(scheduled_at);
