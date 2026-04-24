/**
 * todoController.js
 * 待办事项 HTTP 处理层
 */

const { validationResult } = require('express-validator')
const todoService = require('../services/todoService')
const { success, created, paginated, fail } = require('../utils/response')

// ── 工具：提取校验错误 ────────────────────────────────────────────────────────
function pickErrors(req, res) {
  const errs = validationResult(req)
  if (!errs.isEmpty()) {
    fail(res, errs.array()[0].msg, 422)
    return true
  }
  return false
}

/** 从 req.currentUser 提取操作人信息（统一格式） */
function getOperator(req) {
  return {
    userId:  req.currentUser.userId,
    staffId: req.currentUser.staffId,
    role:    req.currentUser.role,
  }
}

// ── GET /api/todos ────────────────────────────────────────────────────────────
/**
 * 待办列表（分页 + 筛选）
 * 教师/领导：只能查自己的待办
 * 管理员：可查所有人（不传 executor_id 则查全部）
 */
async function list(req, res) {
  if (pickErrors(req, res)) return

  const { task_id, status, priority, page } = req.query
  const pageSize = req.query.page_size ?? req.query.pageSize ?? 20

  const result = await todoService.getTodoList({
    task_id:  task_id  != null ? Number(task_id)  : undefined,
    status:   status   != null ? Number(status)   : undefined,
    priority: priority || undefined,
    page:     page  ?? 1,
    pageSize,
    viewer: {
      role:    req.currentUser.role,
      staffId: req.currentUser.staffId,
    },
  })
  return paginated(res, result.list, result.pagination)
}

// ── GET /api/todos/my ────────────────────────────────────────────────────────
/**
 * 我的待办（固定当前用户，兼容前端 getMyTodoList API）
 */
async function myList(req, res) {
  if (pickErrors(req, res)) return

  const { task_id, status, priority, page } = req.query
  const pageSize = req.query.page_size ?? req.query.pageSize ?? 50

  const result = await todoService.getTodoList({
    task_id:  task_id  != null ? Number(task_id)  : undefined,
    status:   status   != null ? Number(status)   : undefined,
    priority: priority || undefined,
    page:     page  ?? 1,
    pageSize,
    viewer: {
      role:    'teacher',             // 强制按"本人"过滤，不论实际角色
      staffId: req.currentUser.staffId,
    },
  })
  return paginated(res, result.list, result.pagination)
}

// ── GET /api/todos/calendar ───────────────────────────────────────────────────
/**
 * 日程日历：有截止时间的待办（与会议日历合并展示）
 */
async function calendar(req, res) {
  if (pickErrors(req, res)) return

  const { start_date, end_date } = req.query
  const list = await todoService.getCalendarTodos({
    start_date,
    end_date,
    viewer: {
      role:    req.currentUser.role,
      staffId: req.currentUser.staffId,
    },
  })
  return success(res, { list })
}

// ── GET /api/todos/shared ─────────────────────────────────────────────────────
/**
 * 分享给我的待办
 * 本期仅返回占位（todo_shares 表留待后续迭代）
 */
async function sharedList(req, res) {
  return res.json({
    code: 200,
    message: 'ok',
    data: { list: [], pagination: { page: 1, page_size: 20, total: 0 } },
  })
}

// ── GET /api/todos/:id ────────────────────────────────────────────────────────
async function detail(req, res) {
  if (pickErrors(req, res)) return

  const todo = await todoService.getTodoById(Number(req.params.id))
  if (!todo) return fail(res, '待办不存在', 404)

  // 权限：非管理员只能看自己的
  const { role, staffId } = req.currentUser
  if (role !== 'admin' && todo.executor_id !== staffId) {
    return fail(res, '无权查看他人的待办', 403)
  }

  return success(res, todo)
}

// ── POST /api/todos ───────────────────────────────────────────────────────────
async function create(req, res) {
  if (pickErrors(req, res)) return

  const todo = await todoService.createTodo(req.body, getOperator(req))
  return created(res, todo, '待办已创建')
}

// ── PUT /api/todos/:id ────────────────────────────────────────────────────────
async function update(req, res) {
  if (pickErrors(req, res)) return

  const todo = await todoService.updateTodo(
    Number(req.params.id),
    req.body,
    getOperator(req),
  )
  return success(res, todo, '待办已更新')
}

// ── DELETE /api/todos/:id ─────────────────────────────────────────────────────
async function remove(req, res) {
  if (pickErrors(req, res)) return

  await todoService.deleteTodo(Number(req.params.id), getOperator(req))
  return success(res, null, '待办已删除')
}

// ── PATCH /api/todos/:id/complete ─────────────────────────────────────────────
async function complete(req, res) {
  if (pickErrors(req, res)) return

  const todo = await todoService.completeTodo(
    Number(req.params.id),
    getOperator(req),
  )
  return success(res, todo, '待办已完成')
}

// ── PATCH /api/todos/:id/uncomplete ───────────────────────────────────────────
async function uncomplete(req, res) {
  if (pickErrors(req, res)) return

  const todo = await todoService.uncompleteTodo(
    Number(req.params.id),
    getOperator(req),
  )
  return success(res, todo, '已取消完成')
}

// ── PATCH /api/todos/:id/toggle ───────────────────────────────────────────────
/**
 * 兼容前端 toggleTodo API：{ status: 0|1 }
 */
async function toggle(req, res) {
  if (pickErrors(req, res)) return

  const todo = await todoService.toggleTodo(
    Number(req.params.id),
    Number(req.body.status),
    getOperator(req),
  )
  return success(res, todo, '状态已更新')
}

module.exports = {
  list, myList, calendar, sharedList,
  detail, create, update, remove,
  complete, uncomplete, toggle,
}
