-- Task Manager Stored Procedures
-- MSSQL Server

-- =============================================
-- USER PROCEDURES
-- =============================================

-- Get or Create User by Google ID
CREATE OR ALTER PROCEDURE sp_UpsertUser
    @google_id NVARCHAR(255),
    @email NVARCHAR(255),
    @name NVARCHAR(255),
    @avatar_url NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @user_id INT;
    
    -- Check if user exists
    SELECT @user_id = id FROM Users WHERE google_id = @google_id;
    
    IF @user_id IS NULL
    BEGIN
        -- Create new user
        INSERT INTO Users (google_id, email, name, avatar_url)
        VALUES (@google_id, @email, @name, @avatar_url);
        
        SET @user_id = SCOPE_IDENTITY();
        
        -- Create default system tabs for new user
        INSERT INTO Tabs (client_id, user_id, name, order_index, is_system, tab_type)
        VALUES 
            (NEWID(), @user_id, N'დღეს', 0, 1, 'today'),
            (NEWID(), @user_id, N'ყველა', 1, 1, 'all_tasks');
    END
    ELSE
    BEGIN
        -- Update existing user
        UPDATE Users 
        SET email = @email, 
            name = @name, 
            avatar_url = COALESCE(@avatar_url, avatar_url),
            updated_at = GETUTCDATE()
        WHERE id = @user_id;
    END
    
    -- Return user data
    SELECT id, google_id, email, name, avatar_url, created_at, updated_at
    FROM Users 
    WHERE id = @user_id;
END
GO

-- =============================================
-- TAB PROCEDURES
-- =============================================

-- Get all tabs for user
CREATE OR ALTER PROCEDURE sp_GetUserTabs
    @user_id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT id, client_id, user_id, name, order_index, is_system, tab_type, 
           created_at, updated_at, is_deleted
    FROM Tabs 
    WHERE user_id = @user_id AND is_deleted = 0
    ORDER BY order_index;
END
GO

-- Create new tab
CREATE OR ALTER PROCEDURE sp_CreateTab
    @client_id NVARCHAR(36),
    @user_id INT,
    @name NVARCHAR(255),
    @order_index INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- If order_index not provided, set to max + 1
    IF @order_index IS NULL
    BEGIN
        SELECT @order_index = ISNULL(MAX(order_index), 0) + 1 
        FROM Tabs 
        WHERE user_id = @user_id AND is_deleted = 0;
    END
    
    INSERT INTO Tabs (client_id, user_id, name, order_index, is_system, tab_type)
    VALUES (@client_id, @user_id, @name, @order_index, 0, 'custom');
    
    SELECT id, client_id, user_id, name, order_index, is_system, tab_type, 
           created_at, updated_at, is_deleted
    FROM Tabs 
    WHERE id = SCOPE_IDENTITY();
END
GO

-- Update tab
CREATE OR ALTER PROCEDURE sp_UpdateTab
    @tab_id INT,
    @user_id INT,
    @name NVARCHAR(255) = NULL,
    @order_index INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE Tabs 
    SET name = COALESCE(@name, name),
        order_index = COALESCE(@order_index, order_index),
        updated_at = GETUTCDATE()
    WHERE id = @tab_id AND user_id = @user_id AND is_system = 0;
    
    SELECT id, client_id, user_id, name, order_index, is_system, tab_type, 
           created_at, updated_at, is_deleted
    FROM Tabs 
    WHERE id = @tab_id;
END
GO

-- Delete tab (soft delete)
CREATE OR ALTER PROCEDURE sp_DeleteTab
    @tab_id INT,
    @user_id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Only allow deleting custom tabs
    UPDATE Tabs 
    SET is_deleted = 1, updated_at = GETUTCDATE()
    WHERE id = @tab_id AND user_id = @user_id AND is_system = 0;
    
    -- Move tasks from deleted tab to no tab (they'll appear in AllTasks)
    UPDATE Tasks 
    SET tab_id = NULL, updated_at = GETUTCDATE()
    WHERE tab_id = @tab_id;
    
    SELECT @@ROWCOUNT AS affected_rows;
END
GO

-- =============================================
-- TASK PROCEDURES
-- =============================================

-- Create new task with depth validation
CREATE OR ALTER PROCEDURE sp_CreateTask
    @client_id NVARCHAR(36),
    @user_id INT,
    @tab_id INT = NULL,
    @parent_task_id INT = NULL,
    @title NVARCHAR(1000),
    @description NVARCHAR(MAX) = NULL,
    @due_date DATE = NULL,
    @due_time TIME = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @depth INT = 0;
    DECLARE @order_index INT;
    
    -- Calculate depth based on parent
    IF @parent_task_id IS NOT NULL
    BEGIN
        SELECT @depth = depth + 1 
        FROM Tasks 
        WHERE id = @parent_task_id AND user_id = @user_id;
        
        -- Validate max depth (0, 1, 2 = 3 levels)
        IF @depth > 2
        BEGIN
            RAISERROR(N'მაქსიმალური სიღრმე არის 3 დონე', 16, 1);
            RETURN;
        END
        
        -- Inherit tab_id from parent if not specified
        IF @tab_id IS NULL
        BEGIN
            SELECT @tab_id = tab_id FROM Tasks WHERE id = @parent_task_id;
        END
    END
    
    -- Calculate order_index
    SELECT @order_index = ISNULL(MAX(order_index), 0) + 1 
    FROM Tasks 
    WHERE user_id = @user_id 
      AND ISNULL(parent_task_id, 0) = ISNULL(@parent_task_id, 0)
      AND is_deleted = 0;
    
    INSERT INTO Tasks (client_id, user_id, tab_id, parent_task_id, title, description, 
                       due_date, due_time, depth, order_index)
    VALUES (@client_id, @user_id, @tab_id, @parent_task_id, @title, @description, 
            @due_date, @due_time, @depth, @order_index);
    
    SELECT id, client_id, user_id, tab_id, parent_task_id, title, description,
           is_completed, due_date, due_time, depth, order_index,
           created_at, updated_at, completed_at, is_deleted
    FROM Tasks 
    WHERE id = SCOPE_IDENTITY();
END
GO

-- Complete task with parent-child validation
CREATE OR ALTER PROCEDURE sp_CompleteTask
    @task_id INT,
    @user_id INT,
    @is_completed BIT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @parent_task_id INT;
    DECLARE @has_incomplete_children BIT = 0;
    
    -- Get task info
    SELECT @parent_task_id = parent_task_id 
    FROM Tasks 
    WHERE id = @task_id AND user_id = @user_id;
    
    -- Check if task has incomplete children (when trying to complete)
    IF @is_completed = 1
    BEGIN
        IF EXISTS (
            SELECT 1 FROM Tasks 
            WHERE parent_task_id = @task_id 
              AND is_completed = 0 
              AND is_deleted = 0
        )
        BEGIN
            SET @has_incomplete_children = 1;
        END
    END
    
    -- Update the task
    UPDATE Tasks 
    SET is_completed = @is_completed,
        completed_at = CASE WHEN @is_completed = 1 THEN GETUTCDATE() ELSE NULL END,
        updated_at = GETUTCDATE()
    WHERE id = @task_id AND user_id = @user_id;
    
    -- If completing and parent exists, check if all siblings are complete
    IF @is_completed = 1 AND @parent_task_id IS NOT NULL
    BEGIN
        -- Check if all siblings are complete
        IF NOT EXISTS (
            SELECT 1 FROM Tasks 
            WHERE parent_task_id = @parent_task_id 
              AND is_completed = 0 
              AND is_deleted = 0
        )
        BEGIN
            -- Auto-complete parent
            UPDATE Tasks 
            SET is_completed = 1,
                completed_at = GETUTCDATE(),
                updated_at = GETUTCDATE()
            WHERE id = @parent_task_id;
        END
    END
    
    -- If uncompleting, also uncomplete parent chain
    IF @is_completed = 0 AND @parent_task_id IS NOT NULL
    BEGIN
        ;WITH ParentChain AS (
            SELECT id, parent_task_id 
            FROM Tasks 
            WHERE id = @parent_task_id
            
            UNION ALL
            
            SELECT t.id, t.parent_task_id 
            FROM Tasks t
            INNER JOIN ParentChain pc ON t.id = pc.parent_task_id
        )
        UPDATE Tasks 
        SET is_completed = 0,
            completed_at = NULL,
            updated_at = GETUTCDATE()
        WHERE id IN (SELECT id FROM ParentChain);
    END
    
    -- Return updated task with children status
    SELECT id, client_id, user_id, tab_id, parent_task_id, title, description,
           is_completed, due_date, due_time, depth, order_index,
           created_at, updated_at, completed_at, is_deleted,
           @has_incomplete_children AS has_incomplete_children
    FROM Tasks 
    WHERE id = @task_id;
END
GO

-- Get today's tasks (due today or overdue)
CREATE OR ALTER PROCEDURE sp_GetTodayTasks
    @user_id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    ;WITH TaskHierarchy AS (
        -- Root tasks due today or overdue
        SELECT t.*, 0 AS level
        FROM Tasks t
        WHERE t.user_id = @user_id 
          AND t.is_deleted = 0
          AND t.parent_task_id IS NULL
          AND (t.due_date <= CAST(GETUTCDATE() AS DATE) OR t.due_date IS NULL)
          AND t.is_completed = 0
        
        UNION ALL
        
        -- Child tasks
        SELECT t.*, th.level + 1
        FROM Tasks t
        INNER JOIN TaskHierarchy th ON t.parent_task_id = th.id
        WHERE t.is_deleted = 0
    )
    SELECT id, client_id, user_id, tab_id, parent_task_id, title, description,
           is_completed, due_date, due_time, depth, order_index,
           created_at, updated_at, completed_at, is_deleted, level
    FROM TaskHierarchy
    ORDER BY 
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
        due_date,
        order_index;
END
GO

-- Get tasks by tab (with hierarchy)
CREATE OR ALTER PROCEDURE sp_GetTasksByTab
    @user_id INT,
    @tab_id INT = NULL,
    @include_completed BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    
    ;WITH TaskHierarchy AS (
        -- Root tasks
        SELECT t.*, 0 AS level
        FROM Tasks t
        WHERE t.user_id = @user_id 
          AND t.is_deleted = 0
          AND t.parent_task_id IS NULL
          AND (@tab_id IS NULL OR t.tab_id = @tab_id)
          AND (@include_completed = 1 OR t.is_completed = 0)
        
        UNION ALL
        
        -- Child tasks
        SELECT t.*, th.level + 1
        FROM Tasks t
        INNER JOIN TaskHierarchy th ON t.parent_task_id = th.id
        WHERE t.is_deleted = 0
          AND (@include_completed = 1 OR t.is_completed = 0)
    )
    SELECT id, client_id, user_id, tab_id, parent_task_id, title, description,
           is_completed, due_date, due_time, depth, order_index,
           created_at, updated_at, completed_at, is_deleted, level
    FROM TaskHierarchy
    ORDER BY level, order_index;
END
GO

-- Get all tasks for AllTasks view
CREATE OR ALTER PROCEDURE sp_GetAllTasks
    @user_id INT,
    @include_completed BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    
    ;WITH TaskHierarchy AS (
        -- Root tasks
        SELECT t.*, 0 AS level
        FROM Tasks t
        WHERE t.user_id = @user_id 
          AND t.is_deleted = 0
          AND t.parent_task_id IS NULL
          AND (@include_completed = 1 OR t.is_completed = 0)
        
        UNION ALL
        
        -- Child tasks
        SELECT t.*, th.level + 1
        FROM Tasks t
        INNER JOIN TaskHierarchy th ON t.parent_task_id = th.id
        WHERE t.is_deleted = 0
    )
    SELECT id, client_id, user_id, tab_id, parent_task_id, title, description,
           is_completed, due_date, due_time, depth, order_index,
           created_at, updated_at, completed_at, is_deleted, level
    FROM TaskHierarchy
    ORDER BY is_completed, level, order_index;
END
GO

-- Update task
CREATE OR ALTER PROCEDURE sp_UpdateTask
    @task_id INT,
    @user_id INT,
    @title NVARCHAR(1000) = NULL,
    @description NVARCHAR(MAX) = NULL,
    @due_date DATE = NULL,
    @due_time TIME = NULL,
    @tab_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE Tasks 
    SET title = COALESCE(@title, title),
        description = COALESCE(@description, description),
        due_date = @due_date,
        due_time = @due_time,
        tab_id = COALESCE(@tab_id, tab_id),
        updated_at = GETUTCDATE()
    WHERE id = @task_id AND user_id = @user_id;
    
    SELECT id, client_id, user_id, tab_id, parent_task_id, title, description,
           is_completed, due_date, due_time, depth, order_index,
           created_at, updated_at, completed_at, is_deleted
    FROM Tasks 
    WHERE id = @task_id;
END
GO

-- Delete task (soft delete, cascades to children)
CREATE OR ALTER PROCEDURE sp_DeleteTask
    @task_id INT,
    @user_id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Soft delete task and all its descendants
    ;WITH TaskDescendants AS (
        SELECT id FROM Tasks WHERE id = @task_id AND user_id = @user_id
        
        UNION ALL
        
        SELECT t.id 
        FROM Tasks t
        INNER JOIN TaskDescendants td ON t.parent_task_id = td.id
    )
    UPDATE Tasks 
    SET is_deleted = 1, updated_at = GETUTCDATE()
    WHERE id IN (SELECT id FROM TaskDescendants);
    
    SELECT @@ROWCOUNT AS affected_rows;
END
GO

-- Move task to different tab
CREATE OR ALTER PROCEDURE sp_MoveTask
    @task_id INT,
    @user_id INT,
    @new_tab_id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Move task and all its children to new tab
    ;WITH TaskDescendants AS (
        SELECT id FROM Tasks WHERE id = @task_id AND user_id = @user_id
        
        UNION ALL
        
        SELECT t.id 
        FROM Tasks t
        INNER JOIN TaskDescendants td ON t.parent_task_id = td.id
    )
    UPDATE Tasks 
    SET tab_id = @new_tab_id, updated_at = GETUTCDATE()
    WHERE id IN (SELECT id FROM TaskDescendants);
    
    SELECT id, client_id, user_id, tab_id, parent_task_id, title, description,
           is_completed, due_date, due_time, depth, order_index,
           created_at, updated_at, completed_at, is_deleted
    FROM Tasks 
    WHERE id = @task_id;
END
GO

-- =============================================
-- SYNC PROCEDURES
-- =============================================

-- Pull changes since last sync
CREATE OR ALTER PROCEDURE sp_SyncPull
    @user_id INT,
    @device_id NVARCHAR(255),
    @last_sync_at DATETIME2 = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- If no last_sync, return all data
    IF @last_sync_at IS NULL
        SET @last_sync_at = '1900-01-01';
    
    -- Get changed tabs
    SELECT id, client_id, user_id, name, order_index, is_system, tab_type, 
           created_at, updated_at, is_deleted,
           'tab' AS entity_type
    FROM Tabs 
    WHERE user_id = @user_id AND updated_at > @last_sync_at;
    
    -- Get changed tasks
    SELECT id, client_id, user_id, tab_id, parent_task_id, title, description,
           is_completed, due_date, due_time, depth, order_index,
           created_at, updated_at, completed_at, is_deleted,
           'task' AS entity_type
    FROM Tasks 
    WHERE user_id = @user_id AND updated_at > @last_sync_at;
    
    -- Log the sync
    INSERT INTO SyncLog (user_id, device_id, last_sync_at, sync_type, items_synced)
    VALUES (@user_id, @device_id, GETUTCDATE(), 'pull', 
            (SELECT COUNT(*) FROM Tabs WHERE user_id = @user_id AND updated_at > @last_sync_at) +
            (SELECT COUNT(*) FROM Tasks WHERE user_id = @user_id AND updated_at > @last_sync_at));
END
GO

-- Push changes from client (with conflict detection)
CREATE OR ALTER PROCEDURE sp_SyncPush
    @user_id INT,
    @device_id NVARCHAR(255),
    @client_id NVARCHAR(36),
    @entity_type NVARCHAR(50),  -- 'tab' or 'task'
    @data NVARCHAR(MAX),        -- JSON data
    @client_updated_at DATETIME2
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @server_updated_at DATETIME2;
    DECLARE @has_conflict BIT = 0;
    DECLARE @entity_id INT;
    
    -- Check for conflicts
    IF @entity_type = 'tab'
    BEGIN
        SELECT @server_updated_at = updated_at, @entity_id = id
        FROM Tabs 
        WHERE client_id = @client_id AND user_id = @user_id;
    END
    ELSE IF @entity_type = 'task'
    BEGIN
        SELECT @server_updated_at = updated_at, @entity_id = id
        FROM Tasks 
        WHERE client_id = @client_id AND user_id = @user_id;
    END
    
    -- Detect conflict (server was modified after client's version)
    IF @server_updated_at IS NOT NULL AND @server_updated_at > @client_updated_at
    BEGIN
        SET @has_conflict = 1;
    END
    
    -- Return conflict info for client to resolve
    SELECT 
        @has_conflict AS has_conflict,
        @entity_id AS entity_id,
        @client_id AS client_id,
        @entity_type AS entity_type,
        @server_updated_at AS server_updated_at,
        @client_updated_at AS client_updated_at;
END
GO

-- Resolve conflict with user's choice
CREATE OR ALTER PROCEDURE sp_ResolveConflict
    @user_id INT,
    @client_id NVARCHAR(36),
    @entity_type NVARCHAR(50),
    @resolution NVARCHAR(50),  -- 'keep_server', 'keep_client'
    @client_data NVARCHAR(MAX) = NULL  -- JSON data if keeping client version
AS
BEGIN
    SET NOCOUNT ON;
    
    IF @resolution = 'keep_client' AND @client_data IS NOT NULL
    BEGIN
        -- Apply client's version
        -- This would parse JSON and update the record
        -- Implementation depends on the specific fields being updated
        
        IF @entity_type = 'tab'
        BEGIN
            UPDATE Tabs 
            SET updated_at = GETUTCDATE()
            -- Other fields would be updated from JSON
            WHERE client_id = @client_id AND user_id = @user_id;
        END
        ELSE IF @entity_type = 'task'
        BEGIN
            UPDATE Tasks 
            SET updated_at = GETUTCDATE()
            -- Other fields would be updated from JSON
            WHERE client_id = @client_id AND user_id = @user_id;
        END
    END
    
    -- Return success
    SELECT 1 AS success, @resolution AS applied_resolution;
END
GO

-- =============================================
-- NOTIFICATION PROCEDURES
-- =============================================

-- Get pending notifications for user
CREATE OR ALTER PROCEDURE sp_GetPendingNotifications
    @user_id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT n.id, n.user_id, n.task_id, n.title, n.message, 
           n.notification_type, n.scheduled_at, n.is_read, n.is_sent,
           t.title AS task_title
    FROM Notifications n
    LEFT JOIN Tasks t ON n.task_id = t.id
    WHERE n.user_id = @user_id 
      AND n.is_read = 0
      AND n.scheduled_at <= GETUTCDATE()
    ORDER BY n.scheduled_at DESC;
END
GO

-- Mark notification as read
CREATE OR ALTER PROCEDURE sp_MarkNotificationRead
    @notification_id INT,
    @user_id INT
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE Notifications 
    SET is_read = 1
    WHERE id = @notification_id AND user_id = @user_id;
    
    SELECT @@ROWCOUNT AS affected_rows;
END
GO

-- Create reminder notification for task
CREATE OR ALTER PROCEDURE sp_CreateTaskReminder
    @task_id INT,
    @user_id INT,
    @scheduled_at DATETIME2
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @task_title NVARCHAR(1000);
    SELECT @task_title = title FROM Tasks WHERE id = @task_id AND user_id = @user_id;
    
    INSERT INTO Notifications (user_id, task_id, title, message, notification_type, scheduled_at)
    VALUES (@user_id, @task_id, N'შეხსენება', @task_title, 'reminder', @scheduled_at);
    
    SELECT SCOPE_IDENTITY() AS notification_id;
END
GO
