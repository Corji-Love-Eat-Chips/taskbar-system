/**
 * routes/meetings.js
 * 会议管理路由  /api/meetings/*
 */

const { Router } = require('express')
const { body, param, query } = require('express-validator')
const ctrl = require('../controllers/meetingController')
const { requireAuth, requireAdminOrLeader } = require('../middlewares/auth')
const { asyncHandler } = require('../utils/asyncHandler')

const router = Router()

// 所有路由均需登录
router.use(requireAuth)

// ─── 通用校验规则 ──────────────────────────────────────────────────────────────

const validateId = param('id')
  .isInt({ min: 1 })
  .withMessage('会议 ID 必须为正整数')

const MEETING_TYPES     = ['all', 'department', 'party', 'teaching', 'other']
const REMINDER_SETTINGS = ['15min', '30min', '1hour', '1day', 'none']
const MEETING_STATUSES  = ['upcoming', 'ongoing', 'ended', 'cancelled']

// ─── 特殊路由（必须在 /:id 之前注册，避免被参数路由拦截） ─────────────────────

/** GET /api/meetings/my  我的会议 */
router.get(
  '/my',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page 必须为正整数'),
    query('page_size').optional().isInt({ min: 1, max: 100 }).withMessage('page_size 范围 1-100'),
  ],
  asyncHandler(ctrl.myList),
)

/** GET /api/meetings/calendar  日历视图数据 */
router.get(
  '/calendar',
  [
    query('start_date').optional().isDate().withMessage('start_date 格式应为 YYYY-MM-DD'),
    query('end_date').optional().isDate().withMessage('end_date 格式应为 YYYY-MM-DD'),
  ],
  asyncHandler(ctrl.calendar),
)

// ─── 列表 / 新增 ───────────────────────────────────────────────────────────────

/** GET /api/meetings  会议列表（含筛选分页） */
router.get(
  '/',
  [
    query('start_date').optional().isDate().withMessage('start_date 格式应为 YYYY-MM-DD'),
    query('end_date').optional().isDate().withMessage('end_date 格式应为 YYYY-MM-DD'),
    query('status').optional().isIn(MEETING_STATUSES).withMessage('无效的状态值'),
    query('meeting_type').optional().isIn(MEETING_TYPES).withMessage('无效的会议类型'),
    query('page').optional().isInt({ min: 1 }).withMessage('page 必须为正整数'),
    query('page_size').optional().isInt({ min: 1, max: 100 }).withMessage('page_size 范围 1-100'),
  ],
  asyncHandler(ctrl.list),
)

/** POST /api/meetings  新增会议（管理员 / 领导） */
router.post(
  '/',
  requireAdminOrLeader,
  [
    body('meeting_name')
      .trim().notEmpty().withMessage('会议名称不能为空')
      .isLength({ max: 100 }).withMessage('会议名称不超过 100 字'),

    body('meeting_type')
      .notEmpty().withMessage('会议类型不能为空')
      .isIn(MEETING_TYPES).withMessage('无效的会议类型'),

    body('host_id')
      .notEmpty().withMessage('主持人不能为空')
      .isInt({ min: 1 }).withMessage('主持人 ID 必须为正整数'),

    body('start_time')
      .notEmpty().withMessage('开始时间不能为空')
      .isISO8601().withMessage('开始时间格式无效（须为 ISO8601 或 YYYY-MM-DD HH:mm:ss）'),

    body('end_time')
      .notEmpty().withMessage('结束时间不能为空')
      .isISO8601().withMessage('结束时间格式无效'),

    body('location')
      .trim().notEmpty().withMessage('会议地点不能为空')
      .isLength({ max: 100 }).withMessage('会议地点不超过 100 字'),

    body('reminder_setting')
      .optional()
      .isIn(REMINDER_SETTINGS).withMessage('无效的提醒设置'),

    body('participant_ids')
      .optional()
      .isArray().withMessage('participant_ids 必须为数组'),

    body('participant_ids.*')
      .optional()
      .isInt({ min: 1 }).withMessage('参会人员 ID 必须为正整数'),
  ],
  asyncHandler(ctrl.create),
)

// ─── 详情 / 更新 / 删除 ────────────────────────────────────────────────────────

/** GET /api/meetings/:id  会议详情 */
router.get('/:id', [validateId], asyncHandler(ctrl.detail))

/** PUT /api/meetings/:id  更新会议（管理员 / 领导） */
router.put(
  '/:id',
  requireAdminOrLeader,
  [
    validateId,

    body('meeting_name')
      .optional().trim().notEmpty().withMessage('会议名称不能为空')
      .isLength({ max: 100 }).withMessage('会议名称不超过 100 字'),

    body('meeting_type')
      .optional().isIn(MEETING_TYPES).withMessage('无效的会议类型'),

    body('host_id')
      .optional().isInt({ min: 1 }).withMessage('主持人 ID 必须为正整数'),

    body('start_time')
      .optional().isISO8601().withMessage('开始时间格式无效'),

    body('end_time')
      .optional().isISO8601().withMessage('结束时间格式无效'),

    body('location')
      .optional().trim().notEmpty().withMessage('会议地点不能为空')
      .isLength({ max: 100 }).withMessage('会议地点不超过 100 字'),

    body('status')
      .optional().isIn(MEETING_STATUSES).withMessage('无效的状态值'),

    body('reminder_setting')
      .optional().isIn(REMINDER_SETTINGS).withMessage('无效的提醒设置'),

    body('participant_ids')
      .optional().isArray().withMessage('participant_ids 必须为数组'),

    body('participant_ids.*')
      .optional().isInt({ min: 1 }).withMessage('参会人员 ID 必须为正整数'),
  ],
  asyncHandler(ctrl.update),
)

/** DELETE /api/meetings/:id  删除会议（管理员 / 领导） */
router.delete(
  '/:id',
  requireAdminOrLeader,
  [validateId],
  asyncHandler(ctrl.remove),
)

// ─── 确认参会 ──────────────────────────────────────────────────────────────────

/** PATCH /api/meetings/:id/confirm  确认参会状态 */
router.patch(
  '/:id/confirm',
  [
    validateId,
    body('confirmed')
      .notEmpty().withMessage('confirmed 不能为空')
      .isIn([0, 1, 2, '0', '1', '2']).withMessage('confirmed 必须为 0、1 或 2'),
  ],
  asyncHandler(ctrl.confirm),
)

module.exports = router
