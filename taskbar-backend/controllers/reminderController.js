/**
 * reminderController.js
 * 提醒记录 HTTP 处理器
 */

const { validationResult } = require('express-validator')
const reminderService = require('../services/reminderService')
const { success, fail } = require('../utils/response')

function pickErrors(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    fail(res, errors.array()[0].msg, 422)
    return true
  }
  return false
}

// ── GET /api/reminders/pending  前端轮询，获取待弹通知 ───────────────────────
async function pending(req, res) {
  const staffId = req.currentUser?.staffId
  if (!staffId) {
    return success(res, { list: [] })
  }
  const list = await reminderService.getPendingReminders(staffId)
  success(res, { list })
}

// ── POST /api/reminders/:id/acknowledged  标记单条已确认 ─────────────────────
async function acknowledged(req, res) {
  if (pickErrors(req, res)) return

  const staffId = req.currentUser?.staffId
  if (!staffId) return fail(res, '当前账号未关联员工信息', 400)

  await reminderService.acknowledgeReminder(Number(req.params.id), staffId)
  success(res, null, '已标记')
}

// ── POST /api/reminders/acknowledge-all  一键全部已读 ─────────────────────────
async function acknowledgeAll(req, res) {
  const staffId = req.currentUser?.staffId
  if (!staffId) return success(res, null, '无需操作')

  await reminderService.acknowledgeAll(staffId)
  success(res, null, '全部已标记')
}

module.exports = { pending, acknowledged, acknowledgeAll }
