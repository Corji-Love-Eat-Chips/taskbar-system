-- 学院工作任务栏系统 · 初始化脚本（MySQL 8.0+）
-- 使用：mysql -u root -p < sql/init.sql   （本地示例密码见 .env）

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS taskbar
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE taskbar;

-- 人员（须先于 users）
DROP TABLE IF EXISTS todo_shares;
DROP TABLE IF EXISTS meeting_participants;
DROP TABLE IF EXISTS todos;
DROP TABLE IF EXISTS task_auxiliary_owners;
DROP TABLE IF EXISTS task_co_leads;
DROP TABLE IF EXISTS task_collaborators;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS meetings;
DROP TABLE IF EXISTS operation_logs;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS periods;
DROP TABLE IF EXISTS staff;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE staff (
    staff_id INT PRIMARY KEY AUTO_INCREMENT,
    staff_code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    gender ENUM('male','female') NULL,
    department VARCHAR(50) NOT NULL,
    position VARCHAR(50) NULL,
    phone VARCHAR(20) NULL,
    email VARCHAR(100) NULL,
    status ENUM('active','disabled','left') NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    salt VARCHAR(50) NOT NULL,
    role ENUM('admin','teacher','leader') NOT NULL DEFAULT 'teacher',
    staff_id INT,
    status TINYINT NOT NULL DEFAULT 1,
    login_attempts INT DEFAULT 0,
    lock_until DATETIME NULL,
    last_login DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE SET NULL
);

CREATE TABLE periods (
    period_id INT PRIMARY KEY AUTO_INCREMENT,
    period_name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    semester VARCHAR(50) NULL,
    sort_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    category_id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(20) DEFAULT '#666666',
    sort_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
    task_id INT PRIMARY KEY AUTO_INCREMENT,
    task_no VARCHAR(30) NOT NULL UNIQUE,
    task_name VARCHAR(100) NOT NULL,
    period_id INT,
    owner_id INT NOT NULL,
    description TEXT NULL,
    priority ENUM('high','medium','low') NOT NULL DEFAULT 'medium',
    category VARCHAR(50) NOT NULL,
    status ENUM('pending','in_progress','completed','delayed','cancelled') NOT NULL DEFAULT 'pending',
    progress INT DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    remarks TEXT NULL,
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (period_id) REFERENCES periods(period_id) ON DELETE SET NULL,
    FOREIGN KEY (owner_id) REFERENCES staff(staff_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

CREATE TABLE task_collaborators (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    staff_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
    UNIQUE KEY uk_task_staff (task_id, staff_id)
);

CREATE TABLE task_co_leads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    staff_id INT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_task_co_lead (task_id, staff_id),
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
);

CREATE TABLE task_auxiliary_owners (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    staff_id INT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_task_aux_owner (task_id, staff_id),
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
);

CREATE TABLE todos (
    todo_id INT PRIMARY KEY AUTO_INCREMENT,
    todo_name VARCHAR(100) NOT NULL,
    task_id INT,
    executor_id INT NOT NULL,
    priority ENUM('urgent','important','normal','low') DEFAULT 'normal',
    status TINYINT NOT NULL DEFAULT 0,
    deadline DATETIME NULL,
    reminder_time DATETIME NULL,
    completed_at DATETIME NULL,
    remarks TEXT NULL,
    sort_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE SET NULL,
    FOREIGN KEY (executor_id) REFERENCES staff(staff_id)
);

CREATE TABLE todo_shares (
    id INT PRIMARY KEY AUTO_INCREMENT,
    todo_id INT NOT NULL,
    share_to_staff_id INT NOT NULL,
    permission ENUM('view','edit') DEFAULT 'view',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (todo_id) REFERENCES todos(todo_id) ON DELETE CASCADE,
    FOREIGN KEY (share_to_staff_id) REFERENCES staff(staff_id),
    UNIQUE KEY uk_todo_share_staff (todo_id, share_to_staff_id)
);

CREATE TABLE meetings (
    meeting_id INT PRIMARY KEY AUTO_INCREMENT,
    meeting_no VARCHAR(30) NOT NULL UNIQUE,
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
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES staff(staff_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

CREATE TABLE meeting_participants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    meeting_id INT NOT NULL,
    staff_id INT NOT NULL,
    confirmed TINYINT DEFAULT NULL,
    confirmed_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
    UNIQUE KEY uk_meeting_staff (meeting_id, staff_id)
);

CREATE TABLE operation_logs (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id INT NOT NULL,
    detail JSON NULL,
    ip_address VARCHAR(50) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 索引（避免与 UNIQUE/PK 重复）
CREATE INDEX idx_role_status ON users(role, status);
CREATE INDEX idx_name ON staff(name);
CREATE INDEX idx_staff_status ON staff(status);
CREATE INDEX idx_owner ON tasks(owner_id);
CREATE INDEX idx_period ON tasks(period_id);
CREATE INDEX idx_task_status ON tasks(status);
CREATE INDEX idx_category ON tasks(category);
CREATE INDEX idx_end_date ON tasks(end_date);
CREATE INDEX idx_executor ON todos(executor_id);
CREATE INDEX idx_todo_task ON todos(task_id);
CREATE INDEX idx_todo_status ON todos(status);
CREATE INDEX idx_host ON meetings(host_id);
CREATE INDEX idx_start_time ON meetings(start_time);
CREATE INDEX idx_meeting_status ON meetings(status);
CREATE INDEX idx_sort_order ON categories(sort_order);
CREATE INDEX idx_share_todo ON todo_shares(todo_id);
CREATE INDEX idx_share_to ON todo_shares(share_to_staff_id);

-- ---------- 初始数据 ----------
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
