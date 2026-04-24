/**
 * reminder.js
 * 会议提醒 API  →  /api/reminders/*
 */
import request from '@/utils/request'

/**
 * 获取当前用户待弹出的提醒列表（前端轮询）
 * @returns {Promise<{ code, data: { list: ReminderItem[] } }>}
 */
export function getPendingReminders() {
  return request.get('/reminders/pending')
}

/**
 * 标记单条提醒为已确认（弹出通知后调用）
 * @param {number} id  meeting_reminders.id
 */
export function acknowledgeReminder(id) {
  return request.post(`/reminders/${id}/acknowledged`)
}

/**
 * 一键标记所有待确认提醒为已读
 */
export function acknowledgeAllReminders() {
  return request.post('/reminders/acknowledge-all')
}
