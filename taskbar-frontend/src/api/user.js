/**
 * user.js
 * 用户认证 & 账号管理 API
 *
 * 认证接口   → /api/auth/*
 * 账号管理   → /api/users/*
 */
import request from '@/utils/request'

// ════════════════════════════════════════════════════════════════════════════
// 一、认证（Auth）
// ════════════════════════════════════════════════════════════════════════════

/**
 * 登录
 * @param {{ username: string, password: string }} data
 * @returns {Promise<{ code, message, data: { user_id, username, role, staff_id, staff_name } }>}
 */
export function login(data) {
  return request.post('/auth/login', data)
}

/**
 * 登出（销毁 Session、清除 Cookie）
 * @returns {Promise}
 */
export function logout() {
  return request.post('/auth/logout')
}

/**
 * 获取当前登录用户信息（依赖 Session，用于页面刷新后恢复状态）
 * @returns {Promise<{ code, data: { user_id, username, role, staff_id, staff_name } }>}
 */
export function getCurrentUser() {
  return request.get('/auth/current')
}

// ════════════════════════════════════════════════════════════════════════════
// 二、账号管理（Users）—— 仅管理员可调用（后端鉴权）
// ════════════════════════════════════════════════════════════════════════════

/**
 * 获取用户列表（分页 + 可选筛选）
 * @param {{ username?: string, role?: string, status?: number, page?: number, pageSize?: number }} params
 * @returns {Promise<{ code, data: { list, pagination } }>}
 */
export function getUserList(params) {
  return request.get('/users', { params })
}

/**
 * 获取单个用户详情
 * @param {number} id
 * @returns {Promise}
 */
export function getUserDetail(id) {
  return request.get(`/users/${id}`)
}

/**
 * 新增用户
 * @param {{ username: string, password: string, role: string, staffId?: number }} data
 * @returns {Promise}
 */
export function createUser(data) {
  return request.post('/users', data)
}

/**
 * 更新用户（角色 / 状态，不允许修改用户名）
 * @param {number} id
 * @param {{ role?: string, status?: number }} data
 * @returns {Promise}
 */
export function updateUser(id, data) {
  return request.put(`/users/${id}`, data)
}

/**
 * 删除用户（软删除，status → 0）
 * @param {number} id
 * @returns {Promise}
 */
export function deleteUser(id) {
  return request.delete(`/users/${id}`)
}

/**
 * 管理员重置用户密码（可指定新密码，不传则随机生成）
 * @param {number} id
 * @param {{ newPassword?: string }} [data]
 * @returns {Promise<{ code, data: { newPassword: string } }>}
 */
export function resetPassword(id, data = {}) {
  return request.put(`/users/${id}/password`, data)
}

/**
 * 用户自行修改密码
 * @param {{ oldPassword: string, newPassword: string, confirmPassword: string }} data
 * @returns {Promise}
 */
export function changePassword(data) {
  return request.put('/users/password', data)
}

/**
 * 解锁被锁定的账号（管理员）
 * @param {number} id
 * @returns {Promise}
 */
export function unlockUser(id) {
  return request.patch(`/users/${id}/unlock`)
}
