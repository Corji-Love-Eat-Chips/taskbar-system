/**
 * routes/tasks.js
 * 任务管理路由  →  /api/tasks
 */

const { Router } = require('express')
const { body, param, query } = require('express-validator')
const ctrl = require('../controllers/taskController')
const taskFileCtrl = require('../controllers/taskFileController')
const { requireAuth, requireAdmin, requireAdminOrLeader } = require('../middlewares/auth')
const { requireTaskFileAccess } = require('../middlewares/taskFileAccess')
const { asyncHandler } = require('../utils/asyncHandler')
const { uploadExcel } = require('../middlewares/uploadExcel')
const { uploadTaskFile } = require('../middlewares/uploadTaskFile')

const router = Router()

// 所有接口需登录
router.use(requireAuth)

// ─── 公共校验 ─────────────────────────────────────────────────────────────────

const validateId = param('id')
  .isInt({ min: 1 }).withMessage('任务ID必须为正整数')

const validateFileId = param('fileId')
  .isInt({ min: 1 }).withMessage('文件ID必须为正整数')

const validateStaffId = param('staffId')
  .isInt({ min: 1 }).withMessage('人员ID必须为正整数')

const validateDate = (field, label) =>
  body(field)
    .notEmpty().withMessage(`${label}不能为空`)
    .isDate({ format: 'YYYY-MM-DD' }).withMessage(`${label}格式必须为 YYYY-MM-DD`)

// 有效的任务状态枚举
const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'delayed', 'cancelled']
const TASK_PRIORITIES = ['high', 'medium', 'low']
const TASK_SORT_BY = [
  'task_id',
  'task_name',
  'owner_name',
  'end_date',
  'start_date',
  'status',
  'progress',
  'category',
  'priority',
]

// ─── GET /api/tasks ───────────────────────────────────────────────────────────
/**
 * 任务列表（登录即可；教师仅看本人负责/协助的任务）
 * Query: period_id, owner_id, category, status, keyword, page, page_size | pageSize
 */
router.get(
  '/',
  [
    query('period_id').optional().isInt({ min: 1 }).withMessage('period_id 必须为正整数'),
    query('owner_id').optional().isInt({ min: 1 }).withMessage('owner_id 必须为正整数'),
    query('status').optional().isIn(TASK_STATUSES).withMessage('status 值无效'),
    query('page').optional().isInt({ min: 1 }).withMessage('page 必须为正整数'),
    query('page_size').optional().isInt({ min: 1, max: 100 }).withMessage('page_size 范围 1-100'),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('pageSize 范围 1-100'),
    query('sort_by').optional().isIn(TASK_SORT_BY).withMessage('sort_by 无效'),
    query('sort_order').optional().isIn(['asc', 'desc']).withMessage('sort_order 须为 asc 或 desc'),
  ],
  asyncHandler(ctrl.list),
)

/** POST /api/tasks/import  批量导入 Excel */
router.post(
  '/import',
  requireAdminOrLeader,
  uploadExcel.single('file'),
  asyncHandler(ctrl.importExcel),
)

// ─── 任务附件 /api/tasks/:id/files（须在 GET /:id 之前）────────────────────────
router.get(
  '/:id/files',
  [validateId],
  requireTaskFileAccess,
  asyncHandler(taskFileCtrl.list),
)
router.post(
  '/:id/files',
  [validateId],
  requireTaskFileAccess,
  uploadTaskFile.single('file'),
  asyncHandler(taskFileCtrl.upload),
)
router.get(
  '/:id/files/:fileId/download',
  [validateId, validateFileId],
  requireTaskFileAccess,
  asyncHandler(taskFileCtrl.download),
)
router.delete(
  '/:id/files/:fileId',
  [validateId, validateFileId],
  requireTaskFileAccess,
  asyncHandler(taskFileCtrl.remove),
)

// ─── GET /api/tasks/:id ───────────────────────────────────────────────────────
router.get('/:id', [validateId], asyncHandler(ctrl.detail))

// ─── POST /api/tasks ──────────────────────────────────────────────────────────
/**
 * 新增任务（管理员 / 领导任意负责人；教师仅可创建本人为负责人的任务，见 taskController.create）
 */
router.post(
  '/',
  requireAuth,
  [
    body('task_name')
      .trim().notEmpty().withMessage('任务名称不能为空')
      .isLength({ max: 100 }).withMessage('任务名称不超过 100 个字符'),
    body('owner_id')
      .notEmpty().withMessage('负责人不能为空')
      .isInt({ min: 1 }).withMessage('owner_id 必须为正整数'),
    body('category')
      .trim().notEmpty().withMessage('任务分类不能为空')
      .isLength({ max: 50 }).withMessage('分类名称不超过 50 个字符'),
    validateDate('start_date', '开始日期'),
    validateDate('end_date',   '结束日期'),
    body('period_id')
      .optional({ nullable: true })
      .isInt({ min: 1 }).withMessage('period_id 必须为正整数'),
    body('priority')
      .optional()
      .isIn(TASK_PRIORITIES).withMessage('priority 值无效（high/medium/low）'),
    body('collaborator_ids')
      .optional()
      .isArray().withMessage('collaborator_ids 必须为数组')
      .custom(ids => ids.every(id => Number.isInteger(Number(id)) && Number(id) > 0))
      .withMessage('collaborator_ids 包含无效的人员ID'),
    body('progress')
      .optional()
      .isInt({ min: 0, max: 100 }).withMessage('进度必须在 0-100 之间'),
  ],
  asyncHandler(ctrl.create),
)

// ─── PUT /api/tasks/:id ───────────────────────────────────────────────────────
/**
 * 更新任务（管理员 / 领导 / 负责人）
 * 负责人权限校验在 service 层通过 owner_id 比对
 */
router.put(
  '/:id',
  [
    validateId,
    body('task_name')
      .optional().trim().notEmpty().withMessage('任务名称不能为空字符串')
      .isLength({ max: 100 }).withMessage('任务名称不超过 100 个字符'),
    body('owner_id')
      .optional().isInt({ min: 1 }).withMessage('owner_id 必须为正整数'),
    body('category')
      .optional().trim().notEmpty().withMessage('任务分类不能为空字符串'),
    body('start_date')
      .optional().isDate({ format: 'YYYY-MM-DD' }).withMessage('开始日期格式必须为 YYYY-MM-DD'),
    body('end_date')
      .optional().isDate({ format: 'YYYY-MM-DD' }).withMessage('结束日期格式必须为 YYYY-MM-DD'),
    body('priority')
      .optional().isIn(TASK_PRIORITIES).withMessage('priority 值无效'),
    body('status')
      .optional().isIn(TASK_STATUSES).withMessage('status 值无效'),
    body('progress')
      .optional().isInt({ min: 0, max: 100 }).withMessage('进度必须在 0-100 之间'),
    body('collaborator_ids')
      .optional()
      .isArray().withMessage('collaborator_ids 必须为数组'),
  ],
  asyncHandler(ctrl.update),
)

// ─── PATCH /api/tasks/:id/progress ───────────────────────────────────────────
/**
 * 仅更新进度（负责人 / 协助人 / 管理员皆可）
 */
router.patch(
  '/:id/progress',
  [
    validateId,
    body('progress')
      .notEmpty().withMessage('progress 不能为空')
      .isInt({ min: 0, max: 100 }).withMessage('进度必须在 0-100 之间'),
  ],
  asyncHandler(ctrl.updateProgress),
)

// ─── DELETE /api/tasks/:id ────────────────────────────────────────────────────
/**
 * 删除任务（管理员 / 领导）
 */
router.delete(
  '/:id',
  requireAdminOrLeader,
  [validateId],
  asyncHandler(ctrl.remove),
)

// ─── 协助人子资源 ─────────────────────────────────────────────────────────────

/** GET /api/tasks/:id/collaborators */
router.get(
  '/:id/collaborators',
  [validateId],
  asyncHandler(ctrl.listCollaborators),
)

/** POST /api/tasks/:id/collaborators */
router.post(
  '/:id/collaborators',
  requireAdminOrLeader,
  [
    validateId,
    body('staff_id')
      .notEmpty().withMessage('staff_id 不能为空')
      .isInt({ min: 1 }).withMessage('staff_id 必须为正整数'),
  ],
  asyncHandler(ctrl.addCollaborator),
)

/** DELETE /api/tasks/:id/collaborators/:staffId */
router.delete(
  '/:id/collaborators/:staffId',
  requireAdminOrLeader,
  [validateId, validateStaffId],
  asyncHandler(ctrl.removeCollaborator),
)

module.exports = router
