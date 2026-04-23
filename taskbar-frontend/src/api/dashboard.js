/**
 * dashboard.js
 * 仪表盘 & 通知提醒 API  →  /api/dashboard/*  /api/reminders/*
 */
import request from '@/utils/request'

// ── 仪表盘 ────────────────────────────────────────────────────────────────────

/**
 * 获取统计数据（任务总数 / 进行中 / 会议数 / 待办数等）
 * @returns {Promise<{ code, data: DashboardStats }>}
 */
export function getDashboardStats() {
  return request.get('/dashboard/stats')
}

/**
 * 获取首页聚合数据（stats + recentTasks + upcomingMeetings）
 * @returns {Promise<{ code, data: { stats, recentTasks, upcomingMeetings } }>}
 */
export function getDashboardHome() {
  return request.get('/dashboard/home')
}

// ── 通知提醒 ──────────────────────────────────────────────────────────────────

/**
 * 获取待提醒列表（前端轮询，获取需要弹出 Notification 的条目）
 * @returns {Promise<{ code, data: Array<Reminder> }>}
 */
export function getPendingReminders() {
  return request.get('/reminders/pending')
}

/**
 * 标记提醒已处理（发送浏览器通知后调用）
 * @param {number} id  reminder_id
 * @returns {Promise}
 */
export function acknowledgeReminder(id) {
  return request.post(`/reminders/${id}/acknowledged`)
}

/**
 * 获取通知权限状态
 * @returns {Promise<{ code, data: { granted: boolean, updatedAt: string } }>}
 */
export function getNotificationPermission() {
  return request.get('/settings/notification-permission')
}

/**
 * 更新通知权限状态
 * @param {boolean} granted
 * @returns {Promise}
 */
export function updateNotificationPermission(granted) {
  return request.post('/settings/notification-permission', { granted })
}
