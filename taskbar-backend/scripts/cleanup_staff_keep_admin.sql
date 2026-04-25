-- 与 cleanup-staff-keep-admin.js 等价的 SQL（在 MySQL 客户端中手跑前请备份库）。
-- 若尚未创建 meeting_reminders 表，可注释掉对应 DELETE 行。

SET @keep_staff_id := (SELECT staff_id FROM users WHERE LOWER(TRIM(username)) = 'admin' LIMIT 1);

-- 无 admin 或未绑定人员时勿执行（避免删光 staff）
-- SELECT @keep_staff_id;  应为非 NULL

START TRANSACTION;

DELETE FROM todos;
DELETE FROM task_collaborators;
DELETE FROM tasks;
-- DELETE FROM meeting_reminders;  -- 表不存在则注释本行
DELETE FROM meetings;
DELETE FROM staff WHERE staff_id <> @keep_staff_id;

COMMIT;
