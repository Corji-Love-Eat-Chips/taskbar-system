/**
 * period.js
 * 周期管理 API  →  /api/periods/*
 */
import request from '@/utils/request'

/**
 * 获取周期列表（全量，用于下拉 / 切换器）
 * @param {{ semester?: string }} params
 * @returns {Promise<{ code, data: Array<Period> }>}
 */
export function getPeriodList(params) {
  return request.get('/periods', { params })
}

/**
 * 获取周期详情
 * @param {number} id  period_id
 * @returns {Promise}
 */
export function getPeriodDetail(id) {
  return request.get(`/periods/${id}`)
}

/**
 * 新增周期
 * @param {{
 *   period_name: string,   // 如"第9周"
 *   start_date: string,    // YYYY-MM-DD
 *   end_date: string,
 *   semester: string       // 如"2025-2026学年第二学期"
 * }} data
 * @returns {Promise}
 */
export function createPeriod(data) {
  return request.post('/periods', data)
}

/**
 * 复制上一周期的任务到目标周期
 * @param {number} id              源 period_id
 * @param {{ target_period_id: number }} data
 * @returns {Promise}
 */
export function copyPeriodTasks(id, data) {
  return request.post(`/periods/${id}/copy`, data)
}
