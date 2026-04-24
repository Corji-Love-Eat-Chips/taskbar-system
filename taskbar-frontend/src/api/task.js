/**
 * task.js
 * 任务管理 API  →  /api/tasks/*
 */
import request from '@/utils/request'

/**
 * 获取任务列表（分页 + 多条件筛选）
 * @param {{
 *   period_id?: number,   // 周期ID
 *   owner_id?: number,    // 负责人ID
 *   category?: string,    // 分类
 *   status?: string,      // pending | in_progress | completed | cancelled
 *   keyword?: string,     // 任务名称关键词
 *   page?: number,
 *   pageSize?: number
 * }} params
 * @returns {Promise<{ code, data: { list, pagination } }>}
 */
export function getTaskList(params) {
  return request.get('/tasks', { params })
}

/**
 * 获取任务详情（含协助人列表）
 * @param {number} id  task_id
 * @returns {Promise<{ code, data: TaskDetail }>}
 */
export function getTaskDetail(id) {
  return request.get(`/tasks/${id}`)
}

/**
 * 新增任务
 * @param {{
 *   task_name: string,
 *   period_id: number,
 *   owner_id: number,
 *   collaborator_ids?: number[],
 *   description?: string,
 *   priority: string,        // low | normal | high | urgent
 *   category: string,
 *   start_date: string,      // YYYY-MM-DD
 *   end_date: string,
 *   remarks?: string
 * }} data
 * @returns {Promise}
 */
export function createTask(data) {
  return request.post('/tasks', data)
}

/**
 * 更新任务
 * @param {number} id
 * @param {{
 *   task_name?: string,
 *   owner_id?: number,
 *   collaborator_ids?: number[],
 *   priority?: string,
 *   status?: string,
 *   progress?: number,   // 0-100
 *   remarks?: string
 * }} data
 * @returns {Promise}
 */
export function updateTask(id, data) {
  return request.put(`/tasks/${id}`, data)
}

/**
 * 删除任务
 * @param {number} id
 * @returns {Promise}
 */
export function deleteTask(id) {
  return request.delete(`/tasks/${id}`)
}

/**
 * 仅更新任务进度（轻量接口，减少传输体积）
 * @param {number} id
 * @param {number} progress  0-100
 * @returns {Promise}
 */
export function updateTaskProgress(id, progress) {
  return request.patch(`/tasks/${id}/progress`, { progress })
}

/**
 * 批量导入任务（Excel 文件）
 * @param {File} file
 * @returns {Promise<{ code, data: { success, failed, errors } }>}
 */
export function importTasks(file) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/tasks/import', formData)
}

/**
 * 导出任务列表（返回 Blob，调用方负责触发下载）
 * @param {{ period_id?: number, format?: 'xlsx' | 'pdf' }} params
 * @returns {Promise<Blob>}
 */
export function exportTasks(params) {
  return request.get('/tasks/export', {
    params,
    responseType: 'blob',
  })
}

// ── 协助人子资源 ─────────────────────────────────────────────────────────────

/**
 * 获取任务的协助人列表
 * @param {number} id  task_id
 * @returns {Promise<{ code, data: Array<{ staff_id, name, permission }> }>}
 */
export function getTaskCollaborators(id) {
  return request.get(`/tasks/${id}/collaborators`)
}

/**
 * 添加任务协助人
 * @param {number} id
 * @param {{ staff_id: number, permission: 'view' | 'edit' }} data
 * @returns {Promise}
 */
export function addTaskCollaborator(id, data) {
  return request.post(`/tasks/${id}/collaborators`, data)
}

/**
 * 移除任务协助人
 * @param {number} id       task_id
 * @param {number} staffId
 * @returns {Promise}
 */
export function removeTaskCollaborator(id, staffId) {
  return request.delete(`/tasks/${id}/collaborators/${staffId}`)
}
