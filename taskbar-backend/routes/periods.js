/**
 * routes/periods.js
 * 周期管理路由  →  /api/periods
 */

const { Router } = require('express')
const { body, param } = require('express-validator')
const ctrl = require('../controllers/periodController')
const { requireAuth, requireAdmin } = require('../middlewares/auth')
const { asyncHandler } = require('../utils/asyncHandler')

const router = Router()

// 所有接口需登录
router.use(requireAuth)

// ─── 公共校验规则 ─────────────────────────────────────────────────────────────

/** :id 路径参数必须为正整数 */
const validateId = param('id')
  .isInt({ min: 1 }).withMessage('周期ID必须为正整数')

/** 日期字段通用校验 */
const validateDate = (field, label) =>
  body(field)
    .notEmpty().withMessage(`${label}不能为空`)
    .isDate({ format: 'YYYY-MM-DD' }).withMessage(`${label}格式必须为 YYYY-MM-DD`)

// ─── GET /api/periods ─────────────────────────────────────────────────────────
/**
 * 获取周期列表（全部角色可访问）
 * 查询参数：?semester=2025-2026学年第二学期
 */
router.get('/', asyncHandler(ctrl.list))

// ─── GET /api/periods/:id ────────────────────────────────────────────────────
/**
 * 获取单个周期详情（全部角色可访问）
 */
router.get(
  '/:id',
  [validateId],
  asyncHandler(ctrl.detail),
)

// ─── POST /api/periods ────────────────────────────────────────────────────────
/**
 * 新增周期（管理员）
 *
 * Body:
 *   period_name  string  必填  周期名称，如"第9周"
 *   start_date   string  必填  YYYY-MM-DD
 *   end_date     string  必填  YYYY-MM-DD（须大于 start_date，由 Service 层校验）
 *   semester     string  可选  所属学期，如"2025-2026学年第二学期"
 *   sort_order   number  可选  排序值；不传时自动取当前最大值 + 1
 */
router.post(
  '/',
  requireAdmin,
  [
    body('period_name')
      .trim()
      .notEmpty().withMessage('周期名称不能为空')
      .isLength({ max: 50 }).withMessage('周期名称不能超过 50 个字符'),
    validateDate('start_date', '开始日期'),
    validateDate('end_date',   '结束日期'),
    body('semester')
      .optional({ nullable: true })
      .isLength({ max: 50 }).withMessage('学期名称不能超过 50 个字符'),
    body('sort_order')
      .optional({ nullable: true })
      .isInt({ min: 0 }).withMessage('sort_order 必须为非负整数'),
  ],
  asyncHandler(ctrl.create),
)

// ─── PUT /api/periods/:id ─────────────────────────────────────────────────────
/**
 * 更新周期（管理员）
 *
 * 所有字段均为可选（PATCH 语义，只更新传入字段）
 */
router.put(
  '/:id',
  requireAdmin,
  [
    validateId,
    body('period_name')
      .optional()
      .trim()
      .notEmpty().withMessage('周期名称不能为空字符串')
      .isLength({ max: 50 }).withMessage('周期名称不能超过 50 个字符'),
    body('start_date')
      .optional()
      .isDate({ format: 'YYYY-MM-DD' }).withMessage('开始日期格式必须为 YYYY-MM-DD'),
    body('end_date')
      .optional()
      .isDate({ format: 'YYYY-MM-DD' }).withMessage('结束日期格式必须为 YYYY-MM-DD'),
    body('semester')
      .optional({ nullable: true })
      .isLength({ max: 50 }).withMessage('学期名称不能超过 50 个字符'),
    body('sort_order')
      .optional({ nullable: true })
      .isInt({ min: 0 }).withMessage('sort_order 必须为非负整数'),
  ],
  asyncHandler(ctrl.update),
)

// ─── DELETE /api/periods/:id ──────────────────────────────────────────────────
/**
 * 删除周期（管理员）
 * 有关联任务时拒绝删除
 */
router.delete(
  '/:id',
  requireAdmin,
  [validateId],
  asyncHandler(ctrl.remove),
)

module.exports = router
