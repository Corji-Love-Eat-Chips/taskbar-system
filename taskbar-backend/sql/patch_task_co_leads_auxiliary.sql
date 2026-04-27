-- 任务：其他牵头主理人 + 辅助负责人（已有库增量执行）
-- mysql -u root -p taskbar_db < sql/patch_task_co_leads_auxiliary.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS task_co_leads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    staff_id INT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_task_co_lead (task_id, staff_id),
    CONSTRAINT fk_tcl_task FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
    CONSTRAINT fk_tcl_staff FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
) COMMENT='任务其他牵头主理人（不含 tasks.owner_id 主负责人）';

CREATE TABLE IF NOT EXISTS task_auxiliary_owners (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    staff_id INT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_task_aux_owner (task_id, staff_id),
    CONSTRAINT fk_tao_task FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
    CONSTRAINT fk_tao_staff FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
) COMMENT='任务辅助负责人';
