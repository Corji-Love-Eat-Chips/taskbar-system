-- =============================================================================
-- 学院工作任务栏系统 · MySQL 8.0+ 初始化脚本
-- 数据库名：taskbar_db
-- 说明：会删除并重建 taskbar_db 内下列业务表，仅建议在开发/首次部署执行
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS taskbar_db
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE taskbar_db;

-- 按依赖逆序删除（存在则删）
DROP TABLE IF EXISTS todo_shares;
DROP TABLE IF EXISTS meeting_participants;
DROP TABLE IF EXISTS todos;
DROP TABLE IF EXISTS task_collaborators;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS meetings;
DROP TABLE IF EXISTS operation_logs;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS periods;
DROP TABLE IF EXISTS staff;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 1. staff（人员表，须先于 users / tasks 等）
-- =============================================================================
CREATE TABLE staff (
    staff_id INT PRIMARY KEY AUTO_INCREMENT,
    staff_code VARCHAR(20) NOT NULL COMMENT '工号',
    name VARCHAR(50) NOT NULL,
    gender ENUM('male','female') NULL,
    department VARCHAR(50) NOT NULL,
    position VARCHAR(50) NULL,
    phone VARCHAR(20) NULL,
    email VARCHAR(100) NULL,
    status ENUM('active','disabled','left') NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_staff_code (staff_code)
) COMMENT='人员基本信息';

-- =============================================================================
-- 2. users（用户表 / 登录账号）
-- =============================================================================
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL COMMENT '登录名',
    password VARCHAR(255) NOT NULL COMMENT '密码哈希',
    salt VARCHAR(50) NOT NULL COMMENT '盐值',
    role ENUM('admin','teacher','leader') NOT NULL DEFAULT 'teacher',
    staff_id INT NULL,
    status TINYINT NOT NULL DEFAULT 1 COMMENT '0禁用 1正常',
    login_attempts INT NOT NULL DEFAULT 0,
    lock_until DATETIME NULL,
    last_login DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_username (username),
    CONSTRAINT fk_users_staff FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE SET NULL
) COMMENT='登录账号信息';

-- =============================================================================
-- 3. periods（周期表）
-- =============================================================================
CREATE TABLE periods (
    period_id INT PRIMARY KEY AUTO_INCREMENT,
    period_name VARCHAR(50) NOT NULL COMMENT '如：第6周',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    semester VARCHAR(50) NULL COMMENT '所属学期',
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='教学周/周期';

-- =============================================================================
-- 4. categories（任务分类表）
-- =============================================================================
CREATE TABLE categories (
    category_id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(50) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#666666',
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_category_name (category_name)
) COMMENT='任务分类主数据';

-- =============================================================================
-- 5. tasks（任务表）
-- =============================================================================
CREATE TABLE tasks (
    task_id INT PRIMARY KEY AUTO_INCREMENT,
    task_no VARCHAR(30) NOT NULL COMMENT '任务编号',
    task_name VARCHAR(100) NOT NULL,
    period_id INT NULL,
    owner_id INT NOT NULL COMMENT '负责人 staff_id',
    description TEXT NULL,
    priority ENUM('high','medium','low') NOT NULL DEFAULT 'medium',
    category VARCHAR(50) NOT NULL COMMENT '分类名称（与 categories 对应，应用层校验）',
    status ENUM('pending','in_progress','completed','delayed','cancelled') NOT NULL DEFAULT 'pending',
    progress INT NOT NULL DEFAULT 0 COMMENT '0-100',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    remarks TEXT NULL,
    created_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_task_no (task_no),
    CONSTRAINT fk_tasks_period FOREIGN KEY (period_id) REFERENCES periods(period_id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_owner FOREIGN KEY (owner_id) REFERENCES staff(staff_id),
    CONSTRAINT fk_tasks_creator FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
) COMMENT='工作任务';

-- =============================================================================
-- 6. task_collaborators（任务协助人）
-- =============================================================================
CREATE TABLE task_collaborators (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    staff_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_task_staff (task_id, staff_id),
    CONSTRAINT fk_tc_task FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
    CONSTRAINT fk_tc_staff FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
) COMMENT='任务协助人';

-- =============================================================================
-- 7. todos（待办事项）
-- =============================================================================
CREATE TABLE todos (
    todo_id INT PRIMARY KEY AUTO_INCREMENT,
    todo_name VARCHAR(100) NOT NULL,
    task_id INT NULL,
    executor_id INT NOT NULL,
    priority ENUM('urgent','important','normal','low') NOT NULL DEFAULT 'normal',
    status TINYINT NOT NULL DEFAULT 0 COMMENT '0未完成 1已完成',
    deadline DATETIME NULL,
    reminder_time DATETIME NULL,
    completed_at DATETIME NULL,
    remarks TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_todos_task FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE SET NULL,
    CONSTRAINT fk_todos_executor FOREIGN KEY (executor_id) REFERENCES staff(staff_id)
) COMMENT='待办事项';

-- =============================================================================
-- 8. todo_shares（待办共享）
-- =============================================================================
CREATE TABLE todo_shares (
    id INT PRIMARY KEY AUTO_INCREMENT,
    todo_id INT NOT NULL,
    share_to_staff_id INT NOT NULL,
    permission ENUM('view','edit') NOT NULL DEFAULT 'view',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_todo_share_staff (todo_id, share_to_staff_id),
    CONSTRAINT fk_ts_todo FOREIGN KEY (todo_id) REFERENCES todos(todo_id) ON DELETE CASCADE,
    CONSTRAINT fk_ts_staff FOREIGN KEY (share_to_staff_id) REFERENCES staff(staff_id)
) COMMENT='待办共享给指定人员';

-- =============================================================================
-- 9. meetings（会议）
-- =============================================================================
CREATE TABLE meetings (
    meeting_id INT PRIMARY KEY AUTO_INCREMENT,
    meeting_no VARCHAR(30) NOT NULL COMMENT '会议编号',
    meeting_name VARCHAR(100) NOT NULL,
    meeting_type ENUM('all','department','party','teaching','other') NOT NULL,
    host_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    location VARCHAR(100) NOT NULL,
    agenda TEXT NULL,
    reminder_setting ENUM('15min','30min','1hour','1day','none') NOT NULL DEFAULT '30min',
    status ENUM('upcoming','ongoing','ended','cancelled') NOT NULL DEFAULT 'upcoming',
    minutes TEXT NULL,
    created_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_meeting_no (meeting_no),
    CONSTRAINT fk_meetings_host FOREIGN KEY (host_id) REFERENCES staff(staff_id),
    CONSTRAINT fk_meetings_creator FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
) COMMENT='会议';

-- =============================================================================
-- 10. meeting_participants（参会人员）
-- =============================================================================
CREATE TABLE meeting_participants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    meeting_id INT NOT NULL,
    staff_id INT NOT NULL,
    confirmed TINYINT NULL COMMENT '0未确认 1确认 2拒绝',
    confirmed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_meeting_staff (meeting_id, staff_id),
    CONSTRAINT fk_mp_meeting FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    CONSTRAINT fk_mp_staff FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
) COMMENT='会议参会人员';

-- =============================================================================
-- 11. operation_logs（操作日志）
-- =============================================================================
CREATE TABLE operation_logs (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id INT NOT NULL,
    detail JSON NULL,
    ip_address VARCHAR(50) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) COMMENT='操作审计日志';

-- =============================================================================
-- 索引（补充查询性能；唯一编号已在 UNIQUE 上自动有索引）
-- =============================================================================
CREATE INDEX idx_users_role_status ON users(role, status);
CREATE INDEX idx_staff_name ON staff(name);
CREATE INDEX idx_staff_status ON staff(status);

CREATE INDEX idx_tasks_owner ON tasks(owner_id);
CREATE INDEX idx_tasks_period ON tasks(period_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_category ON tasks(category);
CREATE INDEX idx_tasks_end_date ON tasks(end_date);

CREATE INDEX idx_todos_executor ON todos(executor_id);
CREATE INDEX idx_todos_task ON todos(task_id);
CREATE INDEX idx_todos_status ON todos(status);

CREATE INDEX idx_todo_shares_todo ON todo_shares(todo_id);
CREATE INDEX idx_todo_shares_to ON todo_shares(share_to_staff_id);

CREATE INDEX idx_meetings_host ON meetings(host_id);
CREATE INDEX idx_meetings_start ON meetings(start_time);
CREATE INDEX idx_meetings_status ON meetings(status);

CREATE INDEX idx_categories_sort ON categories(sort_order);

CREATE INDEX idx_oplogs_user ON operation_logs(user_id);
CREATE INDEX idx_oplogs_target ON operation_logs(target_type, target_id);
CREATE INDEX idx_oplogs_created ON operation_logs(created_at);

-- =============================================================================
-- 可选：开发环境种子数据（不需要可整段删除）
-- =============================================================================
INSERT INTO periods (period_name, start_date, end_date, semester, sort_order) VALUES
('第6周', '2026-04-07', '2026-04-10', '2025-2026学年第二学期', 6),
('第7周', '2026-04-14', '2026-04-17', '2025-2026学年第二学期', 7),
('第8周', '2026-04-20', '2026-04-24', '2025-2026学年第二学期', 8);

INSERT INTO staff (staff_code, name, gender, department, position, status) VALUES
('T001', '徐洪焱', 'male', '学院', '学院领导', 'active'),
('T002', '季芳', 'female', '学院', '教学副院长', 'active'),
('T003', '赵士银', 'male', '光电系', '专业负责人', 'active'),
('T004', '李金宝', 'male', '学院', '院长', 'active'),
('T005', '嵇会祥', 'male', '学院', '行政人员', 'active');

INSERT INTO categories (category_name, color, sort_order) VALUES
('教学工作', '#5B8DEF', 1),
('科研工作', '#722ED1', 2),
('党建工作', '#FF4D4F', 3),
('行政工作', '#666666', 4),
('学生工作', '#52C41A', 5),
('产业学院工作', '#FA8C16', 6),
('人事工作', '#13C2C2', 7);

-- 默认管理员：用户名 admin，密码 admin123（登录后请立即修改）
INSERT INTO users (username, password, salt, role, staff_id, status) VALUES
('admin', '$2a$10$wb3/CiXwotrPZgY4AH1dt.A0C5EO6xzN5w7ecQrPCbbxP8vSKckL2', 'bcrypt', 'admin', 1, 1);
