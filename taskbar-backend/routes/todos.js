/**
 * routes/todos.js
 * 待办事项路由  →  /api/todos
 */

const { Router } = require('express')
const { body, param, query } = require('express-validator')
const ctrl = require('../controllers/todoController')
const { requireAuth } = require('../middlewares/auth')
const { asyncHandler } = require('../utils/asyncHandler')

const router = Router()

// 所有路由需登录
router.use(requireAuth)

// ─── 公共校验 ─────────────────────────────────────────────────────────────────

const validateId = param('id')
  .isInt({ min: 1 }).withMessage('待办 ID 必须为正整数')

const PRIORITIES = ['urgent', 'important', 'normal', 'low']

// ─── 特殊子路径（须在 /:id 之前注册，避免被 param 捕获）────────────────────

/**
 * GET /api/todos/my
 * 获取"我的待办"（固定过滤当前用户，兼容前端 getMyTodoList）
 */
router.get(
  '/my',
  [
    query('task_id').optional().isInt({ min: 1 }).withMessage('task_id 须为正整数'),
    query('status').optional().isIn(['0', '1']).withMessage('status 须为 0 或 1'),
    query('priority').optional().isIn(PRIORITIES).withMessage('priority 值无效'),
    query('page').optional().isInt({ min: 1 }).withMessage('page 须为正整数'),
    // 待办列表页一次性加载全量，放宽上限到 500
    query('page_size').optional().isInt({ min: 1, max: 500 }).withMessage('page_size 范围 1-500'),
    query('pageSize').optional().isInt({ min: 1, max: 500 }).withMessage('pageSize 范围 1-500'),
  ],
  asyncHandler(ctrl.myList),
)

/**
 * GET /api/todos/calendar
 * 日程日历数据（有截止时间的待办）
 */
router.get(
  '/calendar',
  [
    query('start_date').notEmpty().withMessage('start_date 不能为空'),
    query('end_date').notEmpty().withMessage('end_date 不能为空'),
  ],
  asyncHandler(ctrl.calendar),
)

/**
 * GET /api/todos/shared
 * 获取"分享给我的待办"
 */
router.get('/shared', asyncHandler(ctrl.sharedList))

// ─── GET /api/todos ───────────────────────────────────────────────────────────
/**
 * 待办列表（分页 + 筛选）
 * 教师/领导：只返回自己的待办
 * 管理员：可查所有
 */
router.get(
  '/',
  [
    query('task_id').optional().isInt({ min: 1 }).withMessage('task_id 须为正整数'),
    query('status').optional().isIn(['0', '1']).withMessage('status 须为 0 或 1'),
    query('priority').optional().isIn(PRIORITIES).withMessage('priority 值无效'),
    query('page').optional().isInt({ min: 1 }).withMessage('page 须为正整数'),
    query('page_size').optional().isInt({ min: 1, max: 500 }).withMessage('page_size 范围 1-500'),
    query('pageSize').optional().isInt({ min: 1, max: 500 }).withMessage('pageSize 范围 1-500'),
  ],
  asyncHandler(ctrl.list),
)

// ─── GET /api/todos/:id ───────────────────────────────────────────────────────
router.get('/:id', [validateId], asyncHandler(ctrl.detail))

// ─── POST /api/todos ──────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('todo_name')
      .trim().notEmpty().withMessage('待办名称不能为空')
      .isLength({ max: 100 }).withMessage('待办名称不超过 100 字'),
    body('task_id')
      .optional({ nullable: true })
      .isInt({ min: 1 }).withMessage('task_id 须为正整数'),
    body('priority')
      .optional()
      .isIn(PRIORITIES).withMessage('priority 值无效（urgent/important/normal/low）'),
    body('deadline')
      .optional({ nullable: true })
      .isISO8601().withMessage('deadline 须为 ISO8601 日期时间格式'),
    body('reminder_time')
      .optional({ nullable: true })
      .isISO8601().withMessage('reminder_time 须为 ISO8601 日期时间格式'),
    body('sort_order')
      .optional()
      .isInt({ min: 0 }).withMessage('sort_order 须为非负整数'),
  ],
  asyncHandler(ctrl.create),
)

// ─── PUT /api/todos/:id ───────────────────────────────────────────────────────
router.put(
  '/:id',
  [
    validateId,
    body('todo_name')
      .optional().trim().notEmpty().withMessage('待办名称不能为空字符串')
      .isLength({ max: 100 }).withMessage('待办名称不超过 100 字'),
    body('task_id')
      .optional({ nullable: true })
      .isInt({ min: 1 }).withMessage('task_id 须为正整数'),
    body('priority')
      .optional()
      .isIn(PRIORITIES).withMessage('priority 值无效'),
    body('deadline')
      .optional({ nullable: true })
      .isISO8601().withMessage('deadline 须为 ISO8601 日期时间格式'),
    body('reminder_time')
      .optional({ nullable: true })
      .isISO8601().withMessage('reminder_time 须为 ISO8601 日期时间格式'),
    body('sort_order')
      .optional()
      .isInt({ min: 0 }).withMessage('sort_order 须为非负整数'),
  ],
  asyncHandler(ctrl.update),
)

// ─── DELETE /api/todos/:id ────────────────────────────────────────────────────
router.delete('/:id', [validateId], asyncHandler(ctrl.remove))

// ─── PATCH /api/todos/:id/complete ───────────────────────────────────────────
router.patch(
  '/:id/complete',
  [validateId],
  asyncHandler(ctrl.complete),
)

// ─── PATCH /api/todos/:id/uncomplete ─────────────────────────────────────────
router.patch(
  '/:id/uncomplete',
  [validateId],
  asyncHandler(ctrl.uncomplete),
)

// ─── PATCH /api/todos/:id/toggle ─────────────────────────────────────────────
/**
 * 兼容前端 toggleTodo API：{ status: 0|1 }
 */
router.patch(
  '/:id/toggle',
  [
    validateId,
    body('status')
      .notEmpty().withMessage('status 不能为空')
      .isIn([0, 1, '0', '1']).withMessage('status 须为 0 或 1'),
  ],
  asyncHandler(ctrl.toggle),
)

module.exports = router
