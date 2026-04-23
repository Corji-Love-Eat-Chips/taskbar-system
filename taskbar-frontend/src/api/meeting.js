/**
 * meeting.js
 * 会议管理 API  →  /api/meetings/*
 */
import request from '@/utils/request'

/**
 * 获取会议列表（分页 + 多条件筛选）
 * @param {{
 *   type?: string,        // 会议类型：all | department | special
 *   status?: string,      // upcoming | ongoing | completed | cancelled
 *   start_date?: string,  // 起始日期 YYYY-MM-DD
 *   end_date?: string,    // 截止日期
 *   page?: number,
 *   pageSize?: number
 * }} params
 * @returns {Promise<{ code, data: { list, pagination } }>}
 */
export function getMeetingList(params) {
  return request.get('/meetings', { params })
}

/**
 * 获取会议详情（含参会人员确认状态）
 * @param {number} id  meeting_id
 * @returns {Promise<{ code, data: MeetingDetail }>}
 */
export function getMeetingDetail(id) {
  return request.get(`/meetings/${id}`)
}

/**
 * 新增会议
 * @param {{
 *   meeting_name: string,
 *   meeting_type: string,
 *   host_id: number,
 *   start_time: string,       // YYYY-MM-DD HH:mm:ss
 *   end_time: string,
 *   location: string,
 *   participant_ids: number[],
 *   agenda?: string,
 *   reminder_setting?: string  // 如 '30min'、'1h'
 * }} data
 * @returns {Promise}
 */
export function createMeeting(data) {
  return request.post('/meetings', data)
}

/**
 * 更新会议信息
 * @param {number} id
 * @param {Partial<MeetingForm>} data
 * @returns {Promise}
 */
export function updateMeeting(id, data) {
  return request.put(`/meetings/${id}`, data)
}

/**
 * 删除会议
 * @param {number} id
 * @returns {Promise}
 */
export function deleteMeeting(id) {
  return request.delete(`/meetings/${id}`)
}

/**
 * 确认 / 拒绝参会（当前用户操作自身）
 * @param {number} id         meeting_id
 * @param {0 | 1} confirmed   1=确认，0=拒绝
 * @returns {Promise}
 */
export function confirmAttendance(id, confirmed) {
  return request.patch(`/meetings/${id}/confirm`, { confirmed })
}

/**
 * 获取我的会议（当前用户作为参会人 / 主持人的会议）
 * @param {{ status?: string, page?: number, pageSize?: number }} params
 * @returns {Promise<{ code, data: { list, pagination } }>}
 */
export function getMyMeetings(params) {
  return request.get('/meetings/my', { params })
}

/**
 * 获取日历视图数据（FullCalendar 所需格式）
 * @param {{ start_date: string, end_date: string }} params
 * @returns {Promise<{ code, data: Array<{ id, title, start, end, location, type }> }>}
 */
export function getMeetingCalendar(params) {
  return request.get('/meetings/calendar', { params })
}
