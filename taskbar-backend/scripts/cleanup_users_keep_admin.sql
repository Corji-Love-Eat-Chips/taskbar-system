-- =============================================================================
-- 仅开发/测试环境：物理删除「登录账号」中除系统管理员（admin）以外的所有用户
-- 不动 staff / tasks 等业务主数据；外键 created_by 等会随 ON DELETE 置为 NULL
-- 执行前请务必备份数据库。
-- =============================================================================
USE taskbar_db;

-- 须存在 username=admin 的超级账号，否则请勿执行
SELECT user_id, username, role, staff_id FROM users;

DELETE FROM users
WHERE LOWER(TRIM(username)) <> 'admin';

-- 结果：应仅剩 admin 一条
SELECT user_id, username, role, staff_id, status FROM users;
