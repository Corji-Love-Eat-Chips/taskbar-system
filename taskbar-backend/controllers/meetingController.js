/**
 * meetingController.js
 * 会议管理 HTTP 处理器
 */

const { validationResult } = require('express-validator')
const meetingService = require('../services/meetingService')
const { success, created, paginated, fail } = require('../utils/response')

// ─── 工具 ─────────────────────────────────────────────────────────────────────

/** 提取 express-validator 第一条错误并响应 */
function pickErrors(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const msg = errors.array()[0].msg
    fail(res, msg, 422)
    return true
  }
  return false
}

/** 从 session 中提取操作人信息 */
function getOperator(req) {
  return {
    userId:  req.currentUser?.userId  ?? null,
    role:    req.currentUser?.role    ?? 'teacher',
    staffId: req.currentUser?.staffId ?? null,
  }
}

// ─── 一、会议列表 ─────────────────────────────────────────────────────────────

async function list(req, res) {
  if (pickErrors(req, res)) return

  const operator = getOperator(req)
  const { start_date, end_date, status, meeting_type, keyword, page, page_size } = req.query

  const result = await meetingService.getMeetingList({
    start_date, end_date, status, meeting_type, keyword,
    page:      Number(page      ?? 1),
    page_size: Number(page_size ?? 20),
    viewer:    operator,
  })

  paginated(res, result.list, result.pagination)
}

// ─── 二、我的会议 ─────────────────────────────────────────────────────────────

async function myList(req, res) {
  const operator = getOperator(req)
  const { page, page_size } = req.query

  const result = await meetingService.getMyMeetings({
    page:      Number(page      ?? 1),
    page_size: Number(page_size ?? 20),
    viewer:    operator,
  })

  paginated(res, result.list, result.pagination)
}

// ─── 三、日历视图数据 ──────────────────────────────────────────────────────────

async function calendar(req, res) {
  const operator = getOperator(req)
  const { start_date, end_date } = req.query

  const list = await meetingService.getCalendarMeetings({
    start_date, end_date,
    viewer: operator,
  })

  success(res, { list })
}

// ─── 四、会议详情 ─────────────────────────────────────────────────────────────

async function detail(req, res) {
  if (pickErrors(req, res)) return

  const meeting = await meetingService.getMeetingById(Number(req.params.id))
  success(res, meeting)
}

// ─── 五、新增会议 ─────────────────────────────────────────────────────────────

async function create(req, res) {
  if (pickErrors(req, res)) return

  const operator = getOperator(req)
  const meeting  = await meetingService.createMeeting(req.body, operator)
  created(res, meeting)
}

// ─── 六、更新会议 ─────────────────────────────────────────────────────────────

async function update(req, res) {
  if (pickErrors(req, res)) return

  const operator = getOperator(req)
  const meeting  = await meetingService.updateMeeting(Number(req.params.id), req.body, operator)
  success(res, meeting)
}

// ─── 七、删除会议 ─────────────────────────────────────────────────────────────

async function remove(req, res) {
  if (pickErrors(req, res)) return

  const operator = getOperator(req)
  await meetingService.deleteMeeting(Number(req.params.id), operator)
  success(res, null, '删除成功')
}

// ─── 八、确认参会 ─────────────────────────────────────────────────────────────

async function confirm(req, res) {
  if (pickErrors(req, res)) return

  const operator = getOperator(req)
  const { confirmed } = req.body

  const meeting = await meetingService.confirmAttendance(
    Number(req.params.id),
    Number(confirmed),
    operator,
  )
  success(res, meeting)
}

module.exports = { list, myList, calendar, detail, create, update, remove, confirm }
