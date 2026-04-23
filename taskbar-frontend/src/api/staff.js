/**
 * staff.js
 * 人员管理 API  →  /api/staff/*
 */
import request from '@/utils/request'

/**
 * 获取人员列表（分页 + 筛选）
 * @param {{
 *   name?: string,       // 姓名模糊搜索
 *   department?: string, // 部门筛选
 *   status?: string,     // 状态：active | left | disabled
 *   page?: number,
 *   pageSize?: number
 * }} params
 * @returns {Promise<{ code, data: { list, pagination } }>}
 */
export function getStaffList(params) {
  return request.get('/staff', { params })
}

/**
 * 获取全部在职人员（不分页，用于下拉选择器）
 * @returns {Promise<{ code, data: Array }>}
 */
export function getStaffAll() {
  return request.get('/staff/all')
}

/**
 * 获取人员详情
 * @param {number} id  staff_id
 * @returns {Promise<{ code, data: StaffDetail }>}
 */
export function getStaffDetail(id) {
  return request.get(`/staff/${id}`)
}

/**
 * 新增人员
 * @param {{
 *   staffCode: string,   // 工号（唯一）
 *   name: string,
 *   gender?: string,     // male | female
 *   department: string,
 *   position: string,
 *   phone?: string,
 *   email?: string
 * }} data
 * @returns {Promise}
 */
export function createStaff(data) {
  return request.post('/staff', data)
}

/**
 * 更新人员信息（部门、职位、状态等）
 * @param {number} id
 * @param {{ department?: string, position?: string, status?: string, phone?: string, email?: string }} data
 * @returns {Promise}
 */
export function updateStaff(id, data) {
  return request.put(`/staff/${id}`, data)
}

/**
 * 删除人员（软删除，status → left；有关联任务/会议时拒绝）
 * @param {number} id
 * @returns {Promise}
 */
export function deleteStaff(id) {
  return request.delete(`/staff/${id}`)
}

/**
 * 为人员创建登录账号
 * @param {number} id  staff_id
 * @param {{ username: string, role: string }} data
 * @returns {Promise<{ code, data: { user_id, username, initialPassword } }>}
 */
export function createUserForStaff(id, data) {
  return request.post(`/staff/${id}/create-user`, data)
}
