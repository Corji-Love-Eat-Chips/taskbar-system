-- =============================================================================
-- 学院工作任务栏系统 · 初始数据（INSERT）
-- 目标库：taskbar_db（与 init_taskbar_db.sql 一致）
-- 说明：
--   - categories / staff / users 依赖 UNIQUE，重复执行会报主键/唯一冲突；
--     可先删除冲突记录，或使用下方「可选清理」段（慎用，会删用户数据）。
--   - periods 按学期删除后重插，避免同一脚本多次执行产生重复周次。
-- =============================================================================

SET NAMES utf8mb4;

USE taskbar_db;

-- -----------------------------------------------------------------------------
-- 可选清理（仅开发环境；会删除管理员以外业务数据时请自行调整顺序与外键）
-- -----------------------------------------------------------------------------
-- SET FOREIGN_KEY_CHECKS = 0;
-- TRUNCATE TABLE operation_logs;
-- TRUNCATE TABLE meeting_participants;
-- TRUNCATE TABLE meetings;
-- TRUNCATE TABLE todo_shares;
-- TRUNCATE TABLE todos;
-- TRUNCATE TABLE task_collaborators;
-- TRUNCATE TABLE tasks;
-- DELETE FROM users WHERE username = 'admin';
-- DELETE FROM staff WHERE staff_code IN (
--   'ADMIN001','T001','T002','T003','T004','T005','T006','T007','T008','T009'
-- );
-- DELETE FROM categories;
-- SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 1. 任务分类（categories）
-- -----------------------------------------------------------------------------
INSERT INTO categories (category_name, color, sort_order) VALUES
('教学工作', '#5B8DEF', 1),
('科研工作', '#722ED1', 2),
('党建工作', '#FF4D4F', 3),
('行政工作', '#666666', 4),
('学生工作', '#52C41A', 5),
('产业学院工作', '#FA8C16', 6)
ON DUPLICATE KEY UPDATE
  color = VALUES(color),
  sort_order = VALUES(sort_order),
  updated_at = CURRENT_TIMESTAMP;

-- -----------------------------------------------------------------------------
-- 2. 周期：2025-2026学年第二学期 第6周～第18周（每周一～周日）
--    第6周起始：2026-04-06（周一）
-- -----------------------------------------------------------------------------
DELETE FROM periods WHERE semester = '2025-2026学年第二学期';

INSERT INTO periods (period_name, start_date, end_date, semester, sort_order) VALUES
('第6周',  '2026-04-06', '2026-04-12', '2025-2026学年第二学期', 6),
('第7周',  '2026-04-13', '2026-04-19', '2025-2026学年第二学期', 7),
('第8周',  '2026-04-20', '2026-04-26', '2025-2026学年第二学期', 8),
('第9周',  '2026-04-27', '2026-05-03', '2025-2026学年第二学期', 9),
('第10周', '2026-05-04', '2026-05-10', '2025-2026学年第二学期', 10),
('第11周', '2026-05-11', '2026-05-17', '2025-2026学年第二学期', 11),
('第12周', '2026-05-18', '2026-05-24', '2025-2026学年第二学期', 12),
('第13周', '2026-05-25', '2026-05-31', '2025-2026学年第二学期', 13),
('第14周', '2026-06-01', '2026-06-07', '2025-2026学年第二学期', 14),
('第15周', '2026-06-08', '2026-06-14', '2025-2026学年第二学期', 15),
('第16周', '2026-06-15', '2026-06-21', '2025-2026学年第二学期', 16),
('第17周', '2026-06-22', '2026-06-28', '2025-2026学年第二学期', 17),
('第18周', '2026-06-29', '2026-07-05', '2025-2026学年第二学期', 18);

-- -----------------------------------------------------------------------------
-- 3. 示例人员 + 管理员对应人员（staff）
--    管理员绑定工号 ADMIN001，登录用户见下一节
-- -----------------------------------------------------------------------------
INSERT INTO staff (staff_code, name, gender, department, position, status) VALUES
('ADMIN001', '系统管理员', NULL, '党政办公室', '系统管理员', 'active'),
('T001', '徐洪焱', 'male', '学院', '学院领导', 'active'),
('T002', '季芳', 'female', '学院', '教学副院长', 'active'),
('T003', '赵士银', 'male', '光电工程系', '专业负责人', 'active'),
('T004', '李金宝', 'male', '学院', '院长', 'active'),
('T005', '嵇会祥', 'male', '学院', '行政秘书', 'active'),
('T006', '王晓明', 'male', '学生工作办公室', '辅导员', 'active'),
('T007', '陈静', 'female', '科研与学科办公室', '科研秘书', 'active'),
('T008', '刘洋', 'male', '产业学院', '产教融合专员', 'active'),
('T009', '周敏', 'female', '教务办公室', '教务员', 'active')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  gender = VALUES(gender),
  department = VALUES(department),
  position = VALUES(position),
  status = VALUES(status),
  updated_at = CURRENT_TIMESTAMP;

-- -----------------------------------------------------------------------------
-- 4. 管理员账号（users，密码 admin123，bcryptjs 10 轮）
-- -----------------------------------------------------------------------------
INSERT INTO users (username, password, salt, role, staff_id, status)
SELECT
  'admin',
  '$2a$10$inDe0C8V3wXjufv7xnZQw.KDhoUTBM/EBrgenl4aOjEtjFeNwGQwW',
  'bcrypt',
  'admin',
  s.staff_id,
  1
FROM staff s
WHERE s.staff_code = 'ADMIN001'
LIMIT 1
ON DUPLICATE KEY UPDATE
  password = VALUES(password),
  salt = VALUES(salt),
  role = VALUES(role),
  staff_id = VALUES(staff_id),
  status = VALUES(status),
  updated_at = CURRENT_TIMESTAMP;
