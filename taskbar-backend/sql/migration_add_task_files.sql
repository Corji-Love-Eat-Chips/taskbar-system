-- 已有库增量：任务附件表（执行一次即可）
-- mysql -u root -p taskbar_db < sql/migration_add_task_files.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS task_files (
    file_id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    original_name VARCHAR(255) NOT NULL COMMENT '原始文件名',
    stored_name VARCHAR(200) NOT NULL COMMENT '磁盘存储文件名',
    mime_type VARCHAR(127) NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    uploaded_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_files_task FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
    CONSTRAINT fk_task_files_user FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_task_files_task (task_id)
) COMMENT='任务相关文件元数据';
