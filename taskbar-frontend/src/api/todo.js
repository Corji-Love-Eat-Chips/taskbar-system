/**
 * todo.js
 * 待办管理 API  →  /api/todos/*
 */
import request from '@/utils/request'

/**
 * 获取我的待办列表
 * @param {{
 *   status?: 0 | 1,    // 0=未完成，1=已完成
 *   task_id?: number,  // 关联任务ID
 *   page?: number,
 *   pageSize?: number
 * }} params
 * @returns {Promise<{ code, data: { list, pagination } }>}
 */
export function getMyTodoList(params) {
  return request.get('/todos/my', { params })
}

/**
 * 获取分享给我的待办列表
 * @param {{ status?: 0 | 1 }} params
 * @returns {Promise<{ code, data: { list } }>}
 */
export function getSharedTodoList(params) {
  return request.get('/todos/shared', { params })
}

/**
 * 获取待办详情
 * @param {number} id
 * @returns {Promise}
 */
export function getTodoDetail(id) {
  return request.get(`/todos/${id}`)
}

/**
 * 新增待办
 * @param {{
 *   todo_name: string,
 *   task_id?: number,
 *   priority: 'urgent' | 'important' | 'normal' | 'low',
 *   deadline?: string,    // YYYY-MM-DD HH:mm:ss
 *   remarks?: string
 * }} data
 * @returns {Promise}
 */
export function createTodo(data) {
  return request.post('/todos', data)
}

/**
 * 更新待办
 * @param {number} id
 * @param {Partial<TodoForm>} data
 * @returns {Promise}
 */
export function updateTodo(id, data) {
  return request.put(`/todos/${id}`, data)
}

/**
 * 删除待办
 * @param {number} id
 * @returns {Promise}
 */
export function deleteTodo(id) {
  return request.delete(`/todos/${id}`)
}

/**
 * 切换待办完成状态（勾选 / 取消勾选）
 * @param {number} id
 * @param {0 | 1} status
 * @returns {Promise}
 */
export function toggleTodo(id, status) {
  return request.patch(`/todos/${id}/toggle`, { status })
}

/**
 * 共享待办给他人
 * @param {number} id
 * @param {{ share_to_staff_id: number, permission: 'view' | 'edit' }} data
 * @returns {Promise}
 */
export function shareTodo(id, data) {
  return request.post(`/todos/${id}/share`, data)
}

/**
 * 取消待办共享
 * @param {number} id       todo_id
 * @param {number} staffId  被共享人的 staff_id
 * @returns {Promise}
 */
export function unshareTodo(id, staffId) {
  return request.delete(`/todos/${id}/share/${staffId}`)
}
