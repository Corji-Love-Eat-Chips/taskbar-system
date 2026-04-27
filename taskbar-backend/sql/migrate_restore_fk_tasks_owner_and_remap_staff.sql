-- =============================================================================
-- 1) 恢复 tasks.owner_id → staff.staff_id 外键 fk_tasks_owner（若已丢失）
-- 2) 将指定人员的主键 staff_id 调整为：
--      嵇会祥(工号4006)=1, 李金宝(23167)=2, 赵士银(23002)=3, 徐洪焱(23166)=4
--
-- 执行前请备份数据库。在 MySQL 客户端中：
--   mysql -u root -p taskbar_db < migrate_restore_fk_tasks_owner_and_remap_staff.sql
-- 或先 USE taskbar_db; 再粘贴执行。
--
-- 若只需补外键、不改 staff_id：不要执行下面从 SET FOREIGN_KEY_CHECKS 到 AUTO_INCREMENT 的整段；仅执行：
--   ALTER TABLE tasks DROP FOREIGN KEY fk_tasks_owner;   -- 若不存在会报错，可跳过
--   ALTER TABLE tasks ADD CONSTRAINT fk_tasks_owner
--     FOREIGN KEY (owner_id) REFERENCES staff(staff_id);
-- 若约束名不是 fk_tasks_owner，可查：
--   SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
--   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks'
--     AND REFERENCED_TABLE_NAME = 'staff';
-- =============================================================================

SET NAMES utf8mb4;

-- 改数据前必须去掉 tasks 上的负责人外键（若已不存在，本句报错则注释掉本句）
ALTER TABLE tasks DROP FOREIGN KEY fk_tasks_owner;

SET FOREIGN_KEY_CHECKS = 0;

-- 将某 staff_id 在所有引用表上整体替换为 new_id（不含 staff 表本身）
-- 调用方式：设置 @from_id @to_id 后执行本段（用存储过程式重复）

-- 2.1 四人先迁到临时 ID 881001～881004（按工号 4006,23167,23002,23166）
-- 4006 嵇会祥 -> 881001
SET @old := (SELECT staff_id FROM staff WHERE staff_code = '4006' LIMIT 1);
UPDATE tasks SET owner_id = 881001 WHERE @old IS NOT NULL AND owner_id = @old;
UPDATE users SET staff_id = 881001 WHERE @old IS NOT NULL AND staff_id = @old;
UPDATE task_collaborators SET staff_id = 881001 WHERE @old IS NOT NULL AND staff_id = @old;
UPDATE todos SET executor_id = 881001 WHERE @old IS NOT NULL AND executor_id = @old;
UPDATE todo_shares SET share_to_staff_id = 881001 WHERE @old IS NOT NULL AND share_to_staff_id = @old;
UPDATE meetings SET host_id = 881001 WHERE @old IS NOT NULL AND host_id = @old;
UPDATE meeting_participants SET staff_id = 881001 WHERE @old IS NOT NULL AND staff_id = @old;
UPDATE staff SET staff_id = 881001 WHERE staff_code = '4006';

-- 23167 李金宝 -> 881002
SET @old := (SELECT staff_id FROM staff WHERE staff_code = '23167' LIMIT 1);
UPDATE tasks SET owner_id = 881002 WHERE @old IS NOT NULL AND owner_id = @old;
UPDATE users SET staff_id = 881002 WHERE @old IS NOT NULL AND staff_id = @old;
UPDATE task_collaborators SET staff_id = 881002 WHERE @old IS NOT NULL AND staff_id = @old;
UPDATE todos SET executor_id = 881002 WHERE @old IS NOT NULL AND executor_id = @old;
UPDATE todo_shares SET share_to_staff_id = 881002 WHERE @old IS NOT NULL AND share_to_staff_id = @old;
UPDATE meetings SET host_id = 881002 WHERE @old IS NOT NULL AND host_id = @old;
UPDATE meeting_participants SET staff_id = 881002 WHERE @old IS NOT NULL AND staff_id = @old;
UPDATE staff SET staff_id = 881002 WHERE staff_code = '23167';

-- 23002 赵士银 -> 881003
SET @old := (SELECT staff_id FROM staff WHERE staff_code = '23002' LIMIT 1);
UPDATE tasks SET owner_id = 881003 WHERE @old IS NOT NULL AND owner_id = @old;
UPDATE users SET staff_id = 881003 WHERE @old IS NOT NULL AND staff_id = @old;
UPDATE task_collaborators SET staff_id = 881003 WHERE @old IS NOT NULL AND staff_id = @old;
UPDATE todos SET executor_id = 881003 WHERE @old IS NOT NULL AND executor_id = @old;
UPDATE todo_shares SET share_to_staff_id = 881003 WHERE @old IS NOT NULL AND share_to_staff_id = @old;
UPDATE meetings SET host_id = 881003 WHERE @old IS NOT NULL AND host_id = @old;
UPDATE meeting_participants SET staff_id = 881003 WHERE @old IS NOT NULL AND staff_id = @old;
UPDATE staff SET staff_id = 881003 WHERE staff_code = '23002';

-- 23166 徐洪焱 -> 881004
SET @old := (SELECT staff_id FROM staff WHERE staff_code = '23166' LIMIT 1);
UPDATE tasks SET owner_id = 881004 WHERE @old IS NOT NULL AND owner_id = @old;
UPDATE users SET staff_id = 881004 WHERE @old IS NOT NULL AND staff_id = @old;
UPDATE task_collaborators SET staff_id = 881004 WHERE @old IS NOT NULL AND staff_id = @old;
UPDATE todos SET executor_id = 881004 WHERE @old IS NOT NULL AND executor_id = @old;
UPDATE todo_shares SET share_to_staff_id = 881004 WHERE @old IS NOT NULL AND share_to_staff_id = @old;
UPDATE meetings SET host_id = 881004 WHERE @old IS NOT NULL AND host_id = @old;
UPDATE meeting_participants SET staff_id = 881004 WHERE @old IS NOT NULL AND staff_id = @old;
UPDATE staff SET staff_id = 881004 WHERE staff_code = '23166';

-- 2.2 腾出 1～4：原占用 1～4 的「其他人员」整体迁到 MAX+1 起连续空号
SET @base := (SELECT IFNULL(MAX(staff_id), 0) FROM staff) + 1;

UPDATE tasks SET owner_id = @base WHERE owner_id = 1;
UPDATE users SET staff_id = @base WHERE staff_id = 1;
UPDATE task_collaborators SET staff_id = @base WHERE staff_id = 1;
UPDATE todos SET executor_id = @base WHERE executor_id = 1;
UPDATE todo_shares SET share_to_staff_id = @base WHERE share_to_staff_id = 1;
UPDATE meetings SET host_id = @base WHERE host_id = 1;
UPDATE meeting_participants SET staff_id = @base WHERE staff_id = 1;
UPDATE staff SET staff_id = @base WHERE staff_id = 1;
SET @base := @base + 1;

UPDATE tasks SET owner_id = @base WHERE owner_id = 2;
UPDATE users SET staff_id = @base WHERE staff_id = 2;
UPDATE task_collaborators SET staff_id = @base WHERE staff_id = 2;
UPDATE todos SET executor_id = @base WHERE executor_id = 2;
UPDATE todo_shares SET share_to_staff_id = @base WHERE share_to_staff_id = 2;
UPDATE meetings SET host_id = @base WHERE host_id = 2;
UPDATE meeting_participants SET staff_id = @base WHERE staff_id = 2;
UPDATE staff SET staff_id = @base WHERE staff_id = 2;
SET @base := @base + 1;

UPDATE tasks SET owner_id = @base WHERE owner_id = 3;
UPDATE users SET staff_id = @base WHERE staff_id = 3;
UPDATE task_collaborators SET staff_id = @base WHERE staff_id = 3;
UPDATE todos SET executor_id = @base WHERE executor_id = 3;
UPDATE todo_shares SET share_to_staff_id = @base WHERE share_to_staff_id = 3;
UPDATE meetings SET host_id = @base WHERE host_id = 3;
UPDATE meeting_participants SET staff_id = @base WHERE staff_id = 3;
UPDATE staff SET staff_id = @base WHERE staff_id = 3;
SET @base := @base + 1;

UPDATE tasks SET owner_id = @base WHERE owner_id = 4;
UPDATE users SET staff_id = @base WHERE staff_id = 4;
UPDATE task_collaborators SET staff_id = @base WHERE staff_id = 4;
UPDATE todos SET executor_id = @base WHERE executor_id = 4;
UPDATE todo_shares SET share_to_staff_id = @base WHERE share_to_staff_id = 4;
UPDATE meetings SET host_id = @base WHERE host_id = 4;
UPDATE meeting_participants SET staff_id = @base WHERE staff_id = 4;
UPDATE staff SET staff_id = @base WHERE staff_id = 4;
SET @base := @base + 1;

-- 2.3 临时 ID → 最终 1～4（嵇会祥=1, 李金宝=2, 赵士银=3, 徐洪焱=4）
UPDATE tasks SET owner_id = 1 WHERE owner_id = 881001;
UPDATE users SET staff_id = 1 WHERE staff_id = 881001;
UPDATE task_collaborators SET staff_id = 1 WHERE staff_id = 881001;
UPDATE todos SET executor_id = 1 WHERE executor_id = 881001;
UPDATE todo_shares SET share_to_staff_id = 1 WHERE share_to_staff_id = 881001;
UPDATE meetings SET host_id = 1 WHERE host_id = 881001;
UPDATE meeting_participants SET staff_id = 1 WHERE staff_id = 881001;
UPDATE staff SET staff_id = 1 WHERE staff_code = '4006';

UPDATE tasks SET owner_id = 2 WHERE owner_id = 881002;
UPDATE users SET staff_id = 2 WHERE staff_id = 881002;
UPDATE task_collaborators SET staff_id = 2 WHERE staff_id = 881002;
UPDATE todos SET executor_id = 2 WHERE executor_id = 881002;
UPDATE todo_shares SET share_to_staff_id = 2 WHERE share_to_staff_id = 881002;
UPDATE meetings SET host_id = 2 WHERE host_id = 881002;
UPDATE meeting_participants SET staff_id = 2 WHERE staff_id = 881002;
UPDATE staff SET staff_id = 2 WHERE staff_code = '23167';

UPDATE tasks SET owner_id = 3 WHERE owner_id = 881003;
UPDATE users SET staff_id = 3 WHERE staff_id = 881003;
UPDATE task_collaborators SET staff_id = 3 WHERE staff_id = 881003;
UPDATE todos SET executor_id = 3 WHERE executor_id = 881003;
UPDATE todo_shares SET share_to_staff_id = 3 WHERE share_to_staff_id = 881003;
UPDATE meetings SET host_id = 3 WHERE host_id = 881003;
UPDATE meeting_participants SET staff_id = 3 WHERE staff_id = 881003;
UPDATE staff SET staff_id = 3 WHERE staff_code = '23002';

UPDATE tasks SET owner_id = 4 WHERE owner_id = 881004;
UPDATE users SET staff_id = 4 WHERE staff_id = 881004;
UPDATE task_collaborators SET staff_id = 4 WHERE staff_id = 881004;
UPDATE todos SET executor_id = 4 WHERE executor_id = 881004;
UPDATE todo_shares SET share_to_staff_id = 4 WHERE share_to_staff_id = 881004;
UPDATE meetings SET host_id = 4 WHERE host_id = 881004;
UPDATE meeting_participants SET staff_id = 4 WHERE staff_id = 881004;
UPDATE staff SET staff_id = 4 WHERE staff_code = '23166';

-- 收尾：若仍有 881001～881004 残留（例如曾中断执行），按工号收拢到 1～4
UPDATE tasks SET owner_id = 1 WHERE owner_id = 881001;
UPDATE users SET staff_id = 1 WHERE staff_id = 881001;
UPDATE task_collaborators SET staff_id = 1 WHERE staff_id = 881001;
UPDATE todos SET executor_id = 1 WHERE executor_id = 881001;
UPDATE todo_shares SET share_to_staff_id = 1 WHERE share_to_staff_id = 881001;
UPDATE meetings SET host_id = 1 WHERE host_id = 881001;
UPDATE meeting_participants SET staff_id = 1 WHERE staff_id = 881001;
UPDATE tasks SET owner_id = 2 WHERE owner_id = 881002;
UPDATE users SET staff_id = 2 WHERE staff_id = 881002;
UPDATE task_collaborators SET staff_id = 2 WHERE staff_id = 881002;
UPDATE todos SET executor_id = 2 WHERE executor_id = 881002;
UPDATE todo_shares SET share_to_staff_id = 2 WHERE share_to_staff_id = 881002;
UPDATE meetings SET host_id = 2 WHERE host_id = 881002;
UPDATE meeting_participants SET staff_id = 2 WHERE staff_id = 881002;
UPDATE tasks SET owner_id = 3 WHERE owner_id = 881003;
UPDATE users SET staff_id = 3 WHERE staff_id = 881003;
UPDATE task_collaborators SET staff_id = 3 WHERE staff_id = 881003;
UPDATE todos SET executor_id = 3 WHERE executor_id = 881003;
UPDATE todo_shares SET share_to_staff_id = 3 WHERE share_to_staff_id = 881003;
UPDATE meetings SET host_id = 3 WHERE host_id = 881003;
UPDATE meeting_participants SET staff_id = 3 WHERE staff_id = 881003;
UPDATE tasks SET owner_id = 4 WHERE owner_id = 881004;
UPDATE users SET staff_id = 4 WHERE staff_id = 881004;
UPDATE task_collaborators SET staff_id = 4 WHERE staff_id = 881004;
UPDATE todos SET executor_id = 4 WHERE executor_id = 881004;
UPDATE todo_shares SET share_to_staff_id = 4 WHERE share_to_staff_id = 881004;
UPDATE meetings SET host_id = 4 WHERE host_id = 881004;
UPDATE meeting_participants SET staff_id = 4 WHERE staff_id = 881004;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 三、恢复外键（改完数据后必须再加回）
-- -----------------------------------------------------------------------------
ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_owner
  FOREIGN KEY (owner_id) REFERENCES staff(staff_id);

-- -----------------------------------------------------------------------------
-- 四、修正 staff 自增，避免后续插入与手工 ID 冲突
-- -----------------------------------------------------------------------------
SET @mx := (SELECT IFNULL(MAX(staff_id), 1) FROM staff);
SET @sql := CONCAT('ALTER TABLE staff AUTO_INCREMENT = ', @mx + 1);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
